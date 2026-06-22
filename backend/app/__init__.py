from __future__ import annotations

import os
from typing import Any

from flask import Flask, jsonify, Response
from .config import config_by_name
from .extensions import db, jwt, limiter, migrate


def create_app(env: str | None = None) -> Flask:
    env = env or os.environ.get("FLASK_ENV", "development")
    app = Flask(__name__, template_folder="templates")
    app.config.from_object(config_by_name[env])

    _init_extensions(app)
    _register_blueprints(app)
    _register_error_handlers(app)
    _set_security_headers(app)

    return app


def _init_extensions(app: Flask) -> None:
    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    migrate.init_app(app, db)

    from .models import User, Resume, AuditLog, RevokedToken, ResumeTemplate  # noqa: ensure models are registered

    @jwt.token_in_blocklist_loader
    def token_in_blocklist(
        _jwt_header: dict[str, Any], jwt_payload: dict[str, Any]
    ) -> bool:
        return RevokedToken.is_revoked(jwt_payload.get("jti"))

    @jwt.revoked_token_loader
    def revoked_token(
        _jwt_header: dict[str, Any], _jwt_payload: dict[str, Any]
    ) -> tuple[Response, int]:
        return jsonify({"message": "Token has been revoked."}), 401

    @jwt.expired_token_loader
    def expired_token(
        _jwt_header: dict[str, Any], _jwt_payload: dict[str, Any]
    ) -> tuple[Response, int]:
        return jsonify({"message": "Token has expired."}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason: str) -> tuple[Response, int]:
        return jsonify({"message": "Invalid token.", "reason": reason}), 401

    @jwt.unauthorized_loader
    def missing_token(reason: str) -> tuple[Response, int]:
        return jsonify({"message": "Authentication required.", "reason": reason}), 401


def _register_blueprints(app: Flask) -> None:
    from .routes import auth_bp, profile_bp, resumes_bp, admin_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(resumes_bp)
    app.register_blueprint(admin_bp)

    @app.route("/health")
    def health() -> tuple[Response, int]:
        return jsonify({"status": "ok"}), 200


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(400)
    def bad_request(e: Exception) -> tuple[Response, int]:
        return jsonify({"message": "Bad request."}), 400

    @app.errorhandler(404)
    def not_found(e: Exception) -> tuple[Response, int]:
        return jsonify({"message": "Not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(e: Exception) -> tuple[Response, int]:
        return jsonify({"message": "Method not allowed."}), 405

    @app.errorhandler(429)
    def rate_limit_exceeded(e: Exception) -> tuple[Response, int]:
        return jsonify({"message": "Too many requests. Please slow down."}), 429

    @app.errorhandler(500)
    def internal_error(e: Exception) -> tuple[Response, int]:
        return jsonify({"message": "Internal server error."}), 500


def _set_security_headers(app: Flask) -> None:
    @app.after_request
    def add_security_headers(response: Response) -> Response:
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            "frame-src 'self' blob:;"
        )
        if app.config.get("JWT_COOKIE_SECURE"):
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response

