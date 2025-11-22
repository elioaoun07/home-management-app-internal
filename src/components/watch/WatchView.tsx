"use client";

import VoiceEntryButton from "@/components/expense/VoiceEntryButton";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/hooks";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface Balance {
  account_id: string;
  balance: number;
  pending_drafts?: number;
  draft_count?: number;
}

export default function WatchView() {
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const [previewText, setPreviewText] = useState("");

  // Get default account or first account
  const defaultAccount = useMemo(() => {
    const defAcc = accounts.find((a: any) => a.is_default);
    return defAcc || accounts[0];
  }, [accounts]);

  // Fetch balance for default account
  const { data: balance } = useQuery<Balance>({
    queryKey: ["account-balance", defaultAccount?.id],
    queryFn: async () => {
      if (!defaultAccount?.id) return null;
      const res = await fetch(`/api/accounts/${defaultAccount.id}/balance`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch balance");
      return res.json();
    },
    enabled: !!defaultAccount?.id,
    refetchInterval: 5000, // Refresh every 5 seconds for watch
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1d2e] to-[#1a2942] flex flex-col items-center justify-center p-4">
      {/* Watch-optimized layout - centered and large */}
      <div className="w-full max-w-sm space-y-8">
        {/* Balance Display */}
        <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#06b6d4]/30 p-6 text-center shadow-2xl">
          <div className="text-sm text-[#06b6d4] font-medium uppercase tracking-wider mb-2">
            {defaultAccount?.name || "Wallet"}
          </div>
          <div className="text-5xl font-bold tabular-nums text-white mb-2">
            ${balance?.balance?.toFixed(2) || "0.00"}
          </div>
          {balance?.pending_drafts ? (
            <div className="text-sm text-orange-400/80">
              {balance.draft_count} draft{balance.draft_count !== 1 ? "s" : ""}{" "}
              ( ${balance.pending_drafts.toFixed(2)})
            </div>
          ) : (
            <div className="text-sm text-[hsl(var(--text-muted)/0.6)]">
              Available Balance
            </div>
          )}
        </div>

        {/* Voice Entry - Large Button */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-white mb-2">
              Voice Entry
            </div>
            <div className="text-sm text-[hsl(var(--text-muted)/0.7)]">
              Tap to record expense
            </div>
          </div>

          <div className="relative">
            <VoiceEntryButton
              categories={categories}
              accountId={defaultAccount?.id}
              onParsed={(result) => {
                console.log("Parsed:", result);
              }}
              onDraftCreated={() => {
                toast.success("Draft created! Check your phone to confirm.");
              }}
              onPreviewChange={setPreviewText}
              className="scale-[2]"
            />
          </div>

          {previewText && (
            <div className="neo-card bg-[#1a2942]/80 p-4 text-center max-w-xs mt-8">
              <div className="text-xs text-[#06b6d4] mb-1">Listening...</div>
              <div className="text-sm text-white">{previewText}</div>
            </div>
          )}
        </div>

        {/* Quick Stats Widget */}
        <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#3b82f6]/30 p-4">
          <div className="text-xs text-[#3b82f6] font-medium uppercase tracking-wider mb-3 text-center">
            Today&apos;s Insight
          </div>
          <QuickInsight accountId={defaultAccount?.id} />
        </div>
      </div>

      {/* Watch hint at bottom */}
      <div className="mt-8 text-xs text-[hsl(var(--text-muted)/0.5)] text-center">
        Watch Mode • Swipe to refresh
      </div>
    </div>
  );
}

function QuickInsight({ accountId }: { accountId?: string }) {
  const today = new Date().toISOString().split("T")[0];

  const { data: todayTransactions } = useQuery({
    queryKey: ["transactions-today", accountId, today],
    queryFn: async () => {
      if (!accountId) return [];
      const res = await fetch(
        `/api/transactions?account_id=${accountId}&start_date=${today}&end_date=${today}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.transactions || [];
    },
    enabled: !!accountId,
  });

  const todayTotal = useMemo(() => {
    if (!todayTransactions || todayTransactions.length === 0) return 0;
    return todayTransactions.reduce(
      (sum: number, t: any) => sum + Number(t.amount || 0),
      0
    );
  }, [todayTransactions]);

  const transactionCount = todayTransactions?.length || 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-[hsl(var(--text-muted)/0.7)]">
          Today&apos;s Spending
        </span>
        <span className="text-lg font-bold text-white">
          ${todayTotal.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-[hsl(var(--text-muted)/0.7)]">
          Transactions
        </span>
        <span className="text-lg font-bold text-[#38bdf8]">
          {transactionCount}
        </span>
      </div>
    </div>
  );
}
