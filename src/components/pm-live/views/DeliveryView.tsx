// src/components/pm-live/views/DeliveryView.tsx
// Fleet control. Every guard from the original relay is preserved verbatim:
// gate approvals (spec/plan/uat/blocked), set-budget, rotate and fork are NOT
// reachable from here and are refused by the bridge regardless — the phone may
// only pause, resume, cancel, answer an open question, or send guidance.
// See the Delivery Master Book's mobile command-tiers amendment (2026-07-25).
//
// Tapping a card opens the session detail (Questions / Conversation / Artifacts
// / Cost). A question gate answer stays one tap away — its composer is inline,
// never behind a sheet. Everything else that isn't the one contextual primary
// action (Pause, or Resume when the runner died) — Stop turn, Guidance,
// Cancel — moves into a "More" sheet: five wrapped buttons on every card was
// the densest single spot on the old phone layout.
"use client";

import { useState } from "react";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { Sheet } from "../Sheet";
import { formatUsd } from "@/features/pm-live/chartTheme";
import { TERMINAL_STATES, useActiveSessions, useRecentSessions } from "@/features/pm-live/selectors";
import { useFleet, useSessions } from "@/features/pm-live/store";
import { useViewState } from "@/features/pm-live/viewState";
import type { CommandType, FleetSessionRow, SendCommand, SessionSnapshot } from "@/features/pm-live/types";

const STATE_STYLE: Record<string, { color: string; background: string }> = {
  BLOCKED: { color: "var(--pm-warn)", background: "var(--pm-warn-soft)" },
  CANCELLED: { color: "var(--pm-fg-3)", background: "var(--pm-surface)" },
  SHIPPED: { color: "var(--pm-accent)", background: "var(--pm-accent-soft)" },
};

function gateNote(gate: string | null | undefined) {
  if (gate === "spec" || gate === "plan" || gate === "uat") return "Approve on laptop →";
  if (gate === "budget") return "Raise envelope on laptop →";
  if (gate === "blocked") return "Retry from laptop →";
  return null;
}

function MoreActionsSheet({
  onClose,
  busy,
  act,
}: {
  onClose: () => void;
  busy: boolean;
  act: (type: CommandType, payload?: Record<string, unknown>) => Promise<boolean>;
}) {
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState("");

  return (
    <Sheet title="More actions" onClose={onClose}>
      <div className="space-y-2.5">
        <button
          disabled={busy}
          onClick={async () => {
            if (await act("abort-turn")) onClose();
          }}
          className="pm-btn w-full justify-start"
        >
          Stop turn — discards the in-flight work
        </button>

        {!askOpen ? (
          <button disabled={busy} onClick={() => setAskOpen(true)} className="pm-btn w-full justify-start">
            Send guidance
          </button>
        ) : (
          <div className="pm-card p-3 space-y-2">
            <textarea
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              placeholder="Context, a constraint, a correction…"
              rows={3}
              className="pm-input resize-none"
              autoFocus
            />
            <p className="text-[12px]" style={{ color: "var(--pm-fg-3)" }}>
              Guidance, not gate approval.
            </p>
            <button
              disabled={busy || !askText.trim()}
              onClick={async () => {
                if (await act("ask", { text: askText })) onClose();
              }}
              data-variant="primary"
              className="pm-btn w-full"
            >
              Send
            </button>
          </div>
        )}

        <button
          disabled={busy}
          onClick={async () => {
            if (await act("cancel")) onClose();
          }}
          data-variant="warn"
          className="pm-btn w-full justify-start"
        >
          Cancel session
        </button>
      </div>
    </Sheet>
  );
}

function SessionCard({
  row,
  detail,
  sendCommand,
}: {
  row: FleetSessionRow;
  detail: SessionSnapshot | undefined;
  sendCommand: SendCommand;
}) {
  const openSession = useViewState((s) => s.setSession);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const terminal = TERMINAL_STATES.has(row.state);
  const awaiting = detail?.awaiting ?? row.awaiting;
  const gate = awaiting?.gate;
  const note = gateNote(gate);
  const usage = detail?.usageTotal ?? row.usageTotal;
  const budget = detail?.budgetCurrent;
  const runnerAlive = detail?.runner.alive ?? row.runnerAlive;
  const pct = budget?.maxUsd && usage?.costUsd != null ? Math.min(100, (usage.costUsd / budget.maxUsd) * 100) : null;

  async function act(type: CommandType, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setMsg("");
    const outcome = await sendCommand(type, { sessionId: row.sessionId, ...payload });
    setBusy(false);
    if (!outcome.ok) setMsg(outcome.error || "failed");
    return outcome.ok;
  }

  const stateStyle = STATE_STYLE[row.state] || { color: "var(--pm-fg-2)", background: "var(--pm-surface-strong)" };

  return (
    <div className="pm-card p-3.5" data-live={!terminal || undefined}>
      <button className="w-full flex items-start justify-between gap-2 text-left" onClick={() => openSession(row.sessionId)} aria-label={`Open ${row.item.id || row.sessionId}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded" style={stateStyle}>
              {row.state}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: runnerAlive ? "var(--pm-accent)" : "var(--pm-border-strong)" }}
              title={runnerAlive ? "runner alive" : "runner not running"}
            />
            {row.item.id && (
              <span className="text-[12px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
                {row.item.id}
              </span>
            )}
            <span className="text-[12px]" style={{ color: "var(--pm-fg-3)" }}>
              {row.agent}
            </span>
          </div>
          <p className="text-[14.5px] mt-1 line-clamp-2" style={{ color: "var(--pm-fg-1)" }}>
            {row.item.text}
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1.5">
          {usage && (
            <span className="text-[13px] tabular-nums" style={{ color: "var(--pm-fg-2)" }}>
              {formatUsd(usage.costUsd)}
            </span>
          )}
          <ChevronRight size={15} style={{ color: "var(--pm-fg-3)" }} />
        </span>
      </button>

      {pct != null && (
        <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--pm-surface-strong)" }}>
          <div
            className="h-full"
            style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "var(--pm-warn)" : "var(--pm-accent)" }}
          />
        </div>
      )}

      {note && (
        <p className="mt-2.5 text-[13px] font-medium" style={{ color: "var(--pm-warn)" }}>
          {note}
        </p>
      )}

      {gate === "question" && (
        <div className="mt-2.5 space-y-1.5">
          {(detail?.awaiting?.questions ?? []).map((question, index) => (
            <p
              key={question.id ?? index}
              className="text-[14px] leading-snug rounded-lg px-2.5 py-2"
              style={{ color: "var(--pm-fg-1)", backgroundColor: "var(--pm-surface-strong)" }}
            >
              {question.text}
            </p>
          ))}
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Reply to the agent's question…"
            rows={2}
            className="pm-input resize-none"
          />
          <button
            disabled={busy || !answerText.trim()}
            onClick={async () => {
              if (await act("answer", { text: answerText })) setAnswerText("");
            }}
            data-variant="primary"
            className="pm-btn"
          >
            Send answer
          </button>
        </div>
      )}

      {detail?.lastError?.message && (
        <p className="mt-2.5 text-[12.5px] line-clamp-2" style={{ color: "var(--pm-warn)" }}>
          {detail.lastError.message}
        </p>
      )}
      {msg && (
        <p className="mt-2.5 text-[12.5px]" style={{ color: "var(--pm-warn)" }}>
          {msg}
        </p>
      )}

      {!terminal && (
        <div className="mt-3 flex gap-2">
          {!runnerAlive ? (
            <button disabled={busy} onClick={() => act("resume")} data-variant="primary" className="pm-btn flex-1">
              Resume
            </button>
          ) : (
            <button disabled={busy} onClick={() => act("pause")} data-variant="primary" className="pm-btn flex-1">
              Pause
            </button>
          )}
          <button disabled={busy} onClick={() => setMoreOpen(true)} className="pm-btn px-3.5" aria-label="More actions">
            <MoreHorizontal size={16} />
          </button>
        </div>
      )}

      {moreOpen && <MoreActionsSheet onClose={() => setMoreOpen(false)} busy={busy} act={act} />}
    </div>
  );
}

export function DeliveryView({ sendCommand, onOpenLaunch }: { sendCommand: SendCommand; onOpenLaunch: () => void }) {
  const fleet = useFleet();
  const sessions = useSessions();
  const active = useActiveSessions();
  const recent = useRecentSessions(5);

  if (!fleet) {
    return (
      <div className="p-4 text-[13px]" style={{ color: "var(--pm-fg-3)" }}>
        Waiting for the laptop to publish delivery state…
      </div>
    );
  }

  return (
    <div className="p-4 pb-28 space-y-4">
      <button onClick={onOpenLaunch} disabled={fleet.buildLockActive} data-variant="primary" className="pm-btn w-full">
        <Plus size={16} />
        {fleet.buildLockActive ? "A session is already past the plan gate" : "New delivery session"}
      </button>

      <div className="space-y-2.5">
        {active.map((row) => (
          <SessionCard key={row.sessionId} row={row} detail={sessions[row.sessionId]} sendCommand={sendCommand} />
        ))}
        {!active.length && (
          <p className="text-[13px] px-1" style={{ color: "var(--pm-fg-3)" }}>
            No active sessions.
          </p>
        )}
      </div>

      {!!recent.length && (
        <div>
          <h3 className="text-[12px] font-medium uppercase tracking-wider px-1 mb-1.5" style={{ color: "var(--pm-fg-3)" }}>
            Recent
          </h3>
          <div className="space-y-2.5">
            {recent.map((row) => (
              <SessionCard key={row.sessionId} row={row} detail={sessions[row.sessionId]} sendCommand={sendCommand} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
