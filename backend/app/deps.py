from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Role, User, UserVehicle
from .security import decode_token

DB = Annotated[Session, Depends(get_db)]


def optional_user(request: Request, db: DB) -> User | None:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        return None
    user_id = decode_token(token)
    if user_id is None:
        return None
    user = db.get(User, user_id)
    return user if user and user.is_active else None


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in.")
    return user


def admin_user(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
AdminUser = Annotated[User, Depends(admin_user)]


def owned_vehicle(db: Session, vehicle_id: int, user: User) -> UserVehicle:
    """Fetch a garage vehicle, 404 if it doesn't exist or isn't the caller's."""
    vehicle = db.get(UserVehicle, vehicle_id)
    if vehicle is None or vehicle.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found.")
    return vehicle
