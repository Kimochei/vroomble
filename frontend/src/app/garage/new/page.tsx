"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Search } from "lucide-react";
import { PhotoPicker } from "@/components/PhotoPicker";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorNote, PageHeader } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { carName, formatPeso } from "@/lib/format";
import type { CarModel, Vehicle } from "@/lib/types";

function CarPicker({ value, onChange }: { value: CarModel | null; onChange: (c: CarModel | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CarModel[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<CarModel[]>(`/catalog/cars${qs({ q: q.trim() })}`).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  if (value)
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border-2 border-asphalt bg-white p-4">
        <div>
          <p className="text-xl font-semibold">{carName(value)}</p>
          <p className="text-sm text-gravel">
            {value.body_type}, {value.transmission}, {value.drivetrain}, {value.fuel_type}. SRP {formatPeso(value.retail_srp)}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search the catalog</span>
        <Search className="pointer-events-none absolute top-3 left-3 text-gravel" size={18} />
        <input
          className="field pl-10"
          placeholder="Search by make, model or year, e.g. Fortuner 2014"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </label>
      <ul className="mt-2 max-h-72 divide-y divide-curb overflow-auto rounded-md border border-curb bg-white" role="listbox" aria-label="Catalog matches">
        {results?.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onChange(c)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-concrete focus-visible:bg-concrete"
            >
              <span>
                <span className="font-medium">{carName(c)}</span>
                <span className="block text-sm text-gravel">
                  {c.body_type}, {c.transmission}, {c.fuel_type}
                </span>
              </span>
              <span className="tabular text-sm text-gravel">{formatPeso(c.retail_srp)}</span>
            </button>
          </li>
        ))}
        {results?.length === 0 && (
          <li className="px-4 py-4 text-sm text-gravel">
            No match. The catalog is maintained by our team; contact an admin to add your car.
          </li>
        )}
      </ul>
    </div>
  );
}

function RegisterVehicle() {
  const router = useRouter();
  const [car, setCar] = useState<CarModel | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!car) return setError("Pick your car from the catalog first.");
    const fd = new FormData(e.currentTarget);
    fd.set("car_model_id", String(car.id));
    photos.forEach((p) => fd.append("images", p));
    setBusy(true);
    setError(null);
    try {
      const v = await api<Vehicle>("/garage", { body: fd });
      router.push(`/garage/${v.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Link href="/garage" className="text-sm text-gravel hover:text-asphalt">
        Back to garage
      </Link>
      <PageHeader title="Register a car">Choose the model, then tell us about your particular car.</PageHeader>

      <form onSubmit={onSubmit} className="space-y-8">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-2xl font-semibold">
            {car && <Check className="text-go" size={22} />}Which car is it?
          </h2>
          <CarPicker value={car} onChange={setCar} />
        </section>

        <section className={car ? "" : "pointer-events-none opacity-40"} inert={!car}>
          <h2 className="mb-3 text-2xl font-semibold">About yours</h2>
          <div className="surface space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="trim">Trim or edition</label>
                <input className="field" id="trim" name="trim" placeholder={car?.variant ?? "Optional"} maxLength={80} />
              </div>
              <div>
                <label className="label" htmlFor="color">Color</label>
                <input className="field" id="color" name="color" placeholder="Pearl White" required maxLength={40} />
              </div>
              <div>
                <label className="label" htmlFor="mileage_km">Odometer (km)</label>
                <input className="field tabular" id="mileage_km" name="mileage_km" type="number" min={0} max={2000000} inputMode="numeric" required />
              </div>
              <div>
                <label className="label" htmlFor="plate_ending">Last digits of your plate</label>
                <input
                  className="field uppercase tracking-widest"
                  id="plate_ending"
                  name="plate_ending"
                  pattern="[0-9A-Za-z]{1,4}"
                  maxLength={4}
                  placeholder="1234"
                  required
                  aria-describedby="plate-help"
                />
                <p id="plate-help" className="mt-1 text-xs text-gravel">Up to 4 characters. Only you see these.</p>
              </div>
            </div>
            <PhotoPicker files={photos} onChange={setPhotos} />
            <p className="text-sm text-gravel">You need at least one photo to list the car for sale later.</p>
          </div>
        </section>

        <ErrorNote error={error} />
        <div className="flex gap-3">
          <button className="btn-dark px-6" disabled={busy || !car}>
            {busy ? "Saving…" : "Add to garage"}
          </button>
          <Link href="/garage" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

export default function NewVehiclePage() {
  return (
    <RequireAuth>
      <RegisterVehicle />
    </RequireAuth>
  );
}
