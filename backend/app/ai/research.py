"""The Research stage pipeline.

Best path (TAVILY_API_KEY set):
  1. The AI turns the idea into 4 focused search queries (it also fixes typos).
  2. Each query is searched on the web; results are de-duplicated and numbered.
  3. The AI writes the research using ONLY those numbered sources, citing them like [2].
Fallbacks, used only when web search isn't available, are recorded in "method" so the UI
can tell the user honestly how the research was produced.
"""
from urllib.parse import urlparse

from app.ai import fake, llm, prompts, search
from app.ai import schemas as s
from app.config import settings

MAX_SOURCES = 12


def _domain(url: str) -> str:
    host = urlparse(url).netloc
    return host[4:] if host.startswith("www.") else host


def _number(sources: list[dict]) -> list[dict]:
    return [
        {"id": i, "title": src["title"], "url": src["url"], "domain": _domain(src["url"]),
         "snippet": (src.get("content") or "")[:240]}
        for i, src in enumerate(sources, start=1)
    ]


def _format_for_prompt(sources: list[dict]) -> str:
    return "\n\n".join(f"[{i}] {src['title']} ({src['url']})\n{src['content']}" for i, src in enumerate(sources, 1))


def run_research(name: str, idea: str) -> dict:
    if settings.use_fake_llm:
        data = fake.response_for(s.Research).model_dump()
        return {**data, "sources": _number(fake.SOURCES), "queries": fake.QUERIES, "method": "demo"}

    note = ""
    if search.available():
        try:
            plan = llm.generate_structured(prompts.search_plan(name, idea), s.SearchPlan)
            queries = [q.strip() for q in plan.queries if q.strip()][:4]
            found: list[dict] = []
            seen: set[str] = set()
            for q in queries:
                for res in search.web_search(q, max_results=5):
                    if res["url"] not in seen:
                        seen.add(res["url"])
                        found.append(res)
            found = found[:MAX_SOURCES]
            if found:
                research = llm.generate_structured(
                    prompts.research_from_sources(name, idea, _format_for_prompt(found)), s.Research
                )
                return {**research.model_dump(), "sources": _number(found), "queries": queries, "method": "web_search"}
            note = "Web search returned no results, so this research uses the AI's own search."
        except search.SearchError as e:
            note = f"{e} Used the AI's own search instead."

    research, sources = llm.research_with_search(prompts.research(name, idea), s.Research)
    method = "ai_search" if sources else "ai_knowledge"
    return {**research.model_dump(), "sources": _number(sources), "queries": [], "method": method, "note": note}
