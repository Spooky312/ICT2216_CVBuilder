# CVBuilder — Claude Code Project Context

This file is auto-loaded by Claude Code at the start of every session in this repo.
It exists so Claude Code does not need the full Deliverable 1 (D1) report re-explained
every time. Detailed reference material lives in `docs/`. Task breakdown lives in `TASKS.md`.

## What this project is

CVBuilder is a web-based, ATS-friendly resume builder. Users register, fill in a guided
wizard (personal details, education, experience, skills, projects), pick a template, and
export a PDF resume. Admins manage templates, users, and the audit log.

This is the **ICT2216 Secure Software Development** group project (Trimester 3,
AY2025/2026, Lab Group P1 Group 1). The module grades **security implementation
quality**, not feature breadth. Every implementation decision should trace back to a
Security Requirement (SR-01 to SR-15) in `docs/SECURITY_REQUIREMENTS.md`.

## Current phase: Deliverable 2 — Secure Software Implementation (25%)

- **Deadline: Thursday 9 July 2026, 9:00 AM**
- We are now acting as "a development team in a company" (per module brief)
- D2 report (max 30 pages, excl. appendices) must include:
  1. **Secure Implementation**
     - CI/CD process description + all tools used
     - Directory/file organisation of the source code (repo will be cloned for grading)
     - Code structure explained via UML diagrams (class, package, sequence, communication, etc.)
     - Evidence of OWASP/secure-coding best practices, **with code snippets and file names cited**
  2. **Test-Driven Development & Test Automation**
     - List all dependencies + evidence of dependency-check tooling
     - Evidence of automated tests written and run during implementation
     - Findings/lessons worth sharing from automated testing
- Deliverable 2 also feeds **Peer Appraisal II** (individual grade contribution)

**Implication for how we code:** every PR/commit that implements something tied to an
SR should be written so it is easy to screenshot/cite in the report later (clear file
names, docstrings/comments referencing the SR ID, e.g. `# SR-01: bcrypt password hashing`).

## Tech stack (locked in from D1, do not deviate without team agreement)

| Layer | Choice |
|---|---|
| Backend | Flask (Python) |
| ORM / DB driver | SQLAlchemy |
| Database | PostgreSQL (Docker container; AWS RDS only if team votes to swap) |
| Reverse proxy | Nginx (TLS termination, HTTP→HTTPS redirect, HSTS) |
| Frontend | React |
| Templating (HTML) | Jinja2 (autoescape on) |
| PDF generation | WeasyPrint |
| Auth | Flask-JWT-Extended (HS256, HttpOnly/Secure/SameSite=Strict cookies) |
| Password hashing | bcrypt, cost factor ≥ 12 |
| 2FA | pyotp (TOTP, NOT OAuth — module bans OAuth) |
| Rate limiting | Flask-Limiter |
| Containerisation | Docker + Docker Compose, deployed on AWS EC2 |
| CI/CD | GitHub Actions |
| Dependency scanning | OWASP Dependency-Check (GitHub Actions step) |
| Static analysis | SonarQube (see X09 lab) |
| DAST | OWASP ZAP (see X11a lab) |
| Fuzzing | Burp Suite (see X11b lab) — likely D3, not D2 |

**Explicitly rejected:** Firebase Auth (conflicts with SR-01 bcrypt, SR-04 HttpOnly JWT,
SR-06 SQLAlchemy/Postgres), CAPTCHA (replaced with velocity checking + lockout w/ email
alert), account-lockout-as-primary-defence (it's a DoS vector — rate limiting per IP is
primary, lockout is residual/secondary).

## Reference documents (read before implementing the related area)

- `docs/REQUIREMENTS.md` — full FR-01..FR-14, NFR-01..NFR-12 tables
- `docs/SECURITY_REQUIREMENTS.md` — full SR-01..SR-15 tables with implementation notes
- `docs/ARCHITECTURE.md` — physical/logical architecture, STRIDE threat table, attack
  surface table, trust boundaries
- `docs/DATABASE_SCHEMA.md` — full schema (users, resumes, templates, audit_log) as DDL
- `docs/API_ENDPOINTS.md` — derived endpoint list mapped to FR/SR/UC IDs
- `TASKS.md` — sequential D2 implementation checklist, phase by phase

## Non-negotiable security rules for any code Claude Code writes in this repo

1. **No raw SQL string interpolation, ever.** Use SQLAlchemy parameterised
   queries/ORM only (SR-06).
2. **All input validated server-side** against a whitelist schema (Marshmallow or
   Pydantic) before it touches the DB or a template (SR-05).
3. **All HTML/PDF output is escaped.** Jinja2 `autoescape=True` stays on; never disable
   it; resume content going into PDF templates must be explicitly escaped (SR-05, mitigates
   SSTI — this was a literal misuse case in our D1 diagrams).
4. **Every state-changing route (POST/PUT/DELETE) requires CSRF token validation**
   (SR-12), except where JWT-in-header design makes CSRF moot — confirm with team before
   assuming this exemption.
5. **Every resource-access route checks ownership server-side** (`user_id` on the
   resource must match the authenticated user, or caller must be admin) — this is the
   IDOR mitigation (SR-07). Resume/profile IDs are UUIDv4, never sequential ints.
6. **Admin routes are behind RBAC middleware checking `role == 'admin'` on every
   request**, not just at login (SR-07).
7. **Passwords:** bcrypt cost ≥ 12, never logged, never returned in any API response.
   Password complexity ≥12 chars/mixed case/digit/symbol, checked against top-10k breach
   list (SR-02).
8. **TOTP secrets stored encrypted at rest with AES-256-GCM**, never returned to the
   client after enrolment (SR-15).
9. **Session cookies:** HttpOnly, Secure, SameSite=Strict, 30-min idle timeout, 24h
   absolute timeout, server-side blacklist on logout (SR-04, SR-13).
10. **Rate limit `/auth/login`** to 5 requests / 15 min / IP, HTTP 429 + `Retry-After`
    (SR-03). **Rate limit `/resumes/preview` and `/resumes/{id}/export`** to 10/min/user
    (mitigates R-06 DoS via PDF generation resource exhaustion). Preview drafts are
    validated, rendered in memory, uncached, and never persisted or audit-logged.
11. **No PII or secrets in logs.** Structured JSON audit log entries only for auth
    events, authorization failures, account changes, admin actions (SR-10).
12. **Security headers on every response:** HSTS (max-age=31536000;
    includeSubDomains), CSP (`default-src 'self'; script-src 'self'; style-src 'self';
    img-src 'self' data:`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin` (SR-08 + design section).
13. When in doubt about whether something is in scope for D2 vs D3: implementation and
    automated testing (unit/integration tests, dependency checks) = D2. Manual pen-testing,
    ZAP scans, source code review of another team's code = D3.

## Known open issues carried over from D1 (fix during D2, don't repeat them in code)

- FR-01 and FR-08 had a contradiction about session establishment timing — implementation
  must match the corrected wording: session is established **only after** password +
  TOTP both succeed.
- Email is **not** an auth factor — it's used only for lockout/security alert
  notifications. Don't build an email-OTP login path.
- Account lockout must coexist with rate limiting without itself becoming a DoS vector:
  prefer per-IP rate limiting as primary control; if implementing lockout, make it
  time-boxed and paired with an email alert, not indefinite.

## Working style notes for Claude Code in this repo

- Keep edits minimal and targeted; don't refactor unrelated code in the same change.
- Comment security-relevant code with the SR ID it satisfies — this is directly reused
  as evidence in the D2 report.
- Prefer small, reviewable commits per feature/endpoint over large multi-feature commits
  — easier for teammates to review and for the report's "code snippet evidence" section.
