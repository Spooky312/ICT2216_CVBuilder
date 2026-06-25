from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from io import BytesIO

import pyotp
import pytest

from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.resume import Resume
from app.models.user import User
from app.utils.totp import encrypt_totp_secret, generate_totp_secret

LOGIN_URL = "/api/auth/login"
VERIFY_2FA_URL = "/api/auth/verify-2fa"
PROFILE_URL = "/api/profile"
ADMIN_USERS_URL = "/api/admin/users"
ADMIN_AUDIT_URL = "/api/admin/audit-log"
ADMIN_TEMPLATES_URL = "/api/admin/templates"
RESUMES_URL = "/api/resumes"

SAMPLE_CONTENT = {
    "personal_info": {"full_name": "Target User", "email": "target@example.com"},
}


def _create_user(email, role="user"):
    secret = generate_totp_secret()
    user = User(
        email=email,
        full_name=email.split("@")[0].replace(".", " ").title(),
        role=role,
        totp_secret=encrypt_totp_secret(secret),
        totp_enabled=True,
    )
    user.set_password("SecurePass1!")
    db.session.add(user)
    db.session.commit()
    user.plain_totp_secret = secret
    return user


def _cookie_values(resp):
    cookies = SimpleCookie()
    for header in resp.headers.getlist("Set-Cookie"):
        cookies.load(header)
    return {key: morsel.value for key, morsel in cookies.items()}


def _login(client, user):
    resp = client.post(LOGIN_URL, json={
        "email": user.email,
        "password": "SecurePass1!",
    })
    assert resp.status_code == 202
    verify_resp = client.post(VERIFY_2FA_URL, json={
        "challenge_token": resp.get_json()["challenge_token"],
        "totp_code": pyotp.TOTP(user.plain_totp_secret).now(),
    })
    assert verify_resp.status_code == 200
    cookies = _cookie_values(verify_resp)
    return {"X-CSRF-TOKEN": cookies.get("csrf_access_token", "")}


def test_non_admin_cannot_list_users(client, db, test_user):
    _login(client, test_user)
    resp = client.get(ADMIN_USERS_URL)
    assert resp.status_code == 403


def test_admin_can_deactivate_user_and_block_login(client, db):
    admin = _create_user("admin@example.com", role="admin")
    target = _create_user("target@example.com")
    headers = _login(client, admin)

    resp = client.post(f"{ADMIN_USERS_URL}/{target.user_id}/deactivate", headers=headers)
    assert resp.status_code == 200
    db.session.refresh(target)
    assert target.is_active is False
    assert resp.get_json()["user"]["is_active"] is False

    login_resp = client.post(LOGIN_URL, json={
        "email": target.email,
        "password": "SecurePass1!",
    })
    assert login_resp.status_code == 403
    assert login_resp.get_json()["message"] == "Account is deactivated."


def test_deactivated_user_existing_token_is_blocked(client, db):
    admin = _create_user("admin@example.com", role="admin")
    target = _create_user("target@example.com")

    target_client = client.application.test_client()
    _login(target_client, target)
    assert target_client.get(PROFILE_URL).status_code == 200

    admin_client = client.application.test_client()
    headers = _login(admin_client, admin)
    resp = admin_client.post(f"{ADMIN_USERS_URL}/{target.user_id}/deactivate", headers=headers)
    assert resp.status_code == 200

    blocked = target_client.get(PROFILE_URL)
    assert blocked.status_code == 403
    assert blocked.get_json()["message"] == "Account is deactivated."


def test_admin_cannot_deactivate_or_delete_self(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)

    deactivate_resp = client.post(f"{ADMIN_USERS_URL}/{admin.user_id}/deactivate", headers=headers)
    assert deactivate_resp.status_code == 400

    delete_resp = client.delete(f"{ADMIN_USERS_URL}/{admin.user_id}", headers=headers)
    assert delete_resp.status_code == 400


def test_admin_can_permanently_delete_user_and_resumes(client, db):
    admin = _create_user("admin@example.com", role="admin")
    target = _create_user("target@example.com")
    resume = Resume(
        user_id=target.user_id,
        title="Delete Me",
        template_id="modern",
        content_json=SAMPLE_CONTENT,
    )
    db.session.add(resume)
    db.session.commit()
    target_id = target.user_id
    resume_id = resume.resume_id
    headers = _login(client, admin)

    resp = client.delete(f"{ADMIN_USERS_URL}/{target_id}", headers=headers)
    assert resp.status_code == 200
    assert db.session.get(User, target_id) is None
    assert db.session.get(Resume, resume_id) is None


def test_admin_can_filter_audit_log_by_event_user_and_date_range(client, db):
    admin = _create_user("admin@example.com", role="admin")
    target = _create_user("target@example.com")
    now = datetime.now(timezone.utc)
    older = now - timedelta(days=3)
    matching_log = AuditLog(
        user_id=target.user_id,
        event_type="profile_updated",
        ip_address="127.0.0.1",
        extra={"field": "full_name"},
        occurred_at=now,
    )
    other_log = AuditLog(
        user_id=admin.user_id,
        event_type="profile_updated",
        ip_address="127.0.0.2",
        occurred_at=now,
    )
    old_log = AuditLog(
        user_id=target.user_id,
        event_type="profile_updated",
        ip_address="127.0.0.3",
        occurred_at=older,
    )
    db.session.add_all([matching_log, other_log, old_log])
    db.session.commit()
    headers = _login(client, admin)

    resp = client.get(
        ADMIN_AUDIT_URL,
        headers=headers,
        query_string={
            "event_type": "profile_updated",
            "user_id": str(target.user_id),
            "date_from": now.date().isoformat(),
            "date_to": now.date().isoformat(),
        },
    )

    assert resp.status_code == 200
    data = resp.get_json()
    assert data["total"] == 1
    assert data["logs"][0]["log_id"] == matching_log.log_id
    assert data["logs"][0]["metadata"] == {"field": "full_name"}


def test_admin_audit_log_filter_validation(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)

    resp = client.get(
        ADMIN_AUDIT_URL,
        headers=headers,
        query_string={
            "user_id": "not-a-uuid",
            "date_from": "not-a-date",
            "date_to": "2025-01-01",
        },
    )

    assert resp.status_code == 422
    errors = resp.get_json()["errors"]
    assert "user_id" in errors
    assert "date_from" in errors

def test_admin_can_create_and_persist_template(client, db):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)

    resp = client.post(ADMIN_TEMPLATES_URL, headers=headers, json={
        "template_id": "professional",
        "name": "Professional",
        "description": "Formal layout for corporate resumes",
        "source_template_id": "classic",
        "active": True,
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["id"] == "professional"
    assert data["source_template_id"] == "classic"

    list_resp = client.get(ADMIN_TEMPLATES_URL, headers=headers)
    assert list_resp.status_code == 200
    assert any(t["id"] == "professional" for t in list_resp.get_json())



def test_admin_can_upload_template_and_user_can_select_it(client, db):
    admin = _create_user("admin@example.com", role="admin")
    user = _create_user("user@example.com")
    headers = _login(client, admin)
    html = b"""
<!DOCTYPE html>
<html><body><h1>{{ resume.personal_info.full_name }}</h1></body></html>
"""

    resp = client.post(f"{ADMIN_TEMPLATES_URL}/upload", headers=headers, data={
        "template_id": "uploaded-html",
        "name": "Uploaded HTML",
        "description": "Admin uploaded HTML template",
        "active": "true",
        "template_file": (BytesIO(html), "uploaded.html"),
    }, content_type="multipart/form-data")

    assert resp.status_code == 201
    data = resp.get_json()
    assert data["id"] == "uploaded-html"
    assert data["is_uploaded"] is True
    assert data["original_filename"] == "uploaded.html"

    user_client = client.application.test_client()
    user_headers = _login(user_client, user)
    templates_resp = user_client.get(f"{RESUMES_URL}/templates", headers=user_headers)
    assert templates_resp.status_code == 200
    assert any(t["id"] == "uploaded-html" and t["is_uploaded"] for t in templates_resp.get_json())

    create_resp = user_client.post(RESUMES_URL, headers=user_headers, json={
        "title": "Uploaded Template Resume",
        "template_id": "uploaded-html",
        "content_json": SAMPLE_CONTENT,
    })
    assert create_resp.status_code == 201


@pytest.mark.parametrize("html", [
    b"<html><script>alert(1)</script>{{ resume.personal_info.full_name }}</html>",
    b"<html><body><img src='file:///etc/passwd'>{{ resume.personal_info.full_name }}</body></html>",
    b"<html><body><p onclick='alert(1)'>{{ resume.personal_info.full_name }}</p></body></html>",
    b"<html><style>.x{background:url(https://evil.test/a.png)}</style><body>{{ resume.personal_info.full_name }}</body></html>",
    b"<html><body><iframe>{{ resume.personal_info.full_name }}</iframe></body></html>",
])
def test_admin_template_upload_rejects_unsafe_html(client, db, html):
    admin = _create_user("admin@example.com", role="admin")
    headers = _login(client, admin)

    resp = client.post(f"{ADMIN_TEMPLATES_URL}/upload", headers=headers, data={
        "template_id": "unsafe-html",
        "name": "Unsafe HTML",
        "template_file": (BytesIO(html), "unsafe.html"),
    }, content_type="multipart/form-data")

    assert resp.status_code == 422
    assert "template_file" in resp.get_json()["errors"]
def test_deactivated_template_is_not_selectable_for_new_resumes(client, db):
    admin = _create_user("admin@example.com", role="admin")
    user = _create_user("user@example.com")
    admin_headers = _login(client, admin)

    update_resp = client.put(f"{ADMIN_TEMPLATES_URL}/modern", headers=admin_headers, json={
        "active": False,
    })
    assert update_resp.status_code == 200
    assert update_resp.get_json()["active"] is False

    user_client = client.application.test_client()
    user_headers = _login(user_client, user)
    templates_resp = user_client.get(f"{RESUMES_URL}/templates", headers=user_headers)
    assert templates_resp.status_code == 200
    assert all(t["id"] != "modern" for t in templates_resp.get_json())

    create_resp = user_client.post(RESUMES_URL, headers=user_headers, json={
        "title": "Blocked Template",
        "template_id": "modern",
        "content_json": SAMPLE_CONTENT,
    })
    assert create_resp.status_code == 422
    assert "template_id" in create_resp.get_json()["errors"]

@pytest.mark.parametrize("method, endpoint", [
    ("GET", ADMIN_USERS_URL),
    ("POST", f"{ADMIN_USERS_URL}/123e4567-e89b-12d3-a456-426614174000/lock"),
    ("POST", f"{ADMIN_USERS_URL}/123e4567-e89b-12d3-a456-426614174000/unlock"),
    ("POST", f"{ADMIN_USERS_URL}/123e4567-e89b-12d3-a456-426614174000/deactivate"),
    ("DELETE", f"{ADMIN_USERS_URL}/123e4567-e89b-12d3-a456-426614174000"),
    ("GET", ADMIN_AUDIT_URL),
    ("POST", ADMIN_TEMPLATES_URL),
    ("POST", f"{ADMIN_TEMPLATES_URL}/upload"),
    ("PUT", f"{ADMIN_TEMPLATES_URL}/modern"),
])
def test_non_admin_cannot_access_any_admin_routes(client, db, test_user, method, endpoint):
    # This covers both standard users trying to access admin routes
    # AND verifying that template management requires admin permissions
    headers = _login(client, test_user)
    
    if method == "GET":
        resp = client.get(endpoint, headers=headers)
    elif method == "POST":
        resp = client.post(endpoint, headers=headers, json={})
    elif method == "PUT":
        resp = client.put(endpoint, headers=headers, json={})
    else:
        resp = client.delete(endpoint, headers=headers)
        
    assert resp.status_code == 403
    assert "Admin access required" in resp.get_json()["message"]


def test_admin_actions_create_audit_logs(client, db):
    admin = _create_user("admin2@example.com", role="admin")
    target = _create_user("target2@example.com")
    headers = _login(client, admin)

    # 1. Test Lock User Logging
    client.post(f"{ADMIN_USERS_URL}/{target.user_id}/lock", headers=headers, json={"minutes": 30})
    lock_log = AuditLog.query.filter_by(event_type="admin_user_locked", user_id=admin.user_id).first()
    assert lock_log is not None
    assert lock_log.extra["target_user"] == str(target.user_id)
    assert lock_log.extra["minutes"] == 30

    # 2. Test Unlock User Logging
    client.post(f"{ADMIN_USERS_URL}/{target.user_id}/unlock", headers=headers)
    unlock_log = AuditLog.query.filter_by(event_type="admin_user_unlocked", user_id=admin.user_id).first()
    assert unlock_log is not None
    assert unlock_log.extra["target_user"] == str(target.user_id)

    # 3. Test Deactivate User Logging
    client.post(f"{ADMIN_USERS_URL}/{target.user_id}/deactivate", headers=headers)
    deactivate_log = AuditLog.query.filter_by(event_type="admin_user_deactivated", user_id=admin.user_id).first()
    assert deactivate_log is not None
    assert deactivate_log.extra["target_user"] == str(target.user_id)
