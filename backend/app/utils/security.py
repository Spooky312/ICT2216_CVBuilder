from __future__ import annotations

from datetime import datetime, timezone, timedelta
from app.extensions import db
from app.models.user import User


def record_failed_login(user: User) -> None:
    user.failed_logins += 1
    if user.failed_logins >= 5:
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.session.commit()


def reset_failed_logins(user: User) -> None:
    user.failed_logins = 0
    user.locked_until = None
    db.session.commit()
