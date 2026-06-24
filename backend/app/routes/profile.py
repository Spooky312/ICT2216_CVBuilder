from __future__ import annotations

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, unset_jwt_cookies
from app.extensions import db
from app.schemas.user_schema import UpdateProfileSchema, DeleteAccountSchema
from app.utils.audit import log_event
from app.utils.helpers import get_current_user_or_404, load_or_422

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")

update_schema = UpdateProfileSchema()
delete_schema = DeleteAccountSchema()


@profile_bp.route("", methods=["GET"])
@jwt_required()
def get_profile() -> tuple[Response, int]:
    user, err = get_current_user_or_404()
    if err:
        return err
    return jsonify(user.to_dict()), 200


@profile_bp.route("", methods=["PUT"])
@jwt_required()
def update_profile() -> tuple[Response, int]:
    user, err = get_current_user_or_404()
    if err:
        return err

    data, err = load_or_422(update_schema, request.get_json(force=True) or {})
    if err:
        return err

    if not data:
        return jsonify({"message": "No fields to update."}), 400

    if "new_password" in data:
        current_pw = data.get("current_password")
        if not current_pw or not user.check_password(current_pw):
            log_event("profile_update_bad_password", user_id=user.user_id)
            return jsonify({"message": "Current password is incorrect."}), 403
        user.set_password(data["new_password"])
        log_event("password_changed", user_id=user.user_id)

    if "full_name" in data:
        user.full_name = data["full_name"]

    db.session.commit()
    log_event("profile_updated", user_id=user.user_id)
    return jsonify(user.to_dict()), 200


@profile_bp.route("", methods=["DELETE"])
@jwt_required()
def delete_account() -> tuple[Response, int]:
    user, err = get_current_user_or_404()
    if err:
        return err

    data, err = load_or_422(delete_schema, request.get_json(force=True) or {})
    if err:
        return err

    if not user.check_password(data["password"]):
        log_event("account_delete_bad_password", user_id=user.user_id)
        return jsonify({"message": "Password is incorrect."}), 403

    uid = user.user_id
    db.session.delete(user)
    db.session.commit()
    log_event("account_deleted", user_id=uid)

    resp = jsonify({"message": "Account deleted."})
    unset_jwt_cookies(resp)
    return resp, 200
