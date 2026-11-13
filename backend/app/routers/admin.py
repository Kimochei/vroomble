from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from ..deps import DB, AdminUser
from ..models import CarModel, CarPart, Listing, ListingStatus, MaintenanceLog, Role, User, UserVehicle
from ..schemas import AnalyticsOut, CountItem, ListingOut, ReviewIn, UserOut
from ..serializers import listing_out

router = APIRouter(prefix="/admin", tags=["admin"])


def _counts(db, col, join_vehicles: bool = True) -> list[CountItem]:
    stmt = select(col, func.count(UserVehicle.id)).select_from(UserVehicle).join(UserVehicle.car)
    rows = db.execute(stmt.group_by(col).order_by(func.count(UserVehicle.id).desc())).all()
    return [CountItem(label=str(k), count=c) for k, c in rows]


@router.get("/analytics", response_model=AnalyticsOut)
def analytics(db: DB, _: AdminUser):
    by_year = db.execute(select(CarModel.year, func.count(UserVehicle.id)).select_from(UserVehicle)
                         .join(UserVehicle.car).group_by(CarModel.year).order_by(CarModel.year)).all()
    status_rows = db.execute(select(Listing.status, func.count(Listing.id)).group_by(Listing.status)).all()
    return AnalyticsOut(
        totals={
            "users": db.scalar(select(func.count(User.id)).where(User.role == Role.user)) or 0,
            "vehicles": db.scalar(select(func.count(UserVehicle.id))) or 0,
            "catalog_cars": db.scalar(select(func.count(CarModel.id))) or 0,
            "parts": db.scalar(select(func.count(CarPart.id))) or 0,
            "logs": db.scalar(select(func.count(MaintenanceLog.id))) or 0,
            "pending_listings": db.scalar(select(func.count(Listing.id)).where(Listing.status == ListingStatus.pending)) or 0,
        },
        by_make=_counts(db, CarModel.make),
        by_body_type=_counts(db, CarModel.body_type),
        by_fuel_type=_counts(db, CarModel.fuel_type),
        by_year=[CountItem(label=str(y), count=c) for y, c in by_year],
        listings_by_status=[CountItem(label=s.value, count=c) for s, c in status_rows],
    )


@router.get("/listings", response_model=list[ListingOut])
def review_queue(db: DB, admin: AdminUser, status_: ListingStatus = Query(ListingStatus.pending, alias="status")):
    rows = db.scalars(select(Listing).where(Listing.status == status_).order_by(Listing.updated_at.asc()).limit(200))
    return [listing_out(l, admin) for l in rows.unique()]


@router.post("/listings/{listing_id}/review", response_model=ListingOut)
def review(listing_id: int, body: ReviewIn, db: DB, admin: AdminUser):
    if body.status not in (ListingStatus.approved, ListingStatus.rejected):
        raise HTTPException(422, "Status must be approved or rejected.")
    if body.status == ListingStatus.rejected and not (body.note or "").strip():
        raise HTTPException(422, "Give the seller a reason for rejecting.")
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found.")
    listing.status, listing.review_note = body.status, (body.note or "").strip() or None
    db.commit()
    return listing_out(listing, admin)


@router.get("/users", response_model=list[UserOut])
def users(db: DB, _: AdminUser, q: str | None = Query(None, max_length=80)):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.first_name.ilike(like), User.last_name.ilike(like)))
    return db.scalars(stmt.limit(200)).all()


@router.post("/users/{user_id}/active", response_model=UserOut)
def set_active(user_id: int, db: DB, admin: AdminUser, active: bool = Query(...)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if user.id == admin.id:
        raise HTTPException(422, "You can't deactivate yourself.")
    user.is_active = active
    db.commit()
    return user
