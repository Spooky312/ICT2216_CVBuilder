from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from typing import Any


def _apply_resource_limits(timeout_seconds: int, memory_mb: int) -> None:
    try:
        import resource
    except ImportError:
        return

    if timeout_seconds > 0 and hasattr(resource, "RLIMIT_CPU"):
        cpu_seconds = max(1, int(timeout_seconds))
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
        except (OSError, ValueError):
            pass

    if memory_mb > 0 and hasattr(resource, "RLIMIT_AS"):
        memory_bytes = max(128, int(memory_mb)) * 1024 * 1024
        try:
            resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        except (OSError, ValueError):
            pass


def _render_pdf(template_src: str, content_json: dict[str, Any]) -> bytes:
    from jinja2 import BaseLoader, select_autoescape
    from jinja2.sandbox import SandboxedEnvironment
    from weasyprint import HTML
    from weasyprint.urls import default_url_fetcher

    def _blocking_url_fetcher(url: str, *args: Any, **kwargs: Any) -> dict[str, Any]:
        # Defence in depth for untrusted uploaded templates: never fetch
        # external/local resources (SSRF / local-file disclosure). Only inline
        # data: URIs are allowed so embedded images/fonts still render.
        if url.startswith("data:"):
            return default_url_fetcher(url, *args, **kwargs)
        raise ValueError(f"Blocked external resource during PDF rendering: {url[:80]!r}")

    env = SandboxedEnvironment(
        loader=BaseLoader(),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.globals.clear()

    html_content = env.from_string(template_src).render(resume=content_json)
    return HTML(string=html_content, url_fetcher=_blocking_url_fetcher).write_pdf()


def _validate_worker_path(raw_path: str, *, expected_suffix: str, must_exist: bool) -> Path:
    temp_root = Path(tempfile.gettempdir()).resolve()
    path = Path(raw_path)
    if not path.is_absolute() or path.suffix != expected_suffix:
        raise ValueError("Worker path must be an absolute temporary file with the expected suffix.")

    resolved_path = path.resolve(strict=must_exist)
    if not must_exist:
        resolved_path.parent.resolve(strict=True)

    if temp_root != resolved_path and temp_root not in resolved_path.parents:
        raise ValueError("Worker path must stay inside the system temporary directory.")
    return resolved_path


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python -m app.services.pdf_worker INPUT_JSON OUTPUT_PDF", file=sys.stderr)
        return 2

    try:
        input_path = _validate_worker_path(sys.argv[1], expected_suffix=".json", must_exist=True)
        output_path = _validate_worker_path(sys.argv[2], expected_suffix=".pdf", must_exist=False)
    except ValueError as exc:
        print(f"Invalid PDF worker path: {exc}", file=sys.stderr)
        return 3

    try:
        with input_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    except Exception as exc:
        print(f"Failed to read PDF worker payload: {exc}", file=sys.stderr)
        return 3

    timeout_seconds = int(payload.get("timeout_seconds") or 0)
    memory_mb = int(payload.get("memory_mb") or 0)
    _apply_resource_limits(timeout_seconds, memory_mb)

    try:
        pdf_bytes = _render_pdf(payload["template_src"], payload["content_json"])
        with output_path.open("wb") as f:
            f.write(pdf_bytes)
    except Exception as exc:
        print(f"PDF worker render failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 4

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
