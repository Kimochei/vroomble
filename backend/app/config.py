"""Application settings, read once from environment variables (and an optional .env file)."""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'vroomble.db'}")
    media_dir: Path = Path(os.getenv("MEDIA_DIR", str(BASE_DIR / "data" / "media")))
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "8"))

    # Auth
    secret_key: str = os.getenv("SECRET_KEY", "")
    access_token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", str(60 * 24 * 7)))
    cookie_secure: bool = _bool("COOKIE_SECURE", False)
    cookie_name: str = "vroomble_session"

    cors_origins: list[str] = field(default_factory=lambda: _list("CORS_ORIGINS", "http://localhost:3000"))

    # Bootstrap admin (created on startup if no admin exists)
    admin_email: str = os.getenv("ADMIN_EMAIL", "admin@vroomble.app")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "")

    # Optional SMTP for emailing price predictions
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "465"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_sender: str = os.getenv("SMTP_SENDER", "")

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)


settings = Settings()

if not settings.secret_key:
    if settings.env == "production":
        raise RuntimeError("SECRET_KEY must be set in production")
    # Dev fallback: random per process (sessions reset on restart, which is fine locally).
    object.__setattr__(settings, "secret_key", secrets.token_urlsafe(48))
