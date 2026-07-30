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
import type { SendCommand } from "@/features/pm-live/types";
import { SegmentedPanes, type PaneSpec } from "./SegmentedPanes";
import { ArtifactsPane, ConversationPane, CostPane, QuestionsPane } from "./panes";

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
          <ArrowLeft size={14} /> Back to fleet
        </button>
        <p className="text-[13px]" style={{ color: "var(--pm-fg-3)" }}>
          {row
            ? "This session hasn't been published in detail yet — the laptop publishes it on its next tick."
            : "No snapshot for this session. It may have been pruned (finished sessions drop off after 7 days)."}
        </p>
      </div>
    );
  }

  const stateStyle = STATE_STYLE[session.state] || { color: "var(--pm-fg-2)", background: "var(--pm-surface-strong)" };
  const openQuestions = (session.qa?.open?.length ?? 0) + (session.awaiting?.gate === "question" ? session.awaiting.questions?.length ?? 0 : 0);

  const panes: PaneSpec<SessionPane>[] = [
    {
      key: "questions",
      label: "Questions",
      icon: <HelpCircle size={14} />,
      badge: openQuestions || null,
      content: <QuestionsPane session={session} sendCommand={sendCommand} canSend={bridgeLive} />,
    },
    {
      key: "conversation",
      label: "Conversation",
      icon: <MessageSquare size={14} />,
      badge: session.turnsTotal || null,
      content: <ConversationPane session={session} />,
    },
    {
      key: "artifacts",
      label: "Artifacts",
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
      <header className="px-3 lg:px-5 pt-3 pb-2.5 border-b" style={{ borderColor: "var(--pm-border)" }}>
        <button onClick={() => setSession(null)} className="flex items-center gap-1.5 text-[12px] mb-2" style={{ color: "var(--pm-fg-3)" }}>
          <ArrowLeft size={14} /> Fleet
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded" style={stateStyle}>
            {session.state}
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: session.runner.alive ? "var(--pm-accent)" : "var(--pm-border-strong)" }}
            title={session.runner.alive ? "runner alive" : "runner not running"}
          />
          {session.item.id && (
            <span className="text-[11px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
              {session.item.id}
            </span>
          )}
          <span className="text-[11px]" style={{ color: "var(--pm-fg-3)" }}>
            {session.agent}
            {session.lane ? ` · ${session.lane}` : ""}
          </span>
        </div>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--pm-fg-1)" }}>
          {session.item.text}
        </p>
        {!bridgeLive && (
          <p className="text-[11.5px] mt-1.5" style={{ color: "var(--pm-warn)" }}>
            Offline snapshot from {new Date(session.updatedAt).toLocaleString()} — start `pnpm pm --bridge` to answer.
          </p>
        )}
        {session.truncated?.length ? (
          <p className="text-[11.5px] mt-1" style={{ color: "var(--pm-fg-3)" }}>
            Trimmed to fit: {session.truncated.join(", ")}. Full detail is on the laptop.
          </p>
        ) : null}
      </header>

      <SegmentedPanes panes={panes} active={pane} onChange={setPane} />
    </div>
  );
}
