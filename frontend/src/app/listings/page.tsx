"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ListingCard } from "@/components/listings/ListingCard";
import { Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { useOptions } from "@/lib/useOptions";
import type { ListingPage } from "@/lib/types";

const SORTS = [
  ["newest", "Newest first"],
  ["price_asc", "Lowest price"],
  ["price_desc", "Highest price"],
  ["year_desc", "Newest model year"],
  ["mileage_asc", "Lowest mileage"],
] as const;
const FILTER_KEYS = ["q", "make", "body_type", "fuel_type", "transmission", "region", "min_price", "max_price", "min_year", "sort"];

export default function ListingsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const options = useOptions();
  const [makes, setMakes] = useState<string[]>([]);
  const [data, setData] = useState<ListingPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const page = Number(sp.get("page") ?? 1);
  const query = sp.toString();

  useEffect(() => {
    api<{ makes: string[] }>("/listings/facets").then((f) => setMakes(f.makes)).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api<ListingPage>(`/listings?${query}`)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [query]);

  function update(changes: Record<string, string>) {
    const next: Record<string, string> = {};
    FILTER_KEYS.forEach((k) => { const v = sp.get(k); if (v) next[k] = v; });
    Object.assign(next, changes);
    if (!("page" in changes)) delete next.page;
    router.push(`/listings${qs(next)}`, { scroll: false });
  }

  const select = (name: string, label: string, values: string[] | undefined) => (
    <div>
      <label className="label" htmlFor={`f-${name}`}>{label}</label>
      <select id={`f-${name}`} className="field" value={sp.get(name) ?? ""} onChange={(e) => update({ [name]: e.target.value })}>
        <option value="">Any</option>
        {values?.map((v) => <option key={v}>{v}</option>)}
      </select>
    </div>
  );

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const hasFilters = FILTER_KEYS.some((k) => k !== "sort" && sp.get(k));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <PageHeader title="Cars for sale">
        Every listing comes from an owner&apos;s garage, with its service record attached and checked by our team.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-4" aria-label="Filters">
          <form
            onSubmit={(e) => { e.preventDefault(); update({ q: String(new FormData(e.currentTarget).get("q") ?? "") }); }}
            role="search"
          >
            <label className="label" htmlFor="f-q">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-3 left-3 text-gravel" size={18} />
              <input id="f-q" name="q" className="field pl-10" defaultValue={sp.get("q") ?? ""} key={sp.get("q")} placeholder="Model, variant, keyword" />
            </div>
          </form>
          {select("make", "Make", makes)}
          {select("body_type", "Body type", options?.body_types)}
          {select("fuel_type", "Fuel", options?.fuel_types)}
          {select("transmission", "Transmission", options?.transmissions)}
          {select("region", "Region", options?.regions)}
          <fieldset>
            <legend className="label">Price (₱)</legend>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Minimum price" className="field tabular" type="number" min={0} step="any" placeholder="Min" defaultValue={sp.get("min_price") ?? ""} key={`min${sp.get("min_price")}`} onBlur={(e) => e.target.value !== (sp.get("min_price") ?? "") && update({ min_price: e.target.value })} />
              <input aria-label="Maximum price" className="field tabular" type="number" min={0} step="any" placeholder="Max" defaultValue={sp.get("max_price") ?? ""} key={`max${sp.get("max_price")}`} onBlur={(e) => e.target.value !== (sp.get("max_price") ?? "") && update({ max_price: e.target.value })} />
            </div>
          </fieldset>
          {hasFilters && (
            <button className="text-sm font-semibold underline underline-offset-4" onClick={() => router.push("/listings")}>
              Clear filters
            </button>
          )}
        </aside>

        <section aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-gravel">{data ? `${data.total} ${data.total === 1 ? "car" : "cars"}` : " "}</p>
            <label className="flex items-center gap-2 text-sm">
              Sort by
              <select className="field w-auto py-1.5" value={sp.get("sort") ?? "newest"} onChange={(e) => update({ sort: e.target.value })}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <ErrorNote error={error} />
          {!data && !error && <Spinner label="Finding cars" />}
          {data?.items.length === 0 && (
            <Empty title={hasFilters ? "No cars match those filters" : "No cars listed yet"}>
              {hasFilters ? "Try widening the price range or clearing a filter." : "Check back soon, or list your own from your garage."}
            </Empty>
          )}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {data?.items.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pages">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
              <span className="tabular text-gravel">Page {page} of {pages}</span>
              <button className="btn-ghost" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
