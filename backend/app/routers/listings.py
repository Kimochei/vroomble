from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from ..deps import DB, CurrentUser, OptionalUser, owned_vehicle
from ..models import CarModel, Listing, ListingStatus, User, UserVehicle
from ..schemas import ListingIn, ListingOut, ListingPage, ListingUpdate
from ..serializers import listing_out

router = APIRouter(prefix="/listings", tags=["listings"])

SORTS = {
    "newest": Listing.created_at.desc(),
    "price_asc": Listing.asking_price.asc(),
    "price_desc": Listing.asking_price.desc(),
    "year_desc": CarModel.year.desc(),
    "mileage_asc": UserVehicle.mileage_km.asc(),
}


@router.get("", response_model=ListingPage)
def browse(
    db: DB,
    viewer: OptionalUser,
    q: str | None = Query(None, max_length=60),
    make: str | None = None,
    body_type: str | None = None,
    fuel_type: str | None = None,
    transmission: str | None = None,
    region: str | None = None,
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    min_year: int | None = None,
    max_year: int | None = None,
    sort: Literal["newest", "price_asc", "price_desc", "year_desc", "mileage_asc"] = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
):
    stmt = (select(Listing).join(Listing.vehicle).join(UserVehicle.car).join(UserVehicle.owner)
            .where(Listing.status == ListingStatus.approved, User.is_active.is_(True)))
    if q:
        for t in q.split():
            like = f"%{t}%"
            stmt = stmt.where(or_(CarModel.make.ilike(like), CarModel.model.ilike(like),
                                  CarModel.variant.ilike(like), Listing.description.ilike(like)))
    filters = {CarModel.make: make, CarModel.body_type: body_type, CarModel.fuel_type: fuel_type,
               CarModel.transmission: transmission, User.region: region}
    for col, val in filters.items():
        if val:
            stmt = stmt.where(col == val)
    if min_price is not None:
        stmt = stmt.where(Listing.asking_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Listing.asking_price <= max_price)
    if min_year is not None:
        stmt = stmt.where(CarModel.year >= min_year)
    if max_year is not None:
        stmt = stmt.where(CarModel.year <= max_year)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(SORTS[sort], Listing.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListingPage(items=[listing_out(l, viewer) for l in rows.unique()], total=total or 0,
                       page=page, page_size=page_size)


@router.get("/facets")
def facets(db: DB):
    """Distinct makes and price/year ranges among live listings (for the filter UI)."""
    base = (select(CarModel.make).join(UserVehicle, UserVehicle.car_model_id == CarModel.id)
            .join(Listing, Listing.vehicle_id == UserVehicle.id).where(Listing.status == ListingStatus.approved))
    makes = sorted(set(db.scalars(base).all()))
    return {"makes": makes}


@router.get("/mine", response_model=list[ListingOut])
def my_listings(user: CurrentUser, db: DB):
    rows = db.scalars(select(Listing).join(Listing.vehicle).where(UserVehicle.owner_id == user.id)
                      .order_by(Listing.updated_at.desc()))
    return [listing_out(l, user) for l in rows.unique()]


@router.get("/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: DB, viewer: OptionalUser):
    listing = db.get(Listing, listing_id)
    is_owner = viewer is not None and listing is not None and listing.vehicle.owner_id == viewer.id
    is_admin = viewer is not None and viewer.role.value == "admin"
    if listing is None or (listing.status != ListingStatus.approved and not (is_owner or is_admin)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found.")
    return listing_out(listing, viewer, with_logs=True)


@router.post("", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(body: ListingIn, user: CurrentUser, db: DB):
    v = owned_vehicle(db, body.vehicle_id, user)
    if not v.images:
        raise HTTPException(422, "Add at least one photo before listing.")
    if v.listing and v.listing.status in (ListingStatus.pending, ListingStatus.approved):
        raise HTTPException(status.HTTP_409_CONFLICT, "This vehicle is already listed.")
    if v.listing:  # re-listing after withdrawal/rejection
        v.listing.asking_price, v.listing.description = body.asking_price, body.description.strip()
        v.listing.status, v.listing.review_note = ListingStatus.pending, None
    else:
        v.listing = Listing(asking_price=body.asking_price, description=body.description.strip())
    db.commit()
    return listing_out(v.listing, user)


@router.patch("/{listing_id}", response_model=ListingOut)
def update_listing(listing_id: int, body: ListingUpdate, user: CurrentUser, db: DB):
    listing = _owned_listing(db, listing_id, user)
    changed = False
    for k, val in body.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(listing, k, val.strip() if isinstance(val, str) else val)
            changed = True
    if changed and listing.status == ListingStatus.approved:
        listing.status = ListingStatus.pending  # edits go back through review
    db.commit()
    return listing_out(listing, user)


@router.post("/{listing_id}/withdraw", response_model=ListingOut)
def withdraw(listing_id: int, user: CurrentUser, db: DB):
    listing = _owned_listing(db, listing_id, user)
    listing.status = ListingStatus.withdrawn
    db.commit()
    return listing_out(listing, user)


def _owned_listing(db, listing_id: int, user) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None or listing.vehicle.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found.")
    return listing
