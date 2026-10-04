"""Explore page: what's trending in an area, with project ideas a student could build."""
from app.ai import fake, llm, search
from app.ai import schemas as s
from app.ai.research import _format_for_prompt, _number
from app.ai.prompts import ROLE
from app.config import settings

TOPICS = {
    "all": "technology",
    "ai": "artificial intelligence",
    "education": "education technology",
    "health": "healthcare technology",
    "fintech": "fintech and payments",
    "agriculture": "agriculture technology",
    "climate": "climate and clean energy technology",
    "mobility": "transport and mobility",
}


def _prompt(area: str, sources_text: str) -> str:
    base = f"""{ROLE}

List 5 or 6 current trends in {area} that a student or first-time builder could act on,
with India in mind where relevant. For each trend give 3 small, concrete project ideas
that could be built in a few weeks. Be specific, not generic."""
    if sources_text:
        return base + f"""
Use ONLY the numbered sources below and cite them like [2]. Put the numbers you used in "sources".

Sources:
{sources_text}"""
    return base


def run_trends(topic: str) -> dict:
    area = TOPICS[topic]
    if settings.use_fake_llm:
        return {**fake.response_for(s.TrendList).model_dump(), "sources": _number(fake.SOURCES), "method": "demo"}

    if search.available():
        try:
            found, seen = [], set()
            for q in (f"emerging {area} trends 2026", f"{area} startups India 2026", f"fastest growing {area} problems to solve"):
                for res in search.web_search(q, max_results=4):
                    if res["url"] not in seen:
                        seen.add(res["url"])
                        found.append(res)
            found = found[:10]
            if found:
                result = llm.generate_structured(_prompt(area, _format_for_prompt(found)), s.TrendList)
                return {**result.model_dump(), "sources": _number(found), "method": "web_search"}
        except search.SearchError:
            pass
    result = llm.generate_structured(_prompt(area, ""), s.TrendList)
    return {**result.model_dump(), "sources": [], "method": "ai_knowledge"}
