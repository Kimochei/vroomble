"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
}

export default function LoginPage() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const user = await api<User>("/auth/login", { body: { email: f.get("email"), password: f.get("password") } });
      setUser(user);
      router.replace(next ?? (user.role === "admin" ? "/admin" : "/garage"));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Log in"
      footer={
        <>
          New to Vroomble?{" "}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-asphalt underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <ErrorNote error={error} />
        <button className="btn-dark w-full" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthCard>
  );
}
