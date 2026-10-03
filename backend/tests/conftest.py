import os

# Use a throwaway SQLite file for tests. Must be set before the app is imported.
os.environ["DATABASE_URL"] = "sqlite:///./test_nirmaan.db"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


def register(client, email="mridul@example.com", name="Mridul", password="supersecret1"):
    r = client.post("/auth/register", json={"email": email, "name": name, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
