// One history parser for every PM surface: the React app (local and on the phone
// through the relay corpus), the classic reference build and the bridge's legacy
// `history` row. Command Center Phase 6 (PM Tooling R62).
//
// A history record is a dated receipt line, not a unit of completed work:
//   - identity is `exact` only when the bold lead names exactly one canonical ID
//     (optionally followed by `: title` or a non-partial `(alias)`); a lead that
//     mentions IDs in any other way (ranges, pairs, partials, follow-ups) is
//     `referenced`, and anything else is `unidentified`;
//   - a date is `day`, a same-month `range` (`2026-07-28/30`) or `unrecorded` —
//     nothing here invents a day for a record that does not state one;
//   - only bullets inside the campaign's `## Shipped Log` (✅) or its section of
//     the Cancelled Log (❌) are records. Session logs, Pain Inventory and prose
//     are not; other non-empty lines in those sections are returned as `notes`
//     so incomplete coverage stays visible.
import { cleanInlineText } from "./text.mjs";
import { CHIP_ID_SOURCE, normalizeWorkId, workIds } from "./work-id.mjs";

export const SHIPPED_LOG = "Shipped Log";
export const CANCELLED_LOG_FILE = "_Archive/Cancelled Log.md";

const MARK = { Shipped: "✅", Cancelled: "❌" };
const BULLET = /^\s*-\s*(✅|❌)\s*(.*)$/u;
const DAY = /^(\d{4}-\d{2})-(\d{2})(?:\/(\d{2}))?\s*[—–-]\s*(.*)$/u;
const NOTE_DATE = /^\*\(([^)]*)\)\*\s*[—–-]\s*(.*)$/u;
const EXACT_LEAD = new RegExp(String.raw`^(${CHIP_ID_SOURCE})(?:\s*[:—–]\s+\S.*|\s+-\s+\S.*|\s*\(([^)]*)\))?$`, "i");
const LOOKS_LIKE_ID = /\b(?:[A-Z]{1,5}-|R)\d/;

/** Lines of a `level` section, with their absolute line numbers. */
function sectionLines(raw, title, level) {
  const lines = String(raw || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${"#".repeat(level)} ${title}`);
  if (start < 0) return null;
  const boundary = new RegExp(`^#{1,${level}} `);
  const out = [];
  for (let index = start + 1; index < lines.length && !boundary.test(lines[index]); index++) {
    out.push({ text: lines[index], line: index });
  }
  return out;
}

/** exact | referenced | unidentified, from the bold lead of a receipt. */
export function receiptIdentity(lead) {
  const trimmed = String(lead || "").trim().replace(/[.:;,]+$/, "").trim();
  const ids = workIds(trimmed);
  const exact = trimmed.match(EXACT_LEAD);
  if (exact) {
    const id = normalizeWorkId(exact[1]);
    const canonical = workIds(exact[1])[0] === id;
    const partial = exact[2] != null && (/\bpartial\b/i.test(exact[2]) || workIds(exact[2]).length > 0);
    if (canonical && !partial) return { identity: "exact", workId: id, ids: [id] };
  }
  if (ids.length || LOOKS_LIKE_ID.test(trimmed)) return { identity: "referenced", workId: null, ids };
  return { identity: "unidentified", workId: null, ids: [] };
}

/**
 * Records and notes for one campaign.
 *
 * @param {string} raw  the Master Book (status Shipped) or the Cancelled Log (status Cancelled)
 * @param {{campaign:string, file:string, status?:"Shipped"|"Cancelled"}} options
 */
export function parseHistory(raw, { campaign, file, status = "Shipped" }) {
  const lines = sectionLines(raw, status === "Cancelled" ? campaign : SHIPPED_LOG, 2);
  const records = [];
  const notes = [];
  if (!lines) return { records, notes, found: false };
  let fenced = false;
  lines.forEach(({ text, line }, index) => {
    if (/^\s*```/.test(text)) {
      fenced = !fenced;
      return;
    }
    if (fenced || !text.trim()) return;
    const bullet = text.match(BULLET);
    if (!bullet || bullet[1] !== MARK[status]) {
      notes.push({ campaign, file, line, text: cleanInlineText(text.replace(/^\s*-\s*/, "")) });
      return;
    }
    let body = bullet[2];
    let date = "";
    let dateEnd = null;
    let datePrecision = "unrecorded";
    let dateNote = null;
    const day = body.match(DAY);
    const noted = body.match(NOTE_DATE);
    if (day) {
      date = `${day[1]}-${day[2]}`;
      dateEnd = day[3] ? `${day[1]}-${day[3]}` : null;
      datePrecision = dateEnd && dateEnd !== date ? "range" : "day";
      if (datePrecision === "day") dateEnd = null;
      body = day[4];
    } else if (noted) {
      dateNote = noted[1];
      body = noted[2];
    }
    const lead = body.match(/^\*\*([^*]+)\*\*/)?.[1] || null;
    records.push({
      key: `${file}:${index}`,
      date,
      dateEnd,
      datePrecision,
      dateNote,
      // Source spelling of the bold lead, kept for existing readers.
      id: lead,
      ...receiptIdentity(lead),
      text: cleanInlineText(body),
      raw: body,
      campaign,
      file,
      line,
      status,
    });
  });
  return { records, notes, found: true };
}

/** Records only, in the shape existing read models consume. */
export const historyRecords = (raw, options) => parseHistory(raw, options).records;
