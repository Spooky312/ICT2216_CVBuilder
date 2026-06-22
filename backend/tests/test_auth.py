import pyotp

REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
VERIFY_2FA_URL = "/auth/verify-2fa"
LOGOUT_URL = "/auth/logout"

VALID_USER = {
    "email": "alice@example.com",
    "password": "SecurePass1!@#",
    "full_name": "Alice Smith",
}


def _totp_code(user):
    return pyotp.TOTP(user.plain_totp_secret).now()


def test_register_success(client, db):
    resp = client.post(REGISTER_URL, json=VALID_USER)
    assert resp.status_code == 201
    data = resp.get_json()
    assert "Account created" in data["message"]
    assert data["requires_2fa"] is True
    assert data["totp_secret"]
    assert data["totp_uri"].startswith("otpauth://totp/")


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


def test_login_user_requires_and_verifies_totp(client, db, test_user):
    resp = client.post(LOGIN_URL, json={
        "email": test_user.email,
        "password": "SecurePass1!",
    })
    assert resp.status_code == 202
    data = resp.get_json()
    assert data["requires_2fa"] is True
    assert data["challenge_token"]

    verify_resp = client.post(VERIFY_2FA_URL, json={
        "challenge_token": data["challenge_token"],
        "totp_code": _totp_code(test_user),
    })
    assert verify_resp.status_code == 200
    assert "user" in verify_resp.get_json()


def test_login_rejects_bad_totp(client, db, test_user):
    resp = client.post(LOGIN_URL, json={
        "email": test_user.email,
        "password": "SecurePass1!",
    })
    assert resp.status_code == 202
    verify_resp = client.post(VERIFY_2FA_URL, json={
        "challenge_token": resp.get_json()["challenge_token"],
        "totp_code": "000000",
    })
    assert verify_resp.status_code == 401


def test_login_wrong_password(client, db, test_user):
    resp = client.post(LOGIN_URL, json={
        "email": test_user.email,
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


def test_account_lockout(client, db, test_user):
    for _ in range(5):
        client.post(LOGIN_URL, json={
            "email": test_user.email,
            "password": "WrongPass1!",
        })
    resp = client.post(LOGIN_URL, json={
        "email": test_user.email,
        "password": "SecurePass1!",
    })
    assert resp.status_code in (401, 429)
