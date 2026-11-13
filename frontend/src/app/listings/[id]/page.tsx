"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { CHANGE_LABEL } from "@/components/garage/Logbook";
import { CarPhoto, ErrorNote, Odometer, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { carName, formatDate, formatKm, formatPeso } from "@/lib/format";
import type { Listing } from "@/lib/types";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (loading) return; // wait so the response reflects whether we're logged in
    api<Listing>(`/listings/${id}`).then(setListing).catch((e) => setError(e.message));
  }, [id, loading, user]);

  if (error)
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <ErrorNote error={error} />
        <Link href="/listings" className="mt-4 inline-block underline">Back to all cars</Link>
      </div>
    );
  if (!listing) return <div className="mx-auto max-w-6xl px-4 sm:px-6"><Spinner /></div>;

  const v = listing.vehicle;
  const c = v.car;
  const specs: [string, string][] = [
    ["Year", String(c.year)],
    ["Body", c.body_type],
    ["Transmission", c.transmission],
    ["Drivetrain", c.drivetrain],
    ["Fuel", c.fuel_type],
    ["Color", v.color],
    ["Trim", v.trim || c.variant || "Standard"],
    ["Brand-new SRP", formatPeso(c.retail_srp)],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <Link href="/listings" className="text-sm text-gravel hover:text-asphalt">Back to all cars</Link>
      {listing.status !== "approved" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-gravel">
          <StatusBadge status={listing.status} /> Only you and admins can see this listing right now.
        </p>
      )}
      <div className="mt-3 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div>
          <h1 className="text-4xl font-bold sm:text-5xl">{carName(c)}</h1>
          <div className="mt-6 overflow-hidden rounded-lg border border-curb">
            <CarPhoto src={v.images[active]?.url} alt={carName(c)} className="aspect-[16/10] w-full" />
          </div>
          {v.images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {v.images.map((img, i) => (
                <button key={img.id} onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === active}
                  className={`size-20 shrink-0 overflow-hidden rounded border-2 ${i === active ? "border-asphalt" : "border-transparent opacity-70 hover:opacity-100"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {listing.description && (
            <section className="mt-10">
              <h2 className="text-3xl font-bold">From the seller</h2>
              <p className="mt-3 max-w-prose whitespace-pre-line">{listing.description}</p>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-3xl font-bold">Service record</h2>
            {listing.logs.length === 0 ? (
              <p className="mt-2 text-gravel">The seller hasn&apos;t logged any service history for this car.</p>
            ) : (
              <>
                <p className="mt-2 text-gravel">
                  {listing.logs.length} {listing.logs.length === 1 ? "entry" : "entries"} logged by the owner, {formatPeso(v.total_spent)} in total. Ask the seller for the receipts.
                </p>
                <ol className="mt-4 divide-y divide-curb rounded-lg border border-curb bg-white">
                  {listing.logs.map((l, i) => (
                    <li key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr_auto] sm:gap-4">
                      <span className="text-sm text-gravel">{formatDate(l.performed_on)}</span>
                      <span>
                        <span className="block">{l.details}</span>
                        <span className="text-sm text-gravel">
                          {CHANGE_LABEL[l.change_type]}{l.mileage_km != null && `, at ${formatKm(l.mileage_km)}`}
                        </span>
                      </span>
                      <span className="tabular font-semibold">{formatPeso(l.cost)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <section className="mt-10">
            <h2 className="text-3xl font-bold">Specifications</h2>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-curb bg-curb sm:grid-cols-4">
              {specs.map(([k, val]) => (
                <div key={k} className="bg-white px-4 py-3">
                  <dt className="text-sm text-gravel">{k}</dt>
                  <dd className="font-medium">{val}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="space-y-6 lg:pt-16">
          <div className="surface p-5">
            <p className="tabular font-display text-4xl font-bold">{formatPeso(listing.asking_price)}</p>
            <div className="mt-3"><Odometer km={v.mileage_km} /></div>
            <p className="mt-3 text-sm text-gravel">Listed {formatDate(listing.created_at)}</p>
            <hr className="my-4 border-curb" />
            <p className="font-semibold">
              Sold by {listing.seller.first_name}
              {listing.seller.region && <span className="font-normal text-gravel">, {listing.seller.region}</span>}
            </p>
            {listing.seller.contact_number ? (
              <div className="mt-3 space-y-2">
                <a href={`tel:${listing.seller.contact_number}`} className="btn-primary w-full"><Phone size={18} />Call {listing.seller.contact_number}</a>
                <a href={`mailto:${listing.seller.email}?subject=${encodeURIComponent(`Inquiry: ${carName(c)} on Vroomble`)}`} className="btn-ghost w-full"><Mail size={18} />Email the seller</a>
              </div>
            ) : (
              <Link href={`/login?next=/listings/${listing.id}`} className="btn-dark mt-3 w-full">Log in to contact the seller</Link>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
}
