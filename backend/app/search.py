"""
Search module — uses FAISS for semantic vector search when embeddings are
available, and falls back to simple keyword matching otherwise.
All queries are scoped to the requesting user.
"""
from __future__ import annotations

import re
from typing import List, Optional

try:
    import faiss
    import numpy as np

    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

from sqlalchemy.orm import Session

from app.models import Bookmark


# ---------------------------------------------------------------------------
# Keyword search (always available)
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "this", "that", "these", "those", "it", "its", "of", "for", "to", "in",
    "on", "at", "by", "with", "about", "as", "from", "and", "or", "but",
    "if", "then", "than", "so", "i", "me", "my", "we", "our", "you", "your",
    "he", "she", "they", "them", "their", "please", "show", "find", "give",
    "video", "videos", "post", "posts", "content", "reel", "reels", "some",
    "any", "something", "thing", "things",
}


def _tokenize(text: str) -> set:
    return set(re.findall(r"\w+", text.lower()))


def _clean_query(text: str) -> str:
    tokens = re.findall(r"\w+", text.lower())
    meaningful = [t for t in tokens if t not in _STOPWORDS]
    return " ".join(meaningful) or text


def keyword_search(db: Session, query: str, user_id: int, limit: int = 50) -> List[Bookmark]:
    # Strip stopwords and very short tokens so "a video about fiber" searches for "fiber"
    query_tokens = {t for t in _tokenize(query) if t not in _STOPWORDS and len(t) >= 3}
    if not query_tokens:
        return []
    bookmarks = db.query(Bookmark).filter(Bookmark.user_id == user_id).all()
    scored = []
    for bm in bookmarks:
        haystack = " ".join(filter(None, [
            bm.title or "",
            bm.summary or "",
            bm.description or "",
            " ".join(bm.tags or []),
            bm.url,
        ])).lower()
        bm_tokens = _tokenize(haystack)
        exact_overlap = len(query_tokens & bm_tokens)
        substring_hits = sum(1 for qt in query_tokens if qt in haystack)
        score = exact_overlap * 2 + substring_hits
        if score > 0:
            scored.append((score, bm))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [bm for _, bm in scored[:limit]]


# ---------------------------------------------------------------------------
# FAISS-based semantic search (optional, built on OpenAI embeddings)
# ---------------------------------------------------------------------------

class FAISSIndex:
    """In-memory FAISS index rebuilt per-user on each search request."""

    def __init__(self):
        self._index: Optional["faiss.IndexFlatIP"] = None
        self._ids: List[int] = []

    def _embed(self, texts: List[str]) -> "np.ndarray":
        from openai import OpenAI
        from app.config import settings

        oai = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = oai.embeddings.create(
            input=texts,
            model="text-embedding-3-small",
        )
        vectors = np.array([d.embedding for d in response.data], dtype="float32")
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        return vectors / norms

    def build(self, bookmarks: List[Bookmark]):
        if not bookmarks:
            self._index = None
            self._ids = []
            return

        texts = []
        for bm in bookmarks:
            parts = filter(None, [bm.title, bm.summary, bm.description, " ".join(bm.tags or [])])
            texts.append(" ".join(parts) or bm.url)

        vectors = self._embed(texts)
        dim = vectors.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(vectors)
        self._index = index
        self._ids = [bm.id for bm in bookmarks]

    def query(self, query_text: str, k: int = 10) -> List[int]:
        if self._index is None or not self._ids:
            return []
        q_vec = self._embed([query_text])
        k = min(k, len(self._ids))
        distances, indices = self._index.search(q_vec, k)
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1 or dist < 0.38:
                continue
            results.append(self._ids[idx])
        return results


_faiss_index = FAISSIndex() if FAISS_AVAILABLE else None


def semantic_search(db: Session, query: str, user_id: int, limit: int = 20) -> List[Bookmark]:
    if not FAISS_AVAILABLE or _faiss_index is None:
        return keyword_search(db, query, user_id, limit)

    bookmarks = db.query(Bookmark).filter(Bookmark.user_id == user_id).all()
    _faiss_index.build(bookmarks)
    matched_ids = _faiss_index.query(_clean_query(query), k=limit)

    if not matched_ids:
        return keyword_search(db, query, user_id, limit)

    id_to_bm = {bm.id: bm for bm in bookmarks}
    return [id_to_bm[bid] for bid in matched_ids if bid in id_to_bm]


def search_bookmarks(db: Session, query: str, user_id: int) -> List[Bookmark]:
    """Public entry point: prefer semantic search, fall back to keyword."""
    if not query.strip():
        return (
            db.query(Bookmark)
            .filter(Bookmark.user_id == user_id)
            .order_by(Bookmark.created_at.desc())
            .all()
        )
    try:
        return semantic_search(db, query, user_id)
    except Exception:
        return keyword_search(db, query, user_id)
