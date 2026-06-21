from types import SimpleNamespace

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
