from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone, timedelta
from functools import wraps
from typing import Any, TypeVar

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.resume_template import ResumeTemplate
from app.services.template_service import (
    BUILTIN_TEMPLATE_FILES, create_template, ensure_default_templates,
    list_templates, normalise_template_id, valid_template_id,
)
from app.utils.audit import log_event
from app.utils.helpers import current_user_id, paginate_response, parse_uuid

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

_F = TypeVar("_F", bound=Callable[..., tuple[Response, int]])


def admin_required(fn: _F) -> _F:
    @wraps(fn)
    @jwt_required()
    def wrapper(*args: Any, **kwargs: Any) -> tuple[Response, int]:
        uid = current_user_id()
        user = db.session.get(User, uid) if uid else None
        if not user or not user.is_active or user.role != "admin":
            log_event("admin_access_denied", user_id=uid,
                      metadata={"endpoint": request.path})
            return jsonify({"message": "Admin access required."}), 403
        return fn(*args, **kwargs)
    return wrapper  # type: ignore[return-value]


def _get_target_user(user_id: str) -> User | None:
    target_user_id = parse_uuid(user_id)
    return db.session.get(User, target_user_id) if target_user_id else None


def _is_self(user: User) -> bool:
    return user.user_id == current_user_id()


@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users() -> tuple[Response, int]:
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    paginated = User.query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    log_event("admin_list_users", user_id=current_user_id(),
              metadata={"page": page, "per_page": per_page, "total": paginated.total})
    return paginate_response("users", paginated, page, lambda u: u.to_dict())


@admin_bp.route("/users/<user_id>/lock", methods=["POST"])
@admin_required
def lock_user(user_id: str) -> tuple[Response, int]:
    user = _get_target_user(user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404
    if _is_self(user):
        return jsonify({"message": "You cannot lock your own admin account."}), 400
    if not user.is_active:
        return jsonify({"message": "Cannot lock a deactivated account."}), 400

    minutes = request.get_json(force=True, silent=True) or {}
    duration = int(minutes.get("minutes", 60))
    duration = max(1, min(duration, 10080))
    user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=duration)
    db.session.commit()
    log_event("admin_user_locked", user_id=current_user_id(),
              metadata={"target_user": user_id, "minutes": duration})
    return jsonify({
        "message": f"User locked for {duration} minutes.",
        "locked_until": user.locked_until.isoformat(),
    }), 200


@admin_bp.route("/users/<user_id>/unlock", methods=["POST"])
@admin_required
def unlock_user(user_id: str) -> tuple[Response, int]:
    user = _get_target_user(user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404
    if not user.is_active:
        return jsonify({"message": "Cannot unlock a deactivated account."}), 400

    user.locked_until = None
    user.failed_logins = 0
    db.session.commit()
    log_event("admin_user_unlocked", user_id=current_user_id(),
              metadata={"target_user": user_id})
    return jsonify({"message": "User unlocked."}), 200


@admin_bp.route("/users/<user_id>/deactivate", methods=["POST"])
@admin_required
def deactivate_user(user_id: str) -> tuple[Response, int]:
    user = _get_target_user(user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404
    if _is_self(user):
        return jsonify({"message": "You cannot deactivate your own admin account."}), 400

    user.is_active = False
    user.locked_until = None
    user.failed_logins = 0
    db.session.commit()
    log_event("admin_user_deactivated", user_id=current_user_id(),
              metadata={"target_user": user_id})
    return jsonify({"message": "User deactivated.", "user": user.to_dict()}), 200


@admin_bp.route("/users/<user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id: str) -> tuple[Response, int]:
    user = _get_target_user(user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404
    if _is_self(user):
        return jsonify({"message": "You cannot delete your own admin account."}), 400

    target_email = user.email
    db.session.delete(user)
    db.session.commit()
    log_event("admin_user_deleted", user_id=current_user_id(),
              metadata={"target_user": user_id, "target_email": target_email})
    return jsonify({"message": "User permanently deleted."}), 200


@admin_bp.route("/audit-log", methods=["GET"])
@admin_required
def get_audit_log() -> tuple[Response, int]:
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 200)
    event_type = request.args.get("event_type")

    query = AuditLog.query.order_by(AuditLog.occurred_at.desc())
    if event_type:
        query = query.filter_by(event_type=event_type)

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    return paginate_response("logs", paginated, page, lambda e: e.to_dict())


@admin_bp.route("/templates", methods=["GET"])
@admin_required
def list_admin_templates() -> tuple[Response, int]:
    templates = [template.to_dict() for template in list_templates(active_only=False)]
    return jsonify(templates), 200


@admin_bp.route("/templates", methods=["POST"])
@admin_required
def add_template() -> tuple[Response, int]:
    ensure_default_templates()
    data = request.get_json(force=True, silent=True) or {}
    template_id = normalise_template_id(str(data.get("template_id", "")))
    name = str(data.get("name", "")).strip()
    description = str(data.get("description", "")).strip()
    source_template_id = normalise_template_id(str(data.get("source_template_id", "")))
    active = bool(data.get("active", True))

    errors: dict[str, list[str]] = {}
    if not valid_template_id(template_id):
        errors["template_id"] = ["Use 2-50 lowercase letters, numbers, hyphens, or underscores."]
    elif db.session.get(ResumeTemplate, template_id):
        errors["template_id"] = ["Template ID already exists."]
    if not 1 <= len(name) <= 80:
        errors["name"] = ["Name must be 1-80 characters."]
    if len(description) > 250:
        errors["description"] = ["Description must be 250 characters or fewer."]
    if source_template_id not in BUILTIN_TEMPLATE_FILES:
        errors["source_template_id"] = ["Choose modern, classic, or minimal."]
    if errors:
        return jsonify({"errors": errors}), 422

    template = create_template(
        template_id=template_id,
        name=name,
        description=description,
        source_template_id=source_template_id,
        active=active,
    )
    log_event("admin_template_created", user_id=current_user_id(),
              metadata={"template_id": template_id, "source_template_id": source_template_id})
    return jsonify(template.to_dict()), 201


@admin_bp.route("/templates/<template_id>", methods=["PUT"])
@admin_required
def update_template(template_id: str) -> tuple[Response, int]:
    ensure_default_templates()
    template = db.session.get(ResumeTemplate, normalise_template_id(template_id))
    if not template:
        return jsonify({"message": "Template not found."}), 404

    data = request.get_json(force=True, silent=True) or {}
    errors: dict[str, list[str]] = {}

    if "name" in data:
        name = str(data["name"]).strip()
        if not 1 <= len(name) <= 80:
            errors["name"] = ["Name must be 1-80 characters."]
        else:
            template.name = name
    if "description" in data:
        description = str(data["description"]).strip()
        if len(description) > 250:
            errors["description"] = ["Description must be 250 characters or fewer."]
        else:
            template.description = description
    if "source_template_id" in data:
        source_template_id = normalise_template_id(str(data["source_template_id"]))
        if source_template_id not in BUILTIN_TEMPLATE_FILES:
            errors["source_template_id"] = ["Choose modern, classic, or minimal."]
        else:
            template.source_template_id = source_template_id
    if "active" in data:
        template.active = bool(data["active"])

    if errors:
        return jsonify({"errors": errors}), 422

    db.session.commit()
    log_event("admin_template_updated", user_id=current_user_id(),
              metadata={"template_id": template.template_id})
    return jsonify(template.to_dict()), 200
