from __future__ import annotations

from datetime import datetime, timezone

from app.extensions import db


class ResumeTemplate(db.Model):
    __tablename__ = "resume_templates"

    template_id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(250), nullable=False, default="")
    source_template_id = db.Column(db.String(50), nullable=False)
    html_content = db.Column(db.Text, nullable=True)
    original_filename = db.Column(db.String(255), nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> dict[str, str | bool | None]:
        return {
            "id": self.template_id,
            "template_id": self.template_id,
            "name": self.name,
            "description": self.description,
            "source_template_id": self.source_template_id,
            "is_uploaded": bool(self.html_content),
            "original_filename": self.original_filename,
            "active": self.active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }