from __future__ import annotations

import re
from marshmallow import Schema, fields, validate, validates, ValidationError

PASSWORD_COMMON = {
    "password", "password1", "123456", "12345678", "qwerty", "abc123",
    "letmein", "monkey", "1234567890", "iloveyou", "admin", "welcome",
    "login", "hello", "master", "dragon", "passw0rd", "shadow",
}

# Shared validators for the full_name field - used by RegisterSchema and
# UpdateProfileSchema so the rules cannot silently diverge between the two.
_FULL_NAME_VALIDATORS = [
    validate.Length(min=2, max=100),
    validate.Regexp(r'^[\w\s\'\-\.]+$', error="Full name contains invalid characters."),
]


def _password_confirm_field(*, required: bool = True) -> fields.Str:
    """Return a load-only password confirmation field (login / account-delete)."""
    return fields.Str(required=required, load_only=True, validate=validate.Length(min=1, max=256))


def validate_password(value: str) -> None:
    if len(value) < 12:
        raise ValidationError("Password must be at least 12 characters.")
    if not re.search(r'[A-Z]', value):
        raise ValidationError("Password must contain at least one uppercase letter.")
    if not re.search(r'[a-z]', value):
        raise ValidationError("Password must contain at least one lowercase letter.")
    if not re.search(r'\d', value):
        raise ValidationError("Password must contain at least one digit.")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'`~]', value):
        raise ValidationError("Password must contain at least one special character.")
    if value.lower() in PASSWORD_COMMON:
        raise ValidationError("Password is too common. Please choose a stronger password.")


class RegisterSchema(Schema):
    email = fields.Email(required=True, validate=validate.Length(max=255))
    password = fields.Str(required=True, load_only=True)
    full_name = fields.Str(required=True, validate=_FULL_NAME_VALIDATORS)

    @validates("password")
    def validate_pw(self, value: str) -> None:
        validate_password(value)


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = _password_confirm_field()


class VerifyTwoFactorSchema(Schema):
    challenge_token = fields.Str(required=True, validate=validate.Length(min=20, max=1000))
    totp_code = fields.Str(required=True, validate=validate.Regexp(
        r'^\s*\d[\d\s]{4,10}\d\s*$',
        error="Enter the 6-digit authenticator code.",
    ))


class UpdateProfileSchema(Schema):
    full_name = fields.Str(validate=_FULL_NAME_VALIDATORS)
    current_password = _password_confirm_field(required=False)
    new_password = fields.Str(load_only=True)

    @validates("new_password")
    def validate_new_pw(self, value: str) -> None:
        if value:
            validate_password(value)


class DeleteAccountSchema(Schema):
    password = _password_confirm_field()
