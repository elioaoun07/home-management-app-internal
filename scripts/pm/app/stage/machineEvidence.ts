import { ZONE_IDS, type ZoneId } from "./config";
import { LOCAL_CHECKS } from "../localRunModel";
import type { BoardFacts, ZoneRenderState } from "./types";

export const HOOK_STEPS = ["docs", "mirrors", "manifests", "typecheck", "tests", "lint"] as const;
export interface MachineEvidence {
  reached: Readonly<Record<ZoneId, boolean>>;
  supervisorIds: ReadonlySet<string>;
  installStarted: boolean;
  nativeStarted: boolean;
  commitStarted: boolean;
  hooks: readonly [boolean, boolean, boolean, boolean, boolean, boolean];
  freezeStarted: boolean;
  handoverRecorded: boolean;
  runningCheck: number | null;
}

/** Called on factual invalidation. Nothing here belongs in the frame path. */
export function machineEvidence(facts: BoardFacts): MachineEvidence {
  const scene = facts.snapshot, events = scene.events;
  const raw = scene.run.activity.filter(row => row.kind === "status");
  const supervisorIds = new Set(events.filter(event => event.kind === "event" &&
    raw.some(row => row.summary === event.summary && row.at === event.at &&
      (row.seq === undefined || event.id === `${row.job_id || "activity"}:${row.seq}`)))
    .map(event => event.id));
  const has = (summary: string) => events.some(event => supervisorIds.has(event.id) && event.summary === summary);
  const installStarted = has("Installing dependencies"), nativeStarted = has("Native session started"),
    commitStarted = has("Committing candidate"), freezeStarted = has("Freezing handover"),
    handoverRecorded = !!scene.run.handover?.handover_id;
  const hooks = [has("Hook: docs"), has("Hook: mirrors"), has("Hook: manifests"),
    has("Hook: typecheck"), has("Hook: tests"), has("Hook: lint")] as const;
  const runningCheck = LOCAL_CHECKS.findIndex(name => {
    const started = has(`${name} started`) || scene.run.checks.some(check => check.name === name &&
      !!check.started_at && Date.parse(check.started_at) <= scene.at);
    const finished = events.some(event => event.kind === "check" && event.detail === name) ||
      scene.run.checks.some(check => check.name === name && (check.finished_at || check.exit !== null || check.error));
    return started && !finished;
  });
  const seen = (kind: string) => events.some(event => event.kind === kind);
  const current = scene.phase;
  const reached: Record<ZoneId, boolean> = {
    brief: !!scene.run.run_id,
    setup: installStarted || nativeStarted || current === "preparing",
    explore: seen("read"), think: seen("message"), build: seen("edit"), bench: seen("command"),
    seal: commitStarted || hooks.some(Boolean) || !!scene.run.head,
    verify: runningCheck >= 0 || scene.run.checks.length > 0 || seen("check") || current === "checking",
    handover: freezeStarted || handoverRecorded || has("Ready for owner UAT"),
    test: current === "uat-ready" || !!scene.run.handover?.signoff ||
      !!scene.run.handover?.scenarios.some(scenario => ["pass", "fail", "blocked"].includes(scenario.result)),
    ship: ["merging", "push-pending", "revert-push-pending", "shipped", "reverted"].includes(current),
  };
  for (const zone of ZONE_IDS)
    if (facts.zones.some(value => value.id === zone &&
      (value.status === "done" || value.status === "fault" || ("done" in value && value.done === true))))
      reached[zone] = true;
  return { reached, supervisorIds, installStarted, nativeStarted, commitStarted, hooks,
    freezeStarted, handoverRecorded, runningCheck: runningCheck < 0 ? null : runningCheck };
}

export function operational(art: ZoneRenderState) {
  return !art.frame.reducedMotion && !art.facts.snapshot.run.interrupted &&
    !["failed", "cancelled", "shipped", "reverted"].includes(art.facts.snapshot.phase) &&
    !["linkdown", "signallost"].includes(art.facts.state.toLowerCase().replace(/[\s-]/gu, ""));
}
export function workBeat(art: ZoneRenderState) {
  return operational(art) && art.frame.beat?.stage === "work" ? art.frame.beat : null;
}
export function supervisorWork(art: ZoneRenderState, summary: string) {
  const beat = workBeat(art);
  return beat && art.evidence?.supervisorIds.has(beat.event.id) &&
    beat.event.summary === summary ? beat : null;
}
