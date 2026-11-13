from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from ..deps import DB, CurrentUser, OptionalUser
from ..models import User
from ..schemas import LoginIn, ProfileUpdate, RegisterIn, UserOut
from ..security import clear_session_cookie, hash_password, set_session_cookie, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Constant-time-ish: always run a bcrypt check so unknown emails take as long as wrong passwords.
_DUMMY_HASH = hash_password("not-a-real-password")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, response: Response, db: DB):
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(first_name=body.first_name.strip(), last_name=body.last_name.strip(), email=email,
                contact_number=body.contact_number, region=body.region,
                password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: DB):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")
    set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    clear_session_cookie(response)


@router.get("/me", response_model=UserOut | None)
def me(user: OptionalUser):
    """The signed-in user, or null for visitors (200 either way, so pages don't log errors)."""
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: CurrentUser, db: DB):
    for k, v in body.model_dump(exclude_unset=True).items():
        if k != "region" and v is None:
            continue
        setattr(user, k, v.strip() if isinstance(v, str) else v)
    db.commit()
    return user
