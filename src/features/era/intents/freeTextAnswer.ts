// src/features/era/intents/freeTextAnswer.ts
// HUB-94 — "When?" and "Where?" accept free text (a date, a place name), so
// an open question could swallow a real new request typed instead ("spent 20
// on lunch" is not a place). Shared by useEraTurn and the ERA Gym so both
// decide the same way.

import type { EraPendingSlot, Intent } from "../types";
import { rootIntentRouter } from "./index";

export const FREE_TEXT_SLOTS: ReadonlySet<EraPendingSlot["capability"]> = new Set(["event.when", "event.location"]);

const NOT_A_REQUEST: ReadonlySet<Intent["kind"]> = new Set(["clarify", "unknown", "greeting", "switchFace"]);

/** True when the text routes to a real intent. A place can echo an implicit page door ("gym"); only an explicit "open …" counts. */
export function isNewRequest(text: string): boolean {
  const next = rootIntentRouter.parse(text);
  if (next.kind === "navigate") return /^\s*(?:open|go\s+to|show|take\s+me\s+to)\b/i.test(text);
  return !NOT_A_REQUEST.has(next.kind);
}
