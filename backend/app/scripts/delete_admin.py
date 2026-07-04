#!/usr/bin/env python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/../..")

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models.user import User  # noqa: E402

app = create_app("development")

with app.app_context():
    admin = User.query.filter_by(email="admin@example.com").first()

    if not admin:
        print("❌ Admin user not found!")
        sys.exit(1)

    db.session.delete(admin)
    db.session.commit()

    print("✅ Admin deleted successfully!")
