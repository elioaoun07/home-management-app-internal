// scripts/delivery-v2/uat-routes.mjs
// DLV-145 — the owner-authenticated HTTP surface over uat.mjs. `entry.mjs`
// authenticates (paired session + CSRF, actor from the session) and refuses the
// Steward credential before calling in here, so every command below is the
// owner's. Nothing here starts a job, applies a candidate or calls a provider;
// reading a run uses the journey's existing read-only projection.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  bindDirect,
  bindRun,
  dispositionFeedback,
  freezeHandover,
  listUat,
  readImportStatus,
  readUat,
  recordAvailability,
  recordResult,
  retractSignOff,
  saveDraft,
  signOff,
  submitFeedback,
  viewOne,
  withdrawFeedback,
} from "./uat.mjs";

const json = (status, body) => ({ status, json: body });

/**
 * The checkout's exact identity, read-only: HEAD plus a digest of the bytes of
 * every changed or untracked file. `--no-optional-locks` keeps `git status` from
 * refreshing the index. Never writes, fetches or runs a hook.
 */
export function gitIdentity(root) {
  const git = (...args) => execFileSync("git", ["--no-optional-locks", ...args], { cwd: root, encoding: "utf8", timeout: 8000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 * 1024 * 1024 });
  const head = git("rev-parse", "HEAD").trim();
  const paths = git("status", "--porcelain=v1", "-z", "--untracked-files=all").split("\0").filter(Boolean).map((entry) => entry.slice(3)).sort().slice(0, 4000);
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(path + "\0");
    try {
      hash.update(readFileSync(join(root, path)));
    } catch {
      hash.update("<absent>");
    }
    hash.update("\0");
  }
  return { source_revision: head, files_digest: paths.length ? hash.digest("hex") : null, changed: paths.length };
}

const id = z.string().min(1).max(64);
const command = z.string().min(1).max(128);
const short = (max) => z.string().max(max);
const environment = z.object({ target: z.enum(["local", "hosted", "phone", "none"]).optional(), build: short(200).nullish(), url: short(500).nullish(), device: short(200).nullish() });

const BODY = z.discriminatedUnion("action", [
  z.object({ action: z.literal("import"), run_id: short(128).nullish(), delivery_ref: short(300).nullish(), work_id: short(64).nullish(), campaign: short(80).nullish(), title: short(200).nullish(),
    content: z.unknown(), criteria: z.array(short(64)).max(40).optional(), source_revision: short(64).nullish(), ready: z.boolean().optional(), environment: environment.optional() }),
  z.object({ action: z.literal("ready"), handover_id: id, source_revision: short(64).nullish(), environment: environment.optional() }),
  z.object({ action: z.literal("result"), handover_id: id, revision: z.number().int().min(1), scenario_id: id, result: z.enum(["pass", "fail", "blocked"]), note: short(600).optional(),
    step: z.number().int().min(1).max(60).nullish(), device: short(200).nullish(), build: short(200).nullish(), observed_at: short(40).nullish(), command_id: command }),
  z.object({ action: z.literal("availability"), handover_id: id, revision: z.number().int().min(1), available: z.boolean(), build: short(200).nullish(), note: short(600).optional(), command_id: command }),
  z.object({ action: z.literal("draft"), handover_id: id, revision: z.number().int().min(1), position: z.object({ scenario_id: short(64), step: z.number().int().min(0).max(60) }).nullish(),
    notes: z.record(z.string(), short(600)).optional(), base_rev: z.number().int().min(0) }),
  z.object({ action: z.literal("signoff"), handover_id: id, revision: z.number().int().min(1), build: short(200).nullish(), command_id: command }),
  z.object({ action: z.literal("retract"), handover_id: id, revision: z.number().int().min(1), reason: short(600).optional(), command_id: command }),
  z.object({ action: z.literal("feedback"), handover_id: id, revision: z.number().int().min(1), thread_id: short(64).nullish(), scenario_id: short(64).nullish(), step: z.number().int().min(1).max(60).nullish(),
    classification: z.enum(["bug", "change", "comment"]), urgency: z.enum(["next", "now"]).optional(), observation: short(1200), expected: short(1200).optional(), actual: short(1200).optional(),
    details: short(4200).optional(), evidence: z.array(short(500)).max(8).optional(), build: short(200).nullish(), device: short(200).nullish(), observed_at: short(40).nullish(), command_id: command }),
  z.object({ action: z.literal("feedback-withdraw"), thread_id: short(64), command_id: command }),
  z.object({ action: z.literal("feedback-disposition"), thread_id: short(64), kind: z.enum(["resolved", "follow-up"]), reason: short(600), work_id: short(64).nullish(), command_id: command }),
]);

const NOT_FOUND = new Set(["unknown-handover", "unknown-thread", "unknown-scenario", "unknown-run"]);
const INVALID = new Set([
  "result-invalid", "note-required", "note-too-long", "time-invalid", "time-in-future", "step-invalid", "classification-invalid",
  "observation-required", "observation-too-long", "text-too-long", "disposition-invalid", "reason-required", "actor-missing",
  "command-id-missing", "binding-missing", "subject-missing", "source-revision-invalid",
]);

/** Map a refusal list to one HTTP status: unknown, invalid input, or a conflict with current state. */
function replyFor(outcome) {
  if (outcome.ok) return json(200, outcome);
  const code = outcome.refusals?.[0]?.code;
  if (NOT_FOUND.has(code)) return json(404, outcome);
  if (INVALID.has(code)) return json(400, outcome);
  return json(409, outcome);
}

/** What the live supervisor knows about a run, for binding and staleness. */
function runContext(ctx, run_id) {
  if (!run_id || !ctx.journey || (ctx.hasStore && !ctx.hasStore())) return null;
  let detail;
  try {
    detail = ctx.journey.detail(run_id);
  } catch {
    return null;
  }
  if (!detail?.ok) return null;
  return {
    run: {
      lifecycle: detail.run.lifecycle,
      closed_outcome: detail.run.closed_outcome,
      candidate_id: detail.candidate?.candidate_id ?? null,
      generation: detail.candidate?.generation ?? null,
      result_version: detail.result?.result_version ?? null,
      plan_revision: detail.plans?.length ? detail.plans[detail.plans.length - 1].revision : null,
      contract_revision: detail.contract?.revision ?? null,
      applied: (detail.applications || []).some((application) => application.state === "applied"),
    },
    work: detail.work,
  };
}

/** The list keeps scenario headers only; one handover is read in full. */
function slim(view) {
  return { ...view, scenarios: view.scenarios.map(({ id: sid, title, required, result, draft, steps }) => ({ id: sid, title, required, result, draft, steps: steps.length })) };
}

export function routeUat({ method, path, query, body }, auth, ctx) {
  // Owner sessions only (desktop browser, or the phone bridge's authenticated owner). Anything else is refused here too.
  if (auth.kind !== "browser" && auth.kind !== "bridge") return json(403, { error: "owner-only", detail: "UAT results and sign-off belong to the owner" });
  const now = ctx.now ? ctx.now() : new Date().toISOString();
  const cache = new Map();
  const contextFor = (handover) => {
    if (handover.subject.type !== "run") return null;
    if (!cache.has(handover.subject.run_id)) cache.set(handover.subject.run_id, runContext(ctx, handover.subject.run_id));
    return cache.get(handover.subject.run_id);
  };
  const importStatus = readImportStatus({ root: ctx.root });

  if (method === "GET" && path === "/api/delivery/v2/uat") {
    const wanted = query?.get("id") || "";
    if (wanted) {
      const view = viewOne({ root: ctx.root, handover_id: wanted, contextFor, importStatus, now });
      return view ? json(200, { handover: view, now }) : json(404, { error: "unknown-handover" });
    }
    const all = listUat({ root: ctx.root, contextFor, importStatus, now });
    return json(200, { handovers: all.handovers.map(slim), corrupt: all.corrupt, now });
  }

  if (method !== "POST" || path !== "/api/delivery/v2/uat") return null;
  const parsed = BODY.safeParse(body);
  if (!parsed.success) return json(400, { ok: false, error: "invalid-uat-request", detail: parsed.error.issues[0]?.path.join(".") || null });
  const input = parsed.data;
  const actor = auth.actor;
  const root = ctx.root;
  const latest = (handover_id) => [...readUat({ root }).handovers].reverse().find((row) => row.handover_id === handover_id) || null;
  const afterWrite = (outcome, handover_id) => (outcome.ok ? { ...outcome, handover: viewOne({ root, handover_id, contextFor, importStatus: readImportStatus({ root }), now }) } : outcome);

  switch (input.action) {
    case "import": {
      // Identity comes from the supervisor's own record of the run, never from this body.
      const known = input.run_id ? runContext(ctx, input.run_id) : null;
      if (input.run_id && !known) return json(404, { ok: false, refusals: [{ code: "unknown-run", detail: input.run_id }] });
      const subject = known
        ? { run_id: input.run_id, delivery_ref: `run:${input.run_id}`, work_id: known.work.alias, campaign: known.work.campaign, title: known.work.title }
        : { delivery_ref: input.delivery_ref, work_id: input.work_id, campaign: input.campaign, title: input.title };
      const binding = known ? bindRun(known.run) : input.source_revision && input.delivery_ref ? bindDirect({ delivery_ref: input.delivery_ref, source_revision: input.source_revision }) : null;
      const outcome = freezeHandover({ root, subject, binding, environment: input.environment, content: input.content, criteria: input.criteria, source: { kind: "import", ref: actor }, ready: input.ready === true, now });
      return replyFor(outcome.ok ? { ...outcome, handover: viewOne({ root, handover_id: outcome.handover.handover_id, contextFor, importStatus, now }) } : outcome);
    }
    case "ready": {
      const row = latest(input.handover_id);
      if (!row) return json(404, { ok: false, refusals: [{ code: "unknown-handover", detail: input.handover_id }] });
      if (row.status === "incomplete") return json(409, { ok: false, refusals: [{ code: "handover-incomplete", detail: row.problems.length }] });
      let binding;
      if (row.subject.type === "run") {
        const known = runContext(ctx, row.subject.run_id);
        binding = known ? bindRun(known.run) : null;
        if (!binding) return json(409, { ok: false, refusals: [{ code: "no-candidate", detail: "the run has no candidate to test" }] });
      } else {
        let identity = input.source_revision ? { source_revision: input.source_revision, files_digest: null } : null;
        if (!identity) {
          try {
            identity = (ctx.sourceIdentity || gitIdentity)(root);
          } catch {
            return json(409, { ok: false, refusals: [{ code: "source-unavailable", detail: "the checkout could not be read; give an exact git revision" }] });
          }
        }
        binding = bindDirect({ delivery_ref: row.subject.delivery_ref, source_revision: identity.source_revision, files_digest: identity.files_digest });
        if (!binding) return json(400, { ok: false, refusals: [{ code: "source-revision-invalid", detail: "an exact git revision is required" }] });
      }
      const outcome = freezeHandover({ root, subject: row.subject, binding, environment: { ...row.environment, ...(input.environment || {}) }, content: row.content, source: row.source, ready: true, now });
      return replyFor(outcome.ok ? { ...outcome, handover: viewOne({ root, handover_id: row.handover_id, contextFor, importStatus, now }) } : outcome);
    }
    case "result":
      return replyFor(afterWrite(recordResult({ root, ...input, actor, now }), input.handover_id));
    case "availability":
      return replyFor(afterWrite(recordAvailability({ root, ...input, actor, now }), input.handover_id));
    case "draft":
      return replyFor(saveDraft({ root, ...input, now }));
    case "signoff": {
      const row = latest(input.handover_id);
      const context = row ? contextFor(row) : null;
      return replyFor(afterWrite(signOff({ root, ...input, actor, now, context, importStatus }), input.handover_id));
    }
    case "retract":
      return replyFor(afterWrite(retractSignOff({ root, ...input, actor, now }), input.handover_id));
    case "feedback":
      return replyFor(afterWrite(submitFeedback({ root, ...input, actor, now }), input.handover_id));
    case "feedback-withdraw":
    case "feedback-disposition": {
      const outcome = input.action === "feedback-withdraw"
        ? withdrawFeedback({ root, ...input, actor, now })
        : dispositionFeedback({ root, ...input, actor, now });
      return replyFor(outcome.ok ? { ...outcome, handover: viewOne({ root, handover_id: outcome.feedback.handover_id, contextFor, importStatus: readImportStatus({ root }), now }) } : outcome);
    }
    default:
      return json(400, { ok: false, error: "invalid-uat-request" });
  }
}
