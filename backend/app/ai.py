from typing import List, Optional, Tuple

from openai import OpenAI

from app.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)


# Transcripts can be long. Clip what we send to the summarizer so we stay
# well inside the model's input budget while still giving it real content.
_SUMMARIZER_TRANSCRIPT_CHARS = 6000

# Caps on what we accept back from the model and persist. These are defensive:
# the prompt asks for short outputs, but a pathological or prompt-injected
# response shouldn't be able to bloat a DB row or stuff 200-char "tags".
_MAX_SUMMARY_CHARS = 1000
_MAX_TAG_CHARS = 50


def generate_summary_and_tags(
    url: str,
    title: str,
    description: str,
    transcript: Optional[str] = None,
    transcript_source: Optional[str] = None,
) -> Tuple[str, List[str]]:
    """Call OpenAI to produce a 2-sentence summary and 3-5 tags.

    When a transcript (video captions or article body) is available we include
    it in the prompt so the model summarizes what the content actually says
    rather than guessing from title + meta description alone.
    """

    transcript_block = ""
    if transcript:
        clipped = transcript[:_SUMMARIZER_TRANSCRIPT_CHARS]
        label = {
            "youtube": "Video transcript",
            "article": "Article body",
            "caption": "Post caption",
        }.get(transcript_source or "", "Extracted content")
        transcript_block = f"\n{label}:\n{clipped}\n"

    prompt = f"""You are a helpful assistant that summarizes web pages for a bookmark manager.

Given the following information about a web page, provide:
1. A concise 2-sentence summary of what the page is about. If a transcript or body is provided, base the summary on that content, not just the title.
2. Between 3 and 5 relevant tags (single words or short phrases) describing the topic, audience, or format.

URL: {url}
Title: {title or "N/A"}
Description: {description or "N/A"}{transcript_block}

Respond in this exact JSON format (no markdown, no extra text):
{{
  "summary": "First sentence. Second sentence.",
  "tags": ["tag1", "tag2", "tag3"]
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=300,
    )

    import json

    content = response.choices[0].message.content.strip()
    # Strip potential markdown code fences
    content = content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    data = json.loads(content)
    raw_summary = data.get("summary", "") or ""
    summary = raw_summary.strip()[:_MAX_SUMMARY_CHARS]
    raw_tags = data.get("tags", []) or []
    tags: List[str] = []
    for t in raw_tags[:5]:
        if not isinstance(t, str):
            continue
        clipped = t.strip()[:_MAX_TAG_CHARS]
        if clipped:
            tags.append(clipped)
    return summary, tags
