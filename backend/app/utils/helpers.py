from __future__ import annotations

import uuid
from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from flask import jsonify, Response
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_sqlalchemy.pagination import Pagination
from marshmallow import Schema, ValidationError

from app.extensions import db
from app.models.user import User

_F = TypeVar("_F", bound=Callable[..., Any])


def parse_uuid(value: Any) -> uuid.UUID | None:
    """Return a UUID for string/UUID values, or None for invalid input."""
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def current_user_id() -> uuid.UUID | None:
    """Return the current JWT identity as a UUID."""
    return parse_uuid(get_jwt_identity())


def get_current_user() -> User | None:
    """Return the active User row for the JWT identity in the current request."""
    uid = current_user_id()
    if uid is None:
        return None
    user = db.session.get(User, uid)
    if not user or not user.is_active:
        return None
    return user


def get_current_user_or_404() -> tuple[User, None] | tuple[None, tuple[Response, int]]:
    """Return ``(user, None)`` or ``(None, error_response)``."""
    uid = current_user_id()
    if uid is None:
        return None, (jsonify({"message": "User not found."}), 404)

    user = db.session.get(User, uid)
    if not user:
        return None, (jsonify({"message": "User not found."}), 404)
    if not user.is_active:
        return None, (jsonify({"message": "Account is deactivated."}), 403)
    return user, None


def active_jwt_required(*, refresh: bool = False) -> Callable[[_F], _F]:
    """Require a valid JWT whose user row still exists and is active."""
    def decorator(fn: _F) -> _F:
        @wraps(fn)
        @jwt_required(refresh=refresh)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            _, err = get_current_user_or_404()
            if err:
                return err
            return fn(*args, **kwargs)
        return wrapper  # type: ignore[return-value]
    return decorator


def paginate_response(
    items_key: str,
    paginated: Pagination,
    page: int,
    serializer: Callable[[Any], dict[str, Any]],
) -> tuple[Response, int]:
    """Build the standard paginated JSON envelope used by list endpoints."""
    return jsonify({
        items_key: [serializer(item) for item in paginated.items],
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
    }), 200


def load_or_422(
    schema: Schema,
    data: dict[str, Any],
) -> tuple[dict[str, Any], None] | tuple[None, tuple[Response, int]]:
    """Deserialise *data* through *schema*, returning a 2-tuple."""
    try:
        return schema.load(data), None
    except ValidationError as exc:
        return None, (jsonify({"errors": exc.messages}), 422)
