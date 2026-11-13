"""Price prediction.

Same approach as the original notebook (src/AI/model.ipynb): a StandardScaler + LinearRegression
over [base_price, parts_cost, monthly_inflation_rate, months], trained on compound-inflation
targets generated from the pricing dataset. The model is retrained from the database when the
saved artifact is missing, so it never drifts from the data or breaks on a scikit-learn upgrade.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import BASE_DIR
from .models import PricingModel, PricingModification

log = logging.getLogger(__name__)
MODEL_PATH = BASE_DIR / "ml" / "price_model.joblib"
TRAIN_MONTHS = range(1, 61)


def formula_price(base: float, parts: float, rate: float, months: int) -> float:
    return (base + parts) * (1 + rate) ** (months / 12)


def build_training_set(db: Session) -> tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    for pm in db.scalars(select(PricingModel)).all():
        costs = sorted({m.cost for m in pm.modifications})
        # Vary the parts cost (none / cheapest / typical / everything) so the model learns its effect,
        # instead of the original's single "sum of every part" value per car.
        options = {0.0, float(sum(costs))}
        if costs:
            options |= {float(costs[0]), float(np.median(costs) * 3)}
        for parts in options:
            for months in TRAIN_MONTHS:
                X.append([pm.base_price, parts, pm.monthly_inflation_rate, months])
                y.append(formula_price(pm.base_price, parts, pm.monthly_inflation_rate, months))
    return np.asarray(X, dtype=float), np.asarray(y, dtype=float)


def train(db: Session, path: Path = MODEL_PATH) -> Pipeline:
    X, y = build_training_set(db)
    if len(X) == 0:
        raise RuntimeError("No pricing data to train on — run the seed first.")
    model = make_pipeline(StandardScaler(), LinearRegression()).fit(X, y)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)
    log.info("Trained price model on %d rows (R²=%.4f)", len(X), model.score(X, y))
    return model


@dataclass
class Predictor:
    model: Pipeline | None = None

    def load(self, db: Session) -> None:
        try:
            self.model = joblib.load(MODEL_PATH)
        except Exception:  # missing or incompatible artifact
            self.model = train(db)

    def predict(self, base: float, parts: float, rate: float, months: list[int]) -> list[float]:
        assert self.model is not None, "Predictor not loaded"
        X = np.array([[base, parts, rate, m] for m in months], dtype=float)
        return [float(v) for v in self.model.predict(X)]


predictor = Predictor()


def lookup(db: Session, make: str, model: str) -> PricingModel | None:
    return db.scalar(select(PricingModel).where(PricingModel.make == make, PricingModel.model == model))


def parts_cost(db: Session, pm: PricingModel, modification_type: str | None, parts: list[str]) -> tuple[float, list[str]]:
    if not modification_type or not parts:
        return 0.0, []
    rows = db.scalars(
        select(PricingModification).where(
            PricingModification.pricing_model_id == pm.id,
            PricingModification.modification_type == modification_type,
            PricingModification.part.in_(set(parts)),
        )
    ).all()
    return float(sum(r.cost for r in rows)), [r.part for r in rows]
