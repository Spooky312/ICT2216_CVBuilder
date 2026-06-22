from __future__ import annotations

import uuid
from typing import Any

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

_PURPOSE = "totp-login"


def create_two_factor_challenge(user_id: uuid.UUID) -> str:
    serializer = _serializer()
    return serializer.dumps({"purpose": _PURPOSE, "user_id": str(user_id)})


def verify_two_factor_challenge(token: str) -> uuid.UUID | None:
    try:
        data: dict[str, Any] = _serializer().loads(
            token,
            max_age=current_app.config.get("TWO_FACTOR_CHALLENGE_EXPIRES", 300),
        )
    except (BadSignature, SignatureExpired):
        return None
    if data.get("purpose") != _PURPOSE:
        return None
    try:
        return uuid.UUID(str(data.get("user_id")))
    except (TypeError, ValueError):
        return None


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="cvbuilder-2fa")
