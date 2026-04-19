import re
from typing import Optional, Tuple
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _fetch_oembed(oembed_url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Query an oEmbed endpoint and return (title, description, image_url)."""
    try:
        resp = requests.get(oembed_url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        title = data.get("title") or data.get("author_name")
        author = data.get("author_name")
        # Use author + title as description since oEmbed has no real description field
        description = None
        if title and author and author not in title:
            description = f"By {author}"
        elif author:
            description = f"By {author}"
        image_url = data.get("thumbnail_url")
        return title, description, image_url
    except Exception:
        return None, None, None


def fetch_metadata(url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Fetch title, description, and image from a URL using OpenGraph / meta tags.
    For TikTok and Instagram, try oEmbed first since they block scrapers."""
    title = None
    description = None
    image_url = None

    parsed = urlparse(url)
    host = parsed.netloc.lower()

    # TikTok oEmbed (no auth required)
    if "tiktok.com" in host:
        t, d, i = _fetch_oembed(f"https://www.tiktok.com/oembed?url={url}")
        if t:
            return t, d, i

    # Instagram oEmbed fallback (public, no auth) - often returns limited info but better than nothing
    if "instagram.com" in host:
        t, d, i = _fetch_oembed(f"https://www.instagram.com/api/v1/oembed/?url={url}")
        if t:
            return t, d, i

    try:
        resp = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Title
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            title = og_title["content"].strip()
        elif soup.title and soup.title.string:
            title = soup.title.string.strip()

        # Description
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            description = og_desc["content"].strip()
        else:
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc and meta_desc.get("content"):
                description = meta_desc["content"].strip()

        # Image
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            image_url = og_image["content"].strip()

        # Fallback: derive a clean title from the URL
        if not title:
            parsed = urlparse(url)
            path = parsed.path.strip("/")
            title = path.split("/")[-1].replace("-", " ").replace("_", " ").title() or parsed.netloc

    except Exception:
        # Graceful degradation: return what we have
        parsed = urlparse(url)
        title = title or parsed.netloc

    return title, description, image_url
