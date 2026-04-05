"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { CalendarClock } from "lucide-react";

export default function FutureTransactionsWidget() {
  return (
    <WidgetCard
      title="Future Transactions"
      subtitle="Manually scheduled upcoming transactions"
    >
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="p-3 rounded-xl bg-white/5">
          <CalendarClock className="w-6 h-6 text-white/20" />
        </div>
        <div>
          <p className="text-xs text-white/40 font-medium">Coming soon</p>
          <p className="text-[10px] text-white/20 mt-1 max-w-[200px]">
            Plan and schedule future one-off transactions to improve spending
            forecasts
          </p>
        </div>
      </div>
    </WidgetCard>
  );
}
