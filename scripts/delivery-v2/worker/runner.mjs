// scripts/delivery-v2/worker/runner.mjs
// Runs INSIDE the worker container (worker-boundary.mjs). Never on the host.
//
// It invokes one native executor through its SDK and prints every SDK record as
// one JSON line. The supervisor reads those lines through the adapters' existing
// SDK seam, so nothing here decides anything: no authority, no evidence, no retry.
//
//   node runner.mjs --probe      SDK versions and the battery digest; no provider
//   node runner.mjs <base64>     one dispatch
//
// Credentials, when the owner supplies them, are a read-only volume at
// /run/era-credentials/<backend_id>.json holding environment variables for that
// executor alone.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareSubscription, readSubscriptionWindows } from "./subscription.mjs";
import { subscriptionObservation } from "../subscription-window.mjs";
import { installTaskBrief, withTaskBriefRead } from "./task-brief.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ERA_ROOT = resolve(HERE, "..", "..", "..");
const emit = (record) => process.stdout.write(JSON.stringify(record) + "\n");

function packageVersion(name) {
  try {
    return JSON.parse(readFileSync(join(ERA_ROOT, "node_modules", ...name.split("/"), "package.json"), "utf8")).version || null;
  } catch {
    return null;
  }
}

/**
 * The preflight record, carrying the plan-window observation the gate read.
 *
 * Only the normalized observation crosses the boundary: the raw usage payload
 * stays in this process, so nothing beyond percentages, window identities and a
 * plan tier can reach the supervisor's store.
 */
function readyRecord(backend_id, prepared) {
  const { usageSnapshot, ...provenance } = prepared;
  return {
    era: "subscription-ready",
    backend_id,
    ...provenance,
    observation: subscriptionObservation(backend_id, usageSnapshot, { at: new Date().toISOString() }),
  };
}

/** A standalone window observation, taken after the job. Never throws. */
async function windowRecord(backend_id, phase) {
  const { usage, error } = await readSubscriptionWindows(backend_id);
  const observation = subscriptionObservation(backend_id, usage, { at: new Date().toISOString() });
  return { era: "subscription-window", backend_id, phase, observation: error ? { ...observation, error } : observation };
}

async function main() {
  if (process.argv[2] === "--sdk-probe") {
    const backend = process.argv[3];
    await prepareSubscription(backend);
    if (backend !== "claude-agent-sdk") throw new Error("use native account/read for Codex SDK readiness");
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    // Empty streaming input initializes the SDK control channel. No prompt is
    // yielded, so neither accountInfo nor supportedModels performs inference.
    const session = query({ prompt: (async function* () { await new Promise(resolve => controller.signal.addEventListener("abort", resolve, { once: true })); })(), options: { cwd: "/tmp", env: { ...process.env }, settingSources: [], strictMcpConfig: true, abortController: controller } });
    try {
      const [account, models] = await Promise.all([session.accountInfo(), session.supportedModels()]);
      emit({ era: "sdk-ready", subscriptionType: account.subscriptionType, models });
    } finally { session.close(); controller.abort(); clearTimeout(timer); }
    return;
  }
  if (process.argv[2] === "--auth-probe") {
    emit(readyRecord(process.argv[3], await prepareSubscription(process.argv[3])));
    return;
  }
  if (process.argv[2] === "--probe") {
    const canary = join(ERA_ROOT, "scripts", "delivery-v2", "probes", "canary.mjs");
    emit({
      era: "probe",
      task_brief_version: 1,
      sdk: {
        "claude-agent-sdk": packageVersion("@anthropic-ai/claude-agent-sdk"),
        "codex-exec-sdk": packageVersion("@openai/codex-sdk"),
      },
      battery_digest: existsSync(canary) ? "sha256:" + createHash("sha256").update(readFileSync(canary, "utf8"), "utf8").digest("hex") : null,
    });
    return;
  }

  const payload = JSON.parse(process.argv[2] === "--stdin" ? readFileSync(0, "utf8") : Buffer.from(String(process.argv[2] || ""), "base64").toString("utf8"));
  emit({ era: "runner-started", backend_id: payload.backend_id });

  // Fixture mode for the container smoke only: writes files, calls no SDK. Only a
  // boundary built with `synthetic: true` sets ERA_V2_SYNTHETIC, and under it the
  // runner refuses anything that is not a synthetic script — so a synthetic
  // boundary can never reach a provider, and a prompt alone cannot enable it.
  if (process.env.ERA_V2_SYNTHETIC === "1") {
    const prompt = String(payload.prompt || "");
    if (!prompt.startsWith("SYNTHETIC ")) throw new Error("a synthetic boundary runs only synthetic scripts");
    const script = JSON.parse(prompt.slice("SYNTHETIC ".length));
    const session = String((payload.options && (payload.options.resume || payload.options.sessionId)) || "synthetic-session");
    emit({ era: "sdk-message", message: { type: "system", subtype: "init", model: "synthetic-fixture", session_id: session } });
    const denied = [];
    for (const entry of script.writes || []) {
      const target = join("/work", String(entry.path));
      try {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, String(entry.content), "utf8");
      } catch (error) {
        denied.push(String(entry.path) + ": " + String((error && error.code) || error));
      }
    }
    const text = denied.length ? "write denied: " + denied.join("; ") : String(script.reply || "done");
    emit({ era: "sdk-message", message: { type: "assistant", message: { content: [{ type: "text", text }] } } });
    emit({ era: "sdk-message", message: { type: "result", subtype: "success", is_error: false, result: text, usage: {}, session_id: session } });
    emit({ era: "runner-finished" });
    return;
  }

  const briefPath = installTaskBrief(payload.taskBrief);
  if (payload.backend_id === "claude-agent-sdk") {
    emit(readyRecord(payload.backend_id, await prepareSubscription(payload.backend_id)));
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    const { buildCanUseTool } = await import("../../delivery/drivers/claude.mjs");
    const options = {
      ...payload.options,
      env: { ...process.env },
      cwd: "/work",
      canUseTool: withTaskBriefRead(buildCanUseTool({ cwd: "/work", sessionDir: null, forbiddenPaths: payload.forbiddenPaths || [] }), briefPath),
    };
    if (payload.observe && payload.observe.effort) {
      options.hooks = {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                emit({ era: "observation", data: { effort: input.effort ?? null, agent_id: input.agent_id ?? null } });
                return { continue: true };
              },
            ],
          },
        ],
      };
    }
    for await (const message of sdk.query({ prompt: payload.prompt, options })) emit({ era: "sdk-message", message });
  } else if (payload.backend_id === "codex-exec-sdk") {
    emit(readyRecord(payload.backend_id, await prepareSubscription(payload.backend_id)));
    const { Codex } = await import("@openai/codex-sdk");
    const codex = new Codex({ env: { ...process.env }, config: { forced_login_method: "chatgpt" } });
    const options = { ...payload.threadOptions, workingDirectory: "/work" };
    const thread = payload.threadId ? codex.resumeThread(payload.threadId, options) : codex.startThread(options);
    const streamed = await thread.runStreamed(payload.prompt);
    for await (const event of streamed.events) emit({ era: "sdk-event", event });
  } else {
    throw new Error("unknown backend " + String(payload.backend_id));
  }
  // The second half of the bracket. The job is over, so this read cannot gate
  // anything and must not be able to fail it: `readSubscriptionWindows` returns
  // its error instead of throwing, and an unavailable reading is recorded as
  // unavailable rather than as an unchanged window.
  emit(await windowRecord(payload.backend_id, "after"));
  emit({ era: "runner-finished" });
}

main().catch((error) => {
  emit({ era: "runner-error", message: String((error && error.message) || error) });
  process.exitCode = 1;
});
