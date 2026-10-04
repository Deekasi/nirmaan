from tests.conftest import register


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_login_and_me(client):
    headers = register(client)
    assert client.get("/auth/me", headers=headers).json()["email"] == "mridul@example.com"

    ok = client.post("/auth/login", json={"email": "MRIDUL@example.com", "password": "supersecret1"})
    assert ok.status_code == 200

    bad = client.post("/auth/login", json={"email": "mridul@example.com", "password": "wrongpass1"})
    assert bad.status_code == 401


def test_duplicate_email_rejected(client):
    register(client)
    r = client.post(
        "/auth/register",
        json={"email": "mridul@example.com", "name": "Again", "password": "supersecret1"},
    )
    assert r.status_code == 409


def test_projects_require_auth(client):
    assert client.get("/projects").status_code == 401


def test_project_crud(client):
    headers = register(client)
    created = client.post(
        "/projects",
        json={"name": "Mess feedback", "idea": "An app for hostel students to rate daily mess food."},
        headers=headers,
    )
    assert created.status_code == 201
    pid = created.json()["id"]
    assert created.json()["stage"] == "research"

    assert len(client.get("/projects", headers=headers).json()) == 1

    updated = client.patch(f"/projects/{pid}", json={"name": "Mess rating"}, headers=headers)
    assert updated.json()["name"] == "Mess rating"

    assert client.delete(f"/projects/{pid}", headers=headers).status_code == 204
    assert client.get(f"/projects/{pid}", headers=headers).status_code == 404


def test_users_cannot_see_each_others_projects(client):
    a = register(client, email="a@example.com")
    b = register(client, email="b@example.com")
    pid = client.post(
        "/projects", json={"name": "Secret", "idea": "Something only A should see."}, headers=a
    ).json()["id"]
    assert client.get(f"/projects/{pid}", headers=b).status_code == 404
    assert client.get("/projects", headers=b).json() == []


def test_gibberish_ideas_are_rejected(client):
    headers = register(client)
    for bad in ("hdiheufhuehfoueh79fhrwwunfo", "asdf qwer", "1234567890 !!!!"):
        r = client.post("/projects", json={"name": "x", "idea": bad}, headers=headers)
        assert r.status_code == 422, bad
    ok = client.post("/projects", json={"name": "x", "idea": "किसानों के लिए फसल की कीमत बताने वाला ऐप"}, headers=headers)
    assert ok.status_code == 201  # Hindi ideas are fine


def test_editing_idea_to_gibberish_is_rejected(client):
    headers = register(client)
    pid = client.post("/projects", json={"name": "x", "idea": "An app for students to share notes."}, headers=headers).json()["id"]
    assert client.patch(f"/projects/{pid}", json={"idea": "jhbbikgyuikyui"}, headers=headers).status_code == 422
