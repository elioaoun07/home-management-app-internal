// src/features/era/templates/vocabGrowth.ts
// ERA Stage 5 (HUB-31) — language growth: let validated successful usage
// (already-taught templates, era_templates) widen an EXISTING capability's
// vocabulary, never create a new one. "Nudge it to 5" teaching the word
// "nudge" for reminder.reschedule is the plan's own example ("shift" joining
// move/reschedule) — this is the general mechanism that produces it.
//
// Deliberately has NO persistence of its own: the "learned words" are
// derived on the fly from whatever templates are already loaded (HUB-30),
// scoped strictly to that template's capability's entity — a word learned
// from a reminder template can never widen the schedule bucket or any
// future non-schedule domain, satisfying the plan's "never globally
// ambiguous" rule.

import { getCapability } from "../capabilities/registry";
import { tokenize } from "../capabilities/vocab";
import type { EraEntityType } from "../capabilities/types";
import type { EraTemplate } from "./matcher";

export function deriveLearnedVocab(
  templates: readonly EraTemplate[],
): Partial<Record<EraEntityType, Set<string>>> {
  const result: Partial<Record<EraEntityType, Set<string>>> = {};

  for (const template of templates) {
    if (!template.enabled) continue;
    const capability = getCapability(template.capabilityId);
    if (!capability) continue;

    const literalText = template.patternText.replace(/\{[a-zA-Z_]\w*\}/g, " ");
    const words = tokenize(literalText);
    if (words.length === 0) continue;

    const set = result[capability.entity] ?? new Set<string>();
    for (const w of words) set.add(w);
    result[capability.entity] = set;
  }

  return result;
}
