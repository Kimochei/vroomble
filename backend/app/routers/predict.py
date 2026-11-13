from __future__ import annotations

import smtplib
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from ..config import settings
from ..deps import DB, CurrentUser
from ..models import PricingModel, PricingModification
from ..pricing import formula_price, lookup, parts_cost, predictor
from ..schemas import PredictIn, PredictOut, ProjectionPoint

router = APIRouter(prefix="/predict", tags=["prediction"])


@router.get("/makes", response_model=list[str])
def makes(db: DB):
    return db.scalars(select(PricingModel.make).distinct().order_by(PricingModel.make)).all()


@router.get("/models", response_model=list[str])
def models(db: DB, make: str = Query(...)):
    return db.scalars(select(PricingModel.model).where(PricingModel.make == make).order_by(PricingModel.model)).all()


@router.get("/modifications")
def modifications(db: DB, make: str = Query(...), model: str = Query(...)):
    """Modification types for a car, each with its available parts and costs."""
    pm = lookup(db, make, model)
    if pm is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Car not found.")
    rows = db.scalars(select(PricingModification).where(PricingModification.pricing_model_id == pm.id)
                      .order_by(PricingModification.modification_type, PricingModification.cost)).all()
    grouped: dict[str, list[dict]] = {}
    for r in rows:
        grouped.setdefault(r.modification_type, []).append({"part": r.part, "cost": r.cost})
    return {"base_price": pm.base_price, "types": grouped}


@router.post("", response_model=PredictOut)
def predict(body: PredictIn, db: DB):
    pm = lookup(db, body.make, body.model)
    if pm is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No pricing data for {body.make} {body.model}.")
    cost, matched = parts_cost(db, pm, body.modification_type, body.parts)
    months = list(range(0, body.months + 1))
    raw = predictor.predict(pm.base_price, cost, pm.monthly_inflation_rate, months)
    # Anchor the curve to today's known value: the model supplies the change over time.
    values = [pm.base_price + cost + (v - raw[0]) for v in raw]
    return PredictOut(
        make=pm.make, model=pm.model, modification_type=body.modification_type if matched else None,
        parts=matched, months=body.months, base_price=pm.base_price, parts_cost=cost,
        current_total=pm.base_price + cost, predicted_price=values[-1],
        formula_price=formula_price(pm.base_price, cost, pm.monthly_inflation_rate, body.months),
        monthly_inflation_rate=pm.monthly_inflation_rate,
        projection=[ProjectionPoint(month=m, value=round(v, 2)) for m, v in zip(months, values)],
    )


@router.get("/email-enabled")
def email_enabled():
    return {"enabled": settings.email_enabled}


@router.post("/email", status_code=status.HTTP_202_ACCEPTED)
def email_result(body: PredictIn, user: CurrentUser, db: DB):
    """Email a prediction to the signed-in user's own address (never an arbitrary recipient)."""
    if not settings.email_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Email isn't configured on this server.")
    r = predict(body, db)
    peso = lambda v: f"₱{v:,.2f}"
    lines = [
        f"Hi {user.first_name},", "", f"Here's your Vroomble price estimate for the {r.make} {r.model}:", "",
        f"  Base price:        {peso(r.base_price)}",
        f"  Parts ({len(r.parts)}):        {peso(r.parts_cost)}" + (f"  [{r.modification_type}]" if r.parts else ""),
        f"  Value today:       {peso(r.current_total)}",
        f"  In {r.months} months:      {peso(r.predicted_price)}", "",
        *(f"  - {p}" for p in r.parts), "", "— Vroomble",
    ]
    msg = EmailMessage()
    msg["Subject"] = f"Your {r.make} {r.model} price estimate"
    msg["From"] = settings.smtp_sender or settings.smtp_user
    msg["To"] = user.email
    msg.set_content("\n".join(lines))
    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
    except (smtplib.SMTPException, OSError):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't send the email. Try again later.")
    return {"sent_to": user.email}
