import { useMemo, useState } from "preact/hooks";
import { Chip } from "../../components/Primitives.jsx";
import { deliveryEvents } from "./deliveryStore.js";

// DW-6: outcome-oriented timeline. Only these event types render as their
// own card — everything else (tool calls, raw messages, turn-result noise)
// is counted and folded into a single "N technical events" line per phase so
// the main view stays about decisions/outcomes/blockers, not chatter.
const CARD_TYPES = new Set([
  "phase.transition", "question.raised", "question.answered", "decision.consumed",
  "execution.paused", "execution.resumed", "config.changed", "config.change.pending-handoff",
  "validation.result", "error.fatal", "git.guard.violation", "turn.crashed.sealed",
  "runner.started", "runner.resumed", "decision.stale", "decision.rejected",
  "handoff.started", "handoff.completed", "handoff.failed", "handoff.gaps", "context.rotated",
  // Slice C (token/cost budgets, phase-turn limits, plan-step cap, validation
  // baseline) — surfaced as their own cards rather than folded into noise, so
  // an owner watching a session can see a runaway-spend warning as it
  // happens instead of only after the session blocks.
  "budget.warning", "budget.exceeded", "validation.baseline.captured", "plan.step_count.warning",
]);

const CATEGORY = {
  "phase.transition": "phase", "question.raised": "questions", "question.answered": "questions",
  "decision.consumed": "decisions", "decision.stale": "decisions", "decision.rejected": "decisions",
  "execution.paused": "config", "execution.resumed": "config",
  "config.changed": "config", "config.change.pending-handoff": "config",
  "validation.result": "phase", "error.fatal": "blockers", "git.guard.violation": "blockers",
  "turn.crashed.sealed": "blockers", "runner.started": "config", "runner.resumed": "config",
  "handoff.started": "config", "handoff.completed": "config", "handoff.failed": "blockers",
  "handoff.gaps": "questions", "context.rotated": "config",
  "budget.warning": "config", "budget.exceeded": "blockers",
  "validation.baseline.captured": "phase", "plan.step_count.warning": "decisions",
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "decisions", label: "Decisions" },
  { key: "blockers", label: "Blockers" },
  { key: "questions", label: "Questions" },
  { key: "config", label: "Config" },
  { key: "phase", label: "Phases" },
];

function isBlocking(type) { return type === "error.fatal" || type === "git.guard.violation" || type === "turn.crashed.sealed" || type === "handoff.failed" || type === "budget.exceeded"; }

function fmtTime(ts) { try { return new Date(ts).toLocaleTimeString(); } catch { return ts; } }

function summarize(event) {
  const d = event.data || {};
  switch (event.type) {
    case "phase.transition": return `Phase advanced to ${d.to}`;
    case "question.raised": return `Question raised${d.kind ? ` (${d.kind})` : ""}: ${d.text || (d.questions || []).map((q) => q.text).join("; ")}`;
    case "question.answered": return `Question ${d.questionId || ""} answered`;
    case "decision.consumed":
      if (d.decision) return `Decision: ${d.decision}${d.note ? ` — ${d.note}` : ""}`;
      if (d.retryTo) return `Retry → ${d.retryTo}`;
      if (d.answer != null) return `Question answered: ${d.answer}`;
      return "Decision recorded";
    case "decision.stale": return `Stale decision skipped (gate "${d.gate}", expected "${d.expectedGate}")`;
    case "decision.rejected": return `Decision rejected: ${d.reason}`;
    case "execution.paused": return "Delivery paused";
    case "execution.resumed": return "Delivery resumed";
    case "config.changed": return `Model/effort changed${d.to?.model ? ` → ${d.to.model}` : ""}`;
    case "config.change.pending-handoff": return `Provider switch requested: ${d.from} → ${d.to} (handoff not yet available)`;
    case "validation.result": return d.ok ? "Validation passed" : "Validation failed";
    case "error.fatal": return `Blocked: ${d.message || d.reason || "error"}`;
    case "git.guard.violation": return `Git guard violation: ${(d.violations || []).join(", ")}`;
    case "turn.crashed.sealed": return `Turn ${d.turnId} sealed as crashed after a runner restart`;
    case "runner.started": return "Runner started";
    case "runner.resumed": return "Runner resumed after restart";
    case "handoff.started": return `Provider handoff started: ${d.from} → ${d.to}`;
    case "handoff.completed": return `Provider handoff completed: ${d.from} → ${d.to}`;
    case "handoff.failed": return `Provider handoff failed: ${d.from} → ${d.to}${d.message ? ` — ${d.message}` : ""}`;
    case "handoff.gaps": return `Handoff verification found gaps: ${(d.gaps || []).join("; ") || "malformed response"}`;
    case "context.rotated": return `Context rotated (${d.reason}) — ~${d.tokensEstAfterRotation} tok after rotation`;
    case "budget.warning": return `Budget warning: ${d.totalTokens} tokens processed${d.costUsd != null ? ` (~$${d.costUsd.toFixed(2)})` : ""} — approaching the configured cap`;
    case "budget.exceeded": return `Budget exceeded: ${d.reason || `${d.totalTokens} tokens processed`}`;
    case "validation.baseline.captured": return `Validation baseline captured on a dirty workspace (${d.ok ? "passing" : "already failing"}) — later failures matching it won't spend fix-loop turns`;
    case "plan.step_count.warning": return `Plan has ${d.stepCount} steps (cap: ${d.maxPlanSteps}) — consider consolidating before approving`;
    default: return event.type;
  }
}

function cardTone(event) {
  if (isBlocking(event.type)) return "blocker";
  if (event.type === "phase.transition") return "success";
  return "";
}

export function TimelineView() {
  const [filter, setFilter] = useState("");
  const events = deliveryEvents.value;

  const { cards, noiseByPhase } = useMemo(() => {
    const cardsOut = [];
    const noise = new Map();
    let currentPhase = null;
    for (const event of events) {
      if (event.phase) currentPhase = event.phase;
      if (CARD_TYPES.has(event.type)) {
        cardsOut.push(event);
      } else {
        const key = currentPhase || "—";
        noise.set(key, (noise.get(key) || 0) + 1);
      }
    }
    return { cards: cardsOut.reverse(), noiseByPhase: noise };
  }, [events]);

  const visible = filter ? cards.filter((e) => CATEGORY[e.type] === filter) : cards;

  return <div>
    <div class="chip-row">
      {FILTERS.map((f) => <button class={`chip ${filter === f.key ? "selected" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
    </div>
    <section class="card" style={{ marginTop: 12 }}>
      {visible.length === 0 && <div class="empty">No {filter || "timeline"} events yet.</div>}
      {visible.map((event) => <div class="event" style={{ borderLeft: isBlocking(event.type) ? "3px solid var(--era-danger,#e05252)" : "3px solid transparent", paddingLeft: 8, marginBottom: 6 }}>
        <span class="mono muted" style={{ fontSize: 11 }}>{fmtTime(event.ts)}</span>{" "}
        {event.phase && <Chip>{event.phase}</Chip>}{" "}
        <span style={isBlocking(event.type) ? { color: "var(--era-danger,#e05252)", fontWeight: 600 } : {}}>{summarize(event)}</span>
      </div>)}
    </section>
    {!filter && noiseByPhase.size > 0 && <section class="card" style={{ marginTop: 12 }}>
      <div class="eyebrow">Technical activity (collapsed)</div>
      {[...noiseByPhase.entries()].map(([phase, count]) => <div class="muted" style={{ fontSize: 12 }}>{phase}: {count} tool calls / messages — see Conversation tab</div>)}
    </section>}
  </div>;
}
