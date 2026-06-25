import re

from app.utils import captcha


def _solve(question: str) -> str:
    a, b = re.findall(r"\d+", question)
    return str(int(a) + int(b))


def test_generate_and_verify_roundtrip(app):
    with app.app_context():
        token, question = captcha.generate_captcha()
        assert question.startswith("What is ")
        assert captcha.verify_captcha(token, _solve(question)) is True


def test_verify_rejects_wrong_answer(app):
    with app.app_context():
        token, question = captcha.generate_captcha()
        wrong = str(int(_solve(question)) + 1)
        assert captcha.verify_captcha(token, wrong) is False


def test_verify_rejects_missing_inputs(app):
    with app.app_context():
        token, _ = captcha.generate_captcha()
        assert captcha.verify_captcha(None, "5") is False
        assert captcha.verify_captcha(token, None) is False
        assert captcha.verify_captcha("", "") is False


def test_verify_rejects_tampered_token(app):
    with app.app_context():
        token, question = captcha.generate_captcha()
        tampered = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
        assert captcha.verify_captcha(tampered, _solve(question)) is False


def test_verify_rejects_expired_token(app):
    with app.app_context():
        original = app.config.get("CAPTCHA_CHALLENGE_EXPIRES")
        app.config["CAPTCHA_CHALLENGE_EXPIRES"] = -1  # already expired
        try:
            token, question = captcha.generate_captcha()
            assert captcha.verify_captcha(token, _solve(question)) is False
        finally:
            app.config["CAPTCHA_CHALLENGE_EXPIRES"] = original
