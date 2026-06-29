import os
import subprocess
import sys
from pathlib import Path


def _run_create_app_with_env(env_updates):
    env = os.environ.copy()
    env.update(env_updates)
    if env_updates.get("DATABASE_URL") is None:
        env.pop("DATABASE_URL", None)

    return subprocess.run(
        [
            sys.executable,
            "-c",
            "from app import create_app; app = create_app('development'); "
            "print(app.config['SQLALCHEMY_DATABASE_URI'])",
        ],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_non_testing_app_requires_database_url():
    result = _run_create_app_with_env({"DATABASE_URL": None})

    assert result.returncode != 0
    assert "DATABASE_URL must be set" in result.stderr


def test_non_testing_app_uses_database_url_from_environment():
    result = _run_create_app_with_env({"DATABASE_URL": "sqlite:///:memory:"})

    assert result.returncode == 0
    assert "sqlite:///:memory:" in result.stdout


def test_config_does_not_embed_postgres_password():
    config_source = Path(__file__).resolve().parents[1] / "app" / "config.py"

    assert "postgresql://cvbuilder:cvbuilder@" not in config_source.read_text(encoding="utf-8")
