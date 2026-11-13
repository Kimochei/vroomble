"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorNote, PageHeader } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPeso } from "@/lib/format";
import type { Prediction } from "@/lib/types";

type Mods = { base_price: number; types: Record<string, { part: string; cost: number }[]> };

const compactPeso = (v: number) =>
  v >= 1_000_000 ? `₱${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 2)}M` : `₱${Math.round(v / 1000)}k`;

function Projection({ data }: { data: Prediction["projection"] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Projected value from ${formatPeso(data[0].value)} to ${formatPeso(data.at(-1)!.value)}`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#d6d9d3" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: "#d6d9d3" }}
            tick={{ fill: "#6d726e", fontSize: 12 }}
            tickFormatter={(m) => (m === 0 ? "Now" : `${m} mo`)}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6d726e", fontSize: 12 }}
            tickFormatter={compactPeso}
            width={60}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "#1e2124", strokeWidth: 1 }}
            formatter={(v) => [formatPeso(Number(v)), "Estimated value"]}
            labelFormatter={(m) => (m === 0 ? "Today" : `In ${m} months`)}
            contentStyle={{ borderRadius: 6, border: "1px solid #d6d9d3", fontFamily: "Barlow" }}
          />
          <Line type="linear" dataKey="value" stroke="#1e2124" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PredictPage() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [make, setMake] = useState(sp.get("make") ?? "");
  const [model, setModel] = useState(sp.get("model") ?? "");
  const [mods, setMods] = useState<Mods | null>(null);
  const [modType, setModType] = useState<string>("");
  const [parts, setParts] = useState<string[]>([]);
  const [months, setMonths] = useState(12);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  useEffect(() => {
    api<string[]>("/predict/makes").then((m) => {
      setMakes(m);
      // Deep links use the catalog's spelling; match the pricing data case-insensitively.
      setMake((cur) => m.find((x) => x.toLowerCase() === cur.toLowerCase()) ?? "");
    }).catch((e) => setError(e.message));
    api<{ enabled: boolean }>("/predict/email-enabled").then((r) => setEmailEnabled(r.enabled)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!make) return;
    api<string[]>(`/predict/models${qs({ make })}`).then((m) => {
      setModels(m);
      setModel((cur) => m.find((x) => x.toLowerCase() === cur.toLowerCase()) ?? "");
    }).catch((e) => setError(e.message));
  }, [make]);

  function resetMods() {
    setMods(null);
    setModType("");
    setParts([]);
    setResult(null);
  }
  function chooseMake(m: string) {
    setMake(m);
    setModel("");
    setModels([]);
    resetMods();
  }
  function chooseModel(m: string) {
    setModel(m);
    resetMods();
  }

  useEffect(() => {
    if (!make || !model) return;
    api<Mods>(`/predict/modifications${qs({ make, model })}`).then(setMods).catch((e) => setError(e.message));
  }, [make, model]);

  // Recalculate whenever the inputs change.
  const body = useMemo(() => ({ make, model, modification_type: modType || null, parts, months }), [make, model, modType, parts, months]);
  useEffect(() => {
    if (!make || !model || !mods) return;
    const t = setTimeout(() => {
      api<Prediction>("/predict", { body })
        .then((r) => { setResult(r); setError(null); })
        .catch((e) => setError(e.message));
    }, 150);
    return () => clearTimeout(t);
  }, [body, make, model, mods]);

  const typeParts = modType && mods ? mods.types[modType] ?? [] : [];
  const change = result ? result.predicted_price - result.current_total : 0;

  async function sendEmail() {
    setEmailNote(null);
    try {
      const r = await api<{ sent_to: string }>("/predict/email", { body });
      setEmailNote(`Sent to ${r.sent_to}`);
    } catch (e) {
      setEmailNote((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <PageHeader title="Price estimator">
        See how a car&apos;s value moves over time, with or without the parts you&apos;ve added. Estimates use Philippine
        market prices and an inflation rate for each model.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="make">Make</label>
              <select id="make" className="field" value={make} onChange={(e) => chooseMake(e.target.value)}>
                <option value="">Choose</option>
                {makes.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="model">Model</label>
              <select id="model" className="field" value={model} onChange={(e) => chooseModel(e.target.value)} disabled={!make}>
                <option value="">Choose</option>
                {models.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="months">
              Look ahead: <span className="tabular">{months} {months === 1 ? "month" : "months"}</span>
            </label>
            <input id="months" type="range" min={1} max={60} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="w-full accent-asphalt" />
            <div className="flex justify-between text-xs text-gravel"><span>1 month</span><span>5 years</span></div>
          </div>

          {mods && Object.keys(mods.types).length > 0 && (
            <fieldset>
              <legend className="label">Modifications</legend>
              <div className="flex flex-wrap gap-2">
                {["", ...Object.keys(mods.types)].map((t) => (
                  <button
                    key={t || "none"}
                    type="button"
                    aria-pressed={modType === t}
                    onClick={() => { setModType(t); setParts([]); }}
                    className={`rounded-full border px-3 py-1.5 text-sm ${modType === t ? "border-asphalt bg-asphalt text-plate" : "border-curb bg-white hover:border-asphalt"}`}
                  >
                    {t || "Stock"}
                  </button>
                ))}
              </div>
              {typeParts.length > 0 && (
                <ul className="mt-3 max-h-80 divide-y divide-curb overflow-auto rounded-md border border-curb bg-white">
                  {typeParts.map((p) => (
                    <li key={p.part}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-concrete">
                        <input
                          type="checkbox"
                          className="size-4 accent-asphalt"
                          checked={parts.includes(p.part)}
                          onChange={(e) => setParts(e.target.checked ? [...parts, p.part] : parts.filter((x) => x !== p.part))}
                        />
                        <span className="flex-1 text-sm">{p.part.replace(`${make} ${model} `, "")}</span>
                        <span className="tabular text-sm text-gravel">{formatPeso(p.cost)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}
        </div>

        <section className="surface min-h-80 p-6" aria-live="polite">
          <ErrorNote error={error} />
          {!result && !error && (
            <div className="flex h-full min-h-64 items-center justify-center text-center text-gravel">
              Choose a make and model to see its estimate.
            </div>
          )}
          {result && (
            <>
              <h2 className="text-3xl font-bold">{result.make} {result.model}</h2>
              <dl className="mt-5 grid gap-6 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-gravel">Value today</dt>
                  <dd className="tabular font-display text-3xl font-semibold">{formatPeso(result.current_total)}</dd>
                  <dd className="text-sm text-gravel">
                    {formatPeso(result.base_price)} car{result.parts_cost > 0 && ` + ${formatPeso(result.parts_cost)} parts`}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-gravel">In {result.months} {result.months === 1 ? "month" : "months"}</dt>
                  <dd className="tabular font-display text-5xl font-bold">{formatPeso(result.predicted_price)}</dd>
                  <dd className="text-sm text-gravel">
                    {change >= 0 ? "Up" : "Down"} {formatPeso(Math.abs(change))} at {(result.monthly_inflation_rate * 100).toFixed(1)}% a year
                  </dd>
                </div>
              </dl>
              <div className="mt-6">
                <Projection data={result.projection} />
              </div>
              <p className="mt-4 text-xs text-gravel">
                An estimate from a regression model trained on listed prices, not an appraisal. Condition, mileage and
                location move real prices.
              </p>
              {emailEnabled && user && (
                <div className="mt-4 flex items-center gap-3">
                  <button className="btn-ghost" onClick={sendEmail}>Email me this estimate</button>
                  {emailNote && <span className="text-sm text-gravel" role="status">{emailNote}</span>}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
