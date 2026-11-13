# Vroomble

A garage logbook, used-car marketplace and price estimator for Filipino car owners.

Owners register their cars, log maintenance, upgrades and repairs (with receipt photos), and can list a car for sale
with its service record attached. Admins review every listing before it goes live and manage the car and parts catalog.
The price estimator projects a model's value over 1–60 months, with or without aftermarket parts.

This is a ground-up rebuild of the original Vroomble (Next.js + eight separate FastAPI services). Same features, one
backend, one database, real access control.

```
backend/    FastAPI + SQLAlchemy 2 + scikit-learn   (one app, port 8000)
frontend/   Next.js 16 + TypeScript + Tailwind 4     (port 3000, proxies /api and /media to the backend)
```

## Setup

```bash
git clone https://github.com/Kimochei/vroomble.git
cd vroomble
```

### Option A: Docker (quickest)

Requirements: Docker Desktop (or Docker Engine with Compose v2.24+).

```bash
cp backend/.env.example backend/.env    # optional; set ADMIN_PASSWORD, SECRET_KEY, SMTP_*
docker compose up --build
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs
- The SQLite database and uploaded photos live in the `backend-data` volume and survive restarts.
  `docker compose down -v` deletes them.
- If `ADMIN_PASSWORD` is not set, the generated admin password is printed once in the backend log:
  `docker compose logs backend | grep "generated password"`.
- Demo user (optional): `docker compose exec backend python -m app.seed --demo`.
- `DATABASE_URL` and `MEDIA_DIR` from `backend/.env` are ignored in Docker; compose points them at the volume.

### Option B: Run natively (two terminals)

Requirements: Python 3.11+, Node 20+. Run the backend and the frontend in separate terminals.

**Terminal 1: backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cp .env.example .env                 # Windows: copy .env.example .env — then set ADMIN_PASSWORD (and SECRET_KEY for anything shared)
python -m app.seed --demo            # optional: adds demo@vroomble.app / demo12345 with two cars
uvicorn app.main:app --reload --port 8000
```

On first start the API creates `data/vroomble.db`, loads the catalog and pricing data from `seed/`, trains the price
model into `ml/price_model.joblib`, and creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (if no
password is set, a random one is printed in the log). API docs: http://localhost:8000/docs

**Terminal 2: frontend**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The frontend proxies `/api` and `/media` to `BACKEND_URL`
(default `http://127.0.0.1:8000`; override in `frontend/.env.local`).

**Tests**

```bash
cd backend && pytest        # 12 API tests: auth, ownership, uploads, logbook, moderation, admin, prediction
cd frontend && npm run lint && npx tsc --noEmit
```

## Features

| Area | What you can do |
|---|---|
| Accounts | Sign up with a PH mobile number and region, log in, edit profile. HTTP-only session cookie. |
| Garage | Register cars from the catalog (search), add up to 10 photos, edit details, delete. |
| Logbook | Maintenance / upgrade / accident entries with date, cost, odometer and up to 6 receipt photos. Edit, delete, filter, per-type totals. Logging a higher odometer updates the car. |
| Selling | List a garage car (needs a photo) with price and description. Listings start *In review*; edits to a live listing go back to review; withdraw any time; rejected listings show the admin's note. |
| Marketplace | Search and filter by make, body, fuel, transmission, region, price; sort; paginate. Detail page shows photos, specs and the full service record. Seller contact is shown only to logged-in buyers; plate digits are never public. |
| Price estimator | Make → model → modification type → parts, 1–60 month horizon, projection chart. Optional "email me this estimate" when SMTP is configured. |
| Admin | Overview stats and charts, listing review queue (approve / ask for changes), car catalog and parts CRUD, user list with deactivate/reactivate. |

## What changed from the original

**Architecture**
- Eight FastAPI apps on ports 8000–8007 → one app with routers (`auth`, `catalog`, `garage`, `maintenance`, `listings`, `predict`, `admin`).
- Hard-coded SQLite Cloud connection strings, local `.db` files and raw SQL → SQLAlchemy models on one database. SQLite by default; any SQLAlchemy URL (e.g. Postgres) via `DATABASE_URL`.
- styled-components JS pages with `http://localhost:800x` URLs everywhere → typed Next.js pages, one API client, same-origin proxy.
- Committed `.venv`, `__pycache__`, logs, databases and uploads removed; `.gitignore` covers them.

**Bugs fixed**
- Maintenance logs were queried by a `users_ID` column the table didn't have, so the logbook never loaded.
- Images were saved to `uploads/` but served from `car_images/`, and stored under the uploader's original filename (collisions, overwrites).
- `insert_image_path` was defined twice; the first version inserted into a non-existent column.
- Prediction model was trained on "sum of every part" only, so it never learned the effect of choosing parts; it's now trained across parts-cost levels and anchored to today's value.
- Login read `users_ID` and `region` columns that registration never created.

**Security**
- No ownership checks before: anyone could list/unlist, edit or delete any vehicle or maintenance record, and the admin endpoints were open. Every garage/log/listing route now checks the owner; admin routes require the admin role.
- JWT secret defaulted to `"your_secret_key"`; it's now required in production and random in development. Tokens carry only the user id, not name/phone.
- `/send-email/` let anyone send arbitrary mail through your SMTP account. Now it requires login and only sends to the user's own address.
- Uploads are checked by file signature (JPEG/PNG/WebP), size-limited, and stored under random names.
- CORS was `*` with credentials on several services; now a configured allow-list (and the browser never needs it thanks to the proxy).
- Login takes the same time for unknown emails and wrong passwords; emails are case-insensitive.

## Configuration

See `backend/.env.example` and `frontend/.env.example`. For production: set `APP_ENV=production`, a long
`SECRET_KEY`, `COOKIE_SECURE=true`, a real `DATABASE_URL`, and put both apps behind HTTPS.

## Data

`backend/seed/catalog.json` and `pricing.json` were exported from the original `Vroomble Dataset/*.db` files
(6 catalog cars, 12 parts, 45 priced models with 770 modification parts). The estimator's "inflation rate" is applied
per year, as in the original notebook (`src/AI/model.ipynb`).
