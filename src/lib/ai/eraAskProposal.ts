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
    };

// ─────────────────────── Gemini structured-output schema ───────────────────────

const ASK_AI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  propertyOrdering: ["kind", "text", "reminderTitle", "nfcTagId", "targetState"],
  required: ["kind", "text"],
  properties: {
    kind: {
      type: Type.STRING,
      enum: ["prose", "propose_nfc_reminder"],
      description:
        "prose for a plain answer; propose_nfc_reminder ONLY when the user wants a reminder triggered by an NFC tag reaching a specific state, and a matching tag is listed in context",
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
  },
};

// ───────────────────────────────── prompt ─────────────────────────────────

function buildSystemPrompt(args: {
  face: "budget" | "schedule" | "chef" | "brain";
  budgetContext?: BudgetContext;
  scheduleContext?: ScheduleContext;
  pendingReminderTitle?: string;
}): string {
  const { face, budgetContext, scheduleContext, pendingReminderTitle } = args;

  const contract = [
    "You are ERA, a household assistant. Respond with JSON matching the given schema — never prose outside the JSON.",
    'Default to kind "prose": answer the question directly, in one or two short sentences, spoken-style — no markdown.',
  ];

  if (face === "schedule" && scheduleContext) {
    contract.push(
      "",
      'If — and only if — the user wants a reminder that should fire when an NFC tag reaches a specific state (e.g. "remind me when I get home", "when I leave for work"), respond with kind "propose_nfc_reminder" instead. You MUST pick nfcTagId and targetState EXACTLY from the tags listed below — never invent an id or a state that isn\'t listed. If no listed tag plausibly matches what the user described, use kind "prose" and say so — do not guess.',
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

    if (pendingReminderTitle) {
      contract.push(
        "",
        `The user was already asked for a time for a reminder titled "${pendingReminderTitle}" and instead described a trigger condition. Use that exact title as reminderTitle if you propose a trigger.`,
      );
    }

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

      const parsed = parseAskAIResponse(response.text, args.scheduleContext);
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

  return data;
}
