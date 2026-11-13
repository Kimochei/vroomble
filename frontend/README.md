# Vroomble web

Next.js 16 (App Router, TypeScript, Tailwind CSS 4). Every browser request goes to this server; `/api/*` and
`/media/*` are rewritten to the FastAPI backend (see `next.config.ts`), so the session cookie stays first-party.

```bash
npm install
npm run dev        # http://localhost:3000 (expects the API on :8000; override with BACKEND_URL)
npm run build && npm start
```

| Path | What it is |
|---|---|
| `src/app/` | Pages: landing, auth, garage, listings, price estimator, admin |
| `src/components/` | UI pieces (plate chip, odometer, logbook, sell panel, photo picker) |
| `src/lib/api.ts` | Typed `fetch` wrapper that turns FastAPI errors into readable messages |
| `src/lib/auth.tsx` | Session context (`useAuth`) |
| `src/lib/types.ts` | Types mirroring the API schemas |
