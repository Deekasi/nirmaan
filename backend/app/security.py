import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": round(now.timestamp(), 3),  # milliseconds, so a reset in the same second still counts
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> tuple[int, float] | None:
    """Returns (user_id, issued_at) for a valid token, else None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"]), float(payload.get("iat", 0))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def new_reset_token() -> tuple[str, str]:
    """A random URL-safe token for the email link, and the SHA-256 hash we store instead of it."""
    token = secrets.token_urlsafe(32)
    return token, hash_reset_token(token)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
