from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

_PURPOSE = "totp-login"


@dataclass(frozen=True)
class TwoFactorChallenge:
    user_id: uuid.UUID
    setup_secret: str | None = None


def create_two_factor_challenge(user_id: uuid.UUID, *, setup_secret: str | None = None) -> str:
    serializer = _serializer()
    payload = {"purpose": _PURPOSE, "user_id": str(user_id)}
    if setup_secret:
        payload["setup_secret"] = setup_secret
    return serializer.dumps(payload)


def verify_two_factor_challenge(token: str) -> TwoFactorChallenge | None:
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
        user_id = uuid.UUID(str(data.get("user_id")))
    except (TypeError, ValueError):
        return None
    setup_secret = data.get("setup_secret")
    return TwoFactorChallenge(
        user_id=user_id,
        setup_secret=str(setup_secret) if setup_secret else None,
    )


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="cvbuilder-2fa")
