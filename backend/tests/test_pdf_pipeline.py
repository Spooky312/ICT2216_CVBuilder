"""Unit tests for the sandboxed PDF rendering pipeline.

Covers the HTML-escaping safety layer, the pdf_service orchestration helpers
(worker env, timeouts, isolated-worker success/failure/timeout handling) and the
pdf_worker process entry points, including the SSRF-blocking url_fetcher.
"""
import json
import subprocess

import pytest

from app.services import pdf_service, pdf_worker
from app.services.pdf_safety import escape_pdf_context


# --------------------------------------------------------------------------- #
# pdf_safety.escape_pdf_context                                               #
# --------------------------------------------------------------------------- #
def test_escape_pdf_context_recurses_through_containers():
    result = escape_pdf_context(
        {
            "name": "<b>x</b>",
            "items": ["<i>a</i>", 3],
            "pair": ("<u>t</u>", None),
        }
    )
    assert str(result["name"]) == "&lt;b&gt;x&lt;/b&gt;"
    assert str(result["items"][0]) == "&lt;i&gt;a&lt;/i&gt;"
    # Non-string scalars pass through untouched.
    assert result["items"][1] == 3
    assert isinstance(result["pair"], tuple)
    assert str(result["pair"][0]) == "&lt;u&gt;t&lt;/u&gt;"
    assert result["pair"][1] is None


def test_escape_pdf_context_returns_scalars_unchanged():
    assert escape_pdf_context(42) == 42
    assert escape_pdf_context(None) is None


# --------------------------------------------------------------------------- #
# pdf_service helpers                                                          #
# --------------------------------------------------------------------------- #
def test_source_template_id_rejects_unknown_source(app):
    with app.app_context():
        with pytest.raises(ValueError):
            pdf_service._source_template_id("definitely-not-a-real-template")


def test_pdf_worker_memory_mb_defaults_without_app_context():
    # Called outside an application context -> falls back to the default.
    assert pdf_service._pdf_worker_memory_mb() == 512


def test_pdf_worker_memory_mb_reads_app_config(app):
    with app.app_context():
        app.config["PDF_WORKER_MEMORY_MB"] = 256
        try:
            assert pdf_service._pdf_worker_memory_mb() == 256
        finally:
            app.config.pop("PDF_WORKER_MEMORY_MB", None)


def test_unlink_quietly_handles_missing_and_empty_paths(tmp_path):
    # Empty path is a no-op.
    pdf_service._unlink_quietly("")
    # Non-existent path swallows the OSError.
    pdf_service._unlink_quietly(str(tmp_path / "nope.pdf"))
    # Existing file is removed.
    target = tmp_path / "gone.pdf"
    target.write_text("x", encoding="utf-8")
    pdf_service._unlink_quietly(str(target))
    assert not target.exists()


def test_worker_env_prepends_backend_root(monkeypatch):
    monkeypatch.delenv("PYTHONPATH", raising=False)
    env = pdf_service._worker_env()
    assert env["PYTHONPATH"] == pdf_service._BACKEND_ROOT

    monkeypatch.setenv("PYTHONPATH", "/existing")
    env = pdf_service._worker_env()
    assert env["PYTHONPATH"].startswith(pdf_service._BACKEND_ROOT)
    assert env["PYTHONPATH"].endswith("/existing")


def test_worker_timeout_maps_non_positive_to_none():
    assert pdf_service._worker_timeout(5) == 5
    assert pdf_service._worker_timeout(0) is None
    assert pdf_service._worker_timeout(-3) is None


def test_render_uploaded_pdf_reads_worker_output(monkeypatch):
    def fake_run(input_path, output_path, timeout_seconds):
        # Simulate a successful worker writing the PDF bytes.
        with open(output_path, "wb") as f:
            f.write(b"%PDF worker-output")
        return subprocess.CompletedProcess(args=[], returncode=0, stdout=b"", stderr=b"")

    monkeypatch.setattr(pdf_service, "_run_pdf_worker", fake_run)
    result = pdf_service._render_uploaded_pdf_in_worker("<html></html>", {}, 5)
    assert result == b"%PDF worker-output"


def test_render_uploaded_pdf_raises_on_worker_failure(monkeypatch):
    def fake_run(input_path, output_path, timeout_seconds):
        return subprocess.CompletedProcess(
            args=[], returncode=4, stdout=b"", stderr=b"boom"
        )

    monkeypatch.setattr(pdf_service, "_run_pdf_worker", fake_run)
    with pytest.raises(RuntimeError) as exc:
        pdf_service._render_uploaded_pdf_in_worker("<html></html>", {}, 5)
    assert "exit code 4" in str(exc.value)


def test_render_uploaded_pdf_translates_timeout(monkeypatch):
    def fake_run(input_path, output_path, timeout_seconds):
        raise subprocess.TimeoutExpired(cmd="worker", timeout=timeout_seconds)

    monkeypatch.setattr(pdf_service, "_run_pdf_worker", fake_run)
    with pytest.raises(TimeoutError):
        pdf_service._render_uploaded_pdf_in_worker("<html></html>", {}, 3)


# --------------------------------------------------------------------------- #
# pdf_worker module entry points                                              #
# --------------------------------------------------------------------------- #
def test_apply_resource_limits_sets_cpu_and_memory(monkeypatch):
    # Never apply real rlimits to the test runner (that would kill pytest);
    # record the calls instead.
    resource = pytest.importorskip("resource")
    calls = []
    monkeypatch.setattr(resource, "setrlimit", lambda *a: calls.append(a))
    pdf_worker._apply_resource_limits(2, 128)
    limited = {a[0] for a in calls}
    assert resource.RLIMIT_CPU in limited
    assert resource.RLIMIT_AS in limited


def test_apply_resource_limits_noop_for_non_positive(monkeypatch):
    resource = pytest.importorskip("resource")
    calls = []
    monkeypatch.setattr(resource, "setrlimit", lambda *a: calls.append(a))
    pdf_worker._apply_resource_limits(0, 0)
    assert calls == []


def test_worker_main_reports_bad_argument_count(monkeypatch):
    monkeypatch.setattr(pdf_worker.sys, "argv", ["prog", "only-one"])
    assert pdf_worker.main() == 2


def test_worker_main_rejects_invalid_paths(monkeypatch):
    monkeypatch.setattr(
        pdf_worker.sys, "argv", ["prog", "relative.json", "relative.pdf"]
    )
    assert pdf_worker.main() == 3


def test_worker_main_handles_unreadable_payload(monkeypatch, tmp_path):
    # File exists (so path validation passes) but holds invalid JSON.
    bad = tmp_path / "bad.json"
    bad.write_text("not-json{", encoding="utf-8")
    output = tmp_path / "out.pdf"
    monkeypatch.setattr(
        pdf_worker.sys, "argv", ["prog", str(bad), str(output)]
    )
    assert pdf_worker.main() == 3


def test_worker_main_renders_pdf_end_to_end(monkeypatch, tmp_path):
    payload = {
        "template_src": "<html><head><title>{{ resume.name }}</title></head>"
        "<body>{{ resume.name }}</body></html>",
        "content_json": {"name": "Alice"},
        "timeout_seconds": 0,
        "memory_mb": 0,
    }
    input_path = tmp_path / "payload.json"
    output_path = tmp_path / "out.pdf"
    input_path.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(
        pdf_worker.sys, "argv", ["prog", str(input_path), str(output_path)]
    )

    assert pdf_worker.main() == 0
    assert output_path.exists()
    assert output_path.read_bytes().startswith(b"%PDF")


def test_worker_render_pdf_produces_pdf_bytes():
    # WeasyPrint swallows the blocked-resource error and still renders; the
    # blocking fetcher just prevents the external image from loading.
    pdf_bytes = pdf_worker._render_pdf(
        '<html><body><img src="https://evil.example/x.png">hi</body></html>',
        {},
    )
    assert pdf_bytes.startswith(b"%PDF")
