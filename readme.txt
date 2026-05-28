================================================================================
  CVBuilder - Setup & Run Guide
================================================================================

CVBuilder is a full-stack resume builder application.
  Frontend  : React + Vite (dev port 5173)
  Backend   : Flask/Python (port 5000)
  Database  : PostgreSQL 16
  Cache     : Redis 7

================================================================================
  PREREQUISITES
================================================================================

Make sure the following are installed before you begin:

  - Python 3.12+          https://www.python.org/downloads/
  - Node.js 20+           https://nodejs.org/
  - PostgreSQL 16         https://www.postgresql.org/download/
  - Redis 7               https://redis.io/download/
  - Docker + Compose      https://docs.docker.com/get-docker/   (optional)

================================================================================
  OPTION A: DOCKER COMPOSE (Recommended)
================================================================================

This is the easiest way to run the full stack, including Nginx as a reverse
proxy. Docker must be installed and running.

---- Development (backend + DB + Redis in containers, Vite runs locally) ----

  1. Navigate to the project root:
       cd cvbuilder

  2. Start the backend services (db, redis, backend):
       docker compose -f docker-compose.dev.yml up --build

     The Flask backend will be available at http://localhost:5000
     PostgreSQL is exposed on localhost:5432
     Redis is exposed on localhost:6379

  3. In a separate terminal, start the Vite dev server:
       cd frontend
       npm install
       npm start

     The app will be available at http://localhost:5173
     API requests are proxied to http://localhost:5000 via vite.config.js

---- Production ----

  1. Navigate to the project root:
       cd cvbuilder

  2. Create a backend environment file:
       copy backend\.env.example backend\.env       (Windows)
       cp  backend/.env.example  backend/.env        (Mac/Linux)

  3. Open backend\.env and set at minimum:
       SECRET_KEY=<any long random string>
       JWT_SECRET_KEY=<a different long random string>

  4. (Optional) For HTTPS, place TLS certificates in:
       cvbuilder/nginx/certs/cert.pem
       cvbuilder/nginx/certs/key.pem

     Nginx automatically detects whether certificates are present at startup
     and selects the HTTPS config (port 443, HTTP->HTTPS redirect) or the
     HTTP-only config (port 80) accordingly.

  5. Start all services:
       docker compose up --build -d

  6. Access the app:
       http://localhost       (HTTP, if no certs)
       https://localhost      (HTTPS, if certs placed in nginx/certs/)

  To stop:
       docker compose down

  To stop and delete all data volumes:
       docker compose down -v

================================================================================
  OPTION B: MANUAL LOCAL SETUP
================================================================================

Use this if you prefer to run each service directly without Docker.

---- 1. Database Setup ----

  a) Start PostgreSQL and create the database:

       psql -U postgres
       CREATE USER cvbuilder WITH PASSWORD 'cvbuilder';
       CREATE DATABASE cvbuilder OWNER cvbuilder;
       \q

  b) Start Redis (default port 6379):
       redis-server

---- 2. Backend Setup ----

  a) Navigate to the backend folder:
       cd cvbuilder\backend

  b) Create and activate a virtual environment:
       python -m venv venv

       Windows:   venv\Scripts\activate
       Mac/Linux: source venv/bin/activate

  c) Install Python dependencies:
       pip install -r requirements.txt

  d) Create the environment file:
       copy .env.example .env       (Windows)
       cp   .env.example .env        (Mac/Linux)

     Open .env and set at minimum:
       FLASK_ENV=development
       SECRET_KEY=<any long random string>
       JWT_SECRET_KEY=<a different long random string>
       DATABASE_URL=postgresql://cvbuilder:cvbuilder@localhost:5432/cvbuilder
       REDIS_URL=redis://localhost:6379/0

  e) Apply database migrations:
       flask db upgrade

  f) Start the backend server:
       python wsgi.py

     The API will be available at http://localhost:5000

---- 3. Frontend Setup ----

  Open a new terminal window.

  a) Navigate to the frontend folder:
       cd cvbuilder\frontend

  b) Install Node dependencies:
       npm install

  c) Start the Vite development server:
       npm start

     The app will be available at http://localhost:5173
     API requests are proxied to http://localhost:5000 via vite.config.js

================================================================================
  RUNNING TESTS
================================================================================

---- Backend Tests ----

  Make sure the virtual environment is active, then from cvbuilder\backend:

    Run all tests:
      pytest tests/ -v

    Run with coverage report:
      pytest tests/ -v --cov=app --cov-report=term-missing

  Tests use an in-memory SQLite database and do not require a running
  PostgreSQL or Redis instance.

---- Frontend Tests ----

  No frontend test runner is currently configured.
  The project uses Vite as its build tool; Jest and React Testing Library
  were removed along with Create React App (react-scripts).

================================================================================
  ENVIRONMENT VARIABLES REFERENCE
================================================================================

  Variable          Description                             Example
  ----------------  --------------------------------------  ---------------------------
  FLASK_ENV         Runtime environment                     development / production
  SECRET_KEY        Flask session secret                    (long random string)
  JWT_SECRET_KEY    JWT signing key                         (long random string)
  DATABASE_URL      PostgreSQL connection string            postgresql://user:pw@host/db
  REDIS_URL         Redis connection string                 redis://localhost:6379/0

================================================================================
  PROJECT STRUCTURE (OVERVIEW)
================================================================================

  cvbuilder/
  |-- backend/
  |   |-- app/
  |   |   |-- models/         Database models (User, Resume, AuditLog)
  |   |   |-- routes/         API endpoints (auth, resumes, profile, admin)
  |   |   |-- schemas/        Request validation schemas (marshmallow)
  |   |   |-- services/       Business logic (PDF generation)
  |   |   |-- templates/      Jinja2 HTML templates for PDF resume generation
  |   |   |-- utils/          Helpers, security utilities, audit logging
  |   |   |-- config.py       Environment configurations
  |   |   |-- extensions.py   Flask extension instances
  |   |-- migrations/         Alembic database migration files
  |   |-- tests/              pytest test suite
  |   |-- requirements.txt    Python dependencies
  |   |-- wsgi.py             WSGI entry point
  |   |-- boot.py             Pre-start script (DB wait, migrations, exec gunicorn)
  |
  |-- frontend/
  |   |-- src/
  |   |   |-- components/     Reusable UI components (auth, resume wizard)
  |   |   |-- context/        React context (AuthContext)
  |   |   |-- pages/          Page-level components (Dashboard, Profile, Admin)
  |   |   |-- services/       Axios API client
  |   |-- index.html          Vite entry point HTML
  |   |-- vite.config.js      Vite build + dev proxy configuration
  |   |-- package.json        Node dependencies
  |
  |-- nginx/
  |   |-- nginx-http.conf     Nginx config used when no TLS certs are present
  |   |-- nginx-https.conf    Nginx config used when TLS certs are present
  |   |-- entrypoint.sh       Auto-selects HTTP or HTTPS config at container start
  |   |-- certs/              Place cert.pem and key.pem here to enable HTTPS
  |
  |-- .github/workflows/      GitHub Actions CI pipeline
  |-- docker-compose.yml      Production Docker Compose
  |-- docker-compose.dev.yml  Development Docker Compose (backend services only)

================================================================================
  COMMON ISSUES
================================================================================

  "flask: command not found"
    -> Make sure the virtual environment is activated.

  "FATAL: password authentication failed for user cvbuilder"
    -> Double-check the DATABASE_URL in .env matches your PostgreSQL credentials.

  "Connection refused" on port 5000 from the frontend
    -> Ensure the backend is running before starting the Vite dev server.
       vite.config.js proxies /auth/*, /profile, /resumes/*, /admin/*, /health
       to http://localhost:5000 automatically.

  Port already in use (5000 or 5173)
    -> Kill the process using that port, or change the port in wsgi.py (backend)
       or in vite.config.js under server.port (frontend).

  Nginx starts in HTTP mode even with certificates placed
    -> Ensure files are named exactly cert.pem and key.pem inside nginx/certs/.
       The entrypoint script checks for those exact filenames.

================================================================================
