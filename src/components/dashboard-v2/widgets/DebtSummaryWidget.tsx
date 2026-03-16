"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";

type Props = {
  totalOwed: number;
  totalOwedToYou: number;
  openCount: number;
};

export default function DebtSummaryWidget({
  totalOwed,
  totalOwedToYou,
  openCount,
}: Props) {
  if (openCount === 0 && totalOwed === 0 && totalOwedToYou === 0) {
    return (
      <WidgetCard title="Debt Overview">
        <div className="text-center py-6">
          <p className="text-2xl mb-1">✓</p>
          <p className="text-white/50 text-xs">No open debts — great job!</p>
        </div>
      </WidgetCard>
    );
  }

  const netPosition = totalOwedToYou - totalOwed;
  const isPositive = netPosition >= 0;

  return (
    <WidgetCard
      title="Debt Overview"
      subtitle={`${openCount} open debt${openCount !== 1 ? "s" : ""}`}
    >
      <div className="space-y-3">
        {/* Net position */}
        <div className="text-center">
          <p className="text-[10px] text-white/40 mb-0.5">Net Position</p>
          <p
            className={`text-xl font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}
          >
            {isPositive ? "+" : "-"}$
            {Math.abs(Math.round(netPosition)).toLocaleString()}
          </p>
          <p className="text-[10px] text-white/30">
            {isPositive ? "Others owe you more" : "You owe more to others"}
          </p>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-2">
          <div className="neo-card rounded-lg p-2 text-center">
            <p className="text-[10px] text-white/40">You Owe</p>
            <p className="text-sm font-bold text-red-400">
              ${Math.round(totalOwed).toLocaleString()}
            </p>
          </div>
          <div className="neo-card rounded-lg p-2 text-center">
            <p className="text-[10px] text-white/40">Owed to You</p>
            <p className="text-sm font-bold text-emerald-400">
              ${Math.round(totalOwedToYou).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
