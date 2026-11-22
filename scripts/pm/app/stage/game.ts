import type { Cockpit } from "../cockpitTypes";
import { gameFacts } from "../gameModel";
import type { LocalRunView } from "../LocalDelivery";
import { LIVENESS } from "../localRunLiveness";
import type { LocalScene, LocalTimeline } from "../localRunScene";
import type { AttentionItem } from "../localRunAttention";
import type { ZoneBoardState } from "./zoneModel";
import { stageStartRecorded } from "./history";

export type FlowTier = "WARM" | "FLOW" | "OVERDRIVE" | null;
export type StageRank = "S" | "A" | "B" | null;
export interface StageBadge {
  id: string;
  label: string;
  fact: string;
  at: number;
}
export interface StageGameFacts {
  combo: number;
  peakCombo: number;
  tier: FlowTier;
  charge: number;
  badges: StageBadge[];
  rank: StageRank;
  rubric: string;
  everStale: boolean | null;
  completeHistory: boolean;
  firstAttempt: boolean;
  streak: number | null;
}

export interface BoardSplit {
  group: "setup" | "build" | "verify" | "test" | "ship";
  label: "SETUP" | "BUILD" | "VERIFY" | "TEST" | "SHIP";
  ms: number;
  partial: boolean;
}
export interface BoardGameFacts {
  line: number;
  lineTotal: 11;
  turn: "ERA'S TURN" | "YOUR TURN" | null;
  splits: BoardSplit[];
  retry: boolean;
  cleanDesk: boolean;
  badges: StageBadge[];
}

/** R123 adds board facts without changing R122's flow/rank/streak rules. Empty
 * or lost history cannot become a completed desk or invented stage duration. */
export function localBoardGame(
  timeline: LocalTimeline,
  scene: LocalScene,
  zones: ZoneBoardState,
  attention: readonly AttentionItem[],
): BoardGameFacts {
  const acts = attention.filter((item) => item.level === "act");
  const cleanDesk =
    acts.length > 0 && acts.every((item) => item.state === "done");
  const active =
    !scene.run.interrupted &&
    [
      "preparing",
      "building",
      "checking",
      "uat-ready",
      "merging",
      "push-pending",
      "revert-push-pending",
    ].includes(scene.phase);
  const groups: BoardSplit["group"][] = [
    "setup",
    "build",
    "verify",
    "test",
    "ship",
  ];
  const phaseGroup: Record<string, BoardSplit["group"]> = {
    preparing: "setup",
    building: "build",
    checking: "verify",
    "uat-ready": "test",
    merging: "ship",
    "push-pending": "ship",
    "revert-push-pending": "ship",
    shipped: "ship",
    reverted: "ship",
  };
  const durations = new Map<BoardSplit["group"], number>();
  for (const band of timeline.bands) {
    const group = phaseGroup[band.phase];
    const end = Math.min(scene.at, band.end);
    if (group && band.at <= scene.at && end >= band.at)
      durations.set(group, (durations.get(group) ?? 0) + end - band.at);
  }
  const retryPrefix = `delivery/${scene.run.work.id}-`;
  return {
    line: zones.doneCount,
    lineTotal: 11,
    turn: acts.some((item) => item.state === "open")
      ? "YOUR TURN"
      : active
        ? "ERA'S TURN"
        : null,
    splits: groups
      .filter((group) => durations.has(group))
      .map((group) => ({
        group,
        label: group.toUpperCase() as BoardSplit["label"],
        ms: durations.get(group)!,
        partial: timeline.truncated,
      })),
    retry:
      scene.run.branch.startsWith(retryPrefix) &&
      scene.run.branch.length > retryPrefix.length,
    cleanDesk,
    badges: cleanDesk
      ? [
          {
            id: "clean-desk",
            label: "Clean desk",
            fact: `${acts.length}/${acts.length}`,
            at: scene.at,
          },
        ]
      : [],
  };
}

/** Same normalized input+output convention as deliveryReviewModel.tokenSplit.
 * Cached/reasoning counters are subsets or separately reported detail; adding
 * them again would count the same tokens twice. Missing counts stay unknown. */
export function localRunTokens(usage: LocalRunView["usage"]): number | null {
  if (!usage) return null;
  const known = (value: number | string | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (known(usage.input) && known(usage.output))
    return usage.input + usage.output;
  if (known(usage.total_tokens)) return usage.total_tokens;
  if (known(usage.input_tokens) && known(usage.output_tokens))
    return usage.input_tokens + usage.output_tokens;
  return null;
}

/** Reuse the canonical clean-session evidence. An unordered/pending snapshot
 * never becomes a synthetic zero or an independently calculated streak. */
export function cleanStageStreak(data?: Cockpit | null): number | null {
  if (!data || data.pending || data.stale) return null;
  const facts = gameFacts(data);
  return facts.unordered ? null : facts.streak.length;
}

export interface CleanShipIncrement {
  runId: string;
  sessionId: string;
  from: number;
  to: number;
  amount: 1;
}

/** Local ingest supplies an explicit runId and candidate head. A phase change
 * cannot substitute for that join or for the canonical six-check clean verdict.
 * Unknown/older snapshots and unrelated clean sessions never animate this run. */
export function cleanShipIncrement(
  previous: Cockpit | null | undefined,
  next: Cockpit | null | undefined,
  run: Pick<LocalRunView, "run_id" | "phase" | "head" | "interrupted">,
): CleanShipIncrement | null {
  if (
    run.phase !== "shipped" ||
    run.interrupted ||
    !run.head ||
    !previous ||
    !next ||
    previous.pending ||
    next.pending ||
    previous.stale ||
    next.stale
  )
    return null;
  const before = gameFacts(previous),
    after = gameFacts(next);
  if (
    before.unordered ||
    after.unordered ||
    after.streak.length !== before.streak.length + 1
  )
    return null;
  const current = after.streak[0];
  if (
    !current ||
    current.session.runId !== run.run_id ||
    current.session.head !== run.head ||
    before.streak.some((record) => record.session.id === current.session.id)
  )
    return null;
  return {
    runId: run.run_id,
    sessionId: current.session.id,
    from: before.streak.length,
    to: after.streak.length,
    amount: 1,
  };
}

const time = (value: string | undefined) => {
  const at = value ? Date.parse(value) : NaN;
  return Number.isFinite(at) ? at : null;
};

/** A gap can prove a stale period. Its absence proves "never stale" only when
 * the retained trace includes the actual beginning and has not lost rows. */
function staleEvidence(
  timeline: LocalTimeline,
  scene: LocalScene,
  complete: boolean,
): boolean | null {
  const signals = [
    ...scene.events.map((event) => Date.parse(event.at)),
    ...scene.run.checks.flatMap((check) => {
      const at = time(check.finished_at);
      return at === null ? [] : [at];
    }),
  ]
    .filter((at) => at <= scene.at)
    .sort((a, b) => a - b);
  for (let index = 0; index < signals.length; index += 1) {
    const start = signals[index],
      end = signals[index + 1] ?? scene.at;
    const phase =
      timeline.bands.findLast((band) => band.at <= start)?.phase ?? "preparing";
    const threshold =
      LIVENESS.staleAfter[phase as keyof typeof LIVENESS.staleAfter];
    if (threshold !== undefined && end - start > threshold) return true;
  }
  return complete ? false : null;
}

/** Every award is a published rule over recorded rows/checks/settings. The
 * returned counts are retained evidence, not a score or completion estimate. */
export function localStageGame(
  timeline: LocalTimeline,
  scene: LocalScene,
  streak: number | null = null,
): StageGameFacts {
  const events = scene.events;
  const first = events[0];
  const completeHistory =
    !timeline.truncated &&
    stageStartRecorded(timeline.events) &&
    first?.id === timeline.events[0]?.id &&
    timeline.start === time(first?.at);
  const firstAttempt = scene.run.branch === `delivery/${scene.run.work.id}`;
  const badges: StageBadge[] = [];
  const add = (id: string, label: string, fact: string, at: number) => {
    if (!badges.some((badge) => badge.id === id))
      badges.push({ id, label, fact, at });
  };
  let reads = 0,
    edits = 0,
    chain = 0,
    peakCombo = 0,
    previous: number | null = null;
  for (const [index, event] of events.entries()) {
    const at = Date.parse(event.at);
    chain =
      previous !== null && at - previous <= LIVENESS.thinkingAfter
        ? chain + 1
        : 1;
    previous = at;
    peakCombo = Math.max(peakCombo, chain);
    if (index === 0 && completeHistory)
      add("contact", "First contact", event.label, at);
    if (event.kind === "read") {
      reads += 1;
      if (reads >= 5) add("scout", "Scout", "5 Explore", at);
      if (reads >= 15) add("cartographer", "Cartographer", "15 Explore", at);
    }
    if (event.kind === "edit") {
      edits += 1;
      if (edits === 1 && completeHistory)
        add("cut", "First cut", event.label, at);
      if (edits >= 5) add("builder", "Builder", "5 Edits", at);
      if (edits >= 10) add("architect", "Architect", "10 Edits", at);
    }
    if (chain >= 3) add("warm", "Warm", "FLOW ×3", at);
    if (chain >= 6) add("flow", "Flow", "FLOW ×6", at);
    if (chain >= 10) add("overdrive", "Overdrive", "FLOW ×10", at);
    if (event.summary === "Ready for owner UAT") {
      add("handover", "Handover", "Your turn", at);
      if (
        completeHistory &&
        timeline.start !== null &&
        at - timeline.start <= 600_000
      )
        add(
          "sprint",
          "Sprint",
          `${Math.floor((at - timeline.start) / 60000)}:${String(Math.floor((at - timeline.start) / 1000) % 60).padStart(2, "0")}`,
          at,
        );
    }
  }
  const age = previous === null ? Infinity : Math.max(0, scene.at - previous);
  const active =
    !scene.run.interrupted &&
    ["preparing", "building", "checking", "merging"].includes(scene.phase);
  const combo = active && age <= LIVENESS.thinkingAfter ? chain : 0;
  const charge =
    combo === 0 ? 0 : age <= 15_000 ? 1 : Math.max(0, (20_000 - age) / 5000);
  for (const seal of scene.seals) {
    if (seal.state === "passed")
      add(
        `gate:${seal.name}`,
        `Gate: ${seal.name}`,
        `${seal.name}: 0`,
        seal.at ?? scene.at,
      );
  }
  if (
    scene.seals.length === 4 &&
    scene.seals.every((seal) => seal.state === "passed")
  )
    add(
      "full-seal",
      "Full seal",
      "4/4",
      Math.max(...scene.seals.map((seal) => seal.at ?? scene.at)),
    );
  if (scene.phase === "uat-ready")
    add("handover", "Handover", "Your turn", scene.at);
  if (scene.run.handover?.acceptance.state === "accepted")
    add("accepted", "Accepted", scene.run.handover.acceptance.state, scene.at);
  const published = !!scene.run.pushed || (scene.phase === "shipped" && !scene.run.applied && (!!scene.run.merge || scene.events.some(event => event.kind === "event" && event.summary === "Owner shipped merge")));
  if (published)
    add(
      "shipped",
      "Pushed",
      scene.run.merge ?? scene.run.head ?? scene.run.branch,
      scene.at,
    );
  if (firstAttempt && first)
    add("first-try", "First try", scene.run.branch, Date.parse(first.at));
  const everStale = staleEvidence(timeline, scene, completeHistory);
  const fullSeal =
    scene.seals.length === 4 &&
    scene.seals.every((seal) => seal.state === "passed");
  const rank: StageRank = scene.run.interrupted
    ? null
    : published
      ? firstAttempt && fullSeal && everStale === false
        ? "S"
        : "A"
      : scene.phase === "uat-ready"
        ? "B"
        : null;
  const rubric =
    rank === "S"
      ? "Pushed · First try · 4/4 · No signal ×0"
      : rank === "A"
        ? "Pushed"
        : rank === "B"
          ? "Your turn"
          : "";
  return {
    combo,
    peakCombo,
    charge,
    tier:
      combo >= 10
        ? "OVERDRIVE"
        : combo >= 6
          ? "FLOW"
          : combo >= 3
            ? "WARM"
            : null,
    badges: badges.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    rank,
    rubric,
    everStale,
    completeHistory,
    firstAttempt,
    streak,
  };
}
