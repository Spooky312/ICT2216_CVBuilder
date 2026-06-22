from __future__ import annotations

import uuid
from datetime import datetime, timezone
import bcrypt
from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    totp_secret = db.Column(db.String(512), nullable=True)
    totp_enabled = db.Column(db.Boolean, nullable=False, default=True)
    failed_logins = db.Column(db.Integer, nullable=False, default=0)
    locked_until = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    resumes = db.relationship("Resume", back_populates="owner",
                              cascade="all, delete-orphan")

    def set_password(self, password: str) -> None:
        from flask import current_app
        rounds = current_app.config.get("BCRYPT_LOG_ROUNDS", 12)
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(rounds=rounds)
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )

    def is_locked(self) -> bool:
        if self.locked_until is None:
            return False
        locked_until = self.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) < locked_until

    def to_dict(self) -> dict[str, str | bool | int | None]:
        return {
            "user_id": str(self.user_id),
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "totp_enabled": self.totp_enabled,
            "failed_logins": self.failed_logins,
            "locked_until": self.locked_until.isoformat() if self.locked_until else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
