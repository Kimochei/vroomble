"""Database schema. One database replaces the old users/cars/parts/prediction SQLite files."""
from __future__ import annotations

import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean, Date, DateTime as _DateTime, Enum, Float, ForeignKey, Integer, String, Text, TypeDecorator,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DateTime(TypeDecorator):
    """Timezone-aware UTC datetimes, even on SQLite (which stores them naive)."""
    impl = _DateTime
    cache_ok = True

    def __init__(self, timezone: bool = True):
        super().__init__(timezone=timezone)

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class Role(str, enum.Enum):
    user = "user"
    admin = "admin"


class ListingStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    withdrawn = "withdrawn"


class ChangeType(str, enum.Enum):
    maintenance = "maintenance"
    modification = "modification"
    accident = "accident"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    contact_number: Mapped[str] = mapped_column(String(32))
    region: Mapped[str | None] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(128))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.user)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    vehicles: Mapped[list[UserVehicle]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class CarModel(Base):
    """Catalog entry managed by admins (make/model/variant/year)."""
    __tablename__ = "car_models"
    __table_args__ = (UniqueConstraint("make", "model", "variant", "year", name="uq_car_model"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    make: Mapped[str] = mapped_column(String(60), index=True)
    model: Mapped[str] = mapped_column(String(80))
    variant: Mapped[str | None] = mapped_column(String(80))
    body_type: Mapped[str] = mapped_column(String(40))
    transmission: Mapped[str] = mapped_column(String(20))
    drivetrain: Mapped[str] = mapped_column(String(10))
    fuel_type: Mapped[str] = mapped_column(String(20))
    year: Mapped[int] = mapped_column(Integer, index=True)
    retail_srp: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CarPart(Base):
    __tablename__ = "car_parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(120))
    model_number: Mapped[str | None] = mapped_column(String(60), unique=True)
    category: Mapped[str] = mapped_column(String(30))
    srp: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserVehicle(Base):
    """A car a user owns ("garage" entry)."""
    __tablename__ = "user_vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    car_model_id: Mapped[int] = mapped_column(ForeignKey("car_models.id", ondelete="RESTRICT"))
    trim: Mapped[str | None] = mapped_column(String(80))
    color: Mapped[str] = mapped_column(String(40))
    plate_ending: Mapped[str] = mapped_column(String(4))
    mileage_km: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped[User] = relationship(back_populates="vehicles")
    car: Mapped[CarModel] = relationship(lazy="joined")
    images: Mapped[list[VehicleImage]] = relationship(
        back_populates="vehicle", cascade="all, delete-orphan", order_by="VehicleImage.position"
    )
    logs: Mapped[list[MaintenanceLog]] = relationship(
        back_populates="vehicle", cascade="all, delete-orphan", order_by="MaintenanceLog.performed_on.desc()"
    )
    listing: Mapped[Listing | None] = relationship(back_populates="vehicle", cascade="all, delete-orphan", uselist=False)


class VehicleImage(Base):
    __tablename__ = "vehicle_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("user_vehicles.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(80))
    position: Mapped[int] = mapped_column(Integer, default=0)

    vehicle: Mapped[UserVehicle] = relationship(back_populates="images")


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("user_vehicles.id", ondelete="CASCADE"), index=True)
    change_type: Mapped[ChangeType] = mapped_column(Enum(ChangeType))
    details: Mapped[str] = mapped_column(Text)
    cost: Mapped[float] = mapped_column(Float, default=0)
    mileage_km: Mapped[int | None] = mapped_column(Integer)
    performed_on: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    vehicle: Mapped[UserVehicle] = relationship(back_populates="logs")
    images: Mapped[list[MaintenanceImage]] = relationship(back_populates="log", cascade="all, delete-orphan")


class MaintenanceImage(Base):
    __tablename__ = "maintenance_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    log_id: Mapped[int] = mapped_column(ForeignKey("maintenance_logs.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(80))

    log: Mapped[MaintenanceLog] = relationship(back_populates="images")


class Listing(Base):
    """A garage vehicle put up for sale. Admins approve before it goes public."""
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("user_vehicles.id", ondelete="CASCADE"), unique=True)
    asking_price: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus), default=ListingStatus.pending, index=True)
    review_note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    vehicle: Mapped[UserVehicle] = relationship(back_populates="listing")


# ---- Price-prediction reference data (from the original "Vroomble Dataset") ----

class PricingModel(Base):
    __tablename__ = "pricing_models"
    __table_args__ = (UniqueConstraint("make", "model", name="uq_pricing_model"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    make: Mapped[str] = mapped_column(String(60), index=True)
    model: Mapped[str] = mapped_column(String(80))
    base_price: Mapped[float] = mapped_column(Float)
    monthly_inflation_rate: Mapped[float] = mapped_column(Float)

    modifications: Mapped[list[PricingModification]] = relationship(
        back_populates="pricing_model", cascade="all, delete-orphan"
    )


class PricingModification(Base):
    __tablename__ = "pricing_modifications"
    __table_args__ = (UniqueConstraint("pricing_model_id", "modification_type", "part", name="uq_pricing_mod"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    pricing_model_id: Mapped[int] = mapped_column(ForeignKey("pricing_models.id", ondelete="CASCADE"), index=True)
    modification_type: Mapped[str] = mapped_column(String(40))
    part: Mapped[str] = mapped_column(String(160))
    cost: Mapped[float] = mapped_column(Float)

    pricing_model: Mapped[PricingModel] = relationship(back_populates="modifications")
