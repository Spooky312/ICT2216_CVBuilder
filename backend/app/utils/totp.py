from __future__ import annotations

import base64
import hashlib
import os

import pyotp
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from flask import current_app


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(email: str, secret: str) -> str:
    issuer = current_app.config.get("TOTP_ISSUER", "ICT2216 CVBuilder")
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp_code(secret: str, code: str) -> bool:
    clean = "".join(character for character in code if character.isdigit())
    if len(clean) != 6:
        return False
    return pyotp.TOTP(secret).verify(clean, valid_window=1)


def encrypt_totp_secret(secret: str) -> str:
    nonce = os.urandom(12)
    encrypted = AESGCM(_encryption_key()).encrypt(nonce, secret.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + encrypted).decode("ascii")


def decrypt_totp_secret(value: str) -> str:
    raw = base64.urlsafe_b64decode(value.encode("ascii"))
    nonce, encrypted = raw[:12], raw[12:]
    return AESGCM(_encryption_key()).decrypt(nonce, encrypted, None).decode("utf-8")


def _encryption_key() -> bytes:
    configured = current_app.config.get("TOTP_ENCRYPTION_KEY")
    material = configured or current_app.config["SECRET_KEY"]
    return hashlib.sha256(material.encode("utf-8")).digest()
