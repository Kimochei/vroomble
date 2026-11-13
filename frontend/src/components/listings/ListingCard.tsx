import Link from "next/link";
import type { Listing } from "@/lib/types";
import { carName, formatKm, formatPeso } from "@/lib/format";
import { CarPhoto } from "../ui";

export function ListingCard({ listing }: { listing: Listing }) {
  const { vehicle: v } = listing;
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group block overflow-hidden rounded-lg border border-curb bg-white transition-colors hover:border-asphalt"
    >
      <CarPhoto src={v.images[0]?.url} alt={carName(v.car)} className="aspect-[4/3] w-full" />
      <div className="p-4">
        <h3 className="text-xl font-semibold group-hover:underline">{carName(v.car)}</h3>
        <p className="mt-1 text-sm text-gravel">
          {formatKm(v.mileage_km)}, {v.car.transmission}, {v.car.fuel_type}
          {listing.seller.region ? `, ${listing.seller.region}` : ""}
        </p>
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <span className="tabular font-display text-2xl font-bold">{formatPeso(listing.asking_price)}</span>
          {v.log_count > 0 && (
            <span className="text-sm font-medium text-go">
              {v.log_count} service {v.log_count === 1 ? "record" : "records"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
