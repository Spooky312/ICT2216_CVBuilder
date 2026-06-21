import pytest
from marshmallow import ValidationError

from app.schemas.resume_schema import CreateResumeSchema


def payload_with(**content_overrides):
    content = {
        "personal_info": {
            "full_name": "  Alice Smith  ",
            "email": "  alice@example.com  ",
            "phone": "",
            "linkedin": "  ",
        },
        "education": [],
        "experience": [],
        "projects": [],
        "skills": {"technical": [" Python ", ""]},
    }
    content.update(content_overrides)
    return {
        "title": "  Software Resume  ",
        "template_id": "modern",
        "content_json": content,
    }


def test_blank_optional_values_are_removed_and_strings_trimmed():
    result = CreateResumeSchema().load(payload_with())

    assert result["title"] == "Software Resume"
    personal = result["content_json"]["personal_info"]
    assert personal["full_name"] == "Alice Smith"
    assert personal["email"] == "alice@example.com"
    assert "phone" not in personal
    assert "linkedin" not in personal
    assert result["content_json"]["skills"]["technical"] == ["Python"]


@pytest.mark.parametrize("date", ["2024-00", "2024-13", "2024-99"])
def test_invalid_month_is_rejected(date):
    payload = payload_with(experience=[{
        "company": "Acme",
        "position": "Developer",
        "start_date": date,
    }])

    with pytest.raises(ValidationError) as exc_info:
        CreateResumeSchema().load(payload)

    assert "Month must be between 01 and 12" in str(exc_info.value.messages)


def test_end_date_before_start_date_is_rejected():
    payload = payload_with(projects=[{
        "name": "CVBuilder",
        "start_date": "2025-06",
        "end_date": "2024-12",
    }])

    with pytest.raises(ValidationError) as exc_info:
        CreateResumeSchema().load(payload)

    assert "End date must not be before start date" in str(exc_info.value.messages)


def test_year_only_end_date_represents_end_of_year():
    payload = payload_with(education=[{
        "institution": "SIT",
        "degree": "BSc",
        "start_date": "2024-06",
        "end_date": "2024",
    }])

    result = CreateResumeSchema().load(payload)
    assert result["content_json"]["education"][0]["end_date"] == "2024"


def test_required_whitespace_only_value_is_rejected():
    payload = payload_with()
    payload["content_json"]["personal_info"]["full_name"] = "   "

    with pytest.raises(ValidationError) as exc_info:
        CreateResumeSchema().load(payload)

    assert "full_name" in str(exc_info.value.messages)
