// src/components/pm-live/widgets/BarList.tsx
// Ranked magnitude comparison across many named things (campaigns, sessions).
//
// Deliberately NOT a multi-series chart: there are 11 campaigns, and the
// categorical rule caps a fixed hue order at 8 before folding into "Other".
// One measure per row with a single accent hue sidesteps that entirely and
// stays readable at phone width, where 11 grouped bars would not.
"use client";

import { CHART } from "@/features/pm-live/chartTheme";

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Optional secondary figure rendered to the right of the value. */
  note?: string;
  color?: string;
  onClick?: () => void;
}

export function BarList({ rows, formatValue = (v: number) => String(v) }: { rows: BarRow[]; formatValue?: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (!rows.length) {
    return (
      <p className="py-4 text-[12.5px]" style={{ color: "var(--pm-fg-3)" }}>
        Nothing to show.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const content = (
          <>
            <span className="flex items-baseline gap-2">
              <span className="flex-1 min-w-0 truncate text-[12.5px]" style={{ color: "var(--pm-fg-2)" }}>
                {row.label}
              </span>
              {row.note && (
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--pm-fg-3)" }}>
                  {row.note}
                </span>
              )}
              <span className="text-[12.5px] tabular-nums font-medium shrink-0" style={{ color: "var(--pm-fg-1)" }}>
                {formatValue(row.value)}
              </span>
            </span>
            <span className="mt-1 block h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--pm-surface-strong)" }}>
              <span
                className="block h-full rounded-full"
                style={{ width: `${(row.value / max) * 100}%`, backgroundColor: row.color || CHART.accent }}
              />
            </span>
          </>
        );

        return (
          <li key={row.key}>
            {row.onClick ? (
              <button onClick={row.onClick} className="w-full text-left block">
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
