export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Body = Record<string, unknown> | FormData | undefined;

function messageFrom(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    // FastAPI validation errors: [{loc: [...,"field"], msg}]
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = d.loc?.filter((p) => p !== "body").at(-1);
        const msg = (d.msg ?? "is invalid").replace(/^Value error, /, "");
        return field ? `${String(field).replaceAll("_", " ")}: ${msg}` : msg;
      })
      .join(". ");
  }
  if (status >= 500) return "Something went wrong on our side. Try again in a moment.";
  return `Request failed (${status}).`;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: Body } = {}): Promise<T> {
  const { method = opts.body ? "POST" : "GET", body } = opts;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the Vroomble server. Check that the backend is running.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(data, res.status));
  return data as T;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
