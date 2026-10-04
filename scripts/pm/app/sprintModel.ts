// Weekly planning is a projection of canonical work. Forecasts never write,
// mark work complete, or grant permission to dispatch a Delivery run.
import { dependencyIds, isHeld } from "../shared/declarations.mjs";
import { normalizeWorkId } from "../shared/work-id.mjs";
import { deliveryBlockReason } from "../shared/work-lifecycle.mjs";
import { isTerminal, sessionStatus } from "../shared/product.mjs";
import { applicationLabel, branchLabel, reasonLabel } from "./v2model";
import type { Receipt, RunSummary, V2RunSummary, Work, World } from "./types";

export type SprintStrategy = "balanced" | "module";
export interface SprintWorkRef {
  workId: string;
  origin: { file: string; alias: string };
}
export interface SprintReadiness {
  state: "ready" | "needs-input" | "blocked";
  status: "open" | "completed" | "cancelled" | "unresolved";
  criteriaRevision: string | null;
  effort: string | null;
  reasons: { code: string; with?: string | null }[];
  dependencies?: string[];
}
export type SprintReadinessMap = Record<string, SprintReadiness>;
export interface ForecastMember extends SprintWorkRef {
  points: number;
  reviewMinutes: null;
  estimateSource: "effort";
}
export interface ForecastWeek {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endExclusive: string;
  timezone: string;
  state: "draft";
  strategy: SprintStrategy;
  capacity: { unit: "points"; available: number; reviewMinutes: number };
  members: ForecastMember[];
  points: number;
  modules: string[];
  reasons: string[];
}
export interface SprintForecast {
  strategy: SprintStrategy;
  weeks: ForecastWeek[];
  unplanned: { ref: SprintWorkRef; work: Work; reason: string }[];
}
export type SprintItemState =
  | "todo"
  | "blocked"
  | "needs-input"
  | "active"
  | "review"
  | "done"
  | "cancelled"
  | "missing";
export interface SprintItemStatus {
  state: SprintItemState;
  label: string;
  reasons: string[];
  work: Work | null;
  receipt: Receipt | null;
  run: { engine: "v1" | "v2"; id: string; path: string } | null;
  /** Item readiness only. Delivery still performs its own launch checks. */
  ready: boolean;
}

const idOf = (id: string | null | undefined) => normalizeWorkId(id) || "";
const normalizedFile = (file: string) => file.replace(/\\/g, "/");
const campaignOf = (ref: SprintWorkRef) =>
  normalizedFile(ref.origin.file).split("/")[0];
export const sprintRef = (work: Work): SprintWorkRef => ({
  workId: idOf(work.id),
  origin: { file: work.file, alias: work.label },
});
export const sprintRefKey = (ref: SprintWorkRef) =>
  `${campaignOf(ref)}:${idOf(ref.workId)}`;

/** A calendar day is deliberately not interpreted in the browser's timezone. */
function calendarDate(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error("Use a calendar date (YYYY-MM-DD)");
  const date = new Date(`${day}T12:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== day
  )
    throw new Error("Invalid calendar date");
  return date;
}
export function addCalendarDays(day: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error("Use a whole number of days");
  const date = calendarDate(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function mondayOf(day: string): string {
  const weekday = calendarDate(day).getUTCDay();
  return addCalendarDays(day, -((weekday + 6) % 7));
}
export function dateInTimezone(
  instant: Date | string | number,
  timezone: string,
): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid instant");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function sprintDateLabel(
  day: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: "UTC",
  }).format(calendarDate(day));
}

export function resolveSprintWork(
  ref: SprintWorkRef,
  world: World,
): Work | null {
  const matches = world.work.filter(
    (work) =>
      work.module === campaignOf(ref) && idOf(work.id) === idOf(ref.workId),
  );
  return matches.length === 1 ? matches[0] : null;
}
function exactReceipt(ref: SprintWorkRef, world: World): Receipt | null {
  return (
    world.history
      .filter(
        (receipt) =>
          receipt.identity === "exact" &&
          receipt.campaign === campaignOf(ref) &&
          idOf(receipt.workId) === idOf(ref.workId),
      )
      .sort((a, b) =>
        (b.dateEnd || b.date).localeCompare(a.dateEnd || a.date),
      )[0] || null
  );
}
function readinessLabel(reason: {
  code: string;
  with?: string | null;
}): string {
  const names: Record<string, string> = {
    "owner-check": "Owner check",
    "owner-only": "Owner check",
    "owner-evidence": "Owner evidence",
    "missing-acceptance": "Add acceptance",
    "acceptance-missing": "Add acceptance",
    "acceptance-required": "Add acceptance",
    "missing-outcome": "Add outcome",
    "split-first": "Split first",
    "size-needs-split": "Split first",
    "estimate-required": "Add estimate",
    unestimated: "Add estimate",
    "decision-open": "Decision needed",
    "decision-required": "Decision needed",
    "ambiguous-reference": "Check work reference",
    "dependency-cycle": "Dependency cycle",
    "criteria-changed": "Criteria changed",
    "criteria-stale": "Criteria changed",
    "invalid-execution-kind": "Check execution kind",
    "work-completed": "Implementation complete",
    "not-actionable-source": "Check source",
  };
  return (
    names[reason.code] ||
    reasonLabel({ code: reason.code, with: reason.with || null })
  );
}
function sourceReasons(work: Work): string[] {
  const reasons = work.dependencies
    .filter(
      (dependency) => !["Completed", "Shipped"].includes(dependency.status),
    )
    .map((dependency) =>
      dependency.status === "Open"
        ? `After ${dependency.id}`
        : dependency.status === "Cancelled"
          ? `${dependency.id} cancelled`
          : dependency.status === "Owner UAT"
            ? `Owner check · ${dependency.id}`
            : `${dependency.id} not found`,
    );
  if (isHeld(work.text)) reasons.unshift("Held");
  if (work.decisionIds.length)
    reasons.push(`Decision needed · ${work.decisionIds.join(", ")}`);
  const block = deliveryBlockReason({
    file: work.file,
    state: work.state,
    contract: work.contract,
  });
  if (block) reasons.push(readinessLabel({ code: block }));
  if (!work.contract.trim()) reasons.push("Add acceptance");
  return [...new Set(reasons)];
}
function runLinkV2(run: V2RunSummary): SprintItemStatus["run"] {
  return {
    engine: "v2",
    id: run.run_id,
    path: `/delivery/run/${encodeURIComponent(run.run_id)}?from=%2Fsprints`,
  };
}
function runLinkV1(run: RunSummary): SprintItemStatus["run"] {
  return {
    engine: "v1",
    id: run.sessionId,
    path: `/delivery/session/${encodeURIComponent(run.sessionId)}?from=%2Fsprints`,
  };
}

/** Canonical checkbox/history decides completion; an attempt is never a shipped outcome. */
export function sprintItemStatus(
  ref: SprintWorkRef,
  world: World,
  options: {
    v1?: RunSummary[];
    v2?: V2RunSummary[];
    readiness?: SprintReadinessMap;
    criteriaRevision?: string | null;
  } = {},
): SprintItemStatus {
  const work = resolveSprintWork(ref, world);
  const receipt = exactReceipt(ref, world);
  const fact = options.readiness?.[idOf(ref.workId)];
  const result: SprintItemStatus = {
    state: "todo",
    label: "To do",
    reasons: [],
    work,
    receipt,
    run: null,
    ready: false,
  };
  if (
    world.work.filter(
      (item) =>
        item.module === campaignOf(ref) && idOf(item.id) === idOf(ref.workId),
    ).length > 1
  )
    return {
      ...result,
      state: "missing",
      label: "Unresolved",
      reasons: ["Ambiguous work reference"],
    };
  // The open row wins over an older shipped/cancelled receipt (reopened work).
  if (work?.state === "done" || (!work && receipt?.status === "Shipped"))
    return { ...result, state: "done", label: "Done" };
  if (!work && receipt?.status === "Cancelled")
    return { ...result, state: "cancelled", label: "Cancelled" };
  if (!work)
    return {
      ...result,
      state: "missing",
      label: "Unresolved",
      reasons: ["Work reference not found"],
    };
  const reasons = [
    ...sourceReasons(work),
    ...(fact?.reasons || []).map(readinessLabel),
  ];
  if (
    options.criteriaRevision &&
    fact?.criteriaRevision !== options.criteriaRevision
  )
    reasons.push("Criteria changed");
  result.reasons = [...new Set(reasons)];

  const matches = (
    id: string | null | undefined,
    campaign: string | null | undefined,
  ) => idOf(id) === idOf(ref.workId) && campaign === work.module;
  const v2 = (options.v2 || [])
    .filter((run) => matches(run.alias, run.campaign))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const v1 = (options.v1 || [])
    .filter((run) => matches(run.item.id, run.item.campaign))
    .sort((a, b) =>
      (b.updatedAt || b.createdAt || "").localeCompare(
        a.updatedAt || a.createdAt || "",
      ),
    );
  const liveV2 = v2.find(
    (run) =>
      run.lifecycle !== "CLOSED" ||
      ["prepared", "writing", "checking", "rolling-back"].includes(
        run.application?.state || "",
      ),
  );
  const liveV1 = v1.find((run) => !isTerminal(run.state));
  if (
    liveV2 &&
    (!liveV1 ||
      liveV2.updated_at >= (liveV1.updatedAt || liveV1.createdAt || ""))
  ) {
    const application = liveV2.application?.state;
    const active =
      liveV2.active ||
      ["prepared", "writing", "checking", "rolling-back"].includes(
        application || "",
      );
    const waiting =
      liveV2.ownerActionKind === "waiting" ||
      liveV2.coordination?.state === "waiting";
    const state = active ? "active" : waiting ? "blocked" : "review";
    return {
      ...result,
      state,
      label:
        application && active
          ? applicationLabel(application)
          : branchLabel(liveV2.branch) ||
            liveV2.ownerAction ||
            (active ? "Active" : "Review"),
      run: runLinkV2(liveV2),
    };
  }
  if (liveV1) {
    const blocked = liveV1.state === "BLOCKED";
    const review =
      !!liveV1.awaiting ||
      [
        "SPEC_READY",
        "PLAN_READY",
        "UAT_READY",
        "ACCEPTED",
        "NEEDS_DECISION",
      ].includes(liveV1.state) ||
      !!liveV1.execution?.paused ||
      liveV1.runnerAlive === false;
    return {
      ...result,
      state: blocked ? "blocked" : review ? "review" : "active",
      label: sessionStatus(liveV1),
      run: runLinkV1(liveV1),
    };
  }
  const latestV2 = v2[0];
  // A verified candidate remains review work, including an Apply whose PM
  // writeback has not completed. An older candidate cannot finish a reopened row.
  if (latestV2?.closed_outcome === "verified_candidate" && !receipt)
    return {
      ...result,
      state: "review",
      label:
        latestV2.application?.state === "applied"
          ? "Completion pending"
          : latestV2.ownerAction || "Apply",
      run: runLinkV2(latestV2),
    };
  const latestV1 = v1[0];
  if (
    latestV2 &&
    (!latestV1 ||
      latestV2.updated_at >= (latestV1.updatedAt || latestV1.createdAt || ""))
  ) {
    result.run = runLinkV2(latestV2);
    if (["failed", "cancelled"].includes(latestV2.closed_outcome || ""))
      result.reasons.push(`Last delivery ${latestV2.closed_outcome}`);
  } else if (latestV1) {
    result.run = runLinkV1(latestV1);
    if (["FAILED", "CANCELLED"].includes(latestV1.state))
      result.reasons.push(`Last delivery ${latestV1.state.toLowerCase()}`);
  }
  const blocked =
    work.blocked ||
    fact?.state === "blocked" ||
    work.dependencies.some(
      (dependency) => !["Completed", "Shipped"].includes(dependency.status),
    );
  const needsInput =
    fact?.state === "needs-input" ||
    reasons.some((reason) => !reason.startsWith("Last delivery"));
  result.state = blocked ? "blocked" : needsInput ? "needs-input" : "todo";
  result.label = blocked ? "Blocked" : needsInput ? "Needs input" : "To do";
  result.ready = !blocked && !needsInput;
  return result;
}

function cycleMembers(work: Work[]): Set<string> {
  const known = new Map(work.map((item) => [idOf(item.id), item]));
  const cycles = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, path: string[]) => {
    const index = path.indexOf(id);
    if (index >= 0) {
      path.slice(index).forEach((entry) => cycles.add(entry));
      return;
    }
    if (visited.has(id)) return;
    const item = known.get(id);
    if (!item) return;
    for (const dep of dependencyIds(item.contract, item.text))
      visit(idOf(dep), [...path, id]);
    visited.add(id);
  };
  known.forEach((_, id) => visit(id, []));
  return cycles;
}

/**
 * Deterministic, capacity-bounded drafts. An open prerequisite is scheduled in
 * an EARLIER week; that assumption affects the forecast only, never launch.
 * Later work, L/unknown estimates, holds and missing evidence remain disclosed.
 */
export function forecastSprints(
  world: World,
  options: {
    strategy: SprintStrategy;
    start: string;
    timezone: string;
    weeks?: number;
    capacity?: number;
    maxModules?: number;
    exclude?: SprintWorkRef[];
    readiness?: SprintReadinessMap;
  },
): SprintForecast {
  const count = options.weeks ?? 8;
  const capacity = options.capacity ?? 6;
  const maxModules =
    options.strategy === "module" ? 1 : (options.maxModules ?? 2);
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 52 ||
    !Number.isFinite(capacity) ||
    capacity <= 0 ||
    !Number.isInteger(maxModules) ||
    maxModules < 1
  )
    throw new Error("Invalid forecast capacity or horizon");
  // Validate the IANA name once. The dates below stay calendar-only across DST.
  dateInTimezone(new Date(0), options.timezone);
  const start = mondayOf(options.start);
  const excluded = new Set((options.exclude || []).map(sprintRefKey));
  const cycle = cycleMembers(world.work);
  const unplanned: SprintForecast["unplanned"] = [];
  const pending: Work[] = [];
  const pointsFor = (work: Work) =>
    work.effort === "S" ? 1 : work.effort === "M" ? 2 : null;
  // Readiness and source may arrive in separate relay revisions. A server
  // prerequisite refusal still applies even when the cached Work is older.
  const dependenciesFor = (work: Work) => {
    const dependencies = new Map(
      work.dependencies.map((dependency) => [idOf(dependency.id), dependency]),
    );
    for (const reason of options.readiness?.[idOf(work.id)]?.reasons || []) {
      if (
        !reason.with ||
        ![
          "dependency-open",
          "dependency-cancelled",
          "dependency-unresolved",
        ].includes(reason.code)
      )
        continue;
      dependencies.set(idOf(reason.with), {
        id: idOf(reason.with),
        status:
          reason.code === "dependency-open"
            ? "Open"
            : reason.code === "dependency-cancelled"
              ? "Cancelled"
              : "Unresolved reference",
      });
    }
    return [...dependencies.values()];
  };
  const reasonFor = (work: Work): string | null => {
    const ref = sprintRef(work);
    const fact = options.readiness?.[idOf(work.id)];
    if (excluded.has(sprintRefKey(ref))) return "Already planned or excluded";
    if (
      !work.idChip ||
      world.work.filter((other) => idOf(other.id) === idOf(work.id)).length > 1
    )
      return "Ambiguous work reference";
    if (!["Now", "Next"].includes(work.section)) return "Later priority";
    if (isHeld(work.text)) return "Held";
    if (cycle.has(idOf(work.id))) return "Dependency cycle";
    const sourceBlock = deliveryBlockReason({
      file: work.file,
      state: work.state,
      contract: work.contract,
    });
    if (sourceBlock) return readinessLabel({ code: sourceBlock });
    if (work.effort === "L") return "Split first";
    if (pointsFor(work) == null) return "Add estimate";
    if (pointsFor(work)! > capacity) return "Over weekly capacity";
    if (!work.contract.trim()) return "Add acceptance";
    if (work.decisionIds.length)
      return `Decision needed · ${work.decisionIds.join(", ")}`;
    const nonDependencyReason = fact?.reasons.find(
      (reason) => reason.code !== "dependency-open",
    );
    if (nonDependencyReason) return readinessLabel(nonDependencyReason);
    if (fact && fact.state !== "ready" && !fact.reasons.length)
      return fact.state === "blocked" ? "Blocked" : "Needs input";
    const unavailable = dependenciesFor(work).find(
      (dep) => !["Completed", "Shipped", "Open"].includes(dep.status),
    );
    if (unavailable)
      return unavailable.status === "Owner UAT"
        ? `Owner check · ${unavailable.id}`
        : `${unavailable.id} ${unavailable.status === "Cancelled" ? "cancelled" : "not found"}`;
    return null;
  };
  for (const work of world.work.filter((item) => item.state === "open")) {
    const reason = reasonFor(work);
    if (reason) unplanned.push({ ref: sprintRef(work), work, reason });
    else pending.push(work);
  }
  const order = new Map(
    world.spaces.map((space, index) => [space.name, index]),
  );
  const rank = (work: Work) => (work.section === "Now" ? 0 : 1);
  const severity = (work: Work) =>
    ["blocker", "friction", "annoyance", "parked"].indexOf(
      work.severity || "parked",
    );
  const completedInForecast = new Set<string>();
  const totalModulePoints = new Map<string, number>();
  const weeks: ForecastWeek[] = [];
  let focusedModule: string | null = null;
  for (let index = 0; index < count; index++) {
    const selected: Work[] = [];
    const modulePoints = new Map<string, number>();
    let points = 0;
    // This set is updated only after this week closes, not when a prerequisite
    // enters the same week's draft.
    const eligible = pending.filter((work) =>
      dependenciesFor(work).every(
        (dep) =>
          ["Completed", "Shipped"].includes(dep.status) ||
          completedInForecast.has(idOf(dep.id)),
      ),
    );
    while (true) {
      const fitting = eligible.filter(
        (work) =>
          !selected.includes(work) &&
          points + pointsFor(work)! <= capacity &&
          (modulePoints.has(work.module) || modulePoints.size < maxModules),
      );
      fitting.sort(
        (a, b) =>
          rank(a) - rank(b) ||
          severity(a) - severity(b) ||
          (options.strategy === "module"
            ? Number(b.module === focusedModule) -
              Number(a.module === focusedModule)
            : (modulePoints.get(a.module) || 0) -
              (modulePoints.get(b.module) || 0)) ||
          (totalModulePoints.get(a.module) || 0) -
            (totalModulePoints.get(b.module) || 0) ||
          (order.get(a.module) ?? 99) - (order.get(b.module) ?? 99) ||
          a.line - b.line ||
          a.id.localeCompare(b.id),
      );
      const work = fitting[0];
      if (!work) break;
      selected.push(work);
      points += pointsFor(work)!;
      modulePoints.set(
        work.module,
        (modulePoints.get(work.module) || 0) + pointsFor(work)!,
      );
    }
    if (!selected.length) break;
    const modules = [...modulePoints.keys()];
    if (options.strategy === "module") focusedModule = modules[0];
    const startDate = addCalendarDays(start, index * 7);
    weeks.push({
      id: `sprint-${startDate}`,
      name: `Week of ${sprintDateLabel(startDate)}`,
      goal: modules.join(" + "),
      startDate,
      endExclusive: addCalendarDays(startDate, 7),
      timezone: options.timezone,
      state: "draft",
      strategy: options.strategy,
      capacity: { unit: "points", available: capacity, reviewMinutes: 90 },
      members: selected.map((work) => ({
        ...sprintRef(work),
        points: pointsFor(work)!,
        reviewMinutes: null,
        estimateSource: "effort",
      })),
      points,
      modules,
      reasons: [
        ...new Set(
          selected.flatMap((work) =>
            dependenciesFor(work)
              .filter((dep) => dep.status === "Open")
              .map((dep) => `After ${dep.id}`),
          ),
        ),
      ],
    });
    for (const work of selected) {
      completedInForecast.add(idOf(work.id));
      pending.splice(pending.indexOf(work), 1);
      totalModulePoints.set(
        work.module,
        (totalModulePoints.get(work.module) || 0) + pointsFor(work)!,
      );
    }
  }
  for (const work of pending) {
    const dependency = dependenciesFor(work).find(
      (dep) =>
        !["Completed", "Shipped"].includes(dep.status) &&
        !completedInForecast.has(idOf(dep.id)),
    );
    unplanned.push({
      ref: sprintRef(work),
      work,
      reason: dependency ? `After ${dependency.id}` : "Beyond forecast",
    });
  }
  return { strategy: options.strategy, weeks, unplanned };
}

/** R72 — an ERA chat report imported by scripts/pm/era-issues.mjs. */
export interface EraHotfix {
  work: Work;
  /** A "wrong" report is a Hotfix (filed as blocker); a "missed" one a Defect. */
  label: "Hotfix" | "Defect";
  /** Filing date from the Source line (YYYY-MM-DD, owner timezone). */
  reported: string | null;
  /** The person's comment on the report, if they left one. */
  comment: string | null;
}

const ERA_COMMENT_RE = /^\s*-\s*\*\*(?:Comment|Expected):\*\*\s*(.+)$/m;

const ERA_SOURCE_RE =
  /\*\*Source:\*\* ERA report [0-9a-f-]{36} · (missed|wrong) · [a-z]+ · (\d{4}-\d{2}-\d{2})/;

/**
 * R72 — open ERA chat reports still in Now. The Sprints view shows them on the
 * current week as standalone Hotfixes / Defects whatever week they were filed
 * in; they are not sprint members, so they never change planned capacity or
 * the week's commitment. Moving one out of Now (triage) takes it off the lane.
 */
export function eraHotfixes(world: World): EraHotfix[] {
  const rank = (h: EraHotfix) => (h.label === "Hotfix" ? 0 : 1);
  return world.work
    .filter((w) => w.state === "open" && w.kind === "bug" && /^now$/i.test(w.section.trim()))
    .flatMap((work): EraHotfix[] => {
      const m = work.contract.match(ERA_SOURCE_RE);
      if (!m) return [];
      const label = m[1] === "wrong" || work.severity === "blocker" ? "Hotfix" : "Defect";
      const comment = work.contract.match(ERA_COMMENT_RE)?.[1]?.trim() ?? null;
      return [{ work, label, reported: m[2], comment }];
    })
    .sort((a, b) => rank(a) - rank(b) || (a.reported ?? "").localeCompare(b.reported ?? "") || a.work.line - b.work.line);
}
