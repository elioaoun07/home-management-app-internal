import { scanLines } from "./md-scan.mjs";
import { cleanInlineText } from "./text.mjs";

export function sectionRank(section) {
  return ({ now: 0, next: 1, later: 2 })[String(section || "").toLowerCase()] ?? 3;
}

export function parseTaskMeta(rest) {
  const source = String(rest || "");
  const idMatch = source.match(/(?:^|\s)\*\*([A-Z]{1,5}-?\d+[a-z]?(?:\.\d+[a-z]?)?)\*\*/i);
  const metaMatch = source.match(/_\(\s*([\w -]+?)\s*-\s*([XSML]|\d+h?)\s*\)_\s*$/i);
  const word = (metaMatch?.[1] || "").trim().toLowerCase();
  const severity = /blocker|critical/.test(word) ? "blocker"
    : /friction|high/.test(word) ? "friction"
      : /annoyance|medium/.test(word) ? "annoyance"
        : /parked|low/.test(word) ? "parked" : null;
  return { idChip: idMatch ? idMatch[1].toUpperCase() : null, severity,
    effort: metaMatch ? metaMatch[2].toUpperCase() : null, text: cleanInlineText(source) };
}

export function fileTasks(raw) {
  let section = "Other";
  return scanLines(raw).lines.flatMap((line) => {
    if (line.type === "heading") { section = line.text; return []; }
    if (line.type !== "checkbox") return [];
    return [{ ...parseTaskMeta(line.rest), state: line.state, cbidx: line.cbidx,
      line: line.line, section, sectionRank: sectionRank(section) }];
  });
}

export const checklistItems = fileTasks;

export function severityItems(raw) {
  const out = [];
  let inLegend = false;
  for (const line of scanLines(raw).lines) {
    if (line.type === "heading") inLegend = /legend/i.test(line.text);
    if (inLegend || line.type === "table-row" || line.type === "in-fence") continue;
    const match = line.raw.match(/^\s*[-*]?\s*(🔴|🟠|🟡|⚪)\s+(.*)$/u);
    if (match) out.push({ severity: ({ "🔴": "blocker", "🟠": "friction", "🟡": "annoyance", "⚪": "parked" })[match[1]], text: cleanInlineText(match[2]), line: line.line });
  }
  return out;
}

export function daySections(raw) {
  const sections = [];
  let active = null;
  for (const line of scanLines(raw).lines) {
    if (line.type === "heading") { active = { heading: line.text, level: line.level, items: [] }; sections.push(active); }
    else if (active && ["checkbox", "bullet", "text"].includes(line.type)) active.items.push(line);
  }
  return sections;
}

export const taskKey = (file, task) => `${file}::${task.cbidx}`;
export function sumChecklist(items) {
  return (items || []).reduce((sum, item) => ({ total: sum.total + 1, done: sum.done + (item.state === "done" ? 1 : 0) }), { total: 0, done: 0 });
}
export function sumSeverity(items) {
  return (items || []).reduce((sum, item) => { sum[item.severity] = (sum[item.severity] || 0) + 1; return sum; }, { blocker: 0, friction: 0, annoyance: 0, parked: 0 });
}

