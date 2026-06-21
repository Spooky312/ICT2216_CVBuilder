# Security Requirements Reference (from D1 Report, Section 3 & 9)

Every SR below must be traceable to actual code in D2 — comment the implementing code
with the SR ID so it can be cited directly in the D2 report's "evidence of best
practices" section.

| ID | Security Requirement | Traces to | Relevance |
|---|---|---|---|
| SR-01 | Store passwords using bcrypt, work factor ≥12. | FR-01, FR-02, FR-07, NFR-02 | Prevents credential exposure on DB compromise. bcrypt auto-generates/embeds a unique salt — no separate salt column needed. |
| SR-02 | Enforce password complexity (≥12 chars, mixed case, digit, symbol); reject top-10,000 breached passwords. | FR-02, FR-04, FR-07 | Mitigates brute-force/credential-stuffing. Also applies on change-password. |
| SR-03 | Rate-limit `/auth/login` to 5 attempts / 15 min / IP, HTTP 429 + `Retry-After`. | FR-01, NFR-05 | Slows brute-force/credential-stuffing, tolerant of mistyped passwords. |
| SR-04 | Signed session tokens, expire after 30 min inactivity, stored in HttpOnly/Secure/SameSite=Strict cookies. | FR-01, FR-06, NFR-02 | Prevents session hijacking, XSS-based token theft. |
| SR-05 | All user input validated server-side against whitelist schema; output-encoded before HTML/PDF rendering. | FR-02, FR-04, FR-09, FR-10 | Prevents XSS, HTML injection, SSTI across all input surfaces incl. resume preview. |
| SR-06 | All DB operations use parameterised queries. | FR-03, FR-09, FR-11, FR-12, FR-13, FR-14 | Prevents SQL injection across all data ops incl. admin/audit. |
| SR-07 | Every read/update/delete on resume or profile verifies ownership server-side. Admin endpoints verify admin role. | FR-03, FR-04, FR-05, FR-12, FR-13, FR-14 | Prevents IDOR + unauthorised access to admin functions. |
| SR-08 | All external traffic over TLS 1.2+. HTTP→HTTPS redirect. HSTS enabled. | NFR-11 | Prevents eavesdropping/MITM. |
| SR-09 | Account deletion purges PII from primary storage within 24h. | FR-05, NFR-11 | PDPA compliance, right to erasure. |
| SR-10 | Log auth events, authz failures, account changes, admin actions to append-only audit log, retained 90 days. | FR-01, FR-02, FR-04, FR-05, FR-06, FR-07, FR-13, FR-14, NFR-06 | Supports incident detection/forensics. |
| SR-11 | All third-party dependencies scanned for known CVEs in CI; critical/high blocks deployment. | All FRs, NFR-10 | Prevents exploitation of known library vulns. |
| SR-12 | State-changing requests (POST/PUT/DELETE) require server-validated CSRF token. | FR-04, FR-05, FR-06, FR-07, FR-09, FR-12, FR-13 | Prevents CSRF across all state-changing ops incl. logout, admin user mgmt. |
| SR-13 | Logout invalidates active session; token cannot be reused. | FR-06, SR-04 | Prevents session replay after logout. |
| SR-14 | Audit log access restricted to admin role. Log records read-only, not modifiable/deletable via any app interface. | FR-14, NFR-06 | Prevents tampering with forensic evidence; ensures audit trail integrity. |
| SR-15 | TOTP second factor at login, secret stored encrypted at rest (AES-256-GCM), never returned to client post-enrolment. | FR-01, FR-08, NFR-02 | Prevents account takeover even if password compromised; encrypted secret defeats DB-access-only attackers. |

## Implementation notes carried over from D1 Security Design (Section 9)

**Authentication & Session Management**
- bcrypt cost factor 12, 128-bit salt embedded automatically by bcrypt.
- Session tokens = signed JWT (HS256, ≥256-bit secret), HttpOnly/Secure/SameSite=Strict
  cookies only — never store JWT in localStorage/sessionStorage.
- 30-min idle timeout + 24h absolute timeout. Logout = server-side blacklist entry.
- Login rate limit: 5 attempts / 15 min / IP (Flask-Limiter).
- TOTP via `pyotp`, 30-second window, secret encrypted at rest with AES-256-GCM.
- Password policy: ≥12 chars, mixed case, digit, symbol; reject if in top-10k breach list
  (bundle a breached-password list or use a library/API — decide and document in D2).

**Authorization**
- RBAC: two roles, `user` and `admin`. Admin routes behind a middleware/decorator
  checking role on every request (not just at login/token issuance).
- Ownership check on every resume/profile read/update/delete.
- Resume IDs = UUIDv4 (prevents sequential enumeration).

**Input Handling**
- Server-side whitelist schema validation (Marshmallow or Pydantic) before any
  processing.
- Jinja2 `autoescape=True` for HTML. Resume content going into PDF templates is
  *manually* escaped before rendering (prevents SSTI — this was UC-07's misuse case).
- URL fields (LinkedIn, portfolio) restricted to http/https schemes; hostname allowlist
  where feasible.

**Transport & Headers**
- HTTPS only. HSTS max-age=31536000; includeSubDomains.
- CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:`
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`.

**Logging & Monitoring**
- Structured JSON log entries for auth events, authz failures, account changes.
- No PII or password data in logs.
- 90-day retention, tamper-evident append-only storage.

**Rate Limiting (Flask-Limiter)**
- `/auth/login`: 5 req / 15 min / IP.
- `/resumes/{id}/export`: 10 req / min / authenticated user (mitigates R-06, CPU
  exhaustion from repeated PDF generation — this is the **DoS** mitigation; see
  `ARCHITECTURE.md` STRIDE table).
- Server-side enforcement, HTTP 429 + `Retry-After` header.

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
