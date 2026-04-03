"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type Transaction = {
  amount: number;
  account_name?: string;
  account_id: string;
};

type Props = {
  transactions: Transaction[];
  onAccountClick?: (accountName: string) => void;
  activeAccounts?: string[];
};

export default function AccountBreakdownWidget({
  transactions,
  onAccountClick,
  activeAccounts = [],
}: Props) {
  const accounts = useMemo(() => {
    const byAccount: Record<string, { total: number; txCount: number }> = {};
    for (const t of transactions) {
      const name = t.account_name ?? "Unknown";
      if (!byAccount[name]) byAccount[name] = { total: 0, txCount: 0 };
      byAccount[name].total += t.amount;
      byAccount[name].txCount++;
    }

    const grandTotal = Object.values(byAccount).reduce(
      (s, a) => s + a.total,
      0,
    );

    return Object.entries(byAccount)
      .map(([name, data]) => ({
        name,
        total: data.total,
        txCount: data.txCount,
        pct: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const COLORS = [
    "#22d3ee",
    "#a78bfa",
    "#34d399",
    "#f472b6",
    "#fbbf24",
    "#60a5fa",
    "#fb923c",
  ];

  if (accounts.length === 0) {
    return (
      <WidgetCard title="Account Breakdown">
        <p className="text-white/40 text-xs text-center py-8">No data</p>
      </WidgetCard>
    );
  }

  const maxTotal = accounts[0]?.total ?? 0;

  return (
    <WidgetCard
      interactive
      title="Account Breakdown"
      subtitle={`${accounts.length} accounts`}
      filterActive={activeAccounts.length > 0}
    >
      <div className="space-y-2">
        {accounts.map((acc, i) => {
          const isActive =
            activeAccounts.length === 0 || activeAccounts.includes(acc.name);
          const color = COLORS[i % COLORS.length];

          return (
            <button
              key={acc.name}
              onClick={() => onAccountClick?.(acc.name)}
              className={cn(
                "w-full text-left transition-opacity",
                !isActive && "opacity-25",
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-white/70 truncate max-w-[160px]">
                  {acc.name}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-white/30">
                    {acc.txCount} txns
                  </span>
                  <span className="text-xs text-white font-medium tabular-nums">
                    $
                    {acc.total.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${maxTotal > 0 ? (acc.total / maxTotal) * 100 : 0}%`,
                    backgroundColor: color,
                    opacity: 0.6,
                  }}
                />
              </div>
              <div className="text-right mt-0.5">
                <span className="text-[10px] text-white/30">
                  {acc.pct.toFixed(1)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
