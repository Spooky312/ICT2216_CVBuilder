import argparse
import sys
from app import create_app
from app.models.audit_log import AuditLog

def main():
    parser = argparse.ArgumentParser(description="Clean up old audit logs.")
    parser.add_argument("--days", type=int, default=90, help="Delete logs older than this many days (default: 90)")
    args = parser.parse_args()

    if args.days < 90:
        print("Error: Minimum retention period is 90 days for security compliance.", file=sys.stderr)
        sys.exit(1)

    # Boot up a mini Flask environment specifically for the script
    app = create_app()
    with app.app_context():
        print(f"Starting audit log cleanup for logs older than {args.days} days...")
        deleted = AuditLog.cleanup_old_logs(args.days)
        print(f"Cleanup complete! Deleted {deleted} old log entries.")

if __name__ == "__main__":
    main()