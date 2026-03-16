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
};

export default function TopExpensesWidget({ transactions }: Props) {
  const top5 = useMemo(() => {
    if (!transactions.length) return [];
    return [...transactions].sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [transactions]);

  if (!top5.length) {
    return (
      <WidgetCard title="Top Expenses">
        <p className="text-white/40 text-xs text-center py-8">
          No transactions
        </p>
      </WidgetCard>
    );
  }

  const maxAmount = top5[0].amount;

  return (
    <WidgetCard
      title="Top Expenses"
      subtitle="Biggest transactions this period"
    >
      <div className="space-y-2">
        {top5.map((tx, index) => (
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
                <span className="text-xs text-white font-medium tabular-nums shrink-0 ml-2">
                  ${tx.amount.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(tx.amount / maxAmount) * 100}%`,
                    background: `linear-gradient(90deg, rgba(239,68,68,0.6), rgba(239,68,68,0.3))`,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-white/30">
                  {tx.category || "—"}
                </span>
                <span className="text-[10px] text-white/20">
                  {new Date(tx.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
