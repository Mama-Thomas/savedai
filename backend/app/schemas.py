import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

# ---------------------------------------------------------------------------
# URL validation constants
# ---------------------------------------------------------------------------
_URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)
_MAX_URL_LENGTH = 2048

# A stronger password: at least 8 characters, must contain a letter and a digit.
# We deliberately allow any symbol (including unicode), so this is a minimum
# bar rather than a draconian rule.
_PASSWORD_MIN_LENGTH = 8
_PASSWORD_MAX_LENGTH = 200
_PASSWORD_HAS_LETTER = re.compile(r"[A-Za-z]")
_PASSWORD_HAS_DIGIT = re.compile(r"\d")


def _validate_strong_password(v: str) -> str:
    if not isinstance(v, str):
        raise ValueError("Password must be a string")
    if len(v) < _PASSWORD_MIN_LENGTH:
        raise ValueError(
            f"Password must be at least {_PASSWORD_MIN_LENGTH} characters"
        )
    if len(v) > _PASSWORD_MAX_LENGTH:
        raise ValueError(
            f"Password must be at most {_PASSWORD_MAX_LENGTH} characters"
        )
    if not _PASSWORD_HAS_LETTER.search(v):
        raise ValueError("Password must contain at least one letter")
    if not _PASSWORD_HAS_DIGIT.search(v):
        raise ValueError("Password must contain at least one number")
    return v


# ---------------------------------------------------------------------------
# Bookmark schemas
# ---------------------------------------------------------------------------

class BookmarkCreate(BaseModel):
    url: str = Field(..., max_length=_MAX_URL_LENGTH)
    collection_id: Optional[int] = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if len(v) > _MAX_URL_LENGTH:
            raise ValueError(f"URL must be {_MAX_URL_LENGTH} characters or fewer")
        if not _URL_PATTERN.match(v):
            raise ValueError("Must be a valid HTTP or HTTPS URL")
        return v


class BookmarkResponse(BaseModel):
    id: int
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = []
    created_at: datetime
    collection_id: Optional[int] = None
    # Where the transcript came from. One of: youtube, article, caption, none.
    # We intentionally do NOT return the full transcript body to keep the list
    # endpoint lightweight; the server uses it internally for Ask and search.
    transcript_source: Optional[str] = None
    # Populated only by /search: a short plain-text snippet containing the
    # matching phrase, plus the lowercase terms to highlight in the UI.
    match_snippet: Optional[str] = None
    match_terms: Optional[List[str]] = None
    # Which field the snippet came from ("title" / "summary" / "transcript" / etc.)
    match_field: Optional[str] = None

    class Config:
        from_attributes = True


class BookmarkUpdate(BaseModel):
    collection_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------

class CollectionCreate(BaseModel):
    name: str = Field(..., max_length=100)
    # If true, bypass the "similar name already exists" guard.
    force: Optional[bool] = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("Name must be 1-100 characters")
        return v


class CollectionUpdate(BaseModel):
    name: str = Field(..., max_length=100)
    force: Optional[bool] = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("Name must be 1-100 characters")
        return v


class CollectionResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    # Present (non-null) when the collection is publicly shared.
    share_token: Optional[str] = None

    class Config:
        from_attributes = True


class PublicCollectionResponse(BaseModel):
    """Payload for the unauthenticated /public/collections/{token} endpoint.
    Deliberately minimal: no user info, no internal IDs beyond the owner's name
    label if we decide to expose it later."""
    name: str
    created_at: datetime
    bookmark_count: int
    bookmarks: List[BookmarkResponse]


# ---------------------------------------------------------------------------
# RAG "Ask your bookmarks"
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    question: str = Field(..., max_length=500)
    # Optional scope. null = all bookmarks, 0 = uncategorized, >0 = specific collection id
    collection_id: Optional[int] = None

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 500:
            raise ValueError("Question must be 1-500 characters")
        return v


class AskResponse(BaseModel):
    answer: str
    sources: List[BookmarkResponse]


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=_PASSWORD_MAX_LENGTH)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_strong_password(v)


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Seconds until the access token expires. Frontend can use this to schedule
    # a logout before the server starts rejecting calls.
    expires_in: int = 0


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=_PASSWORD_MAX_LENGTH)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., max_length=200)
    password: str = Field(..., max_length=_PASSWORD_MAX_LENGTH)

    @field_validator("token")
    @classmethod
    def validate_token(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Reset token is required")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_strong_password(v)


# kept for backwards compat but unused
class SearchRequest(BaseModel):
    query: str
