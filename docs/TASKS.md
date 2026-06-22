# TASKS.md — Deliverable 2 Implementation Checklist

**Deadline: Thursday, 9 July 2026, 9:00 AM.** Report (≤30 pages excl. appendices) +
source code repo (will be cloned for grading) + Peer Appraisal II.

Last reviewed against the repo on **23 June 2026**. This file is the running source of
truth for what is done and what remains.

Read `CLAUDE.md` and the relevant files in `docs/` before starting. Tasks are listed in
the order they should be built. Check items off as they are done.

---

## Current verification notes

- [x] `AuditLog.log_id` SQLite auto-increment bug fixed by using `Integer` in the model
      and migration.
- [x] TOTP/2FA is now implemented: registration returns a one-time setup secret/URI,
      `/auth/login` creates a challenge, and `/auth/verify-2fa` issues JWT cookies only
      after a valid TOTP code.
- [x] Email verification gate has been removed from the implementation; login no longer
      depends on an unimplemented email-sending path.
- [x] Account lockout datetime comparison handles naive DB datetimes by normalising to
      UTC in `User.is_locked()`.
- [x] Resume route tests were updated for the two-step TOTP login flow.
- [x] Logout now records access/refresh JWTs in a server-side revocation table.
- [x] Docker verification passed on branch `hotfix/CI-Eslint-Error`: frontend CI ESLint
      command, Vite build, and backend pytest suite.
- [ ] CI workflow evidence still needs to be captured from GitHub before citing the
      whole suite as green in the D2 report.
- [ ] `codeql.yml` may still fail if GitHub code scanning is not enabled for the repo;
      confirm in repository settings before citing CodeQL as D2 evidence.

---

## Phase 0 — Infrastructure foundation

- [x] Docker Compose: Nginx + Flask + Postgres + Redis, internal-only networking —
      confirmed previously working locally and on EC2.
- [x] Repo structure decided and documented.
- [x] GitHub Actions CI exists: `ci.yml`, `codeql.yml`, `static-analysis.yml`,
      `sonarqube.yml`, `dependency-check.yml`, and `deploy.yml`.
- [x] Flask `after_request` security headers are present in `app/__init__.py`: CSP,
      X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and HSTS when secure
      cookies are enabled.
- [x] CSRF protection implemented through `flask-jwt-extended` double-submit cookie CSRF
      (`JWT_COOKIE_CSRF_PROTECT=True`).
- [x] Flask-Limiter global setup exists in `app/extensions.py` and is applied to auth
      and PDF preview/export routes.
- [x] Audit logging helper exists (`log_event` in `app/utils/audit.py`) and auth,
      profile, resume, and admin routes call it for important state changes.
- [x] EC2 preparation is done enough for now: secrets are set up and a barebones copy of
      this code has been cloned. **Do not spend more time on EC2 deployment yet.**
- [ ] Before any real deployment: generate/install the Nginx TLS cert on EC2, switch
      `FLASK_ENV` back to production, and verify HTTPS/HSTS end to end.
- [ ] Tests: add/confirm a stack boot smoke test for `/health` and a test asserting all
      required security headers are present on a sample response. Current tests only
      assert the CSP PDF frame policy.

## Phase 1 — Dependency scanning & CI hardening
**Covers:** SR-11, NFR-10

- [x] OWASP Dependency-Check workflow exists in `.github/workflows/dependency-check.yml`.
      It scans the full repo on push/PR/workflow dispatch and fails on CVSS ≥ 7.
- [x] Dependency-Check reports are uploaded as a GitHub Actions artifact.
- [x] Dependency-Check SARIF upload is configured when a SARIF report exists.
- [x] SonarQube workflow exists (`sonarqube.yml`).
- [x] Static analysis workflow exists (`static-analysis.yml`) and includes backend and
      frontend checks, including `npm audit`.
- [x] React ESLint failure fixed and verified with the same CI command:
      `npx eslint "src/**/*.{js,jsx}" --max-warnings=0 -o reports/eslint-report.txt`.
- [ ] Capture successful CI run links/screenshots for D2 evidence once dependencies are
      installed in CI and the workflows are green.
- [ ] Full dependency list documented in the D2 report using `backend/requirements.txt`
      and `frontend/package.json` / `package-lock.json`.

## Phase 2 — Database schema

- [x] SQLAlchemy models exist for `User`, `Resume`, `AuditLog`, `RevokedToken`, and
      `ResumeTemplate`.
- [x] Alembic migrations exist for initial schema, TOTP fields, token revocation,
      active/deactivated users, persistent templates, uploaded template content, and
      email verification removal.
- [x] Lock/unlock implementation has effectively chosen `locked_until TIMESTAMPTZ`
      plus `is_active` over the original D1 `account_locked BOOLEAN`.
- [x] Templates are now persisted in `resume_templates` rather than only being a
      hardcoded allow-list.
- [ ] Update `docs/DATABASE_SCHEMA.md` for D2: it still reflects the older D1 schema
      (`username`, `enc_totp_key`, `account_locked`, old `templates` table, no
      `revoked_tokens`, no `resume_templates` upload fields).
- [ ] Resolve RDS vs. Docker-Postgres labelling in the D2 report.
- [ ] Tests: add model/constraint tests and migration upgrade/downgrade tests.

## Phase 3 — Authentication & session management
**Covers:** FR-01, FR-02, FR-06, FR-07, FR-08 | SR-01, SR-02, SR-03, SR-04, SR-13, SR-15

- [x] `POST /auth/register` — bcrypt password hashing, password complexity validation,
      encrypted TOTP secret generation, one-time setup secret/URI returned.
- [x] TOTP enrolment and verification implemented with `pyotp` helpers and encrypted
      TOTP secret storage.
- [x] `POST /auth/login` — password check, lockout check, active-user check, and
      two-factor challenge creation. It no longer issues a JWT after password alone.
- [x] `POST /auth/verify-2fa` — verifies challenge token and TOTP code before issuing
      access and refresh JWT cookies.
- [x] JWT issuance: HS256 default, HttpOnly/Secure/SameSite=Strict cookies configured
      in `config.py`.
- [x] Session timeout: 30 min access token, 24h refresh token (`config.py`).
- [x] `POST /auth/logout` revokes access and refresh tokens server-side and unsets JWT
      cookies.
- [x] Password change is implemented inline in `PUT /profile` using `current_password`
      and `new_password`.
- [x] Rate limiting on `/auth/login` — 5 per 15 minutes, keyed by email.
- [x] Backend tests cover registration, duplicate email, weak password rejection,
      password + TOTP login, bad TOTP rejection, wrong password, nonexistent user,
      logout revocation, and account lockout.
- [ ] Add a session-expiry test.
- [ ] Comment or trace auth controls to the SR IDs for report evidence.

## Phase 4 — Profile & resume CRUD
**Covers:** FR-03, FR-04, FR-05, FR-09, FR-11 | SR-05, SR-06, SR-07, SR-09

- [x] `GET/PUT/DELETE /profile` — ownership via authenticated user ID.
- [x] `DELETE /profile` deletes the user and cascades owned resumes through
      `Resume.user_id` `ON DELETE CASCADE`.
- [x] `GET/POST/PUT/DELETE /resumes/{id}` plus `/duplicate`, `/export`, `/limits`,
      `/templates`, and `/preview` are implemented with ownership checks.
- [x] `content_json` shape is settled: personal info, education, experience, projects,
      and skills.
- [x] `GET /resumes/templates` lists active templates (FR-11).
- [x] `content_json` uses Marshmallow whitelist schemas. Input is trimmed, blank
      optional values are omitted, dates are validated, and unsafe URLs are rejected.
- [x] Schema tests cover blank optional values, normalisation, invalid months,
      chronological date order, whitespace-only required fields, and URL handling.
- [x] Resume route tests cover create/list/get/update/delete/duplicate, invalid
      template rejection, unauthenticated access, preview validation, and preview
      failure handling.
- [ ] Add explicit IDOR tests proving user A cannot read/update/delete user B's resume.
- [ ] Comment or trace profile/resume controls to the SR IDs for report evidence.

## Phase 5 — PDF export & templates
**Covers:** FR-10, FR-11 (template rendering side) | SR-05 (SSTI prevention specifically)

- [x] WeasyPrint integration exists in `app/services/pdf_service.py`.
- [x] Jinja2 rendering uses sandboxed/controlled rendering through the PDF service.
- [x] Server-side template ID validation rejects unknown or inactive templates.
- [x] Authenticated `POST /resumes/preview` renders validated, unsaved drafts through
      the same pipeline as saved export, is uncached, rate-limited, and does not persist
      or audit-log draft content.
- [x] Uploaded HTML template support exists with extension, size, UTF-8, placeholder,
      script, and external-resource validation.
- [x] Tests cover shared saved/preview PDF rendering, uploaded template rendering, unsafe
      uploaded template rejection, and inactive template rejection.
- [ ] Fix `GET /resumes/{id}/export` rate limit — currently `20 per hour`; docs say
      `10 per minute per authenticated user`.
- [ ] Run a basic load/performance check against NFR-01 (PDF within 5s/95th percentile
      under 100 concurrent users) and record the result.
- [ ] Add tests for malicious resume field payloads such as script tags, `{{7*7}}`, and
      oversized input.
- [ ] Comment or trace PDF/template controls to the SR IDs for report evidence.

## Phase 6 — Admin module & RBAC
**Covers:** FR-12, FR-13, FR-14 | SR-06, SR-07, SR-10, SR-14

- [x] RBAC decorator (`admin_required` in `admin.py`) does a live DB role and
      active-user lookup per request.
- [x] `GET /admin/users`, `POST /admin/users/{id}/lock`, `.../unlock`,
      `.../deactivate`, and `DELETE /admin/users/{id}` are implemented.
- [x] Admin permanent account deletion exists and cascades owned resumes.
- [x] `GET /admin/templates`, `POST /admin/templates`, `POST /admin/templates/upload`,
      and `PUT /admin/templates/{id}` are implemented.
- [x] Template deactivation is implemented through `PUT /admin/templates/{id}` with
      `active: false`.
- [x] `GET /admin/audit-log` supports filtering by event type, user, and date range.
- [x] Audit logs are read-only at the route layer; no write/delete admin audit route
      exists.
- [x] Tests cover non-admin 403, deactivated user token blocking, admin self-protection,
      permanent user deletion, audit-log filtering/validation, template creation,
      upload, unsafe upload rejection, and deactivated templates.
- [ ] Add a test confirming 90-day audit log retention is actually enforced (SR-10 /
      NFR-06), or document that retention is operational rather than app-enforced.
- [ ] Comment or trace admin controls to the SR IDs for report evidence.

## Phase 7 — Frontend (React)

- [x] Vite React app builds are configured through `frontend/package.json`.
- [x] Registration UI exists and shows the TOTP setup key/URI after account creation.
- [x] Login UI supports the two-step password then authenticator-code flow.
- [x] Profile view/edit/delete UI exists.
- [x] Resume creation wizard exists with personal info, education, experience, projects,
      skills, and template selection steps.
- [x] Resume wizard validates each step before continuing and shows field-level errors;
      server validation remains authoritative.
- [x] Resume wizard has template selection and PDF preview behaviour.
- [x] Template selection and export/download UI exists.
- [x] Admin UI shell exists (`AdminPanel.js`) with users, templates, and audit log.
- [x] CSRF token handling exists in `services/api.js`.
- [x] No `localStorage`/`sessionStorage` usage was found in `frontend/src`; JWT auth
      relies on HttpOnly cookies.
- [x] Frontend ESLint and Vite production build verified in Docker after the CI lint
      hotfix.
- [ ] Frontend test runner is still not configured. Add Vitest + React Testing Library
      if frontend tests are needed for D2 evidence.

## Phase 8 — Test automation pass

- [x] Project-wide backend pytest suite is wired into CI.
- [x] CI frontend build is wired into `ci.yml`.
- [x] Backend tests now cover the major auth, resume, PDF, and admin flows.
- [x] Frontend Docker verification passed: ESLint static-analysis command and
      `npm run build`.
- [x] Backend Docker verification passed: `pytest tests` reports 59 passing tests.
- [ ] Capture GitHub Actions run evidence before declaring the hosted CI suite green in
      the D2 report.
- [ ] Fill remaining coverage gaps: session expiry, IDOR, migration tests, full security
      header coverage, export rate-limit assertion, malicious resume PDF payloads, and
      audit retention.
- [ ] Collect "findings worth sharing" for the report. The `audit_log` `BigInteger` /
      SQLite auto-increment bug is still a strong example of CI catching a real
      cross-database issue.

## Phase 9 — Report assembly

The D2 report itself (≤30 pages) needs:

1. CI/CD process description + tools used.
2. Directory/file organisation of the source code.
3. UML diagrams of code structure: DB model class diagram, package/module diagram,
   login/2FA sequence diagram, PDF export sequence diagram.
4. Code snippet evidence of OWASP best practices, cited by file name.
5. Dependency list + dependency-check evidence.
6. Automated testing evidence + findings.
7. Write up each D1→D2 divergence as a documented decision: `log_id` type change,
   `locked_until`/`is_active` instead of `account_locked`, CSRF mechanism, persisted
   `resume_templates`, uploaded template scope, token revocation table, email
   verification removal, and export rate-limit value.

Start assembling 3-4 days before the deadline.

## Suggested remaining focus

| Priority | Focus |
|---|---|
| 1 | Get Docker/CI verification green and capture evidence. |
| 2 | Update `docs/DATABASE_SCHEMA.md` and report traceability to match the current implementation. |
| 3 | Fill targeted test gaps: IDOR, session expiry, headers, migrations, audit retention, malicious PDF payloads. |
| 4 | Fix/export-rate-limit mismatch or document the final chosen value. |
| 5 | Leave EC2 deployment alone until the team is ready to deploy for real. |
