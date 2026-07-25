// src/components/pm-live/views/DeliveryView.tsx
// Fleet control. Every guard from the original relay is preserved verbatim:
// gate approvals (spec/plan/uat/blocked), set-budget, rotate and fork are NOT
// reachable from here and are refused by the bridge regardless — the phone may
// only pause, resume, cancel, answer an open question, or send guidance.
// See "Delivery 10x/6 - Design Debates & Rejected Ideas.md" (2026-07-25).
"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { formatUsd } from "@/features/pm-live/chartTheme";
import { TERMINAL_STATES, useActiveSessions, useRecentSessions } from "@/features/pm-live/selectors";
import { useFleet, useSessions } from "@/features/pm-live/store";
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

function SessionCard({
  row,
  detail,
  sendCommand,
}: {
  row: FleetSessionRow;
  detail: SessionSnapshot | undefined;
  sendCommand: SendCommand;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [askText, setAskText] = useState("");
  const [askOpen, setAskOpen] = useState(false);

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
    <div className="pm-card p-3">
      <button className="w-full flex items-start justify-between gap-2 text-left" onClick={() => setExpanded((e) => !e)}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded" style={stateStyle}>
              {row.state}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: runnerAlive ? "var(--pm-accent)" : "var(--pm-border-strong)" }}
              title={runnerAlive ? "runner alive" : "runner not running"}
            />
            {row.item.id && (
              <span className="text-[11px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
                {row.item.id}
              </span>
            )}
            <span className="text-[11px]" style={{ color: "var(--pm-fg-3)" }}>
              {row.agent}
            </span>
          </div>
          <p className="text-[13.5px] mt-0.5 truncate" style={{ color: "var(--pm-fg-1)" }}>
            {row.item.text}
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1.5">
          {usage && (
            <span className="text-[12px] tabular-nums" style={{ color: "var(--pm-fg-2)" }}>
              {formatUsd(usage.costUsd)}
            </span>
          )}
          <ChevronDown
            size={14}
            style={{ color: "var(--pm-fg-3)", transform: expanded ? "rotate(180deg)" : undefined }}
          />
        </span>
      </button>

      {pct != null && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--pm-surface-strong)" }}>
          <div
            className="h-full"
            style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "var(--pm-warn)" : "var(--pm-accent)" }}
          />
        </div>
      )}

      {note && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--pm-warn)" }}>
          {note}
        </p>
      )}

      {gate === "question" && (
        <div className="mt-2 space-y-1.5">
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
        <p className="mt-2 text-[12px] line-clamp-2" style={{ color: "var(--pm-warn)" }}>
          {detail.lastError.message}
        </p>
      )}
      {msg && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--pm-warn)" }}>
          {msg}
        </p>
      )}

      {!terminal && (
        <>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button disabled={busy} onClick={() => act("pause", {})} className="pm-btn">
              Pause
            </button>
            {/* abort-turn = pause with abortInFlight. Separated from Pause because
                it discards the turn's in-flight work, which Pause never does. */}
            <button disabled={busy} onClick={() => act("abort-turn", {})} className="pm-btn">
              Stop turn
            </button>
            {!runnerAlive && (
              <button disabled={busy} onClick={() => act("resume", {})} className="pm-btn">
                Resume
              </button>
            )}
            <button disabled={busy} onClick={() => setAskOpen((v) => !v)} className="pm-btn">
              Guidance
            </button>
            <button disabled={busy} onClick={() => act("cancel", {})} data-variant="warn" className="pm-btn">
              Cancel
            </button>
          </div>

          {askOpen && (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                placeholder="Guidance for the agent — context, a constraint, a correction…"
                rows={2}
                className="pm-input resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  disabled={busy || !askText.trim()}
                  onClick={async () => {
                    if (await act("ask", { text: askText })) {
                      setAskText("");
                      setAskOpen(false);
                    }
                  }}
                  data-variant="primary"
                  className="pm-btn"
                >
                  Send
                </button>
                <p className="text-[11px]" style={{ color: "var(--pm-fg-3)" }}>
                  Guidance, not gate approval.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-1 max-h-56 overflow-y-auto" style={{ borderColor: "var(--pm-border)" }}>
          {detail?.eventsTail?.length ? (
            [...detail.eventsTail].reverse().map((evt) => (
              <p key={evt.seq} className="text-[11px] font-mono truncate" style={{ color: "var(--pm-fg-3)" }}>
                <span className="tabular-nums">{evt.seq}</span> {evt.type}
                {evt.phase ? ` · ${evt.phase}` : ""}
              </p>
            ))
          ) : (
            <p className="text-[11.5px]" style={{ color: "var(--pm-fg-3)" }}>
              No events published for this session yet.
            </p>
          )}
        </div>
      )}
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
    <div className="p-3 lg:p-5 pb-24 lg:pb-8 space-y-4 max-w-[900px] mx-auto">
      <button onClick={onOpenLaunch} disabled={fleet.buildLockActive} data-variant="primary" className="pm-btn w-full">
        <Plus size={15} />
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
          <h3 className="text-[11px] font-medium uppercase tracking-wider px-1 mb-1.5" style={{ color: "var(--pm-fg-3)" }}>
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
