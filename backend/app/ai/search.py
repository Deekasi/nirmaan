"""Web search for the Research stage, using Tavily (free tier: 1,000 credits/month, no card).

Returns plain dicts {title, url, content} so the rest of the app doesn't depend on Tavily.
"""
import httpx

from app.config import settings

TAVILY_URL = "https://api.tavily.com/search"


class SearchError(Exception):
    pass


def available() -> bool:
    return bool(settings.tavily_api_key) and settings.tavily_api_key != "paste-your-key-here"


def web_search(query: str, max_results: int = 5) -> list[dict]:
    try:
        r = httpx.post(
            TAVILY_URL,
            headers={"Authorization": f"Bearer {settings.tavily_api_key}"},
            json={
                "api_key": settings.tavily_api_key,  # older API versions read the key from the body
                "query": query,
                "search_depth": "basic",  # 1 credit per search
                "max_results": max_results,
                "include_answer": False,
            },
            timeout=30,
        )
    except httpx.HTTPError as e:
        raise SearchError(f"Couldn't reach the search service: {e}") from e
    if r.status_code in (401, 403):
        raise SearchError("The search service rejected the key. Check TAVILY_API_KEY in backend/.env.")
    if r.status_code == 429 or r.status_code == 432:
        raise SearchError("The free search limit was reached. Try again later.")
    if r.status_code >= 400:
        raise SearchError(f"Search error {r.status_code}: {r.text[:200]}")

    out = []
    for item in r.json().get("results", []):
        url = item.get("url")
        if url:
            out.append({
                "title": (item.get("title") or url)[:200],
                "url": url,
                "content": (item.get("content") or "")[:900],
            })
    return out
