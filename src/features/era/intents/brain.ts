// Per-face intent router — Brain / Memory face
import type { Intent } from "../types";
import type { FaceIntentRouter } from "./schedule";

const SAVE_PATTERNS: RegExp[] = [
  /^remember(?:\s+that)?\s+(?:the\s+)?(.+?)\s+(?:is|=|:)\s+(.+)$/i,
  /^save(?:\s+this)?[:\s]+(.+?)\s*[=:]\s*(.+)$/i,
  /^my\s+(.+?)\s+(?:number|address|code|id|password)\s+is\s+(.+)$/i,
  /^note[:\s]+(.+?)\s*[=:]\s*(.+)$/i,
  /^store\s+(?:that\s+)?(?:the\s+)?(.+?)\s+is\s+(.+)$/i,
];

const RECALL_PATTERNS: RegExp[] = [
  /^what(?:'s| is| was)\s+(?:the\s+|my\s+)?(.+?)(?:\s+(?:number|code|address|id|password))?\??$/i,
  /^get me\s+(?:the\s+)?(.+?)\??$/i,
  /^(?:tell me|recall|find)\s+(?:the\s+|my\s+)?(.+?)\??$/i,
  /^do (?:we|i) have\s+(?:a\s+)?(.+?)\??$/i,
  /^(?:what is|what's)\s+(.+?)\s+(?:number|contact|info|information|detail)\??$/i,
];

/**
 * Domain vocabulary owned by another face. The recall patterns above are
 * deliberately broad ("what's X", "tell me X", …) so they catch a wide
 * range of real memory queries ("what's my wifi password") — but that same
 * breadth means, unguarded, they ALSO swallow a schedule/budget/chef
 * question shaped the same way ("what's on my schedule Saturday" used to
 * parse as a memory recall for the literal string "on my schedule
 * saturday"). Vocabulary mirrors each face's own trigger words (schedule.ts's
 * todaySchedule condition + every face's generic switch list) so this stays
 * in sync with what actually routes elsewhere. A recall pattern must never
 * fire when one of these words is present — regression case: the HUB-26
 * acceptance phrase "what's on my schedule this Saturday" must resolve
 * uniquely to Schedule through the FULL root router, not just when Schedule
 * happens to already be the active face.
 */
const OTHER_DOMAIN_RE =
  /\b(schedule|today|due|upcoming|overdue|this week|tomorrow|tonight|agenda|weekend|task|todo|to-do|deadline|appointment|event|meeting|calendar|reminder|reminders|alarm|alarms|budget|expense|expenses|income|transaction|transactions|balance|account|spend|spent|spending|pay|paid|cost|costs|draft|drafts|savings|wallet|transfer|recipe|recipes|cook|cooking|bake|baking|meal|meals|menu|dish|dishes|snack|dinner|lunch|breakfast|ingredient|kitchen|chef|reservation|reservations)\b/i;

// HUB-89 — "add Laura as a contact (person)" / "add Laura to my contacts".
// Name only; digits and "$" are rejected so money sentences never match.
const ADD_CONTACT_RE =
  /^\s*(?:please\s+)?add\s+(.+?)\s+(?:as\s+(?:a\s+|an\s+)?(?:new\s+)?contact(?:\s+person)?|to\s+(?:my\s+|the\s+)?contacts)\s*[.!]*$/i;

// HUB-123 — contacts filed under a Catalogue category. Every pattern names
// the contact noun, so "move salt under Spinneys" stays a shopping edit.
// A leading "In Catalogue," / "In contacts:" only says where; it is dropped.
const WHERE_PREFIX_RE = /^\s*(?:in|on|from)\s+(?:the\s+|my\s+)?(?:catalogue|catalog|contacts)\s*[,:-]?\s+/i;
const CAT = String.raw`(?:the\s+|my\s+|our\s+)?(.+?)(?:\s+(?:category|categories|group|section|folder))?`;
const END = String.raw`\s*[.!]*$`;
const ADD = String.raw`^\s*(?:please\s+)?add\s+(.+?)\s+`;
const MOVE = String.raw`^\s*(?:please\s+)?(?:move|put|place|file|shift|assign|categori[sz]e)\s+(?:the\s+|my\s+)?`;
const INTO = String.raw`\s+(?:to|under|in|into|as)\s+`;

/** add NAME as a contact under/in Family (category) · add NAME to my contacts under Family */
const ADD_CONTACT_UNDER_RE = new RegExp(
  String.raw`${ADD}(?:as\s+(?:a\s+|an\s+)?(?:new\s+)?contact(?:\s+person)?|to\s+(?:my\s+|the\s+)?contacts)\s+(?:under|in|into|to)\s+${CAT}${END}`,
  "i",
);
/** add NAME as a family contact · add NAME to my Family contacts */
const ADD_CONTACT_KIND_RE = new RegExp(
  String.raw`${ADD}(?:as\s+(?:a\s+|an\s+)(?!new\b)(.+?)|to\s+(?:my\s+|the\s+|our\s+)?(?!my\b|the\b)(.+?))\s+contacts?(?:\s+person)?${END}`,
  "i",
);
/** move contact NAME under Family · move NAME contact to the Family category · move NAME to Family contacts */
const MOVE_CONTACT_RES: RegExp[] = [
  new RegExp(String.raw`${MOVE}contact\s+(.+?)${INTO}${CAT}${END}`, "i"),
  new RegExp(String.raw`${MOVE}(.+?)(?:'s)?\s+contact${INTO}${CAT}${END}`, "i"),
  new RegExp(String.raw`${MOVE}(.+?)${INTO}(?:the\s+|my\s+|our\s+)?(.+?)\s+contacts?(?:\s+(?:category|group|section|folder))?${END}`, "i"),
];

const okName = (s: string | undefined): s is string =>
  !!s && s.trim().length >= 1 && s.trim().length <= 60 && !/[\d$€£]/.test(s) && !/^(?:it|that|this|them|those|her|him)$/i.test(s.trim());
const okCategory = (s: string | undefined): s is string =>
  !!s && s.trim().length >= 1 && s.trim().length <= 40 && !/[\d$€£]/.test(s);

/**
 * Contact sentences, checked by the root router ahead of the shopping
 * "move X under Y" edit (HUB-84) and the face routers — the contact noun
 * makes them unambiguous. Null when the sentence is not about a contact.
 */
export function parseContactIntent(text: string): Intent | null {
  const t = text.replace(WHERE_PREFIX_RE, "");
  if (!/\bcontacts?\b/i.test(t)) return null;

  const under = t.match(ADD_CONTACT_UNDER_RE);
  if (under && okName(under[1]) && okCategory(under[2])) {
    return { kind: "addContact", face: "brain", name: under[1].trim(), categoryHint: under[2].trim(), rawText: text };
  }
  const plain = t.match(ADD_CONTACT_RE);
  if (plain && okName(plain[1])) {
    return { kind: "addContact", face: "brain", name: plain[1].trim(), rawText: text };
  }
  const kind = t.match(ADD_CONTACT_KIND_RE);
  const kindCat = kind?.[2] ?? kind?.[3];
  if (kind && okName(kind[1]) && okCategory(kindCat)) {
    return { kind: "addContact", face: "brain", name: kind[1].trim(), categoryHint: kindCat.trim(), rawText: text };
  }
  for (const re of MOVE_CONTACT_RES) {
    const m = t.match(re);
    if (m && okName(m[1]) && okCategory(m[2])) {
      return { kind: "moveContact", face: "brain", name: m[1].trim(), categoryHint: m[2].trim(), rawText: text };
    }
  }
  return null;
}

// HUB-88 — "add Kobeize as a location", "save Spinneys to my places".
// Anchored on the entity noun; currency is rejected so money never matches.
const ADD_PLACE_RE =
  /^\s*(?:please\s+)?(?:add|save)\s+(.+?)\s+(?:as\s+(?:a\s+|an\s+|my\s+)?(?:new\s+)?(?:location|place)|to\s+(?:my\s+|the\s+)?(?:places|locations))\s*[.!]*$/i;

export const brainRouter: FaceIntentRouter = {
  parse(text) {
    const place = text.match(ADD_PLACE_RE);
    if (place) {
      const name = place[1].trim();
      if (name.length >= 1 && name.length <= 80 && !/[$€£]/.test(name)) {
        return { kind: "addPlace", face: "brain", name, rawText: text };
      }
    }

    const contact = parseContactIntent(text);
    if (contact) return contact;

    // Check save patterns first
    for (const re of SAVE_PATTERNS) {
      const m = text.match(re);
      if (m) {
        const label = m[1].trim();
        const value = m[2].trim();
        if (label.length >= 2 && label.length <= 80 && value.length >= 1 && value.length <= 500) {
          return { kind: "memorySave", face: "brain", label, value, rawText: text };
        }
      }
    }

    // Check recall patterns — skipped entirely when the question is clearly
    // about another face's domain (see OTHER_DOMAIN_RE above).
    if (!OTHER_DOMAIN_RE.test(text)) {
      for (const re of RECALL_PATTERNS) {
        const m = text.match(re);
        if (m) {
          const query = m[1].trim();
          if (query.length >= 2 && query.length <= 80) {
            return { kind: "memoryRecall", face: "brain", query, rawText: text };
          }
        }
      }
    }

    // Generic brain face switch
    if (/\b(catalogue|catalog|inventory|remember|memory|note|stock|have we got|do we have)\b/i.test(text)) {
      return { kind: "switchFace", face: "brain", rawText: text };
    }

    return null;
  },
};
