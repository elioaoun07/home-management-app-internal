export class ApiError extends Error {
  constructor(message, status, payload) { super(message); this.name = "ApiError"; this.status = status; this.payload = payload; }
}

export async function apiGet(path) {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status})`, response.status, payload);
  return payload;
}

export async function apiPost(op, body) {
  const response = await fetch(`/api/${op}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status})`, response.status, payload);
  return payload;
}

// Same payload shape as apiGet, but reads the raw response headers so callers
// can tell a live fetch from the service worker's offline-cache fallback
// (see scripts/pm/assets/sw.js) — apiGet() itself doesn't expose headers.
export async function loadData() {
  if (globalThis.PM_MODE !== "server") return { ...globalThis.PM_DATA, _offline: false, _cachedAt: null };
  const response = await fetch("/api/data", { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status})`, response.status, payload);
  return { ...payload, _offline: response.headers.get("x-pm-offline") === "1", _cachedAt: response.headers.get("x-pm-cached-at") };
}

