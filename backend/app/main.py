import csv
import difflib
import io
import re
from typing import Optional

import requests
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

from app import models, schemas
from app.ai import generate_summary_and_tags
from app.ask import ask_bookmarks
from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    rate_limit_key,
    verify_password,
)
from app.database import Base, engine, get_db
from app.metadata import fetch_metadata
from app.transcript import fetch_transcript
from app.search import (
    build_bookmark_text,
    build_match_info,
    embed_single,
    search_bookmarks,
)

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=rate_limit_key)

app = FastAPI(title="SavedAI", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/proxy-image")
def proxy_image(url: str):
    """Proxy images from restricted CDNs (e.g. Instagram) to bypass browser CORS."""
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Referer": "https://www.instagram.com/",
        }
        resp = requests.get(url, headers=headers, timeout=10, stream=True)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg")
        return Response(content=resp.content, media_type=content_type)
    except Exception:
        raise HTTPException(status_code=404, detail="Image not available")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.post("/auth/register", response_model=schemas.TokenResponse, status_code=201)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id)}


@app.post("/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": create_access_token(user.id)}


@app.get("/auth/me", response_model=schemas.UserResponse)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ---------------------------------------------------------------------------
# Bookmark routes (all require authentication)
# ---------------------------------------------------------------------------

@app.get("/bookmarks", response_model=list[schemas.BookmarkResponse])
def list_bookmarks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Bookmark)
        .filter(models.Bookmark.user_id == current_user.id)
        .order_by(models.Bookmark.created_at.desc())
        .all()
    )


@app.post("/bookmarks", response_model=schemas.BookmarkResponse, status_code=201)
@limiter.limit("20/hour")
def create_bookmark(
    request: Request,
    payload: schemas.BookmarkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Validate collection ownership if provided
    if payload.collection_id is not None:
        coll = (
            db.query(models.Collection)
            .filter(
                models.Collection.id == payload.collection_id,
                models.Collection.user_id == current_user.id,
            )
            .first()
        )
        if not coll:
            raise HTTPException(status_code=404, detail="Collection not found")

    # Prevent duplicate bookmarks for the same user
    existing = (
        db.query(models.Bookmark)
        .filter(
            models.Bookmark.user_id == current_user.id,
            models.Bookmark.url == payload.url,
        )
        .first()
    )
    if existing:
        existing_collection_name = None
        if existing.collection_id is not None:
            existing_coll = (
                db.query(models.Collection)
                .filter(models.Collection.id == existing.collection_id)
                .first()
            )
            if existing_coll:
                existing_collection_name = existing_coll.name
        location = (
            f"in '{existing_collection_name}'"
            if existing_collection_name
            else "in Uncategorized"
        )
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_bookmark",
                "message": f"You already saved this bookmark {location}.",
                "bookmark_id": existing.id,
                "url": existing.url,
                "title": existing.title,
                "collection_id": existing.collection_id,
                "collection_name": existing_collection_name,
            },
        )

    # Fetch page metadata
    title, description, image_url = fetch_metadata(payload.url)

    # Fetch transcript / article body. Best-effort, never fatal.
    try:
        transcript, transcript_source = fetch_transcript(payload.url)
    except Exception:
        transcript, transcript_source = None, "none"

    # AI summary + tags — pass transcript through so summaries reflect real content.
    try:
        summary, tags = generate_summary_and_tags(
            payload.url,
            title or "",
            description or "",
            transcript=transcript,
            transcript_source=transcript_source,
        )
    except Exception:
        summary = description or ""
        tags = []

    bm = models.Bookmark(
        url=payload.url,
        title=title,
        description=description,
        image_url=image_url,
        summary=summary,
        tags=tags,
        transcript=transcript,
        transcript_source=transcript_source,
        user_id=current_user.id,
        collection_id=payload.collection_id,
    )
    # Cache the embedding so search doesn't re-embed every bookmark on each query
    try:
        bm.embedding = embed_single(build_bookmark_text(bm))
    except Exception:
        bm.embedding = None
    db.add(bm)
    db.commit()
    db.refresh(bm)
    return bm


@app.patch("/bookmarks/{bookmark_id}", response_model=schemas.BookmarkResponse)
def update_bookmark(
    bookmark_id: int,
    payload: schemas.BookmarkUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bm = (
        db.query(models.Bookmark)
        .filter(
            models.Bookmark.id == bookmark_id,
            models.Bookmark.user_id == current_user.id,
        )
        .first()
    )
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    if payload.collection_id is not None:
        # Verify collection belongs to user (or clear it if 0)
        if payload.collection_id == 0:
            bm.collection_id = None
        else:
            coll = (
                db.query(models.Collection)
                .filter(
                    models.Collection.id == payload.collection_id,
                    models.Collection.user_id == current_user.id,
                )
                .first()
            )
            if not coll:
                raise HTTPException(status_code=404, detail="Collection not found")
            bm.collection_id = payload.collection_id
    db.commit()
    db.refresh(bm)
    return bm


@app.delete("/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(
    bookmark_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bm = (
        db.query(models.Bookmark)
        .filter(
            models.Bookmark.id == bookmark_id,
            models.Bookmark.user_id == current_user.id,
        )
        .first()
    )
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(bm)
    db.commit()


@app.get("/search", response_model=list[schemas.BookmarkResponse])
def search(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    results = search_bookmarks(db, q, user_id=current_user.id)
    if not q.strip():
        return results
    # Attach a snippet + terms per result so the UI can highlight the match.
    out = []
    for bm in results:
        info = build_match_info(bm, q)
        payload = schemas.BookmarkResponse.model_validate(bm).model_dump()
        payload["match_snippet"] = info.get("snippet")
        payload["match_terms"] = info.get("terms") or []
        payload["match_field"] = info.get("field")
        out.append(payload)
    return out


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------


# A small built-in synonym set to catch obvious same-meaning names without
# hitting the LLM on every create. Keys are canonical, values are equivalents.
_COLLECTION_SYNONYMS = {
    "politics": {"political", "government", "governance", "policy", "elections"},
    "travel": {"trip", "vacation", "holiday", "travels", "tourism"},
    "food": {"cooking", "recipe", "recipes", "cuisine", "meals"},
    "fitness": {"workout", "exercise", "gym", "training"},
    "finance": {"money", "investing", "investment", "stocks", "personal finance"},
    "tech": {"technology", "software", "coding", "programming", "dev"},
    "music": {"songs", "playlist", "audio"},
    "fashion": {"style", "outfits", "clothing"},
    "career": {"jobs", "job search", "interview", "interviews", "work"},
    "love": {"relationships", "dating", "romance"},
    "art": {"design", "drawing", "illustration"},
    "education": {"learning", "study", "school"},
}


def _normalize_name(name: str) -> str:
    n = name.strip().lower()
    # Remove non-word characters (keep letters/digits/spaces).
    return re.sub(r"[^\w\s]", "", n)


def _consonant_signature(name: str) -> str:
    """Strip vowels + collapse repeated letters to a rough phonetic signature.
    "love" -> "lv", "luv" -> "lv", "lovelove" -> "lvlv", "lover" -> "lvr"."""
    n = re.sub(r"\s+", "", _normalize_name(name))
    n = re.sub(r"[aeiouy]", "", n)
    # Collapse consecutive repeats: "lvlv" stays, "llv" -> "lv".
    n = re.sub(r"(.)\1+", r"\1", n)
    return n


def _are_synonyms(a: str, b: str) -> bool:
    a_n, b_n = _normalize_name(a), _normalize_name(b)
    for canonical, variants in _COLLECTION_SYNONYMS.items():
        bucket = {canonical} | variants
        if a_n in bucket and b_n in bucket:
            return True
    return False


def _ai_classify_collection(bm, collections: list) -> Optional[dict]:
    """Ask GPT which existing collection best fits this bookmark, or propose
    a brand-new collection name. Returns a dict shaped like the suggest endpoint
    response, or None on failure (caller should fall back to the heuristic).
    """
    try:
        from openai import OpenAI
        from app.config import settings

        # Build a compact view of each existing collection (name + a few tags
        # from its current members) so the model has some signal beyond the
        # name itself.
        from app.models import Bookmark as BookmarkModel  # local to avoid cycles
        existing_summaries: list[str] = []
        from sqlalchemy import inspect
        sess = inspect(bm).session
        for c in collections or []:
            tags_here: set[str] = set()
            # Peek at tags representative of this collection, excluding the
            # bookmark we are classifying so its own tags don't bias the view.
            if sess is not None:
                sibs = (
                    sess.query(BookmarkModel)
                    .filter(
                        BookmarkModel.collection_id == c.id,
                        BookmarkModel.id != bm.id,
                    )
                    .limit(25)
                    .all()
                )
                for s in sibs:
                    for t in (s.tags or []):
                        tags_here.add(t)
                        if len(tags_here) >= 8:
                            break
                    if len(tags_here) >= 8:
                        break
            tag_str = ", ".join(sorted(tags_here)) if tags_here else "(no other items yet)"
            existing_summaries.append(f"- {c.name}: {tag_str}")

        bm_title = bm.title or bm.url
        bm_summary = bm.summary or bm.description or ""
        bm_tags = ", ".join(bm.tags or []) or "(none)"

        existing_block = (
            "\n".join(existing_summaries)
            if existing_summaries
            else "(the user has no collections yet)"
        )

        prompt = (
            "You classify a user's saved bookmark into one of their bookmark "
            "collections, or suggest a new collection name if none fit.\n\n"
            "Rules:\n"
            "1. Pick an EXISTING collection ONLY if it is clearly a topical fit "
            "for this bookmark. Mismatches (e.g. a cooking video in a software "
            "engineering collection) MUST NOT be classified as existing.\n"
            "2. If no existing collection is a clean fit, propose a new one.\n"
            "3. The new name should be 1-3 words, Title Case, describing the topic.\n\n"
            "Respond in this EXACT format and nothing else:\n"
            "EXISTING: <exact existing name>\n"
            "or\n"
            "NEW: <proposed new name>\n\n"
            f"Bookmark title: {bm_title}\n"
            f"Bookmark summary: {bm_summary}\n"
            f"Bookmark tags: {bm_tags}\n\n"
            f"User's existing collections:\n{existing_block}\n"
        )

        oai = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=40,
        )
        raw = (response.choices[0].message.content or "").strip()
        # Parse a single line like "EXISTING: Travel" or "NEW: Cooking".
        line = raw.splitlines()[0].strip() if raw else ""
        if ":" not in line:
            return None
        verdict, value = line.split(":", 1)
        verdict = verdict.strip().upper()
        value = value.strip().strip('"').strip("'")
        if not value:
            return None

        if verdict == "EXISTING":
            for c in collections or []:
                if c.name.lower() == value.lower():
                    return {
                        "type": "existing",
                        "collection_id": c.id,
                        "name": c.name,
                        "reason": f"'{c.name}' looks like the topical fit for this bookmark.",
                    }
            # Model hallucinated a name; treat as NEW.
            return {
                "type": "new",
                "collection_id": None,
                "name": value,
                "reason": "No existing collection looks like a clean fit.",
            }
        if verdict == "NEW":
            return {
                "type": "new",
                "collection_id": None,
                "name": value,
                "reason": "No existing collection looks like a clean fit.",
            }
        return None
    except Exception:
        return None


def _ai_similar_name(target: str, candidates: list[str]) -> Optional[str]:
    """Ask gpt-4o-mini whether any existing name means the same as `target`.
    Returns the matched existing name verbatim or None. Best effort only."""
    if not candidates:
        return None
    try:
        from openai import OpenAI
        from app.config import settings

        oai = OpenAI(api_key=settings.OPENAI_API_KEY)
        list_str = "\n".join(f"- {c}" for c in candidates)
        prompt = (
            "You are helping dedupe user-created bookmark collection names. "
            "Given a NEW name the user wants to create, and a list of their EXISTING "
            "collection names, decide if any existing name refers to the SAME topic "
            "or would hold the same kinds of bookmarks. Consider synonyms, shorthand, "
            "spelling variants, playful misspellings, and repeated words "
            "(e.g. 'luv' -> 'love', 'lovelove' -> 'love', 'cooking' -> 'food'). "
            "If you find a match, respond with EXACTLY that existing name, verbatim. "
            "If no existing name matches, respond with the single word: NONE.\n\n"
            f"New name: {target}\n"
            f"Existing names:\n{list_str}"
        )
        response = oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=30,
        )
        answer = (response.choices[0].message.content or "").strip().strip('"').strip("'")
        if not answer or answer.upper() == "NONE":
            return None
        # Match case-insensitively against candidates to be safe.
        for c in candidates:
            if c.lower() == answer.lower():
                return c
        return None
    except Exception:
        return None


def _fast_similar(target: str, other: str) -> bool:
    """Pure-string similarity check between two normalized names."""
    if not target or not other or target == other:
        return False
    target_stem = target.rstrip("s")
    other_stem = other.rstrip("s")
    # 1. Singular / plural match: "politic" vs "politics".
    if target_stem == other_stem:
        return True
    # 2. Substring containment (min 3 chars) catches "love"/"lovelove".
    if len(target) >= 3 and len(other) >= 3:
        if target in other or other in target:
            return True
    # 3. Consonant signature: catches "love"/"luv".
    t_sig = _consonant_signature(target)
    o_sig = _consonant_signature(other)
    if t_sig and o_sig:
        if t_sig == o_sig:
            return True
        if len(t_sig) >= 2 and len(o_sig) >= 2 and (
            t_sig in o_sig or o_sig in t_sig
        ):
            return True
    # 4. Ratio-based similarity. Lower threshold for short names.
    ratio = difflib.SequenceMatcher(None, target, other).ratio()
    threshold = 0.75 if max(len(target), len(other)) <= 6 else 0.85
    if ratio >= threshold:
        return True
    return False


def _find_similar_collection(
    db: Session, user_id: int, name: str, exclude_id: Optional[int] = None
) -> Optional[models.Collection]:
    """Return an existing collection whose name is a spelling variant, singular
    /plural form, phonetic twin, substring, synonym, or AI-detected equivalent
    of `name`. None if nothing similar."""
    existing_all = (
        db.query(models.Collection)
        .filter(models.Collection.user_id == user_id)
        .all()
    )
    if exclude_id is not None:
        existing_all = [c for c in existing_all if c.id != exclude_id]

    target = _normalize_name(name)
    if not target:
        return None

    # Fast path: string-based checks.
    for c in existing_all:
        other = _normalize_name(c.name)
        if not other:
            continue
        if _fast_similar(target, other):
            return c
        if _are_synonyms(target, other):
            return c

    # AI fallback for synonyms / semantic / playful misspellings we missed.
    if existing_all:
        candidate_names = [c.name for c in existing_all]
        matched_name = _ai_similar_name(name, candidate_names)
        if matched_name:
            for c in existing_all:
                if c.name == matched_name:
                    return c
    return None

@app.get("/collections", response_model=list[schemas.CollectionResponse])
def list_collections(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Collection)
        .filter(models.Collection.user_id == current_user.id)
        .order_by(models.Collection.created_at.asc())
        .all()
    )


@app.post("/collections", response_model=schemas.CollectionResponse, status_code=201)
def create_collection(
    payload: schemas.CollectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Collection name is required")

    # Case-insensitive exact duplicate check: always blocks.
    existing = (
        db.query(models.Collection)
        .filter(
            models.Collection.user_id == current_user.id,
            models.Collection.name.ilike(name),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_collection",
                "message": f"A collection named '{existing.name}' already exists.",
                "existing_id": existing.id,
                "existing_name": existing.name,
            },
        )

    # Fuzzy/similar-name check: surfaced as 409 unless user sets force=true.
    if not payload.force:
        similar = _find_similar_collection(db, current_user.id, name)
        if similar:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "similar_collection",
                    "message": (
                        f"You already have a similar collection called '{similar.name}'. "
                        "Create this one anyway?"
                    ),
                    "existing_id": similar.id,
                    "existing_name": similar.name,
                    "attempted_name": name,
                },
            )

    coll = models.Collection(name=name, user_id=current_user.id)
    db.add(coll)
    db.commit()
    db.refresh(coll)
    return coll


@app.get("/collections/suggest/{bookmark_id}")
def suggest_collection(
    bookmark_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Given a freshly added bookmark, look at its tags/title/summary and
    suggest either an existing collection that already contains similar
    bookmarks, or a brand-new collection name.
    """
    bm = (
        db.query(models.Bookmark)
        .filter(
            models.Bookmark.id == bookmark_id,
            models.Bookmark.user_id == current_user.id,
        )
        .first()
    )
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    bm_tags = {t.lower() for t in (bm.tags or [])}
    # Flatten bookmark text for collection-name keyword matching.
    bm_text = " ".join(
        [
            (bm.title or ""),
            (bm.summary or ""),
            (bm.description or ""),
            " ".join(bm.tags or []),
        ]
    ).lower()

    collections = (
        db.query(models.Collection)
        .filter(models.Collection.user_id == current_user.id)
        .all()
    )

    # --- Primary path: ask GPT to classify this bookmark against existing
    # collections. The model is the most reliable at topic matching, so we
    # start here and fall back to the heuristic only if the call fails.
    ai_result = _ai_classify_collection(bm, collections)
    if ai_result is not None:
        return ai_result

    # --- Fallback heuristic (used when AI is unavailable / network hiccup). ---
    # Score each existing collection by overlap with this bookmark's tags.
    # IMPORTANT: exclude the bookmark itself from its own sibling set, otherwise
    # its own tags inflate the score of whichever collection it was saved to,
    # and suggest_collection always agrees with the user's original choice.
    best_match = None
    best_score = 0
    best_reason = ""
    for c in collections:
        sibling_bookmarks = (
            db.query(models.Bookmark)
            .filter(
                models.Bookmark.user_id == current_user.id,
                models.Bookmark.collection_id == c.id,
                models.Bookmark.id != bm.id,
            )
            .all()
        )
        sibling_tags = set()
        for sib in sibling_bookmarks:
            for t in sib.tags or []:
                sibling_tags.add(t.lower())
        overlap = len(bm_tags & sibling_tags)
        score = overlap * 2  # weight overlap heavier
        reason = f"{overlap} overlapping tag(s) with bookmarks in '{c.name}'."
        # Name appears in bookmark text -> strong signal.
        if c.name.lower() in bm_text:
            score += 3
            reason = f"'{c.name}' matches this bookmark's content."
        if score > best_score:
            best_score = score
            best_match = c
            best_reason = reason

    if best_match and best_score >= 1:
        return {
            "type": "existing",
            "collection_id": best_match.id,
            "name": best_match.name,
            "reason": best_reason,
        }

    # No good match: suggest a new collection name from the AI tags.
    suggested = None
    if bm.tags:
        # Prefer a multi-word tag or the first tag; title-case for display.
        candidates = sorted(bm.tags, key=lambda t: (-len(t.split()), -len(t)))
        suggested = candidates[0].title()
    if not suggested:
        suggested = "New collection"

    return {
        "type": "new",
        "collection_id": None,
        "name": suggested,
        "reason": "No existing collection looks like a strong match.",
    }


@app.patch("/collections/{collection_id}", response_model=schemas.CollectionResponse)
def rename_collection(
    collection_id: int,
    payload: schemas.CollectionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    coll = (
        db.query(models.Collection)
        .filter(
            models.Collection.id == collection_id,
            models.Collection.user_id == current_user.id,
        )
        .first()
    )
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")

    new_name = payload.name.strip()
    if new_name.lower() == coll.name.lower():
        # No-op rename (just re-cased or unchanged): allow.
        coll.name = new_name
        db.commit()
        db.refresh(coll)
        return coll

    exact = (
        db.query(models.Collection)
        .filter(
            models.Collection.user_id == current_user.id,
            models.Collection.id != coll.id,
            models.Collection.name.ilike(new_name),
        )
        .first()
    )
    if exact:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_collection",
                "message": f"A collection named '{exact.name}' already exists.",
                "existing_id": exact.id,
                "existing_name": exact.name,
            },
        )

    if not payload.force:
        similar = _find_similar_collection(
            db, current_user.id, new_name, exclude_id=coll.id
        )
        if similar:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "similar_collection",
                    "message": (
                        f"You already have a similar collection called '{similar.name}'. "
                        "Rename anyway?"
                    ),
                    "existing_id": similar.id,
                    "existing_name": similar.name,
                    "attempted_name": new_name,
                },
            )

    coll.name = new_name
    db.commit()
    db.refresh(coll)
    return coll


@app.get("/collections/{collection_id}/summary")
def collection_summary(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return a short, cutesy one-liner summary of what lives in a collection.

    collection_id == 0 means Uncategorized."""
    if collection_id == 0:
        bookmarks = (
            db.query(models.Bookmark)
            .filter(
                models.Bookmark.user_id == current_user.id,
                models.Bookmark.collection_id.is_(None),
            )
            .order_by(models.Bookmark.created_at.desc())
            .all()
        )
        display_name = "Uncategorized"
    else:
        coll = (
            db.query(models.Collection)
            .filter(
                models.Collection.id == collection_id,
                models.Collection.user_id == current_user.id,
            )
            .first()
        )
        if not coll:
            raise HTTPException(status_code=404, detail="Collection not found")
        bookmarks = (
            db.query(models.Bookmark)
            .filter(
                models.Bookmark.user_id == current_user.id,
                models.Bookmark.collection_id == coll.id,
            )
            .order_by(models.Bookmark.created_at.desc())
            .all()
        )
        display_name = coll.name

    count = len(bookmarks)
    if count == 0:
        return {
            "summary": f"{display_name} is looking a bit empty. Add something fun!",
            "count": 0,
        }

    # Build a compact context, capped so we never send a huge prompt.
    lines = []
    for bm in bookmarks[:20]:
        title = bm.title or bm.url
        tags = ", ".join(bm.tags or [])
        lines.append(f"- {title} ({tags})" if tags else f"- {title}")
    context = "\n".join(lines)

    try:
        from openai import OpenAI
        from app.config import settings

        oai = OpenAI(api_key=settings.OPENAI_API_KEY)
        prompt = (
            f"The user has a bookmark collection called '{display_name}' with {count} item(s). "
            "Write ONE short, cutesy, playful sentence (max 18 words) summarizing the vibe of what's inside. "
            "No emojis. No quotes. No greeting. Just the sentence.\n\n"
            f"Items:\n{context}"
        )
        response = oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=80,
        )
        summary = response.choices[0].message.content.strip().strip('"').strip("'")
    except Exception:
        summary = f"{count} saved item(s) in {display_name}."

    return {"summary": summary, "count": count}


@app.delete("/collections/{collection_id}", status_code=204)
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    coll = (
        db.query(models.Collection)
        .filter(
            models.Collection.id == collection_id,
            models.Collection.user_id == current_user.id,
        )
        .first()
    )
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    # Orphan any bookmarks in this collection rather than deleting them
    db.query(models.Bookmark).filter(
        models.Bookmark.collection_id == collection_id
    ).update({"collection_id": None})
    db.delete(coll)
    db.commit()


# ---------------------------------------------------------------------------
# Shared collections (public read-only links)
# ---------------------------------------------------------------------------

import secrets


def _generate_share_token() -> str:
    # 32-char URL-safe token. 192 bits of entropy, way more than needed.
    return secrets.token_urlsafe(24)


@app.post("/collections/{collection_id}/share")
def share_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Enable public sharing on a collection and return its share token.
    If already shared, returns the existing token (idempotent)."""
    coll = (
        db.query(models.Collection)
        .filter(
            models.Collection.id == collection_id,
            models.Collection.user_id == current_user.id,
        )
        .first()
    )
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    if not coll.share_token:
        # Loop defensively in case of an unlikely collision.
        for _ in range(5):
            candidate = _generate_share_token()
            exists = (
                db.query(models.Collection)
                .filter(models.Collection.share_token == candidate)
                .first()
            )
            if not exists:
                coll.share_token = candidate
                break
        else:
            raise HTTPException(status_code=500, detail="Could not allocate share token")
        db.commit()
        db.refresh(coll)
    return {
        "collection_id": coll.id,
        "share_token": coll.share_token,
        "enabled": True,
    }


@app.delete("/collections/{collection_id}/share", status_code=204)
def unshare_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    coll = (
        db.query(models.Collection)
        .filter(
            models.Collection.id == collection_id,
            models.Collection.user_id == current_user.id,
        )
        .first()
    )
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    coll.share_token = None
    db.commit()


@app.get(
    "/public/collections/{token}",
    response_model=schemas.PublicCollectionResponse,
)
def read_public_collection(token: str, db: Session = Depends(get_db)):
    """Unauthenticated read of a shared collection. No rate-limit exemption:
    the slowapi middleware still applies, just no auth dependency."""
    coll = (
        db.query(models.Collection)
        .filter(models.Collection.share_token == token)
        .first()
    )
    if not coll:
        raise HTTPException(status_code=404, detail="This share link is not valid.")
    bookmarks = (
        db.query(models.Bookmark)
        .filter(models.Bookmark.collection_id == coll.id)
        .order_by(models.Bookmark.created_at.desc())
        .all()
    )
    return schemas.PublicCollectionResponse(
        name=coll.name,
        created_at=coll.created_at,
        bookmark_count=len(bookmarks),
        bookmarks=[schemas.BookmarkResponse.model_validate(bm) for bm in bookmarks],
    )


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

@app.get("/export")
def export_bookmarks(
    format: str = "json",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bookmarks = (
        db.query(models.Bookmark)
        .filter(models.Bookmark.user_id == current_user.id)
        .order_by(models.Bookmark.created_at.desc())
        .all()
    )
    fmt = (format or "json").lower()

    if fmt == "txt":
        total = len(bookmarks)
        lines = [
            "SavedAI bookmarks export",
            "=" * 40,
            f"Total bookmarks: {total}",
            "",
        ]
        for i, bm in enumerate(bookmarks, start=1):
            lines.append(f"{i}. {bm.title or bm.url}")
            lines.append(f"   {bm.url}")
            if bm.summary:
                lines.append(f"   {bm.summary}")
            if bm.tags:
                lines.append("   Tags: " + ", ".join(bm.tags))
            lines.append(f"   Saved: {bm.created_at.strftime('%Y-%m-%d')}")
            lines.append("-" * 40)
            lines.append("")
        content = "\n".join(lines)
        return StreamingResponse(
            iter([content]),
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="savedai-bookmarks.txt"'},
        )

    if fmt == "pdf":
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from reportlab.platypus import (
                SimpleDocTemplate,
                Paragraph,
                Spacer,
            )
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="PDF export requires the 'reportlab' package. Install with: pip install reportlab",
            )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=0.75 * inch,
            rightMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "BmTitle",
            parent=styles["Heading3"],
            textColor="#1e293b",
            spaceAfter=2,
        )
        url_style = ParagraphStyle(
            "BmUrl",
            parent=styles["BodyText"],
            textColor="#0284c7",
            fontSize=9,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "BmBody",
            parent=styles["BodyText"],
            fontSize=10,
            spaceAfter=4,
        )
        meta_style = ParagraphStyle(
            "BmMeta",
            parent=styles["BodyText"],
            fontSize=8,
            textColor="#64748b",
            spaceAfter=12,
        )

        total = len(bookmarks)
        story = [
            Paragraph("SavedAI bookmarks", styles["Title"]),
            Paragraph(f"{total} bookmark{'s' if total != 1 else ''}", meta_style),
            Spacer(1, 0.2 * inch),
        ]

        def _esc(text: str) -> str:
            return (
                (text or "")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )

        for i, bm in enumerate(bookmarks, start=1):
            story.append(Paragraph(f"{i}. {_esc(bm.title or bm.url)}", title_style))
            story.append(Paragraph(f'<link href="{_esc(bm.url)}">{_esc(bm.url)}</link>', url_style))
            if bm.summary:
                story.append(Paragraph(_esc(bm.summary), body_style))
            meta_parts = []
            if bm.tags:
                meta_parts.append("Tags: " + ", ".join(_esc(t) for t in bm.tags))
            meta_parts.append(f"Saved {bm.created_at.strftime('%Y-%m-%d')}")
            story.append(Paragraph(" &middot; ".join(meta_parts), meta_style))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="savedai-bookmarks.pdf"'},
        )

    if fmt == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["#", "url", "title", "summary", "tags", "created_at"])
        for i, bm in enumerate(bookmarks, start=1):
            writer.writerow([
                i,
                bm.url,
                bm.title or "",
                bm.summary or "",
                ", ".join(bm.tags or []),
                bm.created_at.isoformat(),
            ])
        buffer.seek(0)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="savedai-bookmarks.csv"'},
        )

    if fmt in ("md", "markdown"):
        total = len(bookmarks)
        lines = [
            "# SavedAI bookmarks export",
            "",
            f"_Total bookmarks: {total}_",
            "",
        ]
        for i, bm in enumerate(bookmarks, start=1):
            title = bm.title or bm.url
            # Proper ordered-list item so renderers show "1.", "2.", etc.
            lines.append(f"{i}. **[{title}]({bm.url})**")
            if bm.summary:
                lines.append(f"   - {bm.summary}")
            if bm.tags:
                lines.append("   - Tags: " + ", ".join(f"`{t}`" for t in bm.tags))
            lines.append(f"   - _Saved {bm.created_at.strftime('%Y-%m-%d')}_")
            lines.append("")
        content = "\n".join(lines)
        return StreamingResponse(
            iter([content]),
            media_type="text/markdown",
            headers={"Content-Disposition": 'attachment; filename="savedai-bookmarks.md"'},
        )

    if fmt == "html":
        # Netscape bookmark file: what Chrome, Firefox, Safari all import.
        total = len(bookmarks)
        parts = [
            "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
            "<!-- This is an automatically generated file. -->",
            '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
            "<TITLE>SavedAI bookmarks</TITLE>",
            f"<H1>SavedAI bookmarks ({total})</H1>",
            "<DL><p>",
        ]
        for i, bm in enumerate(bookmarks, start=1):
            title = (bm.title or bm.url).replace("<", "&lt;").replace(">", "&gt;")
            add_date = int(bm.created_at.timestamp())
            parts.append(f'    <DT><A HREF="{bm.url}" ADD_DATE="{add_date}">{i}. {title}</A>')
            if bm.summary:
                summary = bm.summary.replace("<", "&lt;").replace(">", "&gt;")
                parts.append(f"    <DD>{summary}")
        parts.append("</DL><p>")
        content = "\n".join(parts)
        return StreamingResponse(
            iter([content]),
            media_type="text/html",
            headers={"Content-Disposition": 'attachment; filename="savedai-bookmarks.html"'},
        )

    # JSON (default)
    return [
        {
            "number": i,
            "url": bm.url,
            "title": bm.title,
            "description": bm.description,
            "summary": bm.summary,
            "tags": bm.tags or [],
            "created_at": bm.created_at.isoformat(),
        }
        for i, bm in enumerate(bookmarks, start=1)
    ]


# ---------------------------------------------------------------------------
# RAG: Ask your bookmarks
# ---------------------------------------------------------------------------

@app.post("/ask", response_model=schemas.AskResponse)
@limiter.limit("20/hour")
def ask(
    request: Request,
    payload: schemas.AskRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        answer, sources = ask_bookmarks(
            db,
            current_user.id,
            payload.question,
            collection_id=payload.collection_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ask failed: {e}")
    return {"answer": answer, "sources": sources}
