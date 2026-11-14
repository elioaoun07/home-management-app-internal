import { z } from "zod";
const start = z.object({ action: z.literal("start"), id: z.string().min(1).max(64), file: z.string().min(1).max(300),
  executor: z.enum(["claude", "codex"]), model: z.string().max(128).nullish(), effort: z.string().max(16).nullish() });
const command = z.discriminatedUnion("action", [start, z.object({ action: z.enum(["review", "ship", "undo", "cancel"]), run_id: z.string().regex(/^local-[0-9a-f-]{36}$/u) })]);
export async function routeLocal({ method, path, query = null, body, loopbackPeer }, auth, ctx) {
  if (!path.startsWith("/api/delivery/v2/local")) return null;
  // First Local lane is desktop-only, including reads of paths/diffs. Relay
  // access cannot smuggle an owner verb through its broader V2 credential.
  if (auth.kind !== "browser" || !loopbackPeer) return { status: 403, json: { error: "local-desktop-only" } };
  try {
    if (method === "GET" && path === "/api/delivery/v2/local/readiness") return { status: 200, json: await ctx.local.readiness({ executor: query?.get("executor") || "claude" }) };
    if (method === "GET" && path === "/api/delivery/v2/local/run") return { status: 200, json: await ctx.local.detail(query?.get("id") || "") };
    if (method !== "POST" || path !== "/api/delivery/v2/local") return { status: 404, json: { error: "unknown-local-route" } };
    const parsed = command.safeParse(body);
    if (!parsed.success) return { status: 400, json: { error: "invalid-local-command" } };
    const input = parsed.data;
    const value = input.action === "start" ? await ctx.local.start(input) : await ctx.local[input.action](input.run_id);
    return { status: value?.ok === false ? 409 : 200, json: { ok: true, ...(typeof value === "string" ? { patch: value } : value) } };
  } catch (error) { return { status: 409, json: { ok: false, error: String(error.message) } }; }
}
