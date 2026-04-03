"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useMemo } from "react";

type Transaction = {
  id: string;
  amount: number;
  description?: string | null;
  category?: string | null;
  date: string;
  account_name?: string;
};

type Props = {
  transactions: Transaction[];
  onCategoryClick?: (category: string) => void;
  categoryMeans?: Record<string, number>; // avg amount per category for anomaly detection
};

export default function TopExpensesWidget({ transactions, onCategoryClick, categoryMeans }: Props) {
  const top10 = useMemo(() => {
    if (!transactions.length) return [];
    return [...transactions].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [transactions]);

  if (!top10.length) {
    return (
      <WidgetCard title="Top Expenses">
        <p className="text-white/40 text-xs text-center py-8">
          No transactions
        </p>
      </WidgetCard>
    );
  }

  const maxAmount = top10[0].amount;

  return (
    <WidgetCard
      title="Top Expenses"
      subtitle="Biggest transactions this period"
    >
      <div className="space-y-2">
        {top10.map((tx, index) => {
          const mean = tx.category && categoryMeans ? categoryMeans[tx.category] : undefined;
          const isAnomaly = mean !== undefined && mean > 0 && tx.amount > mean * 2.5;
          return (
            <div key={tx.id} className="flex items-center gap-2">
              {/* Rank */}
              <span className="text-[10px] text-white/30 w-4 text-center font-bold tabular-nums">
                {index + 1}
              </span>
              {/* Bar + info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-white/70 truncate max-w-[160px]">
                    {tx.description || tx.category || "Uncategorized"}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isAnomaly && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        unusual
                      </span>
                    )}
                    <span className="text-xs text-white font-medium tabular-nums">
                      ${tx.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(tx.amount / maxAmount) * 100}%`,
                      background: isAnomaly
                        ? `linear-gradient(90deg, rgba(251,191,36,0.7), rgba(251,191,36,0.3))`
                        : `linear-gradient(90deg, rgba(239,68,68,0.6), rgba(239,68,68,0.3))`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {tx.category ? (
                    <button
                      className="text-[10px] text-white/30 hover:text-cyan-400 transition-colors"
                      onClick={() => onCategoryClick?.(tx.category!)}
                    >
                      {tx.category}
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/30">—</span>
                  )}
                  <span className="text-[10px] text-white/20">
                    {new Date(tx.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {tx.account_name && (
                    <span className="text-[10px] text-white/15 truncate">{tx.account_name}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
