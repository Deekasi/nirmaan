import html
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import email
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import PasswordReset, User
from app.schemas import ForgotPasswordRequest, LoginRequest, ResetPasswordRequest, Token, UserCreate, UserOut
from app.security import (
    create_access_token,
    hash_password,
    hash_reset_token,
    new_reset_token,
    verify_password,
)

RESEND_COOLDOWN_SECONDS = 60
FORGOT_MESSAGE = "If an account exists for that email, we've sent a link to reset the password."

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(email=email, name=body.name.strip(), hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Same answer whether or not the account exists, so this can't be used to find who has an account.
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None:
        return {"message": FORGOT_MESSAGE}

    now = datetime.now(timezone.utc)
    latest = db.scalar(
        select(PasswordReset).where(PasswordReset.user_id == user.id).order_by(PasswordReset.created_at.desc())
    )
    if latest and (now - _aware(latest.created_at)).total_seconds() < RESEND_COOLDOWN_SECONDS:
        return {"message": FORGOT_MESSAGE}  # one email per minute is plenty

    token, token_hash = new_reset_token()
    db.add(PasswordReset(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=now + timedelta(minutes=settings.reset_token_minutes),
    ))
    db.commit()

    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    email.send_password_reset(user.email, html.escape(user.name), link, settings.reset_token_minutes)
    return {"message": FORGOT_MESSAGE}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Ask for a new one.")
    reset = db.scalar(select(PasswordReset).where(PasswordReset.token_hash == hash_reset_token(body.token)))
    now = datetime.now(timezone.utc)
    if reset is None or reset.used_at is not None or _aware(reset.expires_at) < now:
        raise invalid
    user = db.get(User, reset.user_id)
    if user is None:
        raise invalid

    user.hashed_password = hash_password(body.password)
    user.password_changed_at = now
    # Use up this link and any other open links for the same account.
    for r in db.scalars(select(PasswordReset).where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None))):
        r.used_at = now
    db.commit()
    return {"message": "Your password has been changed. You can sign in now."}
