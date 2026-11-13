import itertools
from datetime import date, timedelta

from tests.conftest import PNG, make_client

_n = itertools.count()


def new_user():
    return make_client(f"user{next(_n)}@example.com")


def register_car(c, images=1):
    car_id = c.get("/api/catalog/cars").json()[0]["id"]
    files = [("images", (f"p{i}.png", PNG, "image/png")) for i in range(images)]
    r = c.post("/api/garage", data={"car_model_id": car_id, "color": "Red", "plate_ending": "12a",
                                     "mileage_km": 1000}, files=files or None)
    assert r.status_code == 201, r.text
    return r.json()


def test_health_and_seed(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert len(client.get("/api/catalog/cars").json()) == 6
    assert "Toyota" in client.get("/api/predict/makes").json()


def test_auth_flow(client):
    c = new_user()
    me = c.get("/api/auth/me").json()
    assert me["role"] == "user" and me["region"] == "NCR"
    assert c.patch("/api/auth/me", json={"region": "Region IV-A"}).json()["region"] == "Region IV-A"
    assert c.post("/api/auth/logout").status_code == 204
    assert c.get("/api/auth/me").json() is None
    assert c.get("/api/garage").status_code == 401


def test_register_validation(client):
    bad = {"first_name": "A", "last_name": "B", "email": "x@example.com", "contact_number": "12345", "password": "password123"}
    assert client.post("/api/auth/register", json=bad).status_code == 422
    c = new_user()
    email = c.get("/api/auth/me").json()["email"]
    dup = {**bad, "email": email.upper(), "contact_number": "09171234567"}
    assert client.post("/api/auth/register", json=dup).status_code == 409


def test_wrong_password(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "nope"})
    assert r.status_code == 401


def test_garage_ownership(client):
    a, b = new_user(), new_user()
    v = register_car(a)
    assert v["plate_ending"] == "12A" and len(v["images"]) == 1
    assert client.get(v["images"][0]["url"]).status_code == 200
    assert b.get(f"/api/garage/{v['id']}").status_code == 404
    assert b.delete(f"/api/garage/{v['id']}").status_code == 404
    assert b.get(f"/api/garage/{v['id']}/logs").status_code == 404
    assert len(a.get("/api/garage").json()) == 1


def test_rejects_non_image_upload(client):
    a = new_user()
    car_id = a.get("/api/catalog/cars").json()[0]["id"]
    r = a.post("/api/garage", data={"car_model_id": car_id, "color": "Red", "plate_ending": "1", "mileage_km": 0},
               files=[("images", ("evil.png", b"<?php echo 1; ?>", "image/png"))])
    assert r.status_code == 415
    assert a.get("/api/garage").json() == []


def test_maintenance_crud(client):
    a = new_user()
    v = register_car(a, images=0)
    base = f"/api/garage/{v['id']}/logs"
    r = a.post(base, data={"change_type": "maintenance", "details": "Oil change", "cost": 3500,
                           "performed_on": str(date.today()), "mileage_km": 5000},
               files=[("images", ("r.png", PNG, "image/png"))])
    assert r.status_code == 201, r.text
    log = r.json()
    assert a.get(f"/api/garage/{v['id']}").json()["mileage_km"] == 5000
    future = a.post(base, data={"change_type": "accident", "details": "x", "performed_on": str(date.today() + timedelta(days=2))})
    assert future.status_code == 422
    assert a.patch(f"{base}/{log['id']}", json={"cost": 4000}).json()["cost"] == 4000
    assert a.get(f"/api/garage/{v['id']}").json()["total_spent"] == 4000
    assert a.delete(f"{base}/{log['id']}").status_code == 204
    assert a.get(base).json() == []


def test_listing_moderation(client, admin):
    seller, buyer = new_user(), new_user()
    no_photo = register_car(seller, images=0)
    assert seller.post("/api/listings", json={"vehicle_id": no_photo["id"], "asking_price": 1}).status_code == 422
    v = register_car(seller)
    l = seller.post("/api/listings", json={"vehicle_id": v["id"], "asking_price": 950000, "description": "Clean"}).json()
    assert l["status"] == "pending"
    assert seller.post("/api/listings", json={"vehicle_id": v["id"], "asking_price": 1}).status_code == 409
    # Not public yet
    assert buyer.get(f"/api/listings/{l['id']}").status_code == 404
    assert buyer.get("/api/admin/listings").status_code == 403
    assert admin.post(f"/api/admin/listings/{l['id']}/review", json={"status": "rejected"}).status_code == 422
    assert admin.post(f"/api/admin/listings/{l['id']}/review", json={"status": "approved"}).json()["status"] == "approved"
    # Public, contact hidden from anonymous visitors, plate never exposed
    anon = client.get(f"/api/listings/{l['id']}").json()
    assert anon["seller"]["contact_number"] is None and anon["vehicle"]["plate_ending"] == ""
    assert anon["logs"] == []  # no log entries on this car yet, but the field is present
    assert buyer.get(f"/api/listings/{l['id']}").json()["seller"]["contact_number"] == "09171234567"
    page = client.get("/api/listings", params={"max_price": 1_000_000, "sort": "price_asc"}).json()
    assert any(i["id"] == l["id"] for i in page["items"])
    # Editing an approved listing sends it back to review
    assert seller.patch(f"/api/listings/{l['id']}", json={"asking_price": 900000}).json()["status"] == "pending"
    assert seller.post(f"/api/listings/{l['id']}/withdraw").json()["status"] == "withdrawn"


def test_admin_catalog_and_analytics(client, admin):
    u = new_user()
    car = {"make": "Honda", "model": "Civic", "variant": "RS", "body_type": "Sedan", "transmission": "CVT",
           "drivetrain": "FWD", "fuel_type": "Gasoline", "year": 2024, "retail_srp": 1_700_000}
    assert u.post("/api/catalog/cars", json=car).status_code == 403
    assert admin.post("/api/catalog/cars", json=car).status_code == 201
    assert admin.post("/api/catalog/cars", json=car).status_code == 409
    assert admin.post("/api/catalog/cars", json={**car, "body_type": "Spaceship"}).status_code == 422
    part = {"brand": "Bosch", "name": "Wiper", "model_number": "W-1", "category": "Exterior", "srp": 900}
    assert admin.post("/api/catalog/parts", json=part).status_code == 201
    assert admin.post("/api/catalog/parts", json=part).status_code == 409
    stats = admin.get("/api/admin/analytics").json()
    assert stats["totals"]["catalog_cars"] == 7 and stats["by_make"]


def test_admin_deactivate_user(client, admin):
    u = new_user()
    uid = u.get("/api/auth/me").json()["id"]
    assert admin.post(f"/api/admin/users/{uid}/active", params={"active": False}).json()["is_active"] is False
    assert u.get("/api/auth/me").json() is None
    assert u.get("/api/garage").status_code == 401


def test_prediction(client):
    mods = client.get("/api/predict/modifications", params={"make": "Honda", "model": "Civic"}).json()
    mtype, parts = next(iter(mods["types"].items()))
    chosen = [p["part"] for p in parts[:2]]
    r = client.post("/api/predict", json={"make": "Honda", "model": "Civic", "modification_type": mtype,
                                          "parts": chosen + ["Not a real part"], "months": 24}).json()
    assert r["parts"] == chosen or sorted(r["parts"]) == sorted(chosen)
    assert r["parts_cost"] == sum(p["cost"] for p in parts[:2])
    assert len(r["projection"]) == 25 and r["projection"][0]["value"] == r["current_total"]
    # Linear model should stay within 2% of the compound-inflation formula it was trained on
    assert abs(r["predicted_price"] - r["formula_price"]) / r["formula_price"] < 0.02
    assert client.post("/api/predict", json={"make": "Nope", "model": "X"}).status_code == 404


def test_email_requires_login_and_config(client):
    assert client.post("/api/predict/email", json={"make": "Honda", "model": "Civic"}).status_code == 401
    assert new_user().post("/api/predict/email", json={"make": "Honda", "model": "Civic"}).status_code == 503
