// src/components/pm-live/views/OverviewView.tsx
// The "what is the state of things right now" view. Answers, in order: what
// needs me, how much is open, how fast is it moving, where does it hurt.
"use client";

import { AlertTriangle, ArrowRight, HelpCircle, Rocket } from "lucide-react";
import { BarList } from "../widgets/BarList";
import { SeverityBar } from "../widgets/SeverityBar";
import { StatTile } from "../widgets/StatTile";
import { TrendArea } from "../widgets/TrendArea";
import { WidgetCard, WidgetEmpty } from "../widgets/WidgetCard";
import { CHART, formatUsd } from "@/features/pm-live/chartTheme";
import {
  useAttentionItems,
  useCampaignRollups,
  useKpis,
  useSeverityMix,
  useVelocitySeries,
  type AttentionItem,
} from "@/features/pm-live/selectors";
import { useViewState } from "@/features/pm-live/viewState";

const ATTENTION_ICON = { gate: Rocket, error: AlertTriangle, blocker: HelpCircle } as const;

function AttentionRow({ item, onOpen }: { item: AttentionItem; onOpen: () => void }) {
  const Icon = ATTENTION_ICON[item.kind];
  return (
    <button onClick={onOpen} className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left">
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: item.kind === "blocker" ? "var(--pm-fg-3)" : "var(--pm-warn)" }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium" style={{ color: "var(--pm-fg-1)" }}>
          {item.label}
        </span>
        <span className="block text-[12px] truncate" style={{ color: "var(--pm-fg-3)" }}>
          {item.detail}
        </span>
      </span>
      <ArrowRight size={13} className="mt-1 shrink-0" style={{ color: "var(--pm-fg-3)" }} />
    </button>
  );
}

export function OverviewView() {
  const kpis = useKpis();
  const attention = useAttentionItems();
  const severityMix = useSeverityMix();
  const velocity = useVelocitySeries(30);
  const campaigns = useCampaignRollups();
  const setView = useViewState((s) => s.setView);
  const setQuery = useViewState((s) => s.setQuery);

  function showOnBoard(query: string) {
    setQuery(query);
    setView("board");
  }

  return (
    <div className="p-3 lg:p-5 pb-24 lg:pb-8 space-y-3 lg:space-y-4 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
        <StatTile label="Open" value={kpis.open} hint={`across ${kpis.campaigns} campaigns`} onClick={() => showOnBoard("")} />
        <StatTile
          label="Blockers"
          value={kpis.blockers}
          tone={kpis.blockers > 0 ? "warn" : "neutral"}
          hint={kpis.blockers > 0 ? "tap to filter" : "none open"}
          onClick={() => showOnBoard("s:blocker")}
        />
        <StatTile
          label="Active"
          value={kpis.activeSessions}
          tone={kpis.activeSessions > 0 ? "accent" : "neutral"}
          hint="delivery sessions"
          onClick={() => setView("delivery")}
        />
        <StatTile label="Fleet spend" value={formatUsd(kpis.totalSpendUsd)} hint="all sessions" onClick={() => setView("usage")} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3 lg:gap-4">
        <WidgetCard
          title="Needs you"
          subtitle={attention.length ? undefined : "Nothing is waiting on a decision"}
          noPadding
          className="lg:row-span-2"
        >
          {attention.length ? (
            <div className="divide-y" style={{ borderColor: "var(--pm-border)" }}>
              {attention.slice(0, 8).map((item, i) => (
                <AttentionRow
                  key={`${item.kind}-${item.sessionId || item.label}-${i}`}
                  item={item}
                  onOpen={() => (item.kind === "blocker" ? showOnBoard("s:blocker") : setView("delivery"))}
                />
              ))}
            </div>
          ) : (
            <WidgetEmpty>No open gates, errors or Now-lane blockers.</WidgetEmpty>
          )}
        </WidgetCard>

        <WidgetCard title="Delivered" subtitle="Cumulative, last 30 days">
          {velocity.length ? (
            <>
              <p className="text-[22px] font-semibold tabular-nums leading-none mb-2" style={{ color: "var(--pm-fg-1)" }}>
                {kpis.shippedLast7}
                <span className="ml-1.5 text-[12px] font-normal" style={{ color: "var(--pm-fg-3)" }}>
                  in the last 7 days
                </span>
              </p>
              <TrendArea
                gradientId="pm-velocity"
                data={velocity.map((d) => ({ date: d.date, value: d.cumulative }))}
                valueLabel="Delivered"
              />
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--pm-fg-3)" }}>
                From ✅ date stamps in each campaign&apos;s Feature State — a floor, not a full record.
              </p>
            </>
          ) : (
            <WidgetEmpty>
              No dated completions yet. Sweep a finished item to <span className="font-mono">1 - Feature State.md</span> with a ✅ stamp.
            </WidgetEmpty>
          )}
        </WidgetCard>

        <WidgetCard title="Severity mix" subtitle={`${kpis.open} open items`}>
          <SeverityBar data={severityMix} onSelect={(severity) => showOnBoard(`s:${severity}`)} />
        </WidgetCard>
      </div>

      <WidgetCard
        title="Campaigns"
        subtitle="Open items, ranked by blockers"
        action={
          <button onClick={() => setView("campaigns")} className="hidden lg:inline-flex text-[11.5px]" style={{ color: "var(--pm-accent)" }}>
            Details →
          </button>
        }
      >
        {campaigns.length ? (
          <BarList
            rows={campaigns.map((c) => ({
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
          <p className="text-[12.5px]" style={{ color: "var(--pm-warn)" }}>
            {kpis.lintErrors} lint error{kpis.lintErrors === 1 ? "" : "s"} across the campaign checklists — run{" "}
            <span className="font-mono">pnpm pm:lint</span> on the laptop.
          </p>
        </WidgetCard>
      )}
    </div>
  );
}
