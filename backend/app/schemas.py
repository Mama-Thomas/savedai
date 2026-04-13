import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator

# ---------------------------------------------------------------------------
# URL validation constants
# ---------------------------------------------------------------------------
_URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)
_MAX_URL_LENGTH = 2048


# ---------------------------------------------------------------------------
# Bookmark schemas
# ---------------------------------------------------------------------------

class BookmarkCreate(BaseModel):
    url: str

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

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# kept for backwards compat but unused
class SearchRequest(BaseModel):
    query: str
