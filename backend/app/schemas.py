from __future__ import annotations

import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import ChangeType, ListingStatus, Role

BODY_TYPES = [
    "Sedan", "Hatchback", "Coupe", "Convertible", "Wagon", "SUV", "Crossover", "Pickup Truck",
    "Van", "MPV", "Sports Car", "Off-Road", "Kei Car", "Truck", "Other",
]
TRANSMISSIONS = ["Automatic", "Manual", "CVT", "DCT"]
DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD"]
FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Electric"]
PART_CATEGORIES = ["Maintenance", "Exterior", "Interior", "Wheels", "Tires", "Performance", "Offroad", "Electrical"]
REGIONS = [
    "NCR", "CAR", "Region I", "Region II", "Region III", "Region IV-A", "MIMAROPA", "Region V",
    "Region VI", "NIR", "Region VII", "Region VIII", "Region IX", "Region X", "Region XI",
    "Region XII", "Caraga", "BARMM",
]

PH_MOBILE = re.compile(r"^(\+63|0)9\d{9}$")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth / users ----------

class RegisterIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    contact_number: str
    password: str = Field(min_length=8, max_length=128)
    region: str | None = None

    @field_validator("contact_number")
    @classmethod
    def _phone(cls, v: str) -> str:
        v = re.sub(r"[\s-]", "", v)
        if not PH_MOBILE.match(v):
            raise ValueError("Use a PH mobile number like 09171234567 or +639171234567")
        return v

    @field_validator("region")
    @classmethod
    def _region(cls, v: str | None) -> str | None:
        if v and v not in REGIONS:
            raise ValueError("Unknown region")
        return v or None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=80)
    last_name: str | None = Field(None, min_length=1, max_length=80)
    contact_number: str | None = None
    region: str | None = None

    @field_validator("contact_number")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return None if v is None else RegisterIn._phone(v)

    @field_validator("region")
    @classmethod
    def _region(cls, v: str | None) -> str | None:
        return RegisterIn._region(v)


class UserOut(ORM):
    id: int
    first_name: str
    last_name: str
    email: str
    contact_number: str
    region: str | None
    role: Role
    is_active: bool
    created_at: datetime


# ---------- Catalog ----------

class CarModelIn(BaseModel):
    make: str = Field(min_length=1, max_length=60)
    model: str = Field(min_length=1, max_length=80)
    variant: str | None = Field(None, max_length=80)
    body_type: str
    transmission: str
    drivetrain: str
    fuel_type: str
    year: int = Field(ge=1950, le=date.today().year + 1)
    retail_srp: float = Field(gt=0)

    @field_validator("body_type")
    @classmethod
    def _b(cls, v: str) -> str:
        if v not in BODY_TYPES:
            raise ValueError("Unknown body type")
        return v

    @field_validator("transmission")
    @classmethod
    def _t(cls, v: str) -> str:
        if v not in TRANSMISSIONS:
            raise ValueError("Unknown transmission")
        return v

    @field_validator("drivetrain")
    @classmethod
    def _d(cls, v: str) -> str:
        if v not in DRIVETRAINS:
            raise ValueError("Unknown drivetrain")
        return v

    @field_validator("fuel_type")
    @classmethod
    def _f(cls, v: str) -> str:
        if v not in FUEL_TYPES:
            raise ValueError("Unknown fuel type")
        return v

    @field_validator("variant")
    @classmethod
    def _v(cls, v: str | None) -> str | None:
        return v.strip() or None if v else None


class CarModelOut(ORM):
    id: int
    make: str
    model: str
    variant: str | None
    body_type: str
    transmission: str
    drivetrain: str
    fuel_type: str
    year: int
    retail_srp: float


class CarPartIn(BaseModel):
    brand: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=120)
    model_number: str | None = Field(None, max_length=60)
    category: str
    srp: float = Field(gt=0)

    @field_validator("category")
    @classmethod
    def _c(cls, v: str) -> str:
        if v not in PART_CATEGORIES:
            raise ValueError("Unknown category")
        return v

    @field_validator("model_number")
    @classmethod
    def _m(cls, v: str | None) -> str | None:
        return v.strip() or None if v else None


class CarPartOut(ORM):
    id: int
    brand: str
    name: str
    model_number: str | None
    category: str
    srp: float


class Options(BaseModel):
    body_types: list[str] = BODY_TYPES
    transmissions: list[str] = TRANSMISSIONS
    drivetrains: list[str] = DRIVETRAINS
    fuel_types: list[str] = FUEL_TYPES
    part_categories: list[str] = PART_CATEGORIES
    regions: list[str] = REGIONS
    change_types: list[str] = [c.value for c in ChangeType]


# ---------- Garage ----------

class ImageOut(BaseModel):
    id: int
    url: str


class ListingBrief(BaseModel):
    id: int
    status: ListingStatus
    asking_price: float
    description: str
    review_note: str | None


class VehicleOut(BaseModel):
    id: int
    car: CarModelOut
    trim: str | None
    color: str
    plate_ending: str
    mileage_km: int
    images: list[ImageOut]
    listing: ListingBrief | None
    total_spent: float
    log_count: int
    created_at: datetime


class VehicleUpdate(BaseModel):
    trim: str | None = Field(None, max_length=80)
    color: str | None = Field(None, min_length=1, max_length=40)
    plate_ending: str | None = Field(None, pattern=r"^[0-9A-Za-z]{1,4}$")
    mileage_km: int | None = Field(None, ge=0, le=2_000_000)


# ---------- Maintenance ----------

class LogOut(BaseModel):
    id: int
    vehicle_id: int
    change_type: ChangeType
    details: str
    cost: float
    mileage_km: int | None
    performed_on: date
    images: list[ImageOut]


class LogUpdate(BaseModel):
    change_type: ChangeType | None = None
    details: str | None = Field(None, min_length=1, max_length=2000)
    cost: float | None = Field(None, ge=0)
    mileage_km: int | None = Field(None, ge=0)
    performed_on: date | None = None


# ---------- Listings ----------

class ListingIn(BaseModel):
    vehicle_id: int
    asking_price: float = Field(gt=0, le=1_000_000_000)
    description: str = Field("", max_length=4000)


class ListingUpdate(BaseModel):
    asking_price: float | None = Field(None, gt=0, le=1_000_000_000)
    description: str | None = Field(None, max_length=4000)


class SellerOut(BaseModel):
    first_name: str
    region: str | None
    contact_number: str | None  # only shown to logged-in viewers
    email: str | None


class PublicLog(BaseModel):
    change_type: ChangeType
    details: str
    cost: float
    mileage_km: int | None
    performed_on: date


class ListingOut(BaseModel):
    id: int
    status: ListingStatus
    asking_price: float
    description: str
    review_note: str | None
    created_at: datetime
    vehicle: VehicleOut
    seller: SellerOut
    logs: list[PublicLog] = []  # filled on the detail endpoint only


class ListingPage(BaseModel):
    items: list[ListingOut]
    total: int
    page: int
    page_size: int


class ReviewIn(BaseModel):
    status: ListingStatus
    note: str | None = Field(None, max_length=300)


# ---------- Prediction ----------

class PredictIn(BaseModel):
    make: str
    model: str
    modification_type: str | None = None
    parts: list[str] = []
    months: int = Field(12, ge=1, le=60)


class ProjectionPoint(BaseModel):
    month: int
    value: float


class PredictOut(BaseModel):
    make: str
    model: str
    modification_type: str | None
    parts: list[str]
    months: int
    base_price: float
    parts_cost: float
    current_total: float
    predicted_price: float
    formula_price: float
    monthly_inflation_rate: float
    projection: list[ProjectionPoint]


# ---------- Analytics ----------

class CountItem(BaseModel):
    label: str
    count: int


class AnalyticsOut(BaseModel):
    totals: dict[str, int]
    by_make: list[CountItem]
    by_body_type: list[CountItem]
    by_fuel_type: list[CountItem]
    by_year: list[CountItem]
    listings_by_status: list[CountItem]
