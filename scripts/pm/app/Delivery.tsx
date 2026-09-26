import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronRight, Sparkles, Zap } from "lucide-react";
import { isTrivialLaunchCandidate } from "../../delivery/classify.mjs";
import {
  DIRTY_TREE_ACK,
  RED_BASELINE_ACK,
  TRIAGE_OVERRIDE_ACK,
} from "../../delivery/validation-baseline.mjs";
import { isTerminal } from "../shared/product.mjs";
import { read, post } from "./api";
import { client, go, pmKeys, useRoute, useWorld } from "./state";
import { transport } from "./transport";
import {
  bucketOf,
  canDeliver,
  liveRuns,
  pastOutcomeV1,
  pastOutcomeV2,
  pastOutcomes,
  workPath,
  type PastOutcome,
} from "./model";
import {
  Back,
  Empty,
  ErrorNotice,
  PageTitle,
  RunLink,
  SpaceIcon,
  WorkLink,
} from "./components";
import { returnFromLaunch, selectionFromRoute } from "./Work";
import { LaunchV2, QueueV2, V2RunLink, useV2Runs } from "./DeliveryV2";
import type { Capabilities, Preflight, Recommendation, Work } from "./types";

export function Delivery() {
  const { runs, runError, world } = useWorld();
  const [history, setHistory] = useState(false);
  const [outcome, setOutcome] = useState<PastOutcome | "all">("all");
  const active = liveRuns(runs);
  const past = runs.filter((run) => isTerminal(run.state));
  // V2 runs sit beside V1 sessions; each link names its engine.
  const v2 = useV2Runs();
  const v2Runs = v2.data?.runs || [];
  const v2Active = v2Runs.filter((run) => run.lifecycle !== "CLOSED");
  const v2Past = v2Runs.filter((run) => run.lifecycle === "CLOSED");
  const counts = { apply: 0, applied: 0, cancelled: 0, other: 0 };
  for (const run of past) counts[pastOutcomeV1(run)]++;
  for (const run of v2Past) counts[pastOutcomeV2(run)]++;
  const shown = (kind: PastOutcome) => outcome === "all" || outcome === kind;
  return (
    <div>
      <PageTitle
        eyebrow="From idea to done"
        title="Make it happen."
        action={
          <a className="primary" href="#/explore?lane=now">
            Choose an outcome
            <ArrowRight size={17} />
          </a>
        }
      />
      <ErrorNotice error={runError} />
      <ErrorNotice error={v2.error} />
      <QueueV2 />
      {active.length || v2Active.length ? (
        <section className="delivery-list">
          {v2Active.map((run) => (
            <V2RunLink key={run.run_id} run={run} from="/delivery" />
          ))}
          {active.map((run) => (
            <RunLink key={run.sessionId} run={run} from="/delivery" />
          ))}
        </section>
      ) : (
        <div className="delivery-empty">
          <span className="delivery-illustration">
            <Zap size={62} strokeWidth={1} />
            <i />
            <i />
          </span>
          <h2>Room for your next idea.</h2>
          <p>Choose an outcome to get started.</p>
        </div>
      )}
      {!active.length && !v2Active.length && (
        <section className="next-section">
          <div className="section-title">
            <h2>In focus</h2>
          </div>
          {world.work
            .filter((work) => work.state === "open" && bucketOf(work) === "now")
            .slice(0, 3)
            .map((work) => (
              <WorkLink work={work} key={work.key} from="/delivery" />
            ))}
        </section>
      )}
      {!!(past.length + v2Past.length) && (
        <section className="focus-section">
          <button
            className="section-toggle"
            aria-expanded={history}
            onClick={() => setHistory(!history)}
          >
            Earlier deliveries
            <span>
              {past.length + v2Past.length}
              <ChevronRight size={17} />
            </span>
          </button>
          {history && (
            <div
              className="segmented history-filter"
              role="radiogroup"
              aria-label="Outcome"
            >
              {[
                { id: "all" as const, label: "All", count: past.length + v2Past.length },
                ...pastOutcomes
                  .map((o) => ({ ...o, count: counts[o.id] }))
                  .filter((o) => o.count),
              ].map((o) => (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={outcome === o.id}
                  onClick={() => setOutcome(o.id)}
                >
                  {o.label} <small>{o.count}</small>
                </button>
              ))}
            </div>
          )}
          {history &&
            v2Past
              .filter((run) => shown(pastOutcomeV2(run)))
              .slice(0, 30)
              .map((run) => (
                <V2RunLink key={run.run_id} run={run} from="/delivery" />
              ))}
          {history &&
            past
              .filter((run) => shown(pastOutcomeV1(run)))
              .slice(0, 30)
              .map((run) => (
                <RunLink key={run.sessionId} run={run} from="/delivery" />
              ))}
        </section>
      )}
    </div>
  );
}
export function Launch() {
  const { world } = useWorld();
  const route = useRoute();
  const work = selectionFromRoute(world, route.parts, route.query);
  return work && !canDeliver(work) ? (
    <div className="focus-page">
      <Back />
      <Empty
        title={work.state === "done" ? "Already done" : "Not ready to deliver"}
      >
        <a className="secondary" href={`#${workPath(work)}`}>
          View item
          <ArrowRight size={17} />
        </a>
      </Empty>
    </div>
  ) : work ? (
    <LaunchWork key={work.key + work.rawLine} work={work} />
  ) : (
    <div className="focus-page">
      <Back />
      <Empty title="Choose your next outcome">
        <a className="primary" href="#/explore">
          Explore
          <ArrowRight size={17} />
        </a>
      </Empty>
    </div>
  );
}
const paces = [
  ["INSTANT", "Quick edit", "One precise change"],
  ["FAST", "Focused", "A contained outcome"],
  ["STANDARD", "Standard", "Room to investigate"],
  ["DEEP", "Deep", "Complex, connected work"],
];
function LaunchWork({ work }: { work: Work }) {
  const { connected, runs } = useWorld();
  const route = useRoute();
  const [provider, setProvider] = useState("claude"),
    [model, setModel] = useState(""),
    [lane, setLane] = useState(""),
    [locator, setLocator] = useState(""),
    [effort, setEffort] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false),
    [dirty, setDirty] = useState(""),
    [red, setRed] = useState(""),
    [triage, setTriage] = useState(""),
    [usd, setUsd] = useState<string | null>(null),
    [tokens, setTokens] = useState<string | null>(null),
    [dropped, setDropped] = useState<string[]>([]);
  const v1Launch = transport().capabilities.v1Launch;
  const mode = useQuery({
    queryKey: pmKeys.mode,
    queryFn: ({ signal }) => transport().dispatchMode(signal),
    enabled: connected,
  });
  const caps = useQuery({
    queryKey: pmKeys.capabilities,
    queryFn: ({ signal }) =>
      read<Capabilities>("/api/delivery/capabilities", signal),
    enabled: connected && mode.data?.mode === "v1" && v1Launch,
  });
  const recommendation = useQuery({
    queryKey: pmKeys.recommendation(
      work.file,
      work.cbidx,
      provider,
      lane,
      locator,
    ),
    queryFn: ({ signal }) =>
      read<Recommendation>(
        "/api/delivery/recommendation?" +
          new URLSearchParams({
            file: work.file,
            cbidx: String(work.cbidx),
            provider,
            ...(lane ? { lane } : {}),
            ...(locator ? { locatorChoice: locator } : {}),
          }),
        signal,
      ),
    enabled: connected && !!caps.data && !review,
  });
  const preflight = useMutation({
    mutationFn: () => post<Preflight>("delivery/preflight", {}, 120000),
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }),
  });
  const start = useMutation({
    mutationFn: (body: unknown) =>
      post<{ sessionId: string }>("delivery/start", body, 120000),
    onSuccess: (result) =>
      go(
        "/delivery/session/" +
          result.sessionId +
          "?from=" +
          encodeURIComponent(returnFromLaunch(route.query)),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }),
  });
  const preview = recommendation.data?.preview,
    rec = recommendation.data?.recommendation,
    pace = lane || preview?.recommendedLane || "STANDARD";
  const defaults = caps.data?.config?.budgets?.laneDefaults?.[
    pace.toLowerCase()
  ] || { maxUsd: 2, maxTokens: 2000000, warnPct: 0.8 };
  const dollar = usd ?? String(defaults.maxUsd ?? 2),
    token = tokens ?? String(defaults.maxTokens ?? 2000000);
  const maxUsd = Number(dollar),
    maxTokens = Number(token);
  const trivial =
    !!preview &&
    pace !== "INSTANT" &&
    isTrivialLaunchCandidate(
      preview.item,
      preview.riskFlags,
      preview.scopeHints,
    );
  const pf = preflight.data;
  const ack =
    !!pf &&
    (!pf.dirtyAtStart || dirty === DIRTY_TREE_ACK) &&
    (pf.baselineValidation.ok || red === RED_BASELINE_ACK) &&
    (!trivial || triage === TRIAGE_OVERRIDE_ACK);
  const existing = runs.find(
    (run) =>
      !isTerminal(run.state) &&
      run.item.campaign === work.module &&
      run.item.id === work.id,
  );
  const ready =
    connected &&
    mode.data?.mode === "v1" &&
    !!preview &&
    !recommendation.isFetching &&
    !existing &&
    work.state === "open" &&
    !/\bHELD\b/.test(work.text);
  const launch = () =>
    start.mutate({
      file: work.file,
      cbidx: work.cbidx,
      expectText: work.rawLine,
      agent: provider,
      model: model || rec?.model || undefined,
      effort: Object.keys(effort).length ? effort : rec?.effortByPhase,
      preflightId: pf?.preflightId,
      dirtyAck: dirty,
      redBaselineAck: red,
      triageAck: triage,
      budget: { maxUsd, maxTokens, warnPct: defaults.warnPct ?? 0.8 },
      flightCheck: { reviewed: true, lane: pace },
      locatorChoice: locator || undefined,
      options: { capabilitiesDrop: dropped },
    });
  return (
    <div className="focus-page launch-page">
      <Back fallback="/delivery" />
      <div className="launch-progress">
        <span className={!review ? "current" : "complete"}>
          1 <b>Shape it</b>
        </span>
        <i />
        <span className={review ? "current" : ""}>
          2 <b>Ready to go</b>
        </span>
      </div>
      <header className="launch-heading">
        <SpaceIcon name={work.module} size={25} />
        <span className="eyebrow">
          {work.module} · {work.id}
        </span>
        <h1>{work.title}</h1>
      </header>
      <ErrorNotice
        error={mode.error || caps.error || recommendation.error}
        retry={() => {
          void mode.refetch();
          void caps.refetch();
          void recommendation.refetch();
        }}
      />
      {mode.data?.mode === "v2" ? (
        <LaunchV2 work={work} />
      ) : !v1Launch ? (
        <Empty title={mode.data ? "Desk only" : "Checking…"} />
      ) : !review ? (
        <>
          <section className="launch-section">
            <h2>Who’s taking this on?</h2>
            <div className="provider-choices">
              {Object.keys(
                caps.data?.providers || { claude: {}, codex: {} },
              ).map((name) => (
                <button
                  key={name}
                  aria-pressed={provider === name}
                  onClick={() => {
                    setProvider(name);
                    setModel("");
                    setEffort({});
                  }}
                >
                  <Sparkles size={21} />
                  <strong>{name === "claude" ? "Claude" : "Codex"}</strong>
                  {provider === name && <Check size={17} />}
                </button>
              ))}
            </div>
          </section>
          <section className="launch-section">
            <h2>How deep should it go?</h2>
            <div className="pace-choices">
              {paces.map(([value, label, note]) => (
                <button
                  key={value}
                  aria-pressed={pace === value}
                  onClick={() => {
                    setLane(value);
                    setUsd(null);
                    setTokens(null);
                  }}
                >
                  <span>
                    <strong>{label}</strong>
                    <small>{note}</small>
                  </span>
                  {pace === value && <Check size={17} />}
                </button>
              ))}
            </div>
            {rec && (
              <p className="recommendation-line">
                {paces.find((p) => p[0] === preview?.recommendedLane)?.[1] ||
                  preview?.recommendedLane}{" "}
                suggested
                {rec.estCostUsd != null
                  ? " · ~$" + rec.estCostUsd.toFixed(2) + " estimate"
                  : ""}
              </p>
            )}
          </section>
          {preview?.scopeHints?.locator?.confidence === "ambiguous" && (
            <section className="launch-section">
              <label>
                Which file?
                <select
                  value={locator}
                  onChange={(event) => setLocator(event.target.value)}
                >
                  <option value="">Let discovery decide</option>
                  {preview.scopeHints.locator.hits?.map((hit) => (
                    <option key={hit.path}>{hit.path}</option>
                  ))}
                </select>
              </label>
            </section>
          )}
          <details className="focus-disclosure">
            <summary>Fine-tune</summary>
            <label>
              Model
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                <option value="">
                  Suggested{rec ? " · " + rec.model : ""}
                </option>
                {caps.data?.providers[provider]?.models?.map((value) => (
                  <option value={value.id} key={value.id}>
                    {value.label || value.id}
                  </option>
                ))}
              </select>
            </label>
            <div className="budget-fields">
              <label>
                Cost limit · USD
                <input
                  inputMode="decimal"
                  value={dollar}
                  onChange={(event) => setUsd(event.target.value)}
                />
              </label>
              <label>
                Token limit
                <input
                  inputMode="numeric"
                  value={token}
                  onChange={(event) => setTokens(event.target.value)}
                />
              </label>
            </div>
            <small>Limits are checked between turns.</small>
            <details>
              <summary>Reasoning</summary>
              <div className="budget-fields">
                {["discovery", "plan", "building", "review"].map((phase) => (
                  <label key={phase}>
                    {phase}
                    <select
                      value={effort[phase] || ""}
                      onChange={(event) =>
                        setEffort({ ...effort, [phase]: event.target.value })
                      }
                    >
                      <option value="">Suggested</option>
                      {caps.data?.providers[provider]?.efforts?.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
            <details>
              <summary>Scope & capabilities</summary>
              {preview?.capabilities?.map((capability) => (
                <label className="check-label" key={capability.name}>
                  <input
                    type="checkbox"
                    checked={!dropped.includes(capability.name)}
                    disabled={[
                      "automated-testing",
                      "code-review",
                      "uat-generation",
                    ].includes(capability.name)}
                    onChange={(event) =>
                      setDropped(
                        event.target.checked
                          ? dropped.filter((value) => value !== capability.name)
                          : [...dropped, capability.name],
                      )
                    }
                  />
                  {capability.name}
                </label>
              ))}
              <pre>
                {JSON.stringify(
                  {
                    acceptance: preview?.acceptanceCriteria,
                    scope: preview?.scopeHints,
                    context: preview?.contextManifest,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </details>
          {existing && (
            <p className="quiet">
              This outcome already has an active delivery.
            </p>
          )}
          <div className="launch-footer">
            <span>{rec?.model || "Choosing a model…"}</span>
            <button
              className="primary"
              disabled={
                !ready ||
                !(maxUsd > 0) ||
                !Number.isInteger(maxTokens) ||
                maxTokens <= 0
              }
              onClick={() => {
                setReview(true);
                preflight.mutate();
              }}
            >
              Review
              <ArrowRight size={17} />
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="launch-summary">
            <Sparkles size={24} />
            <div>
              <h2>
                {provider === "claude" ? "Claude" : "Codex"} ·{" "}
                {paces.find((p) => p[0] === pace)?.[1]}
              </h2>
              <p>
                {model || rec?.model} · ${maxUsd} limit
              </p>
            </div>
            <button className="text-button" onClick={() => setReview(false)}>
              Change
            </button>
          </section>
          {preflight.isPending ? (
            <div className="checking">
              <div className="loading-orbit" />
              <span>Checking your workspace…</span>
            </div>
          ) : (
            pf && (
              <section className="flight-review">
                <h2>
                  {pf.baselineValidation.ok
                    ? "Workspace checked"
                    : "Checks need attention"}
                </h2>
                {pf.dirtyAtStart && (
                  <>
                    <details>
                      <summary>
                        {pf.changedFiles.length} files already changed
                      </summary>
                      <pre>{pf.changedFiles.join("\n")}</pre>
                    </details>
                    <label>
                      Type {DIRTY_TREE_ACK}
                      <input
                        value={dirty}
                        onChange={(event) => setDirty(event.target.value)}
                        autoComplete="off"
                      />
                    </label>
                  </>
                )}
                {!pf.baselineValidation.ok && (
                  <>
                    <details>
                      <summary>Baseline results</summary>
                      <pre>
                        {JSON.stringify(pf.baselineValidation.results, null, 2)}
                      </pre>
                    </details>
                    <label>
                      Type {RED_BASELINE_ACK}
                      <input
                        value={red}
                        onChange={(event) => setRed(event.target.value)}
                        autoComplete="off"
                      />
                    </label>
                  </>
                )}
                {trivial && (
                  <label>
                    Small edit · type {TRIAGE_OVERRIDE_ACK}
                    <input
                      value={triage}
                      onChange={(event) => setTriage(event.target.value)}
                      autoComplete="off"
                    />
                  </label>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    setDirty("");
                    setRed("");
                    preflight.mutate();
                  }}
                >
                  Recheck
                </button>
              </section>
            )
          )}
          <ErrorNotice
            error={preflight.error}
            retry={() => preflight.mutate()}
          />
          <ErrorNotice error={start.error} />
          <div className="launch-footer">
            <a
              className="text-button"
              href={"#" + returnFromLaunch(route.query)}
            >
              Leave setup
            </a>
            <button
              className="primary"
              disabled={
                !ready || !ack || preflight.isPending || start.isPending
              }
              onClick={launch}
            >
              <Zap size={17} />
              {start.isPending ? "Starting…" : "Start delivery"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
