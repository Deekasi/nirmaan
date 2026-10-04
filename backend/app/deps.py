from datetime import timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in again to continue.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    decoded = decode_access_token(creds.credentials)
    if decoded is None:
        raise unauthorized
    user_id, issued_at = decoded
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    # After a password reset, tokens issued earlier (e.g. on a stolen device) stop working.
    changed = user.password_changed_at
    if changed is not None:
        changed = changed if changed.tzinfo else changed.replace(tzinfo=timezone.utc)
        if issued_at < changed.timestamp():
            raise unauthorized
    return user
