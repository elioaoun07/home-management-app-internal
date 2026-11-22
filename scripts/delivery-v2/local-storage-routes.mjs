import { z } from "zod";

const selection = z.object({
  run_id: z.string().regex(/^local-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u),
  witness: z.string().regex(/^[\da-f]{64}$/u),
});

/** Called after Local's desktop-only browser authorization check. */
export async function routeLocalStorage({ method, path, query, body }, ctx) {
  if (method === "GET" && path === "/api/delivery/v2/local/storage") {
    const input = { run_id: query?.get("run_id") || undefined, measure: query?.get("measure") === "1", summary: query?.get("summary") === "1" };
    if (input.run_id && !selection.shape.run_id.safeParse(input.run_id).success) return { status: 400, json: { error: "invalid-local-run" } };
    return { status: 200, json: await ctx.local.storage(input) };
  }
  if (method !== "POST" || path !== "/api/delivery/v2/local") return null;
  if (body?.action === "discard") {
    const parsed = selection.safeParse(body);
    if (!parsed.success) return { status: 400, json: { error: "cleanup-preview-required" } };
    return { status: 200, json: { ok: true, ...await ctx.local.discard(parsed.data.run_id, parsed.data.witness) } };
  }
  if (body?.action === "cleanup") {
    const parsed = z.array(selection).min(1).max(100).safeParse(body.runs);
    if (!parsed.success) return { status: 400, json: { error: "cleanup-preview-required" } };
    return { status: 200, json: { ok: true, ...await ctx.local.cleanup(parsed.data) } };
  }
  return null;
}
