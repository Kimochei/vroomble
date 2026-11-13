import Link from "next/link";
import { LatestListings } from "@/components/listings/LatestListings";
import { Odometer, Plate } from "@/components/ui";

const SAMPLE_LOG = [
  { date: "12 Oct 2026", what: "Change oil and filter, 5W-30", km: "48,500", cost: "₱4,800", kind: "Maintenance" },
  { date: "28 Aug 2026", what: "LED headlight bulbs installed", km: "46,900", cost: "₱6,500", kind: "Upgrade" },
  { date: "03 May 2026", what: "Front brake pads replaced", km: "43,200", cost: "₱3,900", kind: "Maintenance" },
];

export default function Home() {
  return (
    <>
      <section className="bg-asphalt text-plate">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <h1 className="text-[clamp(2.75rem,7vw,5.25rem)] font-bold leading-[0.95]">
              Every oil change, every upgrade, one record a buyer can trust.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-plate/75">
              Log what you do to your car, see what it&apos;s likely worth, and sell it with its history attached.
              Built for Filipino car owners and the people buying from them.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary px-6 py-3 text-lg">
                Start your garage
              </Link>
              <Link href="/listings" className="btn border border-plate/30 px-6 py-3 text-lg text-plate hover:border-plate">
                Browse cars for sale
              </Link>
            </div>
          </div>

          {/* A specimen logbook page: the thing Vroomble actually produces. */}
          <figure className="rounded-xl bg-plate p-5 text-asphalt shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gravel">2014 Toyota Fortuner G</p>
                <p className="font-display text-3xl font-bold">Service record</p>
              </div>
              <Plate ending="1234" />
            </div>
            <div className="mt-4 flex items-center justify-between border-y border-curb py-3">
              <Odometer km={48500} />
              <span className="text-sm text-gravel">₱15,200 logged this year</span>
            </div>
            <ol className="divide-y divide-curb">
              {SAMPLE_LOG.map((r) => (
                <li key={r.date} className="grid grid-cols-[5.5rem_1fr_auto] gap-3 py-3 text-sm">
                  <span className="text-gravel">{r.date}</span>
                  <span>
                    <span className="font-medium">{r.what}</span>
                    <span className="block text-gravel">
                      {r.kind}, at {r.km} km
                    </span>
                  </span>
                  <span className="tabular font-semibold">{r.cost}</span>
                </li>
              ))}
            </ol>
            <figcaption className="mt-2 text-xs text-gravel">Sample entry. Yours fills in as you log.</figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-20 sm:px-6 md:grid-cols-3">
        <div>
          <h2 className="text-3xl font-bold">Your garage</h2>
          <p className="mt-3 text-gravel">
            Register each car once, then log maintenance, upgrades and accidents with receipts and photos. The odometer
            and running cost stay up to date on their own.
          </p>
          <Link href="/garage" className="mt-4 inline-block font-semibold underline underline-offset-4">
            Open my garage
          </Link>
        </div>
        <div>
          <h2 className="text-3xl font-bold">Price estimator</h2>
          <p className="mt-3 text-gravel">
            Pick a make and model, add the parts you&apos;ve fitted, and see how its value moves over the next one to five
            years.
          </p>
          <Link href="/predict" className="mt-4 inline-block font-semibold underline underline-offset-4">
            Estimate a price
          </Link>
        </div>
        <div>
          <h2 className="text-3xl font-bold">Sell with the record</h2>
          <p className="mt-3 text-gravel">
            List a car from your garage and its service history comes with it. Every listing is checked by our team
            before it goes live.
          </p>
          <Link href="/listings" className="mt-4 inline-block font-semibold underline underline-offset-4">
            See what&apos;s for sale
          </Link>
        </div>
      </section>

      <LatestListings />
    </>
  );
}
