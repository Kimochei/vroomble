from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import String, cast, or_, select
from sqlalchemy.exc import IntegrityError

from ..deps import DB, AdminUser
from ..models import CarModel, CarPart, UserVehicle
from ..schemas import CarModelIn, CarModelOut, CarPartIn, CarPartOut, Options

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/options", response_model=Options)
def options():
    return Options()


@router.get("/cars", response_model=list[CarModelOut])
def list_cars(db: DB, q: str | None = Query(None, max_length=60)):
    stmt = select(CarModel).order_by(CarModel.make, CarModel.model, CarModel.year.desc())
    if q:
        terms = q.split()
        for t in terms:
            like = f"%{t}%"
            stmt = stmt.where(or_(CarModel.make.ilike(like), CarModel.model.ilike(like),
                                  CarModel.variant.ilike(like), cast(CarModel.year, String).like(like)))
    return db.scalars(stmt.limit(200)).all()


@router.post("/cars", response_model=CarModelOut, status_code=status.HTTP_201_CREATED)
def create_car(body: CarModelIn, db: DB, _: AdminUser):
    car = CarModel(**body.model_dump())
    db.add(car)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That make/model/variant/year already exists.")
    return car


@router.put("/cars/{car_id}", response_model=CarModelOut)
def update_car(car_id: int, body: CarModelIn, db: DB, _: AdminUser):
    car = db.get(CarModel, car_id) or _404()
    for k, v in body.model_dump().items():
        setattr(car, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That make/model/variant/year already exists.")
    return car


@router.delete("/cars/{car_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_car(car_id: int, db: DB, _: AdminUser):
    car = db.get(CarModel, car_id) or _404()
    if db.scalar(select(UserVehicle.id).where(UserVehicle.car_model_id == car_id).limit(1)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Users have registered this car; it can't be deleted.")
    db.delete(car)
    db.commit()


@router.get("/parts", response_model=list[CarPartOut])
def list_parts(db: DB, q: str | None = Query(None, max_length=60), category: str | None = None):
    stmt = select(CarPart).order_by(CarPart.category, CarPart.brand, CarPart.name)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(CarPart.brand.ilike(like), CarPart.name.ilike(like), CarPart.model_number.ilike(like)))
    if category:
        stmt = stmt.where(CarPart.category == category)
    return db.scalars(stmt.limit(500)).all()


@router.post("/parts", response_model=CarPartOut, status_code=status.HTTP_201_CREATED)
def create_part(body: CarPartIn, db: DB, _: AdminUser):
    part = CarPart(**body.model_dump())
    db.add(part)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A part with this model number already exists.")
    return part


@router.delete("/parts/{part_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_part(part_id: int, db: DB, _: AdminUser):
    part = db.get(CarPart, part_id) or _404()
    db.delete(part)
    db.commit()


def _404():
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
