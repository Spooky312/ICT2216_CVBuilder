from __future__ import annotations

from datetime import datetime, timezone, timedelta
from app.extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    log_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.UUID(as_uuid=True), nullable=True, index=True)
    event_type = db.Column(db.String(50), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    extra = db.Column(db.JSON, nullable=True)
    occurred_at = db.Column(db.DateTime(timezone=True), nullable=False,
                            default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, int | str | dict[str, object] | None]:
        return {
            "log_id": self.log_id,
            "user_id": str(self.user_id) if self.user_id else None,
            "event_type": self.event_type,
            "ip_address": self.ip_address,
            "occurred_at": self.occurred_at.isoformat(),
            "metadata": self.extra,
        }
    
    @classmethod
    def cleanup_old_logs(cls, days: int = 90) -> int:
        """Deletes audit logs older than the specified number of days."""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        # Using synchronize_session=False makes bulk deletes much faster and safer in SQLAlchemy
        deleted_count = cls.query.filter(cls.occurred_at < cutoff_date).delete(synchronize_session=False)
        db.session.commit()
        return deleted_count
