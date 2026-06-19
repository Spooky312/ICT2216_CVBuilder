# Architecture & Threat Model Reference (from D1 Report, Sections 6-8)

## Physical Architecture

- Deployed on AWS, single EC2 instance (Ubuntu), inside a private VPC with security
  group rules restricting inter-component traffic.
- EC2 hosts a Docker Compose stack: Nginx, Flask, PostgreSQL containers.
- EC2 security group exposes **only** the public web port; container-to-container
  traffic stays on internal Docker networks.
- Authenticator: Google Authenticator app on the user's device generates TOTP codes
  (client-side only, no server component beyond verifying with `pyotp`).

## Logical Architecture (3 layers, separated by trust boundaries)

```
User/Clients (mobile, desktop) + Google Authenticator
        │ HTTPS : 443
        ▼
[Docker network]
  Nginx reverse proxy (listens :443, terminates TLS, redirects :80→:443)
        │ HTTP : 8000 (internal only)
        ▼
  Flask app server (listens :8000, NOT exposed to internet)
        │ TCP : 5432 (internal only)
        ▼
  PostgreSQL (listens :5432, NOT exposed to internet)
```

| Component | Responsibility |
|---|---|
| Nginx | Public entry point. Terminates HTTPS (CA-issued or self-signed cert). HTTP:80 → HTTPS:443 redirect. Forwards to Flask over internal Docker network only. |
| Flask | Business logic: auth, authz, resume CRUD, PDF generation, input validation, CSRF enforcement, API processing. Never directly internet-facing. |
| PostgreSQL | Stores users, hashed credentials, resume content, audit log. Reachable only by Flask over backend Docker network. |

**Trust boundaries (3):**
(a) Browser ↔ web application
(b) Web application ↔ database layer
(c) Admin role boundary within the web application

## Level 0 Data Flow Diagram

| Flow | Direction | Data Exchanged |
|---|---|---|
| 1 | User → Web App | Login credentials, profile updates, resume wizard content |
| 2 | Web App → User | Rendered HTML pages, exported PDF resumes |
| 3 | Admin → Web App | CV templates & user management, viewing logs |
| 4 | Web App → Admin | User lists, CV templates, logs |
| 5 | Web App → Database | SQL queries |
| 6 | Database → Web App | Queried data |

## STRIDE Threat Analysis Summary

| STRIDE Category | # Threats | Most Prominent Threat | Primary Mitigation | Linked Risk |
|---|---|---|---|---|
| Spoofing | 18 | Account takeover / improper session-cookie access | Strong password policy, bcrypt, lockout after repeated failures, HttpOnly/Secure/SameSite cookies, session expiry | R-02, R-05 |
| Tampering | 12 | SQL injection, malicious code injection | Server-side validation, output encoding, SQLAlchemy parameterised queries, CSRF protection | R-03, R-04, R-09 |
| Repudiation | 4 | Attacker denies malicious act, removes footprints | Append-only audit logging, restricted log access | R-08 |
| Information Disclosure | 20 | Reversing weak hashes/encryption, log file exposure | TLS 1.2+, bcrypt, RBAC, secure PII handling, restricted audit log access | R-01, R-08, R-09 |
| Denial of Service | 2 | CPU/memory exhaustion via oversized/complex PDF export input, or endpoint flooding | Rate limiting on auth + resource-intensive endpoints, request validation, traffic monitoring | R-06 |
| Elevation of Privilege | 4 | Unauthorized DB access via weak network/authz controls | Server-side authz on every request, RBAC, ownership verification, admin/user privilege separation | R-02, R-08, R-09 |

**Note on the DoS row:** the resource-exhaustion framing above (oversized/complex PDF
export input) is the corrected version. An earlier draft incorrectly described this row
as a CSRF/availability-via-forged-request threat — when implementing, the DoS control
that matters is the **rate limit on `/resumes/{id}/export`**, not CSRF tokens (CSRF is
SR-12's job and maps to Tampering/Spoofing-adjacent risks, not DoS).

## Attack Surface Analysis

| Attack Surface | Entry Point | Threat Actor | Linked Risk |
|---|---|---|---|
| Authentication | `/auth/login`, `/auth/register` | External attacker | R-02, R-03 |
| Resume wizard inputs | `/resumes` (POST), all wizard fields | Authenticated attacker | R-04, R-09 |
| PDF export pipeline | `/resumes/{id}/export` | Authenticated attacker | R-06, R-09 |
| Profile management | `/profile` (GET, PUT, DELETE) | Authenticated attacker | R-01, R-05 |
| Admin interface | `/admin/*` | Privilege escalation attacker | R-02 |
| Session/cookie management | All authenticated routes | External / authenticated attacker | R-02, R-05 |
| Third-party dependencies | Flask, weasyprint, Jinja2, React packages | Supply chain attacker | R-07 |
| CI/CD pipeline | GitHub Actions, container registry | Insider / supply chain attacker | R-07, R-08 |
| Infrastructure | SSH to EC2, internal Docker network, Postgres internal port 5432 | External / insider / compromised Flask container | R-01, R-08 |

## Misuse case → mitigation quick reference (for code comments)

| Use Case | Misuse Case | Mitigation control to implement |
|---|---|---|
| UC-01 Login | Brute force / credential stuffing | Rate limiting (5/15min), 2FA, input validation |
| UC-02 Register | Username enumeration | Generic error messages (don't reveal "username taken" vs "invalid") |
| UC-03 View Profile | Unauthorised profile access (IDOR) | Server-side ownership check, JWT auth |
| UC-04 Update Profile | CSRF to trick unwanted profile change | CSRF token validation, re-auth for sensitive changes |
| UC-05 Delete Account | CSRF to force account deletion | CSRF token required |
| UC-06 Create Resume | XSS / malicious input injection | Server-side input validation, output encoding |
| UC-07 Export Resume | SSTI / command injection | Input sanitisation, Jinja2 autoescape, WeasyPrint sandboxing |
| UC-08 Select Template | Tamper template ID for restricted templates | Server-side template ID validation against allowed list |
| UC-09 Logout | Session replay after logout | Server-side token blacklist |
| UC-10 Change Password | CSRF to change password | CSRF token required |
| UC-11 Manage Templates (admin) | Inject malicious template content | Input validation on all template fields, audit logging |
| UC-12 Manage Users (admin) | Privilege escalation via admin functions | RBAC middleware, role check on every admin endpoint |
| UC-13 Audit Log Access (admin) | Unauthorised access / tampering | RBAC middleware, admin-only, read-only enforcement |
