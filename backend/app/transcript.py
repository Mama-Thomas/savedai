"""Transcript / long-form text extraction.

Given a URL we try, in order:
  1. YouTube captions (free, best signal for videos).
  2. Article body via trafilatura (great for blogs / news / docs).
  3. TikTok / Instagram caption text via oEmbed (short, but better than title alone).

Returns (text, source) where source is one of:
  "youtube" | "article" | "caption" | "none"

All failures are swallowed; the pipeline degrades gracefully to whatever the
existing metadata scraper produced.
"""
from __future__ import annotations

import re
from typing import Optional, Tuple
from urllib.parse import parse_qs, urlparse

import requests

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# Cap transcripts so they don't blow up prompts / embedding input / storage.
# 12k chars is ~3k tokens, plenty for a good summary + Ask context.
_MAX_CHARS = 12000


def _clip(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= _MAX_CHARS:
        return text
    return text[:_MAX_CHARS].rsplit(" ", 1)[0] + " ..."


# ---------------------------------------------------------------------------
# YouTube
# ---------------------------------------------------------------------------

def _youtube_video_id(url: str) -> Optional[str]:
    """Pull the 11-char video id from any common YouTube URL shape."""
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    host = parsed.netloc.lower()
    if "youtu.be" in host:
        vid = parsed.path.strip("/").split("/")[0]
        return vid or None
    if "youtube.com" not in host:
        return None
    # /watch?v=XXXX
    qs = parse_qs(parsed.query or "")
    if "v" in qs and qs["v"]:
        return qs["v"][0]
    # /shorts/XXXX or /embed/XXXX or /live/XXXX
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2 and parts[0] in {"shorts", "embed", "live"}:
        return parts[1]
    return None


def _fetch_youtube_transcript(url: str) -> Optional[str]:
    vid = _youtube_video_id(url)
    if not vid:
        return None
    try:
        # Imported lazily so the backend still runs if the dep isn't installed.
        from youtube_transcript_api import YouTubeTranscriptApi
    except Exception:
        return None
    try:
        # Try English first, then any available language.
        try:
            entries = YouTubeTranscriptApi.get_transcript(vid, languages=["en", "en-US", "en-GB"])
        except Exception:
            entries = YouTubeTranscriptApi.get_transcript(vid)
        text = " ".join(e.get("text", "") for e in entries if e.get("text"))
        return _clip(text) if text.strip() else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Articles (trafilatura)
# ---------------------------------------------------------------------------

_NON_ARTICLE_HOSTS = (
    "youtube.com", "youtu.be", "tiktok.com", "instagram.com",
    "twitter.com", "x.com",
)


def _is_article_candidate(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False
    return not any(bad in host for bad in _NON_ARTICLE_HOSTS)


def _fetch_article_text(url: str) -> Optional[str]:
    if not _is_article_candidate(url):
        return None
    try:
        import trafilatura
    except Exception:
        return None
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            # Fallback: plain GET so we still get something on sites that set
            # custom headers for trafilatura's default client.
            try:
                resp = requests.get(url, headers=_HEADERS, timeout=10, allow_redirects=True)
                resp.raise_for_status()
                downloaded = resp.text
            except Exception:
                return None
        extracted = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=False,
            favor_precision=True,
        )
        if not extracted:
            return None
        return _clip(extracted)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# TikTok / Instagram caption (best-effort, no ASR)
# ---------------------------------------------------------------------------

def _fetch_social_caption(url: str) -> Optional[str]:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return None

    endpoint = None
    if "tiktok.com" in host:
        endpoint = f"https://www.tiktok.com/oembed?url={url}"
    elif "instagram.com" in host:
        endpoint = f"https://www.instagram.com/api/v1/oembed/?url={url}"
    if not endpoint:
        return None

    try:
        resp = requests.get(endpoint, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    pieces = []
    for key in ("title", "author_name"):
        val = data.get(key)
        if val:
            pieces.append(str(val))
    text = " - ".join(pieces).strip()
    return _clip(text) if text else None


# ---------------------------------------------------------------------------
# Public entry
# ---------------------------------------------------------------------------

def fetch_transcript(url: str) -> Tuple[Optional[str], str]:
    """Best-effort transcript / body extraction.

    Returns (text_or_none, source_label). source_label is always a string so
    callers can store it unconditionally.
    """
    # 1. YouTube
    if _youtube_video_id(url):
        text = _fetch_youtube_transcript(url)
        if text:
            return text, "youtube"
        # If captions aren't available, still flag it as a video so the UI can say so.
        return None, "none"

    # 2. TikTok / Instagram caption
    host = urlparse(url).netloc.lower() if url else ""
    if "tiktok.com" in host or "instagram.com" in host:
        cap = _fetch_social_caption(url)
        if cap:
            return cap, "caption"
        return None, "none"

    # 3. Article / blog post
    text = _fetch_article_text(url)
    if text:
        return text, "article"
    return None, "none"
