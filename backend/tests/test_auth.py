import pytest


REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
LOGOUT_URL = "/auth/logout"

VALID_USER = {
    "email": "alice@example.com",
    "password": "SecurePass1!@#",
    "full_name": "Alice Smith",
}


def test_register_success(client, db):
    resp = client.post(REGISTER_URL, json=VALID_USER)
    assert resp.status_code == 201
    assert "Account created" in resp.get_json()["message"]


def test_register_duplicate_email(client, db):
    client.post(REGISTER_URL, json=VALID_USER)
    resp = client.post(REGISTER_URL, json=VALID_USER)
    assert resp.status_code == 409


def test_register_weak_password(client, db):
    resp = client.post(REGISTER_URL, json={**VALID_USER, "password": "short"})
    assert resp.status_code == 422


def test_register_missing_fields(client, db):
    resp = client.post(REGISTER_URL, json={"email": "x@x.com"})
    assert resp.status_code == 422


def test_login_unverified(client, db):
    client.post(REGISTER_URL, json=VALID_USER)
    resp = client.post(LOGIN_URL, json={
        "email": VALID_USER["email"],
        "password": VALID_USER["password"],
    })
    assert resp.status_code == 403


def test_login_verified_user(client, db, verified_user):
    resp = client.post(LOGIN_URL, json={
        "email": verified_user.email,
        "password": "SecurePass1!",
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert "user" in data


def test_login_wrong_password(client, db, verified_user):
    resp = client.post(LOGIN_URL, json={
        "email": verified_user.email,
        "password": "WrongPassword1!",
    })
    assert resp.status_code == 401


def test_login_nonexistent_user(client, db):
    resp = client.post(LOGIN_URL, json={
        "email": "nobody@example.com",
        "password": "AnyPass123!",
    })
    assert resp.status_code == 401


def test_logout_requires_auth(client, db):
    resp = client.post(LOGOUT_URL)
    assert resp.status_code == 401


def test_password_complexity_no_uppercase(client, db):
    resp = client.post(REGISTER_URL, json={**VALID_USER, "password": "alllower1!@#abc"})
    assert resp.status_code == 422


def test_password_complexity_no_digit(client, db):
    resp = client.post(REGISTER_URL, json={**VALID_USER, "password": "NoDigitHere!@#Ab"})
    assert resp.status_code == 422


def test_account_lockout(client, db, verified_user):
    for _ in range(5):
        client.post(LOGIN_URL, json={
            "email": verified_user.email,
            "password": "WrongPass1!",
        })
    resp = client.post(LOGIN_URL, json={
        "email": verified_user.email,
        "password": "SecurePass1!",
    })
    assert resp.status_code in (401, 429)
