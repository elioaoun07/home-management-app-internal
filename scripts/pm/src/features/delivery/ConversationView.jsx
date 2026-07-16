import { useEffect, useMemo, useState } from "preact/hooks";
import { Chip } from "../../components/Primitives.jsx";
import {
  deliverySearchQuery,
  deliverySearchResults,
  deliveryTranscriptByTurn,
  deliveryTurns,
  loadDeliveryTranscript,
  loadDeliveryTurns,
  searchDeliveryTranscript,
} from "./deliveryStore.js";

const RECORD_KIND_LABEL = {
  "prompt": "Prompt", "assistant.text": "Message", "assistant.reasoning": "Reasoning",
  "tool.use": "Tool call", "tool.result": "Tool result", "command": "Command",
  "file.change": "File change", "web.search": "Web search", "todo": "Todo",
  "system.init": "Session init", "system.compact": "Compacted", "turn.result": "Turn result", "error": "Error",
};
const KIND_FILTERS = Object.keys(RECORD_KIND_LABEL);

function fmtTime(ts) { try { return new Date(ts).toLocaleTimeString(); } catch { return ts; } }

export function ConversationView({ id }) {
  const [expanded, setExpanded] = useState({}); // turnId -> bool
  const [phaseFilter, setPhaseFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [query, setQuery] = useState(deliverySearchQuery.value || "");

  useEffect(() => { loadDeliveryTurns(id, { reset: true }); }, [id]);

  const turns = deliveryTurns.value;
  const phases = useMemo(() => [...new Set(turns.map((t) => t.phase).filter(Boolean))], [turns]);
  const visibleTurns = useMemo(() => (phaseFilter ? turns.filter((t) => t.phase === phaseFilter) : turns), [turns, phaseFilter]);
  const grouped = useMemo(() => {
    const byPhase = new Map();
    for (const turn of visibleTurns) {
      const key = turn.phase || "—";
      if (!byPhase.has(key)) byPhase.set(key, []);
      byPhase.get(key).push(turn);
    }
    return [...byPhase.entries()];
  }, [visibleTurns]);

  const toggle = (turnId) => {
    const next = !expanded[turnId];
    setExpanded({ ...expanded, [turnId]: next });
    if (next && !deliveryTranscriptByTurn.value[turnId]) loadDeliveryTranscript(id, turnId);
  };
  const expandAll = () => setExpanded(Object.fromEntries(visibleTurns.map((t) => [t.turnId, true])));
  const collapseAll = () => setExpanded({});

  const runSearch = async () => {
    deliverySearchQuery.value = query;
    await searchDeliveryTranscript(id, { q: query, kinds: kindFilter || undefined, phase: phaseFilter || undefined });
  };

  const results = deliverySearchResults.value;

  return <div>
    <section class="card">
      <h2>Search</h2>
      <div class="chip-row">
        <input style={{ flex: 1, minWidth: 200 }} value={query} onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Search prompts, messages, tool output…" />
        <button class="button primary" onClick={runSearch}>Search</button>
        {results && <button class="button ghost" onClick={() => { deliverySearchResults.value = null; setQuery(""); }}>Clear</button>}
      </div>
      {phases.length > 1 && <div class="chip-row" style={{ marginTop: 8 }}>
        <span class="muted" style={{ fontSize: 11 }}>Phase:</span>
        <button class={`chip ${!phaseFilter ? "selected" : ""}`} onClick={() => setPhaseFilter("")}>All</button>
        {phases.map((p) => <button class={`chip ${phaseFilter === p ? "selected" : ""}`} onClick={() => setPhaseFilter(p)}>{p}</button>)}
      </div>}
      <div class="chip-row" style={{ marginTop: 8 }}>
        <span class="muted" style={{ fontSize: 11 }}>Kind:</span>
        <button class={`chip ${!kindFilter ? "selected" : ""}`} onClick={() => setKindFilter("")}>All</button>
        {KIND_FILTERS.map((k) => <button class={`chip ${kindFilter === k ? "selected" : ""}`} onClick={() => setKindFilter(k)}>{RECORD_KIND_LABEL[k]}</button>)}
      </div>
      {results && <div style={{ marginTop: 10 }}>
        <div class="muted" style={{ fontSize: 12 }}>{results.matches.length} match{results.matches.length === 1 ? "" : "es"}{results.truncated ? " (capped)" : ""}</div>
        {results.matches.map((m) => (
          <button class="nav-link" style={{ display: "block", textAlign: "left", width: "100%" }}
            onClick={() => { setPhaseFilter(""); setExpanded((prev) => ({ ...prev, [m.turnId]: true })); loadDeliveryTranscript(id, m.turnId); }}>
            <span class="mono muted" style={{ fontSize: 10 }}>{m.phase} · turn {m.turnId} · {RECORD_KIND_LABEL[m.kind] || m.kind}</span>
            <div style={{ fontSize: 12 }}>{highlight(m.snippet, query)}</div>
          </button>
        ))}
      </div>}
    </section>

    <div class="chip-row" style={{ marginTop: 12 }}>
      <button class="button" onClick={expandAll}>Expand all</button>
      <button class="button" onClick={collapseAll}>Collapse all</button>
    </div>

    {grouped.length === 0 && <div class="empty" style={{ marginTop: 12 }}>No turns captured yet for this session{turns.length === 0 ? " (pre-DW-1 sessions have no transcript)." : "."}</div>}

    {grouped.map(([phase, phaseTurns]) => <section class="card" style={{ marginTop: 12 }}>
      <h2>{phase}</h2>
      {phaseTurns.map((turn) => <TurnCard key={turn.turnId} id={id} turn={turn} expanded={!!expanded[turn.turnId]} onToggle={() => toggle(turn.turnId)} />)}
    </section>)}
  </div>;
}

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

function resultTone(result) {
  if (result === "ok") return "success";
  if (result === "failed" || result === "guard-violation") return "blocker";
  if (result === "crashed" || result === "aborted") return "blocker";
  return "";
}

function TurnCard({ id, turn, expanded, onToggle }) {
  const cached = deliveryTranscriptByTurn.value[turn.turnId];
  return <div class="event" style={{ borderBottom: "1px solid var(--era-border,rgba(255,255,255,0.06))", paddingBottom: 8, marginBottom: 8 }}>
    <button class="nav-link" style={{ width: "100%", textAlign: "left" }} onClick={onToggle}>
      <span class="chip-row" style={{ display: "inline-flex" }}>
        <strong>{expanded ? "▾" : "▸"} Turn {turn.turnId}</strong>
        <Chip>{turn.agent}</Chip>
        <Chip>{turn.provider}{turn.model ? ` · ${turn.model}` : ""}{turn.effort ? ` · ${turn.effort}` : ""}</Chip>
        <Chip tone={resultTone(turn.result)}>{turn.result}</Chip>
        <Chip>{turn.strategy}</Chip>
        {turn.usage && <span class="mono muted" style={{ fontSize: 11 }}>
          in {turn.usage.input || 0} · cached {turn.usage.cachedRead || 0} · out {turn.usage.output || 0}
        </span>}
        {typeof turn.durationMs === "number" && <span class="muted" style={{ fontSize: 11 }}>{Math.round(turn.durationMs / 100) / 10}s</span>}
      </span>
    </button>
    {expanded && <div style={{ marginTop: 6, paddingLeft: 14 }}>
      {!cached && <div class="muted" style={{ fontSize: 12 }}>Loading…</div>}
      {cached && cached.records.length === 0 && <div class="muted" style={{ fontSize: 12 }}>No records captured.</div>}
      {cached && cached.records.map((record) => <RecordRow key={record.seq} record={record} />)}
    </div>}
  </div>;
}

function RecordRow({ record }) {
  const [open, setOpen] = useState(record.kind !== "tool.use" && record.kind !== "tool.result" && record.kind !== "command");
  const isError = record.isError || record.kind === "error";
  const label = RECORD_KIND_LABEL[record.kind] || record.kind;
  return <div style={{ marginBottom: 4 }}>
    <button class="nav-link" style={{ width: "100%", textAlign: "left" }} onClick={() => setOpen(!open)}>
      <span class="mono muted" style={{ fontSize: 10 }}>#{record.seq}</span>{" "}
      <strong style={isError ? { color: "var(--era-danger,#e05252)" } : {}}>{label}</strong>
      {record.tool && <Chip>{record.tool}</Chip>}
      {record.truncated && <Chip>truncated ({record.truncated.originalBytes} B)</Chip>}
    </button>
    {open && <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", margin: "4px 0 0 14px" }}>
      {record.kind === "prompt"
        ? <span class="muted">→ {record.promptFile}</span>
        : (record.text || record.output || (record.input ? JSON.stringify(record.input) : "") || "(no content)")}
    </pre>}
  </div>;
}
