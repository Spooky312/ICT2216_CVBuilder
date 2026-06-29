import pytest
from app import create_app
from app.extensions import db as _db
from app.models.user import User
from app.utils.totp import encrypt_totp_secret, generate_totp_secret


@pytest.fixture(scope="session")
def app():
    application = create_app("testing")
    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    return app.test_client()


@pytest.fixture(scope="function")
def db(app):
    with app.app_context():
        yield _db
        _db.session.rollback()
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()


@pytest.fixture
def test_user(db):
    secret = generate_totp_secret()
    user = User(
        email="test@example.com",
        full_name="Test User",
        totp_secret=encrypt_totp_secret(secret),
        totp_enabled=True,
    )
    user.set_password("SecurePass1!")
    db.session.add(user)
    db.session.commit()
    user.plain_totp_secret = secret
    return user
