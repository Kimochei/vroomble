from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from ..deps import DB, CurrentUser, owned_vehicle
from ..models import ChangeType, MaintenanceImage, MaintenanceLog
from ..schemas import LogOut, LogUpdate
from ..serializers import log_out
from ..storage import delete_image, save_image

router = APIRouter(prefix="/garage/{vehicle_id}/logs", tags=["maintenance"])


def _owned_log(db, vehicle_id: int, log_id: int, user) -> MaintenanceLog:
    v = owned_vehicle(db, vehicle_id, user)
    log = next((l for l in v.logs if l.id == log_id), None)
    if log is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log entry not found.")
    return log


@router.get("", response_model=list[LogOut])
def list_logs(vehicle_id: int, user: CurrentUser, db: DB):
    return [log_out(l) for l in owned_vehicle(db, vehicle_id, user).logs]


@router.post("", response_model=LogOut, status_code=status.HTTP_201_CREATED)
async def add_log(
    vehicle_id: int,
    user: CurrentUser,
    db: DB,
    change_type: Annotated[ChangeType, Form()],
    details: Annotated[str, Form(min_length=1, max_length=2000)],
    performed_on: Annotated[date, Form()],
    cost: Annotated[float, Form(ge=0)] = 0,
    mileage_km: Annotated[int | None, Form(ge=0)] = None,
    images: Annotated[list[UploadFile] | None, File()] = None,
):
    v = owned_vehicle(db, vehicle_id, user)
    if performed_on > date.today():
        raise HTTPException(422, "Date can't be in the future.")
    entry = MaintenanceLog(change_type=change_type, details=details.strip(), cost=cost,
                           mileage_km=mileage_km, performed_on=performed_on)
    for img in [i for i in (images or []) if i.filename][:6]:
        entry.images.append(MaintenanceImage(filename=await save_image(img, "log")))
    v.logs.append(entry)
    if mileage_km and mileage_km > v.mileage_km:
        v.mileage_km = mileage_km  # keep the odometer current
    db.commit()
    return log_out(entry)


@router.patch("/{log_id}", response_model=LogOut)
def update_log(vehicle_id: int, log_id: int, body: LogUpdate, user: CurrentUser, db: DB):
    entry = _owned_log(db, vehicle_id, log_id, user)
    data = body.model_dump(exclude_unset=True)
    if data.get("performed_on") and data["performed_on"] > date.today():
        raise HTTPException(422, "Date can't be in the future.")
    for k, val in data.items():
        if val is not None or k == "mileage_km":
            setattr(entry, k, val)
    db.commit()
    return log_out(entry)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(vehicle_id: int, log_id: int, user: CurrentUser, db: DB):
    entry = _owned_log(db, vehicle_id, log_id, user)
    files = [i.filename for i in entry.images]
    entry.vehicle.logs.remove(entry)
    db.commit()
    for f in files:
        delete_image(f)
