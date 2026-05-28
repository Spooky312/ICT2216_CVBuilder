#!/bin/sh
set -e

echo "[entrypoint] Waiting for database to be ready..."
until flask db current > /dev/null 2>&1 || flask db upgrade > /dev/null 2>&1; do
  echo "[entrypoint] DB not ready yet, retrying in 2s..."
  sleep 2
done 2>/dev/null || true

# Bootstrap migrations on first run
if [ ! -d "migrations" ]; then
  echo "[entrypoint] No migrations folder found — initialising Flask-Migrate..."
  flask db init
  flask db migrate -m "initial migration"
fi

echo "[entrypoint] Applying database migrations..."
flask db upgrade

echo "[entrypoint] Starting application: $*"
exec "$@"
