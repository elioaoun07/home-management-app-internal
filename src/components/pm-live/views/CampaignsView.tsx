// src/components/pm-live/views/CampaignsView.tsx
// Per-campaign drill-down from the rollups row: how much is open, where it
// sits in the lanes, how it's rated, whether the checklist still lints, and
// how stale the doc is.
"use client";

import { SeverityBar } from "../widgets/SeverityBar";
import { WidgetCard, WidgetEmpty } from "../widgets/WidgetCard";
import { SEVERITY_COLOR } from "@/features/pm-live/chartTheme";
import { useCampaignRollups } from "@/features/pm-live/selectors";
import { useViewState } from "@/features/pm-live/viewState";
import type { CampaignRollup } from "@/features/pm-live/types";

function LaneStrip({ campaign }: { campaign: CampaignRollup }) {
  const { byLane, open } = campaign.checklist;
  const lanes = [
    { key: "Now", value: byLane.Now },
    { key: "Next", value: byLane.Next },
    { key: "Later", value: byLane.Later },
  ];
  return (
    <ul className="flex gap-3">
      {lanes.map((lane) => (
        <li key={lane.key} className="flex-1">
          <span className="block text-[12px] uppercase tracking-wider" style={{ color: "var(--pm-fg-3)" }}>
            {lane.key}
          </span>
          <span className="block text-[19px] font-bold tabular-nums leading-tight" style={{ color: "var(--pm-fg-1)" }}>
            {lane.value}
          </span>
          <span
            className="mt-1 block h-1.5 rounded-full"
            style={{
              backgroundColor: "var(--pm-accent)",
              opacity: open ? 0.25 + 0.75 * (lane.value / Math.max(1, open)) : 0.2,
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignRollup }) {
  const setView = useViewState((s) => s.setView);
  const setQuery = useViewState((s) => s.setQuery);
  const { checklist, pain, lint } = campaign;
  const progress = checklist.total ? Math.round((checklist.done / checklist.total) * 100) : 0;
  const painTotal = pain.blocker + pain.friction + pain.annoyance + pain.parked;

  function openOnBoard(extra = "") {
    setQuery(`m:"${campaign.campaign}"${extra ? ` ${extra}` : ""}`);
    setView("board");
  }

  return (
    <WidgetCard>
      <div className="flex items-start gap-2 mb-3.5">
        <div className="min-w-0 flex-1">
          <button onClick={() => openOnBoard()} className="text-left">
            <h3 className="text-[16px] font-semibold truncate" style={{ color: "var(--pm-fg-1)" }}>
              {campaign.campaign}
            </h3>
          </button>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--pm-fg-3)" }}>
            <span className="font-mono">{campaign.prefix}</span>
            {campaign.updated ? ` · updated ${campaign.updated}` : " · no updated stamp"}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-[26px] font-bold tabular-nums leading-none" style={{ color: "var(--pm-fg-1)" }}>
            {checklist.open}
          </span>
          <span className="block text-[12px] uppercase tracking-wider" style={{ color: "var(--pm-fg-3)" }}>
            open
          </span>
        </span>
      </div>

      <LaneStrip campaign={campaign} />

      <div className="mt-4">
        <SeverityBar
          data={[
            ...(["blocker", "friction", "annoyance", "parked"] as const).map((severity) => ({
              severity,
              count: checklist.bySeverity[severity],
            })),
            { severity: "unrated", count: checklist.bySeverity.none },
          ]}
          onSelect={(severity) => openOnBoard(`s:${severity}`)}
        />
      </div>

      <dl className="mt-4 pt-3.5 border-t grid grid-cols-3 gap-2 text-[12.5px]" style={{ borderColor: "var(--pm-border)" }}>
        <div>
          <dt style={{ color: "var(--pm-fg-3)" }}>Swept</dt>
          <dd className="tabular-nums" style={{ color: "var(--pm-fg-1)" }}>
            {progress}%
            {checklist.done > 0 && (
              <span className="ml-1" style={{ color: "var(--pm-warn)" }} title="Done items still sitting in a lane — lint W1">
                ·{checklist.done} unswept
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--pm-fg-3)" }}>Pain bullets</dt>
          <dd className="tabular-nums" style={{ color: painTotal ? "var(--pm-fg-1)" : "var(--pm-fg-3)" }}>
            {painTotal || "none"}
            {pain.blocker > 0 && (
              <span className="ml-1" style={{ color: SEVERITY_COLOR.blocker }}>
                ·{pain.blocker} 🔴
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--pm-fg-3)" }}>Lint</dt>
          <dd className="tabular-nums" style={{ color: lint.errors ? "var(--pm-warn)" : "var(--pm-fg-1)" }}>
            {lint.errors ? `${lint.errors} err` : "clean"}
            {lint.warnings > 0 && (
              <span className="ml-1" style={{ color: "var(--pm-fg-3)" }}>
                ·{lint.warnings}w
              </span>
            )}
          </dd>
        </div>
      </dl>
    </WidgetCard>
  );
}

export function CampaignsView() {
  const campaigns = useCampaignRollups();

  if (!campaigns.length) {
    return (
      <div className="p-4">
        <WidgetCard title="Campaigns">
          <WidgetEmpty>
            No campaign rollups published yet. Restart the laptop bridge with <span className="font-mono">pnpm pm --bridge</span>.
          </WidgetEmpty>
        </WidgetCard>
      </div>
    );
  }

  return (
    <div className="p-4 pb-28 space-y-3">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.campaign} campaign={campaign} />
      ))}
    </div>
  );
}
