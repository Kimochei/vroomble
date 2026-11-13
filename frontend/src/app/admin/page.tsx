"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { CarPhoto, Empty, ErrorNote, PageHeader, Spinner, StatusBadge } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { carName, formatDate, formatKm, formatPeso } from "@/lib/format";
import { useOptions } from "@/lib/useOptions";
import type { Analytics, CarModel, CarPart, CountItem, Listing, ListingStatus, User } from "@/lib/types";

const TABS = [
  ["overview", "Overview"],
  ["review", "Listing review"],
  ["catalog", "Car catalog"],
  ["parts", "Parts"],
  ["users", "Users"],
] as const;
type Tab = (typeof TABS)[number][0];

/* ---------- Overview ---------- */

function CountChart({ title, data, horizontal = false }: { title: string; data: CountItem[]; horizontal?: boolean }) {
  return (
    <figure className="surface p-5">
      <figcaption className="text-xl font-semibold">{title}</figcaption>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-gravel">No registered cars yet.</p>
      ) : (
        <div className="mt-3" style={{ height: horizontal ? Math.max(160, data.length * 34) : 220 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap={4}>
              <CartesianGrid stroke="#d6d9d3" horizontal={!horizontal} vertical={horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#6d726e", fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" width={96} tickLine={false} axisLine={{ stroke: "#d6d9d3" }} tick={{ fill: "#1e2124", fontSize: 13 }} />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d6d9d3" }} tick={{ fill: "#1e2124", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: "#6d726e", fontSize: 12 }} />
                </>
              )}
              <Tooltip cursor={{ fill: "#eceeea" }} formatter={(v) => [v, "Cars"]} contentStyle={{ borderRadius: 6, border: "1px solid #d6d9d3" }} />
              <Bar dataKey="count" fill="#1e2124" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-gravel">Show as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-curb"><td className="py-1">{d.label}</td><td className="tabular py-1 text-right">{d.count}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Overview({ goReview }: { goReview: () => void }) {
  const [a, setA] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Analytics>("/admin/analytics").then(setA).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorNote error={error} />;
  if (!a) return <Spinner />;
  const stats: [string, number][] = [
    ["Members", a.totals.users],
    ["Registered cars", a.totals.vehicles],
    ["Log entries", a.totals.logs],
    ["Catalog models", a.totals.catalog_cars],
    ["Parts", a.totals.parts],
  ];
  return (
    <div className="space-y-6">
      {a.totals.pending_listings > 0 && (
        <button onClick={goReview} className="flex w-full items-center justify-between rounded-lg bg-lane px-5 py-4 text-left font-semibold hover:bg-lane-dark">
          <span>{a.totals.pending_listings} {a.totals.pending_listings === 1 ? "listing is" : "listings are"} waiting for review</span>
          <span className="underline underline-offset-4">Review now</span>
        </button>
      )}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-curb bg-curb sm:grid-cols-5">
        {stats.map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-3">
            <dt className="text-sm text-gravel">{k}</dt>
            <dd className="tabular font-display text-3xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 md:grid-cols-2">
        <CountChart title="Registered cars by make" data={a.by_make} horizontal />
        <CountChart title="By body type" data={a.by_body_type} horizontal />
        <CountChart title="By model year" data={a.by_year} />
        <CountChart title="By fuel" data={a.by_fuel_type} />
      </div>
    </div>
  );
}

/* ---------- Listing review ---------- */

function Review() {
  const [status, setStatus] = useState<ListingStatus>("pending");
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    setItems(null);
    api<Listing[]>(`/admin/listings${qs({ status })}`).then(setItems).catch((e) => setError(e.message));
  }, [status]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
  useEffect(load, [load]);

  async function decide(l: Listing, decision: "approved" | "rejected") {
    setError(null);
    try {
      await api(`/admin/listings/${l.id}/review`, { body: { status: decision, note: notes[l.id] || null } });
      setItems((cur) => cur?.filter((x) => x.id !== l.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Listing status">
        {(["pending", "approved", "rejected", "withdrawn"] as ListingStatus[]).map((s) => (
          <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize ${status === s ? "border-asphalt bg-asphalt text-plate" : "border-curb bg-white hover:border-asphalt"}`}>
            {s}
          </button>
        ))}
      </div>
      <ErrorNote error={error} />
      {!items && <Spinner />}
      {items?.length === 0 && <Empty title={status === "pending" ? "Queue is clear" : `No ${status} listings`}>{status === "pending" ? "New listings show up here for approval." : null}</Empty>}
      <div className="space-y-4">
        {items?.map((l) => (
          <article key={l.id} className="surface grid gap-4 p-4 md:grid-cols-[12rem_1fr_16rem]">
            <CarPhoto src={l.vehicle.images[0]?.url} alt={carName(l.vehicle.car)} className="aspect-[4/3] w-full rounded" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-semibold">{carName(l.vehicle.car)}</h3>
                <StatusBadge status={l.status} />
              </div>
              <p className="tabular mt-1 font-semibold">{formatPeso(l.asking_price)} <span className="font-normal text-gravel">(SRP {formatPeso(l.vehicle.car.retail_srp)})</span></p>
              <p className="text-sm text-gravel">
                {formatKm(l.vehicle.mileage_km)}, {l.vehicle.images.length} photos, {l.vehicle.log_count} log entries. {l.seller.first_name} ({l.seller.email}), submitted {formatDate(l.created_at)}
              </p>
              {l.description && <p className="mt-2 line-clamp-4 text-sm whitespace-pre-line">{l.description}</p>}
              {l.review_note && <p className="mt-2 text-sm text-stop">Note: {l.review_note}</p>}
              <Link href={`/listings/${l.id}`} className="mt-2 inline-block text-sm font-semibold underline underline-offset-4" target="_blank">Open full listing</Link>
            </div>
            {l.status === "pending" && (
              <div className="space-y-2">
                <label className="label" htmlFor={`note-${l.id}`}>Note to seller</label>
                <textarea id={`note-${l.id}`} className="field min-h-20 text-sm" maxLength={300} placeholder="Required when asking for changes"
                  value={notes[l.id] ?? ""} onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })} />
                <div className="flex gap-2">
                  <button className="btn flex-1 bg-go text-white hover:bg-go/90" onClick={() => decide(l, "approved")}>Approve</button>
                  <button className="btn-danger flex-1" onClick={() => decide(l, "rejected")}>Ask for changes</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---------- Catalog ---------- */

function Catalog() {
  const options = useOptions();
  const [cars, setCars] = useState<CarModel[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<CarModel[]>(`/catalog/cars${qs({ q })}`).then(setCars).catch((e) => setError(e.message));
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    setFormError(null);
    try {
      await api("/catalog/cars", { body: { ...f, variant: f.variant || null, year: Number(f.year), retail_srp: Number(f.retail_srp) } });
      form.reset();
      load();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function remove(c: CarModel) {
    if (!confirm(`Remove ${carName(c)} from the catalog?`)) return;
    try {
      await api(`/catalog/cars/${c.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const sel = (name: string, label: string, values?: string[]) => (
    <div>
      <label className="label" htmlFor={`c-${name}`}>{label}</label>
      <select id={`c-${name}`} name={name} className="field" required defaultValue="">
        <option value="" disabled>Choose</option>
        {values?.map((v) => <option key={v}>{v}</option>)}
      </select>
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        <input className="field mb-3" placeholder="Search the catalog" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the catalog" />
        <ErrorNote error={error} />
        {!cars ? <Spinner /> : (
          <div className="overflow-x-auto rounded-lg border border-curb bg-white">
            <table className="w-full text-sm">
              <thead className="bg-concrete text-left text-gravel">
                <tr><th className="px-3 py-2 font-medium">Car</th><th className="px-3 py-2 font-medium">Body</th><th className="px-3 py-2 font-medium">Drive</th><th className="px-3 py-2 text-right font-medium">SRP</th><th className="sr-only">Actions</th></tr>
              </thead>
              <tbody>
                {cars.map((c) => (
                  <tr key={c.id} className="border-t border-curb">
                    <td className="px-3 py-2 font-medium">{carName(c)}</td>
                    <td className="px-3 py-2">{c.body_type}</td>
                    <td className="px-3 py-2">{c.transmission}, {c.drivetrain}, {c.fuel_type}</td>
                    <td className="tabular px-3 py-2 text-right">{formatPeso(c.retail_srp)}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => remove(c)} className="rounded p-1.5 text-gravel hover:text-stop" aria-label={`Remove ${carName(c)}`}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <form onSubmit={add} className="surface h-fit space-y-3 p-5">
        <h2 className="text-2xl font-bold">Add a model</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="c-make">Make</label><input id="c-make" name="make" className="field" required /></div>
          <div><label className="label" htmlFor="c-model">Model</label><input id="c-model" name="model" className="field" required /></div>
          <div><label className="label" htmlFor="c-variant">Variant</label><input id="c-variant" name="variant" className="field" placeholder="Optional" /></div>
          <div><label className="label" htmlFor="c-year">Year</label><input id="c-year" name="year" type="number" min={1950} max={new Date().getFullYear() + 1} className="field tabular" required /></div>
          {sel("body_type", "Body", options?.body_types)}
          {sel("transmission", "Transmission", options?.transmissions)}
          {sel("drivetrain", "Drivetrain", options?.drivetrains)}
          {sel("fuel_type", "Fuel", options?.fuel_types)}
        </div>
        <div><label className="label" htmlFor="c-srp">Retail SRP (₱)</label><input id="c-srp" name="retail_srp" type="number" min={1} step="any" className="field tabular" required /></div>
        <ErrorNote error={formError} />
        <button className="btn-dark w-full">Add to catalog</button>
      </form>
    </div>
  );
}

function Parts() {
  const options = useOptions();
  const [parts, setParts] = useState<CarPart[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const load = useCallback(() => { api<CarPart[]>("/catalog/parts").then(setParts).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    setFormError(null);
    try {
      await api("/catalog/parts", { body: { ...f, model_number: f.model_number || null, srp: Number(f.srp) } });
      form.reset();
      load();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function remove(p: CarPart) {
    if (!confirm(`Remove ${p.brand} ${p.name}?`)) return;
    await api(`/catalog/parts/${p.id}`, { method: "DELETE" }).then(load).catch((e) => setError(e.message));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        <ErrorNote error={error} />
        {!parts ? <Spinner /> : (
          <div className="overflow-x-auto rounded-lg border border-curb bg-white">
            <table className="w-full text-sm">
              <thead className="bg-concrete text-left text-gravel">
                <tr><th className="px-3 py-2 font-medium">Part</th><th className="px-3 py-2 font-medium">Model no.</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 text-right font-medium">SRP</th><th className="sr-only">Actions</th></tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className="border-t border-curb">
                    <td className="px-3 py-2"><span className="font-medium">{p.name}</span> <span className="text-gravel">{p.brand}</span></td>
                    <td className="px-3 py-2">{p.model_number ?? "None"}</td>
                    <td className="px-3 py-2">{p.category}</td>
                    <td className="tabular px-3 py-2 text-right">{formatPeso(p.srp)}</td>
                    <td className="px-2 py-2 text-right"><button onClick={() => remove(p)} className="rounded p-1.5 text-gravel hover:text-stop" aria-label={`Remove ${p.name}`}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <form onSubmit={add} className="surface h-fit space-y-3 p-5">
        <h2 className="text-2xl font-bold">Add a part</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="p-brand">Brand</label><input id="p-brand" name="brand" className="field" required /></div>
          <div><label className="label" htmlFor="p-name">Part name</label><input id="p-name" name="name" className="field" required /></div>
          <div><label className="label" htmlFor="p-mn">Model number</label><input id="p-mn" name="model_number" className="field" placeholder="Optional" /></div>
          <div>
            <label className="label" htmlFor="p-cat">Category</label>
            <select id="p-cat" name="category" className="field" required defaultValue="">
              <option value="" disabled>Choose</option>
              {options?.part_categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label" htmlFor="p-srp">SRP (₱)</label><input id="p-srp" name="srp" type="number" min={1} step="0.01" className="field tabular" required /></div>
        <ErrorNote error={formError} />
        <button className="btn-dark w-full">Add part</button>
      </form>
    </div>
  );
}

/* ---------- Users ---------- */

function Users() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => api<User[]>(`/admin/users${qs({ q })}`).then(setUsers).catch((e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [q]);

  async function toggle(u: User) {
    if (u.is_active && !confirm(`Deactivate ${u.email}? They'll be logged out and their listings hidden.`)) return;
    try {
      const updated = await api<User>(`/admin/users/${u.id}/active${qs({ active: String(!u.is_active) })}`, { method: "POST" });
      setUsers((cur) => cur?.map((x) => (x.id === u.id ? updated : x)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <input className="field mb-3 max-w-md" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      <ErrorNote error={error} />
      {!users ? <Spinner /> : (
        <div className="overflow-x-auto rounded-lg border border-curb bg-white">
          <table className="w-full text-sm">
            <thead className="bg-concrete text-left text-gravel">
              <tr><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Mobile</th><th className="px-3 py-2 font-medium">Region</th><th className="px-3 py-2 font-medium">Joined</th><th className="px-3 py-2 font-medium">Access</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-t border-curb ${u.is_active ? "" : "text-gravel"}`}>
                  <td className="px-3 py-2 font-medium">{u.first_name} {u.last_name}{u.role === "admin" && <span className="ml-2 rounded bg-lane px-1.5 text-xs">admin</span>}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.contact_number}</td>
                  <td className="px-3 py-2">{u.region ?? "Not set"}</td>
                  <td className="px-3 py-2">{formatDate(u.created_at)}</td>
                  <td className="px-3 py-2">
                    {u.role !== "admin" && (
                      <button className={u.is_active ? "text-stop underline" : "text-go underline"} onClick={() => toggle(u)}>
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find(([t]) => t === sp.get("tab"))?.[0] ?? "overview") as Tab;
  const go = (t: Tab) => router.replace(`/admin${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <PageHeader title="Admin" />
      <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-curb" aria-label="Admin sections">
        {TABS.map(([t, label]) => (
          <button key={t} onClick={() => go(t)} aria-current={tab === t ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-[3px] px-4 py-2.5 font-semibold ${tab === t ? "border-lane text-asphalt" : "border-transparent text-gravel hover:text-asphalt"}`}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "overview" && <Overview goReview={() => go("review")} />}
      {tab === "review" && <Review />}
      {tab === "catalog" && <Catalog />}
      {tab === "parts" && <Parts />}
      {tab === "users" && <Users />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth admin>
      <AdminDashboard />
    </RequireAuth>
  );
}
