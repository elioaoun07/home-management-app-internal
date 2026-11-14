// Browser-safe origin test. Socket evidence is always supplied by the server.
export function isLoopbackOrigin(origin) {
  try { const url = new URL(origin); return ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname); }
  catch { return false; }
}
