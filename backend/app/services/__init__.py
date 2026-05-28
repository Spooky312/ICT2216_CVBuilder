# Intentionally empty: each service module is imported directly by the code
# that needs it (e.g. `from app.services.pdf_service import generate_pdf`).
# A package-level re-export here would eagerly load pdf_service and pull in
# its third-party dependencies (weasyprint, jinja2) on every app startup path,
# even in test contexts that never generate PDFs.  Keeping this file empty
# prevents that unnecessary coupling.

__all__: list[str] = []
