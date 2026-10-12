// Replay verified Claude Haiku 5.5 interpretations of synthetic sentences.
// Offline only: this file never calls a model (live calls are blocked in every
// Vitest process — src/lib/ai/anthropic.ts). A recording whose prompt changed
// is skipped, not failed, so a stale recording never nudges anyone into a
// paid refresh. Refreshing is an owner-run, owner-approved pass outside the
// test suite (Hard Rule #29); the recorder was removed 2026-10-12.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ASK_AI_RESPONSE_SCHEMA,
  buildSystemPrompt,
  parseAskAIResponse,
} from "@/lib/ai/eraAskProposal";
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
    caps: ["recipe.list"],
    discloses: /trip/i,
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
    caps: ["meal.assign", "recipe.ingredients"],
    discloses: /pantry|shopping/i,
    slots: {
      // dish is a step reference to the recipe lookup, not a literal.
      "meal.assign": { dayHint: /friday/i, mealType: /^dinner$/i },
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
const recordings: Record<string, Recording> = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, "utf8")).entries
  : {};
function hash(request: string) {
  return createHash("sha256")
    .update(JSON.stringify({ system, request, schema: ASK_AI_RESPONSE_SCHEMA }))
    .digest("hex");
}

describe("ERA Agent live-model interpretation replay", () => {
  it.for(cases)("$id: $request", (c, { skip }) => {
    const recording = recordings[c.id];
    if (recording?.hash !== hash(c.request))
      skip("No current recording (prompt changed); owner-approved refresh only");
    expect(recording.model, "Evidence must come from Haiku 5.5").toMatch(
      new RegExp(`^${RECORD_MODEL}`),
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
