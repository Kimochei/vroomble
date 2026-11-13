import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: { default: "Vroomble", template: "%s | Vroomble" },
  description: "Keep your car's service history, see what it's worth, and sell it to people who can read the record.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-PH">
      <body className="flex min-h-dvh flex-col antialiased">
        <AuthProvider>
          <Suspense fallback={<div className="h-[70px] bg-asphalt" />}>
            <TopBar />
          </Suspense>
          <main className="flex-1">
            <Suspense fallback={<div className="mx-auto max-w-6xl px-4 sm:px-6"><Spinner /></div>}>{children}</Suspense>
          </main>
          <footer className="mt-20 bg-asphalt text-plate/70">
            <div className="lane-line opacity-60" aria-hidden />
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
              <p>Vroomble keeps the paper trail so the car can speak for itself.</p>
              <p>Prices are estimates in Philippine pesos.</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
