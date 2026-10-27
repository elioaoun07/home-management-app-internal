// scripts/delivery-v2/uat-docs.mjs
// DLV-145 — reuse the drafted owner wizards (docs/Delivery-UAT-*-2026-10-25.md)
// as *draft* handovers. Pure text in, structured scenarios out.
//
// The six documents were written by hand and differ in shape, so this reader is
// tolerant but never inventive: a numbered line is a step; the words after
// "Expected" / "Expect" are its expectation; anything it cannot split keeps an
// empty expectation and surfaces as a validation problem rather than being
// guessed. Nothing here marks a scenario ready or records a result.
import { basename } from "node:path";
import { CAMPAIGNS } from "../pm/lint.mjs";
import { slugify } from "../pm/shared/links.mjs";

const CAMPAIGN_BY_PREFIX = Object.freeze(Object.fromEntries(Object.entries(CAMPAIGNS).map(([name, prefix]) => [prefix, name])));
const WORK = /\b(?:(?:BUD|SCH|KIT|TRIP|HUB|NOTIF|HLTH|OUT|DLV|NAT)-\d+(?:\.\d+)?[a-z]?|R\d{1,3})\b/gu;
const RUN = /\br-[0-9a-f]{12}\b/gu;
const PM_LOCAL = /Current-Attempts|Legacy-Attempts|PM-Review/u;
/** Sections that tell the tester how to start, not what to test: they become every handover's setup. */
const PREFACE = /^(?:before you begin|before starting|start here|prepare once|choose the test)\b/iu;

/** `BUD-83` → `{ id: "BUD-83", campaign: "Budget" }`; unknown prefixes have no campaign. */
export function workIdentity(id) {
  const match = /^([A-Z]+)-?\d/u.exec(String(id || ""));
  return { id: id || null, campaign: match ? CAMPAIGN_BY_PREFIX[match[1]] || null : null };
}

const firstWork = (value) => {
  const found = String(value || "").match(WORK);
  return found ? found[0] : null;
};
const allWork = (value) => [...new Set(String(value || "").match(WORK) || [])];

const stripMd = (value) =>
  String(value || "")
    .replace(/\[([^\]]+)\]\((?:<[^>]*>|[^)]*)\)/gu, "$1")
    .replace(/\*\*/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

/** Split one step into its action and expected result. */
export function splitStep(raw) {
  const line = String(raw || "").replace(/\s+/gu, " ").trim();
  const bold = /\*\*Expect(?:ed|s)?\b[^*]{0,40}?:?\*\*:?\s*/iu.exec(line);
  const plain = bold ? null : /(?:^|[.!?);]\s+)(Expect(?:ed|s)?)\b:?\s+/iu.exec(line);
  let cut;
  let length;
  if (bold) {
    cut = bold.index;
    length = bold[0].length;
  } else if (plain) {
    const offset = plain[0].indexOf(plain[1]);
    cut = plain.index + offset;
    length = plain[0].length - offset;
  } else {
    return { action: stripMd(line), expected: "" };
  }
  const expected = stripMd(line.slice(cut + length));
  return { action: stripMd(line.slice(0, cut)), expected: expected ? expected[0].toUpperCase() + expected.slice(1) : "" };
}

/** `**Key:** value` pairs from the non-step text of a block. */
function pairs(lines) {
  const joined = lines.join("\n");
  const marks = [...joined.matchAll(/\*\*([A-Za-z][A-Za-z0-9 /()'’,-]{0,60}?):\*\*\s*/gu)];
  const out = [];
  for (const [i, mark] of marks.entries()) {
    const end = i + 1 < marks.length ? marks[i + 1].index : joined.length;
    out.push({ key: mark[1].trim().toLowerCase(), value: stripMd(joined.slice(mark.index + mark[0].length, end)) });
  }
  return out;
}

const pick = (list, pattern) => list.filter((pair) => pattern.test(pair.key)).map((pair) => pair.value).filter(Boolean);

function purposeOf(types, title) {
  const value = `${types.join(" ")} ${title}`.toLowerCase();
  if (/defect|bug|symptom/u.test(value)) return "defect";
  if (/regression/u.test(value)) return "regression";
  if (/edge/u.test(value)) return "edge";
  if (/review|historical|documentation|tooling/u.test(value)) return "review";
  return "feature";
}

function scenarioId(raw, fallbackTitle, used) {
  const base = String(raw || "").trim().replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 60)
    || slugify(fallbackTitle).slice(0, 60) || "scenario";
  let id = base;
  for (let n = 2; used.has(id.toLowerCase()); n += 1) id = `${base}-${n}`;
  used.add(id.toLowerCase());
  return id;
}

const HEADING = /^(#{2,3})\s+(.+?)\s*$/u;
const MARKER = /^\*\*([A-Za-z0-9][A-Za-z0-9.-]*)\s+[—–-]\s+(.+?)\*\*\s*$/u;
const STEP = /^\s{0,3}(\d{1,3})\.\s+(.*)$/u;
const ID_TITLE = /^([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)\s+[—–-]\s+(.+)$/u;

/**
 * Scenario blocks of one document, grouped by their `##` section.
 *
 * @returns {{ sections: Array<{ anchor: string, title: string, scenarios: any[], context: any[] }>, skipped: Array<{ title: string, reason: string }> }}
 */
export function extractSections(markdown) {
  const lines = String(markdown || "").replace(/\r\n/gu, "\n").split("\n");
  const blocks = [];
  let section = null;
  let current = null;
  let fenced = false;
  for (const line of lines) {
    if (/^\s*```/u.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = HEADING.exec(line);
    const marker = heading ? null : MARKER.exec(line);
    if (heading || marker) {
      const title = heading ? heading[2] : `${marker[1]} — ${marker[2]}`;
      const split = ID_TITLE.exec(stripMd(title));
      const block = {
        level: heading ? heading[1].length : 4,
        rawTitle: stripMd(title),
        id: split ? split[1] : null,
        title: split ? split[2] : stripMd(title),
        anchor: heading ? slugify(stripMd(heading[2])) : null,
        steps: [],
        text: [],
      };
      if (block.level === 2) section = { ...block, scenarios: [], children: [] };
      blocks.push({ ...block, section });
      current = blocks[blocks.length - 1];
      if (section && block.level === 2) section.self = current;
      continue;
    }
    if (!current) continue;
    const step = STEP.exec(line);
    if (step) {
      current.steps.push(step[2]);
      continue;
    }
    if (current.steps.length && /^\s{2,}\S/u.test(line)) {
      current.steps[current.steps.length - 1] += " " + line.trim();
      continue;
    }
    if (line.trim()) current.text.push(line.trim());
  }
  const sections = new Map();
  const skipped = [];
  for (const block of blocks) {
    if (!block.section) continue;
    const owner = block.section.self;
    const entry = sections.get(owner) || { anchor: owner.anchor, title: owner.rawTitle, id: owner.id, scenarios: [], context: owner.text };
    sections.set(owner, entry);
    if (block.steps.length) entry.scenarios.push(block);
    else if (block !== owner && block.level > 2) skipped.push({ title: block.rawTitle, reason: "no numbered steps" });
  }
  const out = [];
  for (const entry of sections.values()) {
    if (entry.scenarios.length) out.push(entry);
    else skipped.push({ title: entry.title, reason: "no numbered steps" });
  }
  return { sections: out, skipped };
}

/** Rows that link a scenario anchor to the delivery they cover. */
function coverageRows(markdown) {
  const byAnchor = new Map();
  for (const line of String(markdown || "").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const anchors = [...line.matchAll(/\]\(#([^)\s]+)\)/gu)].map((match) => match[1]);
    if (!cells.length || !anchors.length) continue;
    const first = stripMd(cells[0]);
    for (const anchor of anchors) {
      const list = byAnchor.get(anchor) || [];
      list.push({ work: firstWork(first), runs: [...new Set(line.match(RUN) || [])], cell: first });
      byAnchor.set(anchor, list);
    }
  }
  return byAnchor;
}

/**
 * Draft handovers from one drafted wizard. Every scenario is `draft: true`; a
 * section whose steps lack an expected result stays visible as *incomplete*
 * (validation reports the exact step).
 *
 * @param {string} markdown
 * @param {{ file: string }} options  repo-relative path, used for the delivery reference
 */
export function handoversFromDoc(markdown, { file }) {
  const name = basename(file);
  const rows = coverageRows(markdown);
  const { sections, skipped } = extractSections(markdown);
  const handovers = [];
  const preface = sections
    .filter((section) => PREFACE.test(section.title))
    .flatMap((section) => section.scenarios.flatMap((block) => block.steps.map((step, n) => `${n + 1}. ${stripMd(step)}`)))
    .join("\n");
  for (const section of sections) {
    if (PREFACE.test(section.title)) continue;
    const used = new Set();
    const sectionPairs = pairs(section.context);
    const mapped = [...(rows.get(section.anchor) || [])];
    // An anchor named by several rows covers several attempts: no single run or item.
    const unique = mapped.length === 1 ? mapped[0] : null;
    const acceptance = pick(sectionPairs, /^acceptance|^covers/u).concat(...section.scenarios.map((block) => pick(pairs(block.text), /^acceptance|^covers/u)));
    const work_id = firstWork(acceptance.join(" ")) || unique?.work || firstWork(section.id) || null;
    const run_id = unique && unique.runs.length === 1 ? unique.runs[0] : null;
    const scenarios = section.scenarios.map((block) => {
      const own = pairs(block.text);
      const all = block === section.scenarios[0] && block.level === 2 ? own : [...sectionPairs, ...own];
      const refs = [...allWork(pick(all, /^acceptance|^covers/u).join(" "))];
      return {
        id: scenarioId(block.id, block.title, used),
        title: block.title.slice(0, 160),
        purpose: purposeOf(pick(all, /^type/u), block.title),
        required: true,
        criteria: refs.length ? refs : work_id ? [work_id] : [],
        draft: true,
        setup: pick(all, /^(?:prerequisites?|prepared data|data|readiness|setup|identity)\b/u).join("\n"),
        starting: "",
        steps: block.steps.map(splitStep),
        defect: pick(all, /^(?:original|former) symptom/u)[0] || null,
        cleanup: pick(all, /^reset/u).join("\n"),
        limits: pick(all, /^limits?\b/u).join("\n") || null,
      };
    });
    const { campaign } = workIdentity(work_id);
    handovers.push({
      subject: {
        run_id,
        delivery_ref: `docs/${name}#${section.anchor}`,
        work_id,
        campaign,
        title: section.title.slice(0, 160),
      },
      content: {
        summary: section.title,
        setup: [preface && `Before you begin\n${preface}`, ...pick(sectionPairs, /^(?:prerequisites?|readiness)\b/u)].filter(Boolean).join("\n\n"),
        limits: pick(sectionPairs, /^limits?\b/u).join("\n"),
        scenarios,
      },
      environment: { target: PM_LOCAL.test(name) ? "local" : "hosted" },
      source: { kind: "docs", ref: `docs/${name}#${section.anchor}` },
    });
  }
  return { handovers, skipped };
}
