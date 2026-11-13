"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorNote, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPeso } from "@/lib/format";
import type { Listing, Vehicle } from "@/lib/types";

export function SellPanel({ vehicle, onChange }: { vehicle: Vehicle; onChange: () => void }) {
  const listing = vehicle.listing;
  const active = listing && (listing.status === "pending" || listing.status === "approved");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noPhotos = vehicle.images.length === 0;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const body = { asking_price: Number(f.asking_price), description: String(f.description ?? "") };
    setBusy(true);
    setError(null);
    try {
      if (active) await api<Listing>(`/listings/${listing!.id}`, { method: "PATCH", body });
      else await api<Listing>("/listings", { body: { ...body, vehicle_id: vehicle.id } });
      setEditing(false);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!listing || !confirm("Take this car off the market? You can list it again later.")) return;
    setBusy(true);
    try {
      await api(`/listings/${listing.id}/withdraw`, { method: "POST" });
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const showForm = editing || !active;

  return (
    <section className="surface p-5" aria-labelledby="sell-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sell-title" className="text-2xl font-bold">Sell this car</h2>
        {listing && <StatusBadge status={listing.status} />}
      </div>

      {listing?.status === "rejected" && listing.review_note && (
        <p className="mt-3 rounded-md bg-stop/5 p-3 text-sm text-stop">Reviewer&apos;s note: {listing.review_note}</p>
      )}

      {active && !editing && (
        <div className="mt-3 space-y-3">
          <p className="tabular font-display text-3xl font-bold">{formatPeso(listing!.asking_price)}</p>
          <p className="text-sm text-gravel">
            {listing!.status === "pending"
              ? "Our team is checking your listing. It goes live once approved, usually within a day."
              : "Your listing is live. Changing the price or description sends it back for a quick review."}
          </p>
          <div className="flex flex-wrap gap-2">
            {listing!.status === "approved" && (
              <Link href={`/listings/${listing!.id}`} className="btn-ghost">View listing</Link>
            )}
            <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn-danger" onClick={withdraw} disabled={busy}>Withdraw</button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          {noPhotos && <p className="text-sm text-caution">Add at least one photo of the car before listing it.</p>}
          <div>
            <label className="label" htmlFor="asking_price">Asking price (₱)</label>
            <input
              className="field tabular"
              id="asking_price"
              name="asking_price"
              type="number"
              min={1}
              step="any"
              required
              defaultValue={listing?.asking_price ? Math.round(listing.asking_price) : ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea className="field min-h-28" id="description" name="description" maxLength={4000} defaultValue={listing?.description ?? ""} placeholder="Condition, reason for selling, what's included, whether the price is negotiable." />
          </div>
          <p className="text-sm text-gravel">
            Buyers see your logbook, photos, first name and region. Your number is shown only to logged-in buyers.
          </p>
          <ErrorNote error={error} />
          <div className="flex gap-2">
            <button className="btn-dark" disabled={busy || noPhotos}>
              {busy ? "Submitting…" : active ? "Save and resubmit" : "Submit for review"}
            </button>
            {editing && <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      )}
      {!showForm && <ErrorNote error={error} />}
    </section>
  );
}
