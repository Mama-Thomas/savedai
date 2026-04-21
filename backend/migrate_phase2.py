"""Phase 2 migration.

Adds:
- bookmarks.transcript TEXT
- bookmarks.transcript_source VARCHAR(32)
- collections.share_token VARCHAR UNIQUE (nullable)

Idempotent: safe to re-run.
"""
from sqlalchemy import text

from app.database import engine


MIGRATIONS = [
    # Bookmarks: transcript body + where it came from.
    "ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS transcript TEXT",
    "ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS transcript_source VARCHAR(32)",
    # Collections: public share token.
    "ALTER TABLE collections ADD COLUMN IF NOT EXISTS share_token VARCHAR",
    (
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_collections_share_token "
        "ON collections (share_token)"
    ),
]


def run():
    with engine.begin() as conn:
        for stmt in MIGRATIONS:
            print(f"  -> {stmt}")
            conn.execute(text(stmt))
    print("Phase 2 migration complete.")


if __name__ == "__main__":
    run()
