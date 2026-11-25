import { z } from "zod";
import { randomUUID } from "node:crypto";
import { acceptLaunchRequest, updateStewardRequest } from "./steward-requests.mjs";
import { routeLocalStorage } from "./local-storage-routes.mjs";
const start = z.object({ action: z.literal("start"), id: z.string().min(1).max(64), file: z.string().min(1).max(300),
  executor: z.enum(["claude", "codex"]), model: z.string().max(128).nullish(), effort: z.string().max(16).nullish(), command_id: z.string().uuid().optional(),
  start_nonce: z.string().uuid().optional(), preview_id: z.string().max(128).optional() });
const runId = z.string().regex(/^local-[0-9a-f-]{36}$/u);
// DLV-164: answers keyed by the agent's question text, as AskUserQuestion returns them.
const answer = z.object({ action: z.literal("answer"), run_id: runId, question_id: z.string().regex(/^[\w-]{1,200}$/u),
  answers: z.record(z.string().max(2000), z.string().max(4000)).refine(value => Object.keys(value).length >= 1 && Object.keys(value).length <= 4) });
// DLV-165: an owner message to a running or parked session.
const message = z.object({ action: z.literal("message"), run_id: runId, text: z.string().min(1).max(4000) });
// DLV-166: preview / stop-preview run the candidate's dev server for owner UAT.
// DLV-167: merge copies the tested files into the main checkout (no Git write).
const revision = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u);
const command = z.discriminatedUnion("action", [
  start, answer, message, z.object({ action: z.literal("configure-push"), expected_url: z.string().min(1).max(2000) }).strict(),
  z.object({ action: z.enum(["commit", "push"]), run_id: runId, preview_id: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal("refresh"), run_id: runId, expected_base: revision, expected_head: revision }).strict(),
  z.object({ action: z.literal("review"), run_id: runId, expected_head: revision.optional() }),
  // DLV-175: the owner's decision after a paused Acceptance Check.
  z.object({ action: z.literal("request-changes"), run_id: runId, expected_head: revision, note: z.string().max(4000).optional() }).strict(),
  z.object({ action: z.literal("stop"), run_id: runId, expected_head: revision.optional() }).strict(),
  z.object({ action: z.literal("check-acceptance"), run_id: runId }).strict(),
  z.object({ action: z.enum(["ship", "undo", "cancel", "preview", "stop-preview", "merge"]), run_id: runId }),
]);
/** @param {{method:string, path:string, query?:URLSearchParams|null, body?:any, loopbackPeer?:boolean}} request */
export async function routeLocal({ method, path, query = null, body, loopbackPeer }, auth, ctx) {
  if (!path.startsWith("/api/delivery/v2/local")) return null;
  // First Local lane is desktop-only, including reads of paths/diffs. Relay
  // access cannot smuggle an owner verb through its broader V2 credential.
  if (auth.kind !== "browser" || !loopbackPeer) return { status: 403, json: { error: "local-desktop-only" } };
  try {
    const storage = await routeLocalStorage({ method, path, query, body }, ctx);
    if (storage) return storage;
    if (method === "GET" && path === "/api/delivery/v2/local/start-plan") return { status: 200,
      json: await ctx.local.startPlan({ id: query?.get("id"), file: query?.get("file") }) };
    if (method === "GET" && path === "/api/delivery/v2/local/push-settings") return { status: 200,
      json: { setting: await ctx.local.pushSettings(), destination: await ctx.local.inspectPushDestination() } };
    if (method === "GET" && path === "/api/delivery/v2/local/readiness") return { status: 200, json: await ctx.local.readiness({ executor: query?.get("executor") || "claude" }) };
    if (method === "GET" && path === "/api/delivery/v2/local/run") return { status: 200, json: await ctx.local.detail(query?.get("id") || "") };
    if (method === "GET" && path === "/api/delivery/v2/local/activity") {
      const input = z.object({ id: runId, before: z.string().regex(/^\d{1,15}$/u).transform(Number) })
        .safeParse({ id: query?.get("id"), before: query?.get("before") });
      if (!input.success) return { status: 400, json: { error: "Invalid activity cursor" } };
      return { status: 200, json: ctx.local.earlierActivity(input.data.id, input.data.before) };
    }
    if (method === "GET" && path === "/api/delivery/v2/local/comparison") {
      const input = z.object({ id: runId, head: revision, path: z.string().min(1).max(4096).nullable(),
        against: z.enum(["base", "repo"]), source: revision.nullable() }).safeParse({
        id: query?.get("id"), head: query?.get("head"), path: query?.get("path") ?? null,
        against: query?.get("against") ?? "base", source: query?.get("source") ?? null,
      });
      if (!input.success) return { status: 400, json: { error: "Invalid comparison" } };
      return { status: 200, json: await ctx.local.comparison(input.data.id, input.data.head, input.data.path, input.data.against, input.data.source) };
    }
    if (method !== "POST" || path !== "/api/delivery/v2/local") return { status: 404, json: { error: "unknown-local-route" } };
    const parsed = command.safeParse(body);
    if (!parsed.success) return { status: 400, json: { error: "invalid-local-command" } };
    const input = parsed.data;
    let value;
    if (input.action === "configure-push") value = { setting: await ctx.local.configurePush(input.expected_url), destination: input.expected_url };
    else if (input.action === "commit" || input.action === "push") value = await ctx.local[input.action](input.run_id, input.preview_id);
    else if (input.action === "refresh") value = await ctx.local.refresh(input.run_id, input.expected_base, input.expected_head);
    else if (input.action === "review") value = await ctx.local.review(input.run_id, input.expected_head);
    else if (input.action === "request-changes") value = await ctx.local.requestChanges(input.run_id, input.expected_head, input.note ?? "");
    else if (input.action === "stop") value = await ctx.local.stop(input.run_id, input.expected_head ?? null);
    else if (input.action === "check-acceptance") value = await ctx.local.recheckAcceptance(input.run_id);
    else if (input.action === "start" && ctx.store) {
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
      try { value = { ...await ctx.local.start({ ...input, requirePreview: true }), command_id }; }
      catch (error) { value = { ok: false, error: String(error.message), command_id }; }
      updateStewardRequest(ctx.store, command_id, value.ok === false ? "blocked" : "run-created", at(), value);
    } else value = input.action === "start" ? await ctx.local.start({ ...input, requirePreview: true })
      : input.action === "answer" ? await ctx.local.answer(input.run_id, input.question_id, input.answers)
        : input.action === "message" ? await ctx.local.message(input.run_id, input.text)
          : input.action === "stop-preview" ? await ctx.local.stopPreview(input.run_id)
            : await ctx.local[input.action](input.run_id);
    return { status: value?.ok === false ? 409 : 200, json: { ok: true, ...(typeof value === "string" ? { patch: value } : value) } };
  } catch (error) { return { status: 409, json: { ok: false, error: String(error.message) } }; }
}
