"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  onCategoryClick?: (category: string) => void;
};

function fmtMonth(ym: string): string {
  const [, m] = ym.split("-");
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1];
}

function fmtAmt(n: number): string {
  return `$${Math.abs(Math.round(n)).toLocaleString()}`;
}

export default function TopMoversWidget({ months, onCategoryClick }: Props) {
  const { risers, fallers, prevMonth, currMonth } = useMemo(() => {
    if (!months || months.length < 2) {
      return { risers: [], fallers: [], prevMonth: "", currMonth: "" };
    }

    const curr = months[months.length - 1];
    const prev = months[months.length - 2];

    type Mover = { name: string; currAmt: number; prevAmt: number; delta: number; pct: number };
    const movers: Mover[] = [];

    for (const cat of curr.categoryBreakdown) {
      if (cat.amount < 5) continue;
      const prevCat = prev.categoryBreakdown.find((c) => c.name === cat.name);
      const prevAmt = prevCat?.amount ?? 0;
      const delta = cat.amount - prevAmt;
      const pct = prevAmt > 0 ? (delta / prevAmt) * 100 : delta > 0 ? 100 : 0;
      movers.push({ name: cat.name, currAmt: cat.amount, prevAmt, delta, pct });
    }

    // Also check categories that disappeared (prev had them, curr doesn't)
    for (const cat of prev.categoryBreakdown) {
      if (cat.amount < 5) continue;
      const inCurr = curr.categoryBreakdown.find((c) => c.name === cat.name);
      if (!inCurr) {
        movers.push({ name: cat.name, currAmt: 0, prevAmt: cat.amount, delta: -cat.amount, pct: -100 });
      }
    }

    const risers = movers
      .filter((m) => m.delta > 5)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);

    const fallers = movers
      .filter((m) => m.delta < -5)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5);

    const prevLabel = `${fmtMonth(prev.month)} '${prev.month.slice(2, 4)}`;
    const currLabel = `${fmtMonth(curr.month)} '${curr.month.slice(2, 4)}`;
    return { risers, fallers, prevMonth: prevLabel, currMonth: currLabel };
  }, [months]);

  if (!months || months.length < 2) {
    return (
      <WidgetCard title="Top Movers">
        <p className="text-white/40 text-xs text-center py-8">Need 2+ months of data</p>
      </WidgetCard>
    );
  }

  const maxDelta = Math.max(
    ...risers.map((r) => r.delta),
    ...fallers.map((f) => Math.abs(f.delta)),
    1,
  );

  return (
    <WidgetCard
      title="Top Movers"
      subtitle={`${prevMonth} → ${currMonth}`}
    >
      <div className="grid grid-cols-2 gap-3">
        {/* Risers */}
        <div>
          <p className="text-[9px] text-red-400/60 uppercase tracking-widest mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            Increased
          </p>
          <div className="space-y-2">
            {risers.length === 0 && (
              <p className="text-[10px] text-white/30 text-center py-2">None</p>
            )}
            {risers.map((r) => (
              <button
                key={r.name}
                className="w-full text-left group"
                onClick={() => onCategoryClick?.(r.name)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-white/70 truncate max-w-[80px] group-hover:text-white transition-colors">
                    {r.name}
                  </span>
                  <span className="text-[10px] text-red-400 font-medium shrink-0 ml-1">
                    +{fmtAmt(r.delta)}
                  </span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500/70 to-red-400/40 transition-all duration-700"
                    style={{ width: `${(r.delta / maxDelta) * 100}%` }}
                  />
                </div>
                {r.prevAmt > 0 && (
                  <p className="text-[9px] text-white/25 mt-0.5">
                    {r.pct > 0 ? "+" : ""}{r.pct.toFixed(0)}% · was {fmtAmt(r.prevAmt)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fallers */}
        <div>
          <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            Decreased
          </p>
          <div className="space-y-2">
            {fallers.length === 0 && (
              <p className="text-[10px] text-white/30 text-center py-2">None</p>
            )}
            {fallers.map((f) => (
              <button
                key={f.name}
                className="w-full text-left group"
                onClick={() => onCategoryClick?.(f.name)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-white/70 truncate max-w-[80px] group-hover:text-white transition-colors">
                    {f.name}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium shrink-0 ml-1">
                    -{fmtAmt(Math.abs(f.delta))}
                  </span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-400/40 transition-all duration-700"
                    style={{ width: `${(Math.abs(f.delta) / maxDelta) * 100}%` }}
                  />
                </div>
                {f.prevAmt > 0 && (
                  <p className="text-[9px] text-white/25 mt-0.5">
                    {f.pct.toFixed(0)}% · was {fmtAmt(f.prevAmt)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
