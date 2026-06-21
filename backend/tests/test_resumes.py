import pytest

LOGIN_URL = "/auth/login"
RESUMES_URL = "/resumes"

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
    return resp


def test_create_resume(client, db, test_user):
    _login(client, test_user)
    resp = client.post(RESUMES_URL, json={
        "title": "My Resume",
        "template_id": "modern",
        "content_json": SAMPLE_CONTENT,
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["title"] == "My Resume"
    assert "resume_id" in data


def test_list_resumes(client, db, test_user):
    _login(client, test_user)
    client.post(RESUMES_URL, json={
        "title": "Resume 1", "template_id": "classic", "content_json": SAMPLE_CONTENT
    })
    resp = client.get(RESUMES_URL)
    assert resp.status_code == 200
    assert len(resp.get_json()) >= 1


def test_get_resume(client, db, test_user):
    _login(client, test_user)
    create_resp = client.post(RESUMES_URL, json={
        "title": "My Resume", "template_id": "modern", "content_json": SAMPLE_CONTENT
    })
    resume_id = create_resp.get_json()["resume_id"]
    resp = client.get(f"{RESUMES_URL}/{resume_id}")
    assert resp.status_code == 200


def test_update_resume(client, db, test_user):
    _login(client, test_user)
    create_resp = client.post(RESUMES_URL, json={
        "title": "Old Title", "template_id": "modern", "content_json": SAMPLE_CONTENT
    })
    resume_id = create_resp.get_json()["resume_id"]
    resp = client.put(f"{RESUMES_URL}/{resume_id}", json={"title": "New Title"})
    assert resp.status_code == 200
    assert resp.get_json()["title"] == "New Title"


def test_delete_resume(client, db, test_user):
    _login(client, test_user)
    create_resp = client.post(RESUMES_URL, json={
        "title": "Delete Me", "template_id": "minimal", "content_json": SAMPLE_CONTENT
    })
    resume_id = create_resp.get_json()["resume_id"]
    resp = client.delete(f"{RESUMES_URL}/{resume_id}")
    assert resp.status_code == 200
    assert client.get(f"{RESUMES_URL}/{resume_id}").status_code == 404


def test_duplicate_resume(client, db, test_user):
    _login(client, test_user)
    create_resp = client.post(RESUMES_URL, json={
        "title": "Original", "template_id": "modern", "content_json": SAMPLE_CONTENT
    })
    resume_id = create_resp.get_json()["resume_id"]
    resp = client.post(f"{RESUMES_URL}/{resume_id}/duplicate")
    assert resp.status_code == 201
    assert "(copy)" in resp.get_json()["title"]


def test_invalid_template(client, db, test_user):
    _login(client, test_user)
    resp = client.post(RESUMES_URL, json={
        "title": "Bad Template", "template_id": "hacker", "content_json": SAMPLE_CONTENT
    })
    assert resp.status_code == 422


def test_unauthenticated_access(client, db):
    resp = client.get(RESUMES_URL)
    assert resp.status_code == 401

