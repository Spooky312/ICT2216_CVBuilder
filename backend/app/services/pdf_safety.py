from __future__ import annotations

from typing import Any

from markupsafe import escape


def escape_pdf_context(value: Any) -> Any:
    if isinstance(value, str):
        return escape(value)
    if isinstance(value, dict):
        return {key: escape_pdf_context(item) for key, item in value.items()}
    if isinstance(value, list):
        return [escape_pdf_context(item) for item in value]
    if isinstance(value, tuple):
        return tuple(escape_pdf_context(item) for item in value)
    return value
