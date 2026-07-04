# Requirements Reference (from D1 Report, Sections 2)

Source of truth: `ICT2216_P1_Group1_Report_1.pdf` (final D1 submission, 10 June 2026).
If implementation forces a change to wording or scope, flag it to the team — the D2
report needs to explain any drift from D1, and a teammate previously caught a session
the FR-01/FR-08 contradiction in this exact document.

## Functional Requirements

### Account Management (Login & CRUD)

| ID | Requirement | Description |
|---|---|---|
| FR-01 | Login | Authenticate registered user via email + password, then TOTP (FR-08). Session established **only after** both factors succeed. |
| FR-02 | Registration | Guest registers with unique email, full name, password. |
| FR-03 | View Profile | Authenticated user views own account info. |
| FR-04 | Update Profile | Authenticated user updates own account info. |
| FR-05 | Delete Account | Authenticated user permanently deletes own account + all associated data. |
| FR-06 | Logout | Authenticated user terminates current session. |
| FR-07 | Change Password | Authenticated user changes password by providing current password + new password meeting SR-02 policy. |
| FR-08 | Two-Factor Authentication | TOTP-based 2FA via authenticator app; enrolment is deferred to the user's first login (not registration), so registration never has to hand back a secret. |

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

## Current implementation status

All FR-01..FR-14 and NFR-01..NFR-12 below are implemented. See `docs/schema.md` for the
current database schema, `docs/API_ENDPOINTS.md` for the route list, and
`docs/SECURITY_REQUIREMENTS.md` for how each security requirement is actually satisfied.

One requirement is exceeded rather than met as originally scoped: NFR-11 specifies PII
purge within 24h of account deletion; the implementation purges synchronously
(`DELETE /api/profile` deletes the row and its cascaded resumes immediately, no background
job needed).

Two requirements were extended beyond their original wording during implementation, noted
here rather than silently: FR-12 (template management) also supports deleting a template
(guarded — built-in templates can't be deleted, and in-use custom templates can't be
deleted either); FR-13 (user management) supports both temporary lock/unlock and permanent
deletion, not just deactivation.
