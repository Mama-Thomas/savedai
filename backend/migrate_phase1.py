"""
One-off migration for Phase 1:
  - Add `embedding` and `collection_id` columns to `bookmarks`
  - Create `collections` table
  - Backfill embeddings for existing bookmarks

Run once from backend/ with:
  python migrate_phase1.py
"""
from sqlalchemy import text

from app.database import Base, engine, SessionLocal
from app import models
from app.search import build_bookmark_text, embed_single


def migrate():
    # Create any missing tables (this will create `collections`)
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        # Add embedding column if missing
        conn.execute(text(
            "ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS embedding DOUBLE PRECISION[]"
        ))
        # Add collection_id column if missing
        conn.execute(text(
            "ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS collection_id INTEGER "
            "REFERENCES collections(id) ON DELETE SET NULL"
        ))

    print("Schema updated. Backfilling embeddings...")

    db = SessionLocal()
    try:
        bms = db.query(models.Bookmark).filter(models.Bookmark.embedding.is_(None)).all()
        for i, bm in enumerate(bms, 1):
            try:
                bm.embedding = embed_single(build_bookmark_text(bm))
                print(f"  [{i}/{len(bms)}] embedded bookmark {bm.id}")
            except Exception as e:
                print(f"  [{i}/{len(bms)}] FAILED bookmark {bm.id}: {e}")
        db.commit()
    finally:
        db.close()

    print("Migration complete.")


if __name__ == "__main__":
    migrate()
