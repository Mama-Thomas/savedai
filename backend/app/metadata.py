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


def fetch_metadata(url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Fetch title, description, and image from a URL using OpenGraph / meta tags."""
    title = None
    description = None
    image_url = None

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
