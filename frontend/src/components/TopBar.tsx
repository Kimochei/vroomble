"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function TopBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/listings", label: "Buy a car" },
    { href: "/predict", label: "Price estimator" },
    ...(user ? [{ href: "/garage", label: "My garage" }] : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 bg-asphalt text-plate">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={34} height={34} />
          <span className="font-display text-2xl font-bold tracking-wide">Vroomble</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 font-medium transition-colors ${
                isActive(l.href) ? "text-lane" : "text-plate/80 hover:text-plate"
              }`}
              aria-current={isActive(l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link href="/account" className="rounded-md px-3 py-2 text-plate/80 hover:text-plate">
                {user.first_name}
              </Link>
              <button
                className="rounded-md border border-plate/25 px-3 py-1.5 text-sm hover:border-plate"
                onClick={logout}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-2 text-plate/80 hover:text-plate">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary py-1.5">
                Create account
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <div className="lane-line" aria-hidden />

      {open && (
        <nav className="border-t border-asphalt-2 px-4 pb-4 md:hidden" aria-label="Mobile">
          {[...links, ...(user ? [{ href: "/account", label: "Account" }] : [{ href: "/login", label: "Log in" }, { href: "/signup", label: "Create account" }])].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block border-b border-asphalt-2 py-3 text-lg">
              {l.label}
            </Link>
          ))}
          {user && (
            <button
              className="mt-3 text-plate/70"
              onClick={logout}
            >
              Log out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
