import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isLoopbackOrigin } from "../../delivery-v2/local-auth-browser.mjs";
import { read, v2Post } from "./api";
import { PairV2, useV2Session } from "./BrowserSession";
import { Back, ErrorNotice } from "./components";
import { client, go, pmKeys, useRoute, useWorld } from "./state";
import { RefusedCommand, transport } from "./transport";
import { useGameLayer } from "./GameLayer";
import { DeliveryMission } from "./DeliveryMission";
import { LibraryCrew } from "./LibraryCrew";
import { LibraryArrival, LibraryEyelids } from "./LibraryArrival";
import { durableV2Command, storedIntent } from "./commandIntents";
import { effortsFor } from "./v2model";
import { launchRecommendation } from "./launchRecommendationModel";
import { LaunchRecommendation } from "./LaunchRecommendation";
import { LocalRunReview } from "./LocalRunReview";
import type { LocalFailureRecord } from "./localRunFailure";
import { displayTitle } from "./localRunModel";
import {FoundryStandby} from './stage/FoundryStandby';
import type { UatHandover, Work } from "./types";
import type { LocalOwnerMessage, LocalQuestion } from "./localChatModel";
import { UatPage } from "./UatWizard";
import { GitCommands } from "./LocalWorkflow";
export { LocalActions } from "./LocalWorkflow";

export const offersLocalLane = () =>
  transport().capabilities.kind === "local" &&
  isLoopbackOrigin(location.origin);
export interface LocalReadiness {
  ready: boolean;
  facts: Record<string, { state: string; code: string; detail?: string }>;
}
export interface LocalRunView {
  cancelCleanupCommands?: string[][];
  base?: string | null;
  run_id: string;
  phase: string;
  workspace: string;
  branch: string;
  head: string | null;
  current_head: string | null;
  reviewed_head?: string | null;
  canShip: boolean;
  canUndo: boolean;
  interrupted: boolean;
  error?: string;
  failure?: LocalFailureRecord;
  work: {
    id: string;
    title: string;
    campaign?: string;
    topic?: string;
    file?: string;
    brief?: string;
  };
  settings?: { executor: string; model: string | null; effort: string | null };
  risk?: { required: boolean; flagged: { path: string; domains: string[] }[] };
  checks: {
    name: string;
    exit: number | null;
    stdout: string;
    stderr: string;
    error: string | null;
    started_at?: string;
    finished_at?: string;
  }[];
  earlier_activity?: boolean;
  activity: {
    at: string;
    summary: string | null;
    message_text?: string;
    message_excerpt?: boolean;
    kind?: string;
    seq?: number;
    job_id?: string | null;
    agent_json?:
      | { role?: string; id?: string; executor?: string; model?: string }
      | string
      | null;
  }[];
  usage: Record<string, number | string | null> | null;
  merge?: string | null;
  handover: UatHandover | null;
  questions?: LocalQuestion[];
  messages?: LocalOwnerMessage[];
  /** DLV-165: waiting on the owner with no process; not interrupted. */
  parked?: boolean;
  canMessage?: boolean;
  /** DLV-166: the candidate's dev server, started from Test steps. */
  preview?: LocalPreviewView | null;
  /** DLV-167: the session's files against the main checkout since the run's base. */
  mergePlan?: LocalMergePlan | null;
  canMerge?: boolean;
  applied?: { at: string; files: string[]; main_head: string; pm_error: string | null; manifest?: { path: string }[] } | null;
  committed?: { sha: string; at: string } | null;
  pushed?: { sha: string; at: string; remote: string; branch: string } | null;
  cleaned_at?: string | null;
  cleanup_error?: string | null;
  cleanup_archive?: string | null;
  cleanup_outcome?: string | null;
  activeCommand?: string | null;
  merge_pending?: { main_head: string } | null;
  publication_log?: { at: string; argv: string[]; exit: number | null; tail: string }[];
  publication?: { action: "commit" | "push"; commands: string[][]; files: string[]; token: string | null; reason: string | null; recover?: boolean; outgoing?: string[]; cleanupCommands?: string[][]; cleanupInput?: string | null } | null;
  refresh?: { conflicts?: string[] } | null;
}
export interface LocalMergePlan {
  files: { status: string; path: string }[];
  conflicts: { path: string; committed: boolean; uncommitted: boolean }[];
  branch: string | null;
  expected: string;
  error?: string;
  dirtyConflicts?: string[];
  committedConflicts?: string[];
  refreshCommands?: string[][];
  refreshBase?: string;
  canRefresh?: boolean;
}
export type LocalAction = "review" | "merge" | "commit" | "push" | "refresh" | "recheck" | "test" | "cancel" | "discard";
export type LocalAct = (action: LocalAction, evidence?: Record<string, string>) => void;
export interface LocalPreviewView {
  state: "starting" | "ready" | "stopped" | "failed";
  url: string | null;
  port: number | null;
  started_at: string;
  exit: number | null;
  tail: string;
}

export function LocalReadinessPanel({ data }: { data: LocalReadiness }) {
  const labels: Record<string, string> = {
    source: "Source",
    authentication: "Sign-in",
    environment: "Dependencies",
    coordination: "Sessions",
    modelAvailability: "Model",
    budget: "Usage",
  };
  const fixes: Record<string, string> = {
    "commit-or-stash-changes": "Commit or stash pending changes",
    "checkout-main": "Switch to the main branch",
    "base-unknown": "Main branch unavailable",
    "subscription-sign-in-required-no-api-keys": "Sign in to your subscription",
    "install-frozen-dependencies": "Install dependencies from the lockfile",
  };
  const blockers = Object.entries(data.facts).filter(
    ([, fact]) => !["pass", "advisory"].includes(fact.state),
  );
  return (
    <section
      className="launch-readiness local-readiness"
      aria-label="Local readiness"
    >
      {blockers.map(([name, fact]) => (
        <p key={name}>{fixes[fact.code] || fact.code.replaceAll("-", " ")}</p>
      ))}
      <details className="launch-check-details">
        <summary>Check details</summary>
        <ul className="launch-check-list">
          {Object.entries(data.facts).map(([name, fact]) => (
            <li key={name}>
              <span>{labels[name] || name}</span>
              <small>
                {fact.state === "pass"
                  ? "Passed"
                  : fact.state === "advisory"
                    ? `Advisory · ${fact.code.replaceAll("-", " ")}`
                    : fact.code.replaceAll("-", " ")}
              </small>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function LocalLaunch({ work }: { work: Work }) {
  const [executor, setExecutor] = useState("claude");
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("");
  const { connected, world } = useWorld();
  const selectionTouched = useRef(false);
  const route = useRoute();
  const game = useGameLayer();
  const library = game.enabled && route.query.get("library") === "1";
  const [arrival, setArrival] = useState<string | null>(null);
  const starting = useRef(false);
  const session = useV2Session();
  const intent = `local-start:${work.file}:${work.idChip || work.id}`;
  const scope = `${session.data?.scope}:${session.data?.actor}`;
  const previous = useQuery({
    queryKey: pmKeys.v2intent(scope, intent),
    queryFn: () => storedIntent(scope, intent, localStorage),
    enabled: library && connected && !!session.data?.paired,
  });
  const pendingBody = library ? previous.data?.body : null;
  const workId = work.idChip || work.id;
  const preview = useQuery({
    queryKey: pmKeys.localStartPlan(work.file, workId),
    queryFn: ({ signal }) => read<{ commands: string[][]; cleanupCommands?: string[][]; branch: string; start_nonce: string; token: string }>(
      "/api/delivery/v2/local/start-plan?" + new URLSearchParams({ file: work.file, id: workId }), signal),
    enabled: connected && !!session.data?.paired && !pendingBody,
  });
  const catalogue = useQuery({
    queryKey: pmKeys.v2executors,
    queryFn: ({ signal }) => transport().v2Executors(signal),
    enabled: connected,
  });
  const chosen = catalogue.data?.executors.find(entry => entry.id === executor);
  const recommendation = launchRecommendation(work, world.cockpit?.setup?.entities, catalogue.data);
  const restoreRecommendation = () => {
    if (!recommendation?.supported) return;
    setExecutor(recommendation.executor); setModel(recommendation.model); setEffort(recommendation.effort);
  };
  useEffect(() => {
    if (pendingBody) {
      selectionTouched.current = true;
      setExecutor(String(pendingBody.executor));
      setModel(String(pendingBody.model || ""));
      setEffort(String(pendingBody.effort || ""));
      return;
    }
    if (selectionTouched.current || !recommendation?.supported) return;
    setExecutor(recommendation.executor); setModel(recommendation.model); setEffort(recommendation.effort);
  }, [pendingBody, recommendation?.executor, recommendation?.model, recommendation?.effort, recommendation?.supported]);
  useEffect(() => {
    if (!arrival) return;
    const timer = window.setTimeout(() => go(`/delivery/run/${encodeURIComponent(arrival)}?arrival=library`),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
    return () => clearTimeout(timer);
  }, [arrival]);
  const start = useMutation({
    mutationFn: async () => {
      const body = pendingBody || {
        action: "start",
        start_nonce: preview.data?.start_nonce,
        preview_id: preview.data?.token,
        id: work.idChip || work.id,
        file: work.file,
        executor,
        model: model || null,
        effort: effort || null,
      };
      const result = library
        ? await durableV2Command<{ run_id: string }>("local", intent, body, 120_000)
        : await v2Post<{ run_id: string }>("local", { ...body, command_id: crypto.randomUUID() }, 120_000);
      if (!result.run_id?.startsWith("local-")) throw new Error("Session ID unavailable");
      return result;
    },
    onSuccess: (result) => {
      if (library) setArrival(result.run_id);
      else go(`/delivery/run/${result.run_id}`);
    },
    onSettled: () => {
      starting.current = false;
      return client.invalidateQueries({ queryKey: pmKeys.all });
    },
  });
  const refusal =
    start.error instanceof RefusedCommand
      ? (start.error.payload.readiness as LocalReadiness | undefined)
      : undefined;
  const query = new URLSearchParams(route.query);
  query.set("lane", "confined");
  if (session.data && !session.data.paired) return <PairV2 />;
  const busy = start.isPending || !!arrival;
  const locked = busy || !!pendingBody;
  const selectExecutor = (id: string) => {
    selectionTouched.current = true;
    setExecutor(id);
    setModel("");
    setEffort("");
    start.reset();
  };
  const controls = (
    <>
      <LaunchRecommendation recommendation={recommendation} disabled={locked} onRestore={() => {
        selectionTouched.current = true; restoreRecommendation(); start.reset();
      }} />
      {!library && <label>
        Executor
        <select
          value={executor}
          disabled={locked}
          onChange={(event) => selectExecutor(event.target.value)}
        >
          <option value="claude">Claude{recommendation?.executor === "claude" ? " ✨" : ""}</option>
          <option value="codex">Codex{recommendation?.executor === "codex" ? " ✨" : ""}</option>
        </select>
      </label>}
      <div className="budget-fields">
        <label htmlFor="local-model">Model
          <select id="local-model" aria-label="Model" value={model} disabled={locked || !chosen} onChange={event => {
            selectionTouched.current = true; setModel(event.target.value); setEffort(""); start.reset();
          }}>
            <option value="">Default</option>
            {chosen?.models.map(entry => <option key={entry.id} value={entry.id} disabled={entry.disabled}>{entry.label || entry.id}{recommendation?.executor === executor && recommendation.model === entry.id ? " ✨" : ""}</option>)}
          </select>
        </label>
        <label htmlFor="local-effort">Effort
          <select id="local-effort" aria-label="Effort" value={effort} disabled={locked || !chosen} onChange={event => {
            selectionTouched.current = true; setEffort(event.target.value); start.reset();
          }}>
            <option value="">Default</option>
            {chosen && effortsFor(chosen, model).map(value => <option key={value} value={value}>{value}{recommendation?.executor === executor && recommendation.model === model && recommendation.effort === value ? " ✨" : ""}</option>)}
          </select>
        </label>
      </div>
      <ErrorNotice error={catalogue.error || session.error || previous.error || (refusal ? null : start.error)} retry={
        catalogue.error ? () => void catalogue.refetch() : previous.error ? () => void previous.refetch() : undefined
      } />
      {refusal && (
        <section aria-label="Start result" role="status">
          <h2>Start blocked</h2>
          <LocalReadinessPanel data={refusal} />
        </section>
      )}
      {preview.data && <details className="launch-check-details">
        <summary>Start commands</summary>
        <GitCommands commands={preview.data.commands} />
        {!!preview.data.cleanupCommands?.length && <>
          <strong>On failure or cancellation</strong>
          <GitCommands commands={preview.data.cleanupCommands} />
          <small>Delete {preview.data.branch} at its archived commit.</small>
        </>}
      </details>}
      <ErrorNotice error={preview.error} retry={() => void preview.refetch()} />
      <div className="gate-actions">
        <button
          className="primary"
          disabled={!connected || !session.data?.paired || busy || (!pendingBody && !preview.data) || (library && (!previous.isSuccess || (!pendingBody && !chosen)))}
          onClick={() => {
            if (starting.current) return;
            selectionTouched.current = true;
            starting.current = true;
            start.mutate();
          }}
        >
          {arrival ? "Entering room…" : start.isPending ? "Checking…" : pendingBody ? "Resume start" : "Start"}
        </button>
        {!library && !start.isPending && (
          <a className="secondary" href={`#${route.path}?${query}`}>
            Confined
          </a>
        )}
      </div>
      {!connected && <p role="status">Laptop offline</p>}
      <HostLimits />
    </>
  );
  return (
    <div
      className={`focus-page launch-page${game.enabled ? " delivery-game-page" : ""}`}
    >
      <Back fallback="/delivery" />
      {library ? (
        <>
          <LibraryCrew work={work} executor={executor} onSelect={selectExecutor} locked={locked} checking={start.isPending && !arrival}>
            {controls}
          </LibraryCrew>
          {arrival && <LibraryEyelids closing />}
        </>
      ) : game.enabled ? (
        <DeliveryMission
          work={work}
          lane="local"
          busy={start.isPending}
          blocked={!!start.error}
        >
          {controls}
        </DeliveryMission>
      ) : (
        <>
          <header className="launch-heading">
            <span className="eyebrow">{work.idChip || work.id} · Local</span>
            <h1>{displayTitle({ work: { id: work.idChip || work.id, title: work.title } })}</h1>
          </header>
          {controls}
        </>
      )}
    </div>
  );
}

function HostLimits() {
  return <details><summary>Host limits</summary><p>Credential scrub prevents accidents, not deliberate host access.</p></details>;
}

export function LocalRun({ id }: { id: string }) {
  const session = useV2Session();
  const game = useGameLayer();
  const route = useRoute();
  const [testId, setTestId] = useState<string | null>(null);
  const [patch, setPatch] = useState<{ runId: string; head: string | null; value: string } | null>(
    null,
  );
  const detail = useQuery({
    queryKey: pmKeys.localRun(id),
    queryFn: ({ signal }) =>
      read<LocalRunView>(
        `/api/delivery/v2/local/run?id=${encodeURIComponent(id)}`,
        signal,
      ),
    enabled: !!session.data?.paired && offersLocalLane(),
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      if (query.state.data?.activeCommand) return 2000;
      return query.state.data?.cleaned_at || (phase && ["failed", "cancelled", "reverted", "discarded", "cleaned"].includes(phase))
        ? false
        : phase === "shipped"
          ? 15_000
          : 4000;
    },
  });
  const command = useMutation({
    mutationFn: async ({ action, evidence }: { action: LocalAction; evidence?: Record<string, string> }) => {
      const runId = id;
      const head = detail.data?.head ?? null;
      return {
        ...(await v2Post<{ patch?: string }>(
          "local",
          { ...evidence, action, run_id: runId },
          action === "refresh" ? 100 * 60_000 : action === "commit" ? 30 * 60_000 : action === "push" || action === "discard" ? 15 * 60_000 : 120_000,
        )),
        runId, head,
      };
    },
    onSuccess: (result) => {
      if (result.patch !== undefined)
        setPatch({ runId: result.runId, head: result.head, value: result.patch });
    },
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }),
  });
  const run = detail.data;
  const closeTests = () => {
    setTestId(null);
    void detail.refetch();
  };
  const act: LocalAct = (action, evidence) => {
    if (action === "test") setTestId(run?.handover?.handover_id ?? null);
    else if (action === "recheck") void detail.refetch();
    else command.mutate({ action, evidence });
  };
  if (session.data && !session.data.paired) return <PairV2 />;
  if (!offersLocalLane()) return <p>Open on the laptop</p>;
  if (testId && run?.handover?.handover_id === testId) return <UatPage id={testId} onReturn={closeTests} />;
  return (
    <LibraryArrival key={id} active={game.enabled && route.query.get("arrival") === "library"}
      error={!!(session.error || detail.error)}>
    <div
      className={`run-page local-run-page${game.enabled ? " local-run-game-page" : ""}`}
    >
      {!game.enabled && <Back fallback="/delivery" />}
      {(!game.enabled || run) && <ErrorNotice
        error={session.error || (game.enabled && run ? null : detail.error) || command.error}
        retry={() => void detail.refetch()}
      />}
      {!run && (game.enabled ? <FoundryStandby error={session.error || detail.error || command.error} retry={() => void detail.refetch()} /> : detail.isPending && <p role="status">Loading session…</p>)}
      {run && (
        <>
          <LocalRunReview
            run={run}
            busy={command.isPending || !!run.activeCommand}
            act={act}
            patch={patch?.runId === id && patch.head === run.head ? patch.value : null}
            poll={{
              dataUpdatedAt: detail.dataUpdatedAt,
              isError: detail.isError,
            }}
            retry={() => void detail.refetch()}
          />
        </>
      )}
    </div>
    </LibraryArrival>
  );
}
