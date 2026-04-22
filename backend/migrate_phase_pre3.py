"""Pre-phase-3 migration.

Adds the two password-reset columns to the users table:
  - password_reset_hash   (text, nullable)
  - password_reset_expires (timestamp, nullable)

Idempotent: uses IF NOT EXISTS so it is safe to run multiple times.

Usage:
  cd backend
  python migrate_phase_pre3.py
"""

from sqlalchemy import text

from app.database import engine


STATEMENTS = [
    # Both columns default to NULL. No reset is pending unless a row has values.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_hash TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP",
]


def main() -> None:
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print(f"Running: {stmt}")
            conn.execute(text(stmt))
    print("\nDone. users table now has password_reset_hash and password_reset_expires.")


if __name__ == "__main__":
    main()
