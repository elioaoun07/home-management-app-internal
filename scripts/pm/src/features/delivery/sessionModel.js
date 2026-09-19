import { isTerminal, phaseLabel } from "../../lib/product.js";

export const STAGES = [
  { label: "Scope", phases: ["SELECTED", "DISCOVERY", "SPEC_READY"] },
  { label: "Plan", phases: ["PLAN", "PLANNING", "PLAN_READY"] },
  { label: "Build", phases: ["BUILDING"] },
  { label: "Verify", phases: ["VALIDATING", "REVIEWING", "UAT_PREP"] },
  { label: "Review", phases: ["UAT_READY"] },
  { label: "Outcome", phases: ["ACCEPTED", "SHIPPED", "CANCELLED", "FAILED"] },
];

export function activityText(event) {
  const d = event.data || {};
  switch (event.type) {
    case "phase.transition": return phaseLabel(d.to);
    case "turn.started": return `${phaseLabel(event.phase)} started`;
    case "turn.completed": return `${phaseLabel(event.phase)} update recorded`;
    case "build.step.done": return `${d.stepId || "Build step"} completed`;
    case "validation.command.started": return `Checking ${d.command || "workspace"}`;
    case "validation.command.finished": return `${d.command || "Check"}: ${d.timedOut ? "timed out" : d.ok ? "passed" : "failed"}`;
    case "validation.result": return d.ok === true ? "Checks passed" : d.ok === false ? "Checks failed" : "Check results recorded";
    case "question.raised": return d.text || d.questions?.[0]?.text || "Question raised";
    case "question.answered": return "Answer recorded";
    case "decision.consumed": return `Decision: ${d.decision || "recorded"}`;
    case "budget.warning": return "Approaching budget limit";
    case "budget.exhausted": return "Budget limit reached";
    case "execution.paused": return "Run paused";
    case "execution.resumed": return "Run resumed";
    case "error.fatal": case "runner.error": return d.message || "Run stopped with an error";
    case "context.rotated": return "Context refreshed";
    case "finish.package.written": return "Handoff package saved";
    default: return null;
  }
}

/** @param {{ steps?: Array<{ id: string, description?: string, title?: string, paths?: string[] }> } | null} plan */
export function sessionModel(detail, events = [], plan = null) {
  const state = detail.state;
  const phase = state.awaiting?.returnTo || (state.state === "BLOCKED" ? state.lastError?.phase : null) || state.state;
  const stage = STAGES.findIndex((entry) => entry.phases.includes(isTerminal(state.state) ? state.state : phase));
  const completed = new Set(events.filter((e) => e.type === "build.step.done").map((e) => e.data?.stepId));
  const buildFinished = events.some((e) => e.type === "phase.transition" && e.phase === "BUILDING" && e.data?.to === "VALIDATING");
  const steps = (Array.isArray(plan?.steps) ? plan.steps : []).map((step, index) => ({ ...step,
    status: buildFinished || completed.has(step.id) || state.build?.mode === "plan" && index < state.build.stepIndex ? "done" : state.state === "BUILDING" && state.build?.mode === "plan" && index === state.build.stepIndex ? "current" : "next",
  }));
  const recent = events.map((event) => ({ ...event, label: activityText(event) })).filter((event) => event.label).slice(-12).reverse();
  const visited = new Set(events.filter((e) => e.type === "phase.transition").flatMap((e) => [e.phase, e.data?.to]));
  return { stage, visited, steps, recent, running: !!detail.runner?.alive && !state.awaiting && !state.execution?.paused && !isTerminal(state.state), terminal: isTerminal(state.state) };
}
