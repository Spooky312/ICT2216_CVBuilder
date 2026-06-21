# TASKS.md — Deliverable 2 Implementation Checklist

**Deadline: Thursday, 9 July 2026, 9:00 AM.** Report (≤30 pages excl. appendices) +
source code repo (will be cloned for grading) + Peer Appraisal II.

Read `CLAUDE.md` and the relevant files in `docs/` before starting. Tasks are listed in
the order they should be built — each phase mostly depends on the one before it, so
work through them top to bottom rather than jumping around. Check items off as they're
done; this file is the running source of truth for what's left.

---

## Known bugs blocking CI green — fix these first

These are the only things currently keeping `ci.yml`/`sonarqube.yml` red. Fix in this
order (top one was blocking everything below it, now fixed):

- [x] `AuditLog.log_id` was `BigInteger` — SQLite doesn't auto-increment `BIGINT`
      primary keys, so every audit-logged request crashed with `NOT NULL constraint
      failed`. Fixed → `Integer`, in both the model and the initial migration.
- [ ] **No TOTP/2FA exists at all** — no `pyotp`, no secret field on `User`, no
      verify-totp route. This isn't just a test failure, it's a missing hard
      requirement (`CLAUDE.md`: "session established only after password + TOTP both
      succeed", SR-15). `auth.py`'s `login()` issues a JWT on password alone.
- [ ] `POST /auth/register` hardcodes `email_verified=True` — the 403 unverified-login
      gate in `login()` can never trigger. `test_login_unverified` fails (expects 403,
      gets 200). Stub left in place since no email-sending exists yet (`MAIL_*` env
      vars are unused).
- [ ] `test_account_lockout` fails: `TypeError: can't compare...` — datetime
      comparison bug in `user.is_locked()` (naive vs. tz-aware `datetime`, probably).
- [ ] All `test_resumes.py` tests fail with `401` — login "succeeds" (200) in the test
      client but the JWT cookie isn't authenticating the next request. Check cookie
      persistence in the Flask test client, or a mismatch in how `_login()` sets up
      auth vs. what the resume routes check.
- [ ] `codeql.yml` separately fails with "Code scanning is not enabled for this
      repository" — repo Settings → Code security, may need GitHub Advanced Security
      (not guaranteed on a private student repo, confirm before citing as D2 evidence).

---

## Phase 0 — Infrastructure foundation

- [x] Docker Compose: Nginx + Flask + Postgres + Redis, internal-only networking —
      confirmed working locally and on a real EC2 instance
- [ ] Nginx TLS cert — config supports auto-detect HTTP/HTTPS, but no cert generated on
      EC2 yet (self-signed is fine per `ARCHITECTURE.md`); running `FLASK_ENV=development`
      over plain HTTP for now
- [x] Repo structure decided and documented
- [x] GitHub Actions CI: `ci.yml`, `codeql.yml`, `python-static-analysis.yml`,
      `sonarqube.yml` exist, trigger on push/PR to `main`/`master`/`dev` — not all green,
      see bugs above
- [x] Flask `after_request` security headers — CSP, X-Frame-Options,
      X-Content-Type-Options, Referrer-Policy, HSTS (when `JWT_COOKIE_SECURE`) all
      present in `app/__init__.py`
- [x] CSRF protection — implemented via `flask-jwt-extended`'s built-in double-submit
      cookie CSRF (`JWT_COOKIE_CSRF_PROTECT=True`), not Flask-WTF — equally valid, just
      note which mechanism for the D2 report
- [x] Flask-Limiter global setup (`app/extensions.py`), applied per-route
- [x] Audit logging helper (`log_event` in `app/utils/audit.py`) — every auth/profile
      route already calls it
- [ ] EC2 deployment pipeline: `deploy.yml` exists, EC2-side secrets + GitHub Actions
      secrets are configured — but `deploy.yml` only exists on the `setup` branch, so
      its `push: [main]` trigger won't fire until `setup` → `dev` → `main` is merged.
      Switch `FLASK_ENV` back to `production` and add the TLS cert before treating any
      future deploy as real rather than a manual test (see `EC2_TEST_NOTES.md`)
- [ ] Tests: smoke test for stack boot + `/health`; test asserting security headers are
      present on a sample response

## Phase 1 — Database schema

- [x] SQLAlchemy models: `User`, `Resume`, `AuditLog` exist and match
      `docs/DATABASE_SCHEMA.md`. **Note:** "templates" is not a DB table — it's a
      hardcoded allow-list (`ALLOWED_TEMPLATES`/`TEMPLATE_METADATA` in
      `resume_schema.py`), which is intentional (matches the Phase 4 anti-tampering
      allow-list requirement), just not literally a `templates` model
- [x] Alembic migrations set up and apply cleanly (`37c8ca2810c5`, `59a547ee0d05`)
- [ ] Resolve the two open schema questions: (1) `is_active`-style columns for
      FR-12/FR-13 deactivate behaviour — `User.locked_until` covers lock/unlock, confirm
      this satisfies the requirement or if a separate flag is still needed; (2) RDS vs.
      Docker-Postgres labelling
- [ ] Tests: model/constraint tests, migration upgrade/downgrade tests

## Phase 2 — Authentication & session management
**Covers:** FR-01, FR-02, FR-06, FR-07, FR-08 | SR-01, SR-02, SR-03, SR-04, SR-13, SR-15

- [x] `POST /auth/register` — bcrypt (cost 12 via `BCRYPT_LOG_ROUNDS`), password
      complexity validated via schema
- [ ] **TOTP enrolment/verification — not built at all.** See bug list above. This is
      the single biggest gap between what's documented as required and what exists.
- [x] `POST /auth/login` — password check, lockout check, issues JWT — **but no TOTP
      step**, so this only partially satisfies FR-01/FR-08 until TOTP exists
- [x] JWT issuance: HS256 (flask-jwt-extended default), HttpOnly/Secure/SameSite=Strict
      cookies (`config.py`)
- [x] Session timeout: 30 min access token, 24h refresh token (`config.py`)
- [ ] `POST /auth/logout` exists but only calls `unset_jwt_cookies` — **no server-side
      token blacklist**, so a captured token remains valid until natural expiry even
      after logout (SR-13 not fully satisfied)
- [x] Password change — implemented, but inline in `PUT /profile` (checks
      `current_password`, sets new one) rather than a dedicated
      `/profile/change-password` endpoint. Functionally equivalent, different shape
      than originally scoped
- [x] Rate limiting on `/auth/login` — 5 per 15 minutes, keyed by email
- [ ] Unit tests: registration, login, password policy, session expiry (currently
      blocked by the bugs above)
- [ ] Comment all of the above with the SR ID it satisfies

## Phase 3 — Profile & resume CRUD
**Covers:** FR-03, FR-04, FR-05, FR-09, FR-11 | SR-05, SR-06, SR-07, SR-09

- [x] `GET/PUT/DELETE /profile` — ownership via authenticated user ID
- [x] `DELETE /profile` — cascading delete confirmed (`Resume.user_id` FK has
      `ondelete="CASCADE"`), satisfies SR-09's purge requirement synchronously, no
      background job needed
- [x] `GET/POST/PUT/DELETE /resumes/{id}` plus `/duplicate`, `/export`, `/limits`,
      `/templates` — all implemented with ownership checks
- [x] `content_json` shape settled (personal_info, education, experience, projects,
      skills — see `tests/test_resumes.py` for the agreed contract)
- [x] `GET /resumes/templates` — lists active templates (FR-11)
- [ ] Unit/integration tests: CRUD happy paths, IDOR rejection, schema validation
      (currently blocked by the session/auth bug above)
- [ ] Comment all of the above with the SR ID it satisfies

## Phase 4 — PDF export & templates
**Covers:** FR-10, FR-11 (template rendering side) | SR-05 (SSTI prevention specifically)

- [x] WeasyPrint integration (`app/services/pdf_service.py`)
- [x] Jinja2 templates with `autoescape=True` via `select_autoescape`
- [x] Server-side template ID validation against `ALLOWED_TEMPLATES` allow-list
- [x] `GET /resumes/{id}/export` rate limited — **but currently `20 per hour`, not the
      documented `10/min/user`** — confirm which limit is actually intended and fix the
      mismatch
- [ ] Basic load/performance check against NFR-01 (PDF within 5s/95th percentile) — no
      evidence this has been done yet
- [ ] Tests: malicious payloads in resume fields (script tags, `{{7*7}}`, oversized
      input) asserting neutralisation
- [ ] Comment all of the above with the SR ID it satisfies

## Phase 5 — Admin module & RBAC
**Covers:** FR-12 (admin side), FR-13, FR-14 | SR-06, SR-07, SR-10, SR-14

- [x] RBAC decorator (`admin_required` in `admin.py`) — does a live DB role lookup per
      request, not just a JWT claim, so a demoted admin loses access immediately
- [x] `GET /admin/users`, `POST /admin/users/{id}/lock`, `.../unlock` — covers FR-13
      deactivate behaviour, implemented as lock/unlock rather than generic PUT/DELETE
      (reasonable, just a different shape than originally scoped)
- [x] `GET /admin/templates`, `PUT /admin/templates/{id}` — no POST/DELETE, which makes
      sense since templates are a fixed allow-list, not a dynamic table
- [x] `GET /admin/audit-log` — confirmed read-only, no write/delete route exists (SR-14)
- [ ] Tests: non-admin gets 403 on admin routes, privilege escalation blocked
- [ ] Comment all of the above with the SR ID it satisfies

## Phase 6 — Frontend (React)

More complete than previously tracked — confirmed present: `Register.js`, `Login.js`,
full `ResumeWizard` (`PersonalInfo`, `Education`, `Experience`, `Skills`, `Projects`,
`TemplateSelect` steps), `Profile.js`, `AdminPanel.js`, `Dashboard.js`, `AuthContext`,
`ProtectedRoute`.

- [x] Registration + login UI — **no TOTP step in the UI either**, consistent with the
      backend gap above; will need a QR/TOTP-entry step once Phase 2's TOTP work lands
- [x] Profile view/edit/delete UI
- [x] Resume creation wizard — all steps present, matches Phase 3's `content_json` shape
- [x] Template selection + export/download UI
- [x] Admin UI shell (`AdminPanel.js`) — users, templates, audit log
- [x] CSRF token handling present (`services/api.js`)
- [x] Confirmed no `localStorage`/`sessionStorage` usage anywhere in `frontend/src` —
      JWT relies purely on the HttpOnly cookie, as required
- [ ] Tests: no frontend test runner configured yet (Jest/RTL removed with CRA) —
      Vitest + React Testing Library still needed

## Phase 7 — Dependency scanning & CI hardening
**Covers:** SR-11, NFR-10

- [ ] OWASP Dependency-Check step in GitHub Actions
- [x] SonarQube workflow exists (`sonarqube.yml`) — currently blocked from actually
      scanning because the pytest step it runs first fails (same bugs as above)
- [ ] Publish dependency-check results as a build artefact
- [ ] Full dependency list documented

## Phase 8 — Test automation pass

- [x] Project-wide pytest suite wired into CI, runs on every PR
- [ ] Fill coverage gaps once the bugs above are fixed
- [ ] Collect "findings worth sharing" — the audit_log `BigInteger`/SQLite
      cross-database bug is a strong candidate, already a good example of CI catching
      a real bug

## Phase 9 — Report assembly

The D2 report itself (≤30 pages) needs:
1. CI/CD process description + tools used
2. Directory/file organisation of the source code
3. UML diagrams of code structure (class diagram for DB models, package diagram for
   module layout, sequence diagram for login/2FA flow, sequence diagram for PDF export
   flow)
4. Code snippet evidence of OWASP best practices, **cited by file name**
5. Dependency list + dependency-check evidence
6. Automated testing evidence + findings

Start assembling 3-4 days before the deadline.

## Suggested timeline (3.5 weeks from D1 deadline to D2 deadline)

| Week | Focus |
|---|---|
| 1 | Phase 0 (infra) → Phase 1 (schema) → Phase 2 (auth) started |
| 2 | Phase 2 finished — **including the missing TOTP work** — Phase 3 (CRUD), Phase 4 (PDF export) started, Phase 6 (frontend) started |
| 3 | Phase 4 finished, Phase 5 (admin), Phase 7 (dependency scanning), Phase 8 (test coverage gaps) |
| 3.5 (final days) | Phase 9 (report assembly), UML diagrams finalised, full CI green, peer appraisal prep |
