from __future__ import annotations

from flask import Blueprint, request, jsonify, Response, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, set_access_cookies,
    set_refresh_cookies, unset_jwt_cookies, get_jwt, decode_token,
)
from app.extensions import db, limiter
from app.models.user import User
from app.schemas.user_schema import RegisterSchema, LoginSchema, VerifyTwoFactorSchema
from app.utils.audit import log_event
from app.utils.captcha import generate_captcha, verify_captcha
from app.utils.helpers import active_jwt_required, current_user_id, load_or_422
from app.utils.security import record_failed_login, reset_failed_logins
from app.utils.token_blocklist import revoke_jwt_payloads
from app.utils.totp import (
    decrypt_totp_secret, encrypt_totp_secret, generate_totp_secret,
    provisioning_uri, verify_totp_code,
)
from app.utils.two_factor import create_two_factor_challenge, verify_two_factor_challenge

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

register_schema = RegisterSchema()
login_schema = LoginSchema()
verify_2fa_schema = VerifyTwoFactorSchema()

# Identical for new and already-registered emails so registration can't be used
# to enumerate accounts. 2FA enrolment happens at first login.
_REGISTER_OK_MESSAGE = "Account created. Log in to finish setting up two-factor authentication."

# After this many consecutive failed logins the account must solve a
# server-issued CAPTCHA on every further attempt. Invalid-credential responses
# always use the same shape so CAPTCHA state cannot identify registered emails.
_CAPTCHA_THRESHOLD = 3
_INVALID_LOGIN_RESPONSE = {
    "message": "Invalid credentials.",
    "show_captcha": True,
}


def _captcha_required(user: User) -> bool:
    return user.failed_logins >= _CAPTCHA_THRESHOLD


def _equalize_password_timing(password: str) -> None:
    """Spend the same time hashing as a real signup/login would.

    Prevents a timing side-channel from revealing whether an email exists when
    we short-circuit (duplicate registration / unknown-user login).
    """
    User().set_password(password)


def _invalid_login() -> tuple[Response, int]:
    return jsonify(_INVALID_LOGIN_RESPONSE), 401


def _totp_setup_payload(user: User, secret: str) -> dict[str, str | bool]:
    return {
        "requires_2fa": True,
        "totp_secret": secret,
        "totp_uri": provisioning_uri(user.email, secret),
    }


def _totp_challenge_payload(user: User) -> dict[str, str | bool]:
    payload: dict[str, str | bool] = {
        "message": "Enter your authenticator code.",
        "requires_2fa": True,
    }
    if user.totp_secret:
        payload["challenge_token"] = create_two_factor_challenge(user.user_id)
        return payload

    secret = generate_totp_secret()
    payload["challenge_token"] = create_two_factor_challenge(
        user.user_id,
        setup_secret=secret,
    )
    payload.update(_totp_setup_payload(user, secret))
    log_event("totp_setup_pending", user_id=user.user_id)
    return payload


def _issue_login_response(user: User) -> tuple[Response, int]:
    reset_failed_logins(user)
    identity = str(user.user_id)
    additional = {"role": user.role, "email": user.email}

    access_token = create_access_token(identity=identity, additional_claims=additional)
    refresh_token = create_refresh_token(identity=identity, additional_claims=additional)

    resp = jsonify({"message": "Login successful.", "user": user.to_dict()})
    set_access_cookies(resp, access_token)
    set_refresh_cookies(resp, refresh_token)

    log_event("login_success", user_id=user.user_id)
    return resp, 200


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10 per hour")
def register() -> tuple[Response, int]:
    data, err = load_or_422(register_schema, request.get_json(force=True) or {})
    if err:
        return err

    email = data["email"].lower()
    if User.query.filter_by(email=email).first():
        # Don't reveal that the email is already registered (anti-enumeration).
        # Match the work/response of a real signup, then return the same body.
        _equalize_password_timing(data["password"])
        log_event("register_existing_email", metadata={"email": email})
        return jsonify({"message": _REGISTER_OK_MESSAGE}), 201

    # TOTP enrolment is deferred to first login (see _ensure_totp_setup), so
    # registration never has to hand back a secret and stays indistinguishable
    # from the duplicate-email case above.
    user = User(
        email=email,
        full_name=data["full_name"],
        totp_enabled=True,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    log_event("user_registered", user_id=user.user_id, metadata={"totp_enabled": 1})
    return jsonify({"message": _REGISTER_OK_MESSAGE}), 201


@auth_bp.route("/captcha", methods=["GET"])
@limiter.limit("30 per 15 minutes")
def captcha() -> tuple[Response, int]:
    """Issue a fresh CAPTCHA challenge for the client to solve. The answer is
    sealed inside the signed token, never returned in the clear."""
    token, question = generate_captcha()
    return jsonify({"captcha_token": token, "question": question}), 200


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per 15 minutes", key_func=lambda: (
    (request.get_json(force=True) or {}).get("email", "unknown").lower()
))
def login() -> tuple[Response, int]:
    data, err = load_or_422(login_schema, request.get_json(force=True) or {})
    if err:
        return err

    user = User.query.filter_by(email=data["email"].lower()).first()

    if not user:
        # Equalize timing AND response body with a real account's first failed
        # attempt so login can't reveal which emails are registered.
        # NOTE: keep in sync with the wrong-password response shape below.
        _equalize_password_timing(data["password"])
        log_event("login_failed_unknown", metadata={"email": data["email"]})
        return _invalid_login()

    if user.is_locked():
        log_event("login_blocked_locked", user_id=user.user_id)
        return jsonify({"message": "Account temporarily locked. Try again later."}), 429

    # Once enough failures have piled up, every further attempt must carry a
    # valid server-issued CAPTCHA. Enforced BEFORE the password check so an
    # attacker can't keep guessing passwords without solving a fresh challenge.
    # A failed/absent CAPTCHA does not count as a password failure, so it can't
    # be abused to lock another user's account.
    if _captcha_required(user) and not verify_captcha(
        data.get("captcha_token"), data.get("captcha_answer")
    ):
        log_event("login_captcha_failed", user_id=user.user_id)
        _equalize_password_timing(data["password"])
        return _invalid_login()

    if not user.check_password(data["password"]):
        record_failed_login(user)
        failed = user.failed_logins
        log_event("login_failed", user_id=user.user_id,
                  metadata={"failed_count": failed})

        msg = "Invalid credentials."
        if user.is_locked():
            msg = "Invalid credentials. Account is now locked."

        if user.is_locked():
            return jsonify({"message": msg, "show_captcha": True}), 401
        return _invalid_login()

    if not user.is_active:
        log_event("login_blocked_deactivated", user_id=user.user_id)
        return jsonify({"message": "Account is deactivated."}), 403

    log_event("login_totp_required", user_id=user.user_id)
    return jsonify(_totp_challenge_payload(user)), 202


@auth_bp.route("/verify-2fa", methods=["POST"])
@limiter.limit("10 per 15 minutes")
def verify_2fa() -> tuple[Response, int]:
    data, err = load_or_422(verify_2fa_schema, request.get_json(force=True) or {})
    if err:
        return err

    challenge = verify_two_factor_challenge(data["challenge_token"])
    if challenge is None:
        return jsonify({"message": "Two-factor challenge expired. Please log in again."}), 401

    user = db.session.get(User, challenge.user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404
    if not user.is_active:
        log_event("login_blocked_deactivated", user_id=user.user_id)
        return jsonify({"message": "Account is deactivated."}), 403
    if user.is_locked():
        log_event("login_blocked_locked", user_id=user.user_id)
        return jsonify({"message": "Account temporarily locked. Try again later."}), 429
    if not user.totp_secret and not challenge.setup_secret:
        return jsonify({"message": "Two-factor authentication is not set up."}), 400

    secret = decrypt_totp_secret(user.totp_secret) if user.totp_secret else challenge.setup_secret
    if not verify_totp_code(secret, data["totp_code"]):
        record_failed_login(user)
        failed = user.failed_logins
        log_event("login_totp_failed", user_id=user.user_id,
                  metadata={"failed_count": failed})

        msg = "Invalid authenticator code."
        if user.is_locked():
            msg = "Invalid authenticator code. Account is now locked."

        return jsonify({
            "message": msg,
            "show_captcha": failed >= _CAPTCHA_THRESHOLD,
        }), 401

    if not user.totp_secret:
        user.totp_secret = encrypt_totp_secret(secret)
        user.totp_enabled = True
        log_event("totp_setup_completed", user_id=user.user_id)

    return _issue_login_response(user)


@auth_bp.route("/refresh", methods=["POST"])
@active_jwt_required(refresh=True)
def refresh() -> tuple[Response, int]:
    uid = current_user_id()
    if uid is None:
        return jsonify({"message": "User not found."}), 404

    user = db.session.get(User, uid)
    if not user:
        return jsonify({"message": "User not found."}), 404
    if not user.is_active:
        return jsonify({"message": "Account is deactivated."}), 403

    identity = str(user.user_id)
    additional = {"role": user.role, "email": user.email}
    access_token = create_access_token(identity=identity, additional_claims=additional)
    resp = jsonify({"message": "Token refreshed."})
    set_access_cookies(resp, access_token)
    return resp, 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout() -> tuple[Response, int]:
    user_id = current_user_id()
    access_payload = get_jwt()
    refresh_payload = _decode_refresh_cookie()
    revoked_count = revoke_jwt_payloads(access_payload, refresh_payload)
    log_event("logout", user_id=user_id, metadata={"revoked_tokens": revoked_count})
    resp = jsonify({"message": "Logged out."})
    unset_jwt_cookies(resp)
    return resp, 200


def _decode_refresh_cookie() -> dict[str, object] | None:
    cookie_name = current_app.config.get("JWT_REFRESH_COOKIE_NAME", "refresh_token_cookie")
    refresh_token = request.cookies.get(cookie_name)
    if not refresh_token:
        return None
    try:
        return decode_token(refresh_token)
    except Exception:
        current_app.logger.warning("Failed to decode refresh token during logout", exc_info=True)
        return None


