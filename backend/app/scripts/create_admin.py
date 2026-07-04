#!/usr/bin/env python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/../..")

from app import create_app  # noqa: E402
from seed_admin import seed_admin  # noqa: E402

app = create_app("development")

with app.app_context():
    if not os.environ.get("ADMIN_PASSWORD"):
        print("Set ADMIN_PASSWORD before running this script; no default password is used.")
        sys.exit(1)

    os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
    os.environ.setdefault("ADMIN_NAME", "Admin User")
    seed_admin()
