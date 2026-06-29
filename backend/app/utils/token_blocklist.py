from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.extensions import db
from app.models.revoked_token import RevokedToken
from app.utils.helpers import parse_uuid


def revoke_jwt_payload(payload: dict[str, Any]) -> bool:
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        return False

    expires_at = datetime.fromtimestamp(int(exp), tz=timezone.utc)
    user_id = parse_uuid(payload.get("sub"))
    token_type = str(payload.get("type") or "access")
    return RevokedToken.revoke(
        jti=str(jti),
        token_type=token_type,
        user_id=user_id if isinstance(user_id, uuid.UUID) else None,
        expires_at=expires_at,
    )


def revoke_jwt_payloads(*payloads: dict[str, Any] | None) -> int:
    count = 0
    for payload in payloads:
        if payload and revoke_jwt_payload(payload):
            count += 1
    if count:
        db.session.commit()
    return count
