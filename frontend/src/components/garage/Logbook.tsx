"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Empty, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, formatKm, formatPeso, todayISO } from "@/lib/format";
import type { ChangeType, LogEntry } from "@/lib/types";

export const CHANGE_LABEL: Record<ChangeType, string> = {
  maintenance: "Maintenance",
  modification: "Upgrade",
  accident: "Accident or repair",
};
const CHANGE_DOT: Record<ChangeType, string> = {
  maintenance: "bg-go",
  modification: "bg-lane",
  accident: "bg-stop",
};

function EntryForm({
  vehicleId,
  entry,
  onDone,
  onCancel,
}: {
  vehicleId: number;
  entry?: LogEntry;
  onDone: (e: LogEntry) => void;
  onCancel: () => void;
}) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      let saved: LogEntry;
      if (entry) {
        const f = Object.fromEntries(fd);
        saved = await api<LogEntry>(`/garage/${vehicleId}/logs/${entry.id}`, {
          method: "PATCH",
          body: { ...f, cost: Number(f.cost || 0), mileage_km: f.mileage_km ? Number(f.mileage_km) : null },
        });
      } else {
        if (!fd.get("mileage_km")) fd.delete("mileage_km");
        photos.forEach((p) => fd.append("images", p));
        saved = await api<LogEntry>(`/garage/${vehicleId}/logs`, { body: fd });
      }
      onDone(saved);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border-2 border-asphalt bg-white p-5">
      <fieldset>
        <legend className="label">What kind of entry?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CHANGE_LABEL) as ChangeType[]).map((t) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" name="change_type" value={t} defaultChecked={(entry?.change_type ?? "maintenance") === t} className="peer sr-only" />
              <span className="inline-flex items-center gap-2 rounded-full border border-curb px-3 py-1.5 text-sm peer-checked:border-asphalt peer-checked:bg-asphalt peer-checked:text-plate peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-lane">
                <span className={`size-2 rounded-full ${CHANGE_DOT[t]}`} />
                {CHANGE_LABEL[t]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="details">What was done</label>
        <textarea className="field min-h-24" id="details" name="details" defaultValue={entry?.details} required maxLength={2000} placeholder="Changed engine oil and filter, rotated tires" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="performed_on">Date</label>
          <input className="field" id="performed_on" name="performed_on" type="date" max={todayISO()} defaultValue={entry?.performed_on ?? todayISO()} required />
        </div>
        <div>
          <label className="label" htmlFor="cost">Cost (₱)</label>
          <input className="field tabular" id="cost" name="cost" type="number" min={0} step="0.01" defaultValue={entry?.cost ?? ""} placeholder="0" />
        </div>
        <div>
          <label className="label" htmlFor="mileage_km">Odometer (km)</label>
          <input className="field tabular" id="mileage_km" name="mileage_km" type="number" min={0} defaultValue={entry?.mileage_km ?? ""} placeholder="Optional" />
        </div>
      </div>
      {!entry && <PhotoPicker files={photos} onChange={setPhotos} max={6} label="Receipts or photos" />}
      <ErrorNote error={error} />
      <div className="flex gap-3">
        <button className="btn-dark" disabled={busy}>{busy ? "Saving…" : entry ? "Save entry" : "Add entry"}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function Logbook({
  vehicleId,
  logs,
  onChange,
}: {
  vehicleId: number;
  logs: LogEntry[];
  onChange: (logs: LogEntry[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [filter, setFilter] = useState<ChangeType | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const sorted = [...logs].sort((a, b) => b.performed_on.localeCompare(a.performed_on) || b.id - a.id);
  const shown = filter === "all" ? sorted : sorted.filter((l) => l.change_type === filter);
  const totals = (Object.keys(CHANGE_LABEL) as ChangeType[]).map((t) => ({
    t,
    sum: logs.filter((l) => l.change_type === t).reduce((s, l) => s + l.cost, 0),
  }));

  async function remove(entry: LogEntry) {
    if (!confirm(`Delete this ${CHANGE_LABEL[entry.change_type].toLowerCase()} entry from ${formatDate(entry.performed_on)}?`)) return;
    try {
      await api(`/garage/${vehicleId}/logs/${entry.id}`, { method: "DELETE" });
      onChange(logs.filter((l) => l.id !== entry.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section aria-labelledby="logbook-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="logbook-title" className="text-3xl font-bold">Logbook</h2>
        {!adding && (
          <button className="btn-primary" onClick={() => { setAdding(true); setEditing(null); }}>
            Add entry
          </button>
        )}
      </div>

      {logs.length > 0 && (
        <dl className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-curb bg-curb">
          {totals.map(({ t, sum }) => (
            <div key={t} className="bg-white px-4 py-3">
              <dt className="flex items-center gap-2 text-sm text-gravel">
                <span className={`size-2 rounded-full ${CHANGE_DOT[t]}`} />
                {CHANGE_LABEL[t]}
              </dt>
              <dd className="tabular font-display text-xl font-semibold">{formatPeso(sum)}</dd>
            </div>
          ))}
        </dl>
      )}

      {adding && (
        <div className="mb-5">
          <EntryForm
            vehicleId={vehicleId}
            onCancel={() => setAdding(false)}
            onDone={(e) => {
              onChange([e, ...logs]);
              setAdding(false);
            }}
          />
        </div>
      )}

      {logs.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter entries">
          {(["all", ...Object.keys(CHANGE_LABEL)] as (ChangeType | "all")[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-full px-3 py-1 text-sm ${filter === f ? "bg-asphalt text-plate" : "text-gravel hover:text-asphalt"}`}
            >
              {f === "all" ? "Everything" : CHANGE_LABEL[f]}
            </button>
          ))}
        </div>
      )}

      <ErrorNote error={error} />

      {logs.length === 0 && !adding ? (
        <Empty title="Nothing logged yet">
          Start with the last thing you did, even an oil change. A longer record helps when you sell.
        </Empty>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-curb pl-6">
          {shown.map((l) =>
            editing === l.id ? (
              <li key={l.id}>
                <EntryForm
                  vehicleId={vehicleId}
                  entry={l}
                  onCancel={() => setEditing(null)}
                  onDone={(e) => {
                    onChange(logs.map((x) => (x.id === e.id ? e : x)));
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={l.id} className="relative">
                <span className={`absolute top-5 -left-[31px] size-3 rounded-full ring-4 ring-concrete ${CHANGE_DOT[l.change_type]}`} aria-hidden />
                <article className="surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-gravel">
                        {formatDate(l.performed_on)}, {CHANGE_LABEL[l.change_type]}
                        {l.mileage_km != null && `, at ${formatKm(l.mileage_km)}`}
                      </p>
                      <p className="mt-1 whitespace-pre-line">{l.details}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="tabular mr-2 font-semibold">{formatPeso(l.cost)}</span>
                      <button className="rounded p-1.5 text-gravel hover:bg-concrete hover:text-asphalt" onClick={() => { setEditing(l.id); setAdding(false); }} aria-label="Edit entry">
                        <Pencil size={16} />
                      </button>
                      <button className="rounded p-1.5 text-gravel hover:bg-stop/10 hover:text-stop" onClick={() => remove(l)} aria-label="Delete entry">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {l.images.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {l.images.map((img) => (
                        <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="block size-16 overflow-hidden rounded border border-curb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="Receipt or photo" className="size-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
