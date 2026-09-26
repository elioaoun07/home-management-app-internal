import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Check,
  ClipboardCheck,
  FileText,
  GitBranch,
  ListChecks,
  Pause,
  Play,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import { v2Pair, v2Post } from "./api";
import { client, go, pmKeys, useRoute, useWorld } from "./state";
import { PendingCommand, transport } from "./transport";
import { Back, Empty, ErrorNotice, RunOrb, Sheet } from "./components";
import { returnFromLaunch } from "./Work";
import {
  applicationLabel,
  applyControls,
  branchLabel,
  coordinationStatus,
  effortsFor,
  evidenceLabel,
  executorBlockMessage,
  executorLabel,
  launchState,
  queueSlots,
  reasonLabel,
  receiptLabel,
  runningLabel,
  settingsLine,
} from "./v2model";
import {
  ActivityReview,
  ChangesReview,
  ChecksReview,
  PlanReview,
  UsageSummary,
} from "./DeliveryReview";
import {
  checkGroups,
  defaultReviewTab,
  reviewStatus,
  reviewTabs,
  type ReviewTab,
} from "./deliveryReviewModel";
import "./delivery-review.css";
import { LivePulse } from "./LivePulse";
import { OutcomeReview } from "./OutcomeReview";
import { TestGateCard, useTestGate } from "./TestGate";
import type { V2Executor, V2Reason, V2RunDetail, Work } from "./types";

type Body = Record<string, unknown>;
type RollbackPreview = {
  ok: boolean;
  application_id: string;
  revision: number;
  digest: string;
  operations: { path: string; action: "restore" | "delete" | "recreate" }[];
  conflicts: { path: string; code: string }[];
};

export function useV2Session() {
  const { connected } = useWorld();
  return useQuery({
    queryKey: pmKeys.v2session,
    queryFn: ({ signal }) => transport().v2Session(signal),
    enabled: connected,
  });
}

export function useV2Runs() {
  const { connected } = useWorld();
  const session = useV2Session();
  return useQuery({
    queryKey: pmKeys.v2runs,
    queryFn: ({ signal }) => transport().v2Runs(signal),
    enabled: connected && !!session.data?.paired,
    refetchInterval: 6000,
  });
}

export function useV2Queue() {
  const { connected } = useWorld();
  const session = useV2Session();
  return useQuery({
    queryKey: pmKeys.v2queue,
    queryFn: ({ signal }) => transport().v2Queue(signal),
    enabled: connected && !!session.data?.paired,
    refetchInterval: 6000,
  });
}

/** A verdict with its reasons, as the server decided them. */
function Verdict({
  verdict,
  reasons,
  limit = 3,
}: {
  verdict: string | null;
  reasons: V2Reason[];
  limit?: number;
}) {
  if (!verdict) return null;
  const status = coordinationStatus(verdict, reasons);
  return (
    <div
      className="verdict"
      data-verdict={verdict}
      data-blocked={
        status === "Capacity full" || status === "Allowance used" || status === "Scope required"
          ? "true"
          : undefined
      }
    >
      <strong>{status}</strong>
      {reasons
        .filter((reason) => reasonLabel(reason) !== status)
        .slice(0, limit)
        .map((reason, index) => (
          <span key={reason.code + index}>{reasonLabel(reason)}</span>
        ))}
    </div>
  );
}

function QueueRow({
  run_id,
  alias,
  title,
  side,
  line,
  children,
}: {
  run_id: string;
  alias: string | null;
  title: string;
  side: string;
  line?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      className="queue-row"
      href={`#/delivery/run/${run_id}?from=${encodeURIComponent("/delivery")}`}
    >
      <span className="queue-alias">{alias || "V2"}</span>
      <span className="queue-title">{title}</span>
      <span className="queue-side">{side}</span>
      {line && <small>{line}</small>}
      {children}
    </a>
  );
}

/**
 * The V2 queue (Command Center Phase 5): writer and job slots, what fills them with
 * each item's executor, waiting items with their verdicts, and owner decisions.
 */
export function QueueV2() {
  const queue = useV2Queue();
  const data = queue.data;
  if (
    !data ||
    !(data.running.length + data.waiting.length + data.decisions.length)
  )
    return null;
  const changed = new Set(
    data.candidates.filter((row) => row.sourceChanged).map((row) => row.run_id),
  );
  return (
    <section className="queue-panel" aria-label="Queue">
      <div className="queue-slots">
        {queueSlots(data).map((slot) => (
          <span key={slot.key} data-full={slot.full}>
            {slot.label} <strong>{slot.value}</strong>
          </span>
        ))}
      </div>
      {!!data.running.length && (
        <div className="queue-group">
          <h3>Running</h3>
          {data.running.map((row) => (
            <QueueRow
              key={row.job_id || row.run_id}
              {...row}
              side={runningLabel(row)}
              line={settingsLine(row)}
            />
          ))}
        </div>
      )}
      {!!data.waiting.length && (
        <div className="queue-group">
          <h3>Waiting</h3>
          {data.waiting.map((row) => (
            <QueueRow
              key={row.run_id}
              {...row}
              side={executorLabel(row.executor)}
            >
              <Verdict verdict={row.verdict} reasons={row.reasons} limit={2} />
            </QueueRow>
          ))}
        </div>
      )}
      {!!data.decisions.length && (
        <div className="queue-group">
          <h3>Decisions</h3>
          {data.decisions.map((row) => (
            <QueueRow
              key={row.run_id}
              {...row}
              side={
                row.label + (changed.has(row.run_id) ? " · Source changed" : "")
              }
              line={settingsLine(row)}
            />
          ))}
        </div>
      )}
      {!!data.pairs.length && (
        <details className="focus-disclosure">
          <summary>Pairs</summary>
          <ul className="v2-list">
            {data.pairs.map((pair) => (
              <li key={pair.a + ":" + pair.b}>
                <span>
                  {pair.a} · {pair.b}
                </span>
                <Verdict
                  verdict={pair.verdict}
                  reasons={pair.reasons}
                  limit={2}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/**
 * One command id per intent, minted before the first send and reused on every
 * retry and check, so a lost reply, a double tap or a timeout can never turn one
 * approval into two. A command whose outcome is not established yet is shown as
 * a receipt, never as a failure.
 */
function useV2Command() {
  const intents = useRef(new Map<string, string>());
  const mutation = useMutation({
    mutationFn: ({
      path,
      body,
    }: {
      path: string;
      body: Body;
      intent: string;
    }) => v2Post<Body>(path, body),
    onSuccess: (_data, variables) => intents.current.delete(variables.intent),
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }),
  });
  const send = (
    path: string,
    intent: string,
    body: Body,
    onSuccess?: (data: Body) => void,
  ) => {
    let command_id = intents.current.get(intent);
    if (!command_id) {
      command_id = crypto.randomUUID();
      intents.current.set(intent, command_id);
    }
    mutation.mutate(
      { path, body: { ...body, command_id }, intent },
      { onSuccess },
    );
  };
  const retry = () => {
    if (mutation.variables) mutation.mutate(mutation.variables);
  };
  const pending =
    mutation.error instanceof PendingCommand ? mutation.error : null;
  return {
    ...mutation,
    send,
    retry,
    pending,
    failure: pending ? null : mutation.error,
  };
}

function CommandReceipt({
  pending,
  onCheck,
  busy,
}: {
  pending: PendingCommand | null;
  onCheck: () => void;
  busy: boolean;
}) {
  if (!pending) return null;
  return (
    <div className="command-receipt" role="status" data-state={pending.state}>
      <span>{receiptLabel(pending.state)}</span>
      <button onClick={onCheck} disabled={busy}>
        Check status
      </button>
    </div>
  );
}

export function PairV2() {
  const [code, setCode] = useState("");
  const pair = useMutation({
    mutationFn: () => v2Pair(code.trim()),
    onSuccess: () => {
      setCode("");
      void client.invalidateQueries({ queryKey: pmKeys.all });
    },
  });
  return (
    <form
      className="gate-panel"
      onSubmit={(event) => {
        event.preventDefault();
        pair.mutate();
      }}
    >
      <span className="eyebrow">Delivery</span>
      <h2>Pair this browser</h2>
      <label>
        Code
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="one-time-code"
        />
      </label>
      <ErrorNotice error={pair.error} />
      <div className="gate-actions">
        <button className="primary" disabled={!code.trim() || pair.isPending}>
          Pair
        </button>
      </div>
    </form>
  );
}

export function V2RunLink({
  run,
  from = "/",
}: {
  run: import("./types").V2RunSummary;
  from?: string;
}) {
  const { connected } = useWorld();
  return (
    <a
      className="run-link"
      href={`#/delivery/run/${run.run_id}?from=${encodeURIComponent(from)}`}
    >
      <RunOrb
        running={connected && run.active}
        space={run.campaign || undefined}
        size={48}
      />
      <span>
        <small>{branchLabel(run.branch) || run.ownerAction}</small>
        <strong>{run.title}</strong>
      </span>
      <span className="run-provider">V2 · {executorLabel(run.executor)}</span>
      <ArrowRight size={18} />
    </a>
  );
}

const PROFILES = [
  ["focused", "Fast lane"],
  ["investigate", "Deep dive"],
] as const;

function startBlocker(reasons: V2Reason[]) {
  const reason = reasons[0];
  if (!reason) return "Unavailable";
  if (reason.code === "scope-unknown") return "Scope required";
  if (reason.code === "fleet-resources") return "Allowance used";
  if (["writer-slots-full", "job-slots-full"].includes(reason.code))
    return "Capacity full";
  if (reason.code.startsWith("dependency-"))
    return `Waiting for ${reason.with || reason.first || "prerequisite"}`;
  return "Unavailable";
}

export function LaunchV2({ work }: { work: Work }) {
  const { connected } = useWorld();
  const route = useRoute();
  const session = useV2Session();
  const catalogue = useQuery({
    queryKey: pmKeys.v2executors,
    queryFn: ({ signal }) => transport().v2Executors(signal),
    enabled: connected,
  });
  const [executor, setExecutor] = useState("");
  const [profile, setProfile] = useState<string>("focused");
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("");
  const [blockedExecutor, setBlockedExecutor] = useState<V2Executor | null>(null);
  const start = useV2Command();
  const testGate = useTestGate();
  const testsLocked = !!testGate.data?.locked;
  const itemId = String(work.idChip || work.id || "");
  const assessment = useQuery({
    queryKey: pmKeys.v2assess(work.file, itemId),
    queryFn: ({ signal }) => transport().v2Assess(work.file, itemId, signal),
    enabled: connected && !!session.data?.paired && !!itemId,
  });
  if (session.data && !session.data.paired && transport().capabilities.pairing)
    return <PairV2 />;

  const chosen = catalogue.data?.executors.find(
    (entry) => entry.id === executor,
  );
  const noRuntime = !!catalogue.data?.refusals?.some(
    (entry) => entry.code === "no-worker-runtime-configured",
  );
  const applySuggestion = (id: string, name: string) => {
    const entry = catalogue.data?.executors.find(
      (candidate) => candidate.id === id,
    );
    const next = entry?.suggestions?.[name];
    setModel(next?.model || "");
    setEffort(next?.effort || "");
  };
  const deliver = () =>
    start.send(
      "deliver",
      ["deliver", work.key, executor, model, effort, profile].join(":"),
      {
        file: work.file,
        cbidx: work.cbidx,
        expectLine: work.rawLine,
        expectId: work.idChip || work.id,
        executor,
        model: model || null,
        effort: effort || null,
        workProfile: profile,
      },
      (data) =>
        go(
          `/delivery/run/${String(data.run_id)}?from=${encodeURIComponent(returnFromLaunch(route.query))}`,
        ),
    );

  return (
    <>
      <section className="launch-section">
        <h2>Executor</h2>
        <div className="provider-choices">
          {(catalogue.data?.executors || []).map((entry) => {
            const state = launchState(entry);
            return (
              <button
                key={entry.id}
                aria-pressed={executor === entry.id}
                aria-disabled={!state.enabled}
                onClick={() => {
                  if (!state.enabled) {
                    setBlockedExecutor(entry);
                    return;
                  }
                  setExecutor(entry.id);
                  applySuggestion(entry.id, profile);
                }}
              >
                <Sparkles size={21} />
                <strong>{entry.label}</strong>
                {!state.enabled ? (
                  <small>Unavailable</small>
                ) : (
                  executor === entry.id && <Check size={17} />
                )}
              </button>
            );
          })}
        </div>
      </section>
      <section className="launch-section">
        <h2>Lane</h2>
        <div className="pace-choices">
          {PROFILES.map(([value, label]) => (
            <button
              key={value}
              aria-pressed={profile === value}
              onClick={() => {
                setProfile(value);
                if (executor) applySuggestion(executor, value);
              }}
            >
              <span>
                <strong>{label}</strong>
              </span>
              {profile === value && <Check size={17} />}
            </button>
          ))}
        </div>
      </section>
      {chosen && (
        <section className="launch-section">
          <div className="budget-fields">
            <label>
              Model
              <select
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setEffort("");
                }}
              >
                <option value="">Default</option>
                {chosen.models.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label || entry.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Effort
              <select
                value={effort}
                onChange={(event) => setEffort(event.target.value)}
              >
                <option value="">Default</option>
                {effortsFor(chosen, model).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}
      <ErrorNotice
        error={catalogue.error || session.error}
        retry={() => void catalogue.refetch()}
      />
      <ErrorNotice error={start.failure} retry={start.retry} />
      <CommandReceipt
        pending={start.pending}
        onCheck={start.retry}
        busy={start.isPending}
      />
      {testGate.data?.locked && <TestGateCard gate={testGate.data} />}
      <div className="launch-footer">
        <span>
          {testsLocked
            ? "Tests not confirmed"
            : noRuntime
            ? "Worker unavailable"
            : assessment.data?.startable === false
              ? startBlocker(assessment.data.reasons)
              : ""}
        </span>
        <button
          className="primary"
          disabled={
            !connected ||
            !chosen ||
            !launchState(chosen).enabled ||
            noRuntime ||
            start.isPending ||
            work.state !== "open" ||
            assessment.data?.startable === false ||
            testsLocked
          }
          onClick={deliver}
        >
          <Zap size={17} />
          {start.isPending ? "Starting…" : "Start"}
        </button>
      </div>
      <Sheet
        title={`${blockedExecutor?.label || "Executor"} unavailable`}
        open={!!blockedExecutor}
        onClose={() => setBlockedExecutor(null)}
      >
        {blockedExecutor && (
          <>
            <p className="executor-block-message">
              {executorBlockMessage(blockedExecutor)}
            </p>
            <div className="gate-actions">
              <button
                className="primary"
                onClick={() => {
                  setBlockedExecutor(null);
                  void catalogue.refetch();
                }}
              >
                Retry
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}

export function RunV2({ id }: { id: string }) {
  const { connected } = useWorld();
  const session = useV2Session();
  const detail = useQuery({
    queryKey: pmKeys.v2run(id),
    queryFn: ({ signal }) => transport().v2Run(id, signal),
    refetchInterval: 4000,
    enabled: connected && !!session.data?.paired,
  });
  if (session.data && !session.data.paired && transport().capabilities.pairing)
    return (
      <div className="focus-page">
        <Back fallback="/delivery" />
        <PairV2 />
      </div>
    );
  if (!detail.data)
    return (
      <div className="focus-page">
        <Back fallback="/delivery" />
        {detail.error ? (
          <ErrorNotice
            error={detail.error}
            retry={() => void detail.refetch()}
          />
        ) : (
          <Empty
            title={
              connected ? "Opening delivery…" : "Connect to view this delivery"
            }
          />
        )}
      </div>
    );
  return (
    <RunV2Story key={id} detail={detail.data} refreshError={detail.error} />
  );
}

export function RunV2Story({
  detail,
  refreshError,
}: {
  detail: V2RunDetail;
  refreshError: unknown;
}) {
  const { connected } = useWorld();
  const route = useRoute();
  const command = useV2Command();
  const [guidance, setGuidance] = useState("");
  const run_id = detail.run.run_id;
  const closed = detail.run.lifecycle === "CLOSED";
  const busy = detail.jobs.some(
    (job) => job.status === "active" || job.status === "reserved",
  );
  const activeJob = detail.jobs.find((job) => job.status === "active" || job.status === "reserved");
  const checking = !closed && ["checking", "repairing"].includes(String(detail.run.waiting_reason));
  const livePhase = checking
    ? detail.run.waiting_reason === "repairing" ? "Repairing" : "Checking"
    : activeJob?.access === "write" ? "Building" : "Planning";
  const disabled = !connected || !!refreshError || command.isPending;
  const requested = route.query.get("tab");
  const tab = reviewTabs.includes(requested as ReviewTab)
    ? (requested as ReviewTab)
    : defaultReviewTab(detail);
  const selectTab = (next: ReviewTab) => {
    const query = new URLSearchParams(route.query);
    query.set("tab", next);
    go(`${route.path}?${query}`);
  };
  const control = (action: string, extra: Body = {}) =>
    command.send(
      "control",
      ["control", action, run_id, JSON.stringify(extra)].join(":"),
      { run_id, action, ...extra },
    );
  const attention = (area: "plan" | "other") => (
    <Attention
      detail={detail}
      disabled={disabled}
      send={command.send}
      control={control}
      area={area}
    />
  );
  const groups = checkGroups(detail.evidence);
  const tabs = [
    {
      key: "outcome" as const,
      label: "Outcome",
      icon: ClipboardCheck,
      count: null,
    },
    {
      key: "plan" as const,
      label: "Plan",
      icon: FileText,
      count: detail.plans.at(-1) ? `r${detail.plans.at(-1)!.revision}` : null,
    },
    {
      key: "checks" as const,
      label: "Verification",
      icon: ListChecks,
      count: groups.length
        ? `${groups.filter((g) => g.current.state === "satisfied").length}/${groups.length}`
        : null,
    },
    {
      key: "activity" as const,
      label: "Activity",
      icon: Activity,
      count: null,
    },
    {
      key: "changes" as const,
      label: "Changes",
      icon: GitBranch,
      count: detail.candidate?.changed.length || null,
    },
  ];
  return (
    <div className="run-page delivery-workspace">
      <Back fallback="/delivery" />
      <header className="delivery-heading">
        <div>
          <span className="eyebrow">
            {[detail.work.campaign, detail.work.alias]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <h1>{detail.work.title}</h1>
        </div>
      </header>
      <ErrorNotice error={refreshError} />
      <ErrorNotice error={command.failure} retry={command.retry} />
      <CommandReceipt
        pending={command.pending}
        onCheck={command.retry}
        busy={command.isPending}
      />
      <section className="delivery-status">
        <RunOrb
          running={connected && busy && !refreshError}
          space={detail.work.campaign || undefined}
          size={54}
        />
        <div className="delivery-status-copy">
          <span className="review-meta">
            {refreshError || !connected
              ? "Last known state"
              : detail.settings.work_profile === "focused"
                ? "Fast lane"
                : "Deep dive"}
          </span>
          <h2>{reviewStatus(detail)}</h2>
          <p>{settingsLine(detail.settings)}</p>
        </div>
        <UsageSummary resources={detail.resources} jobs={detail.jobs} />
        {!closed && busy && (
          <button
            className="round-button"
            aria-label="Pause delivery"
            disabled={disabled}
            onClick={() => control("pause")}
          >
            <Pause size={18} />
          </button>
        )}
        {!closed && !busy && detail.ownerAction.kind === "resume" && (
          <button
            className="round-button"
            aria-label="Resume delivery"
            disabled={disabled}
            onClick={() => control("resume")}
          >
            <Play size={18} />
          </button>
        )}
      </section>
      <ol className="delivery-stages" aria-label="Delivery stages">
        {detail.stage.stages.map((stage, i) => (
          <li
            key={stage}
            aria-current={i === detail.stage.current ? "step" : undefined}
            data-visited={i < detail.stage.current}
          >
            <span>
              {i < detail.stage.current ? <Check size={13} /> : i + 1}
            </span>
            {stage}
          </li>
        ))}
      </ol>
      {connected && !refreshError && (busy || checking) && <LivePulse detail={detail} phase={livePhase} />}
      {detail.coordination?.state && (
        <section className="gate-panel">
          <span className="eyebrow">
            {detail.coordination.state === "scope-conflict"
              ? "Paused"
              : "Waiting"}
          </span>
          <Verdict
            verdict={detail.coordination.verdict}
            reasons={detail.coordination.reasons}
            limit={6}
          />
          {!closed && detail.coordination.state === "queued" && (
            <button
              className="text-button stop-delivery"
              disabled={disabled}
              onClick={() => control("stop")}
            >
              Cancel
            </button>
          )}
        </section>
      )}
      {!["review-result", "application-checks"].includes(
        detail.ownerAction.kind,
      ) && attention("other")}
      <div className="delivery-tabs" role="tablist" aria-label="Session views">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            id={`delivery-tab-${key}`}
            role="tab"
            aria-selected={tab === key}
            aria-controls="delivery-panel"
            tabIndex={tab === key ? 0 : -1}
            onClick={() => selectTab(key)}
            onKeyDown={(e) => {
              const i = reviewTabs.indexOf(key);
              const next =
                e.key === "ArrowRight"
                  ? reviewTabs[(i + 1) % reviewTabs.length]
                  : e.key === "ArrowLeft"
                    ? reviewTabs[(i + reviewTabs.length - 1) % reviewTabs.length]
                    : e.key === "Home"
                      ? reviewTabs[0]
                      : e.key === "End"
                        ? reviewTabs[reviewTabs.length - 1]
                        : null;
              if (next) {
                e.preventDefault();
                selectTab(next);
                document.getElementById(`delivery-tab-${next}`)?.focus();
              }
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
            {count != null && <small>{count}</small>}
          </button>
        ))}
      </div>
      <div
        id="delivery-panel"
        role="tabpanel"
        aria-labelledby={`delivery-tab-${tab}`}
        tabIndex={0}
      >
        {tab === "outcome" && <OutcomeReview detail={detail} openTab={selectTab} />}
        {tab === "plan" && (
          <PlanReview key={run_id} detail={detail}>
            {attention("plan")}
          </PlanReview>
        )}
        {tab === "changes" && (
          <ChangesReview key={run_id} detail={detail}>
            <ApplyPanel
              detail={detail}
              disabled={disabled}
              send={command.send}
            />
          </ChangesReview>
        )}
        {tab === "checks" && (
          <ChecksReview detail={detail}>
            {["review-result", "application-checks"].includes(
              detail.ownerAction.kind,
            ) && attention("other")}
            {detail.ownerAction.kind === "application-checks" && (
              <ApplyPanel
                detail={detail}
                disabled={disabled}
                send={command.send}
              />
            )}
          </ChecksReview>
        )}
        {tab === "activity" && (
          <ActivityReview detail={detail}>
            <>
              {!closed && (
                <form
                  className="guidance"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = guidance.trim();
                    if (body && !disabled)
                      command.send(
                        "message",
                        "message:" + run_id + ":" + body,
                        { run_id, body },
                        () => setGuidance(""),
                      );
                  }}
                >
                  <label htmlFor="v2-guidance">Guidance</label>
                  <div>
                    <input
                      id="v2-guidance"
                      value={guidance}
                      onChange={(e) => setGuidance(e.target.value)}
                    />
                    <button
                      className="icon-button"
                      aria-label="Send guidance"
                      disabled={disabled || !guidance.trim()}
                    >
                      <Send size={19} />
                    </button>
                  </div>
                  {!!detail.messages.length && (
                    <ul className="v2-list">
                      {detail.messages.slice(-4).map((entry) => (
                        <li key={entry.message_id}>
                          <span>{entry.body}</span>
                          <small>{entry.receipt}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </form>
              )}
              {!closed && (
                <button
                  className="text-button stop-delivery"
                  disabled={disabled}
                  onClick={() => control("stop")}
                >
                  Stop delivery
                </button>
              )}
            </>
          </ActivityReview>
        )}
      </div>
    </div>
  );
}

/**
 * The owner's Apply: the exact candidate and result version shown here, written by
 * the protected integrator and checked on the combined source in the checker.
 */
function ApplyPanel({
  detail,
  disabled,
  send,
}: {
  detail: V2RunDetail;
  disabled: boolean;
  send: (
    path: string,
    intent: string,
    body: Body,
    onSuccess?: (data: Body) => void,
  ) => void;
}) {
  const controls = applyControls(detail);
  const latest = controls.latest;
  const [rollbackPreview, setRollbackPreview] =
    useState<RollbackPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const rollbackButton = useRef<HTMLButtonElement>(null);
  if (!transport().capabilities.apply || (!controls.canApply && !latest))
    return null;
  const run_id = detail.run.run_id;
  const act = (action: string, extra: Body) =>
    send(
      "apply",
      [
        "apply",
        action,
        run_id,
        String(extra.candidate_id || extra.application_id || ""),
      ].join(":"),
      { run_id, action, ...extra },
    );
  const reviewRollback = async () => {
    if (!latest) return;
    setPreviewError(null);
    try {
      const preview = await v2Post<RollbackPreview>("apply", {
        run_id,
        action: "rollback-preview",
        application_id: latest.application_id,
      });
      if (!preview.ok) {
        setPreviewError("Review changed");
        return;
      }
      setRollbackPreview(preview);
    } catch {
      setPreviewError("Preview unavailable");
    }
  };
  const rollbackCounts = rollbackPreview
    ? rollbackPreview.operations.reduce(
        (counts, operation) => ({
          ...counts,
          [operation.action]: counts[operation.action] + 1,
        }),
        { restore: 0, delete: 0, recreate: 0 },
      )
    : null;
  return (
    <section className="gate-panel apply-panel">
      <span className="eyebrow">
        {latest ? applicationLabel(latest.state) : detail.candidate?.generation}
      </span>
      <h2>{controls.applyPrimary ? "Apply" : applicationLabel(latest!.state)}</h2>
      {latest && !!latest.conflicts.length && (
        <ul className="v2-list">
          {latest.conflicts.map((conflict) => (
            <li key={conflict.path}>
              <span>{conflict.path}</span>
              <small>{conflict.kind.replace(/-/gu, " ")}</small>
            </li>
          ))}
        </ul>
      )}
      {latest?.inspected && (
        <section className="apply-details">
          <h3>Application</h3>
          <dl>
            <div><dt>Written</dt><dd>{latest.inspected.applied.length}</dd></div>
            <div><dt>Pending</dt><dd>{latest.inspected.pending.length}</dd></div>
            <div><dt>Changed</dt><dd>{latest.inspected.foreign.length}</dd></div>
          </dl>
        </section>
      )}
      {latest?.rollback && <div className="rollback-receipt">{([
        ["Restored", latest.rollback.restored], ["Deleted", latest.rollback.deleted || []], ["Recreated", latest.rollback.recreated || []], ["Conflicts", latest.rollback.foreign.map((entry) => entry.path)],
      ] as const).map(([label, paths]) => paths.length > 0 && <section key={label}><h3>{label} · {paths.length}</h3><ul>{paths.map((path) => <li key={path}>{path}</li>)}</ul></section>)}</div>}
      {latest?.checks?.evidence && (
        <ul className="v2-list">
          {latest.checks.evidence.map((entry) => (
            <li key={entry.criterion_id}>
              <span>{entry.criterion_id}</span>
              <small>
                {evidenceLabel({
                  state: entry.state,
                  reason: entry.reason,
                  label: entry.state,
                })}
              </small>
            </li>
          ))}
        </ul>
      )}
      {controls.canApply && detail.coordination?.sourceChanged && (
        <p className="quiet">
          Source changed · {detail.coordination.sourceChanged.by}
        </p>
      )}
      {latest?.state === "reassessment-failed" &&
        latest.reassessment?.evidence && (
          <ul className="v2-list">
            {latest.reassessment.evidence.map((entry) => (
              <li key={entry.criterion_id}>
                <span>{entry.criterion_id}</span>
                <small>
                  {evidenceLabel({
                    state: entry.state,
                    reason: entry.reason,
                    label: entry.state,
                  })}
                </small>
              </li>
            ))}
          </ul>
        )}
      {latest && !!latest.migrationPaths.length && (
        <p className="quiet">
          SQL files written: {latest.migrationPaths.length}
        </p>
      )}
      <div className="gate-actions">
        {controls.canApply && detail.candidate && controls.resultRef && (
          <button
            className={controls.applyPrimary ? "primary" : "secondary"}
            disabled={disabled}
            onClick={() =>
              act("apply", {
                candidate_id: detail.candidate!.candidate_id,
                result_ref: controls.resultRef,
              })
            }
          >
            Apply
          </button>
        )}
        {controls.canResume && latest && (
          <button
            className="primary"
            disabled={disabled}
            onClick={() =>
              act("resume", { application_id: latest.application_id })
            }
          >
            Resume
          </button>
        )}
        {controls.canRecheck && latest && (
          <button
            className="secondary"
            disabled={disabled}
            onClick={() =>
              act("recheck", { application_id: latest.application_id })
            }
          >
            Recheck
          </button>
        )}
        {controls.canRollback && latest && (
          <button
            ref={rollbackButton}
            className="text-button"
            disabled={disabled}
            onClick={reviewRollback}
          >
            Roll back
          </button>
        )}
        {controls.canApply &&
          !!detail.coordination?.holding?.length &&
          !detail.coordination.released && (
            <button
              className="text-button"
              disabled={disabled}
              onClick={() =>
                send("control", "release:" + run_id, {
                  run_id,
                  action: "release",
                })
              }
            >
              Release
            </button>
          )}
      </div>
      {rollbackPreview && latest && (
        <Sheet
          title="Roll back?"
          open={!!rollbackPreview}
          onClose={() => setRollbackPreview(null)}
          returnFocus={rollbackButton}
        >
          <div className="delivery-artifact">
            <span className="eyebrow">{latest.application_id}</span>

            <ul className="v2-list">
              <li>
                <span>Restore</span>
                <small>{rollbackCounts?.restore ?? 0}</small>
              </li>
              <li>
                <span>Delete</span>
                <small>{rollbackCounts?.delete ?? 0}</small>
              </li>
              <li>
                <span>Recreate</span>
                <small>{rollbackCounts?.recreate ?? 0}</small>
              </li>
            </ul>
            <pre>
              {rollbackPreview.operations
                .map((operation) => operation.action + " " + operation.path)
                .join("\n")}
            </pre>
            <div className="gate-actions">
              <button
                className="secondary"
                autoFocus
                onClick={() => setRollbackPreview(null)}
              >
                Cancel
              </button>
              <button
                className="text-button"
                disabled={disabled}
                onClick={() => {
                  act("rollback", {
                    application_id: latest.application_id,
                    preview_digest: rollbackPreview.digest,
                    expected_revision: rollbackPreview.revision,
                  });
                  setRollbackPreview(null);
                }}
              >
                Roll back
              </button>
            </div>
          </div>
        </Sheet>
      )}
      {previewError && <p className="quiet">{previewError}</p>}
    </section>
  );
}

function Attention({
  detail,
  disabled,
  send,
  control,
  area,
}: {
  detail: V2RunDetail;
  disabled: boolean;
  send: (
    path: string,
    intent: string,
    body: Body,
    onSuccess?: (data: Body) => void,
  ) => void;
  control: (action: string, extra?: Body) => void;
  area: "plan" | "other";
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [handoff, setHandoff] = useState("");
  const run_id = detail.run.run_id;
  const contract_revision = detail.contract.revision;
  const blocking = detail.questions.filter(
    (question) => question.status === "open" && question.blocking,
  );
  const plan = detail.plans[detail.plans.length - 1];
  const kind = detail.ownerAction.kind;
  const mismatch = detail.jobs.find(
    (job) => job.effective?.verification?.mismatch,
  );
  return (
    <>
      {area === "plan" &&
        blocking.map((question) => (
          <section className="gate-panel" key={question.question_id}>
            <span className="eyebrow">
              Question · r{question.plan_revision}
            </span>
            <h2>{question.text}</h2>
            <label>
              Answer
              <textarea
                rows={3}
                value={answers[question.question_id] || ""}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    [question.question_id]: event.target.value,
                  })
                }
              />
            </label>
            <div className="gate-actions">
              <button
                className="primary"
                disabled={
                  disabled || !(answers[question.question_id] || "").trim()
                }
                onClick={() =>
                  send(
                    "answer",
                    "answer:" +
                      question.question_id +
                      ":" +
                      answers[question.question_id],
                    {
                      run_id,
                      question_id: question.question_id,
                      plan_revision: question.plan_revision,
                      answer: answers[question.question_id],
                    },
                  )
                }
              >
                Send
              </button>
            </div>
          </section>
        ))}
      {area === "plan" &&
        !blocking.length &&
        plan &&
        plan.status === "proposed" &&
        detail.run.lifecycle !== "CLOSED" && (
          <section className="gate-panel">
            <span className="eyebrow">Plan · r{plan.revision}</span>
            <h2>{plan.malformed ? "Revise plan" : "Approve plan"}</h2>
            <p>{settingsLine(detail.settings)}</p>
            <label>
              Changes
              <textarea
                rows={2}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
            </label>
            <div className="gate-actions">
              {!plan.malformed && (
                <button
                  className="primary"
                  disabled={disabled}
                  onClick={() =>
                    send("decision", "approve:" + plan.plan_id, {
                      run_id,
                      plan_id: plan.plan_id,
                      plan_revision: plan.revision,
                      contract_revision,
                      decision: "approve",
                    })
                  }
                >
                  Approve
                </button>
              )}
              <button
                className="secondary"
                disabled={disabled || !feedback.trim()}
                onClick={() =>
                  send(
                    "decision",
                    "revise:" + plan.plan_id + ":" + feedback,
                    {
                      run_id,
                      plan_id: plan.plan_id,
                      plan_revision: plan.revision,
                      contract_revision,
                      decision: "revise",
                      feedback,
                    },
                    () => setFeedback(""),
                  )
                }
              >
                Revise
              </button>
            </div>
          </section>
        )}
      {area === "other" && kind === "settings" && mismatch && (
        <section className="gate-panel">
          <span className="eyebrow">Settings mismatch</span>
          <h2>
            {[
              mismatch.effective?.verification?.model,
              mismatch.effective?.verification?.effort,
            ]
              .filter((check) => check && check.state === "mismatched")
              .map((check) => check!.requested + " → " + check!.effective)
              .join(" · ")}
          </h2>
          <div className="gate-actions">
            <select
              value={handoff}
              onChange={(event) => setHandoff(event.target.value)}
              aria-label="Hand off to"
            >
              <option value="">Executor</option>
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </select>
            <button
              className="secondary"
              disabled={disabled || !handoff}
              onClick={() => control("handoff", { executor: handoff })}
            >
              Hand off
            </button>
          </div>
        </section>
      )}
      {area === "other" && kind === "reconcile" && (
        <section className="gate-panel">
          <span className="eyebrow">Outcome unknown</span>
          <h2>Reconcile</h2>
          <div className="gate-actions">
            <button
              className="primary"
              disabled={disabled}
              onClick={() => control("reconcile")}
            >
              Reconcile
            </button>
          </div>
        </section>
      )}
      {area === "other" && kind === "retry-projection" && (
        <section className="gate-panel">
          <span className="eyebrow">Writeback failed</span>
          <h2>{detail.result?.projection_reason || "Retry writeback"}</h2>
          <div className="gate-actions">
            <button
              className="primary"
              disabled={disabled}
              onClick={() => control("retry-projection")}
            >
              Retry
            </button>
          </div>
        </section>
      )}
      {area === "other" && kind === "review-result" && (
        <section className="gate-panel">
          <h2>{detail.run.waiting_reason === "plan-scope-changed" ? "Review scope" : "Review checks"}</h2>
          <div className="gate-actions">
            <button
              className="primary"
              disabled={disabled}
              onClick={() => control("recheck")}
            >
              Recheck
            </button>
            <button
              className="secondary"
              disabled={disabled}
              onClick={() => control("close")}
            >
              Close
            </button>
          </div>
          {detail.run.waiting_reason === "checks-inconclusive" && (
            <ReviseFindings disabled={disabled} control={control} />
          )}
        </section>
      )}
      {area === "other" &&
        kind === "resume" &&
        detail.run.waiting_reason !== "paused" && (
          <section className="gate-panel">
            <span className="eyebrow">
              {(detail.run.waiting_reason || "").replace(/-/gu, " ")}
            </span>
            <h2>Retry</h2>
            <div className="gate-actions">
              <button
                className="primary"
                disabled={disabled}
                onClick={() => control("resume")}
              >
                Retry
              </button>
            </div>
          </section>
        )}
    </>
  );
}

function ReviseFindings({
  disabled,
  control,
}: {
  disabled: boolean;
  control: (action: string, extra?: Body) => void;
}) {
  const [findings, setFindings] = useState("");
  return (
    <div className="gate-actions">
      <textarea
        aria-label="Findings"
        placeholder="Findings"
        value={findings}
        onChange={(event) => setFindings(event.target.value)}
      />
      <button
        className="secondary"
        disabled={disabled || !findings.trim()}
        onClick={() =>
          control("revise", { findings: findings.trim(), authorize_revision: true })
        }
      >
        Revise
      </button>
    </div>
  );
}
