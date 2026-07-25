// src/components/pm-live/widgets/TrendArea.tsx
// Single-series change-over-time. One series means no legend box — the widget
// title names it (dataviz accessibility pass). One y-axis, always: never a
// second scale on the right.
"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltipBox } from "./ChartTooltip";
import { CHART, axisDate } from "@/features/pm-live/chartTheme";

export interface TrendPoint {
  date: string;
  value: number;
}

export function TrendArea({
  data,
  color = CHART.accent,
  height = 150,
  valueLabel,
  formatValue = (v: number) => String(v),
  gradientId,
}: {
  data: TrendPoint[];
  color?: string;
  height?: number;
  valueLabel: string;
  formatValue?: (value: number) => string;
  gradientId: string;
}) {
  return (
    <div className="pm-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={axisDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: CHART.grid }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltipBox
                  title={axisDate(String(label))}
                  rows={[{ label: valueLabel, value: formatValue(Number(payload[0].value)), color }]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
