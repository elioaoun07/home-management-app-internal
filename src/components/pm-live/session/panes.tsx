// src/components/pm-live/session/panes.tsx
// The four session-detail panes. Each renders only from the published snapshot,
// so all four work from the offline cache with the laptop closed — the only
// thing that needs the bridge is sending an answer.
"use client";

import { useState } from "react";
import { formatUsd } from "@/features/pm-live/chartTheme";
import { BarList } from "../widgets/BarList";
import { WidgetCard } from "../widgets/WidgetCard";
import type { LedgerQuestion, SendCommand, SessionSnapshot } from "@/features/pm-live/types";

/** Ported from the desktop conversation view so a role reads the same colour on both surfaces. */
const ROLE_COLOR: Record<string, string> = {
  Discovery: "#22d3ee",
  Planner: "#a78bfa",
  Builder: "#fbbf24",
  Reviewer: "#60a5fa",
  "UAT author": "#34d399",
  "Handoff verifier": "#fb7185",
};
const roleColor = (role: string | null) => (role && ROLE_COLOR[role]) || "var(--pm-border-strong)";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-[12.5px]" style={{ color: "var(--pm-fg-3)" }}>
      {children}
    </p>
  );
}

function Composer({
  placeholder,
  disabled,
  onSend,
}: {
  placeholder: string;
  disabled?: boolean;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        className="pm-input resize-none"
      />
      <button
        disabled={disabled || busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          const ok = await onSend(text);
          setBusy(false);
          if (ok) setText("");
        }}
        data-variant="primary"
        className="pm-btn"
      >
        {busy ? "Sending…" : "Send answer"}
      </button>
    </div>
  );
}

function QuestionCard({ question, children }: { question: LedgerQuestion; children?: React.ReactNode }) {
  const blocking = question.kind === "blocking";
  return (
    <div className="pm-card p-3">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span
          className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
          style={blocking
            ? { color: "var(--pm-warn)", backgroundColor: "var(--pm-warn-soft)" }
            : { color: "var(--pm-fg-2)", backgroundColor: "var(--pm-surface-strong)" }}
        >
          {blocking ? "blocking" : question.kind || "question"}
        </span>
        {question.phase && (
          <span className="text-[11px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
            {question.phase}
          </span>
        )}
        {question.source && question.source !== "agent" && (
          <span className="text-[11px]" style={{ color: "var(--pm-fg-3)" }}>
            asked by {question.source}
          </span>
        )}
      </div>
      <p className="text-[13px] leading-snug" style={{ color: "var(--pm-fg-1)" }}>
        {question.text}
      </p>
      {question.answer && (
        <p className="mt-2 pl-2.5 text-[12.5px] leading-snug border-l-2" style={{ color: "var(--pm-fg-2)", borderColor: "var(--pm-accent)" }}>
          {question.answer.text}
        </p>
      )}
      {children}
    </div>
  );
}

export function QuestionsPane({
  session,
  sendCommand,
  canSend,
}: {
  session: SessionSnapshot;
  sendCommand: SendCommand;
  canSend: boolean;
}) {
  const [msg, setMsg] = useState("");
  const gateQuestions = session.awaiting?.gate === "question" ? session.awaiting.questions ?? [] : [];
  const open = session.qa?.open ?? [];
  const answered = session.qa?.answered ?? [];

  async function send(text: string, questionId?: string) {
    setMsg("");
    const outcome = await sendCommand("answer", { sessionId: session.sessionId, text, ...(questionId ? { questionId } : {}) });
    if (!outcome.ok) setMsg(outcome.error || "failed");
    return outcome.ok;
  }

  if (!gateQuestions.length && !open.length && !answered.length) return <Empty>No questions yet.</Empty>;

  return (
    <div className="space-y-3">
      {msg && (
        <p className="text-[12px]" style={{ color: "var(--pm-warn)" }}>
          {msg}
        </p>
      )}

      {gateQuestions.length > 0 && (
        <div className="pm-card p-3" style={{ borderColor: "var(--pm-warn)" }}>
          <p className="text-[10.5px] font-semibold mb-1.5" style={{ color: "var(--pm-warn)" }}>
            THE SESSION IS WAITING ON THIS
          </p>
          {gateQuestions.map((question, index) => (
            <p key={question.id ?? index} className="text-[13px] leading-snug mb-1" style={{ color: "var(--pm-fg-1)" }}>
              {question.text}
            </p>
          ))}
          <Composer placeholder="Answer and let it continue…" disabled={!canSend} onSend={(text) => send(text)} />
        </div>
      )}

      {open.filter((question) => !gateQuestions.some((gate) => gate.id === question.id)).map((question) => (
        <QuestionCard key={question.id} question={question}>
          <Composer placeholder="Answer this one…" disabled={!canSend} onSend={(text) => send(text, question.id)} />
        </QuestionCard>
      ))}

      {answered.length > 0 && (
        <details>
          <summary className="text-[12px] py-1 cursor-pointer" style={{ color: "var(--pm-fg-3)" }}>
            Answered ({answered.length}
            {session.qa?.dismissedCount ? ` · ${session.qa.dismissedCount} dismissed` : ""})
          </summary>
          <div className="space-y-2 mt-2">
            {answered.map((question) => (
              <QuestionCard key={question.id} question={question} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ConversationPane({ session }: { session: SessionSnapshot }) {
  const turns = session.turnsTail ?? [];
  if (!turns.length) return <Empty>No turns recorded yet.</Empty>;

  let lastPhase: string | null = null;
  return (
    <div className="space-y-2">
      {turns.map((turn) => {
        const newPhase = turn.phase !== lastPhase;
        lastPhase = turn.phase;
        return (
          <div key={turn.turnId}>
            {newPhase && turn.phase && (
              <p className="text-[10.5px] font-semibold tracking-wide mt-3 mb-1.5" style={{ color: roleColor(turn.role) }}>
                {turn.phase}
              </p>
            )}
            <div className="pm-card p-2.5 border-l-2" style={{ borderLeftColor: roleColor(turn.role) }}>
              <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: "var(--pm-fg-3)" }}>
                <span className="font-mono">#{turn.turnId}</span>
                {turn.role && <span style={{ color: roleColor(turn.role) }}>{turn.role}</span>}
                {turn.model && <span>{turn.model}</span>}
                {turn.effort && <span>{turn.effort}</span>}
                {turn.durationMs != null && <span className="tabular-nums">{Math.round(turn.durationMs / 1000)}s</span>}
                {turn.costUsd != null && <span className="tabular-nums">{formatUsd(turn.costUsd)}</span>}
                {turn.result && turn.result !== "ok" && <span style={{ color: "var(--pm-warn)" }}>{turn.result}</span>}
              </div>
              {turn.excerpt && (
                <p className="mt-1.5 text-[12.5px] leading-snug whitespace-pre-wrap" style={{ color: "var(--pm-fg-2)" }}>
                  {turn.excerpt}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {(session.turnsTotal ?? turns.length) > turns.length && (
        <p className="pt-2 text-[11.5px]" style={{ color: "var(--pm-fg-3)" }}>
          Showing the last {turns.length} of {session.turnsTotal} turns — the full transcript is on the laptop.
        </p>
      )}
    </div>
  );
}

export function ArtifactsPane({ session }: { session: SessionSnapshot }) {
  const artifacts = session.artifacts ?? [];
  if (!artifacts.length) return <Empty>No artifacts written yet.</Empty>;
  return (
    <div className="space-y-3">
      {artifacts.map((artifact) => (
        <WidgetCard
          key={artifact.key}
          title={artifact.label}
          subtitle={`${(artifact.bytes / 1024).toFixed(1)} KB${artifact.truncated ? " · excerpt" : ""}`}
        >
          {artifact.excerpt ? (
            <div
              className="max-h-64 overflow-y-auto rounded-lg p-2.5 text-[12px] leading-relaxed whitespace-pre-wrap font-mono"
              style={{ backgroundColor: "var(--pm-surface)", color: "var(--pm-fg-2)" }}
            >
              {artifact.excerpt}
            </div>
          ) : (
            <p className="text-[12.5px]" style={{ color: "var(--pm-fg-3)" }}>
              Too large to relay — read it on the laptop.
            </p>
          )}
        </WidgetCard>
      ))}
    </div>
  );
}

export function CostPane({ session }: { session: SessionSnapshot }) {
  const detail = session.costDetail;
  const usage = session.usageTotal;
  const budget = session.budgetCurrent;
  const spent = usage?.costUsd ?? null;
  const pct = budget?.maxUsd && spent != null ? Math.min(100, (spent / budget.maxUsd) * 100) : null;
  const context = detail?.context;

  if (!detail && !usage) return <Empty>No spend recorded yet.</Empty>;

  return (
    <div className="space-y-3">
      <WidgetCard title="Envelope">
        <div className="flex items-baseline justify-between">
          <span className="text-[19px] font-semibold tabular-nums" style={{ color: "var(--pm-fg-1)" }}>
            {formatUsd(spent)}
          </span>
          <span className="text-[12px] tabular-nums" style={{ color: "var(--pm-fg-3)" }}>
            {budget?.maxUsd != null ? `of ${formatUsd(budget.maxUsd)}` : "no cap authorized"}
          </span>
        </div>
        {pct != null && (
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--pm-surface-strong)" }}>
            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "var(--pm-warn)" : "var(--pm-accent)" }} />
          </div>
        )}
      </WidgetCard>

      {detail && detail.byPhase.length > 0 && (
        <WidgetCard title="By phase" subtitle="where the money went">
          <BarList
            rows={detail.byPhase.map((row) => ({ key: row.key, label: row.key, value: row.costUsd, note: `${row.turns} turn${row.turns === 1 ? "" : "s"}` }))}
            formatValue={(value) => formatUsd(value)}
          />
        </WidgetCard>
      )}

      {detail && detail.byModel.length > 0 && (
        <WidgetCard title="By model">
          <BarList
            rows={detail.byModel.map((row) => ({ key: row.key, label: row.key, value: row.costUsd, note: `${row.turns} turn${row.turns === 1 ? "" : "s"}` }))}
            formatValue={(value) => formatUsd(value)}
          />
        </WidgetCard>
      )}

      {context?.pctUsed != null && (
        <WidgetCard title="Context window" subtitle="at the last turn">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--pm-fg-1)" }}>
              {Math.round(context.pctUsed * 100)}%
            </span>
            <span className="text-[12px] tabular-nums" style={{ color: "var(--pm-fg-3)" }}>
              {context.occupancyTokens?.toLocaleString()} / {context.windowTokens?.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--pm-surface-strong)" }}>
            <div
              className="h-full"
              style={{ width: `${Math.min(100, context.pctUsed * 100)}%`, backgroundColor: context.pctUsed > 0.85 ? "var(--pm-warn)" : "var(--pm-accent)" }}
            />
          </div>
        </WidgetCard>
      )}
    </div>
  );
}
