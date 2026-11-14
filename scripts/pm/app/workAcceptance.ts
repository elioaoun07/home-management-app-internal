import { scanLines } from "../shared/md-scan.mjs";

type Line = { raw: string; type: string; level?: number; text?: string };

const acceptanceLabel = /^Acceptance(?: criteria)?$/i;
const metadataLabel =
  /^(?:Outcome|Kind|Touches|Source|Tier|Reading guide|Provenance|Depends on|Implementation|UAT|Evidence|Progress|Verify|Verification|Execution(?: plan)?|Readiness|Owner check|UAT instructions|Status)(?:\s*[—:(-].*)?$/i;

function labelOf(line: Line) {
  if (!["text", "bullet", "checkbox"].includes(line.type)) return null;
  const match = line.raw
    .replace(/\r$/, "")
    .match(
      /^([ \t]*)(?:(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s+)?)?\*\*([^*\r\n]+?):\*\*(?:[ \t]|$)/,
    );
  return match ? { indent: match[1].length, label: match[2].trim() } : null;
}

/** Read-only display projection. The original contract and linked brief stay intact.
 * Keep raw Markdown, including continuation paragraphs and nested/fenced content.
 * Only explicit labels establish boundaries; unfamiliar formats retain the full brief.
 */
export function acceptanceMarkdown(raw: string): string {
  const lines: Line[] = scanLines(raw).lines;
  // Reference definitions can have continuation titles outside the selected block.
  // The shared scanner does not model that syntax; retain it rather than break links.
  if (
    lines.some(
      (line) => line.type === "text" && /^ {0,3}\[[^\]]+\]:/.test(line.raw),
    )
  )
    return raw;
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < lines.length; start += 1) {
    const line = lines[start];
    const label = labelOf(line);
    const heading =
      line.type === "heading" &&
      acceptanceLabel.test((line.text || "").replace(/:$/, "").trim());
    if (
      !heading &&
      (!label || !acceptanceLabel.test(label.label) || label.indent > 3)
    )
      continue;
    let end = start + 1;
    for (; end < lines.length; end += 1) {
      const next = lines[end];
      // A heading-labelled acceptance section owns its deeper subsections.
      // For a bold label, a following heading has no explicit relationship;
      // retain the full contract rather than guess whether it ends the criteria.
      if (next.type === "heading") {
        if (!heading) return raw;
        if ((next.level || 0) <= (line.level || 0)) break;
      }
      const nextLabel = labelOf(next);
      if (
        !heading &&
        nextLabel &&
        nextLabel.indent <= (label?.indent || 0) &&
        (acceptanceLabel.test(nextLabel.label) ||
          metadataLabel.test(nextLabel.label))
      )
        break;
    }
    ranges.push({ start, end });
    start = end - 1;
  }
  if (!ranges.length) return raw;
  return ranges
    .map(({ start, end }) =>
      lines
        .slice(start, end)
        .map((line) => line.raw)
        .join("\n")
        .trim(),
    )
    .join("\n\n");
}
