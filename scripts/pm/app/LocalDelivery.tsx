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

export const offersLocalLane = () =>
  transport().capabilities.kind === "local" &&
  isLoopbackOrigin(location.origin);
export interface LocalReadiness {
  ready: boolean;
  facts: Record<string, { state: string; code: string; detail?: string }>;
}
export interface LocalRunView {
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
  activity: {
    at: string;
    summary: string | null;
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
      <div className="gate-actions">
        <button
          className="primary"
          disabled={!connected || !session.data?.paired || busy || (library && (!previous.isSuccess || (!pendingBody && !chosen)))}
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

export function LocalActions({ run, busy, act }: { run: Pick<LocalRunView, "phase" | "head" | "canShip" | "canUndo" | "interrupted" | "handover">; busy: boolean; act: (action: "review" | "ship" | "undo" | "cancel") => void }) {
  return <div className="gate-actions">
    <button className="secondary" disabled={busy || !run.head} onClick={() => act("review")}>Review diff</button>
    {run.handover && <a className="secondary" href={`#/delivery/test/${run.handover.handover_id}`}>Test steps</a>}
    <button className="primary" disabled={busy || !(run.canShip || run.phase === "push-pending")} onClick={() => act("ship")}>{run.phase === "push-pending" ? "Retry push" : "Ship"}</button>
    {(run.canUndo || run.phase === "revert-push-pending") && <button className="secondary" disabled={busy} onClick={() => act("undo")}>Undo</button>}
    {["preparing", "building", "checking"].includes(run.phase) && <button className="secondary" disabled={busy} onClick={() => act("cancel")}>Cancel</button>}
  </div>;
}

export function LocalRun({ id }: { id: string }) {
  const session = useV2Session();
  const game = useGameLayer();
  const route = useRoute();
  const [patch, setPatch] = useState<{ runId: string; value: string } | null>(
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
      return phase && ["failed", "cancelled", "reverted"].includes(phase)
        ? false
        : phase === "shipped"
          ? 15_000
          : 4000;
    },
  });
  const command = useMutation({
    mutationFn: async (action: "review" | "ship" | "undo" | "cancel") => {
      const runId = id;
      return {
        ...(await v2Post<{ patch?: string }>(
          "local",
          { action, run_id: runId },
          120_000,
        )),
        runId,
      };
    },
    onSuccess: (result) => {
      if (result.patch !== undefined)
        setPatch({ runId: result.runId, value: result.patch });
    },
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }),
  });
  const run = detail.data;
  if (session.data && !session.data.paired) return <PairV2 />;
  if (!offersLocalLane()) return <p>Open on the laptop</p>;
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
            busy={command.isPending}
            act={(action) => command.mutate(action)}
            patch={patch?.runId === id ? patch.value : null}
            poll={{
              dataUpdatedAt: detail.dataUpdatedAt,
              isError: detail.isError,
            }}
            retry={() => void detail.refetch()}
          />
          {!game.enabled && <HostLimits />}
        </>
      )}
    </div>
    </LibraryArrival>
  );
}
