#!/usr/bin/env node
// scripts/delivery-v2/support-cli.mjs
// Owner CLI for the support ledger: the only way a Claude/Codex support job comes
// to exist on the record. Authorization, admission and settlement all go through
// the owner-authenticated route; the ERA Steward credential cannot reach them.
//
//   pnpm pm:support pair <CODE>                      one-time (code from `pnpm pm:pair`)
//   pnpm pm:support authorize --run <id> | --request <uuid> --purpose "…" --scope a,b
//        --executor codex|claude --tier CODEX_LOW --effort low --tokens 50000 [--max-jobs 1]
//   pnpm pm:support admit <authorization> <job>      before the job starts
//   pnpm pm:support settle <authorization> <job> --file settlement.json
//   pnpm pm:support close <authorization>
//   pnpm pm:support chat --run <id> [--tokens N] [--usd N] [--note "…"]
//   pnpm pm:support report --run <id> | --request <uuid>
//
// settlement.json: { "usage": { "semantics": "thread-cumulative"|"per-turn",
//   "readings": [{ "turn": 0, "usage": { "input", "cachedInput", "output", "reasoningOutput" } }] },
//   "thread_id", "turn_ids", "observed": { "model", "effort" }, "stop_reason", "cost": { "usd": null } }
// Input/output counters are required for a measured settlement. If unavailable,
// omit usage entirely: the job remains unknown. Other unreported fields stay unknown.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DEFAULT_BASE_URL, createStewardClient, renderAccounting } from "./steward-tools.mjs";

/** `--flag value` pairs and positional arguments. */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    else positional.push(argv[i]);
  }
  return { flags, positional };
}

const subjectOf = (flags) => ({ run_id: flags.run || null, request_id: flags.request || null });

/**
 * Run one command against a paired owner client. Returns { ok, text }; never throws
 * for a refusal, because the refusal is the answer.
 *
 * @param {string[]} argv
 * @param {{request:Function, pair:Function}} client
 * @param {{readFile?:(path:string)=>string, uuid?:()=>string}} [io]
 */
export async function runSupportCommand(argv, client, io = {}) {
  const readFile = io.readFile || ((path) => readFileSync(path, "utf8"));
  const uuid = io.uuid || randomUUID;
  const { flags, positional } = parseArgs(argv.slice(1));
  const post = async (body) => {
    const reply = await client.request("POST", "/api/delivery/v2/support", { body });
    if (reply.status === 401) return { ok: false, text: "Not paired as owner. Run: pnpm pm:pair, then pnpm pm:support pair <CODE>." };
    return { ok: reply.status === 200, reply };
  };
  switch (argv[0]) {
    case "pair": {
      const outcome = await client.pair(positional[0] || "");
      return { ok: outcome.ok, text: outcome.message };
    }
    case "authorize": {
      const command_id = uuid();
      const sent = await post({
        action: "authorize", command_id, subject: subjectOf(flags), purpose: flags.purpose || "",
        scope: String(flags.scope || "").split(",").map((entry) => entry.trim()).filter(Boolean),
        executor: flags.executor, model_tier: flags.tier, effort: flags.effort, allowance_tokens: Number(flags.tokens),
        ...(flags["max-jobs"] ? { max_jobs: Number(flags["max-jobs"]) } : {}),
      });
      if (!sent.reply) return sent;
      return sent.ok ? { ok: true, text: "Authorized. authorization_id=" + command_id + " (one job, " + flags.tokens + " tokens)" } : { ok: false, text: "Refused: " + JSON.stringify(sent.reply.json) };
    }
    case "admit": {
      const sent = await post({ action: "admit", authorization_id: positional[0], job_id: positional[1] });
      if (!sent.reply) return sent;
      return sent.ok ? { ok: true, text: "Admitted job " + positional[1] + ". Start it now." } : { ok: false, text: "Not admitted: " + (sent.reply.json.refusals || []).map((r) => r.code).join(", ") };
    }
    case "settle": {
      let body;
      try {
        body = JSON.parse(readFile(String(flags.file || "")));
      } catch {
        return { ok: false, text: "Give --file with the settlement JSON." };
      }
      const sent = await post({ action: "settle", authorization_id: positional[0], job_id: positional[1], ...body });
      if (!sent.reply) return sent;
      const job = sent.ok ? sent.reply.json.authorization.jobs.find((entry) => entry.job_id === positional[1]) : null;
      return sent.ok ? { ok: true, text: "Recorded job " + positional[1] + ": " + job.state + (job.state === "unknown" ? " (usage not a complete measurement; it blocks the next job)" : "") } : { ok: false, text: "Not recorded: " + JSON.stringify(sent.reply.json) };
    }
    case "close": {
      const sent = await post({ action: "close", authorization_id: positional[0] });
      return sent.reply ? { ok: sent.ok, text: sent.ok ? "Closed." : "Not closed: " + JSON.stringify(sent.reply.json) } : sent;
    }
    case "chat": {
      const sent = await post({
        action: "chat", command_id: uuid(), subject: subjectOf(flags),
        tokens: flags.tokens == null ? null : Number(flags.tokens), usd: flags.usd == null ? null : Number(flags.usd), note: flags.note || null,
      });
      return sent.reply ? { ok: sent.ok, text: sent.ok ? "Chat overhead recorded (owner-entered)." : "Not recorded: " + JSON.stringify(sent.reply.json) } : sent;
    }
    case "report": {
      const query = flags.run ? { run: flags.run } : flags.request ? { request: flags.request } : null;
      if (!query) return { ok: false, text: "Give --run or --request." };
      const reply = await client.request("GET", "/api/delivery/v2/accounting", { query });
      if (reply.status !== 200) return { ok: false, text: "Report unavailable (" + reply.status + ")." };
      const report = reply.json.report;
      const jobs = report.support.authorizations.flatMap((auth) => auth.jobs.map((job) => "  " + auth.authorization_id.slice(0, 8) + " " + job.job_id + " " + job.state + " " + (job.tokens ? job.tokens.total + " tok" : "usage unknown") + " " + (job.cost.usd == null ? "cost unknown" : "$" + job.cost.usd) + " " + (job.observed && job.observed.model ? job.observed.model : "model unreported")));
      return { ok: true, text: renderAccounting(report) + (jobs.length ? "\n" + jobs.join("\n") : "") };
    }
    default:
      return { ok: false, text: "Commands: pair, authorize, admit, settle, close, chat, report." };
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("delivery-v2/support-cli.mjs")) {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const client = createStewardClient({ root, baseUrl: process.env.PM_STEWARD_URL || DEFAULT_BASE_URL, kind: "browser", sessionFile: "owner-session.json" });
  const outcome = await runSupportCommand(process.argv.slice(2), client);
  process.stdout.write(outcome.text + "\n");
  process.exit(outcome.ok ? 0 : 1);
}
