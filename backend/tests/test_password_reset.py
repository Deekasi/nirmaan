import re
from datetime import datetime, timedelta, timezone

import pytest

from app import email
from app.database import SessionLocal
from app.models import PasswordReset
from tests.conftest import register


@pytest.fixture()
def outbox(monkeypatch):
    sent = []

    def fake_send(to, name, link, minutes):
        sent.append({"to": to, "link": link})
        return True

    monkeypatch.setattr(email, "send_password_reset", fake_send)
    return sent


def token_from(link: str) -> str:
    return re.search(r"token=([\w-]+)", link).group(1)


def test_full_reset_flow(client, outbox):
    old_headers = register(client, email="d@example.com", password="oldpassword1")
    r = client.post("/auth/forgot-password", json={"email": "D@Example.com"})
    assert r.status_code == 200 and len(outbox) == 1
    assert outbox[0]["link"].startswith("http://localhost:5173/reset-password?token=")

    token = token_from(outbox[0]["link"])
    ok = client.post("/auth/reset-password", json={"token": token, "password": "newpassword1"})
    assert ok.status_code == 200

    assert client.post("/auth/login", json={"email": "d@example.com", "password": "oldpassword1"}).status_code == 401
    assert client.post("/auth/login", json={"email": "d@example.com", "password": "newpassword1"}).status_code == 200
    # Sessions from before the reset are signed out.
    assert client.get("/auth/me", headers=old_headers).status_code == 401


def test_unknown_email_gets_same_answer_and_no_email(client, outbox):
    register(client, email="real@example.com")
    known = client.post("/auth/forgot-password", json={"email": "real@example.com"}).json()
    unknown = client.post("/auth/forgot-password", json={"email": "nobody@example.com"}).json()
    assert known == unknown
    assert [m["to"] for m in outbox] == ["real@example.com"]


def test_link_works_only_once(client, outbox):
    register(client, email="d@example.com")
    client.post("/auth/forgot-password", json={"email": "d@example.com"})
    token = token_from(outbox[0]["link"])
    assert client.post("/auth/reset-password", json={"token": token, "password": "newpassword1"}).status_code == 200
    assert client.post("/auth/reset-password", json={"token": token, "password": "another123"}).status_code == 400


def test_expired_and_fake_tokens_are_rejected(client, outbox):
    register(client, email="d@example.com")
    client.post("/auth/forgot-password", json={"email": "d@example.com"})
    token = token_from(outbox[0]["link"])
    with SessionLocal() as db:
        reset = db.query(PasswordReset).one()
        assert token not in reset.token_hash  # only the hash is stored
        reset.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert client.post("/auth/reset-password", json={"token": token, "password": "newpassword1"}).status_code == 400
    assert client.post("/auth/reset-password", json={"token": "x" * 40, "password": "newpassword1"}).status_code == 400


def test_one_email_per_minute(client, outbox):
    register(client, email="d@example.com")
    for _ in range(3):
        client.post("/auth/forgot-password", json={"email": "d@example.com"})
    assert len(outbox) == 1


def test_new_password_must_be_long_enough(client, outbox):
    register(client, email="d@example.com")
    client.post("/auth/forgot-password", json={"email": "d@example.com"})
    token = token_from(outbox[0]["link"])
    assert client.post("/auth/reset-password", json={"token": token, "password": "short"}).status_code == 422


def test_without_email_service_the_link_is_printed(client, capsys):
    register(client, email="d@example.com")
    client.post("/auth/forgot-password", json={"email": "d@example.com"})
    assert "reset-password?token=" in capsys.readouterr().out
