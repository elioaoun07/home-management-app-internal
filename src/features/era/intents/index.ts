// Root intent router — delegates to per-face routers, falls back to global detection.
import { entityFace, getCapability } from "../capabilities/registry";
import type { FocusEntityType } from "../focusMemory";
import { resolveEntityRef } from "../focusMemory";
import { matchTemplates } from "../templates/matcher";
import type { FaceKey, Intent, IntentRouter } from "../types";
import { useEraStore } from "../useEraStore";
import { brainRouter } from "./brain";
import { budgetRouter } from "./budget";
import { chefRouter } from "./chef";
import type { FaceIntentRouter } from "./schedule";
import { scheduleRouter } from "./schedule";
import { explicitNavTarget, implicitNavTarget } from "../reach";
import { classifySpeechAct } from "./speechAct";
import { isFollowUp, parseEdits } from "./followUp";
import { mostRecentEntity, type FocusEntityType as FET } from "../focusMemory";

const FACE_OF: Record<FET, FaceKey> = { reminder: "schedule", shopping: "chef", draft: "budget", transfer_card: "budget" };

export type { FaceIntentRouter };

const FACE_KEYS: FaceKey[] = ["budget", "schedule", "chef", "brain"];

export const FACE_ROUTERS: Record<FaceKey, FaceIntentRouter> = {
  budget: budgetRouter,
  schedule: scheduleRouter,
  chef: chefRouter,
  brain: brainRouter,
};

/** Explicit face-switch keywords — checked before per-face routing. */
const FACE_SWITCH_KEYWORDS: Array<{ face: FaceKey; words: string[] }> = [
  {
    face: "budget",
    words: ["open budget", "go to budget", "switch to budget", "budget face"],
  },
  {
    face: "schedule",
    words: [
      "open schedule",
      "go to schedule",
      "switch to schedule",
      "schedule face",
    ],
  },
  {
    face: "chef",
    words: [
      "open chef",
      "go to chef",
      "switch to chef",
      "chef face",
      "open kitchen",
      "cooking mode",
    ],
  },
  {
    face: "brain",
    words: [
      "open brain",
      "go to brain",
      "switch to brain",
      "brain face",
      "memory mode",
      "open memory",
    ],
  },
];

export function detectFaceSwitch(text: string): FaceKey | null {
  const lo = text.toLowerCase();
  for (const { face, words } of FACE_SWITCH_KEYWORDS) {
    if (words.some((w) => lo.includes(w))) return face;
  }
  return null;
}

/** Patterns that match standalone greetings (no additional content after). */
const GREETING_RE = [
  /^(hello|hi+|hey+|howdy|sup|yo)(?:\s+(?:era|there|yeah|again|you))?[\s!.,?]*$/i,
  /^(?:good\s*bye|bye|goodnight|thanks?(?:\s+you)?|thank\s+you)(?:\s+era)?[\s!.,?]*$/i,
  /^good\s+(morning|afternoon|evening|day|night)[\s!.,?]*$/i,
  /^(what'?s?\s*up|how\s+are\s+you)[\s!.,?]*$/i,
  /^(greetings|hola|ciao|bonjour|salut)[\s!.,?]*$/i,
];

function isGreeting(text: string): boolean {
  return GREETING_RE.some((re) => re.test(text.trim()));
}

/**
 * Layer 2 (Stage 4, HUB-30) — deterministic taught-phrase matching, tried
 * ONLY after every built-in router (Layer 1) has failed to produce a
 * confident intent. `useEraStore().templates` is a synchronous mirror of the
 * user's era_templates rows (see templates/useEraTemplates.ts) so this stays
 * as latency-free as the rest of the router.
 *
 * A matched template's `itemId`-shaped slot is NEVER trusted from the
 * captured text — any capability with an `entityRefSlot` gets it resolved
 * fresh from focus memory here, the same "never guess when ambiguous" rule
 * Ask AI's proposal validation uses (see eraAskProposal.ts). If resolution
 * fails, this returns `null` and the router falls through to its normal
 * unknown/clarify fallback — never a dead end.
 *
 * HUB-34 — the reference used to resolve that entity is now whatever the
 * template actually captured (`{target}` on a template taught after this
 * fix, `{title}` on one taught before it, or the literal "it" when neither
 * was captured), matched by NAME against focus memory (`resolveEntityRef`)
 * rather than always grabbing the most recently touched entity regardless
 * of what the template named — see focusMemory.ts's doc comment for the bug
 * this replaces.
 */
function matchAgainstTemplates(text: string): Intent | null {
  const { templates, focusEntities } = useEraStore.getState();
  if (templates.length === 0) return null;

  const match = matchTemplates(text, templates);
  if (!match) return null;

  const capability = getCapability(match.template.capabilityId);
  if (!capability) return null; // stale template referencing a removed capability

  const slots: Record<string, unknown> = { ...match.slots };
  if (capability.entityRefSlot) {
    const ref =
      typeof slots.target === "string"
        ? slots.target
        : typeof slots.title === "string"
          ? slots.title
          : "it";
    delete slots.target; // matcher-level concept — never a capability's own Zod slot

    const focus = resolveEntityRef(
      ref,
      capability.entity as FocusEntityType,
      focusEntities,
    );
    if (!focus) return null; // couldn't resolve the reference — let the normal fallback ask instead of guessing
    slots[capability.entityRefSlot] = focus.id;
    slots.title = focus.title;
  }

  return {
    kind: "capabilityAction",
    face: entityFace(capability.entity),
    capabilityId: capability.id,
    slots,
    rawText: text,
    sourceTemplateId: match.template.id,
  };
}

/** Money writes get the strict speech-act test (mid-sentence "if", quotes). */
const MONEY_WRITES: ReadonlySet<Intent["kind"]> = new Set([
  "draftTransaction",
  "transfer",
  "recordDebt",
  "confirmDraft",
]);

const OTHER_WRITES: ReadonlySet<Intent["kind"]> = new Set([
  "draftReminder",
  "reminderReschedule",
  "reminderComplete",
  "reminderDelete",
  "reminderSkip",
  "addShopping",
  "addContact",
  "addPlace",
  "draftEvent",
  "defineAlias",
  "amendLast",
  "assignMeal",
  "memorySave",
]);

function isWrite(intent: Intent): boolean {
  if (MONEY_WRITES.has(intent.kind) || OTHER_WRITES.has(intent.kind))
    return true;
  if (intent.kind === "capabilityAction") {
    return getCapability(intent.capabilityId)?.operation !== "read";
  }
  return false;
}

/**
 * HUB-76 — speech-act gate. Runs on the FINAL routed intent: a write that
 * came from a negated, hypothetical, questioned, conditional or reported
 * sentence becomes a `clarify` that fires nothing. Reads pass untouched
 * ("what did I spend this month?" is a question AND a read).
 */
function gateSpeechAct(intent: Intent, text: string): Intent {
  if (!isWrite(intent)) return intent;
  const act = classifySpeechAct(text, {
    strict: MONEY_WRITES.has(intent.kind),
  });
  if (act === "command") return intent;
  return {
    kind: "clarify",
    reason: "speechAct",
    act,
    blocked: intent.kind,
    rawText: text,
  };
}

function routeIntent(text: string): Intent {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "unknown", rawText: text };

  // 0) Greeting — short standalone salutation, no actionable content
  if (isGreeting(trimmed)) return { kind: "greeting", rawText: text };

  // HUB-80 — "forget that": revoke the rule the last turn applied.
  if (/^\s*(?:forget|undo)\s+(?:that|this)\s+(?:default|rule|preference)?\s*[.!]*$|^\s*forget\s+that\s*[.!]*$|^\s*stop\s+(?:doing|defaulting)\s+that\b/i.test(trimmed)) {
    return { kind: "forgetRule", rawText: text };
  }

  // HUB-80 — "the box means Drawer", "call Drawer the box".
  const aliasMatch =
    trimmed.match(/^\s*["“]?(.{2,40}?)["”]?\s+means\s+(?:the\s+|my\s+)?(.{2,40}?)[.!]*$/i) ??
    (() => {
      const m = trimmed.match(/^\s*call\s+(?:the\s+|my\s+)?(.{2,40}?)\s+["“](.{2,40}?)["”][.!]*$/i);
      return m ? ([m[0], m[2], m[1]] as unknown as RegExpMatchArray) : null;
    })();
  if (aliasMatch) {
    return { kind: "defineAlias", face: "budget", phrase: aliasMatch[1].trim(), target: aliasMatch[2].trim(), rawText: text };
  }

  // HUB-79 (owner export) — "what time is it now".
  if (/^\s*what(?:'s|\s+is)?\s+(?:the\s+)?time(?:\s+is\s+it)?(?:\s+now)?\s*\??\s*$/i.test(trimmed)) {
    return { kind: "timeNow", rawText: text };
  }

  // 1) Explicit face-switch commands always win
  const switchFace = detectFaceSwitch(trimmed);
  if (switchFace)
    return { kind: "switchFace", face: switchFace, rawText: text };

  // HUB-81 — household activity: "what changed today", "what did Racha do".
  if (/\b(?:what(?:'s)?\s+(?:changed|happened|new)|recent\s+activity|activity\s+(?:today|log)|what\s+did\s+(?:my\s+)?(?:partner|wife|husband|\w+)\s+(?:do|change|add))\b/i.test(trimmed)
      && !/\b(?:spend|spent|pay|paid|cost)\b/i.test(trimmed)) {
    const partner = /\bwhat\s+did\s+(?!i\b)/i.test(trimmed) || /\b(?:partner|wife|husband)\b/i.test(trimmed);
    return {
      kind: "activityRead",
      face: "brain",
      actor: partner ? "partner" : undefined,
      window: /\btoday\b/i.test(trimmed) ? "today" : "recent",
      rawText: text,
    };
  }

  // HUB-81 — "open trips", "go to outfits": an explicit page request.
  const explicitNav = explicitNavTarget(trimmed);
  if (explicitNav?.route) {
    return { kind: "navigate", to: explicitNav.route, label: explicitNav.label, module: explicitNav.module, rawText: text };
  }

  // HUB-84 — an edit that NAMES the item: "move salt under Spinneys group",
  // "put the salt in the Spinneys group". Only with "under" or "… group"
  // (so "move the dentist to Friday" stays a reschedule).
  const namedEdit =
    trimmed.match(/^\s*(?:please\s+)?(?:move|put|place|file|shift)\s+(?:the\s+|my\s+)?(.+?)\s+under\s+(?:the\s+)?[\w' -]{1,30}?(?:\s+(?:group|list|section))?[.!]*$/i) ??
    trimmed.match(/^\s*(?:please\s+)?(?:move|put|place|file|shift)\s+(?:the\s+|my\s+)?(.+?)\s+(?:in|into|to)\s+(?:the\s+)?[\w' -]{1,30}?\s+group[.!]*$/i);
  if (namedEdit && !/^(?:it|that|this|them|those)$/i.test(namedEdit[1].trim()) && !/[$€£]|\d/.test(namedEdit[1])) {
    return { kind: "amendLast", face: "chef", focusId: null, focusType: "shopping", targetHint: namedEdit[1].trim(), rawText: text };
  }

  // HUB-84 — a follow-up edits the LAST result, whatever its type: the
  // referent decides the meaning, not the verb ("make it …" is not always a
  // reschedule). A reminder referent keeps the schedule router's own path.
  if (isFollowUp(trimmed)) {
    const last = mostRecentEntity(useEraStore.getState().focusEntities);
    const edits = parseEdits(trimmed);
    if (last && (last.type !== "reminder" || edits.group || edits.name)) {
      return { kind: "amendLast", face: FACE_OF[last.type], focusId: last.id, focusType: last.type, rawText: text };
    }
    if (!last && (edits.group || edits.name)) {
      return { kind: "amendLast", face: useEraStore.getState().activeFaceKey, focusId: null, focusType: null, rawText: text };
    }
  }

  // 2) Active face router gets first crack. Its own weak "clarify" fallback
  //    does NOT win outright — a face with no confident domain match should
  //    not block a genuinely strong match on another face (e.g. "remind me
  //    to buy dinner ingredients" while Budget is active: budget has no
  //    real hit, schedule's slot-filled draftReminder should win).
  const active = useEraStore.getState().activeFaceKey;
  const activeHit = FACE_ROUTERS[active].parse(trimmed, {
    activeFaceKey: active,
  });
  if (activeHit && activeHit.kind !== "clarify") return activeHit;

  // 3) Cross-face fallback, tiered by confidence. A fully slot-filled
  //    intent (draftReminder, recipeSearch, monthSpend, …) is a confident
  //    signal; a bare `switchFace` from a face's generic keyword sniff is
  //    not. A confident hit from one face should not tie with a generic
  //    keyword echo from another — only hits within the same tier can be
  //    genuinely ambiguous. Exactly one hit in the higher tier present →
  //    use it; more than one → ask the user to clarify.
  const strongHits: Intent[] = [];
  const weakHits: Intent[] = [];
  for (const k of FACE_KEYS) {
    if (k === active) continue;
    const hit = FACE_ROUTERS[k].parse(trimmed, { activeFaceKey: active });
    if (!hit) continue;
    (hit.kind === "switchFace" ? weakHits : strongHits).push(hit);
  }
  if (strongHits.length === 1) return strongHits[0];
  if (strongHits.length > 1)
    return { kind: "clarify", reason: "ambiguous", rawText: text };

  // Layer 2 — no built-in router produced a confident (strong) hit. Try a
  // taught phrase BEFORE falling back to a weak clarify/switchFace guess —
  // a taught phrase is a confident, user-authored signal and should beat a
  // face's generic keyword echo. (Previously this ran only after the weak
  // fallbacks below, which meant the active face's own weak "clarify" could
  // shadow a taught template every time — see HUB-30 follow-up.)
  const templateHit = matchAgainstTemplates(trimmed);
  if (templateHit) return templateHit;

  // No confident cross-face hit and no taught phrase — fall back to the
  // active face's own weak clarify (if any), then to a single unambiguous
  // generic face switch.
  // HUB-81 — implicit doors ("what should I wear" → Outfits) only after
  // every router and taught phrase missed; never over a real intent.
  const implicitNav = implicitNavTarget(trimmed);
  if (implicitNav?.route && (!activeHit || activeHit.kind === "clarify")) {
    return { kind: "navigate", to: implicitNav.route, label: implicitNav.label, module: implicitNav.module, rawText: text };
  }

  if (activeHit) return activeHit;
  if (weakHits.length === 1) return weakHits[0];
  if (weakHits.length > 1)
    return { kind: "clarify", reason: "ambiguous", rawText: text };

  return { kind: "unknown", rawText: text };
}

export const rootIntentRouter: IntentRouter = {
  parse(text: string): Intent {
    return gateSpeechAct(routeIntent(text), text.trim());
  },
};
