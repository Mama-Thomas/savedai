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
            bm.transcript or "",
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

def build_bookmark_text(bm: Bookmark) -> str:
    # Include the transcript (when present) so embeddings reflect what's
    # actually said in videos / written in articles, not just metadata.
    parts = filter(
        None,
        [
            bm.title,
            bm.summary,
            bm.description,
            " ".join(bm.tags or []),
            bm.transcript or "",
        ],
    )
    return " ".join(parts) or bm.url


def embed_texts(texts: List[str]) -> "np.ndarray":
    """Embed texts via OpenAI and return unit-normalized vectors."""
    from openai import OpenAI
    from app.config import settings

    oai = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = oai.embeddings.create(input=texts, model="text-embedding-3-small")
    vectors = np.array([d.embedding for d in response.data], dtype="float32")
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    return vectors / norms


def embed_single(text: str) -> List[float]:
    """Embed a single string and return a plain python list for DB storage."""
    if not FAISS_AVAILABLE:
        return []
    try:
        vec = embed_texts([text])[0]
        return [float(x) for x in vec]
    except Exception:
        return []


class FAISSIndex:
    """Build a FAISS index from pre-computed embeddings stored on Bookmark rows."""

    def __init__(self):
        self._index: Optional["faiss.IndexFlatIP"] = None
        self._ids: List[int] = []

    def build(self, bookmarks: List[Bookmark]):
        usable = [bm for bm in bookmarks if bm.embedding]
        if not usable:
            self._index = None
            self._ids = []
            return
        vectors = np.array([bm.embedding for bm in usable], dtype="float32")
        dim = vectors.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(vectors)
        self._index = index
        self._ids = [bm.id for bm in usable]

    def query(self, query_text: str, k: int = 10, threshold: float = 0.38) -> List[int]:
        if self._index is None or not self._ids:
            return []
        q_vec = embed_texts([query_text])
        k = min(k, len(self._ids))
        distances, indices = self._index.search(q_vec, k)
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1 or dist < threshold:
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


# ---------------------------------------------------------------------------
# Highlight snippets
# ---------------------------------------------------------------------------

def _match_terms(query: str) -> List[str]:
    """Lowercased, stopword-filtered query tokens worth highlighting."""
    tokens = re.findall(r"\w+", query.lower())
    terms = [t for t in tokens if t not in _STOPWORDS and len(t) >= 2]
    # De-dup while keeping order.
    seen = set()
    out = []
    for t in terms:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _excerpt_around(text: str, terms: List[str], radius: int = 90) -> Optional[str]:
    """Return a short excerpt of `text` centered on the first term match.
    Uses a radius of characters on either side. Returns None if no term hits."""
    if not text or not terms:
        return None
    lower = text.lower()
    best_idx = -1
    best_len = 0
    for t in terms:
        idx = lower.find(t)
        if idx != -1 and (best_idx == -1 or idx < best_idx):
            best_idx = idx
            best_len = len(t)
    if best_idx == -1:
        return None
    start = max(0, best_idx - radius)
    end = min(len(text), best_idx + best_len + radius)
    # Snap to word boundaries so we don't start / end mid-word.
    if start > 0:
        space = text.rfind(" ", 0, start + 20)
        if space != -1 and space >= start:
            start = space + 1
    if end < len(text):
        space = text.find(" ", end - 20)
        if space != -1:
            end = space
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "... " + snippet
    if end < len(text):
        snippet = snippet + " ..."
    return snippet


def build_match_info(bm: Bookmark, query: str) -> dict:
    """Pick the best single-field excerpt to show under a search hit.

    Priority: transcript (real content) > summary > description > title > tags.
    Returns a dict with snippet / terms / field or empty values if no hit.
    """
    terms = _match_terms(query)
    if not terms:
        return {"snippet": None, "terms": [], "field": None}

    fields = [
        ("transcript", bm.transcript or ""),
        ("summary", bm.summary or ""),
        ("description", bm.description or ""),
        ("title", bm.title or ""),
        ("tags", " ".join(bm.tags or [])),
    ]
    for field_name, text in fields:
        snippet = _excerpt_around(text, terms)
        if snippet:
            return {"snippet": snippet, "terms": terms, "field": field_name}
    return {"snippet": None, "terms": terms, "field": None}
