import io
import zipfile

from sqlalchemy import create_engine, inspect, text

from app.migrate import add_missing_columns
from app.verify import verify_zip
from tests.conftest import register
from tests.test_stages import new_project, run_until_plan


def build(client, h, pid, template="webapp"):
    plan = next(r for r in client.get(f"/projects/{pid}/results", headers=h).json() if r["stage"] == "plan")["data"]
    musts = [f["name"] for f in plan["features"] if f["priority"] == "must"]
    r = client.post(f"/projects/{pid}/build", json={"selected_features": musts, "template": template}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["data"]


# ---------- library ----------

def test_finish_project_with_links_and_filter_library(client):
    h = register(client)
    a = new_project(client, h)
    b = new_project(client, h)
    r = client.patch(f"/projects/{a}", json={
        "status": "finished", "github_url": "https://github.com/me/messmate", "live_url": "", "notes": "Shipped!"
    }, headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "finished" and body["finished_at"] and body["live_url"] is None

    finished = client.get("/projects?status=finished", headers=h).json()
    active = client.get("/projects?status=active", headers=h).json()
    assert [p["id"] for p in finished] == [a]
    assert [p["id"] for p in active] == [b]

    reopened = client.patch(f"/projects/{a}", json={"status": "active"}, headers=h).json()
    assert reopened["status"] == "active" and reopened["finished_at"] is None


def test_links_must_be_web_urls(client):
    h = register(client)
    pid = new_project(client, h)
    r = client.patch(f"/projects/{pid}", json={"github_url": "javascript:alert(1)"}, headers=h)
    assert r.status_code == 422


def test_search_and_summary_fields(client):
    h = register(client)
    pid = new_project(client, h)
    client.post("/projects", json={"name": "Other", "idea": "Something completely different."}, headers=h)
    run_until_plan(client, h, pid)
    found = client.get("/projects?q=mess", headers=h).json()
    assert len(found) == 1 and found[0]["verdict"] == "go" and found[0]["feasibility"] == 8


def test_migration_adds_new_columns_to_an_old_database(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE projects (id INTEGER PRIMARY KEY, name VARCHAR(120))"))
        conn.execute(text("INSERT INTO projects (name) VALUES ('old one')"))
    added = add_missing_columns(engine)
    assert set(added) == {"status", "github_url", "live_url", "notes", "finished_at"}
    cols = {c["name"] for c in inspect(engine).get_columns("projects")}
    assert "status" in cols
    with engine.connect() as conn:
        assert conn.execute(text("SELECT status FROM projects")).scalar() == "active"
    assert add_missing_columns(engine) == []  # running again changes nothing


# ---------- quality gate + missions ----------

def test_build_runs_quality_checks_and_creates_missions(client):
    h = register(client)
    pid = new_project(client, h)
    run_until_plan(client, h, pid)
    data = build(client, h, pid, "webapp")

    checks = data["checks"]
    assert checks["ship_ready"] is True
    assert checks["passed"] == checks["total"] == 8
    assert {s["name"] for s in checks["steps"]} >= {"Python syntax", "Secret scan", "Pinned dependencies"}
    assert any(f["path"] == "main.py" and f["lines"] > 20 for f in checks["files"])
    assert checks["lines_by_language"]["Python"] > 0

    ids = [m["id"] for m in data["missions"]]
    assert "first-test" in ids and "deploy" in ids and any(i.startswith("feature-") for i in ids)
    assert data["missions_done"] == []


def test_landing_template_skips_python_checks(client):
    h = register(client)
    pid = new_project(client, h)
    run_until_plan(client, h, pid)
    checks = build(client, h, pid, "landing")["checks"]
    statuses = {s["name"]: s["status"] for s in checks["steps"]}
    assert statuses["Python syntax"] == "skip" and checks["total"] == 6 and checks["ship_ready"]


def test_missions_progress_is_saved_and_kept_on_rebuild(client):
    h = register(client)
    pid = new_project(client, h)
    run_until_plan(client, h, pid)
    build(client, h, pid)
    r = client.put(f"/projects/{pid}/missions", json={"done": ["run-locally", "push-github"]}, headers=h)
    assert r.status_code == 200 and r.json()["data"]["missions_done"] == ["run-locally", "push-github"]
    assert client.put(f"/projects/{pid}/missions", json={"done": ["fly-to-moon"]}, headers=h).status_code == 422
    rebuilt = build(client, h, pid)
    assert rebuilt["missions_done"] == ["run-locally", "push-github"]


def _zip(files: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, text_ in files.items():
            zf.writestr(f"app/{name}", text_)
    return buf.getvalue()


def test_quality_gate_catches_broken_code_and_leaked_keys():
    report = verify_zip(_zip({
        "main.py": "def broken(:\n    pass\n",
        "config.py": 'KEY = "gsk_' + "a" * 30 + '"\n',
        "requirements.txt": "fastapi\nuvicorn==0.34.0\n",
    }))
    status = {s["name"]: s for s in report["steps"]}
    assert status["Python syntax"]["status"] == "fail" and "main.py" in status["Python syntax"]["detail"]
    assert status["Secret scan"]["status"] == "fail" and "config.py" in status["Secret scan"]["detail"]
    assert status["Pinned dependencies"]["status"] == "warn"
    assert report["ship_ready"] is False


# ---------- research + trends ----------

def test_research_has_the_deeper_sections(client):
    h = register(client)
    pid = new_project(client, h)
    data = client.post(f"/projects/{pid}/research", headers=h).json()["data"]
    for key in ("market_size", "key_numbers", "target_segments", "india_angle", "swot"):
        assert key in data
    assert data["competitors"][0]["pricing"]
    assert len(data["queries"]) == 6


def test_trends_are_cached_per_topic(client):
    h = register(client)
    first = client.get("/trends?topic=education", headers=h).json()
    assert first["cached"] is False and first["trends"]
    second = client.get("/trends?topic=education", headers=h).json()
    assert second["cached"] is True and second["updated_at"] == first["updated_at"]
    refreshed = client.get("/trends?topic=education&refresh=true", headers=h).json()
    assert refreshed["cached"] is False
    assert client.get("/trends?topic=space-pirates", headers=h).status_code == 422
    assert client.get("/trends").status_code == 401
