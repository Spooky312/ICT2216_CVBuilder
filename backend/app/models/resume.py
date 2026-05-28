from __future__ import annotations

import uuid
from datetime import datetime, timezone
from app.extensions import db


class Resume(db.Model):
    __tablename__ = "resumes"

    resume_id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True),
                        db.ForeignKey("users.user_id", ondelete="CASCADE"),
                        nullable=False, index=True)
    title = db.Column(db.String(100), nullable=False)
    template_id = db.Column(db.String(50), nullable=False, default="modern")
    content_json = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    owner = db.relationship("User", back_populates="resumes")

    def to_dict(self, include_content: bool = True) -> dict[str, str | dict[str, object]]:
        data = {
            "resume_id": str(self.resume_id),
            "user_id": str(self.user_id),
            "title": self.title,
            "template_id": self.template_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_content:
            data["content_json"] = self.content_json
        return data
