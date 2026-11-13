import type { ReactNode } from "react";

export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 pt-14 sm:px-0">
      <h1 className="text-5xl font-bold">{title}</h1>
      <div className="surface mt-6 p-6">{children}</div>
      <p className="mt-4 text-center text-gravel">{footer}</p>
    </div>
  );
}
