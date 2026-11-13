"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorNote, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useOptions } from "@/lib/useOptions";
import type { User } from "@/lib/types";

function AccountForm() {
  const { user, setUser } = useAuth();
  const options = useOptions();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setUser(await api<User>("/auth/me", { method: "PATCH", body: { ...f, region: f.region || null } }));
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 sm:px-6">
      <PageHeader title="Account">
        {user.email}, member since {formatDate(user.created_at)}
      </PageHeader>
      <form onSubmit={onSubmit} className="surface space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="first_name">First name</label>
            <input className="field" id="first_name" name="first_name" defaultValue={user.first_name} required />
          </div>
          <div>
            <label className="label" htmlFor="last_name">Last name</label>
            <input className="field" id="last_name" name="last_name" defaultValue={user.last_name} required />
          </div>
          <div>
            <label className="label" htmlFor="contact_number">Mobile number</label>
            <input className="field" id="contact_number" name="contact_number" type="tel" defaultValue={user.contact_number} required />
          </div>
          <div>
            <label className="label" htmlFor="region">Region</label>
            {options && (
              <select className="field" id="region" name="region" defaultValue={user.region ?? ""}>
                <option value="">Not set</option>
                {options.regions.map((r) => <option key={r}>{r}</option>)}
              </select>
            )}
          </div>
        </div>
        <p className="text-sm text-gravel">Your region is shown on your listings so buyers know where the car is.</p>
        <ErrorNote error={error} />
        <div className="flex items-center gap-4">
          <button className="btn-dark" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
          {saved && <span className="text-go" role="status">Changes saved</span>}
        </div>
      </form>
    </div>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountForm />
    </RequireAuth>
  );
}
