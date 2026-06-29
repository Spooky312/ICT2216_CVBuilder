from app.models.user import User
from seed_admin import seed_admin

from tests.test_auth import LOGIN_URL


def test_seed_admin_does_not_log_totp_secret_or_uri(db, monkeypatch, capsys):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "AdminPass123!")
    monkeypatch.setenv("ADMIN_NAME", "Admin User")

    seed_admin()

    output = capsys.readouterr().out
    admin = User.query.filter_by(email="admin@example.com").one()

    assert admin.role == "admin"
    assert admin.is_active is True
    assert admin.totp_enabled is True
    assert admin.totp_secret is None
    assert "TOTP secret" not in output
    assert "otpauth://" not in output
    assert "AdminPass123!" not in output
    assert "2FA enrolment will be completed on first login." in output


def test_seeded_admin_can_enroll_totp_on_first_login(client, db, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "AdminPass123!")

    seed_admin()

    response = client.post(LOGIN_URL, json={
        "email": "admin@example.com",
        "password": "AdminPass123!",
    })
    body = response.get_json()
    admin = User.query.filter_by(email="admin@example.com").one()

    assert response.status_code == 202
    assert body["requires_2fa"] is True
    assert body["challenge_token"]
    assert body["totp_secret"]
    assert body["totp_uri"].startswith("otpauth://totp/")
    assert admin.totp_secret is not None
