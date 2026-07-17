import { useEffect, useMemo } from "preact/hooks";
import { deliveryTurns, loadDeliveryTurns } from "./deliveryStore.js";

function emptyTotals() { return { input: 0, cachedRead: 0, cacheCreation: 0, output: 0, reasoningOutput: 0, costUsd: null, costEstUsd: null }; }
function add(target, turn) {
  const u = turn.usage || {};
  target.input += u.input || 0; target.cachedRead += u.cachedRead || 0; target.cacheCreation += u.cacheCreation || 0;
  target.output += u.output || 0; target.reasoningOutput += u.reasoningOutput || 0;
  if (typeof turn.costUsd === "number") target.costUsd = (target.costUsd || 0) + turn.costUsd;
  if (typeof turn.costEstUsd === "number") target.costEstUsd = (target.costEstUsd || 0) + turn.costEstUsd;
}
function fmtCost(v) { return v == null ? "—" : `$${v.toFixed(4)}`; }

export function UsageView({ id, legacyUsage, budgets = {} }) {
  useEffect(() => { loadDeliveryTurns(id, { reset: true }); }, [id]);
  const turns = deliveryTurns.value;

  const total = useMemo(() => { const t = emptyTotals(); for (const turn of turns) add(t, turn); return t; }, [turns]);
  const processedTokens = total.input + total.cachedRead + total.cacheCreation + total.output;
  const maxTokens = budgets?.maxSessionTokens;
  const warnTokens = budgets?.warnSessionTokens;
  const overBudget = typeof maxTokens === "number" && processedTokens >= maxTokens;
  const warnBudget = !overBudget && typeof warnTokens === "number" && processedTokens >= warnTokens;
  const byPhase = useMemo(() => {
    const map = new Map();
    for (const turn of turns) {
      const key = turn.phase || "—";
      if (!map.has(key)) map.set(key, emptyTotals());
      add(map.get(key), turn);
    }
    return [...map.entries()];
  }, [turns]);

  if (!turns.length) {
    // v1 sessions have no per-turn transcript — fall back to the legacy session-level total.
    const legacy = legacyUsage?.total || {};
    return <section class="card"><h2>Usage</h2>
      <div class="stat-value">{(legacy.input || 0) + (legacy.output || 0)}</div>
      <div class="muted">total tokens (pre-DW-1 session — no per-turn breakdown captured)</div>
    </section>;
  }

  return <div>
    <section class="card">
      <h2>Session totals</h2>
      <table class="usage-table">
        <thead><tr><th>Input</th><th>Cached read</th><th>Cache write</th><th>Output</th><th>Reasoning</th><th>Cost (reported)</th><th>Cost (est.)</th></tr></thead>
        <tbody><tr>
          <td>{total.input}</td><td>{total.cachedRead}</td><td>{total.cacheCreation}</td><td>{total.output}</td><td>{total.reasoningOutput}</td>
          <td>{fmtCost(total.costUsd)}</td><td>{fmtCost(total.costEstUsd)}</td>
        </tr></tbody>
      </table>
      {typeof maxTokens === "number" && <div class="muted" style={{ fontSize: 12, marginTop: 8, color: overBudget ? "var(--era-danger,#e05252)" : warnBudget ? "var(--era-amber,#e0a852)" : undefined }}>
        {processedTokens.toLocaleString()} / {maxTokens.toLocaleString()} processed-token session budget
        {overBudget ? " — exceeded; further turns are blocked" : warnBudget ? " — approaching cap" : ""}
      </div>}
    </section>

    <section class="card" style={{ marginTop: 12 }}>
      <h2>Per phase</h2>
      <table class="usage-table">
        <thead><tr><th>Phase</th><th>Input</th><th>Cached read</th><th>Output</th><th>Cost (est.)</th></tr></thead>
        <tbody>{byPhase.map(([phase, row]) => <tr>
          <td>{phase}</td><td>{row.input}</td><td>{row.cachedRead}</td><td>{row.output}</td><td>{fmtCost(row.costEstUsd)}</td>
        </tr>)}</tbody>
      </table>
    </section>

    <section class="card" style={{ marginTop: 12 }}>
      <h2>Per turn</h2>
      <table class="usage-table">
        <thead><tr><th>Turn</th><th>Phase</th><th>Provider · model</th><th>Effort</th><th>Strategy</th><th>Input</th><th>Cached</th><th>Output</th><th>Context</th><th>Cost (est.)</th></tr></thead>
        <tbody>{turns.map((turn) => <tr>
          <td class="mono">{turn.turnId}</td>
          <td>{turn.phase}</td>
          <td>{turn.provider}{turn.model ? ` · ${turn.model}` : ""}</td>
          <td>{turn.effort || "—"}</td>
          <td>{turn.strategy}</td>
          <td>{turn.usage?.input || 0}</td>
          <td>{turn.usage?.cachedRead || 0}</td>
          <td>{turn.usage?.output || 0}</td>
          <td>{turn.context?.occupancyTokens != null ? `${turn.context.occupancyTokens}${turn.context.pctUsed != null ? ` (${Math.round(turn.context.pctUsed * 100)}%)` : ""}` : "—"}</td>
          <td>{fmtCost(turn.costEstUsd)}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </div>;
}
