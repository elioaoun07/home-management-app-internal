// scripts/pm/ship.mjs
// One command for "this work is shipped":
//
//   pnpm pm:ship BUD-32 HUB-87 --note "12 route tests; typecheck clean"
//   pnpm pm:ship R44 --date 2026-10-24 --note "applied earlier"   (real completion date)
//   pnpm pm:ship                 (no IDs: sweep rows already ticked, then compact)
//   pnpm pm:ship --dry-run       (report only)
//   pnpm pm:ship --undo          (restore the files the last run changed)
//   pnpm pm:index                (only refresh the generated block of _index.md)
//
//   1. tick     the named IDs in their campaign `4 - Checklist.md`
//   2. sweep    every ticked row into its Master Book › Shipped Log (archive.mjs)
//   3. compact  each Master Book: the `### <ID>` criteria of shipped items, the
//               full text of long receipts and state-log entries beyond the newest
//               three move to `_Archive/Shipped/<Campaign>.md`. The Shipped Log
//               keeps one dated line per receipt, linked to its archived record.
//               Links to moved anchors are retargeted in every active document.
//   4. refresh  the generated block in `_index.md` (sprint, campaigns, Now)
//   5. verify   `pm:lint` and `pm:check-docs`
//
// Nothing is deleted: every moved byte lands in the archive file, and the files
// touched by a run are snapshotted to `.pm/last-ship.json` for `--undo`.
// Zero dependencies. The helpers above the CLI are pure (strings in, strings out).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { campaignDirs, masterBookRel, sweepAll, todayIso, CHECKLIST_NAME } from "./archive.mjs";
import { parseHistory } from "./shared/history.mjs";
import { headingAnchors } from "./shared/links.mjs";
import { fileTasks, groupedTasks, OWNER_GROUP } from "./shared/tasks.mjs";
export { groupedTasks, OWNER_GROUP } from "./shared/tasks.mjs";
import { cleanInlineText } from "./shared/text.mjs";
import { normalizeWorkId } from "./shared/work-id.mjs";
import { executionKind } from "./shared/work-lifecycle.mjs";

export const SHIPPED_DIR = "_Archive/Shipped";
export const RECEIPT_MAX = 200; // a longer receipt body moves to the archive
export const STATE_KEEP = 3; // dated state-log entries a Master Book keeps
const RECORD_LINK = /→ \[record\]\(/u;
const STATE_HEADING = "Current state & evidence";
const CRITERIA_HEADING = "Acceptance Criteria Index";
const ITEMS_H2 = "## Shipped items";
const STATE_H2 = "## State log";
// Display order of the generated index: product campaigns first, tooling last.
const CAMPAIGN_ORDER = ["Hub & ERA", "Budget", "Schedule", "Kitchen", "Trips", "Healthcare", "Outfits", "Notifications & Alerts", "Native App", "Delivery", "PM Tooling"];

export const archiveRelFor = (campaign) => `${SHIPPED_DIR}/${campaign}.md`;

// ------------------------------------------------------------------ helpers

const eolOf = (raw) => (/\r\n/.test(raw) ? "\r\n" : "\n");
const toLf = (raw) => String(raw).replace(/\r\n/g, "\n");
// posix.relative resolves against the process cwd; a fixed deep root keeps the
// result independent of where (and on which OS) the script runs.
const ROOT = "/_/_/_/_/_/_/";
const relPath = (fromDir, to) => posix.relative(ROOT + fromDir, ROOT + to);

/** Fence-aware headings with levels: [{line, level, text, anchor}]. */
export function headings(raw) {
  const lines = String(raw).split("\n");
  return headingAnchors(raw).map((entry) => ({ ...entry, level: lines[entry.line].match(/^#+/)[0].length }));
}

/** First line after the section opened by `list[index]`. */
function sectionEnd(list, index, totalLines) {
  for (let i = index + 1; i < list.length; i++) if (list[i].level <= list[index].level) return list[i].line;
  return totalLines;
}

/** Collapse runs of blank lines to one, outside fenced code. */
function collapseBlank(text) {
  const out = [];
  let fence = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && !line.trim() && out.length && !out[out.length - 1].trim()) continue;
    out.push(line);
  }
  return out.join("\n");
}

/** Tick `- [ ] **ID**` in a checklist. state: ticked | already | missing. */
export function tickById(raw, id) {
  const key = normalizeWorkId(id);
  const task = fileTasks(raw).find((entry) => entry.idChip === key);
  if (!task) return { raw, state: "missing" };
  if (task.state === "done") return { raw, state: "already" };
  const lines = String(raw).split("\n");
  lines[task.line] = lines[task.line].replace(/^(\s*(?:[-*]|\d+\.)\s+\[) (\])/, "$1x$2");
  return { raw: lines.join("\n"), state: "ticked" };
}

/**
 * A one-line title from a receipt body (the text after the date and bold lead).
 * A swept checklist row ends with its criteria link, then any `--note` evidence:
 * the title stops before both, the archived receipt keeps them.
 */
export function shortTitle(body, max = 140) {
  let text = cleanInlineText(String(body).replace(/\s*[—–→-]+\s*\[(?:criteria|scope)\]\((?:<[^>]+>|[^)]+)\).*$/iu, ""));
  text = text.replace(/^[\s—–:.-]+/u, "");
  const sentence = text.match(/^(.{20,}?[.;])\s/u)?.[1] ?? text;
  let title = sentence.length <= max ? sentence : sentence.slice(0, max).replace(/\s+\S*$/u, "") + "…";
  const open = title.lastIndexOf("(");
  if (open > 0 && !title.slice(open).includes(")")) title = title.slice(0, open).trimEnd() + "…";
  return title.replace(/[.;,:\s]+$/u, "").replace(/…+$/u, "…") || "Shipped work";
}

const LINK_TARGET = /\]\((<[^>]+>|[^)\s]+)\)/g;

/**
 * Re-express every relative link in `text`, written for `fromRel`, so it works
 * from `toRel`. `anchorMap` (Map<"file#anchor", {file, anchor}>) retargets
 * anchors that moved. Paths are PM-root-relative POSIX; fenced code is skipped.
 */
export function relink(text, fromRel, toRel, anchorMap = new Map()) {
  let fence = false;
  return String(text).split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return line; }
    if (fence) return line;
    return line.replace(LINK_TARGET, (whole, target) => {
      const inner = target.replace(/^<|>$/g, "");
      if (!inner || /^[a-z][a-z\d+.-]*:/i.test(inner) || inner.startsWith("/")) return whole;
      const hash = inner.indexOf("#");
      let path = hash < 0 ? inner : inner.slice(0, hash);
      let anchor = hash < 0 ? "" : inner.slice(hash + 1);
      try { path = decodeURIComponent(path); } catch { /* keep the raw spelling */ }
      let file = path ? posix.normalize(posix.join(posix.dirname(fromRel), path)) : fromRel;
      const moved = anchor ? anchorMap.get(`${file}#${anchor}`) : null;
      if (moved) ({ file, anchor } = moved);
      else if (fromRel === toRel) return whole; // nothing about this link changed
      if (file === toRel) return anchor ? `](#${anchor})` : whole;
      return `](<${relPath(posix.dirname(toRel), file)}${anchor ? `#${anchor}` : ""}>)`;
    });
  }).join("\n");
}

const archiveStub = (campaign) => [
  "---", `created: ${todayIso()}`, `updated: ${todayIso()}`, "type: archive", "status: superseded", "owner: Elio", "---", "",
  `# ${campaign} — shipped work`, "",
  `> Written by \`pnpm pm:ship\`. Full receipts and acceptance criteria of completed ${campaign} items, plus Master Book state-log entries older than the newest ${STATE_KEEP}. The [Master Book](<../../${campaign}/${campaign} — Master Book.md>) keeps one dated line per item in its Shipped Log. Nothing under \`_Archive/\` is read by a PM tool.`,
  "", ITEMS_H2, "", STATE_H2, "",
].join("\n");

/** Append `block` (array of lines) to the end of the `h2` section of `raw`. */
function appendToH2(raw, h2, block) {
  const lines = raw.split("\n");
  let start = lines.findIndex((line) => line.trim() === h2);
  if (start < 0) { lines.push("", h2, ""); start = lines.length - 2; }
  let end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
  if (end < 0) end = lines.length;
  while (end > start + 1 && lines[end - 1].trim() === "") end--;
  lines.splice(end, 0, "", ...block, "");
  return lines.join("\n");
}

/** Add `entries` and `stateText` to an archive; `fix` rewrites moved text for its new home. */
function buildArchive(archiveRaw, campaign, entries, stateText, fix) {
  let archive = archiveRaw ?? archiveStub(campaign);
  for (const entry of entries) {
    const receipts = entry.receipts.map(fix);
    const body = entry.body ? fix(entry.body) : "";
    const list = headings(archive);
    const at = list.findIndex((item) => item.level === 3 && item.text === entry.heading);
    if (at >= 0) { // an ID shipped again: extend its record
      const lines = archive.split("\n");
      let end = sectionEnd(list, at, lines.length);
      while (end > list[at].line + 1 && lines[end - 1].trim() === "") end--;
      lines.splice(end, 0, "", ...receipts, ...(body ? ["", body] : []), "");
      archive = lines.join("\n");
    } else {
      archive = appendToH2(archive, ITEMS_H2, [`### ${entry.heading}`, "", ...receipts, ...(body ? [...(receipts.length ? [""] : []), body] : [])]);
    }
  }
  if (stateText) archive = appendToH2(archive, STATE_H2, [`_Moved from the Master Book on ${todayIso()}._`, "", fix(stateText)]);
  return collapseBlank(archive.replace(/^(updated:\s*)\d{4}-\d{2}-\d{2}\s*$/m, `$1${todayIso()}`));
}

// ---------------------------------------------------------------- compaction

/**
 * Move shipped criteria, long receipts and old state-log entries out of one book.
 * Pure. All text is LF; `bookRel` / `archiveRel` are PM-root-relative.
 * @param {{bookRaw:string, checklistRaw:string, campaign:string, bookRel:string, archiveRel:string, archiveRaw?:string|null, onlyId?:string|null}} input
 * @returns {{book:string, archive:string|null, anchorMap:Map<string,{file:string,anchor:string}>,
 *            stats:{sections:number, receipts:number, stateEntries:number, before:number, after:number}}}
 */
export function compactBook({ bookRaw, checklistRaw, campaign, bookRel, archiveRel, archiveRaw = null, onlyId = null }) {
  const lines = bookRaw.split("\n");
  const heads = headings(bookRaw);
  const open = new Set(fileTasks(checklistRaw).map((task) => task.idChip).filter(Boolean));
  const history = parseHistory(bookRaw, { campaign, file: bookRel });
  const h2 = (title) => heads.findIndex((entry) => entry.level === 2 && entry.text === title);
  const criteriaAt = h2(CRITERIA_HEADING);
  const criteriaRange = criteriaAt < 0 ? null : [heads[criteriaAt].line, sectionEnd(heads, criteriaAt, lines.length)];

  // 1. `### <ID>` sections whose ID has an exact shipped receipt and no open row.
  const exactIds = new Set(history.records.filter((record) => record.identity === "exact").map((record) => record.workId));
  const moved = new Map(); // workId -> {start, end, label}
  if (criteriaRange) {
    for (const id of exactIds) {
      if (onlyId && id !== onlyId) continue;
      if (open.has(id)) continue;
      const hits = heads.map((entry, index) => ({ entry, index })).filter(({ entry }) =>
        entry.level === 3 && normalizeWorkId(entry.text) === id && entry.line > criteriaRange[0] && entry.line < criteriaRange[1]);
      if (hits.length !== 1) continue; // absent or ambiguous: leave it alone
      const { entry, index } = hits[0];
      const end = sectionEnd(heads, index, lines.length);
      const body = lines.slice(entry.line + 1, end).join("\n");
      // Owner checks and pending acceptance are live state, not history.
      if (executionKind(body) !== "delivery" || /\*\*UAT:\*\*\s*pending/i.test(body)) continue;
      moved.set(id, { start: entry.line, end, label: entry.text });
    }
  }

  // 2. Receipts to shorten: those of a moved section, and any long one.
  const archiveHeadings = new Set(archiveRaw ? headings(archiveRaw).filter((entry) => entry.level === 3).map((entry) => entry.text) : []);
  const entries = []; // archive entries, in Shipped Log order
  const byId = new Map();
  const lineEdits = new Map(); // book line -> {entry, lead, title}
  for (const record of history.records) {
    if (onlyId && record.workId !== onlyId) continue;
    const source = lines[record.line];
    if (RECORD_LINK.test(source) || record.datePrecision === "unrecorded") continue;
    const exact = record.identity === "exact";
    const section = exact ? moved.get(record.workId) : null;
    if (!section && record.raw.length <= RECEIPT_MAX) continue;
    const lead = record.raw.match(/^\*\*([^*]+)\*\*/)?.[1] ?? null;
    const rest = lead ? record.raw.slice(lead.length + 4) : record.raw;
    let entry = exact ? byId.get(record.workId) : null;
    if (!entry) {
      let heading = exact ? (section?.label ?? lead.match(/^[A-Za-z]+-?[\w.]+/)[0]) : `${record.date} · ${shortTitle(lead ?? rest, 70)}`;
      if (!exact) { // dated headings must be unique so each keeps one anchor
        const base = heading;
        for (let n = 2; archiveHeadings.has(heading); n++) heading = `${base} (${n})`;
      }
      archiveHeadings.add(heading);
      entry = { id: exact ? record.workId : null, heading, receipts: [], body: section ? lines.slice(section.start + 1, section.end).join("\n").trim() : "" };
      entries.push(entry);
      if (exact) byId.set(record.workId, entry);
    }
    entry.receipts.push(source.trim());
    lineEdits.set(record.line, { entry, lead, title: shortTitle(rest) });
  }
  for (const [id, section] of moved) { // a moved section whose receipt was already shortened
    if (byId.has(id)) continue;
    const entry = { id, heading: section.label, receipts: [], body: lines.slice(section.start + 1, section.end).join("\n").trim() };
    entries.push(entry);
    byId.set(id, entry);
  }

  // 3. State log: keep the newest STATE_KEEP dated entries and the closing base paragraphs.
  let stateCut = null; // [startLine, endLine, entryCount]
  const stateAt = h2(STATE_HEADING);
  if (!onlyId && stateAt >= 0) {
    const from = heads[stateAt].line + 1, to = sectionEnd(heads, stateAt, lines.length);
    const paragraphs = [];
    for (let i = from; i < to; i++) {
      if (!lines[i].trim()) continue;
      const start = i;
      while (i + 1 < to && lines[i + 1].trim()) i++;
      paragraphs.push({ start, end: i + 1, dated: /^\*\*\s*\d{4}-\d{2}-\d{2}/.test(lines[start]), bold: /^\*\*/.test(lines[start]) });
    }
    const dated = paragraphs.filter((paragraph) => paragraph.dated);
    if (dated.length > STATE_KEEP) {
      let last = paragraphs.length;
      while (last > 0 && !paragraphs[last - 1].bold) last--; // closing base statements stay
      const first = paragraphs.indexOf(dated[STATE_KEEP]);
      if (first < last) stateCut = [paragraphs[first].start, paragraphs[last - 1].end, dated.length - STATE_KEEP];
    }
  }

  const stats = { sections: moved.size, receipts: lineEdits.size, stateEntries: stateCut?.[2] ?? 0, before: bookRaw.length, after: bookRaw.length };
  if (!entries.length && !stateCut) return { book: bookRaw, archive: archiveRaw, anchorMap: new Map(), stats };
  const stateText = stateCut ? lines.slice(stateCut[0], stateCut[1]).join("\n").trim() : "";

  // 4. First archive pass (text as written) fixes where each moved heading lands.
  const draft = buildArchive(archiveRaw, campaign, entries, stateText, (text) => text);
  const draftHeads = headings(draft);
  const archiveAnchor = (text, level) => draftHeads.find((entry) => entry.level === level && entry.text === text)?.anchor;

  // 5. Rewrite the book.
  const drop = new Set();
  for (const { start, end } of moved.values()) for (let i = start; i < end; i++) drop.add(i);
  if (stateCut) for (let i = stateCut[0]; i < stateCut[1]; i++) drop.add(i);
  const recordHref = (entry) => `<${relPath(posix.dirname(bookRel), archiveRel)}#${archiveAnchor(entry.heading, 3)}>`;
  const out = [];
  lines.forEach((line, index) => {
    if (drop.has(index)) return;
    const edit = lineEdits.get(index);
    if (!edit) { out.push(line); return; }
    const prefix = line.match(/^(\s*-\s*✅\s*\d{4}-\d{2}-\d{2}(?:\/\d{2})?\s*[—–-]\s*)/u)[1];
    out.push(`${prefix}${edit.lead ? `**${edit.lead}** ` : ""}${edit.title} → [record](${recordHref(edit.entry)})`);
  });
  let book = collapseBlank(out.join("\n"));

  // 6. Anchor map: every heading of the old book -> where it lives now.
  const kept = headings(book);
  const anchorMap = new Map();
  let keptIndex = 0;
  for (const entry of heads) {
    const inMoved = [...moved.values()].some((section) => entry.line >= section.start && entry.line < section.end);
    if (inMoved) {
      const anchor = archiveAnchor(entry.text, entry.level);
      if (anchor) anchorMap.set(`${bookRel}#${entry.anchor}`, { file: archiveRel, anchor });
      continue;
    }
    const now = kept[keptIndex++];
    if (now && now.anchor !== entry.anchor) anchorMap.set(`${bookRel}#${entry.anchor}`, { file: bookRel, anchor: now.anchor });
  }

  // 7. Links: inside the kept book, and inside the text that moved (second pass).
  book = relink(book, bookRel, bookRel, anchorMap);
  const archive = buildArchive(archiveRaw, campaign, entries, stateText, (text) => relink(text, bookRel, archiveRel, anchorMap));
  return { book, archive, anchorMap, stats: { ...stats, after: book.length } };
}

// ---------------------------------------------------------- generated index

/** Checklist group label for rows only the owner can close (_Conventions §2). */
export const INDEX_START = "<!-- pm:generated:start -->";
export const INDEX_END = "<!-- pm:generated:end -->";

const rowTitle = (task) => String(task.text).replace(new RegExp(`^${task.idLabel ?? ""}\\s*`), "").replace(/\s*[—–→-]+\s*(?:criteria|scope)\s*$/iu, "").replace(/\|/g, "\\|");

/**
 * The generated block of `_index.md`: this week's sprint, what is coming, what
 * waits on the owner, and the per-campaign counts.
 * @param {{campaigns:Array<{name:string, tasks:Array, bookRaw:string, shipped:number, pendingUat?:string[]}>, planning:any, today:string}} input
 */
export function renderIndexBlock({ campaigns, planning, today }) {
  const out = [INDEX_START, `_Generated ${today} by \`pnpm pm:ship\` / \`pnpm pm:index\`. Edit the checklists, not this block._`, ""];
  const anchors = new Map(campaigns.map((campaign) => [campaign.name,
    new Map(headings(campaign.bookRaw).filter((entry) => entry.level === 3).map((entry) => [normalizeWorkId(entry.text), entry.anchor]))]));
  const all = new Map();
  for (const campaign of campaigns) for (const task of campaign.tasks) if (task.idChip) all.set(task.idChip, { ...task, campaign });
  const link = (campaign, id, label = id) => {
    const anchor = anchors.get(campaign.name)?.get(id);
    return anchor ? `[${label}](<${campaign.name}/${campaign.name} — Master Book.md#${anchor}>)` : label;
  };

  const sprints = planning?.sprints ?? [];
  const sprint = sprints.find((entry) => entry.state === "active")
    ?? sprints.find((entry) => entry.state === "draft" && entry.startDate <= today && today < entry.endExclusive)
    ?? sprints.filter((entry) => entry.state === "draft" && entry.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  out.push("### This week", "");
  if (!sprint) out.push("No sprint is planned. Plan one in the Command Center (`pnpm pm` → Sprints).", "");
  else {
    const end = new Date(sprint.endExclusive + "T12:00:00Z");
    end.setUTCDate(end.getUTCDate() - 1);
    out.push(`**${sprint.name}** · ${sprint.startDate} → ${end.toISOString().slice(0, 10)} · ${sprint.state}${sprint.goal ? ` · ${sprint.goal}` : ""}`, "");
    out.push("| Item | Outcome | Size | Lane |", "|---|---|---|---|");
    for (const member of sprint.members) {
      const task = all.get(member.workId);
      out.push(task
        ? `| ${link(task.campaign, member.workId, task.idLabel)} | ${rowTitle(task)} | ${task.effort ?? "?"} | ${task.state === "done" ? "done" : task.section} |`
        : `| ${member.workId} | _closed: shipped, merged or cancelled_ | | |`);
    }
    out.push("");
  }
  // Now rows outside the sprint: ERA reports and anything promoted by hand.
  const members = new Set((sprint?.members ?? []).map((member) => member.workId));
  const extra = [...all.values()].filter((task) => task.state === "open" && task.section === "Now" && !members.has(task.idChip));
  if (extra.length) {
    out.push("Also in Now:", "");
    for (const task of extra) out.push(`- ${link(task.campaign, task.idChip, task.idLabel)} ${rowTitle(task)}${task.group ? ` · ${task.group}` : ""} _(${task.severity ?? "?"} - ${task.effort ?? "?"})_`);
    out.push("");
  }
  const upcoming = sprint ? sprints.filter((entry) => entry.state === "draft" && entry.startDate > sprint.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate)) : [];
  if (upcoming.length) {
    out.push("### Coming up", "");
    for (const entry of upcoming) out.push(`- **${entry.name}**${entry.goal ? ` — ${entry.goal}` : ""}: ${entry.members.map((member) => { const task = all.get(member.workId); return task ? link(task.campaign, member.workId, task.idLabel) : member.workId; }).join(", ")}`);
    out.push("");
  }

  const owner = campaigns.map((campaign) => ({ campaign, tasks: campaign.tasks.filter((task) => task.state === "open" && task.group === OWNER_GROUP) })).filter((entry) => entry.tasks.length);
  if (owner.length) {
    out.push("### Needs you", "", "Only you can close these: a migration to run, a device check, an account or a decision. Each item's section says exactly what to do.", "");
    for (const { campaign, tasks } of owner) {
      out.push(`**${campaign.name}**`, "");
      for (const task of tasks) out.push(`- ${link(campaign, task.idChip, task.idLabel)} ${rowTitle(task)}`);
      out.push("");
    }
  }
  const waiting = campaigns.filter((campaign) => campaign.pendingUat?.length);
  if (waiting.length) {
    out.push("### Awaiting your acceptance", "", "Built and logged as shipped; the item's section still reads `UAT: pending`. Record a result in the Command Center (Delivery → Review & sign off) or in the section.", "");
    for (const campaign of waiting) out.push(`- **${campaign.name}** (${campaign.pendingUat.length}): ${campaign.pendingUat.map((label) => link(campaign, normalizeWorkId(label), label)).join(", ")}`);
    out.push("");
  }

  out.push("### Campaigns", "", "| Campaign | Now | Next | Later | Shipped | Open |", "|---|---:|---:|---:|---:|---|");
  let totals = [0, 0, 0, 0];
  for (const campaign of campaigns) {
    const openTasks = campaign.tasks.filter((task) => task.state === "open");
    const row = ["Now", "Next", "Later"].map((lane) => openTasks.filter((task) => task.section === lane).length).concat(campaign.shipped);
    totals = totals.map((value, index) => value + row[index]);
    out.push(`| **${campaign.name}** | ${row.join(" | ")} | [Checklist](<${campaign.name}/4 - Checklist.md>) · [Master Book](<${campaign.name}/${campaign.name} — Master Book.md>) |`);
  }
  out.push(`| **Total** | ${totals.join(" | ")} | |`, "", INDEX_END);
  return out.join("\n");
}

/** Labels of `### <ID>` sections that declare `**UAT:** pending`. */
export function pendingUat(bookRaw) {
  const lines = String(bookRaw).split("\n");
  const list = headings(bookRaw);
  return list.flatMap((entry, index) => {
    if (entry.level !== 3) return [];
    const body = lines.slice(entry.line + 1, sectionEnd(list, index, lines.length)).join("\n");
    return /^\s*(?:-\s*)?\*\*UAT:\*\*\s*pending/im.test(body) ? [entry.text] : [];
  });
}

export function refreshIndex(indexRaw, block) {
  const start = indexRaw.indexOf(INDEX_START), end = indexRaw.indexOf(INDEX_END);
  if (start < 0 || end < start) return indexRaw; // no generated block: leave the file alone
  return indexRaw.slice(0, start) + block + indexRaw.slice(end + INDEX_END.length);
}

// ------------------------------------------------------------------ filesystem

function walkMd(dir, skip, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (skip(name)) continue;
    const full = join(dir, name);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) walkMd(full, skip, out);
    else if (/\.md$/i.test(name)) out.push(full);
  }
  return out;
}

export function buildIndexBlock(pmDir, today = todayIso(), read = path => readFileSync(path, "utf8"),
  books = new Map(campaignDirs(pmDir).map(name => [name, masterBookRel(pmDir, name)]))) {
  const rank = (name) => (CAMPAIGN_ORDER.indexOf(name) < 0 ? 99 : CAMPAIGN_ORDER.indexOf(name));
  const campaigns = [...books.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((name) => {
    const bookRel = books.get(name);
    const bookRaw = bookRel ? toLf(read(join(pmDir, bookRel))) : "";
    const tasks = groupedTasks(toLf(read(join(pmDir, name, CHECKLIST_NAME)))).filter((task) => ["Now", "Next", "Later"].includes(task.section));
    return { name, bookRaw, tasks, pendingUat: pendingUat(bookRaw), shipped: parseHistory(bookRaw, { campaign: name, file: bookRel || name }).records.length };
  });
  let planning = null;
  try { planning = JSON.parse(read(join(pmDir, "_Planning.json"))); } catch { /* no plan yet */ }
  return renderIndexBlock({ campaigns, planning, today });
}

function writeIndex(pmDir) {
  const abs = join(pmDir, "_index.md");
  if (!existsSync(abs)) return false;
  const raw = readFileSync(abs, "utf8");
  const next = refreshIndex(toLf(raw), buildIndexBlock(pmDir));
  if (next === toLf(raw)) return false;
  writeFileSync(abs, next.replace(/\n/g, eolOf(raw)), "utf8");
  return true;
}

/**
 * Run the whole pipeline. Returns a report; writes nothing when `dryRun`.
 * @param {{pmDir:string, repoRoot:string, ids?:string[], note?:string, date?:string, dryRun?:boolean}} options
 */
export function ship({ pmDir, repoRoot, ids = [], note = "", date = "", dryRun = false }) {
  const pmRelFromRoot = relative(repoRoot, pmDir).replace(/\\/g, "/");
  const undo = new Map(); // abs -> original raw (null = the file did not exist)
  const remember = (abs) => { if (!undo.has(abs)) undo.set(abs, existsSync(abs) ? readFileSync(abs, "utf8") : null); };
  const write = (abs, raw, eol = "\n") => {
    remember(abs);
    if (dryRun) return;
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, eol === "\n" ? raw : raw.replace(/\n/g, eol), "utf8");
  };
  const report = { ticked: [], already: [], missing: [], swept: [], compacted: [], retargeted: 0, errors: [], aborted: "" };
  const campaigns = campaignDirs(pmDir);
  const keys = ids.map(normalizeWorkId);

  // 1. tick — resolve every ID before writing anything
  const ticks = [];
  for (const id of keys) {
    let state = "missing";
    for (const campaign of campaigns) {
      const abs = join(pmDir, campaign, CHECKLIST_NAME);
      const pending = ticks.find((entry) => entry.abs === abs);
      const result = tickById(pending ? pending.raw : readFileSync(abs, "utf8"), id);
      if (result.state === "missing") continue;
      state = result.state;
      if (state === "ticked") { if (pending) pending.raw = result.raw; else ticks.push({ abs, raw: result.raw }); }
      break;
    }
    report[state].push(id);
  }
  if (report.missing.length) return { ...report, aborted: `not a checklist item: ${report.missing.join(", ")}` };
  for (const campaign of campaigns) {
    remember(join(pmDir, campaign, CHECKLIST_NAME));
    const bookRel = masterBookRel(pmDir, campaign);
    if (bookRel) remember(join(pmDir, bookRel));
  }
  remember(join(pmDir, "_index.md"));
  if (!dryRun) for (const tick of ticks) writeFileSync(tick.abs, tick.raw, "utf8");

  // 2. sweep (archive.mjs owns the Shipped Log grammar and the git-derived dates)
  const sweep = sweepAll({ pmDir, repoRoot, pmRelFromRoot, dryRun });
  report.swept = sweep.swept.map((entry) => entry.stamp);
  if (dryRun) report.swept.push(...report.ticked.map((id) => `(would tick and ship ${id})`));
  report.errors.push(...sweep.errors.map((error) => `${error.campaign}: ${error.error}`));
  // Named IDs may carry evidence and, for work finished earlier, its real date.
  if ((note.trim() || date) && !dryRun) {
    for (const entry of sweep.swept.filter((item) => keys.includes(item.idChip))) {
      const abs = join(pmDir, entry.book);
      let stamp = date ? entry.stamp.replace(/^(- ✅ )\d{4}-\d{2}-\d{2}/u, `$1${date}`) : entry.stamp;
      if (note.trim()) stamp += ` (${note.trim()})`;
      writeFileSync(abs, readFileSync(abs, "utf8").replace(entry.stamp, stamp), "utf8");
    }
  }

  // 3. compact
  const anchorMap = new Map();
  for (const campaign of campaigns) {
    const bookRel = masterBookRel(pmDir, campaign);
    if (!bookRel) continue;
    const bookAbs = join(pmDir, bookRel), archiveRel = archiveRelFor(campaign), archiveAbs = join(pmDir, archiveRel);
    const original = readFileSync(bookAbs, "utf8");
    const result = compactBook({
      bookRaw: toLf(original), campaign, bookRel, archiveRel,
      checklistRaw: toLf(readFileSync(join(pmDir, campaign, CHECKLIST_NAME), "utf8")),
      archiveRaw: existsSync(archiveAbs) ? toLf(readFileSync(archiveAbs, "utf8")) : null,
    });
    const { stats } = result;
    if (!stats.sections && !stats.receipts && !stats.stateEntries) continue;
    write(bookAbs, result.book, eolOf(original));
    write(archiveAbs, result.archive);
    for (const [key, value] of result.anchorMap) anchorMap.set(key, value);
    report.compacted.push({ campaign, ...stats });
  }

  // 4. retarget links to moved anchors in every other active document
  if (anchorMap.size) {
    const skip = (name) => name.startsWith(".") || name === "_Archive" || name === "node_modules";
    const files = [...walkMd(resolve(pmDir, ".."), skip), ...walkMd(join(repoRoot, "docs"), skip), ...walkMd(join(pmDir, SHIPPED_DIR), skip)];
    for (const abs of files) {
      const rel = relative(pmDir, abs).replace(/\\/g, "/");
      const raw = readFileSync(abs, "utf8");
      const next = relink(toLf(raw), rel, rel, anchorMap);
      if (next === toLf(raw)) continue;
      report.retargeted++;
      write(abs, next, eolOf(raw));
    }
  }

  // 5. generated index + undo state
  if (!dryRun) {
    writeIndex(pmDir);
    mkdirSync(join(pmDir, ".pm"), { recursive: true });
    writeFileSync(join(pmDir, ".pm", "last-ship.json"), JSON.stringify({
      ranAt: new Date().toISOString(),
      undo: [...undo].map(([abs, raw]) => ({ path: relative(pmDir, abs).replace(/\\/g, "/"), raw })),
    }), "utf8");
  }
  return report;
}

export function undoLastShip(pmDir) {
  const statePath = join(pmDir, ".pm", "last-ship.json");
  let saved;
  try { saved = JSON.parse(readFileSync(statePath, "utf8")); } catch { return { ok: false, error: "no ship run to undo" }; }
  if (!saved.undo?.length) return { ok: false, error: "the last ship run was already undone" };
  for (const { path, raw } of saved.undo) {
    const abs = join(pmDir, path);
    if (raw == null) rmSync(abs, { force: true });
    else { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, raw, "utf8"); }
  }
  writeFileSync(statePath, JSON.stringify({ ranAt: saved.ranAt, undo: [] }), "utf8");
  return { ok: true, ranAt: saved.ranAt, restored: saved.undo.length };
}

// ------------------------------------------------------------------------ CLI

const isCli = process.argv[1] && /ship\.mjs$/.test(process.argv[1].replace(/\\/g, "/"));
if (isCli) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const pmDir = join(repoRoot, "ERA Notes", "10 - Project Management");
  const argv = process.argv.slice(2);
  const flag = (name) => argv.includes(name);
  const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

  if (flag("--help") || flag("-h")) {
    console.log('Usage: pnpm pm:ship [ID ...] [--note "evidence"] [--date YYYY-MM-DD] [--dry-run]\n       pnpm pm:ship --undo\n       pnpm pm:index');
    process.exit(0);
  }
  if (flag("--undo")) {
    const result = undoLastShip(pmDir);
    console.log(result.ok ? `Restored ${result.restored} file(s) from the run of ${result.ranAt}.` : result.error);
    process.exit(result.ok ? 0 : 1);
  }
  if (flag("--index-only")) {
    console.log(writeIndex(pmDir) ? "_index.md refreshed." : "_index.md is current.");
    process.exit(0);
  }

  const valueOf = (name) => { const at = argv.indexOf(name); return at >= 0 ? { at, value: argv[at + 1] || "" } : { at: -1, value: "" }; };
  const note = valueOf("--note"), date = valueOf("--date");
  if (date.at >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { console.error("--date needs YYYY-MM-DD."); process.exit(1); }
  const ids = argv.filter((arg, index) => !arg.startsWith("--") && ![note.at, date.at].some((at) => at >= 0 && index === at + 1));
  const dryRun = flag("--dry-run");
  const report = ship({ pmDir, repoRoot, ids, note: note.value, date: date.value, dryRun });
  const tag = dryRun ? "[dry-run] " : "";

  if (report.aborted) { console.error(`Nothing changed — ${report.aborted}.`); process.exit(1); }
  if (report.already.length) console.log(`${tag}already ticked: ${report.already.join(", ")}`);
  for (const stamp of report.swept) console.log(`${tag}shipped  ${stamp}`);
  for (const entry of report.compacted) {
    console.log(`${tag}compact  ${entry.campaign.padEnd(22)} ${kb(entry.before)} → ${kb(entry.after)}  (${entry.sections} criteria, ${entry.receipts} receipts, ${entry.stateEntries} state entries → ${SHIPPED_DIR}/)`);
  }
  if (report.retargeted) console.log(`${tag}relinked ${report.retargeted} document(s) to archived anchors`);
  if (!report.swept.length && !report.compacted.length) console.log("Nothing to ship or compact.");
  for (const error of report.errors) console.error(`  ! ${error}`);
  if (dryRun) process.exit(0);

  let failed = report.errors.length > 0;
  for (const [script, name] of [["lint.mjs", "pm:lint"], ["check-docs.mjs", "pm:check-docs"]]) {
    const run = spawnSync(process.execPath, [join(repoRoot, "scripts", "pm", script)], { cwd: repoRoot, encoding: "utf8" });
    if (run.status === 0) continue;
    failed = true;
    console.error(`\n${name} failed:\n${(run.stdout + run.stderr).trim().split("\n").slice(-25).join("\n")}`);
  }
  console.log(failed ? "\nChecks failed. Fix the report above, or restore with: pnpm pm:ship --undo" : "PM checks pass. Undo with: pnpm pm:ship --undo");
  process.exit(failed ? 1 : 0);
}
