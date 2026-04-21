"""
RAG: "Ask your bookmarks". Embed the question, retrieve the top-K most
relevant bookmarks via FAISS, and ask GPT to answer using them as context.

For meta questions (how many, list all, summarize my X, etc.) we skip the
FAISS retrieval and give the model the full scope, capped to a safe size,
so counting and broad summaries actually work.
"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import Bookmark, Collection
from app.search import FAISSIndex, FAISS_AVAILABLE


# Words that flag a structural / listing / counting question. For these we
# want the model to see the whole scope, not a top-K semantic slice.
_META_PATTERNS = re.compile(
    r"\b("
    r"how many|count|number of|total|how much|"
    r"list|list all|show all|all of|everything|"
    r"summari[sz]e|summary|overview|recap|"
    r"what('?s| is| are) in|what do i have|what have i saved|"
    r"what('?s| is) in my|"
    r"organi[sz]e|categor"
    r")\b",
    re.IGNORECASE,
)

# Hard cap so we never send a 500-bookmark prompt to GPT.
_MAX_META_BOOKMARKS = 40


def _format_source(i: int, bm: Bookmark) -> str:
    tags = ", ".join(bm.tags or [])
    return (
        f"[{i}] Title: {bm.title or bm.url}\n"
        f"    URL: {bm.url}\n"
        f"    Summary: {bm.summary or bm.description or '(no summary)'}\n"
        f"    Tags: {tags}"
    )


def _collection_overview(db: Session, user_id: int) -> str:
    """Return a short human-readable summary of the user's collection structure.

    Example:
        You have 12 bookmarks total: 5 in Travel, 4 in Love, 3 uncategorized.
    """
    collections = db.query(Collection).filter(Collection.user_id == user_id).all()
    all_bookmarks = db.query(Bookmark).filter(Bookmark.user_id == user_id).all()
    total = len(all_bookmarks)

    if total == 0:
        return "The user has no bookmarks yet."

    counts_by_cid = {}
    uncategorized = 0
    for bm in all_bookmarks:
        if bm.collection_id is None:
            uncategorized += 1
        else:
            counts_by_cid[bm.collection_id] = counts_by_cid.get(bm.collection_id, 0) + 1

    parts = []
    for c in collections:
        n = counts_by_cid.get(c.id, 0)
        if n > 0:
            parts.append(f"{n} in {c.name}")
    if uncategorized > 0:
        parts.append(f"{uncategorized} uncategorized")

    if parts:
        return f"The user has {total} bookmarks total: " + ", ".join(parts) + "."
    return f"The user has {total} bookmarks total."


def _is_meta_question(question: str) -> bool:
    return bool(_META_PATTERNS.search(question))


def _detect_scope_from_question(
    db: Session, user_id: int, question: str
) -> Optional[int]:
    """If the question mentions 'uncategorized' or a collection name, return that
    collection_id. 0 = uncategorized, positive int = specific collection, None = no
    match found in the text."""
    q = question.lower()
    if re.search(r"\buncategor(?:ized|ised)\b", q):
        return 0
    collections = db.query(Collection).filter(Collection.user_id == user_id).all()
    # Prefer the longest-name match so "software engineering" beats "software".
    for c in sorted(collections, key=lambda c: len(c.name), reverse=True):
        if c.name.lower() in q:
            return c.id
    return None


def ask_bookmarks(
    db: Session,
    user_id: int,
    question: str,
    k: int = 5,
    collection_id: Optional[int] = None,
) -> Tuple[str, List[Bookmark]]:
    """Retrieve relevant bookmarks, then ask GPT to answer using them as sources.

    When `collection_id` is:
        None : search across all of the user's bookmarks
        0    : limit to bookmarks with no collection (Uncategorized)
        >0   : limit to bookmarks belonging to that collection
    """
    # If the user is asking from "All bookmarks" but their question mentions a
    # specific collection ("how many uncategorized", "summarize travel"), narrow
    # scope to that collection so sources and counts are correct.
    effective_collection_id = collection_id
    if collection_id is None:
        detected = _detect_scope_from_question(db, user_id, question)
        if detected is not None:
            effective_collection_id = detected

    query = db.query(Bookmark).filter(Bookmark.user_id == user_id)
    if effective_collection_id == 0:
        query = query.filter(Bookmark.collection_id.is_(None))
    elif effective_collection_id is not None and effective_collection_id > 0:
        query = query.filter(Bookmark.collection_id == effective_collection_id)

    bookmarks = query.all()
    if not bookmarks:
        if effective_collection_id == 0:
            return "You don't have any uncategorized bookmarks.", []
        if effective_collection_id is not None and effective_collection_id > 0:
            return "There are no bookmarks in this collection yet.", []
        return "You don't have any saved bookmarks yet.", []

    meta_mode = _is_meta_question(question)

    sources: List[Bookmark] = []

    if meta_mode:
        # For "how many", "summarize", "list", etc., give the model the full
        # scope (capped), sorted newest-first.
        sources = sorted(bookmarks, key=lambda b: b.created_at, reverse=True)[
            :_MAX_META_BOOKMARKS
        ]
    else:
        if FAISS_AVAILABLE and len(bookmarks) > 1:
            index = FAISSIndex()
            index.build(bookmarks)
            matched_ids = index.query(question, k=k, threshold=0.2)
            id_to_bm = {bm.id: bm for bm in bookmarks}
            sources = [id_to_bm[bid] for bid in matched_ids if bid in id_to_bm]

        # Fallback: most recent bookmarks from the selected scope.
        if not sources:
            sources = sorted(bookmarks, key=lambda b: b.created_at, reverse=True)[:k]

    from openai import OpenAI
    from app.config import settings

    context = "\n\n".join(_format_source(i + 1, bm) for i, bm in enumerate(sources))

    if effective_collection_id is None:
        scope_note = "across all of the user's bookmarks"
    elif effective_collection_id == 0:
        scope_note = "within the user's Uncategorized bookmarks (those not in any collection)"
    else:
        coll = (
            db.query(Collection)
            .filter(
                Collection.id == effective_collection_id,
                Collection.user_id == user_id,
            )
            .first()
        )
        scope_note = (
            f"within the user's '{coll.name}' collection"
            if coll
            else "within the user's currently selected collection"
        )

    # Always include the collection structure so meta questions can be answered
    # even when scope is "All bookmarks".
    overview = _collection_overview(db, user_id)

    if meta_mode:
        mode_instruction = (
            f"This looks like a structural / counting / summary question. "
            f"The {len(sources)} bookmarks below are the FULL set in scope "
            f"(the user has no other bookmarks matching this scope). "
            f"Count, list, or summarize them directly. Do not say you lack information "
            f"if the answer can be derived from counting or reading the list."
        )
    else:
        mode_instruction = (
            "Use ONLY the bookmarks below as your source of truth. "
            "If the answer isn't in them, say so."
        )

    prompt = (
        "You are a helpful assistant answering questions about a user's saved bookmarks.\n"
        f"User's library overview: {overview}\n"
        f"The bookmarks below are scoped {scope_note}.\n"
        f"{mode_instruction}\n"
        "Cite sources by their [number] when relevant.\n\n"
        f"User question: {question}\n\n"
        f"Saved bookmarks:\n{context}\n\n"
        "Answer concisely:"
    )

    oai = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = oai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=500,
    )
    answer = response.choices[0].message.content.strip()
    return answer, sources
