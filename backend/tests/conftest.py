import os
import tempfile
from pathlib import Path

import pytest

_tmp = Path(tempfile.mkdtemp(prefix="vroomble-test-"))
os.environ.update(
    DATABASE_URL=f"sqlite:///{_tmp / 'test.db'}",
    MEDIA_DIR=str(_tmp / "media"),
    SECRET_KEY="test-secret-key-that-is-long-enough-for-hs256",
    ADMIN_EMAIL="admin@example.com",
    ADMIN_PASSWORD="adminpass123",
)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PNG = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
       b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82")


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def make_client(email: str, password: str = "password123", register: bool = True) -> TestClient:
    c = TestClient(app)
    if register:
        r = c.post("/api/auth/register", json={"first_name": "Test", "last_name": "User", "email": email,
                                               "contact_number": "09171234567", "password": password, "region": "NCR"})
        assert r.status_code == 201, r.text
    else:
        assert c.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200
    return c


@pytest.fixture
def admin(client):
    return make_client("admin@example.com", "adminpass123", register=False)
