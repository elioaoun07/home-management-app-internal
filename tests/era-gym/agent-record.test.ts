// Replay verified model interpretations in CI. Opt-in refresh sends synthetic
// sentences only to Claude; it never connects to Supabase or executes a write.
// Refresh is one owner-approved pass (Hard Rule #29): stale cases only, one
// call each, 30 s apart, no retries, stop on first error, lock file first.
// PowerShell: $env:ERA_AGENT_RECORD='1'; pnpm vitest run tests/era-gym/agent-record.test.ts
// Delete .tmp/era-agent-record.lock only when the owner approves another pass.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
if (process.env.ERA_AGENT_RECORD === "1")
  (await import("dotenv")).config({ quiet: true });
// The app reads its model choice at module load; load env first, exactly
// as Next does, so the recording exercises the production call.
const { buildSystemPrompt, ASK_AI_RESPONSE_SCHEMA, parseAskAIResponse } =
  await import("@/lib/ai/eraAskProposal");
const { generateClaudeJson, claudeModel } = await import("@/lib/ai/anthropic");
// HUB-107: the evidence must come from Haiku 5.5, nothing else.
const RECORD_MODEL = "claude-haiku-5-5";

type Case = {
  id: string;
  request: string;
  caps: string[];
  /** The text must name the part that cannot be done. */
  discloses?: RegExp;
  /** Expected slot values per capability (validated slots, not raw JSON). */
  slots?: Record<string, Record<string, RegExp>>;
};
/** Model prose must never present a pending write as completed. */
const COMPLETION_CLAIM =
  /(I've|I have|has been|have been|already)[^.?!]*(added|saved|planned|scheduled|assigned)/i;
const cases: Case[] = [
  {
    id: "application-awareness",
    request: "Show what ERA can do in Trips and list my saved recipes",
    caps: ["app.capabilities", "recipe.list"],
  },
  {
    id: "memory-copy",
    request: "Recall guest WiFi then save a copy as Visitor WiFi",
    caps: ["memory.recall", "memory.save"],
  },
  // Partial requests (owner contract, 2026-10-11): an unsupported part that is
  // independent of the rest is disclosed in text while the supported part is
  // proposed for Confirm; nothing may claim to be done already.
  {
    id: "unsupported-module-write",
    request: "Activate my Paris trip and add milk to shopping",
    caps: ["shopping.add"],
    discloses: /trip/i,
  },
  {
    id: "unsupported-stock-subtraction",
    request: "Plan Orange Chicken for Friday dinner and add only the ingredients missing from my pantry to shopping",
    caps: ["meal.assign"],
    discloses: /pantry|shopping/i,
    slots: {
      "meal.assign": { dish: /orange chicken/i, dayHint: /friday/i, mealType: /^dinner$/i },
    },
  },
  // Conditional on pantry state, which ERA cannot read: no action at all.
  {
    id: "conditional-pantry",
    request: "Plan Orange Chicken for Friday dinner only if I have all the ingredients",
    caps: [],
  },
  {
    id: "shopping-paraphrase",
    request: "Could you pop milk and eggs onto the grocery list?",
    caps: ["shopping.add"],
  },
  {
    id: "recipe-meal-shopping",
    request:
      "Plan Orange Chicken for Friday dinner and add its ingredients to the shopping list",
    caps: ["recipe.ingredients", "meal.assign", "shopping.add"],
  },
  {
    id: "named-reminder",
    request: "Find my dentist reminder then move it to Friday at 5pm",
    caps: ["reminder.find", "reminder.reschedule"],
  },
  {
    id: "shopping-reminder",
    request: "Add milk to shopping and remind me to collect it tomorrow at 5pm",
    caps: ["shopping.add", "reminder.create"],
  },
  {
    id: "two-reads",
    request: "Show my saved recipes and list what's on the shopping list",
    caps: ["recipe.list", "shopping.list"],
  },
  {
    id: "recipe-shopping-implicit",
    request: "Put the ingredients for Orange Chicken on my shopping list",
    caps: ["recipe.ingredients", "shopping.add"],
  },
  {
    id: "negation",
    request: "Don't add milk to shopping and don't create a reminder",
    caps: [],
  },
  {
    id: "unsupported",
    request: "Book two flights to Paris and pay for them",
    caps: [],
  },
];
const file = path.join(__dirname, "recordings", "agent-responses.json");
const lock = path.join(process.cwd(), ".tmp", "era-agent-record.lock");
const system = buildSystemPrompt({ face: "chef", localDate: "2026-10-10" });
type Recording = {
  raw: string;
  hash: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason?: string | null;
  ms: number;
};
let recordings: Record<string, Recording> = {};
function hash(request: string) {
  return createHash("sha256")
    .update(JSON.stringify({ system, request, schema: ASK_AI_RESPONSE_SCHEMA }))
    .digest("hex");
}

beforeAll(async () => {
  if (fs.existsSync(file))
    recordings = JSON.parse(fs.readFileSync(file, "utf8")).entries;
  if (process.env.ERA_AGENT_RECORD !== "1") return;
  if (!process.env.ANTHROPIC_API_KEY)
    throw new Error("ANTHROPIC_API_KEY is not configured");
  if (claudeModel !== RECORD_MODEL)
    throw new Error(`Refusing to record on ${claudeModel}; expected ${RECORD_MODEL}`);
  const stale = cases.filter((c) => recordings[c.id]?.hash !== hash(c.request));
  if (!stale.length) return;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(
    lock,
    `${new Date().toISOString()} ${stale.length} calls\n`,
    { flag: "wx" },
  );
  for (const [i, c] of stale.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 30_000));
    const start = performance.now();
    const response = await generateClaudeJson({
      system,
      messages: [{ role: "user", content: c.request }],
      schema: ASK_AI_RESPONSE_SCHEMA,
      maxRetries: 0,
    });
    if (!response.model.startsWith(RECORD_MODEL))
      throw new Error(`Served by ${response.model}, not ${RECORD_MODEL}; stopping`);
    recordings[c.id] = {
      raw: response.text,
      hash: hash(c.request),
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      stopReason: response.stopReason,
      ms: Math.round(performance.now() - start),
    };
    fs.writeFileSync(
      file,
      `${JSON.stringify({ recordedAt: new Date().toISOString(), entries: recordings }, null, 2)}\n`,
    );
    process.stdout.write(`Recorded ${c.id} (${recordings[c.id].ms} ms)\n`);
  }
}, cases.length * 75_000);

describe("ERA Agent live-model interpretation replay", () => {
  it.each(cases)("$id: $request", (c) => {
    const recording = recordings[c.id];
    expect(recording, "Refresh with ERA_AGENT_RECORD=1").toBeDefined();
    expect(recording.model, "Evidence must come from Haiku 5.5").toMatch(
      new RegExp(`^${RECORD_MODEL}`),
    );
    expect(recording.hash, "Prompt changed: refresh the model evidence").toBe(
      hash(c.request),
    );
    const response = parseAskAIResponse(
      recording.raw,
      undefined,
      undefined,
      c.request,
    );
    expect(response).not.toBeNull();
    const actual =
      response?.kind === "propose_plan"
        ? response.plan.steps.map((s) => s.capabilityId)
        : response?.kind === "propose_action"
          ? [response.capabilityId]
          : [];
    expect([...actual].sort()).toEqual([...c.caps].sort());
    if (c.discloses) {
      expect(response?.text).toMatch(c.discloses);
      expect(response?.text).not.toMatch(COMPLETION_CLAIM);
    }
    const proposed =
      response?.kind === "propose_plan"
        ? response.plan.steps.map((s) => ({ id: s.capabilityId, slots: s.slots }))
        : response?.kind === "propose_action"
          ? [{ id: response.capabilityId, slots: response.slots }]
          : [];
    for (const [capId, want] of Object.entries(c.slots ?? {})) {
      const got = proposed.find((p) => p.id === capId)?.slots ?? {};
      for (const [slot, pattern] of Object.entries(want))
        expect(String(got[slot] ?? ""), `${capId}.${slot}`).toMatch(pattern);
    }
  });
});
