from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from ..deps import DB, CurrentUser, owned_vehicle
from ..models import CarModel, UserVehicle, VehicleImage
from ..schemas import VehicleOut, VehicleUpdate
from ..serializers import vehicle_out
from ..storage import delete_image, save_image

router = APIRouter(prefix="/garage", tags=["garage"])
MAX_IMAGES = 10


@router.get("", response_model=list[VehicleOut])
def my_vehicles(user: CurrentUser, db: DB):
    rows = db.scalars(select(UserVehicle).where(UserVehicle.owner_id == user.id).order_by(UserVehicle.created_at.desc()))
    return [vehicle_out(v) for v in rows.unique()]


@router.post("", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
async def register_vehicle(
    user: CurrentUser,
    db: DB,
    car_model_id: Annotated[int, Form()],
    color: Annotated[str, Form(min_length=1, max_length=40)],
    plate_ending: Annotated[str, Form(pattern=r"^[0-9A-Za-z]{1,4}$")],
    mileage_km: Annotated[int, Form(ge=0, le=2_000_000)],
    trim: Annotated[str | None, Form(max_length=80)] = None,
    images: Annotated[list[UploadFile] | None, File()] = None,
):
    if db.get(CarModel, car_model_id) is None:
        raise HTTPException(422, "Pick a car from the catalog.")
    images = [i for i in (images or []) if i.filename]
    if len(images) > MAX_IMAGES:
        raise HTTPException(422, f"Up to {MAX_IMAGES} photos.")
    vehicle = UserVehicle(owner_id=user.id, car_model_id=car_model_id, color=color.strip(),
                          plate_ending=plate_ending.upper(), mileage_km=mileage_km, trim=(trim or "").strip() or None)
    saved: list[str] = []
    try:
        for pos, img in enumerate(images):
            name = await save_image(img, "veh")
            saved.append(name)
            vehicle.images.append(VehicleImage(filename=name, position=pos))
        db.add(vehicle)
        db.commit()
    except Exception:
        db.rollback()
        for n in saved:
            delete_image(n)
        raise
    db.refresh(vehicle)
    return vehicle_out(vehicle)


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: int, user: CurrentUser, db: DB):
    return vehicle_out(owned_vehicle(db, vehicle_id, user))


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: int, body: VehicleUpdate, user: CurrentUser, db: DB):
    v = owned_vehicle(db, vehicle_id, user)
    for k, val in body.model_dump(exclude_unset=True).items():
        if val is None and k != "trim":
            continue
        if k == "plate_ending":
            val = val.upper()
        setattr(v, k, val)
    db.commit()
    return vehicle_out(v)


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: int, user: CurrentUser, db: DB):
    v = owned_vehicle(db, vehicle_id, user)
    files = [i.filename for i in v.images] + [i.filename for l in v.logs for i in l.images]
    db.delete(v)
    db.commit()
    for f in files:
        delete_image(f)


@router.post("/{vehicle_id}/images", response_model=VehicleOut)
async def add_images(vehicle_id: int, user: CurrentUser, db: DB, images: Annotated[list[UploadFile], File()]):
    v = owned_vehicle(db, vehicle_id, user)
    if len(v.images) + len(images) > MAX_IMAGES:
        raise HTTPException(422, f"Up to {MAX_IMAGES} photos per vehicle.")
    start = max((i.position for i in v.images), default=-1) + 1
    for offset, img in enumerate(images):
        v.images.append(VehicleImage(filename=await save_image(img, "veh"), position=start + offset))
    db.commit()
    return vehicle_out(v)


@router.delete("/{vehicle_id}/images/{image_id}", response_model=VehicleOut)
def remove_image(vehicle_id: int, image_id: int, user: CurrentUser, db: DB):
    v = owned_vehicle(db, vehicle_id, user)
    img = next((i for i in v.images if i.id == image_id), None)
    if img is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found.")
    v.images.remove(img)
    db.commit()
    delete_image(img.filename)
    return vehicle_out(v)
