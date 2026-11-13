"""Image uploads: validated by magic bytes, stored under random names, served from /media."""
from __future__ import annotations

import secrets

from fastapi import HTTPException, UploadFile, status

from .config import settings

_SIGNATURES = {
    b"\xff\xd8\xff": ".jpg",
    b"\x89PNG\r\n\x1a\n": ".png",
    b"RIFF": ".webp",  # confirmed below by the WEBP marker
}


def _sniff(head: bytes) -> str | None:
    for sig, ext in _SIGNATURES.items():
        if head.startswith(sig):
            if ext == ".webp" and head[8:12] != b"WEBP":
                return None
            return ext
    return None


async def save_image(upload: UploadFile, prefix: str) -> str:
    data = await upload.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Images must be under {settings.max_upload_mb} MB.")
    ext = _sniff(data[:16])
    if ext is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG or WebP images are allowed.")
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    name = f"{prefix}_{secrets.token_hex(12)}{ext}"
    (settings.media_dir / name).write_bytes(data)
    return name


def delete_image(filename: str) -> None:
    path = (settings.media_dir / filename).resolve()
    if path.parent == settings.media_dir.resolve() and path.exists():
        path.unlink()


def media_url(filename: str) -> str:
    return f"/media/{filename}"
