from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.extensions import db


class RevokedToken(db.Model):
    __tablename__ = "revoked_tokens"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    token_type = db.Column(db.String(20), nullable=False)
    user_id = db.Column(db.UUID(as_uuid=True), nullable=True, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    @classmethod
    def is_revoked(cls, jti: str | None) -> bool:
        if not jti:
            return False
        return db.session.query(cls.id).filter_by(jti=jti).first() is not None

    @classmethod
    def revoke(
        cls,
        *,
        jti: str,
        token_type: str,
        user_id: uuid.UUID | None,
        expires_at: datetime,
    ) -> bool:
        if cls.is_revoked(jti):
            return False
        db.session.add(cls(
            jti=jti,
            token_type=token_type,
            user_id=user_id,
            expires_at=expires_at,
        ))
        return True
