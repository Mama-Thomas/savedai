from datetime import datetime

from sqlalchemy import ARRAY, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    bookmarks = relationship("Bookmark", back_populates="owner", cascade="all, delete-orphan")
    collections = relationship("Collection", back_populates="owner", cascade="all, delete-orphan")


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # When set, this collection is publicly viewable at /public/collections/{token}.
    # Null = not shared. Rotated by generating a new token.
    share_token = Column(String, nullable=True, unique=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="collections")
    bookmarks = relationship("Bookmark", back_populates="collection")


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    tags = Column(ARRAY(String), nullable=True, default=[])
    # Extracted transcript / article body text. Populated at save time when a
    # source supports it (YouTube captions, article body). Used to enrich
    # summaries, tags, embeddings, and RAG ask answers. May be long.
    transcript = Column(Text, nullable=True)
    # Where the transcript came from: youtube, article, caption, none. Lets the
    # UI explain provenance and lets us swap in ASR later without breaking rows.
    transcript_source = Column(String, nullable=True)
    # Cached OpenAI embedding of (title + summary + description + tags + transcript) for fast semantic search
    embedding = Column(ARRAY(Float), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="bookmarks")

    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=True)
    collection = relationship("Collection", back_populates="bookmarks")
