# Database Schema Reference (from D1 Report, Section 10)

This is the schema as designed in D1. Translate directly into SQLAlchemy models /
Alembic migrations during D2. Foreign keys use `ON DELETE CASCADE` to support the
right-to-erasure requirement (SR-09).

```sql
-- =========================================================
-- users
-- =========================================================
CREATE TABLE users (
    user_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username                VARCHAR(255) UNIQUE NOT NULL,
    password_hash           VARCHAR(60) NOT NULL,        -- bcrypt hash output
    enc_totp_key            VARCHAR(255) NOT NULL,       -- AES-256-GCM ciphertext of TOTP secret
    full_name               VARCHAR(100) NOT NULL,
    role                    VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    account_locked          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_updated_password   TIMESTAMPTZ NOT NULL DEFAULT now(),
    password_history        JSONB NOT NULL DEFAULT '[]'
);

-- =========================================================
-- resumes
-- =========================================================
CREATE TABLE resumes (
    resume_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- UUIDv4: prevents sequential enumeration (SR-07)
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content_json  JSONB NOT NULL  -- validated server-side before storage (SR-05, NFR-08)
);

-- =========================================================
-- templates
-- =========================================================
CREATE TABLE templates (
    template_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_filename  VARCHAR(255) UNIQUE NOT NULL,
    last_modified       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- audit_log
-- =========================================================
CREATE TABLE audit_log (
    log_id       BIGSERIAL PRIMARY KEY,
    user_id      UUID NULL,             -- nullable: allows logging pre-authentication events
    event_type   VARCHAR(50) NOT NULL,  -- e.g. LOGIN_SUCCESS, LOGIN_FAILURE, ACCOUNT_DELETED
    ip_address   INET,                  -- client IP for forensic use
    user_agent   TEXT,
    metadata     JSONB,                 -- additional context; MUST NOT contain PII or passwords
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Notes for implementation

- `password_hash` is `VARCHAR(60)` — exactly fits a bcrypt hash. Don't widen this
  without reason; if you do, document why in the D2 report.
- `enc_totp_key` stores ciphertext, not the raw TOTP secret. Encrypt with AES-256-GCM
  before insert; decrypt only in-memory at verification time. Never log or return this
  field.
- `audit_log.metadata` is a dumping ground for context but is explicitly **not** allowed
  to contain PII or passwords — validate this at the logging call site, not just by
  convention.
- `audit_log` should be append-only at the application layer (no UPDATE/DELETE routes
  exposed anywhere, including admin) — this is what makes it satisfy SR-14.
- Known open issue from D1 review: a teammate's section had a contradiction between
  RDS and Docker-container Postgres labelling, and a question about whether `resumes`
  needs a composite/explicit primary key beyond `resume_id`. Confirm with that teammate
  before D2 migrations are finalised — don't silently resolve it in code.
- Consider whether `templates` needs an `is_active` boolean for FR-12 ("deactivate"
  templates) and whether `users` needs an equivalent for FR-13 ("deactivate" user
  accounts) — D1 schema doesn't have these columns yet but the FRs require the
  capability. Flag and add during D2 migration design.
