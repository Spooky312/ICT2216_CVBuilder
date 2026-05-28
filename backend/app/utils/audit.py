from __future__ import annotations

import uuid
from flask import request
from app.extensions import db
from app.models.audit_log import AuditLog


def log_event(
    event_type: str,
    user_id: uuid.UUID | str | None = None,
    metadata: dict[str, str | int] | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        event_type=event_type,
        ip_address=_get_ip(),
        user_agent=request.user_agent.string[:500] if request.user_agent.string else None,
        extra=metadata or {},
    )
    db.session.add(entry)
    db.session.commit()


def _get_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return (request.remote_addr or "unknown")[:45]
