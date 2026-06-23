#!/usr/bin/env python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/../..')

from app import create_app
from app.extensions import db
from app.models.user import User
from app.utils.totp import encrypt_totp_secret, generate_totp_secret, provisioning_uri

app = create_app("development")

with app.app_context():
    # Check if admin already exists
    if User.query.filter_by(email="admin@example.com").first():
        print("❌ Admin already exists!")
        sys.exit(1)
    
    # Generate TOTP secret for 2FA
    secret = generate_totp_secret()
    
    # Create admin user
    admin = User(
        email="admin@example.com",
        full_name="Admin User",
        role="admin",  # ← KEY: Set role to "admin"
        totp_secret=encrypt_totp_secret(secret),
        totp_enabled=True,
    )
    admin.set_password("AdminPass123!")  # bcrypt hashed automatically
    
    db.session.add(admin)
    db.session.commit()
    
    uri = provisioning_uri("admin@example.com", secret)
    
    print("✅ Admin created successfully!")
    print(f"Email: admin@example.com")
    print(f"Password: AdminPass123!")
    print(f"TOTP Secret: {secret}")
    print(f"\nAdd to Google Authenticator (scan QR code or paste URI):")
    print(f"{uri}")