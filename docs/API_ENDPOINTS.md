# API Endpoint Reference (derived from D1 FR / Attack Surface / Use Case tables)

This list is **derived**, not copied verbatim from the D1 report (D1 didn't specify
exact routes). Treat it as the team's working contract for D2 — update this file as
routes are finalised so it stays the single source of truth for frontend/backend
integration.

## Auth

| Method | Route | FR | SR | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | FR-02, FR-08 | SR-02, SR-05, SR-15 | Creates user + TOTP enrolment (return QR/secret once, never again). |
| POST | `/auth/login` | FR-01 | SR-01, SR-03, SR-04 | Step 1: username+password. Rate-limited 5/15min/IP. |
| POST | `/auth/login/verify-totp` | FR-01, FR-08 | SR-15 | Step 2: TOTP code. Session only established after this succeeds. |
| POST | `/auth/logout` | FR-06 | SR-04, SR-12, SR-13 | Blacklists session token server-side. CSRF token required. |

## Profile

| Method | Route | FR | SR | Notes |
|---|---|---|---|---|
| GET | `/profile` | FR-03 | SR-06, SR-07 | Ownership-scoped to authenticated user. |
| PUT | `/profile` | FR-04 | SR-02, SR-05, SR-07, SR-12 | CSRF token required. |
| DELETE | `/profile` | FR-05 | SR-07, SR-09, SR-12 | CSRF required; triggers PII purge within 24h (SR-09). |
| POST | `/profile/change-password` | FR-07 | SR-01, SR-02, SR-12 | Requires current password + new password meeting policy. |

## Resumes

| Method | Route | FR | SR | Notes |
|---|---|---|---|---|
| POST | `/resumes` | FR-09 | SR-05, SR-06, SR-12 | Server-side schema validation before persist. |
| POST | `/resumes/preview` | FR-09, FR-10 | SR-05, SR-12 | Renders an uncached PDF from a validated unsaved draft; rate-limited 10/min/user and never persisted. |
| GET | `/resumes/{resume_id}` | FR-03-adjacent | SR-06, SR-07 | Ownership check: `resumes.user_id == current_user.id`. |
| PUT | `/resumes/{resume_id}` | FR-09 | SR-05, SR-06, SR-07, SR-12 | Ownership check + CSRF. |
| DELETE | `/resumes/{resume_id}` | — | SR-06, SR-07, SR-12 | Ownership check + CSRF. |
| GET | `/resumes/{resume_id}/export` | FR-10 | SR-05 | Rate-limited 10/min/user. Mitigates R-06 DoS. |
| GET | `/templates` | FR-11 | SR-06 | List available (active) templates. |

## Admin

| Method | Route | FR | SR | Notes |
|---|---|---|---|---|
| POST | `/admin/templates` | FR-12 | SR-06, SR-07, SR-12 | RBAC: admin only. |
| PUT | `/admin/templates/{template_id}` | FR-12 | SR-06, SR-07, SR-12 | RBAC: admin only. |
| DELETE | `/admin/templates/{template_id}` | FR-12 | SR-06, SR-07, SR-12 | "Deactivate," not hard delete, unless team decides otherwise. |
| GET | `/admin/users` | FR-13 | SR-06, SR-07 | RBAC: admin only. |
| PUT | `/admin/users/{user_id}/deactivate` | FR-13 | SR-06, SR-07, SR-12 | RBAC: admin only. |
| DELETE | `/admin/users/{user_id}` | FR-13 | SR-06, SR-07, SR-12 | RBAC: admin only; hard delete + PII purge. |
| GET | `/admin/audit-log` | FR-14 | SR-06, SR-07, SR-14 | RBAC: admin only. Filterable by event type, user, date range. Read-only — no PUT/DELETE route exists by design. |

## Cross-cutting (not a route, applies globally)

- Every route above except `/auth/register` and `/auth/login` (step 1, pre-session)
  requires a valid, non-blacklisted JWT.
- Every POST/PUT/DELETE requires CSRF token validation (SR-12) — confirm with team
  whether the JWT-in-HttpOnly-cookie design still needs CSRF tokens (it does, since
  cookies are sent automatically by the browser; a header-based JWT wouldn't need it —
  **this repo uses cookies, so CSRF tokens are required**).
- Every response includes the security headers listed in `SECURITY_REQUIREMENTS.md`
  (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) — implement as
  Flask `after_request` middleware once, not per-route.
- Every route that touches auth, authz failure, or account state logs to `audit_log`
  per SR-10.
