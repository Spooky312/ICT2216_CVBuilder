# Requirements Reference (from D1 Report, Sections 2)

Source of truth: `ICT2216_P1_Group1_Report_1.pdf` (final D1 submission, 10 June 2026).
If implementation forces a change to wording or scope, flag it to the team — the D2
report needs to explain any drift from D1, and a teammate previously caught a session
the FR-01/FR-08 contradiction in this exact document.

## Functional Requirements

### Account Management (Login & CRUD)

| ID | Requirement | Description |
|---|---|---|
| FR-01 | Login | Authenticate registered user via username + password, then TOTP (FR-08). Session established **only after** both factors succeed. |
| FR-02 | Registration | Guest registers with unique username, full name, password. |
| FR-03 | View Profile | Authenticated user views own account info. |
| FR-04 | Update Profile | Authenticated user updates own account info. |
| FR-05 | Delete Account | Authenticated user permanently deletes own account + all associated data. |
| FR-06 | Logout | Authenticated user terminates current session. |
| FR-07 | Change Password | Authenticated user changes password by providing current password + new password meeting SR-02 policy. |
| FR-08 | Two-Factor Authentication | TOTP-based 2FA via authenticator app at login; enrolment happens at registration. |

### Core Features

| ID | Requirement | Description |
|---|---|---|
| FR-09 | Resume Creation | Authenticated user creates resume (personal details, education, experience, skills, projects). |
| FR-10 | Resume Export | Authenticated user exports a saved resume as PDF. |
| FR-11 | Template Selection | Authenticated user selects a resume template at generation/export time. |

### Admin

| ID | Requirement | Description |
|---|---|---|
| FR-12 | Template Management | Admin adds, updates, deactivates resume templates. |
| FR-13 | User Management | Admin views, deactivates, permanently deletes user accounts. |
| FR-14 | Audit Log Access | Admin views and filters the audit log by event type, user, date range. |

## Non-Functional Requirements

| ID | Requirement | Description |
|---|---|---|
| NFR-01 | Performance | Generate + return downloadable PDF within 5s for 95% of requests under 100 concurrent users. |
| NFR-02 | Security — Password Storage | bcrypt, work factor ≥12; session invalidated after 30 min inactivity. |
| NFR-03 | Usability | First-time user completes registration→PDF download in ≤15 min, ≤2 usability errors/session. |
| NFR-04 | Availability | 99.5% uptime/month, excl. maintenance announced ≥48h ahead. |
| NFR-05 | Scalability | Support ≥100 concurrent authenticated users for resume create/export without breaching NFR-01. |
| NFR-06 | Auditability | Tamper-evident audit log of auth events, authz failures, account changes, retained ≥90 days. |
| NFR-07 | Confidentiality | PII accessible only to owning user + authorised admins, enforced server-side on every data operation. |
| NFR-08 | Integrity | All wizard input validated server-side; failures rejected, not persisted. |
| NFR-09 | Recoverability | Restore service/data to last consistent state within 4h, ≤1h data loss. |
| NFR-10 | Maintainability | Version locking / dependency manifest control. Dependency scan completes in CI in <5 min, no manual intervention. |
| NFR-11 | Compliance | PDPA + GitHub MIT License compliance. PII purged from primary storage within 24h of account deletion. |
| NFR-12 | Portability | Fully containerised via Docker, deployable to any host/cloud without source changes. |

## Implementation priority guidance for D2

Build in this rough order so each phase has something to integrate against early:

1. DB schema + migrations (`docs/DATABASE_SCHEMA.md`) — blocks everyone else
2. Auth (FR-01, FR-02, FR-06, FR-07, FR-08) — blocks profile/resume/admin work needing a logged-in user
3. Profile CRUD (FR-03, FR-04, FR-05)
4. Resume CRUD + template selection (FR-09, FR-11)
5. PDF export (FR-10) — depends on resume CRUD + templates existing
6. Admin (FR-12, FR-13, FR-14) — depends on auth/RBAC being solid
7. Cross-cutting: rate limiting, security headers, audit logging, CI/CD, dependency
   scanning, automated tests — should be threaded through from the start, not bolted on
   at the end (see `TASKS.md` Phase 0 and Phase 7-8).
