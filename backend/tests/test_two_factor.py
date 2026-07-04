import uuid

from app.utils.two_factor import create_two_factor_challenge, verify_two_factor_challenge


def test_verify_two_factor_challenge_round_trips_a_valid_token(app):
    with app.app_context():
        user_id = uuid.uuid4()
        token = create_two_factor_challenge(user_id)
        challenge = verify_two_factor_challenge(token)
        assert challenge is not None
        assert challenge.user_id == user_id
        assert challenge.setup_secret is None


def test_verify_two_factor_challenge_rejects_a_tampered_token(app):
    with app.app_context():
        token = create_two_factor_challenge(uuid.uuid4())
        tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
        assert verify_two_factor_challenge(tampered) is None


def test_verify_two_factor_challenge_rejects_garbage_input(app):
    with app.app_context():
        assert verify_two_factor_challenge("not-a-real-token") is None
