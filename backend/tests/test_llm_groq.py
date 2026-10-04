"""Tests for the Groq code path, with Groq's HTTP replies simulated (no network, no key needed)."""
import json

import httpx
import pytest

from app.ai import fake, llm
from app.ai import schemas as s
from app.config import settings


@pytest.fixture(autouse=True)
def groq_mode(monkeypatch):
    monkeypatch.setattr(settings, "llm_mode", "real")
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "test-key")


def reply(content: str, status: int = 200, **extra) -> httpx.Response:
    body = {"choices": [{"message": {"role": "assistant", "content": content, **extra}}]}
    return httpx.Response(status, json=body, request=httpx.Request("POST", llm.GROQ_URL))


def queue(monkeypatch, *responses):
    """Make httpx.post return these responses in order, and record what was sent."""
    sent = []
    it = iter(responses)

    def fake_post(url, headers, json, timeout):
        sent.append(json)
        return next(it)

    monkeypatch.setattr(llm.httpx, "post", fake_post)
    return sent


VALIDATION = fake.response_for(s.Validation).model_dump()


def test_structured_parses_json_even_inside_markdown_fences(monkeypatch):
    sent = queue(monkeypatch, reply("```json\n" + json.dumps(VALIDATION) + "\n```"))
    result = llm.generate_structured("validate this", s.Validation)
    assert result.verdict == "go"
    assert sent[0]["response_format"] == {"type": "json_object"}
    assert sent[0]["model"] == settings.groq_model


def test_structured_retries_once_when_json_is_invalid(monkeypatch):
    bad = {**VALIDATION, "verdict": "maybe"}  # not one of go / pivot / rethink
    sent = queue(monkeypatch, reply(json.dumps(bad)), reply(json.dumps(VALIDATION)))
    assert llm.generate_structured("validate this", s.Validation).verdict == "go"
    assert len(sent) == 2
    assert "invalid" in sent[1]["messages"][-1]["content"]


def test_structured_gives_up_after_second_bad_reply(monkeypatch):
    queue(monkeypatch, reply("not json"), reply("still not json"))
    with pytest.raises(llm.LLMError):
        llm.generate_structured("validate this", s.Validation)


def test_research_uses_compound_and_collects_searched_sources(monkeypatch):
    research = fake.response_for(s.Research).model_dump()
    tools = [{"type": "search", "search_results": {"results": [
        {"title": "Article A", "url": "https://a.example/1"},
        {"title": "Article A again", "url": "https://a.example/1"},
        {"title": "Article B", "url": "https://b.example/2"},
    ]}}]
    sent = queue(monkeypatch, reply(json.dumps(research), executed_tools=tools))
    result, sources = llm.research_with_search("research this", s.Research)
    assert result.competitors
    assert sent[0]["model"] == settings.groq_research_model
    assert "response_format" not in sent[0]
    assert sources == [
        {"title": "Article A", "url": "https://a.example/1"},
        {"title": "Article B", "url": "https://b.example/2"},
    ]


def test_research_falls_back_to_sources_listed_in_the_json(monkeypatch):
    research = {**fake.response_for(s.Research).model_dump(),
                "sources": [{"title": "Report", "url": "https://r.example"}, {"title": "bad", "url": "ftp://x"}]}
    queue(monkeypatch, reply(json.dumps(research)))
    _, sources = llm.research_with_search("research this", s.Research)
    assert sources == [{"title": "Report", "url": "https://r.example"}]


def test_research_still_answers_if_search_model_is_unavailable(monkeypatch):
    research = fake.response_for(s.Research).model_dump()
    error = httpx.Response(404, json={"error": "model not found"}, request=httpx.Request("POST", llm.GROQ_URL))
    queue(monkeypatch, error, reply(json.dumps(research)))
    result, sources = llm.research_with_search("research this", s.Research)
    assert result.summary and sources == []


def test_rate_limit_gives_a_friendly_message(monkeypatch):
    queue(monkeypatch, httpx.Response(429, json={}, request=httpx.Request("POST", llm.GROQ_URL)))
    with pytest.raises(llm.LLMError, match="limit"):
        llm.generate_structured("x", s.Validation)


def test_short_rate_limit_waits_and_retries_once(monkeypatch):
    limited = httpx.Response(429, headers={"retry-after": "0"}, json={}, request=httpx.Request("POST", llm.GROQ_URL))
    sent = queue(monkeypatch, limited, reply(json.dumps(VALIDATION)))
    assert llm.generate_structured("x", s.Validation).verdict == "go"
    assert len(sent) == 2
