// Canonical work-ID grammar shared by the scanner, read models, write guards and
// V2 selection. Source spelling (`SCH-4.3b`) is kept for display; comparisons use
// the normalized key (`SCH-4.3B`) so headings, chips and references agree.
import { headingAnchors, slugify } from "./links.mjs";

const NUMBER = String.raw`\d+[a-z]?(?:\.\d+[a-z]?)*`;
const NUMBER_ONLY = new RegExp(`^${NUMBER}$`, "i");
const REFERENCE = /\b((?:BUD|SCH|KIT|TRIP|HUB|NOTIF|HLTH|OUT|DLV|NAT)-|R)(\d[\w.]*(?:\/\d[\w.]*)*)/g;

/** A checklist chip: any short prefix, one numeric part, optional suffix letters and dotted parts. */
export const CHIP_ID_SOURCE = String.raw`[A-Z]{1,5}-?${NUMBER}`;

export function normalizeWorkId(id) {
  const value = String(id ?? "").trim();
  return value ? value.toUpperCase() : null;
}

/**
 * Canonical references in prose, normalized. Shorthand (`HUB-39/42/51`) expands;
 * a token that is not a whole ID (`SCH-4.3bx`) is dropped rather than truncated to
 * a different ID, and lowercase link anchors (`#sch-42`) are not references.
 */
export function workIds(text = "") {
  const ids = [];
  for (const match of String(text).matchAll(REFERENCE)) {
    for (const part of match[2].split("/")) {
      const number = part.replace(/\.+$/, "");
      if (NUMBER_ONLY.test(number)) ids.push(normalizeWorkId(match[1] + number));
    }
  }
  return [...new Set(ids)];
}

/** Every `### <ID>` section matching the normalized ID, with its GitHub anchor and body. */
export function idSections(raw = "", id, level = 3) {
  const key = normalizeWorkId(id);
  if (!key || !raw) return [];
  const lines = String(raw).split("\n");
  const anchors = new Map(headingAnchors(raw).map((entry) => [entry.line, entry.anchor]));
  const heading = new RegExp(`^#{${level}}\\s+(.+?)\\s*#*\\s*$`);
  const boundary = new RegExp(`^#{1,${level}}\\s`);
  const sections = [];
  lines.forEach((line, index) => {
    const match = line.replace(/\r$/, "").match(heading);
    if (!match || normalizeWorkId(match[1]) !== key) return;
    let end = index + 1;
    while (end < lines.length && !boundary.test(lines[end])) end++;
    sections.push({
      heading: match[1],
      line: index,
      anchor: anchors.get(index) || null,
      body: lines.slice(index + 1, end).join("\n").replace(/\r/g, "").trim(),
    });
  });
  return sections;
}

/** The single matching section, or null when absent or ambiguous. */
export function idSection(raw, id, level = 3) {
  const sections = idSections(raw, id, level);
  return sections.length === 1 ? sections[0] : null;
}

const CHIP_LINE = new RegExp(String.raw`^\s*-\s*\[[ xX]\]\s*\*\*(${CHIP_ID_SOURCE})\*\*`, "i");

/**
 * The same anchor slug a checklist chip's brief heading would use, keyed by
 * source line — lets the Reader scroll to and highlight the exact checklist
 * row a chip identifies, without a heading to anchor to.
 */
export function checklistAnchors(raw = "") {
  return String(raw)
    .split("\n")
    .flatMap((line, index) => {
      const match = line.match(CHIP_LINE);
      return match ? [{ line: index, id: normalizeWorkId(match[1]), anchor: slugify(match[1]) }] : [];
    });
}
