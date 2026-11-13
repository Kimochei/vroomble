"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { Options } from "./types";

let cache: Promise<Options> | null = null;

export function useOptions(): Options | null {
  const [opts, setOpts] = useState<Options | null>(null);
  useEffect(() => {
    cache ??= api<Options>("/catalog/options").catch((e) => {
      cache = null;
      throw e;
    });
    cache.then(setOpts).catch(() => {});
  }, []);
  return opts;
}
