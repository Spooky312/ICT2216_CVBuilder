from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone, timedelta
from functools import wraps
from typing import Any, TypedDict, TypeVar

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.resume_schema import ALLOWED_TEMPLATES, TEMPLATE_METADATA
from app.utils.audit import log_event
from app.utils.helpers import current_user_id, paginate_response, parse_uuid


class TemplateEntry(TypedDict):
    id: str
    name: str
    active: bool
    description: str


admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

_F = TypeVar("_F", bound=Callable[..., tuple[Response, int]])


def admin_required(fn: _F) -> _F:
    @wraps(fn)
    @jwt_required()
    def wrapper(*args: Any, **kwargs: Any) -> tuple[Response, int]:
        uid = current_user_id()
        # Live DB lookup so a demoted admin loses access immediately, not at token expiry.
        user = db.session.get(User, uid) if uid else None
        if not user or user.role != "admin":
            log_event("admin_access_denied", user_id=uid,
                      metadata={"endpoint": request.path})
            return jsonify({"message": "Admin access required."}), 403
        return fn(*args, **kwargs)
    return wrapper  # type: ignore[return-value]


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
    target_user_id = parse_uuid(user_id)
    user = db.session.get(User, target_user_id) if target_user_id else None
    if not user:
        return jsonify({"message": "User not found."}), 404

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
    target_user_id = parse_uuid(user_id)
    user = db.session.get(User, target_user_id) if target_user_id else None
    if not user:
        return jsonify({"message": "User not found."}), 404

    user.locked_until = None
    user.failed_logins = 0
    db.session.commit()
    log_event("admin_user_unlocked", user_id=current_user_id(),
              metadata={"target_user": user_id})
    return jsonify({"message": "User unlocked."}), 200


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


# In-process mutable store for admin-editable template state.
# Seeded from TEMPLATE_METADATA (the single source of truth for ids/names/descriptions);
# ALLOWED_TEMPLATES guards that no unknown id slips in.
TEMPLATES_DB: list[TemplateEntry] = [
    {"id": tid, "name": meta["name"], "active": True, "description": meta["description"]}
    for tid, meta in TEMPLATE_METADATA.items()
    if tid in ALLOWED_TEMPLATES
]


@admin_bp.route("/templates", methods=["GET"])
@admin_required
def list_templates() -> tuple[Response, int]:
    return jsonify(TEMPLATES_DB), 200


@admin_bp.route("/templates/<template_id>", methods=["PUT"])
@admin_required
def update_template(template_id: str) -> tuple[Response, int]:
    data = request.get_json(force=True, silent=True) or {}
    for tmpl in TEMPLATES_DB:
        if tmpl["id"] == template_id:
            if "name" in data:
                tmpl["name"] = str(data["name"])[:50]
            if "description" in data:
                tmpl["description"] = str(data["description"])[:200]
            if "active" in data:
                tmpl["active"] = bool(data["active"])
            log_event("admin_template_updated", user_id=current_user_id(),
                      metadata={"template_id": template_id})
            return jsonify(tmpl), 200
    return jsonify({"message": "Template not found."}), 404

