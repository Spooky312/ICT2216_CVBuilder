from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

from flask import jsonify, Response
from flask_jwt_extended import get_jwt_identity
from flask_sqlalchemy.pagination import Pagination
from marshmallow import Schema, ValidationError

from app.extensions import db
from app.models.user import User


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
    """Return the User row for the JWT identity in the current request.

    JWT subjects are stored as strings, while the database column is a UUID.
    Convert before querying so SQLAlchemy's UUID bind processor receives the
    type it expects.
    """
    uid = current_user_id()
    if uid is None:
        return None
    return db.session.get(User, uid)


def get_current_user_or_404() -> tuple[User, None] | tuple[None, tuple[Response, int]]:
    """Return ``(user, None)`` or ``(None, 404_response)``.

    On success  → ``(user, None)``
    On failure  → ``(None, flask_response_404)``

    Typical usage::

        user, err = get_current_user_or_404()
        if err:
            return err
    """
    user = get_current_user()
    if not user:
        return None, (jsonify({"message": "User not found."}), 404)
    return user, None


def paginate_response(
    items_key: str,
    paginated: Pagination,
    page: int,
    serializer: Callable[[Any], dict[str, Any]],
) -> tuple[Response, int]:
    """Build the standard paginated JSON envelope used by list endpoints.

    ``serializer`` converts one ORM object to a dict (e.g. ``lambda u: u.to_dict()``).
    """
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
    """Deserialise *data* through *schema*, returning a 2-tuple.

    On success  → ``(loaded_data, None)``
    On failure  → ``(None, flask_response_422)``

    Typical usage::

        data, err = load_or_422(my_schema, request.get_json(force=True) or {})
        if err:
            return err

    This avoids repeating the identical ``try/except ValidationError`` block
    in every route that validates request bodies.
    """
    try:
        return schema.load(data), None
    except ValidationError as exc:
        return None, (jsonify({"errors": exc.messages}), 422)
