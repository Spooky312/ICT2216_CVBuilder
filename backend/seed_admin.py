"""
Seed / preset an administrator account.

Credentials are read from the environment (keep them in the gitignored
backend/.env, never in source):
    ADMIN_EMAIL          (default: admin@test.com)
    ADMIN_PASSWORD       (required -- seeding is skipped if unset)
    ADMIN_NAME           (default: Administrator)
    ADMIN_RESET_PASSWORD (default: false) -- reset pw on an existing admin
    ADMIN_SHOW_TOTP      (default: true)  -- print TOTP secret on first provision

This app enforces TOTP two-factor on every login, so the script provisions a
TOTP secret and prints the otpauth:// enrolment URI. Scan it into an
authenticator app (Google Authenticator, Authy, etc.) to complete login.

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
from app.utils.totp import (
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_totp_secret,
    provisioning_uri,
)


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

    # Ensure a TOTP secret exists (2FA is mandatory on login).
    if user.totp_secret:
        secret = decrypt_totp_secret(user.totp_secret)
        newly_provisioned_totp = False
    else:
        secret = generate_totp_secret()
        user.totp_secret = encrypt_totp_secret(secret)
        newly_provisioned_totp = True

    db.session.commit()

    action = "Created" if created else "Updated"
    print(f"[seed_admin] {action} admin account: {email}")
    print(f"[seed_admin]   role={user.role} is_active={user.is_active}")
    if not (created or reset_password):
        print("[seed_admin]   password left unchanged (set ADMIN_RESET_PASSWORD=true to reset)")

    # The password is never echoed. The TOTP secret is only shown when first
    # provisioned, since it must be enrolled into an authenticator app exactly
    # once. Set ADMIN_SHOW_TOTP=false to suppress it from logs entirely.
    if newly_provisioned_totp and _env_flag("ADMIN_SHOW_TOTP", default=True):
        print(f"[seed_admin]   TOTP secret: {secret}")
        print(f"[seed_admin]   TOTP enrol:  {provisioning_uri(email, secret)}")
        print("[seed_admin]   ^ enrol this now; it will not be shown again.")


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
