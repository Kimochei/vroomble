"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useOptions } from "@/lib/useOptions";
import type { User } from "@/lib/types";

export default function SignupPage() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/garage";
  const { setUser } = useAuth();
  const options = useOptions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (f.password !== f.confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const user = await api<User>("/auth/register", {
        body: {
          first_name: f.first_name,
          last_name: f.last_name,
          email: f.email,
          contact_number: f.contact_number,
          region: f.region || null,
          password: f.password,
        },
      });
      setUser(user);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have one?{" "}
          <Link href="/login" className="font-semibold text-asphalt underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="first_name">First name</label>
            <input className="field" id="first_name" name="first_name" autoComplete="given-name" required />
          </div>
          <div>
            <label className="label" htmlFor="last_name">Last name</label>
            <input className="field" id="last_name" name="last_name" autoComplete="family-name" required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact_number">Mobile number</label>
            <input className="field" id="contact_number" name="contact_number" type="tel" autoComplete="tel" placeholder="09171234567" required />
          </div>
          <div>
            <label className="label" htmlFor="region">Region</label>
            <select className="field" id="region" name="region" defaultValue="">
              <option value="">Choose later</option>
              {options?.regions.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="field" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input className="field" id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
          </div>
        </div>
        <p className="text-sm text-gravel">At least 8 characters. Buyers only see your number after they log in.</p>
        <ErrorNote error={error} />
        <button className="btn-dark w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
