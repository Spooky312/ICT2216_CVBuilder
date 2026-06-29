"""
Seed / preset an administrator account.

Credentials are read from the environment (keep them in the gitignored
backend/.env, never in source):
    ADMIN_EMAIL          (default: admin@test.com)
    ADMIN_PASSWORD       (required -- seeding is skipped if unset)
    ADMIN_NAME           (default: Administrator)
    ADMIN_RESET_PASSWORD (default: false) -- reset pw on an existing admin

This app enforces TOTP two-factor on every login. The seed script enables 2FA
for the admin account but leaves enrolment to the normal first-login flow, which
returns the authenticator QR/URI to the browser without writing secrets to logs.

Usage:
    docker compose exec backend python seed_admin.py
    # or it runs automatically on container boot (see boot.py)
"""
from __future__ import annotations

import os
import sys

from app import create_app
from app.extensions import db
from app.models.user import User


def _env_flag(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def seed_admin() -> None:
    email = os.environ.get("ADMIN_EMAIL", "admin@test.com").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD")
    full_name = os.environ.get("ADMIN_NAME", "Administrator")
    reset_password = _env_flag("ADMIN_RESET_PASSWORD", default=False)

    if not password:
        # No secret provided — don't invent one or hardcode it. Skip quietly so
        # container boot stays green; set ADMIN_PASSWORD in backend/.env to seed.
        print("[seed_admin] ADMIN_PASSWORD not set — skipping admin seed.")
        return

    user = User.query.filter_by(email=email).first()
    created = user is None

    if created:
        user = User(email=email, full_name=full_name)
        user.set_password(password)
        db.session.add(user)
    else:
        # Ensure the existing account is a usable admin; refresh pw only if asked.
        if reset_password:
            user.set_password(password)

    user.role = "admin"
    user.is_active = True
    user.totp_enabled = True

    db.session.commit()

    action = "Created" if created else "Updated"
    print(f"[seed_admin] {action} admin account: {email}")
    print(f"[seed_admin]   role={user.role} is_active={user.is_active}")
    if not (created or reset_password):
        print("[seed_admin]   password left unchanged (set ADMIN_RESET_PASSWORD=true to reset)")
    if not user.totp_secret:
        print("[seed_admin]   2FA enrolment will be completed on first login.")


def main() -> None:
    app = create_app()
    with app.app_context():
        try:
            seed_admin()
        except Exception as exc:  # pragma: no cover - operational safety
            db.session.rollback()
            print(f"[seed_admin] ERROR: {exc}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
