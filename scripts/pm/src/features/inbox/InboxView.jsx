import { useState } from "preact/hooks";
import { byRelPath, runMutation } from "../../app/store.js";
import { scanLines } from "../../../shared/md-scan.mjs";
import { cleanInlineText } from "../../../shared/text.mjs";
import { Card, Chip, EmptyState } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";

const INBOX = "0 - Inbox.md";

/**
 * Splits the inbox into its two halves using the same line scanner the rest of
 * the app parses markdown with, so a fenced block or an indented line can never
 * be mistaken for an entry.
 *
 * `## New` holds checkboxes (the untriaged queue) and `## Processed` holds plain
 * bullets with a `→` pointer. Entries can carry continuation lines — the owner
 * types freely here on purpose — so anything between one entry and the next is
 * folded into that entry's detail rather than dropped.
 */
/**
 * @typedef {{ text: string, detail: string[], line: number, done: boolean }} InboxEntry
 * @param {string} raw
 * @returns {{ new: InboxEntry[], processed: InboxEntry[] }}
 */
export function parseInbox(raw) {
  /** @type {{ new: InboxEntry[], processed: InboxEntry[] }} */
  const out = { new: [], processed: [] };
  let section = null;
  let current = null;

  for (const entry of scanLines(String(raw || "")).lines) {
    if (entry.type === "fm" || entry.type === "in-fence" || entry.type === "fence-delim") continue;

    if (entry.type === "heading") {
      const name = String(entry.text || "").toLowerCase();
      section = entry.level === 2 && (name === "new" || name === "processed") ? name : null;
      current = null;
      continue;
    }
    if (!section) continue;
    if (entry.raw.trim().startsWith("<!--") || entry.raw.trim().startsWith(">")) continue;

    if (entry.type === "checkbox" || entry.type === "bullet") {
      const body = entry.type === "checkbox" ? entry.rest : entry.raw.replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
      current = { text: cleanInlineText(body), detail: [], line: entry.line, done: entry.state === "done" };
      out[section].push(current);
      continue;
    }
    // Continuation prose: the owner types freely here, so anything between one
    // entry and the next belongs to that entry rather than being dropped.
    if (current && entry.type === "text") current.detail.push(cleanInlineText(entry.raw));
  }
  return out;
}

/** `2026-07-22 — the idea` → a date chip plus the idea, when the line starts with one. */
function splitStamp(text) {
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)$/);
  return match ? { date: match[1], body: match[2] } : { date: null, body: text };
}

function Capture({ file }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (globalThis.PM_MODE !== "server") return null;
  const add = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const stamp = new Date().toISOString().slice(0, 10);
    const line = `- [ ] ${stamp} — ${text.trim().replace(/\s*\n\s*/g, " ")}`;
    try {
      await runMutation("append", { file, afterHeading: "New", line }, "Idea captured — run /triage-inbox to file it");
      setText("");
    } finally { setBusy(false); }
  };
  return <Card class="inbox-capture"><form onSubmit={add}>
    <div class="field"><label>Capture a raw idea or bug — your own words</label>
      <textarea rows="3" value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="e.g. bug while transferring to partner account"/></div>
    <button class="button primary" disabled={busy || !text.trim()}>{busy ? "Saving…" : "Add to inbox"}</button>
  </form></Card>;
}

export function InboxView() {
  const file = byRelPath.value.get(INBOX.toLowerCase());
  if (!file) return <EmptyState icon="inbox" title="No inbox found">`0 - Inbox.md` is missing from the PM root.</EmptyState>;
  const { new: fresh, processed } = parseInbox(file.raw);

  return <>
    <header class="page-head">
      <div><div class="eyebrow">Capture</div><h1>Idea inbox</h1><p>Raw thoughts land here in your own words. `/triage-inbox` elaborates each one, asks what it needs to, and files it as a canonical checklist item.</p></div>
      <a class="button" href={`#/doc/${encodeURI(file.relPath)}`}><Icon name="file"/>Open the file</a>
    </header>

    <Capture file={file.relPath}/>

    <section style={{marginTop:26}}>
      <div class="page-head"><div><div class="eyebrow">Untriaged</div><h2>New <span class="count">{fresh.length}</span></h2></div></div>
      {fresh.length === 0
        ? <EmptyState icon="check" title="Inbox zero">Nothing waiting to be triaged.</EmptyState>
        : <div class="inbox-list">{fresh.map((entry) => {
            const { date, body } = splitStamp(entry.text);
            return <Card key={entry.line} class="inbox-entry">
              {date && <Chip>{date}</Chip>}
              <strong>{body}</strong>
              {entry.detail.length > 0 && <div class="muted inbox-detail">{entry.detail.join(" ")}</div>}
            </Card>;
          })}</div>}
      {fresh.length > 0 && <p class="muted" style={{marginTop:14}}>Run <code>/triage-inbox</code> in Claude Code to work through these — it never implements, it only files.</p>}
    </section>

    <section style={{marginTop:30}}>
      <details>
        <summary class="inbox-summary">Processed <span class="count">{processed.length}</span></summary>
        <div class="inbox-list" style={{marginTop:12}}>{processed.map((entry) => {
          const { date, body } = splitStamp(entry.text);
          return <Card key={entry.line} class="inbox-entry done">{date && <Chip>{date}</Chip>}<span>{body}</span></Card>;
        })}</div>
      </details>
    </section>
  </>;
}
