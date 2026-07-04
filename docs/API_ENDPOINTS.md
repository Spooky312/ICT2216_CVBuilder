# API Endpoint Reference

Reflects the actual Flask routes in `backend/app/routes/`, not the D1-era route sketch.
All routes below sit under `/api`, except `/health`. Update this file in the same change
whenever a route is added, removed, or its auth/rate-limit behaviour changes.

## Health

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | Liveness check, returns `{"status": "ok"}`. |

## Auth (`/api/auth`)

| Method | Route | FR | SR | Rate limit | Notes |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | FR-02 | SR-02, SR-05 | 10 / hour | Creates the user. TOTP enrolment is deferred to first login, not done here. |
| GET | `/api/auth/captcha` | — | SR-03 | 30 / 15 min | Issues a signed, time-limited arithmetic CAPTCHA challenge; the answer is sealed in the token, never returned in the clear. |
| POST | `/api/auth/login` | FR-01 | SR-01, SR-03, SR-04 | 5 / 15 min, keyed by submitted email | Step 1: email + password (+ CAPTCHA once `failed_logins >= 3`). Returns a 2FA challenge token on success, never a session. |
| POST | `/api/auth/verify-2fa` | FR-01, FR-08 | SR-15 | 10 / 15 min | Step 2: TOTP code against the challenge token from `/login`. Session (JWT cookies) is only issued after this succeeds. On a user's first-ever verification, also completes TOTP enrolment. |
| POST | `/api/auth/refresh` | FR-01 | SR-04 | default (200/day, 50/hour) | Issues a new access token from a valid, non-revoked refresh token; re-checks the account is still active. |
| POST | `/api/auth/logout` | FR-06 | SR-04, SR-13 | default | Revokes both the access and refresh token's JTI via the server-side blocklist; CSRF token required. |

## Profile (`/api/profile`)

| Method | Route | FR | SR | Rate limit | Notes |
|---|---|---|---|---|---|
| GET | `/api/profile` | FR-03 | SR-06, SR-07 | default | Returns the authenticated user's own profile. |
| PUT | `/api/profile` | FR-04, FR-07 | SR-02, SR-05, SR-07, SR-12 | default | Updates `full_name` and/or password (requires `current_password` to change it). CSRF required. |
| DELETE | `/api/profile` | FR-05 | SR-07, SR-09, SR-12 | default | Permanently, synchronously deletes the user and cascades to their resumes. CSRF required. |

## Resumes (`/api/resumes`)

| Method | Route | FR | SR | Rate limit | Notes |
|---|---|---|---|---|---|
| GET | `/api/resumes/limits` | — | SR-07 | default | Returns the per-user resume cap (10). |
| GET | `/api/resumes/templates` | FR-11 | SR-06 | default | Lists **active** templates only. |
| GET | `/api/resumes` | FR-03-adjacent | SR-06, SR-07 | default | Lists the authenticated user's own resumes, newest first. |
| POST | `/api/resumes` | FR-09 | SR-05, SR-06, SR-12 | default | Creates a resume; server-side schema validation; enforces the 10-resume cap; validates `template_id` is active. |
| POST | `/api/resumes/preview` | FR-09, FR-10 | SR-05, SR-12 | 10 / min / user | Renders an uncached PDF from a validated, unsaved draft — never persisted. |
| GET | `/api/resumes/{resume_id}` | FR-03-adjacent | SR-06, SR-07 | default | Ownership check: `resumes.user_id == current_user.id`. |
| PUT | `/api/resumes/{resume_id}` | FR-09 | SR-05, SR-06, SR-07, SR-12 | default | Ownership check + CSRF; re-validates `template_id` if changed. |
| DELETE | `/api/resumes/{resume_id}` | — | SR-06, SR-07, SR-12 | default | Ownership check + CSRF. |
| POST | `/api/resumes/{resume_id}/duplicate` | — | SR-06, SR-07, SR-12 | default | Clones title/template/content; enforces the 10-resume cap. |
| GET | `/api/resumes/{resume_id}/export` | FR-10 | SR-05 | 10 / min / user | Exports the saved resume as a PDF. Mitigates R-06 DoS. |

## Admin (`/api/admin`)

Every route below requires an authenticated, active user whose role is `admin`,
re-checked against the database on every request (`admin_required` decorator) — not just
at token issuance.

| Method | Route | FR | SR | Notes |
|---|---|---|---|---|
| GET | `/api/admin/users` | FR-13 | SR-06, SR-07 | Paginated (default 20, max 100 per page). |
| POST | `/api/admin/users/{user_id}/lock` | FR-13 | SR-06, SR-07, SR-12 | Temporary lock, 1–10080 minutes (default 60). Admin cannot lock their own account. |
| POST | `/api/admin/users/{user_id}/unlock` | FR-13 | SR-06, SR-07, SR-12 | Clears `locked_until` and resets `failed_logins`. |
| POST | `/api/admin/users/{user_id}/deactivate` | FR-13 | SR-06, SR-07, SR-12 | Sets `is_active=false`; also clears lock state. Admin cannot deactivate their own account. |
| DELETE | `/api/admin/users/{user_id}` | FR-13 | SR-06, SR-07, SR-12 | Permanent, synchronous delete + cascade. Admin cannot delete their own account. |
| GET | `/api/admin/audit-log` | FR-14 | SR-06, SR-07, SR-14 | Paginated (default 50, max 200). Filterable by `event_type`, `user_id`, `date_from`/`date_to`. |
| DELETE | `/api/admin/audit-log/cleanup` | FR-14 | SR-10, SR-14 | Bulk-purges entries older than `days` (default 90). Rejects `days < 90` with 403. The purge itself is audit-logged. |
| GET | `/api/admin/templates` | FR-12 | SR-06, SR-07 | Lists **all** templates, active and inactive. |
| POST | `/api/admin/templates` | FR-12 | SR-06, SR-07, SR-12 | Creates a new template cloned from a built-in layout (`modern`/`classic`/`minimal`). |
| POST | `/api/admin/templates/upload` | FR-12 | SR-05, SR-06, SR-07, SR-12 | Uploads a custom HTML template (≤100KB, `.html`/`.htm` only); HTML is sanitised against a tag/attribute allow-list before storage. |
| PUT | `/api/admin/templates/{template_id}` | FR-12 | SR-06, SR-07, SR-12 | Updates name/description/source layout, or deactivates by setting `active: false`. |
| DELETE | `/api/admin/templates/{template_id}` | FR-12 | SR-06, SR-07, SR-12 | Deletes a template — rejected for built-in templates (403) and for any custom template still referenced by a resume (409). |

## Cross-cutting (not a route, applies globally)

- Every route above except `/health`, `/api/auth/register`, `/api/auth/login`,
  `/api/auth/verify-2fa`, and `/api/auth/captcha` (all pre-session) requires a valid,
  non-revoked JWT.
- Every POST/PUT/DELETE requires CSRF token validation (SR-12) via flask-jwt-extended's
  built-in double-submit cookie mechanism (`JWT_COOKIE_CSRF_PROTECT=True`, header name
  `X-CSRF-TOKEN`) — this repo uses cookie-based JWTs, so CSRF tokens are required.
- Every response includes the security headers listed in `SECURITY_REQUIREMENTS.md`
  (HSTS when the cookie is Secure, CSP, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy), applied once via a Flask `after_request` hook.
- Every route that touches auth, authorization failure, or account/admin state logs to
  `audit_log` per SR-10.
