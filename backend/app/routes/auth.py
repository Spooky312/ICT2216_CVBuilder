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
from app.utils.helpers import current_user_id, load_or_422
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


def _totp_setup_payload(user: User, secret: str) -> dict[str, str | bool]:
    return {
        "requires_2fa": True,
        "totp_secret": secret,
        "totp_uri": provisioning_uri(user.email, secret),
    }


def _ensure_totp_setup(user: User) -> tuple[str, dict[str, str | bool] | None]:
    if user.totp_secret:
        return decrypt_totp_secret(user.totp_secret), None

    secret = generate_totp_secret()
    user.totp_secret = encrypt_totp_secret(secret)
    user.totp_enabled = True
    db.session.commit()
    log_event("totp_setup_generated", user_id=user.user_id)
    return secret, _totp_setup_payload(user, secret)


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

    if User.query.filter_by(email=data["email"].lower()).first():
        return jsonify({"message": "Email already registered."}), 409

    secret = generate_totp_secret()
    user = User(
        email=data["email"].lower(),
        full_name=data["full_name"],
        totp_secret=encrypt_totp_secret(secret),
        totp_enabled=True,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    log_event("user_registered", user_id=user.user_id, metadata={"totp_enabled": 1})
    return jsonify({
        "message": "Account created. Set up two-factor authentication before logging in.",
        **_totp_setup_payload(user, secret),
    }), 201


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
        log_event("login_failed_unknown", metadata={"email": data["email"]})
        return jsonify({"message": "Invalid credentials."}), 401

    if user.is_locked():
        log_event("login_blocked_locked", user_id=user.user_id)
        return jsonify({"message": "Account temporarily locked. Try again later."}), 429

    if not user.check_password(data["password"]):
        record_failed_login(user)
        failed = user.failed_logins
        remaining = max(0, 5 - failed)
        log_event("login_failed", user_id=user.user_id,
                  metadata={"failed_count": failed})
        
        msg = "Invalid credentials."
        if remaining == 0:
            msg = "Invalid credentials. Account is now locked."
            
        return jsonify({
            "message": msg,
            "show_captcha": failed >= 3,
            "attempts_remaining": remaining
        }), 401

    if not user.is_active:
        log_event("login_blocked_deactivated", user_id=user.user_id)
        return jsonify({"message": "Account is deactivated."}), 403

    secret, setup_payload = _ensure_totp_setup(user)
    challenge_token = create_two_factor_challenge(user.user_id)
    log_event("login_totp_required", user_id=user.user_id)

    payload: dict[str, str | bool] = {
        "message": "Enter your authenticator code.",
        "requires_2fa": True,
        "challenge_token": challenge_token,
    }
    if setup_payload:
        payload.update(setup_payload)
    return jsonify(payload), 202


@auth_bp.route("/verify-2fa", methods=["POST"])
@limiter.limit("10 per 15 minutes")
def verify_2fa() -> tuple[Response, int]:
    data, err = load_or_422(verify_2fa_schema, request.get_json(force=True) or {})
    if err:
        return err

    uid = verify_two_factor_challenge(data["challenge_token"])
    if uid is None:
        return jsonify({"message": "Two-factor challenge expired. Please log in again."}), 401

    user = db.session.get(User, uid)
    if not user:
        return jsonify({"message": "User not found."}), 404
    if not user.is_active:
        log_event("login_blocked_deactivated", user_id=user.user_id)
        return jsonify({"message": "Account is deactivated."}), 403
    if user.is_locked():
        log_event("login_blocked_locked", user_id=user.user_id)
        return jsonify({"message": "Account temporarily locked. Try again later."}), 429
    if not user.totp_secret:
        return jsonify({"message": "Two-factor authentication is not set up."}), 400

    secret = decrypt_totp_secret(user.totp_secret)
    if not verify_totp_code(secret, data["totp_code"]):
        record_failed_login(user)
        failed = user.failed_logins
        remaining = max(0, 5 - failed)
        log_event("login_totp_failed", user_id=user.user_id,
                  metadata={"failed_count": failed})
        
        msg = "Invalid authenticator code."
        if remaining == 0:
            msg = "Invalid authenticator code. Account is now locked."
            
        return jsonify({
            "message": msg,
            "show_captcha": failed >= 3,
            "attempts_remaining": remaining
        }), 401

    return _issue_login_response(user)


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh() -> tuple[Response, int]:
    uid = current_user_id()
    if uid is None:
        return jsonify({"message": "User not found."}), 404

    user = db.session.get(User, uid)
    if not user:
        return jsonify({"message": "User not found."}), 404

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





