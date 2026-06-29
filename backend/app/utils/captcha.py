from __future__ import annotations

import hmac
import re
import secrets
from typing import Any

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

_PURPOSE = "login-captcha"
_SALT = "cvbuilder-captcha"

# The signed token carries the expected answer, so the question we hand to the
# client must let the client compute the same answer. Keep operands small so the
# challenge stays solvable by a human but the space is large enough that a bot
# can't trivially precompute every (token, answer) pair within the short TTL.
_MIN_OPERAND = 1
_MAX_OPERAND = 9

_QUESTION_RE = re.compile(r"What is (\d+) \+ (\d+)\?")


def generate_captcha() -> tuple[str, str]:
    """Issue a signed arithmetic CAPTCHA.

    Returns ``(token, question)``. The answer lives only inside the signed,
    time-limited token; it is never sent to the client in the clear, so the
    client cannot forge a token for an arbitrary answer.
    """
    a = secrets.randbelow(_MAX_OPERAND - _MIN_OPERAND + 1) + _MIN_OPERAND
    b = secrets.randbelow(_MAX_OPERAND - _MIN_OPERAND + 1) + _MIN_OPERAND
    token = _serializer().dumps({"purpose": _PURPOSE, "answer": str(a + b)})
    return token, f"What is {a} + {b}?"


def verify_captcha(token: str | None, answer: str | None) -> bool:
    """Return True only when *token* is a valid, unexpired CAPTCHA whose signed
    answer matches *answer*. Any tampering, expiry, or mismatch returns False."""
    if not token or answer is None:
        return False
    try:
        data: dict[str, Any] = _serializer().loads(
            token,
            max_age=current_app.config.get("CAPTCHA_CHALLENGE_EXPIRES", 120),
        )
    except (BadSignature, SignatureExpired):
        return False
    if data.get("purpose") != _PURPOSE:
        return False
    expected = str(data.get("answer", ""))
    return hmac.compare_digest(expected, str(answer).strip())


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=_SALT)
