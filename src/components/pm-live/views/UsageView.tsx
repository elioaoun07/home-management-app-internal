// src/components/pm-live/views/UsageView.tsx
// Where the money went. Spend over time, spend per session, token mix, and how
// close each live session is to its envelope.
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarList } from "../widgets/BarList";
import { AXIS_TICK, ChartTooltipBox } from "../widgets/ChartTooltip";
import { StatTile } from "../widgets/StatTile";
import { WidgetCard, WidgetEmpty } from "../widgets/WidgetCard";
import { CHART, axisDate, formatTokens, formatUsd } from "@/features/pm-live/chartTheme";
import { TERMINAL_STATES, useTokenTotals } from "@/features/pm-live/selectors";
import { useFleet, useSessions } from "@/features/pm-live/store";

export function UsageView() {
  const fleet = useFleet();
  const sessions = useSessions();
  const tokens = useTokenTotals();

  if (!fleet) {
    return (
      <div className="p-4 text-[13px]" style={{ color: "var(--pm-fg-3)" }}>
        Waiting for the laptop to publish usage data…
      </div>
    );
  }

  const spendByDay = fleet.spendByDay || [];
  const totalTokens = tokens.input + tokens.cachedInput + tokens.output;

  // Envelope burn only means something while a session can still spend.
  const burning = fleet.sessions
    .filter((row) => !TERMINAL_STATES.has(row.state))
    .map((row) => {
      const detail = sessions[row.sessionId];
      const usage = detail?.usageTotal ?? row.usageTotal;
      const maxUsd = detail?.budgetCurrent?.maxUsd ?? null;
      return { row, spent: usage?.costUsd ?? 0, maxUsd };
    })
    .filter((entry) => entry.maxUsd != null);

  return (
    <div className="p-4 pb-28 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Fleet spend" value={formatUsd(fleet.totalSpendUsd)} hint={`${fleet.sessions.length} sessions`} />
        <StatTile label="Tokens" value={formatTokens(totalTokens)} hint="in + cached + out" />
        <StatTile
          label="Cache rate"
          value={totalTokens ? `${Math.round((tokens.cachedInput / totalTokens) * 100)}%` : "—"}
          hint="of all tokens"
        />
        <StatTile
          label="Avg / session"
          value={fleet.sessions.length ? formatUsd(fleet.totalSpendUsd / fleet.sessions.length) : "—"}
        />
      </div>

      <div className="space-y-3">
        <WidgetCard title="Spend by day" subtitle="Bucketed by each session's last update">
          {spendByDay.length ? (
            <div className="pm-chart" style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendByDay} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={axisDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <ChartTooltipBox
                          title={axisDate(String(label))}
                          rows={[
                            { label: "Spend", value: formatUsd(Number(payload[0].value)), color: CHART.accent },
                            { label: "Sessions", value: String(payload[0].payload.sessions) },
                          ]}
                        />
                      ) : null
                    }
                  />
                  {/* 4px rounded data-end, anchored to the baseline. */}
                  <Bar dataKey="costUsd" fill={CHART.accent} radius={[4, 4, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <WidgetEmpty>
              No daily spend yet — restart the laptop bridge to publish it (<span className="font-mono">pnpm pm --bridge</span>).
            </WidgetEmpty>
          )}
        </WidgetCard>

        <WidgetCard title="Cost per session" subtitle="Most expensive first">
          <BarList
            formatValue={formatUsd}
            rows={[...fleet.sessions]
              .map((row) => {
                const usage = sessions[row.sessionId]?.usageTotal ?? row.usageTotal;
                return { row, cost: usage?.costUsd ?? 0, usage };
              })
              .sort((a, b) => b.cost - a.cost)
              .slice(0, 8)
              .map(({ row, cost, usage }) => ({
                key: row.sessionId,
                label: row.item.id ? `${row.item.id} · ${row.item.text}` : row.item.text,
                value: cost,
                note: usage ? formatTokens(usage.input + usage.cachedInput + usage.output) : undefined,
                color: TERMINAL_STATES.has(row.state) ? CHART.muted : CHART.accent,
              }))}
          />
        </WidgetCard>

        <WidgetCard title="Token mix" subtitle="Across every session">
          {totalTokens ? (
            <>
              <div className="flex h-2.5 rounded-full overflow-hidden" style={{ gap: "2px" }}>
                {(
                  [
                    ["Cached in", tokens.cachedInput, CHART.muted],
                    ["Input", tokens.input, CHART.accent],
                    ["Output", tokens.output, CHART.warn],
                  ] as const
                ).map(([label, value, color]) => (
                  <div key={label} style={{ width: `${(value / totalTokens) * 100}%`, backgroundColor: color }} />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
                {(
                  [
                    ["Cached in", tokens.cachedInput, CHART.muted],
                    ["Input", tokens.input, CHART.accent],
                    ["Output", tokens.output, CHART.warn],
                  ] as const
                ).map(([label, value, color]) => (
                  <li key={label} className="flex items-center gap-1.5 text-[12px]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                    <span className="flex-1" style={{ color: "var(--pm-fg-2)" }}>
                      {label}
                    </span>
                    <span className="tabular-nums" style={{ color: "var(--pm-fg-1)" }}>
                      {formatTokens(value)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <WidgetEmpty>No token usage recorded.</WidgetEmpty>
          )}
        </WidgetCard>

        <WidgetCard title="Envelope burn" subtitle="Active sessions against their cap">
          {burning.length ? (
            <ul className="space-y-3">
              {burning.map(({ row, spent, maxUsd }) => {
                const pct = Math.min(100, (spent / (maxUsd as number)) * 100);
                const over = pct >= 100;
                return (
                  <li key={row.sessionId}>
                    <div className="flex items-baseline gap-2 text-[12.5px]">
                      <span className="flex-1 min-w-0 truncate" style={{ color: "var(--pm-fg-2)" }}>
                        {row.item.id || row.sessionId}
                      </span>
                      <span className="tabular-nums" style={{ color: over ? "var(--pm-warn)" : "var(--pm-fg-1)" }}>
                        {formatUsd(spent)} / {formatUsd(maxUsd as number)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--pm-surface-strong)" }}>
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: over ? CHART.warn : CHART.accent }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <WidgetEmpty>No active session has a dollar cap set.</WidgetEmpty>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
