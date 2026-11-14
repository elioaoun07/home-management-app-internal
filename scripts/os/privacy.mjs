// Persist allowlisted derived facts only. Never pass a transcript/payload to storage.
export function redact(value) {
  let text = String(value ?? "");
  // Also mask opaque credential values when their variable name is absent
  // from a diagnostic. Do not copy the environment into any stored object.
  for (const [key, secret] of Object.entries(process.env))
    if (
      /(?:key|token|secret|password|authorization)/i.test(key) &&
      secret?.length >= 4
    )
      text = text.replaceAll(secret, "[REDACTED]");
  return text
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      "[REDACTED]",
    )
    .replace(
      /\b(?:sk|pk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}/g,
      "[REDACTED]",
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[REDACTED]",
    )
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(
      /\b([\w.-]*(?:key|token|secret|password|authorization)[\w.-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      "$1[REDACTED]",
    );
}

export const short = (value, size = 240) => redact(value).slice(0, size);
export function safeFacts(value) {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(safeFacts);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, safeFacts(entry)]),
    );
  return value;
}
