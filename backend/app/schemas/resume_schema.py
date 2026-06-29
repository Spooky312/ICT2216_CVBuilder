from __future__ import annotations

import re
from urllib.parse import urlsplit, urlunsplit
from marshmallow import (
    Schema, fields, validate, validates_schema, pre_load, ValidationError,
)

MAX_TEXT = 500
MAX_ENTRIES = 20

# Date pattern constants used by three entry schemas (Education, Experience,
# Project).  Centralised here so a format change is made in one place.
_START_DATE_RE = r'^\d{4}(-\d{2})?$'
_END_DATE_RE = r'^(\d{4}(-\d{2})?|Present)$'
_DATE_ERROR = "Date must be YYYY or YYYY-MM"
_END_DATE_ERROR = "Date must be YYYY, YYYY-MM, or Present"


def _normalise_value(value):
    """Trim strings and remove blank values before whitelist validation (SR-05)."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        values = [_normalise_value(item) for item in value]
        return [item for item in values if item != ""]
    if isinstance(value, dict):
        values = {key: _normalise_value(item) for key, item in value.items()}
        return {key: item for key, item in values.items() if item != ""}
    return value


class NormalisedSchema(Schema):
    """Base schema that normalises user-entered resume content before validation."""

    @pre_load
    def normalise_input(self, data, **kwargs):
        return _normalise_value(data)


def _validate_partial_date(value: str, *, allow_present: bool = False) -> None:
    if allow_present and value == "Present":
        return
    if not re.fullmatch(_START_DATE_RE, value):
        raise ValidationError(_END_DATE_ERROR if allow_present else _DATE_ERROR)
    parts = value.split("-")
    if len(parts) == 2 and not 1 <= int(parts[1]) <= 12:
        raise ValidationError("Month must be between 01 and 12")


def _start_date_key(value: str) -> tuple[int, int]:
    parts = value.split("-")
    return int(parts[0]), int(parts[1]) if len(parts) == 2 else 1


def _end_date_key(value: str) -> tuple[int, int] | None:
    if value == "Present":
        return None
    parts = value.split("-")
    return int(parts[0]), int(parts[1]) if len(parts) == 2 else 12


class DatedEntrySchema(NormalisedSchema):
    """Shared chronological validation for education, experience, and projects."""

    @validates_schema
    def validate_date_order(self, data, **kwargs) -> None:
        start = data.get("start_date")
        end = data.get("end_date")
        if not start or not end:
            return
        end_key = _end_date_key(end)
        if end_key is not None and end_key < _start_date_key(start):
            raise ValidationError({
                "end_date": ["End date must not be before start date."],
            })


def _start_date_field() -> fields.Str:
    """Shared start-date field: YYYY or YYYY-MM, optional."""
    return fields.Str(validate=lambda value: _validate_partial_date(value))


def _end_date_field() -> fields.Str:
    """Shared end-date field: YYYY, YYYY-MM, or 'Present', optional."""
    return fields.Str(validate=lambda value: _validate_partial_date(value, allow_present=True))


def _description_field() -> fields.Str:
    """Shared free-text description field capped at MAX_TEXT characters."""
    return fields.Str(validate=validate.Length(max=MAX_TEXT))


def normalise_web_url(value: str) -> str:
    """Add HTTPS to bare domains and reject unsafe or ambiguous URLs."""
    clean = value.strip()
    if not clean:
        return clean
    if any(character.isspace() for character in clean):
        raise ValidationError("Enter a valid web address without spaces")

    candidate = clean
    supplied = urlsplit(clean)
    if supplied.scheme:
        if supplied.scheme.lower() not in {"http", "https"}:
            raise ValidationError("Only http:// and https:// links are allowed")
    elif clean.startswith("//"):
        candidate = f"https:{clean}"
    else:
        candidate = f"https://{clean}"

    parsed = urlsplit(candidate)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValidationError("Enter a valid web address, such as example.com")
    if parsed.username or parsed.password:
        raise ValidationError("Links containing usernames or passwords are not allowed")

    try:
        hostname = parsed.hostname.encode("idna").decode("ascii").rstrip(".")
        parsed.port  # Validate the optional port range.
    except (UnicodeError, ValueError):
        raise ValidationError("Enter a valid web address, such as example.com")

    labels = hostname.split(".")
    if len(labels) < 2 or any(
        not label or len(label) > 63 or label.startswith("-") or label.endswith("-")
        or not re.fullmatch(r"[A-Za-z0-9-]+", label)
        for label in labels
    ):
        raise ValidationError("Enter a valid web address, such as example.com")

    return urlunsplit((parsed.scheme.lower(), parsed.netloc, parsed.path, parsed.query, parsed.fragment))


class SafeWebUrl(fields.Str):
    """URL field that canonicalises user-friendly domains before validation."""

    def _deserialize(self, value, attr, data, **kwargs):
        result = super()._deserialize(value, attr, data, **kwargs)
        return normalise_web_url(result) if result else result


class PersonalInfoSchema(NormalisedSchema):
    full_name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email(required=True)
    phone = fields.Str(validate=validate.Regexp(r'^[\d\s\+\-\(\)]{7,20}$',
                                                 error="Invalid phone format"))
    location = fields.Str(validate=validate.Length(max=100))
    linkedin = SafeWebUrl(validate=validate.Length(max=255))
    portfolio = SafeWebUrl(validate=validate.Length(max=255))
    summary = _description_field()


class EducationEntrySchema(DatedEntrySchema):
    institution = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    degree = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    field_of_study = fields.Str(validate=validate.Length(max=200))
    start_date = _start_date_field()
    end_date = _end_date_field()
    # Keep the existing JSON key for API compatibility while accepting grades
    # such as "Distinction", "A+", and numeric GPA values.
    gpa = fields.Str(validate=validate.Length(max=20))
    description = _description_field()


class ExperienceEntrySchema(DatedEntrySchema):
    company = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    position = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    start_date = _start_date_field()
    end_date = _end_date_field()
    location = fields.Str(validate=validate.Length(max=100))
    description = _description_field()
    achievements = fields.List(fields.Str(validate=validate.Length(max=MAX_TEXT)),
                                validate=validate.Length(max=10))


class ProjectEntrySchema(DatedEntrySchema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    description = _description_field()
    technologies = fields.List(fields.Str(validate=validate.Length(max=50)),
                                validate=validate.Length(max=15))
    url = SafeWebUrl(validate=validate.Length(max=255))
    start_date = _start_date_field()
    end_date = _end_date_field()


class SkillsSchema(NormalisedSchema):
    technical = fields.List(fields.Str(validate=validate.Length(max=50)),
                             validate=validate.Length(max=30))
    soft = fields.List(fields.Str(validate=validate.Length(max=50)),
                       validate=validate.Length(max=15))
    languages = fields.List(fields.Str(validate=validate.Length(max=50)),
                             validate=validate.Length(max=10))
    certifications = fields.List(fields.Str(validate=validate.Length(max=200)),
                                  validate=validate.Length(max=10))


class ResumeContentSchema(NormalisedSchema):
    personal_info = fields.Nested(PersonalInfoSchema, required=True)
    education = fields.List(fields.Nested(EducationEntrySchema),
                             validate=validate.Length(max=MAX_ENTRIES))
    experience = fields.List(fields.Nested(ExperienceEntrySchema),
                              validate=validate.Length(max=MAX_ENTRIES))
    projects = fields.List(fields.Nested(ProjectEntrySchema),
                            validate=validate.Length(max=MAX_ENTRIES))
    skills = fields.Nested(SkillsSchema)


class PreviewPersonalInfoSchema(PersonalInfoSchema):
    """Personal details remain optional while the wizard draft is incomplete."""

    full_name = fields.Str(validate=validate.Length(max=100))
    email = fields.Email()


class PreviewEducationEntrySchema(EducationEntrySchema):
    institution = fields.Str(validate=validate.Length(max=200))
    degree = fields.Str(validate=validate.Length(max=200))


class PreviewExperienceEntrySchema(ExperienceEntrySchema):
    company = fields.Str(validate=validate.Length(max=200))
    position = fields.Str(validate=validate.Length(max=200))


class PreviewProjectEntrySchema(ProjectEntrySchema):
    name = fields.Str(validate=validate.Length(max=200))


class PreviewResumeContentSchema(NormalisedSchema):
    """Whitelisted resume draft shape with safe defaults for Jinja rendering."""

    personal_info = fields.Nested(PreviewPersonalInfoSchema, load_default=dict)
    education = fields.List(
        fields.Nested(PreviewEducationEntrySchema),
        validate=validate.Length(max=MAX_ENTRIES),
        load_default=list,
    )
    experience = fields.List(
        fields.Nested(PreviewExperienceEntrySchema),
        validate=validate.Length(max=MAX_ENTRIES),
        load_default=list,
    )
    projects = fields.List(
        fields.Nested(PreviewProjectEntrySchema),
        validate=validate.Length(max=MAX_ENTRIES),
        load_default=list,
    )
    skills = fields.Nested(SkillsSchema, load_default=dict)


class PreviewResumeSchema(NormalisedSchema):
    template_id = fields.Str(required=True, validate=validate.Length(min=2, max=50))
    content_json = fields.Nested(PreviewResumeContentSchema, required=True)


class CreateResumeSchema(NormalisedSchema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    template_id = fields.Str(required=True, validate=validate.Length(min=2, max=50))
    content_json = fields.Nested(ResumeContentSchema, required=True)


class UpdateResumeSchema(NormalisedSchema):
    title = fields.Str(validate=validate.Length(min=1, max=100))
    template_id = fields.Str(validate=validate.Length(min=2, max=50))
    content_json = fields.Nested(ResumeContentSchema)

