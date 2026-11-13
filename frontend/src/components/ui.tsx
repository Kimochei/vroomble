import type { ReactNode } from "react";
import type { ListingStatus } from "@/lib/types";

/** Philippine-style plate chip showing only the last digits the owner chose to share. */
export function Plate({ ending, className = "" }: { ending: string; className?: string }) {
  return (
    <span
      className={`inline-flex flex-col items-center rounded-[5px] border-2 border-asphalt bg-plate px-2 pt-0.5 pb-1 leading-none ${className}`}
      aria-label={`Plate ending in ${ending}`}
    >
      <span className="text-[0.5rem] font-semibold tracking-[0.2em] text-go">PILIPINAS</span>
      <span className="font-display text-lg font-bold tracking-[0.12em] text-asphalt">
        ••• {ending}
      </span>
    </span>
  );
}

/** Odometer readout with fixed-width digit wheels. */
export function Odometer({ km, digits = 6 }: { km: number; digits?: number }) {
  const s = String(Math.max(0, Math.round(km))).padStart(digits, "0");
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${km} kilometers`}>
      <span className="inline-flex overflow-hidden rounded-[4px] border border-asphalt bg-asphalt" aria-hidden>
        {s.split("").map((d, i) => (
          <span
            key={i}
            className={`w-[1.15em] border-r border-asphalt-2 py-0.5 text-center font-display text-base font-semibold last:border-r-0 ${
              i === s.length - 1 ? "bg-plate text-asphalt" : "text-plate"
            }`}
          >
            {d}
          </span>
        ))}
      </span>
      <span className="text-sm text-gravel">km</span>
    </span>
  );
}

const STATUS: Record<ListingStatus, { text: string; cls: string }> = {
  pending: { text: "In review", cls: "bg-lane/30 text-caution border-lane" },
  approved: { text: "Live", cls: "bg-go/10 text-go border-go/40" },
  rejected: { text: "Changes needed", cls: "bg-stop/10 text-stop border-stop/40" },
  withdrawn: { text: "Withdrawn", cls: "bg-concrete text-gravel border-curb" },
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  const s = STATUS[status];
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.text}</span>;
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md border border-stop/40 bg-stop/5 px-3 py-2 text-sm text-stop">
      {error}
    </p>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-curb px-6 py-12 text-center">
      <h3 className="text-2xl font-semibold">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-md text-gravel">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-gravel" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-curb border-t-asphalt" />
      {label}…
    </div>
  );
}

export function PageHeader({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-bold sm:text-5xl">{title}</h1>
        {children && <p className="mt-2 max-w-2xl text-gravel">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function CarPhoto({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  if (!src)
    return (
      <div className={`flex items-center justify-center bg-curb/60 text-sm text-gravel ${className}`}>No photo yet</div>
    );
  // eslint-disable-next-line @next/next/no-img-element -- user uploads served by the API
  return <img src={src} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
}
