// src/components/pm-live/views/OverviewView.tsx
// Home. Answers, in order: what needs me right now, how much is open, what's
// running, where the money's going, how fast is it moving, where does it hurt.
//
// Paced rather than stacked (2026-07-31 phone rebuild): the old version put six
// dense widgets in a row before the fold — 4 tiny stat tiles, an 8-row
// attention list, a 30-day chart, a stacked bar, a 10-row bar list. This cuts
// "Needs you" to the top 3, drops the KPI row from 4 tiles to the 2 that
// matter here (Open/Blockers — Active and Spend get their own sections below),
// and adds a live-sessions strip that didn't exist before.
"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ArrowRight, HelpCircle, RefreshCw, Rocket } from "lucide-react";
import { BarList } from "../widgets/BarList";
import { StatTile } from "../widgets/StatTile";
import { TrendArea } from "../widgets/TrendArea";
import { WidgetCard, WidgetEmpty } from "../widgets/WidgetCard";
import { displayText } from "@/features/pm-live/derive";
import { CHART, formatUsd } from "@/features/pm-live/chartTheme";
import {
  useActiveSessions,
  useAttentionItems,
  useCampaignRollups,
  useKpis,
  useVelocitySeries,
  type AttentionItem,
} from "@/features/pm-live/selectors";
import { usePmLiveStore } from "@/features/pm-live/store";
import { useViewState } from "@/features/pm-live/viewState";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { FleetSessionRow } from "@/features/pm-live/types";

const ATTENTION_ICON = { gate: Rocket, error: AlertTriangle, blocker: HelpCircle } as const;

function AttentionCard({ item, onOpen }: { item: AttentionItem; onOpen: () => void }) {
  const Icon = ATTENTION_ICON[item.kind];
  const detail = item.kind === "blocker" && item.task ? displayText(item.task) : item.detail;
  return (
    <button onClick={onOpen} className="pm-card w-full flex items-start gap-3 px-3.5 py-3 text-left active:scale-[0.98] transition-transform">
      <span
        className="mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: item.kind === "blocker" ? "var(--pm-surface-strong)" : "var(--pm-warn-soft)" }}
      >
        <Icon size={15} style={{ color: item.kind === "blocker" ? "var(--pm-fg-2)" : "var(--pm-warn)" }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium leading-snug" style={{ color: "var(--pm-fg-1)" }}>
          {item.label}
        </span>
        <span className="block mt-0.5 text-[13px] leading-snug line-clamp-2" style={{ color: "var(--pm-fg-3)" }}>
          {detail}
        </span>
      </span>
      <ArrowRight size={15} className="mt-1 shrink-0" style={{ color: "var(--pm-fg-3)" }} />
    </button>
  );
}

function LiveSessionCard({ row }: { row: FleetSessionRow }) {
  const setSession = useViewState((s) => s.setSession);
  const gate = row.awaiting?.gate;
  return (
    <button
      onClick={() => setSession(row.sessionId)}
      data-live="true"
      className="pm-card shrink-0 w-64 snap-start text-left px-3.5 py-3 active:scale-[0.98] transition-transform"
    >
      <span className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.runnerAlive ? "var(--pm-accent)" : "var(--pm-border-strong)" }} />
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--pm-fg-3)" }}>
          {row.state}
        </span>
        {row.item.id && (
          <span className="ml-auto text-[12px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
            {row.item.id}
          </span>
        )}
      </span>
      <span className="block mt-1.5 text-[14px] leading-snug line-clamp-2" style={{ color: "var(--pm-fg-1)" }}>
        {row.item.text}
      </span>
      {gate && (
        <span className="block mt-1.5 text-[12px] font-medium" style={{ color: "var(--pm-warn)" }}>
          {gate === "question" ? "Asked a question →" : `Waiting on ${gate} →`}
        </span>
      )}
      {row.usageTotal?.costUsd != null && (
        <span className="block mt-1.5 text-[12px] tabular-nums" style={{ color: "var(--pm-fg-3)" }}>
          {formatUsd(row.usageTotal.costUsd)} spent
        </span>
      )}
    </button>
  );
}

export function OverviewView() {
  const kpis = useKpis();
  const attention = useAttentionItems();
  const velocity = useVelocitySeries(30);
  const campaigns = useCampaignRollups();
  const active = useActiveSessions();
  const setView = useViewState((s) => s.setView);
  const setQuery = useViewState((s) => s.setQuery);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef({ y: 0, active: false });

  function showOnBoard(query: string) {
    setQuery(query);
    setView("board");
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        const { data: rows } = await supabase.from("pm_live").select("id, kind, payload").eq("user_id", uid);
        if (rows) usePmLiveStore.getState().applyRows(rows);
      }
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const scroller = e.currentTarget;
    touchStartY.current = { active: scroller.scrollTop <= 0, y: e.touches[0].clientY };
  }
  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!touchStartY.current.active) return;
    const delta = e.touches[0].clientY - touchStartY.current.y;
    if (delta > 0) setPullY(Math.min(72, delta * 0.5));
  }
  function onTouchEnd() {
    if (pullY > 44) refresh();
    setPullY(0);
    touchStartY.current.active = false;
  }

  const topAttention = attention.slice(0, 3);
  const statusLine = attention.length
    ? `${active.length ? `${active.length} session${active.length === 1 ? "" : "s"} running · ` : ""}${attention.length} waiting on you`
    : active.length
      ? `${active.length} session${active.length === 1 ? "" : "s"} running · nothing needs you`
      : "Nothing needs you.";

  return (
    <div
      className="p-4 pb-28 space-y-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {(pullY > 0 || refreshing) && (
        <div className="flex justify-center" style={{ height: refreshing ? 32 : pullY }}>
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} style={{ color: "var(--pm-fg-3)" }} />
        </div>
      )}

      <p className="text-[18px] font-semibold leading-snug" style={{ color: "var(--pm-fg-1)" }}>
        {statusLine}
      </p>

      {topAttention.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[12px] font-medium uppercase tracking-wider px-1" style={{ color: "var(--pm-fg-3)" }}>
            Needs you
          </h2>
          {topAttention.map((item, i) => (
            <AttentionCard
              key={`${item.kind}-${item.sessionId || item.label}-${i}`}
              item={item}
              onOpen={() => (item.kind === "blocker" ? showOnBoard("s:blocker") : setView("delivery"))}
            />
          ))}
          {attention.length > 3 && (
            <button
              onClick={() => setView("delivery")}
              className="w-full text-center text-[13px] font-medium py-1.5"
              style={{ color: "var(--pm-accent)" }}
            >
              See all {attention.length} →
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Open" value={kpis.open} hint={`across ${kpis.campaigns} campaigns`} onClick={() => showOnBoard("")} />
        <StatTile
          label="Blockers"
          value={kpis.blockers}
          tone={kpis.blockers > 0 ? "warn" : "neutral"}
          hint={kpis.blockers > 0 ? "tap to filter" : "none open"}
          onClick={() => showOnBoard("s:blocker")}
        />
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[12px] font-medium uppercase tracking-wider px-1" style={{ color: "var(--pm-fg-3)" }}>
            Live delivery
          </h2>
          <div className="-mx-4 px-4 flex gap-2.5 overflow-x-auto pm-scroll-x snap-x snap-mandatory">
            {active.map((row) => (
              <LiveSessionCard key={row.sessionId} row={row} />
            ))}
          </div>
        </div>
      )}

      <button onClick={() => setView("usage")} className="w-full text-left">
        <WidgetCard title="Spend" subtitle="All sessions">
          <div className="flex items-baseline justify-between">
            <span className="text-[22px] font-bold tabular-nums" style={{ color: "var(--pm-fg-1)" }}>
              {formatUsd(kpis.totalSpendUsd)}
            </span>
            <span className="flex items-center gap-1 text-[13px]" style={{ color: "var(--pm-accent)" }}>
              Details <ArrowRight size={13} />
            </span>
          </div>
        </WidgetCard>
      </button>

      <WidgetCard title="Delivered" subtitle="Cumulative, last 30 days">
        {velocity.length ? (
          <>
            <p className="text-[22px] font-bold tabular-nums leading-none mb-2" style={{ color: "var(--pm-fg-1)" }}>
              {kpis.shippedLast7}
              <span className="ml-1.5 text-[13px] font-normal" style={{ color: "var(--pm-fg-3)" }}>
                in the last 7 days
              </span>
            </p>
            <TrendArea
              gradientId="pm-velocity"
              data={velocity.map((d) => ({ date: d.date, value: d.cumulative }))}
              valueLabel="Delivered"
            />
            <p className="mt-2 text-[12px]" style={{ color: "var(--pm-fg-3)" }}>
              From ✅ date stamps — a floor, not a full record.
            </p>
          </>
        ) : (
          <WidgetEmpty>No dated completions yet.</WidgetEmpty>
        )}
      </WidgetCard>

      <WidgetCard
        title="Campaigns"
        subtitle="Open items, ranked by blockers"
        action={
          <button onClick={() => setView("campaigns")} className="text-[13px] font-medium" style={{ color: "var(--pm-accent)" }}>
            All →
          </button>
        }
      >
        {campaigns.length ? (
          <BarList
            rows={campaigns.slice(0, 3).map((c) => ({
              key: c.campaign,
              label: c.campaign,
              value: c.checklist.open,
              note: c.checklist.bySeverity.blocker ? `${c.checklist.bySeverity.blocker} blocked` : undefined,
              color: c.checklist.bySeverity.blocker ? CHART.warn : CHART.accent,
              onClick: () => showOnBoard(`m:"${c.campaign}"`),
            }))}
          />
        ) : (
          <WidgetEmpty>
            Waiting on campaign rollups from the laptop. Restart with <span className="font-mono">pnpm pm --bridge</span>.
          </WidgetEmpty>
        )}
      </WidgetCard>

      {kpis.lintErrors > 0 && (
        <WidgetCard title="Checklist grammar">
          <p className="text-[13px]" style={{ color: "var(--pm-warn)" }}>
            {kpis.lintErrors} lint error{kpis.lintErrors === 1 ? "" : "s"} across the campaign checklists — run{" "}
            <span className="font-mono">pnpm pm:lint</span> on the laptop.
          </p>
        </WidgetCard>
      )}
    </div>
  );
}
