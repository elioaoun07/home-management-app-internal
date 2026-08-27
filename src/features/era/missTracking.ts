// src/features/era/missTracking.ts
// ERA Stage 2 (HUB-28) — classify a router miss (`clarify`/`unknown`) as
// either a "language gap" (a capability for this exists; the phrasing just
// didn't parse — feeds Stage 4's template learning once Ask AI resolves it)
// or a "capability gap" (nothing in the registry covers this at all — a real
// build-queue candidate, not a phrasing problem).
//
// Deliberately reuses `era_messages.intent_kind` as the miss signal itself
// (the assistant reply for a `clarify`/`unknown` turn already persists that
// value) rather than a new table — this module only adds the classification
// that turn's `intent_payload` carries alongside it. No migration needed.
//
// The classification is a cheap, deterministic heuristic (vocabulary
// matching, not an AI call) — it's a hint for later analysis and for
// choosing whether Ask AI is likely to help, not a guarantee. Ask AI's own
// capability-id validation (Stage 3) is the real authority on whether a
// request maps to something ERA can do.

import type { EraEntityType } from "./capabilities/types";
import { classifyMissEntity } from "./capabilities/vocab";

export type MissKind = "language-gap" | "capability-gap";

export interface MissClassification {
  missKind: MissKind;
  /** Which entity's vocabulary matched, when missKind is "language-gap". */
  matchedEntity: EraEntityType | null;
}

export function classifyMiss(
  rawText: string,
  learnedVocab?: Partial<Record<EraEntityType, ReadonlySet<string>>>,
): MissClassification {
  const matchedEntity = classifyMissEntity(rawText, learnedVocab);
  return {
    missKind: matchedEntity ? "language-gap" : "capability-gap",
    matchedEntity,
  };
}
