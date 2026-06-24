from http.cookies import SimpleCookie

import pyotp
import pytest

from app.extensions import limiter
from app.models.audit_log import AuditLog
from app.models.resume import Resume

LOGIN_URL = "/api/auth/login"
VERIFY_2FA_URL = "/api/auth/verify-2fa"
RESUMES_URL = "/api/resumes"

SAMPLE_CONTENT = {
    "personal_info": {
        "full_name": "Alice Smith",
        "email": "alice@example.com",
        "phone": "91234567",
        "location": "Singapore",
        "summary": "Experienced developer.",
    },
    "education": [{"institution": "SIT", "degree": "BSc", "field_of_study": "CS",
                    "start_date": "2020", "end_date": "2024"}],
    "experience": [{"company": "Acme", "position": "Developer",
                     "start_date": "2024-01", "end_date": "Present",
                     "description": "Built things."}],
    "projects": [{"name": "MyApp", "description": "A cool app.",
                   "technologies": ["Python", "React"]}],
    "skills": {"technical": ["Python", "Flask"], "soft": ["Communication"]},
}


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

    cookies = SimpleCookie()
    for header in verify_resp.headers.getlist("Set-Cookie"):
        cookies.load(header)

    if "csrf_access_token" not in cookies:
        return {}
    return {"X-CSRF-TOKEN": cookies["csrf_access_token"].value}


def test_create_resume(client, db, test_user):
    headers = _login(client, test_user)
    resp = client.post(RESUMES_URL, headers=headers, json={
        "title": "My Resume",
        "template_id": "modern",
        "content_json": SAMPLE_CONTENT,
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["title"] == "My Resume"
    assert "resume_id" in data


def test_list_resumes(client, db, test_user):
    headers = _login(client, test_user)
    client.post(RESUMES_URL, headers=headers, json={
        "title": "Resume 1", "template_id": "classic", "content_json": SAMPLE_CONTENT
    })
    resp = client.get(RESUMES_URL, headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) >= 1


def test_get_resume(client, db, test_user):
    headers = _login(client, test_user)
    create_resp = client.post(RESUMES_URL, headers=headers, json={
        "title": "My Resume", "template_id": "modern", "content_json": SAMPLE_CONTENT
    })
    resume_id = create_resp.get_json()["resume_id"]
    resp = client.get(f"{RESUMES_URL}/{resume_id}", headers=headers)
    assert resp.status_code == 200


def test_update_resume(client, db, test_user):
    headers = _login(client, test_user)
    create_resp = client.post(RESUMES_URL, headers=headers, json={
        "title": "Old Title", "template_id": "modern", "content_json": SAMPLE_CONTENT
    })
    resume_id = create_resp.get_json()["resume_id"]
    resp = client.put(f"{RESUMES_URL}/{resume_id}", headers=headers, json={"title": "New Title"})
    assert resp.status_code == 200
    assert resp.get_json()["title"] == "New Title"


def test_delete_resume(client, db, test_user):
    headers = _login(client, test_user)
    create_resp = client.post(RESUMES_URL, headers=headers, json={
        "title": "Delete Me", "template_id": "minimal", "content_json": SAMPLE_CONTENT
    })
    resume_id = create_resp.get_json()["resume_id"]
    resp = client.delete(f"{RESUMES_URL}/{resume_id}", headers=headers)
    assert resp.status_code == 200
    assert client.get(f"{RESUMES_URL}/{resume_id}", headers=headers).status_code == 404


def test_duplicate_resume(client, db, test_user):
    headers = _login(client, test_user)
    create_resp = client.post(RESUMES_URL, headers=headers, json={
        "title": "Original", "template_id": "modern", "content_json": SAMPLE_CONTENT
    })
    resume_id = create_resp.get_json()["resume_id"]
    resp = client.post(f"{RESUMES_URL}/{resume_id}/duplicate", headers=headers)
    assert resp.status_code == 201
    assert "(copy)" in resp.get_json()["title"]


def test_invalid_template(client, db, test_user):
    headers = _login(client, test_user)
    resp = client.post(RESUMES_URL, headers=headers, json={
        "title": "Bad Template", "template_id": "hacker", "content_json": SAMPLE_CONTENT
    })
    assert resp.status_code == 422


def test_unauthenticated_access(client, db):
    resp = client.get(RESUMES_URL)
    assert resp.status_code == 401


def test_export_rate_limit_is_ten_per_minute_per_user(app):
    export_limits = limiter.limit_manager.decorated_limits(
        "app.routes.resumes.export_resume.export_resume"
    )

    assert len(export_limits) == 1
    assert str(export_limits[0].limit) == "10 per 1 minute"
    assert export_limits[0].key_func.__name__ == "<lambda>"


def test_preview_partial_draft_returns_uncached_pdf_without_persisting(
    client, db, test_user, monkeypatch,
):
    headers = _login(client, test_user)
    monkeypatch.setattr(
        "app.routes.resumes.generate_pdf_from_content",
        lambda template_id, content_json, timeout_seconds: b"%PDF-1.7 preview",
    )
    resumes_before = Resume.query.count()
    audits_before = AuditLog.query.count()

    resp = client.post(f"{RESUMES_URL}/preview", headers=headers, json={
        "template_id": "modern",
        "content_json": {},
    })

    assert resp.status_code == 200
    assert resp.mimetype == "application/pdf"
    assert resp.data.startswith(b"%PDF")
    assert resp.headers["Cache-Control"] == "no-store"
    assert "inline" in resp.headers["Content-Disposition"]
    assert Resume.query.count() == resumes_before
    assert AuditLog.query.count() == audits_before


@pytest.mark.parametrize("payload", [
    {"template_id": "unknown", "content_json": {}},
    {"template_id": "modern", "content_json": {"unexpected": "value"}},
    {"template_id": "modern", "content_json": {
        "personal_info": {"phone": "not-a-phone"},
    }},
    {"template_id": "modern", "content_json": {
        "personal_info": {"full_name": "x" * 101},
    }},
])
def test_preview_rejects_invalid_or_unknown_draft_fields(
    client, db, test_user, payload,
):
    headers = _login(client, test_user)
    resp = client.post(f"{RESUMES_URL}/preview", headers=headers, json=payload)
    assert resp.status_code == 422
    assert resp.get_json()["errors"]


def test_preview_requires_authentication(client, db):
    resp = client.post(f"{RESUMES_URL}/preview", json={
        "template_id": "modern", "content_json": {},
    })
    assert resp.status_code == 401


def test_security_policy_allows_only_blob_pdf_frames(client):
    resp = client.get("/health")
    policy = resp.headers["Content-Security-Policy"]
    assert "frame-src 'self' blob:;" in policy
    assert "default-src 'self';" in policy


@pytest.mark.parametrize("error, status, message", [
    (TimeoutError(), 504, "PDF preview timed out. Please try again."),
    (RuntimeError("render failed"), 500, "PDF preview generation failed."),
])
def test_preview_handles_pdf_generation_failures(
    client, db, test_user, monkeypatch, error, status, message,
):
    headers = _login(client, test_user)

    def fail_preview(*args, **kwargs):
        raise error

    monkeypatch.setattr("app.routes.resumes.generate_pdf_from_content", fail_preview)
    resp = client.post(f"{RESUMES_URL}/preview", headers=headers, json={
        "template_id": "modern", "content_json": {},
    })
    assert resp.status_code == status
    assert resp.get_json()["message"] == message
