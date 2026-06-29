# CVBuilder

CVBuilder is a full-stack resume builder with authentication, TOTP 2FA,
resume management, PDF export, and an admin panel.

## Stack

- Frontend: React + Vite
- Backend: Flask + Python
- Database: PostgreSQL 16
- Cache/rate-limit store: Redis 7
- Reverse proxy: Nginx
- Deployment target: Docker Compose on EC2

## Quick Start: Local Docker Development

Use this for normal local development.

```bash
docker compose -f docker-compose.dev.yml up --build
```

URLs:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

Stop the dev stack:

```bash
docker compose -f docker-compose.dev.yml down
```

The dev compose file contains local-only defaults. Do not use those values for
production.

## Production / EC2 Docker Setup

Production uses `docker-compose.yml`.

There are two environment files to understand:

1. Root `.env`
   - Location: project root, next to `docker-compose.yml`
   - Used by Docker Compose variable substitution.
   - Must contain the PostgreSQL container password.

2. Backend `.env`
   - Location: `backend/.env`
   - Used by the Flask backend container.
   - Must contain Flask/JWT/admin/runtime secrets.

Do not commit either `.env` file.

### 1. Create the root `.env`

From the project root:

```bash
cp .env.example .env
nano .env
```

Set:

```env
POSTGRES_PASSWORD=replace-with-a-strong-postgres-password
```

This value is used by:

- the `db` container as `POSTGRES_PASSWORD`
- the backend `DATABASE_URL` generated in `docker-compose.yml`

### 2. Create `backend/.env`

From the project root:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

For EC2/production, set at least:

```env
FLASK_ENV=production
SECRET_KEY=replace-with-a-long-random-secret
JWT_SECRET_KEY=replace-with-a-different-long-random-secret
REDIS_URL=redis://redis:6379/0
FRONTEND_URL=http://your-domain-or-ec2-ip

TOTP_ENCRYPTION_KEY=replace-with-a-32-byte-url-safe-key

SEED_ADMIN=true
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password
ADMIN_NAME=Administrator
ADMIN_RESET_PASSWORD=false
```

For production Docker, `DATABASE_URL` is supplied by `docker-compose.yml`.
You do not need to manually put it in `backend/.env` unless you are running the
backend outside Docker.

### 3. Start production Docker

```bash
docker compose up -d --build
```

Open:

- HTTP: http://your-ec2-ip
- HTTPS: https://your-domain, after real certs are installed

View logs:

```bash
docker compose logs -f backend
docker compose logs -f nginx
```

Stop containers without deleting data:

```bash
docker compose down
```

Stop containers and delete database volumes:

```bash
docker compose down -v
```

Use `down -v` only when you intentionally want to reset the database.

## Admin Account and TOTP Login

The backend runs `seed_admin.py` during container boot when `SEED_ADMIN=true`.

Admin seed behavior:

- If `ADMIN_PASSWORD` is missing, admin seeding is skipped.
- If the admin does not exist, it is created.
- If the admin already exists, the password is left unchanged by default.
- Set `ADMIN_RESET_PASSWORD=true` only when you intentionally want to reset the
  existing admin password.

First admin login:

1. Go to the app.
2. Log in using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. The app shows the TOTP setup QR code.
4. Scan it with an authenticator app.
5. Enter the current TOTP code to finish login.

After first setup, normal admin login requires:

- email
- password
- TOTP code from the authenticator app

After resetting an admin password, set this back:

```env
ADMIN_RESET_PASSWORD=false
```

## TLS / HTTPS

Nginx starts in HTTP-only mode when no TLS certs are found.

To enable HTTPS, place real certificate files here:

```text
nginx/certs/cert.pem
nginx/certs/key.pem
```

Then restart:

```bash
docker compose up -d --build nginx
```

If you see:

```text
[nginx] No TLS certificates found - starting with HTTP only
```

that is expected until `cert.pem` and `key.pem` exist.

## Manual Local Setup Without Docker

Docker is recommended. Use this only if you want to run services directly on
your machine.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env
```

For manual local backend runs, `backend/.env` must include a real local
database URL:

```env
FLASK_ENV=development
SECRET_KEY=replace-with-a-local-secret
JWT_SECRET_KEY=replace-with-a-local-jwt-secret
DATABASE_URL=postgresql://cvbuilder:your-local-password@localhost:5432/cvbuilder
REDIS_URL=redis://localhost:6379/0
FRONTEND_URL=http://localhost:3000
```

Then run:

```bash
flask db upgrade
python wsgi.py
```

Backend URL:

- http://localhost:5000

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend URL:

- http://localhost:5173

## Tests

Run backend tests in Docker:

```bash
docker compose -f docker-compose.dev.yml run --rm --no-deps --entrypoint pytest \
  -e FLASK_ENV=testing \
  -e SECRET_KEY=test-secret-key \
  -e JWT_SECRET_KEY=test-jwt-secret-key \
  -e REDIS_URL=memory:// \
  backend tests -q
```

Run backend tests manually:

```bash
cd backend
pytest tests -q
```

The backend test suite uses SQLite in memory and does not require a running
PostgreSQL database.

Frontend test runner is not currently configured. To verify the frontend build:

```bash
cd frontend
npm install
npm run build
```

## Important Environment Variables

Backend:

```text
FLASK_ENV              development, testing, or production
SECRET_KEY             Flask secret key
JWT_SECRET_KEY         JWT signing secret
DATABASE_URL           Required outside Docker/test mode if backend runs manually
REDIS_URL              Redis connection string
FRONTEND_URL           Public frontend URL
TOTP_ENCRYPTION_KEY    Key used to encrypt TOTP secrets at rest
SEED_ADMIN             true/false, enables admin seeding on boot
ADMIN_EMAIL            seeded admin email
ADMIN_PASSWORD         seeded admin password
ADMIN_NAME             seeded admin display name
ADMIN_RESET_PASSWORD   true only when intentionally rotating admin password
```

Root Docker Compose:

```text
POSTGRES_PASSWORD      Password for the Postgres container and generated DATABASE_URL
```

## Common Commands

Rebuild and run production stack in background:

```bash
docker compose up -d --build
```

Run production stack in foreground:

```bash
docker compose up --build
```

The `-d` flag means detached mode. Without `-d`, logs stay attached to your
terminal until you stop them.

Restart only backend:

```bash
docker compose up -d --build backend
```

Run admin seed manually:

```bash
docker compose exec backend python seed_admin.py
```

Open backend env on EC2:

```bash
nano backend/.env
```

Open root compose env on EC2:

```bash
nano .env
```

## Troubleshooting

### `DATABASE_URL must be set for non-testing environments`

The backend started without a database URL.

For production Docker, make sure the root `.env` has:

```env
POSTGRES_PASSWORD=replace-with-a-strong-postgres-password
```

Then restart:

```bash
docker compose up -d --build
```

For manual backend runs, put `DATABASE_URL` in `backend/.env`.

### Admin login says invalid credentials

Check backend logs:

```bash
docker compose logs backend
```

If you see:

```text
[seed_admin] ADMIN_PASSWORD not set - skipping admin seed.
```

then set `ADMIN_PASSWORD` in `backend/.env` and restart the backend.

If the admin already exists and you need to change its password, temporarily set:

```env
ADMIN_RESET_PASSWORD=true
```

Restart once, log in, then set it back to `false`.

### Nginx entrypoint fails on another machine

If someone sees an error like:

```text
/etc/nginx/entrypoint.sh: set: line 2: illegal option -
```

the file may have Windows CRLF line endings. On Linux/EC2, fix it with:

```bash
sed -i 's/\r$//' nginx/entrypoint.sh
docker compose up -d --build nginx
```

### Nginx starts with HTTP only

This means TLS certs were not found. It is fine for early EC2 testing.
Install `nginx/certs/cert.pem` and `nginx/certs/key.pem` when HTTPS is ready.

### Do not use `docker compose down -v` casually

`down` stops containers and keeps database data.

`down -v` stops containers and deletes volumes, including the Postgres database.

## Project Structure

```text
backend/
  app/
    models/       Database models
    routes/       API endpoints
    schemas/      Request validation
    services/     Business logic and PDF generation
    templates/    Resume PDF templates
    utils/        Security, audit, and helper utilities
  migrations/     Alembic migrations
  tests/          Pytest suite
  boot.py         Container startup script
  seed_admin.py   Admin seeding script
  wsgi.py         Flask entry point

frontend/
  src/
    components/   Reusable React components
    context/      Auth context
    pages/        App pages
    services/     API client
  vite.config.js  Vite config and proxy

nginx/
  nginx-http.conf
  nginx-https.conf
  entrypoint.sh
  certs/

docker-compose.yml      Production compose stack
docker-compose.dev.yml  Local development compose stack
```
