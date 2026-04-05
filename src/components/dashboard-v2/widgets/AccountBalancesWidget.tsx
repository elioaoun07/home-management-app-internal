"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import { Banknote, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { useMemo } from "react";

type AccountBalance = {
  id: string;
  name: string;
  type: string;
  userId: string;
  currentBalance: number;
};

type Props = {
  accounts: AccountBalance[] | undefined;
  activeAccounts?: string[];
  onAccountClick?: (accountName: string) => void;
};

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Wallet; color: string; bg: string }
> = {
  expense: {
    label: "Expense",
    icon: Banknote,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  income: {
    label: "Income",
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  saving: {
    label: "Savings",
    icon: PiggyBank,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
};

export default function AccountBalancesWidget({
  accounts,
  activeAccounts = [],
  onAccountClick,
}: Props) {
  const grouped = useMemo(() => {
    if (!accounts) return {};
    const groups: Record<string, AccountBalance[]> = {};
    for (const acc of accounts) {
      const type = acc.type || "expense";
      if (!groups[type]) groups[type] = [];
      groups[type].push(acc);
    }
    return groups;
  }, [accounts]);

  const totalNetWorth = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  }, [accounts]);

  if (!accounts || accounts.length === 0) return null;

  return (
    <WidgetCard
      title="Account Balances"
      subtitle={`Net worth: $${totalNetWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      interactive
    >
      <div className="space-y-4">
        {(["income", "saving", "expense"] as const).map((type) => {
          const accs = grouped[type];
          if (!accs || accs.length === 0) return null;
          const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.expense;
          const Icon = config.icon;
          const groupTotal = accs.reduce((s, a) => s + a.currentBalance, 0);

          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1 rounded-md", config.bg)}>
                  <Icon className={cn("w-3 h-3", config.color)} />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    config.color,
                  )}
                >
                  {config.label}
                </span>
                <span className="text-[10px] text-white/30 ml-auto tabular-nums">
                  $
                  {groupTotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {accs.map((acc) => {
                  const isActive = activeAccounts.includes(acc.name);
                  return (
                    <button
                      key={acc.id}
                      onClick={() => onAccountClick?.(acc.name)}
                      className={cn(
                        "flex flex-col gap-1 p-3 rounded-lg text-left transition-all",
                        isActive
                          ? "bg-cyan-500/15 ring-1 ring-cyan-500/30"
                          : "bg-white/5 hover:bg-white/8",
                      )}
                    >
                      <span className="text-[11px] text-white/60 truncate w-full">
                        {acc.name}
                      </span>
                      <span className="text-sm font-semibold text-white tabular-nums">
                        $
                        {acc.currentBalance.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
