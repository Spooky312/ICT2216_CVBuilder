from __future__ import annotations

import os
import signal
import types
from typing import TYPE_CHECKING, Any

from jinja2 import BaseLoader, select_autoescape
from jinja2.sandbox import SandboxedEnvironment
from weasyprint import HTML

from app.services.template_service import BUILTIN_TEMPLATE_FILES, get_template

if TYPE_CHECKING:
    from app.models.resume import Resume

_JINJA_ENV = SandboxedEnvironment(
    loader=BaseLoader(),
    autoescape=select_autoescape(["html", "xml"]),
)

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEMPLATE_DIR = os.path.normpath(os.path.join(_HERE, "..", "templates", "resumes"))
_HAS_SIGALRM = hasattr(signal, "SIGALRM")


class _PDFTimeout(Exception):
    """Raised by the SIGALRM handler when PDF generation exceeds the time limit."""


def _source_template_id(template_id: str) -> str:
    persisted = get_template(template_id)
    source_id = persisted.source_template_id if persisted else template_id
    if source_id not in BUILTIN_TEMPLATE_FILES:
        raise ValueError(f"Unknown source_template_id: {source_id!r}")
    return source_id


def _load_template(template_id: str) -> str:
    persisted = get_template(template_id)
    if persisted and persisted.html_content:
        return persisted.html_content

    source_id = _source_template_id(template_id)
    path = os.path.join(_TEMPLATE_DIR, f"{source_id}.html")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _safe_render(template_src: str, context: dict[str, Any]) -> str:
    tmpl = _JINJA_ENV.from_string(template_src)
    return tmpl.render(**context)


def generate_pdf_from_content(
    template_id: str,
    content_json: dict[str, Any],
    timeout_seconds: int = 30,
) -> bytes:
    """Render validated resume content without requiring a persisted model."""
    template_src = _load_template(template_id)
    html_content = _safe_render(template_src, {"resume": content_json})
    html_obj = HTML(string=html_content)

    if _HAS_SIGALRM and timeout_seconds > 0:
        def _handle_alarm(signum: int, frame: types.FrameType | None) -> None:
            raise _PDFTimeout()

        try:
            old_handler = signal.signal(signal.SIGALRM, _handle_alarm)
        except ValueError:
            return html_obj.write_pdf()

        signal.alarm(timeout_seconds)
        try:
            pdf_bytes = html_obj.write_pdf()
        except _PDFTimeout:
            raise TimeoutError(
                f"PDF generation exceeded the {timeout_seconds}s limit."
            )
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)
    else:
        pdf_bytes = html_obj.write_pdf()

    return pdf_bytes


def generate_pdf(resume: Resume, timeout_seconds: int = 30) -> bytes:
    """Backwards-compatible saved-resume PDF entry point."""
    return generate_pdf_from_content(
        resume.template_id,
        resume.content_json,
        timeout_seconds=timeout_seconds,
    )
