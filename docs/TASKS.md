# TASKS.md — Deliverable 2 Implementation Checklist

**Deadline: Thursday, 9 July 2026, 9:00 AM.** Report (≤30 pages excl. appendices) +
source code repo (will be cloned for grading) + Peer Appraisal II.

Read `CLAUDE.md` and the relevant files in `docs/` before starting. Tasks are listed in
the order they should be built — each phase mostly depends on the one before it, so
work through them top to bottom rather than jumping around. Check items off as they're
done; this file is the running source of truth for what's left.

---

## Phase 0 — Infrastructure foundation

Everything else sits on top of this, so it goes first.

- [ ] Docker Compose setup: Nginx + Flask + PostgreSQL containers, internal-only
      networking for Flask/Postgres per `docs/ARCHITECTURE.md`
- [ ] Nginx config: TLS termination, HTTP→HTTPS redirect, HSTS header
- [ ] Repo structure decided and documented (needed later for the D2 report's
      "organisation of directory and files" requirement)
- [ ] GitHub Actions CI skeleton: lint/test job runs on every PR
- [ ] Flask `after_request` middleware: CSP, X-Frame-Options, X-Content-Type-Options,
      Referrer-Policy headers on every response (SR-08)
- [ ] CSRF token generation/validation infra (e.g. Flask-WTF CSRF protection or
      equivalent) — every state-changing route built later plugs into this
- [ ] Flask-Limiter global setup (shared config; specific limits applied per-route as
      those routes are built)
- [ ] Audit logging helper: a single `log_event(event_type, user_id, ip, user_agent,
      metadata)` function that writes structured JSON to `audit_log`, with a guard that
      strips/rejects PII or password fields from `metadata` (SR-10) — every later phase
      calls this same helper instead of writing its own logging
- [ ] Tests: smoke test that the Docker Compose stack boots and a `/health` endpoint
      responds; test for the security-headers middleware (asserts CSP/HSTS/X-Frame-Options
      present on a sample response)
- [ ] CI: confirm the GitHub Actions lint/test job skeleton actually runs and passes on a
      trivial commit/PR before building later phases on top of it

## Phase 1 — Database schema

- [ ] SQLAlchemy models for `users`, `resumes`, `templates`, `audit_log` per
      `docs/DATABASE_SCHEMA.md`
- [ ] Alembic migrations set up
- [ ] Resolve the two open schema questions before finalising: (1) add `is_active`-style
      columns needed for FR-12/FR-13 "deactivate" behaviour, (2) confirm the RDS vs.
      Docker-Postgres labelling and the `resumes` primary key question flagged from D1
      review
- [ ] Tests: model tests (constraints, defaults, relationships/cascades) and migration
      tests (upgrade/downgrade run cleanly against a fresh test DB)
- [ ] Update GitHub Actions CI pipeline: add a step that runs `flask db upgrade` against
      a throwaway test DB and runs the Phase 1 model/migration tests on every PR

## Phase 2 — Authentication & session management
**Covers:** FR-01, FR-02, FR-06, FR-07, FR-08 | SR-01, SR-02, SR-03, SR-04, SR-13, SR-15

- [ ] `POST /auth/register` — bcrypt hash (cost ≥12), password complexity check
      (≥12 chars, mixed case, digit, symbol, reject top-10k breach list), TOTP enrolment
      via `pyotp` (generate secret, encrypt with AES-256-GCM before storing, return
      QR/secret to client **once only**)
- [ ] `POST /auth/login` (step 1: username+password) + `POST
      /auth/login/verify-totp` (step 2) — session/JWT only issued after both succeed
      (fixes the FR-01/FR-08 contradiction flagged in D1 review)
- [ ] JWT issuance: HS256, ≥256-bit secret, HttpOnly/Secure/SameSite=Strict cookie
- [ ] Session timeout: 30 min idle, 24h absolute
- [ ] `POST /auth/logout` — server-side token blacklist (SR-13)
- [ ] `POST /profile/change-password` — current password check + new password policy
- [ ] Rate limiting on `/auth/login` (5/15min/IP, HTTP 429 + `Retry-After`), wired into
      Phase 0's Flask-Limiter setup
- [ ] Unit tests: registration validation, login success/failure paths, TOTP
      verification, password policy edge cases, session expiry
- [ ] Update GitHub Actions CI pipeline: add/extend the test step so Phase 2's auth/session
      test module runs on every PR and fails the build on a failing test
- [ ] Comment all of the above with the SR ID it satisfies

## Phase 3 — Profile & resume CRUD
**Covers:** FR-03, FR-04, FR-05, FR-09, FR-11 | SR-05, SR-06, SR-07, SR-09

- [ ] `GET/PUT/DELETE /profile` — ownership enforced via authenticated user ID, not
      client-supplied ID
- [ ] `DELETE /profile` triggers PII purge (cascading delete via FK, satisfies SR-09's
      24h purge requirement — confirm a background job isn't needed vs. synchronous
      cascade)
- [ ] `POST/GET/PUT/DELETE /resumes/{id}` — server-side schema validation
      (Marshmallow/Pydantic) on create/update; ownership check on every read/update/delete
- [ ] Settle the exact `content_json` shape (personal details, education, experience,
      skills, projects) — this contract is needed before PDF templates or frontend forms
      can be built against it
- [ ] `GET /templates` — list active templates for selection (FR-11)
- [ ] Unit/integration tests: CRUD happy paths, ownership-violation rejection (IDOR
      test — try accessing another user's resume_id and assert 403/404), schema
      validation rejection of malformed input
- [ ] Update GitHub Actions CI pipeline: ensure Phase 3's CRUD/IDOR test module is picked
      up by the existing pytest CI step (no new job needed if Phase 2's step already
      globs all test files — just confirm it does)
- [ ] Comment all of the above with the SR ID it satisfies

## Phase 4 — PDF export & templates
**Covers:** FR-10, FR-11 (template rendering side) | SR-05 (SSTI prevention specifically)

- [ ] WeasyPrint integration for PDF generation from `content_json`
- [ ] Jinja2 templates for each resume design — `autoescape=True`, and **manually
      re-confirm escaping** on any field interpolated into the PDF template (this is the
      literal SSTI misuse case from D1's UC-07 diagram — don't skip it)
- [ ] Server-side template ID validation against an allow-list (don't trust a
      client-supplied template path/filename — this is UC-08's misuse case: template ID
      tampering)
- [ ] `GET /resumes/{id}/export` — wire up rate limiting (10/min/user) using Phase 0's
      Flask-Limiter setup
- [ ] Basic load/performance check against NFR-01 (PDF returned within 5s for 95% of
      requests under 100 concurrent users) — at minimum, document a basic test even if
      full 100-concurrent-user testing is deferred to D3
- [ ] Tests: PDF generation with malicious payloads in resume fields (script tags,
      Jinja2 syntax like `{{7*7}}`, oversized input) asserting they're neutralised, not
      executed
- [ ] Update GitHub Actions CI pipeline: confirm WeasyPrint's system dependencies (e.g.
      Pango/Cairo) are installed in the CI runner image/step so Phase 4's PDF tests
      actually run instead of being skipped
- [ ] Comment all of the above with the SR ID it satisfies

## Phase 5 — Admin module & RBAC
**Covers:** FR-12 (admin side), FR-13, FR-14 | SR-06, SR-07, SR-10, SR-14

- [ ] RBAC middleware/decorator: checks `role == 'admin'` on every admin route, not
      just at login — reusable decorator
- [ ] `POST/PUT/DELETE /admin/templates/{id}` — template management for admins
- [ ] `GET/PUT/DELETE /admin/users` — view, deactivate, delete user accounts
- [ ] `GET /admin/audit-log` — filterable by event type, user, date range; **read-only,
      no write/delete route should exist anywhere for this table** (SR-14)
- [ ] Tests: non-admin user attempting admin routes gets 403, not a silent failure or
      data leak; privilege escalation attempt (UC-12 misuse case) is blocked
- [ ] Update GitHub Actions CI pipeline: confirm Phase 5's RBAC/admin test module runs in
      the existing pytest CI step and is included in the coverage report
- [ ] Comment all of the above with the SR ID it satisfies

## Phase 6 — Frontend (React)

Can start as soon as Phase 2/3's API contracts are settled — doesn't need to wait for
Phase 4/5 to be fully done, just their route shapes agreed.

- [ ] Registration + TOTP enrolment flow (display QR code once, never re-fetch it)
- [ ] Login flow (password → TOTP code, two-step UI)
- [ ] Profile view/edit/delete UI
- [ ] Resume creation wizard (personal details → education → experience → skills →
      projects, matching the `content_json` shape from Phase 3)
- [ ] Template selection + export/download UI
- [ ] Admin UI shell (users, templates, audit log) — or explicitly mark out of scope
      for D2 if time-constrained, and document that decision
- [ ] CSRF token handling: fetch token, attach to all state-changing requests
- [ ] Never store JWT in localStorage/sessionStorage — rely on HttpOnly cookie, don't
      try to read the token in JS
- [ ] Basic input validation client-side (UX nicety only — server-side validation from
      Phase 3 is the real control, don't treat client validation as security)
- [ ] Tests: set up a frontend test runner (e.g. Vitest + React Testing Library — current
      stack has none configured since CRA/Jest was removed) and cover the login/TOTP flow,
      resume wizard step validation, and CSRF token attachment on state-changing requests
- [ ] Update GitHub Actions CI pipeline: add a frontend job (`npm ci`, `npm run build`,
      `npm test`) running on every PR, separate from the existing backend pytest job

## Phase 7 — Dependency scanning & CI hardening
**Covers:** SR-11, NFR-10

- [ ] OWASP Dependency-Check step in GitHub Actions, fails build on critical/high CVEs,
      completes in <5 min
- [ ] Optional: SonarQube static analysis step (see `X09__SonarQube.pdf` lab)
- [ ] Publish dependency-check results as a build artefact (needed as report evidence)
- [ ] Full dependency list documented (server-side: Flask, weasyprint, Jinja2,
      SQLAlchemy; client-side: React + sub-packages)

## Phase 8 — Test automation pass

- [ ] Project-wide pytest suite wired into CI, runs on every PR, with a coverage report
- [ ] Fill any coverage gaps left from Phases 2-5's per-feature tests
- [ ] Collect "findings worth sharing" from automated testing (bugs caught, surprising
      edge cases) — needed for the D2 report's reflection section

## Phase 9 — Report assembly

The D2 report itself (≤30 pages) needs:
1. CI/CD process description + tools used
2. Directory/file organisation of the source code
3. UML diagrams of code structure (class diagram for DB models, package diagram for
   module layout, sequence diagram for login/2FA flow, sequence diagram for PDF export
   flow)
4. Code snippet evidence of OWASP best practices, **cited by file name** — keep a
   running list of 2-3 "best evidence" snippets per phase as you go, rather than
   scrambling at the deadline
5. Dependency list + dependency-check evidence
6. Automated testing evidence + findings

Start assembling 3-4 days before the deadline, pulling evidence from the running list
built up across earlier phases rather than writing it all from scratch at the end.

## Suggested timeline (3.5 weeks from D1 deadline to D2 deadline)

| Week | Focus |
|---|---|
| 1 | Phase 0 (infra) → Phase 1 (schema) → Phase 2 (auth) started |
| 2 | Phase 2 finished, Phase 3 (CRUD), Phase 4 (PDF export) started, Phase 6 (frontend) started against settled API contracts |
| 3 | Phase 4 finished, Phase 5 (admin), Phase 7 (dependency scanning), Phase 8 (test coverage gaps) |
| 3.5 (final days) | Phase 9 (report assembly), UML diagrams finalised, full CI green, peer appraisal prep |
