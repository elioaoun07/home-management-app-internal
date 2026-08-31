// src/lib/ai/eraAskProposal.ts
//
// ERA "Ask AI" (Slice 4) — the manual escape hatch for when the deterministic
// router can't handle a request ("remind me when I arrive home" has no date
// for parseSmartText to find). Same three-layer safety pattern as
// `analysisReport.ts`:
//   (a) Gemini structured output via a strict responseSchema,
//   (b) Zod validation that DROPS an invalid proposal rather than trusting it,
//   (c) a deterministic prose fallback when the model is unavailable or its
//       proposal doesn't check out against real data.
//
// The one proposal kind this ships (`propose_nfc_reminder`) exists because
// it's the owner's own worked example, not because a general proposal
// framework was designed ahead of a second use case — widen this only when a
// second kind is actually needed (Design Doctrine: don't build for
// hypothetical requirements).
//
// Doctrine Q10 (Trust): the model never writes. It proposes; `useEraAskAI`
// renders the proposal as a confirm card; only a tap performs the real
// writes (POST /api/items, POST /api/items/[id]/prerequisites).

import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { ERA_CAPABILITIES, getCapability } from "@/features/era/capabilities/registry";
import type { FocusEntity, FocusEntityType } from "@/features/era/focusMemory";
import { resolveFocusRef } from "@/features/era/focusMemory";
import type { BudgetContext, ChatMessage } from "./gemini";
import { generateContentWithFallback, generateSystemPrompt } from "./gemini";
import type { ScheduleContext } from "./context";

// ───────────────────────────── Zod schema (validation) ─────────────────────────────

const AskAIResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("prose"),
    text: z.string().min(1),
  }),
  z.object({
    kind: z.literal("propose_nfc_reminder"),
    text: z.string().min(1),
    reminderTitle: z.string().min(1),
    nfcTagId: z.string().min(1),
    targetState: z.string().min(1),
  }),
  // Stage 3 (HUB-29) — a controlled action against the capability registry.
  // `slotsJson` is a JSON-ENCODED string, not a nested object: Gemini's
  // structured-output schema needs a fixed shape per kind, and each
  // capability's slots differ, so the model emits a string we parse and
  // validate ourselves (same pattern this file already used for the top-
  // level response). Never trusted as-is — see parseAskAIResponse.
  z.object({
    kind: z.literal("propose_action"),
    text: z.string().min(1),
    capabilityId: z.string().min(1),
    slotsJson: z.string().min(1),
  }),
]);

export type AskAIResponse = z.infer<typeof AskAIResponseSchema>;

/** What callers actually get back — a validated proposal is enriched with
 *  the tag's display label so the client never needs a second fetch. */
export type AskAIResult =
  | { kind: "prose"; text: string }
  | {
      kind: "propose_nfc_reminder";
      text: string;
      reminderTitle: string;
      nfcTagId: string;
      nfcTagLabel: string;
      targetState: string;
    }
  | {
      kind: "propose_action";
      text: string;
      capabilityId: string;
      /** Final, VALIDATED slots — any entity reference already resolved to a real id. */
      slots: Record<string, unknown>;
    };

// ─────────────────────── Gemini structured-output schema ───────────────────────

const ASK_AI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  propertyOrdering: [
    "kind",
    "text",
    "reminderTitle",
    "nfcTagId",
    "targetState",
    "capabilityId",
    "slotsJson",
  ],
  required: ["kind", "text"],
  properties: {
    kind: {
      type: Type.STRING,
      enum: ["prose", "propose_nfc_reminder", "propose_action"],
      description:
        "prose for a plain answer; propose_nfc_reminder ONLY for a reminder triggered by an NFC tag reaching a specific state (a matching tag must be listed in context); propose_action for any OTHER action against one of the listed capabilities (create/reschedule/complete/delete a reminder, look up a day's schedule)",
    },
    text: {
      type: Type.STRING,
      description:
        "What ERA says. For a proposal, a short spoken-style summary of what you're suggesting, e.g. \"Set that up to trigger when you tap Front Door to Arriving?\"",
    },
    reminderTitle: {
      type: Type.STRING,
      description: "propose_nfc_reminder only — the reminder's title, cleaned (no 'remind me to')",
    },
    nfcTagId: {
      type: Type.STRING,
      description:
        "propose_nfc_reminder only — MUST be copied exactly from one of the tag ids given in context. Never invent one.",
    },
    targetState: {
      type: Type.STRING,
      description:
        "propose_nfc_reminder only — MUST be one of that exact tag's declared states, copied exactly.",
    },
    capabilityId: {
      type: Type.STRING,
      description:
        "propose_action only — MUST be copied EXACTLY from one of the capability ids listed in context. Never invent one.",
    },
    slotsJson: {
      type: Type.STRING,
      description:
        "propose_action only — a JSON OBJECT ENCODED AS A STRING, e.g. '{\"whenText\":\"tomorrow at 5\"}', using exactly the slot names given for that capability in context. For a slot that identifies a SPECIFIC existing reminder (itemId), use the literal string \"FOCUS\" if the user referred to it by pronoun (it/that/this) and a current focus reminder is given in context — never invent a real id.",
    },
  },
};

// ───────────────────────────────── prompt ─────────────────────────────────

/** Capability catalog description for the prompt — built from the registry itself, never hand-duplicated. */
function describeCapabilities(): string {
  return Object.values(ERA_CAPABILITIES)
    .map((c) => `- ${c.id} (${c.operation}) — slots: ${c.promptSlots}`)
    .join("\n");
}

function buildSystemPrompt(args: {
  face: "budget" | "schedule" | "chef" | "brain";
  budgetContext?: BudgetContext;
  scheduleContext?: ScheduleContext;
  pendingReminderTitle?: string;
  focusEntity?: FocusEntity | null;
}): string {
  const { face, budgetContext, scheduleContext, pendingReminderTitle, focusEntity } = args;

  const contract = [
    "You are ERA, a household assistant. Respond with JSON matching the given schema — never prose outside the JSON.",
    'Default to kind "prose": answer the question directly, in one or two short sentences, spoken-style — no markdown.',
  ];

  // A3 — the capability catalog (propose_action) is available on EVERY face,
  // not just Schedule. This used to live inside the `face === "schedule"`
  // branch below, so Ask AI on budget/chef/brain could only ever answer
  // prose — nothing on those faces could be proposed, confirmed, or learned
  // as a taught template (Stage 4, HUB-30 only fires after a successful
  // propose_action). The registry itself still gates what's actually
  // offered — see capabilities/registry.ts; today that's reminder/schedule
  // capabilities regardless of which face is active.
  contract.push(
    "",
    'If the user wants an action ERA can already do — create/reschedule/complete/delete a reminder, or look up a day\'s schedule — respond with kind "propose_action". You MUST pick capabilityId EXACTLY from the list below; if nothing matches, use kind "prose" instead of guessing.',
    "",
    "Available capabilities (id | operation | slots):",
    describeCapabilities(),
    "",
    focusEntity
      ? `Current focus reminder: "${focusEntity.title}" — if the user refers to it by pronoun (it/that/this), use the literal string "FOCUS" for that capability's entity-identifying slot (e.g. itemId). Never invent a real id.`
      : "No current focus reminder — if a capability needs an entity-identifying slot (itemId) and the user only used a pronoun with nothing recent to resolve it against, use kind \"prose\" and ask them to name the reminder instead of guessing.",
  );

  if (pendingReminderTitle) {
    contract.push(
      "",
      `The user was already asked for a time for a reminder titled "${pendingReminderTitle}" and instead described a trigger condition. Use that exact title as reminderTitle if you propose a trigger, or as the title slot if you propose reminder.create.`,
    );
  }

  if (face === "schedule" && scheduleContext) {
    contract.push(
      "",
      'If — and only if — the user wants a reminder that should fire when an NFC tag reaches a specific state (e.g. "remind me when I get home", "when I leave for work"), respond with kind "propose_nfc_reminder" instead of propose_action. You MUST pick nfcTagId and targetState EXACTLY from the tags listed below — never invent an id or a state that isn\'t listed. If no listed tag plausibly matches what the user described, use kind "prose" and say so — do not guess.',
      "",
      "Available NFC tags (id | label | states | current state):",
      scheduleContext.nfcTags.length
        ? scheduleContext.nfcTags
            .map(
              (t) =>
                `- ${t.id} | ${t.label} | [${t.states.join(", ")}] | currently: ${t.currentState ?? "unknown"}`,
            )
            .join("\n")
        : "(none configured)",
    );

    if (scheduleContext.upcoming.length > 0) {
      contract.push(
        "",
        "Upcoming items (for context only, not something to modify):",
        scheduleContext.upcoming
          .slice(0, 10)
          .map((i) => `- ${i.title}${i.dueAt ? ` (due ${i.dueAt})` : " (undated)"}`)
          .join("\n"),
      );
    }
  }

  if (face === "budget" && budgetContext) {
    contract.push("", generateSystemPrompt(budgetContext));
  }

  return contract.join("\n");
}

// ─────────────────────────────── entry point ───────────────────────────────

export async function generateAskAIResponse(args: {
  message: string;
  history?: ChatMessage[];
  face: "budget" | "schedule" | "chef" | "brain";
  budgetContext?: BudgetContext;
  scheduleContext?: ScheduleContext;
  pendingReminderTitle?: string;
  /** The single most recent focus reminder (client-sent — focus memory lives in browser state, see useEraStore). Undefined/null = none. */
  focusEntity?: FocusEntity | null;
}): Promise<AskAIResult> {
  const { message, history = [] } = args;

  if (process.env.GEMINI_API_KEY) {
    try {
      const systemPrompt = buildSystemPrompt(args);
      const contents = [
        ...history.slice(-8).map((m) => ({
          role: (m.role === "user" ? "user" : "model") as "user" | "model",
          parts: [{ text: m.content }],
        })),
        { role: "user" as const, parts: [{ text: message }] },
      ];

      const response = await generateContentWithFallback({
        contents,
        systemInstruction: systemPrompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: ASK_AI_RESPONSE_SCHEMA,
        },
      });

      const parsed = parseAskAIResponse(response.text, args.scheduleContext, args.focusEntity);
      if (parsed) return parsed;
    } catch {
      // Rate limit, network, bad JSON — fall through to the deterministic reply below.
    }
  }

  return {
    kind: "prose",
    text: "I couldn't reach the AI just now. Try again in a moment, or use the app directly.",
  };
}

/**
 * Parse + validate the model's JSON. A `propose_nfc_reminder` is only ever
 * returned to the caller when its `nfcTagId`/`targetState` match a REAL tag
 * in `scheduleContext` — the model's identifiers are never trusted blindly.
 * Anything that doesn't check out degrades to the proposal's own `text` as
 * plain prose, never to a write. A proposal that DOES check out is enriched
 * with the tag's display label here (the model is never asked for it).
 */
export function parseAskAIResponse(
  text: string | undefined,
  scheduleContext?: ScheduleContext,
  focusEntity?: FocusEntity | null,
): AskAIResult | null {
  if (!text) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }

  const result = AskAIResponseSchema.safeParse(raw);
  if (!result.success) return null;
  const data = result.data;

  if (data.kind === "propose_nfc_reminder") {
    const tag = scheduleContext?.nfcTags.find((t) => t.id === data.nfcTagId);
    if (!tag || !tag.states.includes(data.targetState)) {
      return { kind: "prose", text: data.text };
    }
    return { ...data, nfcTagLabel: tag.label };
  }

  if (data.kind === "propose_action") {
    return validateProposeActionResponse(data, focusEntity);
  }

  return data;
}

/**
 * Stage 3 (HUB-29) safety gate — the actual point where a model-proposed
 * action either becomes something a confirm tap can execute, or degrades to
 * prose. Every check here is "never trust the model" applied one more time:
 *   1. capabilityId must name a REAL entry in the registry.
 *   2. slotsJson must be valid JSON.
 *   3. any entity-identifying slot (itemId) must be the literal "FOCUS"
 *      sentinel, never a raw value the model invented — and it must resolve
 *      to a REAL live focus entity via the same resolveFocusRef the native
 *      router uses. A destructive capability (reminder.delete) is no
 *      exception: it gets no separate check because it already can't reach
 *      here without a real resolved entity, same as any other update.
 *   4. the final slots object must pass the capability's own Zod schema.
 * Any failure degrades to `{ kind: "prose", text: data.text }` — never a
 * partial or best-effort execution.
 */
function validateProposeActionResponse(
  data: { kind: "propose_action"; text: string; capabilityId: string; slotsJson: string },
  focusEntity?: FocusEntity | null,
): AskAIResult {
  const fallback: AskAIResult = { kind: "prose", text: data.text };

  const capability = getCapability(data.capabilityId);
  if (!capability) return fallback;

  let slots: unknown;
  try {
    slots = JSON.parse(data.slotsJson);
  } catch {
    return fallback;
  }
  if (typeof slots !== "object" || slots === null || Array.isArray(slots)) return fallback;

  const slotsObj: Record<string, unknown> = { ...(slots as Record<string, unknown>) };

  if (capability.entityRefSlot) {
    if (slotsObj[capability.entityRefSlot] !== "FOCUS") return fallback; // never trust a raw model-supplied id
    const resolved = resolveFocusRef(
      "it",
      capability.entity as FocusEntityType,
      focusEntity ? [focusEntity] : [],
    );
    if (!resolved) return fallback;
    slotsObj[capability.entityRefSlot] = resolved.id;
    slotsObj.title = resolved.title;
  }

  const parsed = capability.slots.safeParse(slotsObj);
  if (!parsed.success) return fallback;

  return { kind: "propose_action", text: data.text, capabilityId: capability.id, slots: parsed.data as Record<string, unknown> };
}
