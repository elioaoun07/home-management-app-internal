import { useEffect, useState } from "preact/hooks";
import { Chip } from "../../components/Primitives.jsx";
import { apiGet } from "../../app/api.js";
import { deliveryPost } from "./deliveryStore.js";

export function ContextView({ id, terminal }) {
  const [context, setContext] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [openSnapshot, setOpenSnapshot] = useState(null);

  const load = () => apiGet(`/api/delivery/context?id=${encodeURIComponent(id)}`).then(setContext).catch(() => {});
  useEffect(() => { load(); }, [id]);

  const rotate = async () => {
    await deliveryPost("control", { id, type: "rotate", payload: {} }, "Rotation queued for the next boundary");
    load();
  };
  const unpin = async (turnId) => {
    await deliveryPost("control", { id, type: "unpin", payload: { turnId } }, "Pin removed");
    load();
  };
  const loadPreview = async () => {
    setPreviewLoading(true);
    try { setPreview(await apiGet(`/api/delivery/context/preview?id=${encodeURIComponent(id)}`)); }
    finally { setPreviewLoading(false); }
  };
  const openSnapshotDetail = async (seq) => {
    if (openSnapshot?.seq === seq) { setOpenSnapshot(null); return; }
    const snapshot = await apiGet(`/api/delivery/context/snapshot?id=${encodeURIComponent(id)}&seq=${seq}`);
    setOpenSnapshot(snapshot);
  };

  if (!context) return <div class="empty">Loading context…</div>;
  const { pins, snapshots, compactions, rotations, health } = context;

  return <div>
    <section class="card">
      <h2>Context health</h2>
      <Chip tone={health.score === "healthy" ? "success" : "blocker"}>{health.score}</Chip>
      <div class="muted" style={{ marginTop: 6 }}>{rotations} rotation{rotations === 1 ? "" : "s"} so far.</div>
      {health.reasons.length > 0 && <ul style={{ marginTop: 6 }}>{health.reasons.map((r) => <li>{r}</li>)}</ul>}
      {!terminal && <button class="button" style={{ marginTop: 10 }} onClick={rotate}>Rotate context now</button>}
    </section>

    <section class="card" style={{ marginTop: 12 }}>
      <h2>Pinned excerpts</h2>
      {(!pins || pins.length === 0) && <div class="empty">No pins. Pin a transcript record from the Conversation tab to keep it verbatim in every future context package.</div>}
      {pins?.map((p) => <div class="event" key={p.turnId}>
        <div class="chip-row"><Chip>turn {p.turnId}</Chip>{p.note && <span class="muted">{p.note}</span>}<button class="button ghost" onClick={() => unpin(p.turnId)}>Unpin</button></div>
        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{p.text}</pre>
      </div>)}
    </section>

    <section class="card" style={{ marginTop: 12 }}>
      <h2>Next-turn preview</h2>
      <p class="muted">Exactly what the next turn would receive, computed live — nothing here is sent or written.</p>
      <button class="button" onClick={loadPreview} disabled={previewLoading}>{previewLoading ? "Loading…" : "Preview next turn"}</button>
      {preview && <div style={{ marginTop: 10 }}>
        <div class="muted" style={{ fontSize: 12 }}>~{preview.tokenEstimate} tokens across {preview.layers.length} layer{preview.layers.length === 1 ? "" : "s"}</div>
        {preview.layers.map((l) => <details style={{ marginTop: 6 }}><summary style={{ cursor: "pointer" }}>{l.name} <span class="muted">(~{l.tokensEst} tok, {l.source})</span></summary><pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{l.text}</pre></details>)}
      </div>}
    </section>

    <section class="card" style={{ marginTop: 12 }}>
      <h2>Compactions</h2>
      {(!compactions || compactions.length === 0) && <div class="empty">No compactions yet.</div>}
      {compactions?.map((c) => <div class="event"><Chip>{c.mode}</Chip> {c.scope?.phase} <span class="muted" style={{ fontSize: 11 }}>seq {c.seq}</span><pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{c.summaryMd}</pre></div>)}
    </section>

    <section class="card" style={{ marginTop: 12 }}>
      <h2>Snapshots</h2>
      {(!snapshots || snapshots.length === 0) && <div class="empty">No context snapshots yet — rotation, handoff, and fork all create one.</div>}
      {snapshots?.map((s) => <div class="event">
        <button class="nav-link" style={{ width: "100%", textAlign: "left" }} onClick={() => openSnapshotDetail(s.seq)}>
          <Chip>{s.reason}</Chip> {s.provider}{s.model ? ` · ${s.model}` : ""} <span class="muted" style={{ fontSize: 11 }}>~{s.tokensEstTotal} tok · seq {s.seq}</span>
        </button>
        {openSnapshot?.seq === s.seq && <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", marginTop: 6 }}>{openSnapshot.renderedMd}</pre>}
      </div>)}
    </section>
  </div>;
}
