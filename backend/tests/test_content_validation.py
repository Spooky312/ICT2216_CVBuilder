"""Unit tests for resume content validation and uploaded-template safety.

Covers the resume schema's input normalisation and URL/date validators, and the
uploaded-template validator that enforces Jinja placeholders and non-empty bodies.
"""
import pytest
from marshmallow import ValidationError

from app.schemas.resume_schema import (
    WEB_ADDRESS_ERROR,
    _normalise_value,
    _validate_partial_date,
    normalise_web_url,
)
from app.services.template_service import validate_uploaded_template


# --------------------------------------------------------------------------- #
# resume_schema normalisation and date validation                            #
# --------------------------------------------------------------------------- #
def test_normalise_value_strips_empty_from_nested_containers():
    normalised = _normalise_value(
        {"keep": " value ", "drop": "   ", "list": ["a", "  ", "b"]}
    )
    assert normalised == {"keep": "value", "list": ["a", "b"]}


def test_validate_partial_date_rejects_bad_month():
    with pytest.raises(ValidationError):
        _validate_partial_date("2020-13")


def test_validate_partial_date_allows_present_only_when_permitted():
    # No exception when Present is permitted.
    _validate_partial_date("Present", allow_present=True)
    with pytest.raises(ValidationError):
        _validate_partial_date("Present", allow_present=False)


# --------------------------------------------------------------------------- #
# resume_schema.normalise_web_url                                             #
# --------------------------------------------------------------------------- #
def test_normalise_web_url_adds_https_to_bare_domain():
    assert normalise_web_url("example.com") == "https://example.com"
    assert normalise_web_url("//example.com") == "https://example.com"


def test_normalise_web_url_preserves_valid_scheme():
    assert normalise_web_url("http://example.com") == "http://example.com"


@pytest.mark.parametrize(
    "value",
    [
        "ftp://example.com",              # disallowed scheme
        "https://user:pass@example.com",  # embedded credentials
        "https://" + ("a" * 64) + ".com",  # label longer than 63 chars
        "https://singlelabel",            # missing TLD
        "has space.com",                  # ambiguous whitespace
    ],
)
def test_normalise_web_url_rejects_unsafe_inputs(value):
    with pytest.raises(ValidationError):
        normalise_web_url(value)


def test_normalise_web_url_error_message_is_generic():
    try:
        normalise_web_url("singlelabel")
    except ValidationError as exc:
        assert WEB_ADDRESS_ERROR in str(exc.messages)
    else:
        raise AssertionError("Expected ValidationError")


# --------------------------------------------------------------------------- #
# template_service.validate_uploaded_template                                 #
# --------------------------------------------------------------------------- #
def test_uploaded_template_requires_jinja_placeholders():
    _, errors = validate_uploaded_template(
        "resume.html", b"<html><body>No placeholders here</body></html>"
    )
    assert any("Jinja placeholders" in msg for msg in errors["template_file"])


def test_uploaded_template_rejects_empty_body():
    _, errors = validate_uploaded_template("resume.html", b"   ")
    assert any("cannot be empty" in msg for msg in errors["template_file"])
