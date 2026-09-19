// Match the shared connectivity manager's uncached HEAD probe as well as GET.
// Keep this handler independent of PM startup (bridge, sweeps and writebacks).
export function routeHealth(req, res) {
  if (
    !["GET", "HEAD"].includes(req.method) ||
    new URL(req.url, "http://127.0.0.1").pathname !== "/api/health"
  )
    return false;

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(req.method === "HEAD" ? undefined : JSON.stringify({ ok: true }));
  return true;
}
