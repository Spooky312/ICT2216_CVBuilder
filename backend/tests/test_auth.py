import re
from http.cookies import SimpleCookie

import pyotp

from app.models.revoked_token import RevokedToken
from app.models.user import User

from datetime import datetime, timedelta, timezone

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
VERIFY_2FA_URL = "/api/auth/verify-2fa"
LOGOUT_URL = "/api/auth/logout"
PROFILE_URL = "/api/profile"
CAPTCHA_URL = "/api/auth/captcha"


def _solve_captcha(client):
    """Fetch a server-issued CAPTCHA and return (token, answer)."""
    body = client.get(CAPTCHA_URL).get_json()
    a, b = re.findall(r"\d+", body["question"])
    return body["captcha_token"], str(int(a) + int(b))

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
    # 2FA enrolment is deferred to first login; registration must not leak a secret.
    assert "totp_secret" not in data
    assert "totp_uri" not in data


def test_register_duplicate_email_is_indistinguishable(client, db):
    """A duplicate registration must be byte-identical to a fresh one so the
    endpoint can't be used to enumerate which emails are registered."""
    first = client.post(REGISTER_URL, json=VALID_USER)
    second = client.post(REGISTER_URL, json=VALID_USER)
    assert first.status_code == second.status_code == 201
    assert first.get_json() == second.get_json()
    # ...and the duplicate must not create a second account.
    assert User.query.filter_by(email=VALID_USER["email"]).count() == 1


def test_register_then_first_login_enrolls_2fa(client, db):
    """End-to-end: deferred enrolment provisions the TOTP secret at first login."""
    assert client.post(REGISTER_URL, json=VALID_USER).status_code == 201

    resp = client.post(LOGIN_URL, json={
        "email": VALID_USER["email"],
        "password": VALID_USER["password"],
    })
    assert resp.status_code == 202
    data = resp.get_json()
    assert data["requires_2fa"] is True
    assert data["challenge_token"]
    assert data["totp_secret"]
    assert data["totp_uri"].startswith("otpauth://totp/")

    verify_resp = client.post(VERIFY_2FA_URL, json={
        "challenge_token": data["challenge_token"],
        "totp_code": pyotp.TOTP(data["totp_secret"]).now(),
    })
    assert verify_resp.status_code == 200
    assert "user" in verify_resp.get_json()


def test_login_unknown_user_matches_wrong_password_shape(client, db, test_user):
    """Login must not reveal which emails exist: a probe against an unknown
    email must be byte-identical to a first failed attempt on a real account
    (same status, message, and captcha flag)."""
    unknown = client.post(LOGIN_URL, json={
        "email": "nobody@example.com", "password": "AnyPass123!",
    })
    wrong_pw = client.post(LOGIN_URL, json={
        "email": test_user.email, "password": "WrongPassword1!",
    })
    assert unknown.status_code == wrong_pw.status_code == 401
    assert unknown.get_json() == wrong_pw.get_json()


def test_captcha_endpoint_returns_question_and_token(client, db):
    resp = client.get(CAPTCHA_URL)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["question"].startswith("What is ")
    assert body["captcha_token"]


def test_login_requires_captcha_after_threshold(client, db, test_user):
    """After 3 failures the server demands a CAPTCHA: even the *correct*
    password is rejected until a valid challenge is solved."""
    for _ in range(3):
        client.post(LOGIN_URL, json={
            "email": test_user.email, "password": "WrongPass1!",
        })

    # Correct password, but no CAPTCHA -> blocked, login must not proceed.
    blocked = client.post(LOGIN_URL, json={
        "email": test_user.email, "password": "SecurePass1!",
    })
    assert blocked.status_code == 400
    assert blocked.get_json()["show_captcha"] is True

    # A wrong CAPTCHA answer is rejected the same way.
    token, _ = _solve_captcha(client)
    bad = client.post(LOGIN_URL, json={
        "email": test_user.email, "password": "SecurePass1!",
        "captcha_token": token, "captcha_answer": "-999",
    })
    assert bad.status_code == 400

    # A solved CAPTCHA + correct password proceeds to the 2FA step.
    token, answer = _solve_captcha(client)
    ok = client.post(LOGIN_URL, json={
        "email": test_user.email, "password": "SecurePass1!",
        "captcha_token": token, "captcha_answer": answer,
    })
    assert ok.status_code == 202
    assert ok.get_json()["requires_2fa"] is True


def test_failed_captcha_does_not_count_as_password_failure(client, db, test_user):
    """A missing/invalid CAPTCHA must not increment the lockout counter, or it
    could be abused to lock another user out."""
    for _ in range(3):
        client.post(LOGIN_URL, json={
            "email": test_user.email, "password": "WrongPass1!",
        })
    # Several blocked (no-CAPTCHA) attempts...
    for _ in range(5):
        client.post(LOGIN_URL, json={
            "email": test_user.email, "password": "SecurePass1!",
        })
    db.session.refresh(test_user)
    assert test_user.failed_logins == 3
    assert not test_user.is_locked()


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
    # First 3 wrong attempts don't require a CAPTCHA.
    for _ in range(3):
        client.post(LOGIN_URL, json={
            "email": test_user.email,
            "password": "WrongPass1!",
        })
    # Attempts 4 and 5 must solve a CAPTCHA to be counted toward lockout.
    for _ in range(2):
        token, answer = _solve_captcha(client)
        client.post(LOGIN_URL, json={
            "email": test_user.email,
            "password": "WrongPass1!",
            "captcha_token": token,
            "captcha_answer": answer,
        })
    # Account is now locked; even the correct password is refused.
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

