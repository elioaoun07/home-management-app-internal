// src/components/pm-live/session/SessionDetailView.tsx
// One session, in full: what it is asking, what it has been doing, what it has
// written, and what it has spent.
//
// Everything renders from the published `session:<id>` row, which the store
// caches to localStorage — so the whole view still reads with the laptop shut.
// Only sending an answer needs a live bridge, and that is disabled rather than
// hidden, so the reason is visible.
"use client";

import { ArrowLeft, Coins, FileText, HelpCircle, MessageSquare } from "lucide-react";
import { formatUsd } from "@/features/pm-live/chartTheme";
import { useBridgeLive, useFleet, useSessions } from "@/features/pm-live/store";
import { useViewState, type SessionPane } from "@/features/pm-live/viewState";
import type { SendCommand, SessionSnapshot } from "@/features/pm-live/types";
import { SegmentedPanes, type PaneSpec } from "./SegmentedPanes";
import { ArtifactsPane, ConversationPane, CostPane, QuestionsPane } from "./panes";
import { useState } from "react";

/**
 * DLV-73 — the INSTANT lane's gate actions, on the phone.
 *
 * Mobile gate approval is deliberately INSTANT-only. The laptop-only rule exists
 * because approving work you cannot actually read is not oversight, and on every
 * other lane a phone screen genuinely cannot show you enough. INSTANT is the one
 * lane whose launch precondition guarantees the opposite: one located file, and a
 * diff bounded by `instantMaxDiffLines`. The bridge re-verifies the lane and the
 * gate server-side (`requireInstantGate`), so this component is a convenience,
 * never the control.
 *
 * The spec button approves spec AND plan together, because on INSTANT they are
 * one artifact from one turn — approving only the spec would park the phone at a
 * second gate showing what it just approved.
 */
function InstantGateBar({
  session,
  sendCommand,
  canSend,
}: {
  session: SessionSnapshot;
  sendCommand: SendCommand;
  canSend: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gate = session.awaiting?.gate;
  if (session.lane !== "INSTANT" || (gate !== "spec" && gate !== "uat")) return null;

  const run = async (type: "approve" | "accept") => {
    setBusy(true);
    setError(null);
    const outcome = await sendCommand(type, { sessionId: session.sessionId });
    if (!outcome.ok) setError(outcome.error || "failed");
    setBusy(false);
  };

  return (
    <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--pm-border)", backgroundColor: "var(--pm-surface)" }}>
      <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--pm-fg-2)" }}>
        {gate === "spec" ? "WAITING ON YOU — SPEC + PLAN" : "WAITING ON YOU — ACCEPT THE CHANGE"}
      </p>
      <button
        className="pm-btn w-full justify-center"
        disabled={!canSend || busy}
        onClick={() => run(gate === "spec" ? "approve" : "accept")}
      >
        {busy ? "Sending…" : gate === "spec" ? "Approve spec + plan" : "Accept"}
      </button>
      {gate === "spec" && (
        <p className="text-[12px] mt-1.5" style={{ color: "var(--pm-fg-3)" }}>
          Records both gate decisions. Request changes on the laptop.
        </p>
      )}
      {error && (
        <p className="text-[12.5px] mt-1.5" style={{ color: "var(--pm-warn)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

const STATE_STYLE: Record<string, { color: string; background: string }> = {
  BLOCKED: { color: "var(--pm-warn)", background: "var(--pm-warn-soft)" },
  CANCELLED: { color: "var(--pm-fg-3)", background: "var(--pm-surface)" },
  SHIPPED: { color: "var(--pm-accent)", background: "var(--pm-accent-soft)" },
};

export function SessionDetailView({ sessionId, sendCommand }: { sessionId: string; sendCommand: SendCommand }) {
  const sessions = useSessions();
  const fleet = useFleet();
  const bridgeLive = useBridgeLive();
  const setSession = useViewState((s) => s.setSession);
  const pane = useViewState((s) => s.pane);
  const setPane = useViewState((s) => s.setPane);

  const session = sessions[sessionId];
  const row = fleet?.sessions.find((entry) => entry.sessionId === sessionId);

  if (!session) {
    return (
      <div className="p-4 space-y-3">
        <button onClick={() => setSession(null)} className="pm-btn">
          <ArrowLeft size={15} /> Back to fleet
        </button>
        <p className="text-[13.5px]" style={{ color: "var(--pm-fg-3)" }}>
          {row
            ? "This session hasn't been published in detail yet — the laptop publishes it on its next tick."
            : "No snapshot for this session. It may have been pruned (finished sessions drop off after 7 days)."}
        </p>
      </div>
    );
  }

  const stateStyle = STATE_STYLE[session.state] || { color: "var(--pm-fg-2)", background: "var(--pm-surface-strong)" };
  const openQuestions = (session.qa?.open?.length ?? 0) + (session.awaiting?.gate === "question" ? session.awaiting.questions?.length ?? 0 : 0);

  // Short tab labels so all four fit with a visible label at 360px — the pane
  // content headings still say "Questions" / "Conversation" in full.
  const panes: PaneSpec<SessionPane>[] = [
    {
      key: "questions",
      label: "Q&A",
      icon: <HelpCircle size={14} />,
      badge: openQuestions || null,
      content: <QuestionsPane session={session} sendCommand={sendCommand} canSend={bridgeLive} />,
    },
    {
      key: "conversation",
      label: "Chat",
      icon: <MessageSquare size={14} />,
      badge: session.turnsTotal || null,
      content: <ConversationPane session={session} />,
    },
    {
      key: "artifacts",
      label: "Files",
      icon: <FileText size={14} />,
      badge: session.artifacts?.length || null,
      content: <ArtifactsPane session={session} />,
    },
    {
      key: "cost",
      label: "Cost",
      icon: <Coins size={14} />,
      badge: session.usageTotal?.costUsd != null ? formatUsd(session.usageTotal.costUsd) : null,
      content: <CostPane session={session} />,
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 pt-3 pb-2.5 border-b" style={{ borderColor: "var(--pm-border)" }}>
        <button onClick={() => setSession(null)} className="flex items-center gap-1.5 text-[13px] mb-2" style={{ color: "var(--pm-fg-3)" }}>
          <ArrowLeft size={15} /> Fleet
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded" style={stateStyle}>
            {session.state}
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: session.runner.alive ? "var(--pm-accent)" : "var(--pm-border-strong)" }}
            title={session.runner.alive ? "runner alive" : "runner not running"}
          />
          {session.item.id && (
            <span className="text-[12px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
              {session.item.id}
            </span>
          )}
          <span className="text-[12px]" style={{ color: "var(--pm-fg-3)" }}>
            {session.agent}
            {session.lane ? ` · ${session.lane}` : ""}
          </span>
        </div>
        <p className="text-[15px] mt-1.5 leading-snug" style={{ color: "var(--pm-fg-1)" }}>
          {session.item.text}
        </p>
        {!bridgeLive && (
          <p className="text-[12.5px] mt-1.5" style={{ color: "var(--pm-warn)" }}>
            Offline snapshot from {new Date(session.updatedAt).toLocaleString()} — start `pnpm pm --bridge` to answer.
          </p>
        )}
        {session.truncated?.length ? (
          <p
            className="inline-flex items-start gap-1.5 mt-2 text-[12px] rounded-lg px-2.5 py-1.5"
            style={{ color: "var(--pm-warn)", backgroundColor: "var(--pm-warn-soft)" }}
          >
            Trimmed to fit: {session.truncated.join(", ")}. Full detail is on the laptop.
          </p>
        ) : null}
      </header>

      <InstantGateBar session={session} sendCommand={sendCommand} canSend={bridgeLive} />
      <SegmentedPanes panes={panes} active={pane} onChange={setPane} />
    </div>
  );
}
