from __future__ import annotations

from .models import Listing, MaintenanceLog, User, UserVehicle
from .schemas import (
    CarModelOut, ImageOut, ListingBrief, ListingOut, LogOut, PublicLog, SellerOut, VehicleOut,
)
from .storage import media_url


def vehicle_out(v: UserVehicle) -> VehicleOut:
    return VehicleOut(
        id=v.id,
        car=CarModelOut.model_validate(v.car),
        trim=v.trim,
        color=v.color,
        plate_ending=v.plate_ending,
        mileage_km=v.mileage_km,
        images=[ImageOut(id=i.id, url=media_url(i.filename)) for i in v.images],
        listing=ListingBrief(id=v.listing.id, status=v.listing.status, asking_price=v.listing.asking_price,
                             description=v.listing.description,
                             review_note=v.listing.review_note) if v.listing else None,
        total_spent=sum(l.cost for l in v.logs),
        log_count=len(v.logs),
        created_at=v.created_at,
    )


def log_out(l: MaintenanceLog) -> LogOut:
    return LogOut(
        id=l.id, vehicle_id=l.vehicle_id, change_type=l.change_type, details=l.details, cost=l.cost,
        mileage_km=l.mileage_km, performed_on=l.performed_on,
        images=[ImageOut(id=i.id, url=media_url(i.filename)) for i in l.images],
    )


def listing_out(listing: Listing, viewer: User | None, with_logs: bool = False) -> ListingOut:
    owner = listing.vehicle.owner
    # Contact details are only revealed to signed-in users (reduces scraping of phone numbers).
    reveal = viewer is not None
    out = vehicle_out(listing.vehicle)
    out.plate_ending = ""  # never expose plate digits publicly
    return ListingOut(
        id=listing.id, status=listing.status, asking_price=listing.asking_price,
        description=listing.description, review_note=listing.review_note, created_at=listing.created_at,
        vehicle=out,
        seller=SellerOut(first_name=owner.first_name, region=owner.region,
                         contact_number=owner.contact_number if reveal else None,
                         email=owner.email if reveal else None),
        # Receipt photos stay private; buyers see what was done, when, and for how much.
        logs=[PublicLog(change_type=l.change_type, details=l.details, cost=l.cost, mileage_km=l.mileage_km,
                        performed_on=l.performed_on) for l in listing.vehicle.logs] if with_logs else [],
    )
