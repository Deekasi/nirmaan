"""One small wrapper around the AI provider, so the rest of the app never talks to an SDK directly.

Two calls:
- generate_structured(): returns a validated Pydantic object.
- research_with_search(): searches the web and returns the answer + source links.

Providers:
- Groq (default, free, no credit card): Llama for structured answers, groq/compound for web search.
- Gemini (optional): structured output + Google Search grounding.
If no key is set (or LLM_MODE=fake), both calls return realistic fake data instead,
so the app and tests run offline and cost nothing.
"""
import json
import re
import time
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.ai import fake
from app.config import settings

T = TypeVar("T", bound=BaseModel)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(Exception):
    """Raised when the AI call fails or returns something unusable."""


# ---------- shared helpers ----------

def _extract_json(text: str) -> str:
    """Pull the first {...} block out of a reply that may include ```json fences or extra text."""
    text = re.sub(r"```(?:json)?", "", text or "")
    start, end = text.find("{"), text.rfind("}")
    return text[start : end + 1] if start != -1 and end > start else text


def _parse(text: str, schema: type[T]) -> T:
    return schema.model_validate(json.loads(_extract_json(text)))


def _schema_instruction(schema: type[BaseModel]) -> str:
    return (
        "Reply with ONLY one JSON object (no markdown, no extra text) that matches this JSON schema:\n"
        + json.dumps(schema.model_json_schema())
    )


# ---------- public API ----------

def generate_structured(prompt: str, schema: type[T]) -> T:
    if settings.use_fake_llm:
        return fake.response_for(schema)
    if settings.llm_provider == "gemini":
        return _gemini_structured(prompt, schema)
    return _groq_structured(prompt, schema)


def research_with_search(prompt: str, schema: type[T]) -> tuple[T, list[dict]]:
    """Answer using live web search. Returns (parsed result, sources)."""
    if settings.use_fake_llm:
        return fake.response_for(schema), fake.SOURCES
    if settings.llm_provider == "gemini":
        return _gemini_research(prompt, schema)
    return _groq_research(prompt, schema)


# ---------- Groq ----------

def _retry_after(r: httpx.Response) -> float | None:
    try:
        return float(r.headers.get("retry-after", ""))
    except ValueError:
        return None


def _groq_chat(model: str, messages: list[dict], json_mode: bool, _retried: bool = False) -> dict:
    body: dict = {"model": model, "messages": messages, "temperature": 0.5}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        r = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json=body,
            timeout=120,
        )
    except httpx.HTTPError as e:
        raise LLMError(f"Couldn't reach Groq: {e}") from e
    # Free tier has per-minute token limits. If Groq says "try again in a few seconds", wait once.
    wait = _retry_after(r) if r.status_code == 429 else None
    if wait is not None and wait <= 20 and not _retried:
        time.sleep(wait)
        return _groq_chat(model, messages, json_mode, _retried=True)
    if r.status_code == 401:
        raise LLMError("Groq rejected the API key. Check GROQ_API_KEY in backend/.env.")
    if r.status_code == 429:
        raise LLMError("The free AI limit was reached for now. Wait a minute and try again.")
    if r.status_code >= 400:
        raise LLMError(f"Groq error {r.status_code}: {r.text[:300]}")
    return r.json()["choices"][0]["message"]


def _groq_structured(prompt: str, schema: type[T]) -> T:
    messages = [
        {"role": "system", "content": _schema_instruction(schema)},
        {"role": "user", "content": prompt},
    ]
    content = _groq_chat(settings.groq_model, messages, json_mode=True).get("content", "")
    try:
        return _parse(content, schema)
    except (json.JSONDecodeError, ValidationError) as e:
        # One retry: show the model its mistake and ask it to fix the JSON.
        messages += [
            {"role": "assistant", "content": content},
            {"role": "user", "content": f"That JSON was invalid ({str(e)[:300]}). Send the corrected JSON only."},
        ]
        content = _groq_chat(settings.groq_model, messages, json_mode=True).get("content", "")
        try:
            return _parse(content, schema)
        except (json.JSONDecodeError, ValidationError) as e2:
            raise LLMError("The AI returned data in an unexpected format. Try again.") from e2


def _sources_from_tools(message: dict) -> list[dict]:
    """groq/compound reports the web pages it searched in `executed_tools`."""
    sources: list[dict] = []
    seen: set[str] = set()
    for tool in message.get("executed_tools") or []:
        results = (tool.get("search_results") or {}).get("results") or []
        for res in results:
            url = res.get("url")
            if url and url not in seen:
                seen.add(url)
                sources.append({"title": res.get("title") or url, "url": url})
    return sources[:10]


def _sources_from_json(text: str) -> list[dict]:
    try:
        raw = json.loads(_extract_json(text)).get("sources") or []
    except (json.JSONDecodeError, AttributeError):
        return []
    out = []
    for s in raw:
        if isinstance(s, dict) and str(s.get("url", "")).startswith("http"):
            out.append({"title": s.get("title") or s["url"], "url": s["url"]})
    return out[:10]


def _groq_research(prompt: str, schema: type[T]) -> tuple[T, list[dict]]:
    instruction = (
        _schema_instruction(schema)
        + '\nAlso include a "sources" key: a list of {"title": ..., "url": ...} for the web pages you used.'
    )
    messages = [{"role": "system", "content": instruction}, {"role": "user", "content": prompt}]
    try:
        # groq/compound searches the web by itself; it doesn't support forced JSON mode.
        message = _groq_chat(settings.groq_research_model, messages, json_mode=False)
    except LLMError:
        # If the search model is unavailable, still give an answer without live sources.
        return _groq_structured(prompt, schema), []

    content = message.get("content", "")
    sources = _sources_from_tools(message) or _sources_from_json(content)
    try:
        return _parse(content, schema), sources
    except (json.JSONDecodeError, ValidationError):
        fixed = _groq_structured(
            "Convert these research notes into the requested JSON structure. "
            "Keep every fact, do not invent new ones.\n\n" + content,
            schema,
        )
        return fixed, sources


# ---------- Gemini (optional) ----------

def _gemini_client():
    from google import genai  # imported lazily so it's only needed when Gemini is used

    return genai.Client(api_key=settings.gemini_api_key)


def _gemini_structured(prompt: str, schema: type[T]) -> T:
    from google.genai import types

    try:
        resp = _gemini_client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json", response_schema=schema, temperature=0.6
            ),
        )
    except Exception as e:
        raise LLMError(f"Gemini request failed: {e}") from e
    if isinstance(resp.parsed, schema):
        return resp.parsed
    try:
        return schema.model_validate_json(resp.text or "")
    except ValidationError as e:
        raise LLMError("Gemini returned data in an unexpected format. Try again.") from e


def _gemini_research(prompt: str, schema: type[T]) -> tuple[T, list[dict]]:
    from google.genai import types

    try:
        resp = _gemini_client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt + "\n\n" + _schema_instruction(schema),
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())], temperature=0.4
            ),
        )
    except Exception as e:
        raise LLMError(f"Gemini request failed: {e}") from e

    sources: list[dict] = []
    seen: set[str] = set()
    for cand in resp.candidates or []:
        meta = cand.grounding_metadata
        for chunk in (meta.grounding_chunks or []) if meta else []:
            if chunk.web and chunk.web.uri and chunk.web.uri not in seen:
                seen.add(chunk.web.uri)
                sources.append({"title": chunk.web.title or chunk.web.domain or "Source", "url": chunk.web.uri})

    raw = resp.text or ""
    try:
        return _parse(raw, schema), sources
    except (json.JSONDecodeError, ValidationError):
        fixed = _gemini_structured(
            "Convert these research notes into the requested JSON structure. "
            "Keep every fact, do not invent new ones.\n\n" + raw,
            schema,
        )
        return fixed, sources
