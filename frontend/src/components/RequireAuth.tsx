"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Spinner } from "./ui";

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (admin && user.role !== "admin") router.replace("/garage");
  }, [loading, user, admin, router, pathname]);

  if (loading || !user || (admin && user.role !== "admin")) return <Spinner />;
  return <>{children}</>;
}
