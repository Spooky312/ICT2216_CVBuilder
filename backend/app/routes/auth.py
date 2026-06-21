from __future__ import annotations

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, set_access_cookies,
    set_refresh_cookies, unset_jwt_cookies,
)
from app.extensions import db, limiter
from app.models.user import User
from app.schemas.user_schema import RegisterSchema, LoginSchema
from app.utils.audit import log_event
from app.utils.helpers import current_user_id, load_or_422
from app.utils.security import record_failed_login, reset_failed_logins

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

register_schema = RegisterSchema()
login_schema = LoginSchema()


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10 per hour")
def register() -> tuple[Response, int]:
    data, err = load_or_422(register_schema, request.get_json(force=True) or {})
    if err:
        return err

    if User.query.filter_by(email=data["email"].lower()).first():
        return jsonify({"message": "Email already registered."}), 409

    user = User(
        email=data["email"].lower(),
        full_name=data["full_name"],
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    log_event("user_registered", user_id=user.user_id)
    return jsonify({"message": "Account created. You can now log in."}), 201


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
        log_event("login_failed", user_id=user.user_id,
                  metadata={"failed_count": user.failed_logins})
        return jsonify({
            "message": "Invalid credentials.",
            "show_captcha": user.failed_logins >= 3,
        }), 401


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
    log_event("logout", user_id=user_id)
    resp = jsonify({"message": "Logged out."})
    unset_jwt_cookies(resp)
    return resp, 200


