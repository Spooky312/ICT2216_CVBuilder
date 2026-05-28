from __future__ import annotations

import re
from marshmallow import Schema, fields, validate, validates, ValidationError

URL_PATTERN = re.compile(r'^https?://.+\..+', re.IGNORECASE)

# Single source of truth for template ids and their display metadata.
# Both the validation schema (OneOf) and the admin/resume routes reference this.
TEMPLATE_METADATA: dict[str, dict[str, str]] = {
    "modern":  {"name": "Modern",  "description": "Clean two-column layout with accent colors"},
    "classic": {"name": "Classic", "description": "Traditional single-column format"},
    "minimal": {"name": "Minimal", "description": "Simple, whitespace-focused design"},
}
ALLOWED_TEMPLATES: set[str] = set(TEMPLATE_METADATA)

MAX_TEXT = 500
MAX_ENTRIES = 20

# Date pattern constants used by three entry schemas (Education, Experience,
# Project).  Centralised here so a format change is made in one place.
_START_DATE_RE = r'^\d{4}(-\d{2})?$'
_END_DATE_RE = r'^(\d{4}(-\d{2})?|Present)$'
_DATE_ERROR = "Date must be YYYY or YYYY-MM"
_END_DATE_ERROR = "Date must be YYYY, YYYY-MM, or Present"


def _start_date_field() -> fields.Str:
    """Shared start-date field: YYYY or YYYY-MM, optional."""
    return fields.Str(validate=validate.Regexp(_START_DATE_RE, error=_DATE_ERROR))


def _end_date_field() -> fields.Str:
    """Shared end-date field: YYYY, YYYY-MM, or 'Present', optional."""
    return fields.Str(validate=validate.Regexp(_END_DATE_RE, error=_END_DATE_ERROR))


def _description_field() -> fields.Str:
    """Shared free-text description field capped at MAX_TEXT characters."""
    return fields.Str(validate=validate.Length(max=MAX_TEXT))


def safe_url(value: str) -> None:
    if value and not URL_PATTERN.match(value):
        raise ValidationError("URL must start with http:// or https://")


class PersonalInfoSchema(Schema):
    full_name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email(required=True)
    phone = fields.Str(validate=validate.Regexp(r'^[\d\s\+\-\(\)]{7,20}$',
                                                 error="Invalid phone format"))
    location = fields.Str(validate=validate.Length(max=100))
    linkedin = fields.Str(validate=validate.Length(max=255))
    portfolio = fields.Str(validate=validate.Length(max=255))
    summary = _description_field()

    @validates("linkedin")
    def validate_linkedin(self, value: str) -> None:
        if value:
            safe_url(value)

    @validates("portfolio")
    def validate_portfolio(self, value: str) -> None:
        if value:
            safe_url(value)


class EducationEntrySchema(Schema):
    institution = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    degree = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    field_of_study = fields.Str(validate=validate.Length(max=200))
    start_date = _start_date_field()
    end_date = _end_date_field()
    gpa = fields.Str(validate=validate.Regexp(r'^\d(\.\d{1,2})?\/\d(\.\d)?$|^\d(\.\d{1,2})?$',
                                               error="Invalid GPA format"))
    description = _description_field()


class ExperienceEntrySchema(Schema):
    company = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    position = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    start_date = _start_date_field()
    end_date = _end_date_field()
    location = fields.Str(validate=validate.Length(max=100))
    description = _description_field()
    achievements = fields.List(fields.Str(validate=validate.Length(max=MAX_TEXT)),
                                validate=validate.Length(max=10))


class ProjectEntrySchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    description = _description_field()
    technologies = fields.List(fields.Str(validate=validate.Length(max=50)),
                                validate=validate.Length(max=15))
    url = fields.Str(validate=validate.Length(max=255))
    start_date = _start_date_field()
    end_date = _end_date_field()

    @validates("url")
    def validate_url(self, value: str) -> None:
        if value:
            safe_url(value)


class SkillsSchema(Schema):
    technical = fields.List(fields.Str(validate=validate.Length(max=50)),
                             validate=validate.Length(max=30))
    soft = fields.List(fields.Str(validate=validate.Length(max=50)),
                       validate=validate.Length(max=15))
    languages = fields.List(fields.Str(validate=validate.Length(max=50)),
                             validate=validate.Length(max=10))
    certifications = fields.List(fields.Str(validate=validate.Length(max=200)),
                                  validate=validate.Length(max=10))


class ResumeContentSchema(Schema):
    personal_info = fields.Nested(PersonalInfoSchema, required=True)
    education = fields.List(fields.Nested(EducationEntrySchema),
                             validate=validate.Length(max=MAX_ENTRIES))
    experience = fields.List(fields.Nested(ExperienceEntrySchema),
                              validate=validate.Length(max=MAX_ENTRIES))
    projects = fields.List(fields.Nested(ProjectEntrySchema),
                            validate=validate.Length(max=MAX_ENTRIES))
    skills = fields.Nested(SkillsSchema)


class CreateResumeSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    template_id = fields.Str(required=True, validate=validate.OneOf(ALLOWED_TEMPLATES))
    content_json = fields.Nested(ResumeContentSchema, required=True)


class UpdateResumeSchema(Schema):
    title = fields.Str(validate=validate.Length(min=1, max=100))
    template_id = fields.Str(validate=validate.OneOf(ALLOWED_TEMPLATES))
    content_json = fields.Nested(ResumeContentSchema)
