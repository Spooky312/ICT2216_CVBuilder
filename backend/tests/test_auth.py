from http.cookies import SimpleCookie

import pyotp

from app.models.revoked_token import RevokedToken

from datetime import datetime, timedelta, timezone

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
VERIFY_2FA_URL = "/api/auth/verify-2fa"
LOGOUT_URL = "/api/auth/logout"
PROFILE_URL = "/api/profile"

VALID_USER = {
    "email": "alice@example.com",
    "password": "SecurePass1!@#",
    "full_name": "Alice Smith",
}


def _totp_code(user):
    return pyotp.TOTP(user.plain_totp_secret).now()


def _cookie_values(resp):
    cookies = SimpleCookie()
    for header in resp.headers.getlist("Set-Cookie"):
        cookies.load(header)
    return {key: morsel.value for key, morsel in cookies.items()}


def _login_with_2fa(client, user):
    resp = client.post(LOGIN_URL, json={
        "email": user.email,
        "password": "SecurePass1!",
    })
    assert resp.status_code == 202
    verify_resp = client.post(VERIFY_2FA_URL, json={
        "challenge_token": resp.get_json()["challenge_token"],
        "totp_code": _totp_code(user),
    })
    assert verify_resp.status_code == 200
    return verify_resp, _cookie_values(verify_resp)


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


def test_logout_revokes_access_and_refresh_tokens(client, db, test_user):
    _verify_resp, cookies = _login_with_2fa(client, test_user)
    assert "access_token_cookie" in cookies
    assert "refresh_token_cookie" in cookies

    logout_resp = client.post(LOGOUT_URL, headers={
        "X-CSRF-TOKEN": cookies.get("csrf_access_token", ""),
    })
    assert logout_resp.status_code == 200
    assert RevokedToken.query.count() == 2

    replay_client = client.application.test_client()
    replay_client.set_cookie("access_token_cookie", cookies["access_token_cookie"])
    replay_client.set_cookie("csrf_access_token", cookies.get("csrf_access_token", ""))
    replay_resp = replay_client.get(PROFILE_URL)
    assert replay_resp.status_code == 401
    assert replay_resp.get_json()["message"] == "Token has been revoked."


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


def test_locked_user_cannot_login(client, db, test_user):
    # Manually lock the user in the database
    test_user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.session.commit()

    resp = client.post(LOGIN_URL, json={
        "email": test_user.email,
        "password": "SecurePass1!",
    })
    
    assert resp.status_code == 429
    assert "temporarily locked" in resp.get_json()["message"]


def test_deactivated_user_cannot_login_directly(client, db, test_user):
    # Manually deactivate the user
    test_user.is_active = False
    db.session.commit()

    resp = client.post(LOGIN_URL, json={
        "email": test_user.email,
        "password": "SecurePass1!",
    })
    
    assert resp.status_code == 403
    assert "deactivated" in resp.get_json()["message"]

