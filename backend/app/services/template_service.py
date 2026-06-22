from __future__ import annotations

import re

from app.extensions import db
from app.models.resume_template import ResumeTemplate

DEFAULT_TEMPLATE_METADATA: dict[str, dict[str, str]] = {
    "modern": {
        "name": "Modern",
        "description": "Clean two-column layout with accent colors",
        "source_template_id": "modern",
    },
    "classic": {
        "name": "Classic",
        "description": "Traditional single-column format",
        "source_template_id": "classic",
    },
    "minimal": {
        "name": "Minimal",
        "description": "Simple, whitespace-focused design",
        "source_template_id": "minimal",
    },
}

BUILTIN_TEMPLATE_FILES: set[str] = set(DEFAULT_TEMPLATE_METADATA)
_TEMPLATE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,49}$")


def normalise_template_id(value: str) -> str:
    return value.strip().lower()


def valid_template_id(value: str) -> bool:
    return bool(_TEMPLATE_ID_RE.fullmatch(value))


def ensure_default_templates() -> None:
    changed = False
    for template_id, meta in DEFAULT_TEMPLATE_METADATA.items():
        existing = db.session.get(ResumeTemplate, template_id)
        if existing:
            continue
        db.session.add(ResumeTemplate(
            template_id=template_id,
            name=meta["name"],
            description=meta["description"],
            source_template_id=meta["source_template_id"],
            active=True,
        ))
        changed = True
    if changed:
        db.session.commit()


def list_templates(*, active_only: bool = False) -> list[ResumeTemplate]:
    ensure_default_templates()
    query = ResumeTemplate.query
    if active_only:
        query = query.filter_by(active=True)
    return query.order_by(ResumeTemplate.name.asc()).all()


def get_template(template_id: str) -> ResumeTemplate | None:
    ensure_default_templates()
    return db.session.get(ResumeTemplate, template_id)


def get_active_template(template_id: str) -> ResumeTemplate | None:
    template = get_template(template_id)
    if not template or not template.active:
        return None
    return template


def template_selection_error(template_id: str) -> tuple[dict[str, list[str]], int] | None:
    if get_active_template(template_id):
        return None
    return {"template_id": ["Unknown or inactive template."]}, 422


def create_template(
    *,
    template_id: str,
    name: str,
    description: str,
    source_template_id: str,
    active: bool = True,
) -> ResumeTemplate:
    ensure_default_templates()
    template = ResumeTemplate(
        template_id=template_id,
        name=name,
        description=description,
        source_template_id=source_template_id,
        active=active,
    )
    db.session.add(template)
    db.session.commit()
    return template
