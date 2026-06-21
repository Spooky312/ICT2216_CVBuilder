from __future__ import annotations

import io
import uuid
from flask import Blueprint, request, jsonify, send_file, current_app, Response
from flask_jwt_extended import jwt_required
from app.extensions import db, limiter
from app.models.user import User
from app.models.resume import Resume
from app.schemas.resume_schema import TEMPLATE_METADATA, CreateResumeSchema, UpdateResumeSchema
from app.services.pdf_service import generate_pdf
from app.utils.audit import log_event
from app.utils.helpers import current_user_id, get_current_user_or_404, load_or_422

resumes_bp = Blueprint("resumes", __name__, url_prefix="/resumes")

create_schema = CreateResumeSchema()
update_schema = UpdateResumeSchema()


def _max_resumes() -> int:
    return current_app.config.get("MAX_RESUMES_PER_USER", 10)


def _get_owned_resume(resume_id: str, user_id: uuid.UUID) -> Resume | None:
    try:
        rid = uuid.UUID(resume_id)
    except ValueError:
        return None
    return Resume.query.filter_by(resume_id=rid, user_id=user_id).first()


def _check_resume_limit(user_id: uuid.UUID) -> tuple[None, None] | tuple[None, tuple[Response, int]]:
    """Return ``(None, None)`` if under limit, or ``(None, 409_response)`` if at/over limit."""
    max_r = _max_resumes()
    count = Resume.query.filter_by(user_id=user_id).count()
    if count >= max_r:
        return None, (jsonify({"message": f"Maximum {max_r} resumes allowed."}), 409)
    return None, None


def _locked_current_user() -> User | None:
    uid = current_user_id()
    if uid is None:
        return None
    return User.query.filter_by(user_id=uid).with_for_update().first()


@resumes_bp.route("", methods=["GET"])
@jwt_required()
def list_resumes() -> tuple[Response, int]:
    user, err = get_current_user_or_404()
    if err:
        return err

    resumes = Resume.query.filter_by(user_id=user.user_id).order_by(
        Resume.updated_at.desc()
    ).all()
    return jsonify([r.to_dict(include_content=False) for r in resumes]), 200


@resumes_bp.route("", methods=["POST"])
@jwt_required()
def create_resume() -> tuple[Response, int]:
    data, err = load_or_422(create_schema, request.get_json(force=True) or {})
    if err:
        return err

    # Lock the user row for the remainder of this transaction so concurrent
    # create/duplicate requests cannot both pass the MAX_RESUMES check.
    user = _locked_current_user()
    if not user:
        return jsonify({"message": "User not found."}), 404

    _, limit_err = _check_resume_limit(user.user_id)
    if limit_err:
        return limit_err

    resume = Resume(
        user_id=user.user_id,
        title=data["title"],
        template_id=data["template_id"],
        content_json=data["content_json"],
    )
    db.session.add(resume)
    db.session.commit()
    log_event("resume_created", user_id=user.user_id,
              metadata={"resume_id": str(resume.resume_id)})
    return jsonify(resume.to_dict()), 201


@resumes_bp.route("/<resume_id>", methods=["GET"])
@jwt_required()
def get_resume(resume_id: str) -> tuple[Response, int]:
    user, err = get_current_user_or_404()
    if err:
        return err

    resume = _get_owned_resume(resume_id, user.user_id)
    if not resume:
        return jsonify({"message": "Resume not found."}), 404

    return jsonify(resume.to_dict()), 200


@resumes_bp.route("/<resume_id>", methods=["PUT"])
@jwt_required()
def update_resume(resume_id: str) -> tuple[Response, int]:
    user, err = get_current_user_or_404()
    if err:
        return err

    resume = _get_owned_resume(resume_id, user.user_id)
    if not resume:
        return jsonify({"message": "Resume not found."}), 404

    data, err = load_or_422(update_schema, request.get_json(force=True) or {})
    if err:
        return err

    if "title" in data:
        resume.title = data["title"]
    if "template_id" in data:
        resume.template_id = data["template_id"]
    if "content_json" in data:
        resume.content_json = data["content_json"]

    db.session.commit()
    log_event("resume_updated", user_id=user.user_id,
              metadata={"resume_id": str(resume.resume_id)})
    return jsonify(resume.to_dict()), 200


@resumes_bp.route("/<resume_id>", methods=["DELETE"])
@jwt_required()
def delete_resume(resume_id: str) -> tuple[Response, int]:
    user, err = get_current_user_or_404()
    if err:
        return err

    resume = _get_owned_resume(resume_id, user.user_id)
    if not resume:
        return jsonify({"message": "Resume not found."}), 404

    rid = str(resume.resume_id)
    db.session.delete(resume)
    db.session.commit()
    log_event("resume_deleted", user_id=user.user_id, metadata={"resume_id": rid})
    return jsonify({"message": "Resume deleted."}), 200


@resumes_bp.route("/<resume_id>/duplicate", methods=["POST"])
@jwt_required()
def duplicate_resume(resume_id: str) -> tuple[Response, int]:
    # Lock the user row first to serialize concurrent duplicate requests.
    user = _locked_current_user()
    if not user:
        return jsonify({"message": "User not found."}), 404

    _, limit_err = _check_resume_limit(user.user_id)
    if limit_err:
        return limit_err

    resume = _get_owned_resume(resume_id, user.user_id)
    if not resume:
        return jsonify({"message": "Resume not found."}), 404

    copy = Resume(
        user_id=user.user_id,
        title=f"{resume.title} (copy)",
        template_id=resume.template_id,
        content_json=resume.content_json,
    )
    db.session.add(copy)
    db.session.commit()
    log_event("resume_duplicated", user_id=user.user_id,
              metadata={"original_id": str(resume.resume_id), "copy_id": str(copy.resume_id)})
    return jsonify(copy.to_dict()), 201


@resumes_bp.route("/<resume_id>/export", methods=["GET"])
@jwt_required()
@limiter.limit("20 per hour")
def export_resume(resume_id: str) -> tuple[Response, int] | Response:
    user, err = get_current_user_or_404()
    if err:
        return err

    resume = _get_owned_resume(resume_id, user.user_id)
    if not resume:
        return jsonify({"message": "Resume not found."}), 404

    try:
        pdf_bytes = generate_pdf(
            resume,
            timeout_seconds=current_app.config.get("PDF_GENERATION_TIMEOUT", 30),
        )
    except TimeoutError:
        log_event("pdf_generation_failed", user_id=user.user_id,
                  metadata={"error": "timeout"})
        return jsonify({"message": "PDF generation timed out. Please try again."}), 504
    except Exception as exc:
        current_app.logger.exception("PDF generation failed for resume %s", resume_id)
        log_event("pdf_generation_failed", user_id=user.user_id,
                  metadata={"error": type(exc).__name__})
        return jsonify({"message": "PDF generation failed."}), 500

    pdf_stream = io.BytesIO(pdf_bytes)
    safe_title = "".join(c for c in resume.title if c.isalnum() or c in (" ", "-", "_"))[:50]
    log_event("resume_exported", user_id=user.user_id,
              metadata={"resume_id": str(resume.resume_id)})

    return send_file(
        pdf_stream,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{safe_title or 'resume'}.pdf",
    )


@resumes_bp.route("/limits", methods=["GET"])
@jwt_required()
def get_limits() -> tuple[Response, int]:
    return jsonify({"max_resumes": _max_resumes()}), 200


@resumes_bp.route("/templates", methods=["GET"])
@jwt_required()
def list_templates() -> tuple[Response, int]:
    templates = [
        {"id": tid, "name": meta["name"], "description": meta["description"]}
        for tid, meta in TEMPLATE_METADATA.items()
    ]
    return jsonify(templates), 200
