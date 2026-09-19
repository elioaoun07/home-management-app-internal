// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { routeHealth } from "../../scripts/pm/health.mjs";

describe("PM connectivity endpoint", () => {
  // Exercise the production handler over HTTP without starting the bridge,
  // Delivery writebacks or archive sweeps in pm-server.mjs.
  const server = createServer((req, res) => {
    if (routeHealth(req, res)) return;
    res.writeHead(404);
    res.end();
  });
  let origin: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  });

  it("answers the shared connectivity manager's HEAD probe without caching or a body", async () => {
    const response = await fetch(`${origin}/api/health`, {
      method: "HEAD",
      cache: "no-store",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("retains the GET health response, including query strings", async () => {
    const response = await fetch(`${origin}/api/health?probe=1`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("does not claim unsupported methods or unrelated routes are healthy", async () => {
    const post = await fetch(`${origin}/api/health`, { method: "POST" });
    const unknown = await fetch(`${origin}/api/unknown`, { method: "HEAD" });
    expect(post.status).toBe(404);
    expect(unknown.status).toBe(404);
  });
});
