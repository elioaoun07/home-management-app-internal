import type { LocalRunView } from "./LocalDelivery";
import {
  questionPresentation,
  type QuestionChoice,
} from "./deliveryQuestionModel";
import { localRunFailure } from "./localRunFailure";
import { openQuestion } from "./localChatModel";
import { clock, liveness } from "./localRunLiveness";
import { buildTimeline, sceneAt } from "./localRunScene";
import type { V2Plan, V2Question } from "./types";
import type { ZoneId } from "./stage/config";
import { faultZone, phaseZone, zoneForEvent } from "./stage/zoneModel";

export type AttentionKind =
  | "plan"
  | "question"
  | "summary"
  | "test"
  | "review"
  | "changes"
  | "sql"
  | "retry"
  | "failed"
  | "silent"
  | "lost";
export type AttentionAction =
  | "brief"
  | "summary"
  | "review"
  | "test"
  | "copy-path"
  | "retry"
  | "new-attempt"
  | "cancel"
  | "none"
  | "plan"
  | "answer";
export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  level: "act" | "look";
  zone: ZoneId;
  title: string;
  detail?: string;
  action: { label: string; run: AttentionAction; href?: string };
  state: "open" | "done";
  since: number | null;
  blocking?: boolean;
  choices?: QuestionChoice[];
}
const time = (at: string | undefined): number | null => {
  const value = at ? Date.parse(at) : NaN;
  return Number.isFinite(value) ? value : null;
};
export const attentionId = (runId: string, kind: AttentionKind, key: string) =>
  `${runId}:${kind}:${key}`;

/** Blocking future questions precede other acts; retained unknown ages stay unknown. */
export function sortAttention(
  items: readonly AttentionItem[],
): AttentionItem[] {
  const group = (item: AttentionItem) =>
    item.state === "done" ? 2 : item.level === "act" ? 0 : 1;
  return [...items].sort(
    (a, b) =>
      group(a) - group(b) ||
      (group(a) === 0 ? Number(!!b.blocking) - Number(!!a.blocking) : 0) ||
      (a.since ?? Infinity) - (b.since ?? Infinity) ||
      a.id.localeCompare(b.id),
  );
}

/** Briefs are look items. A question appears only from the recorded
 * AskUserQuestion ledger; none is inferred from prose, flags, an error, or an
 * unfamiliar phase. */
export function localRunAttention(
  run: LocalRunView,
  seen: Set<string>,
  now: number,
): AttentionItem[] {
  const timeline = buildTimeline(run),
    scene = sceneAt(timeline, now);
  const items: AttentionItem[] = [];
  const milestone = (text: string) =>
    timeline.events.find(
      (event) =>
        event.kind === "event" &&
        event.label !== "Tool requested" &&
        event.summary === text,
    );
  const candidate = milestone("Host checks started");
  const ready = milestone("Ready for owner UAT");
  const candidateAt = time(candidate?.at);
  const candidateIndex = candidate
    ? timeline.events.indexOf(candidate)
    : timeline.events.length;
  const reviewed = !!run.head && run.reviewed_head === run.head;
  const add = (
    kind: AttentionKind,
    key: string,
    rest: Omit<AttentionItem, "id" | "kind">,
  ) => {
    items.push({ id: attentionId(run.run_id, kind, key), kind, ...rest });
  };
  if (run.work.brief?.trim()) {
    const id = attentionId(run.run_id, "plan", "brief");
    add("plan", "brief", {
      level: "look",
      zone: "brief",
      title: "Brief",
      state: seen.has(id) ? "done" : "open",
      since: null,
      action: { label: "Open", run: "brief" },
    });
  }
  if (run.head) {
    const summary = timeline.events
      .filter(
        (event, index) => event.kind === "message" && index < candidateIndex,
      )
      .at(-1);
    if (summary) {
      const key = summary.id,
        id = attentionId(run.run_id, "summary", key);
      add("summary", key, {
        level: "look",
        zone: "think",
        title: "Summary",
        detail: summary.summary,
        state: seen.has(id) ? "done" : "open",
        since: time(summary.at),
        action: { label: "Open", run: "summary" },
      });
    }
    const paths = new Set(
      scene.events
        .filter((event) => event.kind === "edit")
        .flatMap((event) => event.paths),
    );
    add("changes", run.head, {
      level: "look",
      zone: "build",
      title: "Changes",
      ...(paths.size ? { detail: `${paths.size} files` } : {}),
      state: reviewed ? "done" : "open",
      since: candidateAt,
      action: { label: "Review", run: "review" },
    });
  }
  const testReached = run.phase === "uat-ready" || (!!ready && !!run.handover);
  if (testReached) {
    add("test", run.handover?.handover_id ?? "uat", {
      level: "act",
      zone: "test",
      title: "Test steps",
      ...(run.handover
        ? { detail: `${run.handover.scenarios.length} scenarios` }
        : {}),
      state: run.handover?.acceptance.state === "accepted" ? "done" : "open",
      since: time(ready?.at),
      action: {
        label: "Test",
        run: "test",
        ...(run.handover
          ? {
              href: `#/delivery/test/${encodeURIComponent(run.handover.handover_id)}`,
            }
          : {}),
      },
    });
    if (run.risk?.required) {
      const domains = [
        ...new Set(run.risk.flagged.flatMap((file) => file.domains)),
      ];
      const files = new Set(run.risk.flagged.map((file) => file.path)).size;
      add("review", run.head ?? "candidate", {
        level: "act",
        zone: "test",
        title: "Review diff",
        detail: [`${files} files`, domains.join(", ")]
          .filter(Boolean)
          .join(" · "),
        state: reviewed ? "done" : "open",
        since: time(ready?.at),
        action: { label: "Review", run: "review" },
      });
    }
  }
  const sqlPaths = new Map<string, number | null>();
  for (const event of scene.events.filter((event) => event.kind === "edit")) {
    for (const rawPath of event.paths) {
      const path = rawPath.replaceAll("\\", "/");
      if (/^migrations\/[^/]+\.sql$/iu.test(path) && !sqlPaths.has(path))
        sqlPaths.set(path, time(event.at));
    }
  }
  for (const file of run.risk?.flagged ?? []) {
    const path = file.path.replaceAll("\\", "/");
    if (/^migrations\/[^/]+\.sql$/iu.test(path) && !sqlPaths.has(path))
      sqlPaths.set(path, candidateAt);
  }
  for (const [path, since] of sqlPaths) {
    const id = attentionId(run.run_id, "sql", path);
    add("sql", path, {
      level: "act",
      zone: "test",
      title: "Run SQL",
      detail: path,
      state: seen.has(id) ? "done" : "open",
      since,
      action: { label: "Copy path", run: "copy-path" },
    });
  }
  if (run.phase === "failed") {
    const failure = localRunFailure(run);
    add("failed", "failure", {
      level: "act",
      zone: faultZone(run) ?? "build",
      title: failure?.title ?? "Failed",
      ...(failure
        ? {
            detail: [failure.stage, failure.excerpt]
              .filter(Boolean)
              .join(" · "),
          }
        : {}),
      state: "open",
      since: time(timeline.events.at(-1)?.at),
      action: { label: "New attempt", run: "new-attempt" },
    });
  }
  const signal = liveness(run, now);
  const lastZone =
    [...scene.events]
      .reverse()
      .map(zoneForEvent)
      .find((zone) => zone !== null) ?? phaseZone(run);
  // DLV-164: an explicit AskUserQuestion record, never inferred from prose.
  const asked = openQuestion(run);
  if (asked)
    add("question", asked.id, {
      level: "act",
      zone: "think",
      title: "Question",
      detail: asked.questions[0]?.question,
      blocking: true,
      state: "open",
      since: time(asked.asked_at),
      action: { label: "Answer", run: "answer" },
    });
  if (signal.state === "stale")
    add("silent", String(signal.lastSignalAt), {
      level: "act",
      zone: lastZone,
      title: "No signal",
      detail: clock(signal.sinceSignalMs ?? 0),
      state: "open",
      since: signal.lastSignalAt,
      action: { label: "Cancel", run: "cancel" },
    });
  if (run.interrupted)
    add("lost", String(signal.lastSignalAt), {
      level: "look",
      zone: lastZone,
      title: "Signal lost",
      state: "open",
      since: signal.lastSignalAt,
      action: { label: "", run: "none" },
    });
  return sortAttention(items);
}

export interface FutureAttentionSource {
  runId: string;
  zone: ZoneId;
  plans: readonly V2Plan[];
  questions: readonly V2Question[];
}
/** Explicit adapter seam for a lane with approval/questions. Local never calls
 * this adapter and never manufactures these records to populate the rail. */
export function futureRunAttention(
  source: FutureAttentionSource,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const plan = source.plans.at(-1);
  if (plan?.status === "proposed")
    items.push({
      id: attentionId(source.runId, "plan", plan.plan_id),
      kind: "plan",
      level: "act",
      zone: "think",
      title: "Plan",
      state: "open",
      since: time(plan.created_at),
      action: { label: "Open", run: "plan" },
    });
  for (const question of source.questions.filter(
    (item) => item.status === "open",
  )) {
    const presentation = questionPresentation(question.text);
    items.push({
      id: attentionId(source.runId, "question", question.question_id),
      kind: "question",
      level: "act",
      zone: source.zone,
      title: "Question",
      detail: presentation.prompt,
      choices: presentation.choices,
      blocking: question.blocking,
      state: "open",
      since: null,
      action: { label: "Answer", run: "answer" },
    });
  }
  return sortAttention(items);
}
