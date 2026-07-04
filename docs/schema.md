# Database Schema

Reflects the actual SQLAlchemy models in `backend/app/models/` and the applied Alembic
migrations in `backend/migrations/versions/`, not a design-time schema. If you change a
model, update this file and generate a migration (`flask db migrate`) in the same change.

Database: PostgreSQL in production/Docker, SQLite in-memory for the pytest suite.

## `users` (`app/models/user.py`)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `user_id` | `UUID` | PK | `uuid4()` | |
| `email` | `VARCHAR(255)` | NOT NULL | — | unique, indexed |
| `password_hash` | `VARCHAR(255)` | NOT NULL | — | bcrypt hash |
| `full_name` | `VARCHAR(100)` | NOT NULL | — | |
| `role` | `VARCHAR(20)` | NOT NULL | `'user'` | `'user'` \| `'admin'` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` | `false` = deactivated by admin |
| `totp_secret` | `VARCHAR(512)` | NULL | — | encrypted TOTP secret; `NULL` until first-login enrolment completes |
| `totp_enabled` | `BOOLEAN` | NOT NULL | `true` | |
| `failed_logins` | `INTEGER` | NOT NULL | `0` | reset on successful login/unlock |
| `locked_until` | `TIMESTAMPTZ` | NULL | — | `NULL` = not locked; lockout is time-boxed, not permanent |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()`, on update `now()` | |

Relationships: `resumes` — one-to-many → `Resume`, `cascade="all, delete-orphan"` (deleting
a user deletes their resumes at the ORM level, backed by the DB-level `ON DELETE CASCADE`
FK on `resumes.user_id`).

Indexes: unique index on `email`.

## `resumes` (`app/models/resume.py`)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `resume_id` | `UUID` | PK | `uuid4()` | not sequential — mitigates enumeration/IDOR |
| `user_id` | `UUID` | NOT NULL | — | FK → `users.user_id`, `ON DELETE CASCADE`, indexed |
| `title` | `VARCHAR(100)` | NOT NULL | — | |
| `template_id` | `VARCHAR(50)` | NOT NULL | `'modern'` | FK-like reference to `resume_templates.template_id` (not a DB-level FK) |
| `content_json` | `JSON` | NOT NULL | `{}` | validated server-side (Marshmallow) before persist |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()`, on update `now()` | |

Relationships: `owner` — many-to-one → `User`.

## `resume_templates` (`app/models/resume_template.py`)

Not a static/seed-only table — admins can create, upload, edit, and delete templates at
runtime through `/api/admin/templates*`. Three built-in templates (`modern`, `classic`,
`minimal`) are ensured to exist by `ensure_default_templates()` in
`app/services/template_service.py`; anything else is a custom or uploaded template.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `template_id` | `VARCHAR(50)` | PK | — | e.g. `modern`, or admin-chosen slug for custom ones |
| `name` | `VARCHAR(80)` | NOT NULL | — | 1–80 chars |
| `description` | `VARCHAR(250)` | NOT NULL | `''` | ≤250 chars |
| `source_template_id` | `VARCHAR(50)` | NOT NULL | — | which built-in HTML layout renders this template (`modern`/`classic`/`minimal`) |
| `html_content` | `TEXT` | NULL | — | present only for admin-uploaded HTML templates |
| `original_filename` | `VARCHAR(255)` | NULL | — | original filename of an uploaded template |
| `active` | `BOOLEAN` | NOT NULL | `true` | inactive templates are hidden from users but not deleted |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()`, on update `now()` | |

`is_uploaded` in the API response (`to_dict()`) is derived as `bool(html_content)`, not a
stored column.

Deletion (`DELETE /api/admin/templates/{id}`) is guarded: built-in templates
(`modern`/`classic`/`minimal`) can never be deleted (only deactivated), and a custom
template in use by any `resumes.template_id` cannot be deleted until nothing references it.

## `audit_log` (`app/models/audit_log.py`)

Append-mostly, **not strictly append-only**: `DELETE /api/admin/audit-log/cleanup` lets an
admin purge entries older than a caller-supplied `days` threshold, with a server-enforced
floor of 90 days (`days < 90` is rejected with 403). There is no route to edit or delete an
individual entry.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `log_id` | `INTEGER` | PK, autoincrement | — | `Integer`, not `BigInteger` — SQLite (used by the test suite) can't autoincrement a `BIGINT` PK |
| `user_id` | `UUID` | NULL | — | indexed; `NULL` allowed for pre-authentication events (e.g. unknown-user login attempts) |
| `event_type` | `VARCHAR(50)` | NOT NULL | — | e.g. `login_success`, `login_failed`, `admin_user_locked` |
| `ip_address` | `VARCHAR(45)` | NULL | — | sized for IPv6 |
| `user_agent` | `TEXT` | NULL | — | |
| `extra` | `JSON` | NULL | — | serialised as `"metadata"` in API responses; must never contain PII or credentials |
| `occurred_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | |

## `revoked_tokens` (`app/models/revoked_token.py`)

JWT blocklist — implements server-side logout (a captured access/refresh token stops
working immediately instead of just expiring naturally).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `INTEGER` | PK, autoincrement | — | |
| `jti` | `VARCHAR(36)` | NOT NULL | — | unique, indexed; the token's JWT ID claim |
| `token_type` | `VARCHAR(20)` | NOT NULL | — | `'access'` or `'refresh'` |
| `user_id` | `UUID` | NULL | — | indexed |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | — | used to prune old entries |
| `revoked_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | |

## Migration history

| Revision | Purpose |
|---|---|
| `37c8ca2810c5` | initial migration — `users`, `resumes`, `audit_log` |
| `59a547ee0d05` | auto (schema tweak) |
| `16d0388af711` | auto (schema tweak) |
| `f3a7d9c2e610` | add `revoked_tokens` (JWT blocklist) |
| `e8f0b6c3a412` | add TOTP/2FA fields to `users` |
| `a9b2c4d5e701` | add `users.is_active` for admin deactivation |
| `c4f8b3d2a901` | remove email-verification columns (feature was never built; field removed rather than left dead) |
| `b8c9d0e1f234` | add persistent `resume_templates` table |
| `d2f4a6b8c901` | add uploaded-template content columns (`html_content`, `original_filename`) |

