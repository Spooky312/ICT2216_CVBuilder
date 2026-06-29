from types import SimpleNamespace

import pytest

from app.models.resume_template import ResumeTemplate
from app.services import pdf_service


def test_blocking_url_fetcher_rejects_external_and_local_resources():
    for blocked in ("https://evil.example/x.png", "http://169.254.169.254/",
                    "file:///etc/passwd"):
        with pytest.raises(ValueError):
            pdf_service._blocking_url_fetcher(blocked)
    # Inline data: URIs are still permitted (delegated to the default fetcher).
    result = pdf_service._blocking_url_fetcher("data:text/plain;base64,aGk=")
    assert result is not None


def test_saved_resume_export_uses_shared_content_renderer(monkeypatch):
    calls = {}

    def render(template_id, content_json, timeout_seconds=30):
        calls.update({
            "template_id": template_id,
            "content_json": content_json,
            "timeout_seconds": timeout_seconds,
        })
        return b"%PDF shared"

    monkeypatch.setattr(pdf_service, "generate_pdf_from_content", render)
    resume = SimpleNamespace(
        template_id="classic",
        content_json={"personal_info": {"full_name": "Alice"}},
    )

    result = pdf_service.generate_pdf(resume, timeout_seconds=7)

    assert result == b"%PDF shared"
    assert calls == {
        "template_id": "classic",
        "content_json": resume.content_json,
        "timeout_seconds": 7,
    }


def test_uploaded_template_html_is_used_for_pdf_generation(db, monkeypatch):
    template = ResumeTemplate(
        template_id="custom-html",
        name="Custom HTML",
        description="Uploaded",
        source_template_id="custom-html",
        html_content="<html><body>{{ resume.personal_info.full_name }}</body></html>",
        original_filename="custom.html",
        active=True,
    )
    db.session.add(template)
    db.session.commit()
    calls = {}

    def fake_worker(template_src, content_json, timeout_seconds):
        calls["template_src"] = template_src
        calls["content_json"] = content_json
        calls["timeout_seconds"] = timeout_seconds
        return b"%PDF uploaded"

    monkeypatch.setattr(pdf_service, "_render_uploaded_pdf_in_worker", fake_worker)

    result = pdf_service.generate_pdf_from_content(
        "custom-html",
        {"personal_info": {"full_name": "Alice"}},
        timeout_seconds=5,
    )

    assert result == b"%PDF uploaded"
    assert calls["template_src"] == template.html_content
    assert calls["content_json"] == {"personal_info": {"full_name": "Alice"}}
    assert calls["timeout_seconds"] == 5

def test_empty_skills_do_not_render_skills_section(monkeypatch):
    rendered = []
    fetchers = []

    class FakeHTML:
        def __init__(self, string, url_fetcher=None):
            rendered.append(string)
            fetchers.append(url_fetcher)

        def write_pdf(self):
            return b"%PDF rendered"

    monkeypatch.setattr(pdf_service, "HTML", FakeHTML)

    pdf_service.generate_pdf_from_content(
        "modern",
        {
            "personal_info": {"full_name": "Alice", "email": "alice@example.com"},
            "education": [],
            "experience": [],
            "projects": [],
            "skills": {"technical": [], "soft": [], "languages": [], "certifications": []},
        },
        timeout_seconds=0,
    )
    assert "<h2>Skills</h2>" not in rendered[-1]

    pdf_service.generate_pdf_from_content(
        "modern",
        {
            "personal_info": {"full_name": "Alice", "email": "alice@example.com"},
            "education": [],
            "experience": [],
            "projects": [],
            "skills": {"technical": ["Python"], "soft": [], "languages": [], "certifications": []},
        },
        timeout_seconds=0,
    )
    assert "<h2>Skills</h2>" in rendered[-1]
    assert "Python" in rendered[-1]
    # Rendering must wire in the blocking fetcher (no external resource loading).
    assert all(f is pdf_service._blocking_url_fetcher for f in fetchers)

def test_pdf_timeout_covers_jinja_rendering(monkeypatch):
    def slow_render(template_src, context):
        raise pdf_service._PDFTimeout()

    monkeypatch.setattr(pdf_service, "_safe_render", slow_render)

    try:
        pdf_service.generate_pdf_from_content(
            "modern",
            {"personal_info": {"full_name": "Alice"}},
            timeout_seconds=1,
        )
    except TimeoutError as exc:
        assert "PDF generation exceeded" in str(exc)
    else:
        raise AssertionError("Expected TimeoutError")
