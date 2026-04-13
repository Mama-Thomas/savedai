from typing import List, Tuple

from openai import OpenAI

from app.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_summary_and_tags(
    url: str,
    title: str,
    description: str,
) -> Tuple[str, List[str]]:
    """Call OpenAI to produce a 2-sentence summary and 3-5 tags."""

    prompt = f"""You are a helpful assistant that summarizes web pages for a bookmark manager.

Given the following information about a web page, provide:
1. A concise 2-sentence summary of what the page is about.
2. Between 3 and 5 relevant tags (single words or short phrases).

URL: {url}
Title: {title or "N/A"}
Description: {description or "N/A"}

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
    summary = data.get("summary", "")
    tags = data.get("tags", [])[:5]
    return summary, tags
