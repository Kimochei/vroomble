"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Logbook } from "@/components/garage/Logbook";
import { SellPanel } from "@/components/garage/SellPanel";
import { RequireAuth } from "@/components/RequireAuth";
import { CarPhoto, ErrorNote, Odometer, Plate, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { carName, formatPeso } from "@/lib/format";
import type { LogEntry, Vehicle } from "@/lib/types";

function Photos({ vehicle, onChange }: { vehicle: Vehicle; onChange: (v: Vehicle) => void }) {
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imgs = vehicle.images;
  const current = imgs[Math.min(active, imgs.length - 1)];

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const fd = new FormData();
    Array.from(list).forEach((f) => fd.append("images", f));
    setBusy(true);
    setError(null);
    try {
      onChange(await api<Vehicle>(`/garage/${vehicle.id}/images`, { body: fd }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this photo?")) return;
    try {
      onChange(await api<Vehicle>(`/garage/${vehicle.id}/images/${id}`, { method: "DELETE" }));
      setActive(0);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-curb">
        <CarPhoto src={current?.url} alt={carName(vehicle.car)} className="aspect-[16/10] w-full" />
        {current && (
          <button onClick={() => remove(current.id)} className="absolute top-2 right-2 rounded-full bg-asphalt/80 p-1.5 text-plate hover:bg-stop" aria-label="Remove this photo">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {imgs.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setActive(i)}
            className={`size-16 shrink-0 overflow-hidden rounded border-2 ${i === active ? "border-asphalt" : "border-transparent opacity-70 hover:opacity-100"}`}
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === active}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="size-full object-cover" />
          </button>
        ))}
        {imgs.length < 10 && (
          <label className="flex size-16 shrink-0 cursor-pointer items-center justify-center rounded border-2 border-dashed border-curb text-gravel hover:border-asphalt hover:text-asphalt focus-within:outline focus-within:outline-3 focus-within:outline-lane" aria-label="Add photos">
            {busy ? <span className="size-4 animate-spin rounded-full border-2 border-curb border-t-asphalt" /> : <ImagePlus size={20} />}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

function Details({ vehicle, onChange }: { vehicle: Vehicle; onChange: (v: Vehicle) => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = vehicle.car;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      onChange(await api<Vehicle>(`/garage/${vehicle.id}`, {
        method: "PATCH",
        body: { trim: f.trim || null, color: f.color, plate_ending: f.plate_ending, mileage_km: Number(f.mileage_km) },
      }));
      setEditing(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (editing)
    return (
      <form onSubmit={save} className="surface grid gap-3 p-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="e-trim">Trim</label><input className="field" id="e-trim" name="trim" defaultValue={vehicle.trim ?? ""} /></div>
        <div><label className="label" htmlFor="e-color">Color</label><input className="field" id="e-color" name="color" defaultValue={vehicle.color} required /></div>
        <div><label className="label" htmlFor="e-km">Odometer (km)</label><input className="field tabular" id="e-km" name="mileage_km" type="number" min={0} defaultValue={vehicle.mileage_km} required /></div>
        <div><label className="label" htmlFor="e-plate">Plate ending</label><input className="field uppercase" id="e-plate" name="plate_ending" maxLength={4} pattern="[0-9A-Za-z]{1,4}" defaultValue={vehicle.plate_ending} required /></div>
        <div className="sm:col-span-2"><ErrorNote error={error} /></div>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-dark">Save changes</button>
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    );

  const rows: [string, string][] = [
    ["Body", c.body_type],
    ["Transmission", c.transmission],
    ["Drivetrain", c.drivetrain],
    ["Fuel", c.fuel_type],
    ["Color", vehicle.color],
    ["Original SRP", formatPeso(c.retail_srp)],
  ];
  return (
    <div className="surface p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-gravel">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <button className="mt-4 text-sm font-semibold underline underline-offset-4" onClick={() => setEditing(true)}>
        Edit details
      </button>
    </div>
  );
}

function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [v, l] = await Promise.all([api<Vehicle>(`/garage/${id}`), api<LogEntry[]>(`/garage/${id}/logs`)]);
      setVehicle(v);
      setLogs(l);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "This car isn't in your garage." : (e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  async function removeVehicle() {
    if (!vehicle || !confirm(`Delete ${carName(vehicle.car)} and its entire logbook? This can't be undone.`)) return;
    try {
      await api(`/garage/${vehicle.id}`, { method: "DELETE" });
      router.push("/garage");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error && !vehicle)
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <ErrorNote error={error} />
        <Link href="/garage" className="mt-4 inline-block underline">Back to garage</Link>
      </div>
    );
  if (!vehicle || !logs) return <div className="mx-auto max-w-6xl px-4 sm:px-6"><Spinner /></div>;

  // Logbook edits change totals/odometer on the vehicle; refetch it quietly.
  const onLogs = (next: LogEntry[]) => {
    setLogs(next);
    api<Vehicle>(`/garage/${vehicle.id}`).then(setVehicle).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <Link href="/garage" className="text-sm text-gravel hover:text-asphalt">Back to garage</Link>
      <div className="mt-2 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold sm:text-5xl">{vehicle.car.year} {vehicle.car.make} {vehicle.car.model}</h1>
          <p className="mt-1 text-lg text-gravel">{vehicle.trim || vehicle.car.variant || vehicle.car.body_type}</p>
        </div>
        <div className="flex items-center gap-4">
          <Odometer km={vehicle.mileage_km} />
          <Plate ending={vehicle.plate_ending} />
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-10">
          <Photos vehicle={vehicle} onChange={setVehicle} />
          <Logbook vehicleId={vehicle.id} logs={logs} onChange={onLogs} />
        </div>
        <aside className="space-y-6">
          <SellPanel vehicle={vehicle} onChange={load} />
          <Details vehicle={vehicle} onChange={setVehicle} />
          <Link href={`/predict?make=${encodeURIComponent(vehicle.car.make)}&model=${encodeURIComponent(vehicle.car.model)}`} className="block text-sm font-semibold underline underline-offset-4">
            Estimate what this model will be worth
          </Link>
          <button className="text-sm text-stop underline underline-offset-4" onClick={removeVehicle}>
            Delete this car from my garage
          </button>
          <ErrorNote error={error} />
        </aside>
      </div>
    </div>
  );
}

export default function VehiclePage() {
  return (
    <RequireAuth>
      <VehicleDetail />
    </RequireAuth>
  );
}
