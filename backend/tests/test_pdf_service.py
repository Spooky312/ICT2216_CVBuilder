from types import SimpleNamespace

from app.models.resume_template import ResumeTemplate
from app.services import pdf_service


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

    def fake_render(template_src, context):
        calls["template_src"] = template_src
        calls["context"] = context
        return "<html><body>Alice</body></html>"

    class FakeHTML:
        def __init__(self, string):
            calls["html"] = string

        def write_pdf(self):
            return b"%PDF uploaded"

    monkeypatch.setattr(pdf_service, "_safe_render", fake_render)
    monkeypatch.setattr(pdf_service, "HTML", FakeHTML)

    result = pdf_service.generate_pdf_from_content(
        "custom-html",
        {"personal_info": {"full_name": "Alice"}},
        timeout_seconds=0,
    )

    assert result == b"%PDF uploaded"
    assert calls["template_src"] == template.html_content
    assert calls["context"] == {"resume": {"personal_info": {"full_name": "Alice"}}}
    assert calls["html"] == "<html><body>Alice</body></html>"

def test_empty_skills_do_not_render_skills_section(monkeypatch):
    rendered = []

    class FakeHTML:
        def __init__(self, string):
            rendered.append(string)

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
