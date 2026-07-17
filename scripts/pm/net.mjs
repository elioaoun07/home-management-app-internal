// Host-header validation for pm-server (DNS-rebinding guard).
// Pure and dependency-free so it is unit-testable (tests/pm-server-net.test.ts).

const PRIVATE_HOST_RE =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

/**
 * Decide whether a request's Host header is acceptable.
 * Localhost forms always pass; RFC1918 private addresses pass only in LAN
 * mode, so exposing the server to the network never opens it to DNS-rebinding
 * from public hostnames.
 * @param {string|undefined} hostHeader raw Host header (may include :port)
 * @param {{lan?: boolean}} [options]
 */
export function hostAllowed(hostHeader, { lan = false } = {}) {
  const raw = String(hostHeader || "");
  if (!raw) return true; // parity with the historical guard: missing Host passes
  const end = raw.indexOf("]");
  const host = raw.startsWith("[")
    ? raw.slice(1, end > 0 ? end : raw.length) // "[::1]:4317" -> "::1"
    : raw.split(":")[0];
  if (["127.0.0.1", "localhost", "::1"].includes(host)) return true;
  return lan && PRIVATE_HOST_RE.test(host);
}
