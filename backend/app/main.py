from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

from app import models, schemas
from app.ai import generate_summary_and_tags
from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    rate_limit_key,
    verify_password,
)
from app.database import Base, engine, get_db
from app.metadata import fetch_metadata
from app.search import search_bookmarks

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
    # Fetch page metadata
    title, description, image_url = fetch_metadata(payload.url)

    # AI summary + tags
    try:
        summary, tags = generate_summary_and_tags(payload.url, title or "", description or "")
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
        user_id=current_user.id,
    )
    db.add(bm)
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
    return search_bookmarks(db, q, user_id=current_user.id)
