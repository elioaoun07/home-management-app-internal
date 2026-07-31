// src/components/pm-live/widgets/ChartTooltip.tsx
// Shared hover layer for the recharts widgets. An HTML chart is interactive by
// default (dataviz interaction rules), so every line/area/bar here ships one.
// Opaque panel, not glass — it floats over the plot (Hard Rule 15).
"use client";

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="pm-panel rounded-lg px-3 py-2.5">
      <p className="text-[12px] mb-1" style={{ color: "var(--pm-fg-3)" }}>
        {title}
      </p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--pm-fg-1)" }}>
          {row.color && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />}
          <span style={{ color: "var(--pm-fg-2)" }}>{row.label}</span>
          <span className="ml-auto tabular-nums font-medium">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

export const AXIS_TICK = { fontSize: 12, fill: "rgba(255,255,255,0.42)" } as const;
