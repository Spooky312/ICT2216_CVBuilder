from __future__ import annotations

from dataclasses import dataclass
import json
import os
import signal
import subprocess
import sys
import tempfile
import types
from typing import TYPE_CHECKING, Any

from flask import current_app, has_app_context
from jinja2 import BaseLoader, select_autoescape
from jinja2.sandbox import SandboxedEnvironment
from weasyprint import HTML
from weasyprint.urls import default_url_fetcher

from app.services.template_service import BUILTIN_TEMPLATE_FILES, get_template

if TYPE_CHECKING:
    from app.models.resume import Resume

_JINJA_ENV = SandboxedEnvironment(
    loader=BaseLoader(),
    autoescape=select_autoescape(["html", "xml"]),
)
_JINJA_ENV.globals.clear()

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEMPLATE_DIR = os.path.normpath(os.path.join(_HERE, "..", "templates", "resumes"))
_BACKEND_ROOT = os.path.normpath(os.path.join(_HERE, "..", ".."))
_HAS_SIGALRM = hasattr(signal, "SIGALRM")


class _PDFTimeout(Exception):
    """Raised by the SIGALRM handler when PDF generation exceeds the time limit."""


@dataclass(frozen=True)
class _TemplateSource:
    html: str
    is_uploaded: bool


def _source_template_id(template_id: str) -> str:
    persisted = get_template(template_id)
    source_id = persisted.source_template_id if persisted else template_id
    if source_id not in BUILTIN_TEMPLATE_FILES:
        raise ValueError(f"Unknown source_template_id: {source_id!r}")
    return source_id


def _load_template(template_id: str) -> _TemplateSource:
    persisted = get_template(template_id)
    if persisted and persisted.html_content:
        return _TemplateSource(html=persisted.html_content, is_uploaded=True)

    source_id = _source_template_id(template_id)
    path = os.path.join(_TEMPLATE_DIR, f"{source_id}.html")
    with open(path, "r", encoding="utf-8") as f:
        return _TemplateSource(html=f.read(), is_uploaded=False)


def _blocking_url_fetcher(url: str, *args: Any, **kwargs: Any) -> dict[str, Any]:
    """Refuse to fetch any external/local resource while rendering a PDF.

    Templates are already validated to strip resource-loading attributes and
    CSS ``url()``/``@import`` (see template_service), but this is defence in
    depth: even if a Jinja value smuggled a ``url()`` into a CSS context,
    WeasyPrint must never reach out over http(s) or read ``file://`` paths
    (SSRF / local-file disclosure). Inline ``data:`` URIs stay allowed so
    embedded images/fonts keep working.
    """
    if url.startswith("data:"):
        return default_url_fetcher(url, *args, **kwargs)
    raise ValueError(f"Blocked external resource during PDF rendering: {url[:80]!r}")


def _safe_render(template_src: str, context: dict[str, Any]) -> str:
    tmpl = _JINJA_ENV.from_string(template_src)
    return tmpl.render(**context)


def _render_pdf(template_src: str, content_json: dict[str, Any]) -> bytes:
    html_content = _safe_render(template_src, {"resume": content_json})
    return HTML(string=html_content, url_fetcher=_blocking_url_fetcher).write_pdf()


def _pdf_worker_memory_mb() -> int:
    if not has_app_context():
        return 512
    return int(current_app.config.get("PDF_WORKER_MEMORY_MB", 512))


def _render_uploaded_pdf_in_worker(
    template_src: str,
    content_json: dict[str, Any],
    timeout_seconds: int,
) -> bytes:
    input_path = ""
    output_path = ""
    payload = {
        "template_src": template_src,
        "content_json": content_json,
        "timeout_seconds": max(1, int(timeout_seconds)) if timeout_seconds > 0 else 0,
        "memory_mb": _pdf_worker_memory_mb(),
    }

    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            suffix=".json",
            delete=False,
        ) as f:
            input_path = f.name
            json.dump(payload, f)
        with tempfile.NamedTemporaryFile("wb", suffix=".pdf", delete=False) as f:
            output_path = f.name

        env = os.environ.copy()
        env["PYTHONPATH"] = (
            _BACKEND_ROOT
            if not env.get("PYTHONPATH")
            else f"{_BACKEND_ROOT}{os.pathsep}{env['PYTHONPATH']}"
        )
        completed = subprocess.run(
            [sys.executable, "-m", "app.services.pdf_worker", input_path, output_path],
            cwd=_BACKEND_ROOT,
            env=env,
            capture_output=True,
            timeout=timeout_seconds if timeout_seconds > 0 else None,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        if output_path:
            try:
                os.unlink(output_path)
            except OSError:
                pass
        raise TimeoutError(
            f"PDF generation exceeded the {timeout_seconds}s limit."
        ) from exc
    finally:
        if input_path:
            try:
                os.unlink(input_path)
            except OSError:
                pass

    try:
        if completed.returncode != 0:
            stderr = completed.stderr.decode("utf-8", errors="replace").strip()
            raise RuntimeError(
                f"Isolated PDF worker failed with exit code {completed.returncode}: {stderr}"
            )

        with open(output_path, "rb") as f:
            return f.read()
    finally:
        if output_path:
            try:
                os.unlink(output_path)
            except OSError:
                pass


def _render_builtin_pdf_with_timeout(
    template_src: str,
    content_json: dict[str, Any],
    timeout_seconds: int,
) -> bytes:
    if _HAS_SIGALRM and timeout_seconds > 0:
        def _handle_alarm(signum: int, frame: types.FrameType | None) -> None:
            raise _PDFTimeout()

        try:
            old_handler = signal.signal(signal.SIGALRM, _handle_alarm)
        except ValueError:
            return _render_pdf(template_src, content_json)

        signal.alarm(timeout_seconds)
        try:
            return _render_pdf(template_src, content_json)
        except _PDFTimeout:
            raise TimeoutError(
                f"PDF generation exceeded the {timeout_seconds}s limit."
            )
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)

    return _render_pdf(template_src, content_json)


def generate_pdf_from_content(
    template_id: str,
    content_json: dict[str, Any],
    timeout_seconds: int = 30,
) -> bytes:
    """Render validated resume content without requiring a persisted model."""
    template_source = _load_template(template_id)
    if template_source.is_uploaded:
        return _render_uploaded_pdf_in_worker(
            template_source.html,
            content_json,
            timeout_seconds,
        )

    return _render_builtin_pdf_with_timeout(
        template_source.html,
        content_json,
        timeout_seconds,
    )


def generate_pdf(resume: Resume, timeout_seconds: int = 30) -> bytes:
    """Backwards-compatible saved-resume PDF entry point."""
    return generate_pdf_from_content(
        resume.template_id,
        resume.content_json,
        timeout_seconds=timeout_seconds,
    )
