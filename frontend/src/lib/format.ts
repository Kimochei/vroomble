const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-PH");

export const formatPeso = (v: number) => peso.format(v);
export const formatKm = (v: number) => `${num.format(v)} km`;
export const formatNumber = (v: number) => num.format(v);
export const formatDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const carName = (c: { year: number; make: string; model: string; variant?: string | null }) =>
  `${c.year} ${c.make} ${c.model}${c.variant ? ` ${c.variant}` : ""}`;

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
