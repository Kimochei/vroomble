"""Create tables and load reference data.

    python -m app.seed            # catalog + pricing data + admin account (idempotent)
    python -m app.seed --demo     # also a demo user (demo@vroomble.app / demo12345) with two cars and logs
    python -m app.seed --retrain  # rebuild the price model from the pricing data
"""
from __future__ import annotations

import argparse
import json
import logging
import secrets
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import BASE_DIR, settings
from .db import Base, SessionLocal, engine
from .models import (
    CarModel, CarPart, ChangeType, MaintenanceLog, PricingModel,
    PricingModification, Role, User, UserVehicle,
)
from .security import hash_password

log = logging.getLogger("vroomble.seed")
SEED_DIR = BASE_DIR / "seed"


def _load(name: str) -> dict:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


def seed_catalog(db: Session) -> None:
    if db.scalar(select(func.count(CarModel.id))):
        return
    data = _load("catalog.json")
    fuel_map = {"Unleaded": "Gasoline"}
    for c in data["cars"]:
        db.add(CarModel(**{**c, "fuel_type": fuel_map.get(c["fuel_type"], c["fuel_type"])}))
    for p in data["parts"]:
        db.add(CarPart(brand=p["make"], name=p["part_name"], model_number=p["model_number"],
                       category=p["category"], srp=p["srp"]))
    db.commit()
    log.info("Seeded %d cars and %d parts", len(data["cars"]), len(data["parts"]))


def seed_pricing(db: Session) -> None:
    if db.scalar(select(func.count(PricingModel.id))):
        return
    data = _load("pricing.json")
    by_key: dict[tuple[str, str], PricingModel] = {}
    for m in data["models"]:
        pm = PricingModel(make=m["make"], model=m["model"], base_price=m["base_price"],
                          monthly_inflation_rate=m["monthly_inflation_rate"])
        db.add(pm)
        by_key[(m["make"], m["model"])] = pm
    for mod in data["modifications"]:
        pm = by_key.get((mod["make"], mod["model"]))
        if pm:
            pm.modifications.append(PricingModification(
                modification_type=mod["modification_type"], part=mod["part"], cost=mod["cost"]))
    db.commit()
    log.info("Seeded %d pricing models", len(by_key))


def ensure_admin(db: Session) -> None:
    if db.scalar(select(User).where(User.role == Role.admin)):
        return
    password = settings.admin_password or secrets.token_urlsafe(12)
    db.add(User(first_name="Vroomble", last_name="Admin", email=settings.admin_email.lower(),
                contact_number="09000000000", password_hash=hash_password(password), role=Role.admin))
    db.commit()
    if not settings.admin_password:
        log.warning("Created admin %s with generated password: %s  (set ADMIN_PASSWORD to choose one)",
                    settings.admin_email, password)


def seed_demo(db: Session) -> None:
    if db.scalar(select(User).where(User.email == "demo@vroomble.app")):
        return
    user = User(first_name="Juan", last_name="Dela Cruz", email="demo@vroomble.app",
                contact_number="09171234567", region="NCR", password_hash=hash_password("demo12345"))
    db.add(user)
    cars = db.scalars(select(CarModel).order_by(CarModel.id)).all()[:2]
    today = date.today()
    for i, car in enumerate(cars):
        v = UserVehicle(owner=user, car=car, trim=car.variant, color=["Pearl White", "Gunmetal"][i],
                        plate_ending=["1234", "5678"][i], mileage_km=[48_500, 92_300][i])
        v.logs = [
            MaintenanceLog(change_type=ChangeType.maintenance, details="Change oil and oil filter (5W-30 fully synthetic)",
                           cost=4_800, mileage_km=v.mileage_km - 5_000, performed_on=today - timedelta(days=120)),
            MaintenanceLog(change_type=ChangeType.modification, details="Installed LED headlight bulbs",
                           cost=6_500, performed_on=today - timedelta(days=45)),
        ]
        db.add(v)
    db.commit()
    log.info("Seeded demo user demo@vroomble.app / demo12345")


def init_db(demo: bool = False) -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_catalog(db)
        seed_pricing(db)
        ensure_admin(db)
        if demo:
            seed_demo(db)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--retrain", action="store_true")
    args = ap.parse_args()
    init_db(demo=args.demo)
    if args.retrain:
        from .pricing import train
        with SessionLocal() as db:
            train(db)
