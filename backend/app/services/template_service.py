from __future__ import annotations

from html.parser import HTMLParser
import os
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
ALLOWED_UPLOAD_EXTENSIONS = {".html", ".htm"}
MAX_TEMPLATE_UPLOAD_BYTES = 100_000
_ALLOWED_TEMPLATE_TAGS = {
    "html", "head", "body", "meta", "title", "style",
    "div", "span", "p", "br", "hr", "strong", "b", "em", "i", "u", "small",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
    "section", "article", "header", "footer", "main",
}
_ALLOWED_TEMPLATE_ATTRS = {
    "class", "id", "style", "colspan", "rowspan", "scope", "align", "valign",
    "width", "height", "lang", "dir", "charset",
}
_RESOURCE_ATTRS = {
    "src", "srcset", "href", "xlink:href", "action", "formaction", "poster", "data",
    "background", "cite", "longdesc", "profile", "manifest",
}


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


class _TemplateAllowlistParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.errors: list[str] = []
        self._style_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._validate_tag(tag, attrs)
        if tag.lower() == "style":
            self._style_depth += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._validate_tag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "style" and self._style_depth:
            self._style_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._style_depth:
            self._validate_css(data)

    def _validate_tag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        clean_tag = tag.lower()
        if clean_tag not in _ALLOWED_TEMPLATE_TAGS:
            self._add_error(f"Tag <{tag}> is not allowed.")
            return

        for raw_name, value in attrs:
            name = raw_name.lower()
            if name.startswith("on"):
                self._add_error("Event handler attributes are not allowed.")
            elif name in _RESOURCE_ATTRS:
                self._add_error(f"Resource-loading attribute '{raw_name}' is not allowed.")
            elif name not in _ALLOWED_TEMPLATE_ATTRS and not name.startswith("aria-"):
                self._add_error(f"Attribute '{raw_name}' is not allowed.")

            if value and name == "style":
                self._validate_css(value)

    def _validate_css(self, css: str) -> None:
        compact = "".join(css.lower().split())
        if "@import" in compact or "url(" in compact or "expression(" in compact:
            self._add_error("CSS cannot import or reference external resources.")

    def _add_error(self, message: str) -> None:
        if message not in self.errors:
            self.errors.append(message)


def _validate_template_html_allowlist(html_content: str) -> list[str]:
    parser = _TemplateAllowlistParser()
    try:
        parser.feed(html_content)
        parser.close()
    except Exception:
        return ["Template HTML could not be parsed safely."]
    return parser.errors


def validate_uploaded_template(filename: str, raw_content: bytes) -> tuple[str | None, dict[str, list[str]]]:
    errors: dict[str, list[str]] = {}
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        errors["template_file"] = ["Upload an .html or .htm file."]
    if not raw_content:
        errors.setdefault("template_file", []).append("Template file is required.")
    if len(raw_content) > MAX_TEMPLATE_UPLOAD_BYTES:
        errors.setdefault("template_file", []).append("Template file must be 100 KB or smaller.")
    if b"\x00" in raw_content:
        errors.setdefault("template_file", []).append("Template file must be plain text HTML.")

    try:
        html_content = raw_content.decode("utf-8")
    except UnicodeDecodeError:
        errors.setdefault("template_file", []).append("Template file must be UTF-8 encoded.")
        return None, errors

    stripped = html_content.strip()
    if not stripped:
        errors.setdefault("template_file", []).append("Template file cannot be empty.")
    if "{{" not in stripped and "{%" not in stripped:
        errors.setdefault("template_file", []).append("Template must contain Jinja placeholders for resume data.")

    allowlist_errors = _validate_template_html_allowlist(stripped) if stripped else []
    if allowlist_errors:
        errors.setdefault("template_file", []).extend(allowlist_errors)

    return (None, errors) if errors else (stripped, {})


def create_uploaded_template(
    *,
    template_id: str,
    name: str,
    description: str,
    html_content: str,
    original_filename: str,
    active: bool = True,
) -> ResumeTemplate:
    ensure_default_templates()
    template = ResumeTemplate(
        template_id=template_id,
        name=name,
        description=description,
        source_template_id=template_id,
        html_content=html_content,
        original_filename=original_filename,
        active=active,
    )
    db.session.add(template)
    db.session.commit()
    return template