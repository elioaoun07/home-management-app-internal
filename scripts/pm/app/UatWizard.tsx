// R76 — the owner's test wizard: one numbered action at a time, its expected
// result, Pass / Fail / Blocked per scenario, then Sign off or Needs changes.
//
// This surface only reads and records. Opening it never launches a session,
// applies a candidate, calls a provider or touches application data. Every
// write is an owner command with a stable id: a timeout is shown as Pending
// sync and retried with the same id, never as saved or failed without a receipt.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronLeft, ChevronRight, CircleAlert, CircleDashed, ExternalLink, ListChecks, MessageSquarePlus, Save, Undo2, X } from "lucide-react";
import { v2Post } from "./api";
import { Back, Empty, ErrorNotice } from "./components";
import { PairV2, useV2Session } from "./BrowserSession";
import { client, message, pmKeys, useWorld } from "./state";
import { useClock } from "./StewardRequests";
import { PendingCommand as PendingError, PmError, transport } from "./transport";
import type { UatHandover, UatScenario, UatSummary } from "./types";
import {
  RESULT_LABEL,
  blockerText,
  clearPending,
  clampPosition,
  clearLocalDraft,
  deviceLabel,
  feedbackDefaults,
  feedbackState,
  initialPosition,
  listPending,
  move,
  newCommandId,
  noteRequired,
  progress,
  readLocalDraft,
  readPending,
  staleLocalDraft,
  uatLabel,
  workHref,
  writeLocalDraft,
  writePending,
  type Position,
} from "./uatModel";
import "./uat.css";

// --- queries ---------------------------------------------------------------

/** All handovers, newest first. Keeps the last good list when a refresh fails. */
export function useUat(enabled = true) {
  const { connected } = useWorld();
  const session = useV2Session();
  const available = Boolean(transport().v2Uat);
  return useQuery({
    queryKey: pmKeys.v2uat,
    queryFn: async ({ signal }): Promise<UatSummary[]> => {
      try {
        return (await transport().v2Uat!(signal)).handovers;
      } catch (error) {
        // A server started before this feature has no such route: no tests, not an error.
        if (error instanceof PmError && error.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && connected && available && !!session.data?.paired,
    refetchInterval: 10000,
  });
}

export function useUatOne(id: string) {
  const { connected } = useWorld();
  const session = useV2Session();
  const available = Boolean(transport().v2UatOne);
  return useQuery({
    queryKey: pmKeys.v2uatOne(id),
    queryFn: async ({ signal }): Promise<UatHandover> => (await transport().v2UatOne!(id, signal)).handover,
    enabled: connected && available && !!session.data?.paired,
    refetchInterval: 8000,
  });
}

// --- commands --------------------------------------------------------------

type Phase = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "pending" } | { kind: "error"; message: string };
type Reply = { ok: boolean; repeated?: boolean; handover?: UatHandover };

/**
 * Sends owner commands with a stable id. The body and id are written to local
 * storage before sending, so a reload or a lost reply retries the same command.
 */
function useUatSender(handoverId: string) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pending, setPending] = useState(() => listPending(localStorage, handoverId));
  const sync = useCallback(() => setPending(listPending(localStorage, handoverId)), [handoverId]);
  const send = useCallback(
    async (intent: string, body: Record<string, unknown> | null): Promise<Reply | null> => {
      let command = readPending(localStorage, handoverId, intent);
      if (!command) {
        if (!body) return null;
        command = { command_id: newCommandId(), body };
        writePending(localStorage, handoverId, intent, command);
      }
      setPhase({ kind: "saving" });
      try {
        const reply = await v2Post<Reply>("uat", { ...command.body, command_id: command.command_id });
        clearPending(localStorage, handoverId, intent);
        if (reply.handover) client.setQueryData(pmKeys.v2uatOne(handoverId), reply.handover);
        void client.invalidateQueries({ queryKey: pmKeys.v2uat });
        setPhase({ kind: "saved" });
        sync();
        return reply;
      } catch (error) {
        // An unconfirmed command keeps its id; a definite refusal is over.
        if (error instanceof PendingError) setPhase({ kind: "pending" });
        else {
          clearPending(localStorage, handoverId, intent);
          setPhase({ kind: "error", message: message(error) });
        }
        sync();
        return null;
      }
    },
    [handoverId, sync],
  );
  const discard = useCallback(
    (intent: string) => {
      clearPending(localStorage, handoverId, intent);
      setPhase({ kind: "idle" });
      sync();
    },
    [handoverId, sync],
  );
  return { phase, pending, send, discard, setPhase };
}
type Sender = ReturnType<typeof useUatSender>;

// --- small pieces ----------------------------------------------------------

const BEIRUT = "Asia/Beirut";
const stamp = (iso: string) => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: BEIRUT, day: "numeric", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: BEIRUT, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day}, ${time}`;
};
export const attemptDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: BEIRUT, day: "numeric", month: "short" }).format(new Date(iso));

function Chip({ tone, children }: { tone?: "ok" | "warn" | "wait" | "done"; children: React.ReactNode }) {
  return (
    <span className="uat-chip" data-tone={tone}>
      {children}
    </span>
  );
}

/** Backtick spans in drafted wording read as code. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part))}
    </>
  );
}

function ResultIcon({ result }: { result: UatScenario["result"] }) {
  if (result === "pass") return <Check size={15} aria-hidden />;
  if (result === "fail") return <X size={15} aria-hidden />;
  if (result === "blocked") return <CircleAlert size={15} aria-hidden />;
  return <CircleDashed size={15} aria-hidden />;
}

function StatusLine({ sender }: { sender: Sender }) {
  const { phase, pending } = sender;
  return (
    <div className="uat-status" role="status" aria-live="polite">
      {phase.kind === "saving" && <span>Saving…</span>}
      {phase.kind === "saved" && <span>Saved</span>}
      {phase.kind === "error" && <span data-tone="warn">{phase.message}</span>}
      {(phase.kind === "pending" || pending.length > 0) && <span data-tone="wait">Pending sync</span>}
      {pending.map(({ intent }) => (
        <span className="uat-retry" key={intent}>
          <button className="secondary" onClick={() => void sender.send(intent, null)}>
            Retry
          </button>
          <button className="text-button" onClick={() => sender.discard(intent)}>
            Discard
          </button>
        </span>
      ))}
    </div>
  );
}

// --- the wizard ------------------------------------------------------------

export function UatPage({ id }: { id: string }) {
  const { connected } = useWorld();
  const session = useV2Session();
  const one = useUatOne(id);
  if (!transport().v2UatOne)
    return (
      <div className="uat-page">
        <Back fallback="/delivery" />
        <Empty title="Open on the laptop" />
      </div>
    );
  if (session.data?.paired === false && transport().capabilities.pairing)
    return <div className="uat-page"><Back fallback="/delivery" /><PairV2 /></div>;
  if (session.isError)
    return <ErrorNotice error={session.error} retry={() => void session.refetch()} />;
  if (!session.data || one.isLoading) return <p className="d-idle">Loading</p>;
  if (!one.data)
    return (
      <div className="uat-page">
        <Back fallback="/delivery" />
        <ErrorNotice error={one.error} />
        <Empty title="Not found" />
      </div>
    );
  return <Wizard key={`${one.data.handover_id}:${one.data.revision}`} handover={one.data} refreshError={one.error} offline={!connected} />;
}

export function Wizard({ handover, refreshError, offline }: { handover: UatHandover; refreshError: unknown; offline: boolean }) {
  const now = useClock(15000);
  const sender = useUatSender(handover.handover_id);
  const local = useMemo(() => readLocalDraft(localStorage, handover), [handover]);
  const [position, setPosition] = useState<Position>(() =>
    local?.position && handover.scenarios.some((scenario) => scenario.id === local.position.scenario_id) ? clampPosition(handover, local.position) : initialPosition(handover),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() => ({ ...(handover.draft?.notes ?? {}), ...(local?.notes ?? {}) }));
  const [choice, setChoice] = useState<"fail" | "blocked" | null>(null);
  const [all, setAll] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [build, setBuild] = useState(handover.environment.build ?? "");
  const heading = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);

  const scenario = handover.scenarios.find((entry) => entry.id === position.scenario_id) ?? handover.scenarios[0];
  const usable = handover.status !== "incomplete" && handover.scenarios.length > 0;
  const recordable = handover.status === "ready" && !handover.signoff;
  const outdated = handover.staleDraft || staleLocalDraft(localStorage, handover);
  const done = progress(handover);

  // The position and the typed note survive a reload, per revision.
  useEffect(() => {
    writeLocalDraft(localStorage, handover, { position, notes });
  }, [handover, position, notes]);
  useEffect(() => {
    if (navigated.current) heading.current?.focus();
    navigated.current = true;
  }, [position]);
  useEffect(() => setChoice(null), [position.scenario_id]);
  // Coming back online retries what was left unconfirmed, once, under the same ids.
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) for (const entry of sender.pending) void sender.send(entry.intent, null);
    wasOffline.current = offline;
  }, [offline, sender]);

  const go = (next: Position | null) => next && setPosition(next);
  const note = (notes[scenario?.id ?? ""] ?? "").slice(0, 500);
  const base = { handover_id: handover.handover_id, revision: handover.revision };

  const record = async (result: "pass" | "fail" | "blocked") => {
    if (!scenario) return;
    const reply = await sender.send(`result:${scenario.id}`, {
      action: "result",
      ...base,
      scenario_id: scenario.id,
      result,
      ...(noteRequired(result) ? { note: note.trim() } : {}),
      step: position.step + 1,
      build: handover.environment.build ?? undefined,
      device: deviceLabel(navigator.userAgent),
    });
    if (reply?.ok) {
      setChoice(null);
      if (result === "pass") setNotes((current) => ({ ...current, [scenario.id]: "" }));
    }
  };
  const saveDraft = async () => {
    sender.setPhase({ kind: "saving" });
    try {
      await v2Post("uat", { action: "draft", ...base, position: { scenario_id: position.scenario_id, step: position.step }, notes, base_rev: handover.draftRev });
      void client.invalidateQueries({ queryKey: pmKeys.v2uatOne(handover.handover_id) });
      sender.setPhase({ kind: "saved" });
    } catch (error) {
      sender.setPhase({ kind: "error", message: message(error) });
    }
  };
  const hasPending = (intent: string) => sender.pending.some((entry) => entry.intent === intent);
  const busy = sender.phase.kind === "saving";
  // Binds this draft to the run's candidate, or to the checkout as it is now. A new
  // revision starts Pending, so the saved place for the draft is dropped with it.
  const markReady = async () => {
    const reply = await sender.send("ready", { action: "ready", handover_id: handover.handover_id });
    if (reply?.ok) clearLocalDraft(localStorage, handover);
  };

  return (
    <div className="uat-page">
      <Back fallback="/delivery" />
      <header className="uat-head">
        <div>
          <span className="eyebrow">{[handover.subject.campaign, handover.subject.work_id].filter(Boolean).join(" · ") || "Delivery"}</span>
          <h1>{handover.subject.title || handover.summary || handover.subject.work_id || "Test steps"}</h1>
        </div>
        <div className="uat-chips">
          <Chip tone={handover.acceptance.shipped ? "ok" : handover.status === "ready" ? undefined : "wait"}>{uatLabel(handover)}</Chip>
          <Chip>r{handover.revision}</Chip>
          {handover.stale && <Chip tone="warn">Stale</Chip>}
          {outdated && <Chip tone="wait">Outdated draft</Chip>}
          {offline && <Chip tone="warn">Offline</Chip>}
        </div>
      </header>
      <ErrorNotice error={refreshError} />

      {handover.status === "draft" && (
        <div className="uat-draft">
          <button className="primary" disabled={busy || offline || hasPending("ready")} onClick={() => void markReady()}>
            <Check size={16} aria-hidden />
            Mark ready
          </button>
        </div>
      )}

      {handover.problems.length > 0 && (
        <ul className="uat-problems" aria-label="Problems">
          {handover.problems.map((problem, index) => (
            <li key={index}>
              {[problem.scenario, problem.step ? `step ${problem.step}` : null].filter(Boolean).join(" · ")} {problem.code.replace(/-/gu, " ")}
            </li>
          ))}
        </ul>
      )}

      {usable && (
        <details className="uat-setup" open={done.done === 0}>
          <summary>Setup</summary>
          <dl>
            <div>
              <dt>Where</dt>
              <dd>{[handover.environment.target, handover.environment.build, handover.environment.device].filter(Boolean).join(" · ")}</dd>
            </div>
            {handover.environment.url && (
              <div>
                <dt>Open</dt>
                <dd>
                  <a href={handover.environment.url} target="_blank" rel="noreferrer">
                    {handover.environment.url}
                    <ExternalLink size={13} aria-hidden />
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {handover.setup && (
            <p className="uat-pre">
              <Inline text={handover.setup} />
            </p>
          )}
          {handover.limits && <p className="uat-pre uat-muted">{handover.limits}</p>}
          {handover.status === "ready" && handover.environment.target !== "none" && (
            <div className="uat-build">
              <label>
                <span>Build</span>
                <input value={build} onChange={(event) => setBuild(event.target.value)} maxLength={200} />
              </label>
              <button
                className="secondary"
                disabled={busy || offline || !!handover.signoff || hasPending("availability")}
                aria-pressed={handover.availability.state === "available"}
                onClick={() => void sender.send("availability", { action: "availability", ...base, available: true, build: build.trim() || undefined })}
              >
                <Check size={16} aria-hidden />
                {handover.availability.state === "available" ? "Available" : "Confirm"}
              </button>
            </div>
          )}
        </details>
      )}

      {usable && scenario && (
        <>
          <nav className="uat-scenarios" aria-label="Scenarios">
            {handover.scenarios.map((entry) => (
              <button
                key={entry.id}
                aria-current={entry.id === scenario.id ? "step" : undefined}
                data-result={entry.result}
                onClick={() => setPosition({ scenario_id: entry.id, step: 0 })}
              >
                <ResultIcon result={entry.result} />
                <span>{entry.title}</span>
                {!entry.required && <small>Optional</small>}
              </button>
            ))}
          </nav>

          <section className="uat-card" aria-labelledby="uat-step-title">
            <div className="uat-card-head">
              <span className="uat-count">
                {all ? `${done.done}/${done.total} passed` : `Step ${position.step + 1} of ${scenario.steps.length}`}
              </span>
              <button className="text-button" aria-pressed={all} onClick={() => setAll(!all)}>
                <ListChecks size={16} aria-hidden />
                All steps
              </button>
            </div>

            {all ? (
              <div className="uat-all">
                {handover.scenarios.map((entry) => (
                  <section key={entry.id}>
                    <h3>
                      {entry.title} <small>{RESULT_LABEL[entry.result]}</small>
                    </h3>
                    <ol>
                      {entry.steps.map((step, index) => (
                        <li key={index}>
                          <p>
                            <Inline text={step.action} />
                          </p>
                          <p className="uat-expect">
                            <Inline text={step.expected} />
                          </p>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            ) : (
              <>
                <h2 id="uat-step-title" tabIndex={-1} ref={heading}>
                  <Inline text={scenario.steps[position.step]?.action ?? ""} />
                </h2>
                <div className="uat-expect-box">
                  <span>Expect</span>
                  <p>
                    <Inline text={scenario.steps[position.step]?.expected ?? ""} />
                  </p>
                </div>
                <div className="uat-nav">
                  <button className="secondary" disabled={!move(handover, position, -1)} onClick={() => go(move(handover, position, -1))}>
                    <ChevronLeft size={18} aria-hidden />
                    Back
                  </button>
                  <button className="primary" disabled={!move(handover, position, 1)} onClick={() => go(move(handover, position, 1))}>
                    Next
                    <ChevronRight size={18} aria-hidden />
                  </button>
                </div>
                {(scenario.defect || scenario.starting || scenario.setup || scenario.cleanup || scenario.limits) && (
                  <details className="uat-context">
                    <summary>Context</summary>
                    {scenario.setup && <p className="uat-pre">{scenario.setup}</p>}
                    {scenario.starting && <p className="uat-pre">{scenario.starting}</p>}
                    {scenario.defect && <p className="uat-pre">{scenario.defect}</p>}
                    {scenario.limits && <p className="uat-pre uat-muted">{scenario.limits}</p>}
                    {scenario.cleanup && (
                      <p className="uat-pre">
                        <strong>Reset</strong> {scenario.cleanup}
                      </p>
                    )}
                  </details>
                )}
              </>
            )}

            {recordable && (
              <fieldset className="uat-result" disabled={offline || busy || hasPending(`result:${scenario.id}`)}>
                <legend>Result</legend>
                <div className="uat-result-buttons" role="group" aria-label="Result">
                  <button data-tone="pass" aria-pressed={scenario.result === "pass"} onClick={() => void record("pass")}>
                    <Check size={16} aria-hidden />
                    Pass
                  </button>
                  <button data-tone="fail" aria-pressed={choice === "fail" || (!choice && scenario.result === "fail")} onClick={() => setChoice("fail")}>
                    <X size={16} aria-hidden />
                    Fail
                  </button>
                  <button data-tone="blocked" aria-pressed={choice === "blocked" || (!choice && scenario.result === "blocked")} onClick={() => setChoice("blocked")}>
                    <CircleAlert size={16} aria-hidden />
                    Blocked
                  </button>
                </div>
                {choice && (
                  <div className="uat-note">
                    <label>
                      <span>What happened</span>
                      <textarea
                        value={note}
                        maxLength={500}
                        rows={3}
                        onChange={(event) => setNotes({ ...notes, [scenario.id]: event.target.value })}
                      />
                    </label>
                    <button className="primary" disabled={!note.trim()} onClick={() => void record(choice)}>
                      Record
                    </button>
                  </div>
                )}
                {scenario.receipt && (
                  <small className="uat-muted">
                    {RESULT_LABEL[scenario.result]} · {stamp(scenario.receipt.received_at)}
                    {scenario.receipt.note ? ` · ${scenario.receipt.note}` : ""}
                  </small>
                )}
              </fieldset>
            )}
          </section>

          <div className="uat-actions">
            <button className="secondary" onClick={() => void saveDraft()} disabled={busy || offline || !!handover.signoff}>
              <Save size={16} aria-hidden />
              Save
            </button>
            <button className="secondary" onClick={() => setSheet(true)} disabled={handover.status === "incomplete"}>
              <MessageSquarePlus size={16} aria-hidden />
              Needs changes
            </button>
            {handover.signoff ? (
              <button className="secondary" disabled={busy || offline || hasPending("retract")} onClick={() => void sender.send("retract", { action: "retract", ...base })}>
                <Undo2 size={16} aria-hidden />
                Retract
              </button>
            ) : (
              <button
                className="primary"
                disabled={!handover.signable || busy || offline || hasPending("signoff")}
                onClick={() => void sender.send("signoff", { action: "signoff", ...base, build: build.trim() || undefined })}
              >
                <Check size={16} aria-hidden />
                Sign off
              </button>
            )}
          </div>

          {handover.signoff ? (
            <p className="uat-signed" role="status">
              <Chip tone={handover.acceptance.shipped ? "ok" : "warn"}>{handover.acceptance.shipped ? "Shipped" : uatLabel(handover)}</Chip> {stamp(handover.signoff.received_at)}
              {handover.signoff.build ? ` · ${handover.signoff.build}` : ""}
            </p>
          ) : (
            handover.blockers.length > 0 && (
              <ul className="uat-blockers" aria-label="Before sign off">
                {handover.blockers.map((blocker) => (
                  <li key={blocker.code}>{blockerText(blocker)}</li>
                ))}
              </ul>
            )
          )}
        </>
      )}

      <StatusLine sender={sender} />

      {handover.feedback.length > 0 && (
        <section className="uat-feedback" aria-label="Feedback">
          <h2>Feedback</h2>
          <ul>
            {handover.feedback.map((thread) => {
              const state = feedbackState(thread, now);
              const href = workHref(thread);
              return (
                <li key={thread.thread_id}>
                  <div>
                    <Chip tone={state.tone}>{state.label}</Chip>
                    <small className="uat-muted">
                      {thread.classification === "bug" ? "Bug" : thread.classification === "change" ? "Change" : "Comment"} · {stamp(thread.received_at)}
                    </small>
                  </div>
                  <p>{thread.observation}</p>
                  {thread.import?.status === "blocked" && thread.import.cause && <small className="uat-muted">{thread.import.cause}</small>}
                  <div className="uat-feedback-actions">
                    {href && (
                      <a className="secondary" href={href}>
                        Open work
                      </a>
                    )}
                    {thread.state === "submitted" && (
                      <button className="text-button" disabled={busy || hasPending(`withdraw:${thread.thread_id}`)} onClick={() => void sender.send(`withdraw:${thread.thread_id}`, { action: "feedback-withdraw", thread_id: thread.thread_id })}>
                        {state.undo ? "Undo" : "Withdraw"}
                      </button>
                    )}
                    {thread.state === "submitted" && thread.classification !== "comment" && (
                      <button className="text-button" onClick={() => setResolving(resolving === thread.thread_id ? null : thread.thread_id)}>
                        Resolve
                      </button>
                    )}
                  </div>
                  {resolving === thread.thread_id && (
                    <div className="uat-note">
                      <label>
                        <span>Reason</span>
                        <textarea value={reason} maxLength={500} rows={2} onChange={(event) => setReason(event.target.value)} />
                      </label>
                      <div className="uat-feedback-actions">
                        <button
                          className="secondary"
                          disabled={!reason.trim() || busy}
                          onClick={async () => {
                            const reply = await sender.send(`resolve:${thread.thread_id}`, { action: "feedback-disposition", thread_id: thread.thread_id, kind: "resolved", reason: reason.trim() });
                            if (reply?.ok) {
                              setResolving(null);
                              setReason("");
                            }
                          }}
                        >
                          Verified
                        </button>
                        <button
                          className="secondary"
                          disabled={!reason.trim() || busy}
                          onClick={async () => {
                            const reply = await sender.send(`resolve:${thread.thread_id}`, { action: "feedback-disposition", thread_id: thread.thread_id, kind: "follow-up", reason: reason.trim() });
                            if (reply?.ok) {
                              setResolving(null);
                              setReason("");
                            }
                          }}
                        >
                          Follow-up
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <FeedbackSheet open={sheet} onOpenChange={setSheet} handover={handover} position={position} sender={sender} offline={offline} />
    </div>
  );
}

// --- Needs changes ---------------------------------------------------------

const textKey = (handoverId: string) => `pm-uat-text:${handoverId}`;
const readText = (handoverId: string) => {
  try {
    return localStorage.getItem(textKey(handoverId)) ?? "";
  } catch {
    return "";
  }
};
const writeText = (handoverId: string, value: string) => {
  try {
    if (value) localStorage.setItem(textKey(handoverId), value);
    else localStorage.removeItem(textKey(handoverId));
  } catch {
    /* storage unavailable: the form still works */
  }
};

function FeedbackSheet({ open, onOpenChange, handover, position, sender, offline }: { open: boolean; onOpenChange: (open: boolean) => void; handover: UatHandover; position: Position; sender: Sender; offline: boolean }) {
  const defaults = useMemo(() => feedbackDefaults(handover, position), [handover, position]);
  const [kind, setKind] = useState<"bug" | "change" | "comment">(defaults.classification);
  const [text, setText] = useState(() => readText(handover.handover_id));
  const [actual, setActual] = useState("");
  const [details, setDetails] = useState("");
  const [link, setLink] = useState("");
  const [urgent, setUrgent] = useState(false);
  const pending = sender.pending.find((entry) => entry.intent === "feedback");
  useEffect(() => {
    if (open) setKind(defaults.classification);
  }, [open, defaults.classification]);
  useEffect(() => writeText(handover.handover_id, text), [handover.handover_id, text]);

  const submit = async () => {
    const reply = await sender.send("feedback", {
      action: "feedback",
      handover_id: handover.handover_id,
      revision: handover.revision,
      scenario_id: defaults.scenario_id,
      step: defaults.step,
      classification: kind,
      urgency: urgent ? "now" : "next",
      observation: text.trim(),
      expected: defaults.expected,
      actual: actual.trim(),
      details: details.trim(),
      evidence: link.trim() ? [link.trim()] : [],
      build: handover.environment.build ?? undefined,
      device: deviceLabel(navigator.userAgent),
    });
    if (reply?.ok) {
      setText("");
      setActual("");
      setDetails("");
      setLink("");
      setUrgent(false);
      onOpenChange(false);
    }
  };
  const busy = sender.phase.kind === "saving";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-shade" />
        <Dialog.Content className="sheet uat-sheet" aria-describedby={undefined}>
          <div className="sheet-title">
            <Dialog.Title>Needs changes</Dialog.Title>
          </div>
          {pending ? (
            <div className="uat-note">
              <p className="uat-pre">{String((pending.command.body as { observation?: string }).observation ?? "")}</p>
              <StatusLine sender={sender} />
            </div>
          ) : (
            <>
              <div className="uat-kind" role="radiogroup" aria-label="Kind">
                {(["bug", "change", "comment"] as const).map((value) => (
                  <button key={value} role="radio" aria-checked={kind === value} onClick={() => setKind(value)}>
                    {value === "bug" ? "Bug" : value === "change" ? "Change" : "Comment"}
                  </button>
                ))}
              </div>
              {defaults.scenario_id && (
                <p className="uat-context-line">
                  {defaults.scenario_title} · step {defaults.step}
                  <br />
                  <span className="uat-muted">{defaults.expected}</span>
                </p>
              )}
              <label className="uat-field">
                <span>What happened</span>
                <textarea value={text} maxLength={1000} rows={4} onChange={(event) => setText(event.target.value)} />
              </label>
              <details className="uat-context">
                <summary>Details</summary>
                <label className="uat-field">
                  <span>Actual</span>
                  <textarea value={actual} maxLength={1000} rows={2} onChange={(event) => setActual(event.target.value)} />
                </label>
                <label className="uat-field">
                  <span>Steps</span>
                  <textarea value={details} maxLength={4000} rows={3} onChange={(event) => setDetails(event.target.value)} />
                </label>
                <label className="uat-field">
                  <span>Link</span>
                  <input value={link} maxLength={500} inputMode="url" onChange={(event) => setLink(event.target.value)} />
                </label>
                {kind !== "comment" && (
                  <label className="uat-check">
                    <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />
                    <span>Now</span>
                  </label>
                )}
              </details>
              <StatusLine sender={sender} />
              <div className="uat-sheet-actions">
                <Dialog.Close className="secondary">Cancel</Dialog.Close>
                <button className="primary" disabled={!text.trim() || busy || offline} onClick={() => void submit()}>
                  Submit
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
