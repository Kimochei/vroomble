"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ListingPage } from "@/lib/types";
import { ListingCard } from "./ListingCard";

export function LatestListings() {
  const [data, setData] = useState<ListingPage | null>(null);
  useEffect(() => {
    api<ListingPage>("/listings?page_size=4").then(setData).catch(() => setData(null));
  }, []);
  if (!data || data.items.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-4xl font-bold">Just listed</h2>
        <Link href="/listings" className="font-semibold underline underline-offset-4">
          See all {data.total} cars
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {data.items.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </section>
  );
}
