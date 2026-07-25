// src/components/pm-live/widgets/SeverityBar.tsx
// Severity mix as ONE stacked horizontal bar plus a labelled legend.
//
// Chosen over a donut deliberately: four ordered categories summing to a whole
// is a part-to-whole comparison a stacked bar reads better than angles, and it
// leaves room to direct-label every segment. Severity is an ordinal status
// scale, so the legend always carries the name and count — colour is never the
// only encoding (dataviz: status colours ship with a label).
//
// 2px surface-coloured gaps separate the segments, per the mark spec.
"use client";

import { SEVERITY_COLOR, SEVERITY_ORDER } from "@/features/pm-live/chartTheme";

export interface SeveritySlice {
  severity: string;
  count: number;
}

export function SeverityBar({ data, onSelect }: { data: SeveritySlice[]; onSelect?: (severity: string) => void }) {
  const ordered = SEVERITY_ORDER.map((severity) => data.find((d) => d.severity === severity) || { severity, count: 0 }).filter(
    (d) => d.count > 0,
  );
  const total = ordered.reduce((sum, d) => sum + d.count, 0);

  if (!total) {
    return (
      <p className="py-4 text-[12.5px]" style={{ color: "var(--pm-fg-3)" }}>
        Nothing open.
      </p>
    );
  }

  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ gap: "2px" }} role="img" aria-label={`Severity mix of ${total} open items`}>
        {ordered.map((d) => (
          <div
            key={d.severity}
            style={{ width: `${(d.count / total) * 100}%`, backgroundColor: SEVERITY_COLOR[d.severity as keyof typeof SEVERITY_COLOR] }}
          />
        ))}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {ordered.map((d) => {
          const label = (
            <>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: SEVERITY_COLOR[d.severity as keyof typeof SEVERITY_COLOR] }}
                aria-hidden
              />
              <span className="capitalize flex-1 truncate" style={{ color: "var(--pm-fg-2)" }}>
                {d.severity}
              </span>
              <span className="tabular-nums" style={{ color: "var(--pm-fg-1)" }}>
                {d.count}
              </span>
            </>
          );
          return (
            <li key={d.severity} className="text-[12px]">
              {onSelect && d.severity !== "unrated" ? (
                <button onClick={() => onSelect(d.severity)} className="w-full flex items-center gap-1.5 text-left">
                  {label}
                </button>
              ) : (
                <span className="flex items-center gap-1.5">{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
