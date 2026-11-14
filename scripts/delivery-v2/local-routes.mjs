import { z } from "zod";
import { randomUUID } from "node:crypto";
import { acceptLaunchRequest, updateStewardRequest } from "./steward-requests.mjs";
const start = z.object({ action: z.literal("start"), id: z.string().min(1).max(64), file: z.string().min(1).max(300),
  executor: z.enum(["claude", "codex"]), model: z.string().max(128).nullish(), effort: z.string().max(16).nullish(), command_id: z.string().uuid().optional() });
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
    let value;
    if (input.action === "start" && ctx.store) {
      // Reuse Delivery's launch receipts: rejected Local starts must remain
      // observable on Bridge, and re-sending a UUID must not dispatch twice.
      const command_id = input.command_id || randomUUID();
      const at = () => ctx.now ? ctx.now() : new Date().toISOString();
      const receipt = acceptLaunchRequest(ctx.store, { ...input, command_id, expectId: input.id }, auth.actor, at());
      if (receipt.conflict) return { status: 409, json: { ok: false, error: "local-launch-pending", command_id: receipt.command_id || command_id } };
      if (!receipt.created) {
        const outcome = receipt.record?.outcome;
        return { status: outcome ? outcome.ok === false ? 409 : 200 : 409,
          json: outcome || { ok: false, error: "local-launch-pending", command_id } };
      }
      try { value = { ...await ctx.local.start(input), command_id }; }
      catch (error) { value = { ok: false, error: String(error.message), command_id }; }
      updateStewardRequest(ctx.store, command_id, value.ok === false ? "blocked" : "run-created", at(), value);
    } else value = input.action === "start" ? await ctx.local.start(input) : await ctx.local[input.action](input.run_id);
    return { status: value?.ok === false ? 409 : 200, json: { ok: true, ...(typeof value === "string" ? { patch: value } : value) } };
  } catch (error) { return { status: 409, json: { ok: false, error: String(error.message) } }; }
}
