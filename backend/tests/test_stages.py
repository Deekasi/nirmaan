import io
import zipfile

import pytest

from tests.conftest import register


def new_project(client, headers):
    r = client.post(
        "/projects",
        json={"name": "Mess feedback", "idea": "Hostel students rate daily mess food."},
        headers=headers,
    )
    return r.json()["id"]


def run_until_plan(client, headers, pid):
    for stage in ("research", "validate", "plan"):
        r = client.post(f"/projects/{pid}/{stage}", headers=headers)
        assert r.status_code == 200, r.text
    return client.get(f"/projects/{pid}/results", headers=headers).json()


def test_stages_must_run_in_order(client):
    h = register(client)
    pid = new_project(client, h)
    assert client.post(f"/projects/{pid}/validate", headers=h).status_code == 409
    assert client.post(f"/projects/{pid}/plan", headers=h).status_code == 409


def test_research_saves_sources_and_advances_stage(client):
    h = register(client)
    pid = new_project(client, h)
    r = client.post(f"/projects/{pid}/research", headers=h)
    assert r.status_code == 200
    assert r.json()["data"]["competitors"]
    assert r.json()["data"]["sources"][0]["url"].startswith("https://")
    assert client.get(f"/projects/{pid}", headers=h).json()["stage"] == "validate"


def test_rerunning_a_stage_does_not_move_project_backwards(client):
    h = register(client)
    pid = new_project(client, h)
    run_until_plan(client, h, pid)
    client.post(f"/projects/{pid}/research", headers=h)
    assert client.get(f"/projects/{pid}", headers=h).json()["stage"] == "build"


@pytest.mark.parametrize(
    "template, must_have",
    [
        ("landing", ["index.html", "style.css"]),
        ("webapp", ["main.py", "static/index.html", "requirements.txt"]),
        ("chatbot", ["main.py", "static/index.html", ".env.example"]),
    ],
)
def test_full_flow_builds_a_downloadable_project(client, template, must_have):
    h = register(client)
    pid = new_project(client, h)
    results = run_until_plan(client, h, pid)
    plan = next(r for r in results if r["stage"] == "plan")["data"]
    musts = [f["name"] for f in plan["features"] if f["priority"] == "must"]

    built = client.post(
        f"/projects/{pid}/build", json={"selected_features": musts, "template": template}, headers=h
    )
    assert built.status_code == 200, built.text
    assert client.get(f"/projects/{pid}", headers=h).json()["stage"] == "download"

    dl = client.get(f"/projects/{pid}/download", headers=h)
    assert dl.status_code == 200
    assert dl.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(dl.content)).namelist()
    folder = names[0].split("/")[0]
    for f in must_have + ["README.md", "NIRMAAN_REPORT.md", ".gitignore"]:
        assert f"{folder}/{f}" in names


def test_build_rejects_unknown_features(client):
    h = register(client)
    pid = new_project(client, h)
    run_until_plan(client, h, pid)
    r = client.post(
        f"/projects/{pid}/build", json={"selected_features": ["Teleportation"], "template": "webapp"}, headers=h
    )
    assert r.status_code == 422


def test_other_users_cannot_run_or_download(client):
    a = register(client, email="a@example.com")
    b = register(client, email="b@example.com")
    pid = new_project(client, a)
    assert client.post(f"/projects/{pid}/research", headers=b).status_code == 404
    assert client.get(f"/projects/{pid}/download", headers=b).status_code == 404
