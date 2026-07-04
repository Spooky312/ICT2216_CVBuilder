"""Cover error-path branches in admin/resume/auth routes.

Reuses the auth helpers from ``test_admin`` (admin login via TOTP + CSRF).
"""
import uuid

import pyotp

from tests.test_admin import SAMPLE_CONTENT, _cookie_values, _create_user, _login

ADMIN_USERS_URL = "/api/admin/users"
ADMIN_TEMPLATES_URL = "/api/admin/templates"
ADMIN_CLEANUP_URL = "/api/admin/audit-log/cleanup"
RESUMES_URL = "/api/resumes"
LOGIN_URL = "/api/auth/login"
VERIFY_2FA_URL = "/api/auth/verify-2fa"

RANDOM_ID = str(uuid.uuid4())


# --------------------------------------------------------------------------- #
# Admin user-management guardrails                                            #
# --------------------------------------------------------------------------- #
def test_admin_cannot_lock_own_account(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.post(f"{ADMIN_USERS_URL}/{admin.user_id}/lock", headers=headers,
                       json={"minutes": 60})
    assert resp.status_code == 400


def test_admin_cannot_lock_deactivated_account(client, db):
    admin = _create_user("admin@example.com", role="admin")
    target = _create_user("target@example.com")
    target.is_active = False
    db.session.commit()
    headers = _login(client, admin)
    resp = client.post(f"{ADMIN_USERS_URL}/{target.user_id}/lock", headers=headers,
                       json={"minutes": 60})
    assert resp.status_code == 400


def test_admin_cannot_unlock_deactivated_account(client, db):
    admin = _create_user("admin@example.com", role="admin")
    target = _create_user("target@example.com")
    target.is_active = False
    db.session.commit()
    headers = _login(client, admin)
    resp = client.post(f"{ADMIN_USERS_URL}/{target.user_id}/unlock", headers=headers)
    assert resp.status_code == 400


def test_admin_cannot_deactivate_own_account(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.post(f"{ADMIN_USERS_URL}/{admin.user_id}/deactivate", headers=headers)
    assert resp.status_code == 400


def test_admin_cannot_delete_own_account(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.delete(f"{ADMIN_USERS_URL}/{admin.user_id}", headers=headers)
    assert resp.status_code == 400


def test_admin_lookup_missing_user_returns_404(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.post(f"{ADMIN_USERS_URL}/{RANDOM_ID}/deactivate", headers=headers)
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Audit-log retention policy                                                  #
# --------------------------------------------------------------------------- #
def test_audit_cleanup_enforces_90_day_retention(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.delete(f"{ADMIN_CLEANUP_URL}?days=30", headers=headers)
    assert resp.status_code == 403


def test_audit_cleanup_rejects_non_integer_days(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.delete(f"{ADMIN_CLEANUP_URL}?days=abc", headers=headers)
    assert resp.status_code == 400


def test_audit_cleanup_allows_compliant_threshold(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.delete(f"{ADMIN_CLEANUP_URL}?days=120", headers=headers)
    assert resp.status_code == 200
    assert "deleted_count" in resp.get_json()


# --------------------------------------------------------------------------- #
# Template admin guardrails                                                   #
# --------------------------------------------------------------------------- #
def test_update_missing_template_returns_404(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.put(f"{ADMIN_TEMPLATES_URL}/does-not-exist", headers=headers,
                      json={"name": "New"})
    assert resp.status_code == 404


def test_update_template_rejects_invalid_metadata(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.put(f"{ADMIN_TEMPLATES_URL}/modern", headers=headers,
                      json={"name": "", "description": "x" * 300})
    assert resp.status_code == 422
    errors = resp.get_json()["errors"]
    assert "name" in errors and "description" in errors


def test_delete_core_template_is_blocked(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)
    resp = client.delete(f"{ADMIN_TEMPLATES_URL}/modern", headers=headers)
    assert resp.status_code == 403


# --------------------------------------------------------------------------- #
# Resume not-found branches                                                   #
# --------------------------------------------------------------------------- #
def test_get_missing_resume_returns_404(client, db, test_user):
    headers = _login(client, test_user)
    resp = client.get(f"{RESUMES_URL}/{RANDOM_ID}", headers=headers)
    assert resp.status_code == 404


def test_update_missing_resume_returns_404(client, db, test_user):
    headers = _login(client, test_user)
    resp = client.put(f"{RESUMES_URL}/{RANDOM_ID}", headers=headers,
                      json={"title": "x", "template_id": "modern", "content_json": {}})
    assert resp.status_code == 404


def test_delete_missing_resume_returns_404(client, db, test_user):
    headers = _login(client, test_user)
    resp = client.delete(f"{RESUMES_URL}/{RANDOM_ID}", headers=headers)
    assert resp.status_code == 404


def test_duplicate_missing_resume_returns_404(client, db, test_user):
    headers = _login(client, test_user)
    resp = client.post(f"{RESUMES_URL}/{RANDOM_ID}/duplicate", headers=headers)
    assert resp.status_code == 404


def test_export_missing_resume_returns_404(client, db, test_user):
    headers = _login(client, test_user)
    resp = client.get(f"{RESUMES_URL}/{RANDOM_ID}/export", headers=headers)
    assert resp.status_code == 404


def test_create_resume_guards_against_vanished_user(client, db, test_user, monkeypatch):
    # Defence in depth: the identity passed the decorator but the row is gone
    # by the time the handler re-reads it (e.g. concurrent deletion).
    headers = _login(client, test_user)
    monkeypatch.setattr("app.routes.resumes._locked_current_user", lambda: None)
    resp = client.post(RESUMES_URL, headers=headers, json={
        "title": "X", "template_id": "modern", "content_json": SAMPLE_CONTENT,
    })
    assert resp.status_code == 404


def test_duplicate_resume_guards_against_vanished_user(client, db, test_user, monkeypatch):
    headers = _login(client, test_user)
    monkeypatch.setattr("app.routes.resumes._locked_current_user", lambda: None)
    resp = client.post(f"{RESUMES_URL}/{RANDOM_ID}/duplicate", headers=headers)
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Auth verify-2fa / refresh branches                                          #
# --------------------------------------------------------------------------- #
def test_verify_2fa_blocks_deactivated_user(client, db):
    user = _create_user("deact@example.com")
    login = client.post(LOGIN_URL, json={"email": user.email, "password": "SecurePass1!"})
    assert login.status_code == 202
    challenge = login.get_json()["challenge_token"]
    # Deactivate after obtaining the challenge but before verification.
    user.is_active = False
    db.session.commit()
    resp = client.post(VERIFY_2FA_URL, json={
        "challenge_token": challenge,
        "totp_code": pyotp.TOTP(user.plain_totp_secret).now(),
    })
    assert resp.status_code == 403


def test_verify_2fa_missing_user_returns_404(client, db):
    user = _create_user("gone@example.com")
    login = client.post(LOGIN_URL, json={"email": user.email, "password": "SecurePass1!"})
    assert login.status_code == 202
    challenge = login.get_json()["challenge_token"]
    code = pyotp.TOTP(user.plain_totp_secret).now()
    # Delete the account after issuing the challenge but before verification.
    db.session.delete(user)
    db.session.commit()
    resp = client.post(VERIFY_2FA_URL, json={
        "challenge_token": challenge,
        "totp_code": code,
    })
    assert resp.status_code == 404


def test_refresh_blocks_deactivated_user(client, db):
    user = _create_user("refresh@example.com")
    login = client.post(LOGIN_URL, json={"email": user.email, "password": "SecurePass1!"})
    verify = client.post(VERIFY_2FA_URL, json={
        "challenge_token": login.get_json()["challenge_token"],
        "totp_code": pyotp.TOTP(user.plain_totp_secret).now(),
    })
    assert verify.status_code == 200
    cookies = _cookie_values(verify)
    # Deactivate the account, then attempt to refresh the session.
    user.is_active = False
    db.session.commit()
    resp = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-TOKEN": cookies.get("csrf_refresh_token", "")},
    )
    assert resp.status_code == 403
