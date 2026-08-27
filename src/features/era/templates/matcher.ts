// src/features/era/templates/matcher.ts
// ERA Stage 4 (HUB-30) — Layer 2 of the plan's routing architecture:
// deterministic matching against phrases the user has taught ERA, tried
// ONLY after every built-in face router has already missed (see
// intents/index.ts's rootIntentRouter — this module never runs first).
//
// `pattern_text` is stored data (e.g. "shift it to {whenText}"), never
// AI-generated code or regex. `compilePattern` is the one fixed, hand-
// written algorithm that turns that placeholder syntax into a match — the
// only regex construction happens here, in reviewed application code, never
// from a string the model wrote.

export interface EraTemplate {
  id: string;
  capabilityId: string;
  patternText: string;
  slotNames: readonly string[];
  enabled: boolean;
}

export interface TemplateMatch {
  template: EraTemplate;
  /** Captured slot values, keyed by slot name, as literal strings from the utterance. */
  slots: Record<string, string>;
}

const SLOT_RE = /\{([a-zA-Z_]\w*)\}/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turns "shift it to {whenText}" into a case-insensitive matcher that
 * captures `whenText`. Non-slot text is escaped literally; a slot becomes a
 * reluctant `(.+?)` capture group so multiple slots in one pattern don't
 * each swallow the whole remainder.
 */
function compilePattern(patternText: string): { regex: RegExp; slotOrder: string[] } {
  const slotOrder: string[] = [];
  let lastIndex = 0;
  let source = "";
  SLOT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SLOT_RE.exec(patternText))) {
    source += escapeRegExp(patternText.slice(lastIndex, m.index));
    source += "(.+?)";
    slotOrder.push(m[1]);
    lastIndex = SLOT_RE.lastIndex;
  }
  source += escapeRegExp(patternText.slice(lastIndex));
  return { regex: new RegExp(`^${source}$`, "i"), slotOrder };
}

/**
 * Tries every enabled template against `text` in order, returning the first
 * match. Templates are per-user and few (taught one at a time), so a linear
 * scan is plenty — no index needed.
 */
export function matchTemplates(
  text: string,
  templates: readonly EraTemplate[],
): TemplateMatch | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const template of templates) {
    if (!template.enabled) continue;
    const { regex, slotOrder } = compilePattern(template.patternText);
    const m = trimmed.match(regex);
    if (!m) continue;

    const slots: Record<string, string> = {};
    slotOrder.forEach((name, i) => {
      slots[name] = (m[i + 1] ?? "").trim();
    });
    return { template, slots };
  }
  return null;
}
