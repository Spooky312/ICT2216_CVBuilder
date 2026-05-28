"""
Boot script — runs before the app server starts.
Handles:
  1. Waiting for PostgreSQL to be reachable
  2. Initialising Flask-Migrate on first run
  3. Applying any pending migrations
  4. exec()-ing into the real server process

Using Python instead of a shell script avoids Windows CRLF line-ending
issues that silently break #!/bin/sh shebangs inside Linux containers.
"""
from __future__ import annotations

import os
import sys
import time
import subprocess


def wait_for_db(max_retries: int = 30) -> None:
    import psycopg2

    url = os.environ.get("DATABASE_URL", "")
    for attempt in range(1, max_retries + 1):
        try:
            psycopg2.connect(url).close()
            print(f"[boot] Database ready after {attempt} attempt(s).")
            return
        except psycopg2.OperationalError as exc:
            print(f"[boot] Waiting for database ({attempt}/{max_retries}): {exc}")
            time.sleep(2)

    print("[boot] ERROR: Could not connect to the database. Aborting.")
    sys.exit(1)


def run(*cmd: str, check: bool = True) -> int:
    print(f"[boot] $ {' '.join(cmd)}")
    result = subprocess.run(list(cmd))
    if check and result.returncode != 0:
        print(f"[boot] Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)
    return result.returncode


def main() -> None:
    wait_for_db()

    if not os.path.isdir("migrations"):
        print("[boot] No migrations/ folder — initialising Flask-Migrate...")
        run("flask", "db", "init")
        run("flask", "db", "migrate", "-m", "initial migration")
    else:
        # Auto-generate a new migration if models changed
        run("flask", "db", "migrate", "-m", "auto", check=False)

    print("[boot] Applying database migrations...")
    run("flask", "db", "upgrade")

    # Hand off to the real server (argv[1:] is the CMD passed from compose/Dockerfile)
    server_cmd = sys.argv[1:]
    if not server_cmd:
        print("[boot] No server command given — nothing to exec.")
        sys.exit(1)

    print(f"[boot] Starting server: {' '.join(server_cmd)}")
    os.execvp(server_cmd[0], server_cmd)


if __name__ == "__main__":
    main()
