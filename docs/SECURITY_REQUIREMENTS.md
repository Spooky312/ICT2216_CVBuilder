# Security Requirements Reference (from D1 Report, Section 3 & 9)

Every SR below must be traceable to actual code in D2 — comment the implementing code
with the SR ID so it can be cited directly in the D2 report's "evidence of best
practices" section.

| ID | Security Requirement | Traces to | Relevance |
|---|---|---|---|
| SR-01 | Store passwords using bcrypt, work factor ≥12. | FR-01, FR-02, FR-07, NFR-02 | Prevents credential exposure on DB compromise. bcrypt auto-generates/embeds a unique salt — no separate salt column needed. |
| SR-02 | Enforce password complexity (≥12 chars, mixed case, digit, symbol); reject top-10,000 breached passwords. | FR-02, FR-04, FR-07 | Mitigates brute-force/credential-stuffing. Also applies on change-password. |
| SR-03 | Rate-limit `/api/auth/login` to 5 attempts / 15 min, keyed by the submitted email; HTTP 429 on breach. | FR-01, NFR-05 | Slows brute-force/credential-stuffing, tolerant of mistyped passwords. |
| SR-04 | Signed session tokens, expire after 30 min inactivity, stored in HttpOnly/Secure/SameSite=Strict cookies. | FR-01, FR-06, NFR-02 | Prevents session hijacking, XSS-based token theft. |
| SR-05 | All user input validated server-side against whitelist schema; output-encoded before HTML/PDF rendering. | FR-02, FR-04, FR-09, FR-10 | Prevents XSS, HTML injection, SSTI across all input surfaces incl. resume preview. |
| SR-06 | All DB operations use parameterised queries. | FR-03, FR-09, FR-11, FR-12, FR-13, FR-14 | Prevents SQL injection across all data ops incl. admin/audit. |
| SR-07 | Every read/update/delete on resume or profile verifies ownership server-side. Admin endpoints verify admin role. | FR-03, FR-04, FR-05, FR-12, FR-13, FR-14 | Prevents IDOR + unauthorised access to admin functions. |
| SR-08 | All external traffic over TLS 1.2+. HTTP→HTTPS redirect. HSTS enabled. | NFR-11 | Prevents eavesdropping/MITM. |
| SR-09 | Account deletion purges PII from primary storage within 24h. | FR-05, NFR-11 | PDPA compliance, right to erasure. Implementation exceeds this: `DELETE /api/profile` purges synchronously (immediately), not within a 24h window. |
| SR-10 | Log auth events, authz failures, account changes, admin actions to audit log, retained ≥90 days. | FR-01, FR-02, FR-04, FR-05, FR-06, FR-07, FR-13, FR-14, NFR-06 | Supports incident detection/forensics. |
| SR-11 | All third-party dependencies scanned for known CVEs in CI; critical/high blocks deployment. | All FRs, NFR-10 | Prevents exploitation of known library vulns. |
| SR-12 | State-changing requests (POST/PUT/DELETE) require server-validated CSRF token. | FR-04, FR-05, FR-06, FR-07, FR-09, FR-12, FR-13 | Prevents CSRF across all state-changing ops incl. logout, admin user mgmt. |
| SR-13 | Logout invalidates active session; token cannot be reused. | FR-06, SR-04 | Prevents session replay after logout. |
| SR-14 | Audit log access restricted to admin role. No route allows editing or deleting an individual entry; a dedicated admin-only cleanup route may bulk-purge entries older than a floor of 90 days, and that purge is itself audit-logged. | FR-14, NFR-06 | Prevents tampering with individual forensic records while allowing bounded, logged retention management (not literally append-only/immutable — see implementation notes below). |
| SR-15 | TOTP second factor at login, secret stored encrypted at rest (AES-256-GCM), never returned to client post-enrolment. | FR-01, FR-08, NFR-02 | Prevents account takeover even if password compromised; encrypted secret defeats DB-access-only attackers. |

## Implementation notes (verified against current code)

**Authentication & Session Management**
- bcrypt cost factor 12 in production/development (4 in the test config only, to keep
  the test suite fast — never used outside `FLASK_ENV=testing`).
- Session tokens = signed JWT (flask-jwt-extended, HS256), HttpOnly/Secure/SameSite=Strict
  cookies only (`JWT_TOKEN_LOCATION=["cookies"]`) — never stored in
  localStorage/sessionStorage.
- 30-min access token lifetime, 24h refresh token lifetime. Logout revokes both the
  access and refresh token's JTI via a server-side blocklist table (`revoked_tokens`),
  checked on every authenticated request.
- Login rate limit: 5 attempts / 15 min, keyed by the submitted email (not IP).
- Account lockout: 5 failed attempts (password or TOTP) locks the account for 15
  minutes (`locked_until`); an admin can also lock/unlock manually. A signed,
  time-limited CAPTCHA challenge is required on every login attempt once
  `failed_logins >= 3`, enforced before the password check so it can't be bypassed by
  guessing; a failed/absent CAPTCHA does not itself count as a password failure (can't
  be used to lock another user's account).
- TOTP via `pyotp`, 30-second step with a ±1 step verification window; secret encrypted
  at rest with AES-256-GCM (key derived from `TOTP_ENCRYPTION_KEY`, falling back to a
  SHA-256 hash of `SECRET_KEY` if unset) and only ever decrypted in memory at
  verification time. Enrolment is deferred to the user's first login rather than
  registration.
- Password policy enforced server-side: ≥12 chars, upper + lower case, digit, symbol
  (see `app/schemas/user_schema.py`).

**Authorization**
- RBAC: two roles, `user` and `admin`. Admin routes sit behind the `admin_required`
  decorator (`app/routes/admin.py`), which does a live DB lookup of the caller's role on
  every request (not just at login/token issuance), so a demoted admin loses access
  immediately.
- Ownership check on every resume/profile read/update/delete (`resumes.user_id` must
  match the authenticated user).
- Resume and user IDs are UUIDv4 (prevents sequential enumeration).

**Input Handling**
- Server-side whitelist schema validation (Marshmallow) before any processing.
- Jinja2 `autoescape=True` for HTML. Admin-uploaded HTML templates are sanitised
  against a tag/attribute allow-list before storage (`app/services/template_service.py`).
- URL fields (LinkedIn, portfolio, projects) accept bare domains for usability and
  normalise them to `https://` server-side. Explicit schemes are restricted to HTTP(S);
  malformed hosts, embedded credentials, and `javascript:`, `data:`, or `file:` links
  are rejected. The server renders these values but never fetches them.

**Transport & Headers**
- HTTPS only in production (HTTP is auto-redirected to HTTPS once TLS certs are present;
  Nginx falls back to HTTP-only if no cert is found, e.g. for early local testing). HSTS
  `max-age=31536000; includeSubDomains` is only added when the JWT cookie is configured
  as Secure.
- CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; frame-src 'self' blob:` (the narrow `blob:` allowance displays
  locally generated PDF previews).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` on every response
  (`app/__init__.py`).

**Logging & Monitoring**
- Structured JSON-serialisable log entries for auth events, authz failures, account
  changes, and admin actions (`app/utils/audit.py`).
- No PII or password data in logged metadata.
- Entries older than 90 days can be purged only through a dedicated, admin-only,
  itself-audit-logged cleanup route (`DELETE /api/admin/audit-log/cleanup`) — there is
  no route to edit or delete an individual entry. This is a deliberate relaxation from a
  literal "immutable/append-only" design to support bounded retention, not an oversight.

**Rate Limiting (Flask-Limiter, Redis-backed; falls back to in-process memory if
`REDIS_URL` is unset)**
- Default limit for any route without an explicit override: 200/day, 50/hour.
- `POST /api/auth/register`: 10 / hour.
- `GET /api/auth/captcha`: 30 / 15 min.
- `POST /api/auth/login`: 5 / 15 min, keyed by submitted email.
- `POST /api/auth/verify-2fa`: 10 / 15 min.
- `POST /api/resumes/preview`: 10 / min / authenticated user; drafts are validated,
  rendered in memory, and never persisted.
- `GET /api/resumes/{id}/export`: 10 / min / authenticated user (mitigates R-06, CPU
  exhaustion from repeated PDF generation — this is the **DoS** mitigation; see
  `ARCHITECTURE.md` STRIDE table).
- Server-side enforcement, HTTP 429 on breach.

**Dependency Scanning**
- OWASP Dependency-Check as a dedicated GitHub Actions step, runs on every PR, blocks
  merge on critical/high findings. Covers server-side (Flask, weasyprint, Jinja2,
  SQLAlchemy) and client-side (React + sub-packages). Results published as a build
  artefact — keep these artefacts/screenshots for the D2 report.

## Mapping risks → mitigations (from D1 Section 5 + STRIDE table)

| Risk ID | Risk | Primary mitigating SR(s) |
|---|---|---|
| R-01 | PII data leakage | SR-06, SR-07, SR-08, NFR-07 |
| R-02 | Account takeover | SR-01, SR-02, SR-03, SR-04, SR-15 |
| R-03 | SQL injection | SR-06 |
| R-04 | Stored XSS in resume content | SR-05 |
| R-05 | CSRF on account/resume mutations | SR-12 |
| R-06 | DoS via PDF generation | SR-03 rate limit on export endpoint |
| R-07 | Vulnerable dependency | SR-11 |
| R-08 | Insider threat | SR-10, SR-14 |
| R-09 | Server-side template injection (SSTI) | SR-05 |
