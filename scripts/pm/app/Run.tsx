import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Pause,
  Play,
  Send,
  Settings2,
} from "lucide-react";
import { sessionModel, STAGES } from "../src/features/delivery/sessionModel.js";
import { workTitle, sessionStatus } from "../shared/product.mjs";
import { SCOPE_MISMATCH_ACK } from "../../delivery/validation-baseline.mjs";
import { TYPED_APPROVAL_RISK_FLAGS } from "../../delivery/state-machine.mjs";
import { read } from "./api";
import { pmKeys, useCommand, useWorld } from "./state";
import { transport } from "./transport";
import { workPath } from "./model";
import {
  Back,
  Empty,
  ErrorNotice,
  Markdown,
  RunOrb,
  Sheet,
} from "./components";
import type {
  Artifact,
  Capabilities,
  CheckReport,
  Plan,
  RunDetail,
  RunEvent,
} from "./types";

function useArtifact(id: string, path: string, artifacts: Artifact[]) {
  const entry = artifacts.find((artifact) => artifact.path === path);
  return useQuery({
    queryKey: pmKeys.artifact(id, path, entry?.mtimeMs),
    queryFn: ({ signal }) =>
      read<{ content: string; lang: string }>(
        "/api/delivery/artifact?" + new URLSearchParams({ id, path }),
        signal,
      ),
    enabled: !!entry,
  });
}
function parsed<T>(content?: string): T | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
export function Run({ id }: { id: string }) {
  const { connected } = useWorld();
  // V1 session detail is read from the laptop's own files; elsewhere it opens in
  // the view that transport can serve.
  if (!transport().capabilities.v1Detail) {
    const href = transport().v1SessionHref(id);
    return (
      <div className="focus-page">
        <Back fallback="/delivery" />
        <Empty title="V1 delivery">
          {href && (
            <a className="primary" href={href}>
              Open
              <ArrowRight size={17} />
            </a>
          )}
        </Empty>
      </div>
    );
  }
  return <RunLocal id={id} connected={connected} />;
}
function RunLocal({ id, connected }: { id: string; connected: boolean }) {
  const detail = useQuery({
    queryKey: pmKeys.run(id),
    queryFn: ({ signal }) =>
      read<RunDetail>(
        "/api/delivery/session?id=" + encodeURIComponent(id),
        signal,
      ),
    refetchInterval: 5000,
    enabled: connected,
  });
  const events = useQuery({
    queryKey: pmKeys.events(id),
    queryFn: ({ signal }) =>
      read<{ events: RunEvent[] }>(
        "/api/delivery/events?" + new URLSearchParams({ id, after: "0" }),
        signal,
      ),
    refetchInterval: 5000,
    enabled: connected,
  });
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
    <RunStory
      key={id}
      id={id}
      detail={detail.data}
      events={events.data?.events || []}
      refreshError={detail.error || events.error}
    />
  );
}
function RunStory({
  id,
  detail,
  events,
  refreshError,
}: {
  id: string;
  detail: RunDetail;
  events: RunEvent[];
  refreshError: unknown;
}) {
  const { world, connected } = useWorld();
  const { packet, state, artifacts, runner } = detail;
  const command = useCommand();
  const [document, setDocument] = useState(""),
    [manage, setManage] = useState(false),
    [tab, setTab] = useState("story"),
    [guidance, setGuidance] = useState("");
  const plan = useArtifact(id, "plan.json", artifacts),
    checks = useArtifact(id, "validation.json", artifacts),
    handoff = useArtifact(id, "finish/summary.md", artifacts);
  const model = sessionModel(detail, events, parsed<Plan>(plan.data?.content));
  const summary = {
    ...state,
    sessionId: id,
    item: packet.item,
    agent: packet.agent,
    runnerAlive: runner.alive,
  };
  const work = world.work.find(
    (item) =>
      item.id === packet.item.id && item.module === packet.item.campaign,
  );
  const usage = state.usage?.total;
  const tokens = usage
    ? (usage.input || 0) +
      (usage.output || 0) +
      (usage.cachedRead ?? usage.cachedInput ?? 0) +
      (usage.cacheCreation || 0)
    : null;
  const budget = state.budget?.current || packet.budget;
  const checkResults = Object.entries(
    parsed<CheckReport>(checks.data?.content)?.results || {},
  );
  const send = (type: string, payload: unknown = {}) =>
    command.mutate({ op: "delivery/control", body: { id, type, payload } });
  return (
    <div className="run-page">
      <Back fallback="/delivery" />
      <header className="run-heading">
        <div>
          <span className="eyebrow">
            {packet.item.campaign} · {packet.item.id}
          </span>
          <h1>{workTitle(packet.item)}</h1>
          {work && (
            <a
              className="plain-link"
              href={"#" + workPath(work, "/delivery/session/" + id)}
            >
              The outcome
              <ArrowRight size={14} />
            </a>
          )}
        </div>
        {!model.terminal && (
          <button
            className="icon-button"
            aria-label="Manage delivery"
            onClick={() => setManage(true)}
          >
            <Settings2 size={20} />
          </button>
        )}
      </header>
      <ErrorNotice error={refreshError} />
      <ErrorNotice error={command.error} />
      <section className="run-moment">
        <RunOrb
          running={model.running && !refreshError && connected}
          space={packet.item.campaign}
          size={100}
        />
        <div>
          <span className="eyebrow">
            {refreshError || !connected
              ? "Last known state"
              : model.running
                ? "Working on it"
                : model.terminal
                  ? "Delivery recorded"
                  : "A moment to pause"}
          </span>
          <h2>{sessionStatus(summary)}</h2>
          <p>
            {state.execution?.provider || packet.agent}
            {state.execution?.model || packet.agentConfig?.model
              ? " · " + (state.execution?.model || packet.agentConfig?.model)
              : ""}
          </p>
        </div>
        {!model.terminal && (
          <button
            className="round-button"
            aria-label={
              state.execution?.paused ? "Resume delivery" : "Pause delivery"
            }
            disabled={!connected || command.isPending}
            onClick={() =>
              send(state.execution?.paused ? "resume-run" : "pause")
            }
          >
            {state.execution?.paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        )}
      </section>
      <nav className="journey" aria-label="Delivery stages">
        {STAGES.map((stage, index) => {
          const visited = stage.phases.some((phase) =>
            model.visited.has(phase),
          );
          return (
            <div
              key={stage.label}
              className={
                index === model.stage ? "current" : visited ? "visited" : ""
              }
            >
              <span>
                {visited && index !== model.stage ? (
                  <Check size={13} />
                ) : (
                  index + 1
                )}
              </span>
              <strong>{stage.label}</strong>
            </div>
          );
        })}
      </nav>
      {!runner.alive && !model.terminal && (
        <div className="runner-stopped">
          <span>
            Runner stopped
            {state.lastError?.message ? " · " + state.lastError.message : ""}
          </span>
          <button
            className="secondary"
            disabled={!connected || command.isPending}
            onClick={() =>
              command.mutate({ op: "delivery/resume", body: { id } })
            }
          >
            Restart
            <Play size={14} />
          </button>
        </div>
      )}
      {state.awaiting && (
        <Gate
          key={state.awaiting.gate + JSON.stringify(state.awaiting)}
          id={id}
          detail={detail}
          plan={parsed<Plan>(plan.data?.content)}
          openDocument={setDocument}
        />
      )}
      <nav className="story-tabs" aria-label="Delivery view">
        {["story", "evidence"].map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "story" ? "The story" : "Evidence"}
            {tab === value && <motion.i layoutId="run-tab" />}
          </button>
        ))}
      </nav>
      {tab === "story" ? (
        <>
          <ErrorNotice error={plan.error || checks.error || handoff.error} />
          {handoff.data && (
            <section className="handoff">
              <span className="eyebrow">Handoff</span>
              <Markdown raw={handoff.data.content} />
            </section>
          )}
          <div className="run-story-grid">
            <section className="run-steps">
              <div className="section-title">
                <h2>{model.terminal ? "What happened" : "Taking shape"}</h2>
                {model.steps.length > 0 && (
                  <small>
                    {
                      model.steps.filter((step) => step.status === "done")
                        .length
                    }{" "}
                    / {model.steps.length} steps
                  </small>
                )}
              </div>
              {model.steps.length ? (
                <ol>
                  {model.steps.map((step, index) => (
                    <li className={step.status} key={step.id}>
                      <span className="step-index">
                        {step.status === "done" ? (
                          <Check size={16} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <div>
                        <h3>{step.description || step.title || step.id}</h3>
                        <small>
                          {step.status === "done"
                            ? "Completed"
                            : step.status === "current"
                              ? model.running
                                ? "In progress"
                                : "Current step · stopped"
                              : "Upcoming"}
                        </small>
                        {!!step.paths?.length && (
                          <details>
                            <summary>
                              Files
                              <ChevronDown size={12} />
                            </summary>
                            <p>{step.paths.join("\n")}</p>
                          </details>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="quiet">
                  {state.build?.mode === "fix"
                    ? "Addressing the check results."
                    : "The plan has not been recorded yet."}
                </p>
              )}
            </section>
            <section className="run-checks">
              <h2>Checks & resources</h2>
              {checkResults.length ? (
                checkResults.map(([name, result]) => (
                  <div className="check-row" key={name}>
                    <span>{name}</span>
                    <strong data-pass={result.ok && !result.skipped}>
                      {result.skipped
                        ? "Skipped"
                        : result.ok === true
                          ? "Passed"
                          : result.ok === false
                            ? "Failed"
                            : "Not verified"}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="quiet">No checks recorded yet.</p>
              )}
              <div className="resource-line">
                <span>Recorded cost</span>
                <strong>
                  {Number.isFinite(usage?.costUsd)
                    ? "$" + usage!.costUsd!.toFixed(2)
                    : "Unavailable"}
                </strong>
              </div>
              <div className="resource-line">
                <span>Tokens</span>
                <strong>
                  {tokens === null ? "Unavailable" : tokens.toLocaleString()}
                </strong>
              </div>
              {budget?.maxTokens && tokens !== null ? (
                <>
                  <progress
                    max={budget.maxTokens}
                    value={Math.min(tokens, budget.maxTokens)}
                    aria-label="Recorded token use"
                  />
                  <small>{budget.maxTokens.toLocaleString()} limit</small>
                </>
              ) : null}
              {budget?.maxUsd && (
                <small className="budget-caption">
                  ${budget.maxUsd} cost limit
                </small>
              )}
            </section>
          </div>
          {!!state.workspace?.changedFiles?.length && (
            <details className="focus-disclosure">
              <summary>
                {state.workspace.changedFiles.length} files changed
              </summary>
              <pre>{state.workspace.changedFiles.join("\n")}</pre>
            </details>
          )}
          {model.recent.length > 0 && (
            <section className="recorded-activity">
              <h2>Latest movement</h2>
              {model.recent.slice(0, 5).map((event) => (
                <div key={event.seq}>
                  <i />
                  <span>{event.label}</span>
                  <time>
                    {event.at || event.ts
                      ? new Date(event.at || event.ts).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </time>
                </div>
              ))}
            </section>
          )}
          {!model.terminal && (
            <form
              className="guidance"
              onSubmit={(event) => {
                event.preventDefault();
                command.mutate(
                  {
                    op: "delivery/message",
                    body: { id, text: guidance.trim() },
                  },
                  { onSuccess: () => setGuidance("") },
                );
              }}
            >
              <label htmlFor="guidance">A thought for the next turn</label>
              <div>
                <input
                  id="guidance"
                  value={guidance}
                  onChange={(event) => setGuidance(event.target.value)}
                  placeholder="Add guidance…"
                />
                <button
                  className="icon-button"
                  aria-label="Send guidance"
                  disabled={!connected || !guidance.trim() || command.isPending}
                >
                  <Send size={19} />
                </button>
              </div>
              {command.isSuccess && <small role="status">Queued</small>}
            </form>
          )}
        </>
      ) : (
        <section className="evidence-list">
          <h2>What the run recorded</h2>
          {artifacts.length ? (
            artifacts.map((artifact) => (
              <button
                key={artifact.path}
                onClick={() => setDocument(artifact.path)}
              >
                <FileText size={18} />
                <span>{artifact.path}</span>
                <small>{Math.ceil(artifact.size / 1024)} KB</small>
                <ArrowRight size={15} />
              </button>
            ))
          ) : (
            <p className="quiet">No artifacts recorded yet.</p>
          )}
          <details>
            <summary>Event history</summary>
            <pre>{JSON.stringify(events, null, 2)}</pre>
          </details>
          <RunQuestions id={id} closed={model.terminal} />
          <Transcript id={id} />
          <details>
            <summary>Session reference</summary>
            <code>{id}</code>
            {packet.parentSession && (
              <a href={"#/delivery/session/" + packet.parentSession}>
                Parent delivery
              </a>
            )}
            {state.forks?.map((fork) => (
              <a href={"#/delivery/session/" + fork} key={fork}>
                Branch · {fork}
              </a>
            ))}
            <pre>
              {JSON.stringify(
                {
                  usage: state.usage,
                  workspace: state.workspace,
                  acceptance: state.acceptance,
                },
                null,
                2,
              )}
            </pre>
          </details>
          <a
            className="plain-link"
            href={"/?ui=classic#/delivery/session/" + id}
          >
            Advanced workspace
            <ArrowRight size={15} />
          </a>
        </section>
      )}
      <ArtifactSheet
        id={id}
        path={document}
        artifacts={artifacts}
        close={() => setDocument("")}
      />
      {manage && (
        <Manage id={id} detail={detail} close={() => setManage(false)} />
      )}
    </div>
  );
}
function ArtifactSheet({
  id,
  path,
  artifacts,
  close,
}: {
  id: string;
  path: string;
  artifacts: Artifact[];
  close: () => void;
}) {
  const data = useArtifact(id, path, artifacts);
  return (
    <Sheet
      open={!!path}
      title={path.split("/").at(-1) || "Evidence"}
      onClose={close}
    >
      <ErrorNotice error={data.error} retry={() => void data.refetch()} />
      {data.data ? (
        path.endsWith(".md") ? (
          <Markdown raw={data.data.content} />
        ) : (
          <pre className="artifact-content">{data.data.content}</pre>
        )
      ) : (
        !data.error && (
          <p>
            {artifacts.some((a) => a.path === path)
              ? "Opening…"
              : "This artifact has not been recorded."}
          </p>
        )
      )}
    </Sheet>
  );
}
function Gate({
  id,
  detail,
  plan,
  openDocument,
}: {
  id: string;
  detail: RunDetail;
  plan: Plan | null;
  openDocument: (path: string) => void;
}) {
  const { connected } = useWorld();
  const command = useCommand();
  const awaiting = detail.state.awaiting!;
  const gate = awaiting.gate;
  const [note, setNote] = useState(""),
    [confirm, setConfirm] = useState(""),
    [slice, setSlice] = useState(""),
    [scopeAck, setScopeAck] = useState(""),
    [usd, setUsd] = useState(""),
    [tokens, setTokens] = useState("");
  const title: Record<string, string> = {
    spec: "Does this capture the idea?",
    plan: "Ready for this approach?",
    uat: "Try what’s been built.",
    question: "A question for you.",
    blocked: "Your guidance is needed.",
    budget: "The limit has been reached.",
    shipped: "Ready to record the outcome.",
  };
  const documents: Record<string, string> = {
    spec: "spec.md",
    plan: "plan.md",
    uat: "uat/summary.md",
  };
  const typed =
    gate === "plan" &&
    !!plan?.riskFlags?.some((flag) => TYPED_APPROVAL_RISK_FLAGS.includes(flag));
  const scope = awaiting.scope;
  const send = (decision: string, extra: Record<string, unknown> = {}) =>
    command.mutate({
      op: "delivery/decision",
      body: {
        id,
        gate,
        decision,
        note: note || undefined,
        answer: note || undefined,
        confirmText: confirm,
        tickCheckbox: true,
        ...(slice ? { scopeSlice: Number(slice) } : {}),
        scopeAck,
        ...extra,
      },
    });
  const disabled = !connected || command.isPending;
  const scopeReady =
    !scope?.mismatch || !!slice || scopeAck === SCOPE_MISMATCH_ACK;
  return (
    <section className="gate-panel">
      <span className="eyebrow">Over to you</span>
      <h2>{title[gate] || "A decision is needed."}</h2>
      {awaiting.reason && <p>{awaiting.reason}</p>}
      {awaiting.questions?.map((question, index) => (
        <p key={question.id || index}>{question.text}</p>
      ))}
      {documents[gate] && (
        <button
          className="secondary"
          onClick={() => openDocument(documents[gate])}
        >
          Review{" "}
          {gate === "spec" ? "scope" : gate === "plan" ? "plan" : "handoff"}
          <ArrowRight size={15} />
        </button>
      )}
      {scope?.mismatch && (
        <div className="scope-choice">
          <p>{scope.reason}</p>
          {!!scope.decomposition?.length && (
            <label>
              Scope
              <select
                value={slice}
                onChange={(event) => setSlice(event.target.value)}
              >
                <option value="">Full scope</option>
                {scope.decomposition.map((part, index) => (
                  <option key={index} value={index + 1}>
                    {typeof part === "string"
                      ? part
                      : part.title || part.outcome || "Slice " + (index + 1)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!slice && (
            <label>
              Type {SCOPE_MISMATCH_ACK}
              <input
                value={scopeAck}
                onChange={(event) => setScopeAck(event.target.value)}
              />
            </label>
          )}
        </div>
      )}
      <label>
        {gate === "question"
          ? "Your answer"
          : gate === "blocked"
            ? "Retry guidance"
            : gate === "budget"
              ? "Reason"
              : "Note"}
        <textarea
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {typed && (
        <label>
          Type APPROVE
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>
      )}
      {gate === "budget" && (
        <div className="budget-fields">
          <label>
            New cost limit
            <input
              inputMode="decimal"
              value={usd}
              onChange={(event) => setUsd(event.target.value)}
            />
          </label>
          <label>
            New token limit
            <input
              inputMode="numeric"
              value={tokens}
              onChange={(event) => setTokens(event.target.value)}
            />
          </label>
        </div>
      )}
      <ErrorNotice error={command.error} />
      <div className="gate-actions">
        {["spec", "plan"].includes(gate) ? (
          <>
            <button
              className="primary"
              disabled={
                disabled || !scopeReady || (typed && confirm !== "APPROVE")
              }
              onClick={() => send("approve")}
            >
              Approve
              <Check size={16} />
            </button>
            <button
              className="text-button"
              disabled={disabled || !note.trim()}
              onClick={() => send("reject")}
            >
              Revise
            </button>
          </>
        ) : gate === "uat" ? (
          <>
            <button
              className="primary"
              disabled={disabled}
              onClick={() => send("accept")}
            >
              Accept
              <Check size={16} />
            </button>
            <button
              className="text-button"
              disabled={disabled || !note.trim()}
              onClick={() => send("reject")}
            >
              Revise
            </button>
          </>
        ) : gate === "question" ? (
          <button
            className="primary"
            disabled={disabled || !note.trim()}
            onClick={() => send("answer")}
          >
            Answer
            <Send size={16} />
          </button>
        ) : gate === "blocked" ? (
          <button
            className="primary"
            disabled={disabled || !note.trim()}
            onClick={() => send("retry")}
          >
            Retry
            <ArrowRight size={16} />
          </button>
        ) : gate === "shipped" ? (
          <button
            className="primary"
            disabled={disabled}
            onClick={() => send("shipped")}
          >
            Record shipped
            <Check size={16} />
          </button>
        ) : gate === "budget" ? (
          <button
            className="primary"
            disabled={
              disabled ||
              !note.trim() ||
              !(Number(usd) > 0 || Number(tokens) > 0)
            }
            onClick={() =>
              command.mutate({
                op: "delivery/control",
                body: {
                  id,
                  type: "set-budget",
                  payload: {
                    ...(usd ? { maxUsd: Number(usd) } : {}),
                    ...(tokens ? { maxTokens: Number(tokens) } : {}),
                    reason: note,
                  },
                },
              })
            }
          >
            Raise limit
          </button>
        ) : (
          <a
            className="secondary"
            href={"/?ui=classic#/delivery/session/" + id}
          >
            Open decision
          </a>
        )}
        {command.isSuccess && <small role="status">Decision queued</small>}
      </div>
    </section>
  );
}
function Manage({
  id,
  detail,
  close,
}: {
  id: string;
  detail: RunDetail;
  close: () => void;
}) {
  const { connected } = useWorld();
  const command = useCommand();
  const [action, setAction] = useState(""),
    [provider, setProvider] = useState(
      detail.state.execution?.provider || detail.packet.agent,
    ),
    [model, setModel] = useState(
      detail.state.execution?.model || detail.packet.agentConfig?.model || "",
    );
  const caps = useQuery({
    queryKey: pmKeys.capabilities,
    queryFn: ({ signal }) =>
      read<Capabilities>("/api/delivery/capabilities", signal),
    enabled: connected,
  });
  const control = (type: string, payload: unknown = {}) =>
    command.mutate(
      { op: "delivery/control", body: { id, type, payload } },
      { onSuccess: close },
    );
  return (
    <Sheet title="Manage delivery" open onClose={close}>
      <div className="manage-actions">
        {!action ? (
          <>
            <button onClick={() => setAction("model")}>
              Change model
              <ArrowRight size={16} />
            </button>
            <button
              disabled={!connected || command.isPending}
              onClick={() => control("fork")}
            >
              Branch delivery
              <ArrowRight size={16} />
            </button>
            {caps.data?.providers[provider]?.manifest?.supportsAbort && (
              <button onClick={() => setAction("stop")}>
                Stop turn
                <ArrowRight size={16} />
              </button>
            )}
            <button onClick={() => setAction("cancel")}>
              Cancel delivery
              <ArrowRight size={16} />
            </button>
          </>
        ) : action === "model" ? (
          <>
            <label>
              Provider
              <select
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value);
                  setModel("");
                }}
              >
                {Object.keys(caps.data?.providers || {}).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                <option value="">Default</option>
                {caps.data?.providers[provider]?.models.map((value) => (
                  <option value={value.id} key={value.id}>
                    {value.label || value.id}
                  </option>
                ))}
              </select>
            </label>
            <p className="quiet">
              {provider !==
              (detail.state.execution?.provider || detail.packet.agent)
                ? "Provider switch starts an uncached verification turn."
                : "Applies at the next turn."}
            </p>
            <button
              className="primary"
              disabled={!connected || command.isPending || !caps.data}
              onClick={() =>
                control("set-config", {
                  provider,
                  model: model || caps.data?.providers[provider]?.defaultModel,
                })
              }
            >
              Apply
            </button>
          </>
        ) : (
          <>
            <p>
              {action === "cancel"
                ? "Ends this delivery permanently. Evidence stays available."
                : "Stops the current turn; its response is lost. Existing file edits remain."}
            </p>
            <button
              className="primary"
              disabled={!connected || command.isPending}
              onClick={() =>
                action === "cancel"
                  ? command.mutate(
                      {
                        op: "delivery/decision",
                        body: { id, decision: "cancel" },
                      },
                      { onSuccess: close },
                    )
                  : control("pause", { abortInFlight: true })
              }
            >
              {action === "cancel" ? "Cancel delivery" : "Stop turn"}
            </button>
          </>
        )}
        <ErrorNotice error={command.error || caps.error} />
      </div>
    </Sheet>
  );
}
interface Question {
  id: string;
  text: string;
  answer?: { text: string };
}
function RunQuestions({ id, closed }: { id: string; closed: boolean }) {
  const { connected } = useWorld();
  const command = useCommand();
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: pmKeys.questions(id),
    queryFn: ({ signal }) =>
      read<{
        blocking: Question[];
        advisory: Question[];
        answered: Question[];
      }>("/api/delivery/questions?id=" + encodeURIComponent(id), signal),
    enabled: connected,
    refetchInterval: 5000,
  });
  return (
    <details>
      <summary>Questions</summary>
      <ErrorNotice error={q.error} />
      {q.data?.blocking.map((item) => (
        <p key={item.id}>{item.text} · Answer above</p>
      ))}
      {q.data?.advisory.map((item) => (
        <div className="advisory" key={item.id}>
          <label>
            {item.text}
            <textarea
              value={answer[item.id] || ""}
              onChange={(event) =>
                setAnswer({ ...answer, [item.id]: event.target.value })
              }
            />
          </label>
          <button
            disabled={
              closed ||
              !connected ||
              !answer[item.id]?.trim() ||
              command.isPending
            }
            onClick={() =>
              command.mutate({
                op: "delivery/control",
                body: {
                  id,
                  type: "answer",
                  payload: { questionId: item.id, text: answer[item.id] },
                },
              })
            }
          >
            Answer
          </button>
        </div>
      ))}
      {q.data?.answered.map((item) => (
        <div key={item.id}>
          <p>{item.text}</p>
          <p>{item.answer?.text}</p>
        </div>
      ))}
      <ErrorNotice error={command.error} />
    </details>
  );
}
function Transcript({ id }: { id: string }) {
  const { connected } = useWorld();
  const [turn, setTurn] = useState("");
  const turns = useQuery({
    queryKey: pmKeys.turns(id),
    queryFn: ({ signal }) =>
      read<{ turns: { turnId: string; phase: string; status?: string }[] }>(
        "/api/delivery/turns?id=" + encodeURIComponent(id),
        signal,
      ),
    enabled: connected,
  });
  const records = useQuery({
    queryKey: pmKeys.transcript(id, turn),
    queryFn: ({ signal }) =>
      read<{ records: unknown[] }>(
        "/api/delivery/transcript?" + new URLSearchParams({ id, turn }),
        signal,
      ),
    enabled: connected && !!turn,
  });
  return (
    <details>
      <summary>Recorded turns</summary>
      <ErrorNotice error={turns.error || records.error} />
      <select
        aria-label="Recorded turn"
        value={turn}
        onChange={(event) => setTurn(event.target.value)}
      >
        <option value="">Choose a turn</option>
        {turns.data?.turns.map((item) => (
          <option key={item.turnId} value={item.turnId}>
            {item.turnId} · {item.phase}
          </option>
        ))}
      </select>
      {records.data && (
        <pre>{JSON.stringify(records.data.records, null, 2)}</pre>
      )}
    </details>
  );
}
