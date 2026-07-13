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

export function loadData() {
  return globalThis.PM_MODE === "server" ? apiGet("/api/data") : Promise.resolve(globalThis.PM_DATA);
}

