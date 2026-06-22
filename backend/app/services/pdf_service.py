from __future__ import annotations

import os
import signal
import types
from typing import TYPE_CHECKING, Any

from jinja2 import Environment, BaseLoader, select_autoescape
from weasyprint import HTML

from app.schemas.resume_schema import ALLOWED_TEMPLATES

# TYPE_CHECKING is False at runtime, so this import is never executed during
# normal startup or tests — it only exists for static type checkers (mypy/pyright).
# This breaks the services → models module-level dependency, ensuring pdf_service
# can be imported without first loading the entire models package.
if TYPE_CHECKING:
    from app.models.resume import Resume

_JINJA_ENV = Environment(
    loader=BaseLoader(),
    autoescape=select_autoescape(["html", "xml"]),
)

# Anchor template paths to this file's directory so they don't depend on cwd.
_HERE = os.path.dirname(os.path.abspath(__file__))
_TEMPLATE_DIR = os.path.normpath(os.path.join(_HERE, "..", "templates", "resumes"))

# SIGALRM is POSIX-only; gracefully absent on Windows dev machines.
_HAS_SIGALRM = hasattr(signal, "SIGALRM")


class _PDFTimeout(Exception):
    """Raised by the SIGALRM handler when PDF generation exceeds the time limit."""


def _load_template(template_id: str) -> str:
    # Reject unknown template IDs rather than silently falling back.
    if template_id not in ALLOWED_TEMPLATES:
        raise ValueError(f"Unknown template_id: {template_id!r}")
    path = os.path.join(_TEMPLATE_DIR, f"{template_id}.html")
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
        # Enforce a hard timeout via SIGALRM (Linux/macOS only).
        # Only works in the main thread; falls back when called from a
        # gunicorn threaded worker (--threads > 1), where signal.signal
        # raises ValueError. Gunicorn's own --timeout still protects those.
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
