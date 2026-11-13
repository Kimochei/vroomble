"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { CarPhoto, Empty, ErrorNote, Odometer, PageHeader, Plate, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { carName, formatPeso } from "@/lib/format";
import type { Vehicle } from "@/lib/types";

function Garage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Vehicle[]>("/garage").then(setVehicles).catch((e) => setError(e.message));
  }, []);

  const spent = vehicles?.reduce((s, v) => s + v.total_spent, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <PageHeader
        title={`${user?.first_name}'s garage`}
        action={<Link href="/garage/new" className="btn-primary">Register a car</Link>}
      >
        {vehicles && vehicles.length > 0
          ? `${vehicles.length} ${vehicles.length === 1 ? "car" : "cars"}, ${formatPeso(spent)} logged in upkeep and upgrades.`
          : "Your cars and their service history live here."}
      </PageHeader>
      <ErrorNote error={error} />
      {!vehicles && !error && <Spinner label="Opening your garage" />}
      {vehicles?.length === 0 && (
        <Empty title="No cars yet" action={<Link href="/garage/new" className="btn-dark">Register your first car</Link>}>
          Pick your car from the catalog, add a few photos, and start logging. It takes about two minutes.
        </Empty>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {vehicles?.map((v) => (
          <Link key={v.id} href={`/garage/${v.id}`} className="surface group flex overflow-hidden hover:border-asphalt">
            <CarPhoto src={v.images[0]?.url} alt={carName(v.car)} className="w-36 shrink-0 sm:w-48" />
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold group-hover:underline">
                    {v.car.year} {v.car.make} {v.car.model}
                  </h2>
                  <p className="text-sm text-gravel">
                    {v.trim || v.car.variant || v.car.body_type}, {v.color}
                  </p>
                </div>
                <Plate ending={v.plate_ending} className="shrink-0" />
              </div>
              <Odometer km={v.mileage_km} />
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>
                  <span className="tabular font-semibold">{v.log_count}</span> log {v.log_count === 1 ? "entry" : "entries"}
                </span>
                <span className="tabular font-semibold">{formatPeso(v.total_spent)}</span>
                {v.listing && v.listing.status !== "withdrawn" && <StatusBadge status={v.listing.status} />}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function GaragePage() {
  return (
    <RequireAuth>
      <Garage />
    </RequireAuth>
  );
}
