"""The Research pipeline with Tavily + Groq replies simulated (no network)."""
import json

import httpx
import pytest

from app.ai import fake, llm, research, search
from app.ai import schemas as s
from app.config import settings


@pytest.fixture(autouse=True)
def real_mode(monkeypatch):
    monkeypatch.setattr(settings, "llm_mode", "real")
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "test-key")
    monkeypatch.setattr(settings, "tavily_api_key", "tvly-test")


def groq_reply(content: str, **extra) -> httpx.Response:
    body = {"choices": [{"message": {"role": "assistant", "content": content, **extra}}]}
    return httpx.Response(200, json=body, request=httpx.Request("POST", llm.GROQ_URL))


def tavily_reply(results: list[dict], status: int = 200) -> httpx.Response:
    return httpx.Response(status, json={"results": results}, request=httpx.Request("POST", search.TAVILY_URL))


RESEARCH_JSON = json.dumps({**fake.response_for(s.Research).model_dump(), "summary": "Specific summary [1][2]."})


def install(monkeypatch, groq_replies, tavily_handler):
    calls = {"groq": [], "tavily": []}
    groq_iter = iter(groq_replies)

    def fake_post(url, headers, json, timeout):
        if url == search.TAVILY_URL:
            calls["tavily"].append(json["query"])
            return tavily_handler(json["query"])
        calls["groq"].append(json)
        return next(groq_iter)

    monkeypatch.setattr(httpx, "post", fake_post)
    return calls


def test_web_search_path_plans_queries_dedupes_and_numbers_sources(monkeypatch):
    plan = json.dumps({"queries": ["traffic signal AI startups", "adaptive signal complaints", "smart city India 2026", "traffic AI news"]})

    def tavily(query):
        return tavily_reply([
            {"title": "Shared page", "url": "https://shared.example/x", "content": "same page in every search"},
            {"title": f"Page for {query}", "url": f"https://site.example/{query.replace(' ', '-')}", "content": "details"},
        ])

    calls = install(monkeypatch, [groq_reply(plan), groq_reply(RESEARCH_JSON)], tavily)
    data = research.run_research("TrafficFlow", "count cars from video and set signal timers")

    assert data["method"] == "web_search"
    assert len(calls["tavily"]) == 4
    assert data["queries"] == calls["tavily"]
    urls = [src["url"] for src in data["sources"]]
    assert len(urls) == len(set(urls)) == 5  # 1 shared page + 4 unique
    assert [src["id"] for src in data["sources"]] == [1, 2, 3, 4, 5]
    assert data["sources"][0]["domain"] == "shared.example"
    # The writing prompt must contain the numbered sources.
    writing_prompt = calls["groq"][1]["messages"][-1]["content"]
    assert "[1] Shared page" in writing_prompt and "ONLY" in writing_prompt
    assert data["summary"] == "Specific summary [1][2]."


def test_falls_back_honestly_when_search_key_is_rejected(monkeypatch):
    calls = install(
        monkeypatch,
        [groq_reply(json.dumps({"queries": ["a", "b"]})), groq_reply(RESEARCH_JSON)],
        lambda q: tavily_reply([], status=401),
    )
    data = research.run_research("X", "some idea here")
    assert data["method"] == "ai_knowledge"  # compound reply had no sources
    assert "rejected the key" in data["note"]
    assert calls["groq"][-1]["model"] == settings.groq_research_model


def test_without_search_key_uses_ai_search(monkeypatch):
    monkeypatch.setattr(settings, "tavily_api_key", "")
    tools = [{"search_results": {"results": [{"title": "T", "url": "https://t.example/1"}]}}]
    install(monkeypatch, [groq_reply(RESEARCH_JSON, executed_tools=tools)], lambda q: pytest.fail("no Tavily"))
    data = research.run_research("X", "some idea here")
    assert data["method"] == "ai_search"
    assert data["sources"][0]["id"] == 1 and data["sources"][0]["domain"] == "t.example"


def test_unclear_idea_is_refused_not_guessed(monkeypatch):
    unclear = json.dumps({"idea_is_clear": False, "interpretation": "This looks like random letters.", "queries": []})
    calls = install(monkeypatch, [groq_reply(unclear)], lambda q: pytest.fail("must not search an unclear idea"))
    with pytest.raises(research.IdeaUnclear, match="random letters"):
        research.run_research("x", "hdiheufhuehfoueh79fhrwwunfo")
    assert len(calls["groq"]) == 1
