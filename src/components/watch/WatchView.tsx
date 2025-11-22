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
  const [currentScreen, setCurrentScreen] = useState<"main" | "insights">(
    "main"
  );
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentScreen === "main") {
      setCurrentScreen("insights");
    }
    if (isRightSwipe && currentScreen === "insights") {
      setCurrentScreen("main");
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1d2e] to-[#1a2942] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Screen - Wallet & Microphone */}
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 transition-transform duration-300 ${
          currentScreen === "main" ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          position: currentScreen === "main" ? "relative" : "absolute",
          width: "100%",
        }}
      >
        {/* Wallet Balance - Large and Centered */}
        <div className="mb-12 text-center">
          <div className="text-sm text-[#06b6d4]/70 font-medium uppercase tracking-widest mb-3">
            {defaultAccount?.name || "Wallet"}
          </div>
          <div className="text-7xl font-bold tabular-nums text-white mb-3 drop-shadow-2xl">
            ${balance?.balance?.toFixed(2) || "0.00"}
          </div>
          {balance?.pending_drafts ? (
            <div className="text-sm text-orange-400/80 mt-2">
              {balance.draft_count} pending draft
              {balance.draft_count !== 1 ? "s" : ""}
            </div>
          ) : null}
        </div>

        {/* Voice Entry - Huge Button */}
        <div className="relative mb-8">
          <VoiceEntryButton
            categories={categories}
            accountId={defaultAccount?.id}
            onParsed={(result) => {
              console.log("Parsed:", result);
            }}
            onDraftCreated={() => {
              toast.success("Draft saved!", {
                description: "Check your phone to review",
              });
            }}
            onPreviewChange={setPreviewText}
            className="scale-[2.5]"
          />
        </div>

        {/* Preview Text */}
        {previewText && (
          <div className="neo-card bg-[#1a2942]/90 p-4 text-center max-w-xs mt-12 animate-in fade-in">
            <div className="text-xs text-[#06b6d4] mb-2 font-medium">
              LISTENING...
            </div>
            <div className="text-base text-white font-medium">
              {previewText}
            </div>
          </div>
        )}

        {/* Swipe Indicator */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <div className="text-xs text-[hsl(var(--text-muted)/0.4)] mb-1">
            Swipe left for insights
          </div>
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#06b6d4]"></div>
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--text-muted)/0.3)]"></div>
          </div>
        </div>
      </div>

      {/* Insights Screen */}
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 transition-transform duration-300 ${
          currentScreen === "insights" ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          position: currentScreen === "insights" ? "relative" : "absolute",
          width: "100%",
          top: 0,
        }}
      >
        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
            <p className="text-sm text-[hsl(var(--text-muted)/0.7)]">
              Today&apos;s Overview
            </p>
          </div>

          {/* Insights Cards */}
          <QuickInsight accountId={defaultAccount?.id} />
        </div>

        {/* Swipe Indicator */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <div className="text-xs text-[hsl(var(--text-muted)/0.4)] mb-1">
            Swipe right to go back
          </div>
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--text-muted)/0.3)]"></div>
            <div className="w-2 h-2 rounded-full bg-[#06b6d4]"></div>
          </div>
        </div>
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
    <div className="space-y-4">
      {/* Today's Spending */}
      <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#3b82f6]/30 p-6 text-center">
        <div className="text-xs text-[#3b82f6] font-medium uppercase tracking-wider mb-2">
          Today&apos;s Spending
        </div>
        <div className="text-4xl font-bold text-white">
          ${todayTotal.toFixed(2)}
        </div>
      </div>

      {/* Transaction Count */}
      <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#06b6d4]/30 p-6 text-center">
        <div className="text-xs text-[#06b6d4] font-medium uppercase tracking-wider mb-2">
          Transactions
        </div>
        <div className="text-4xl font-bold text-[#38bdf8]">
          {transactionCount}
        </div>
      </div>

      {/* Last Transaction */}
      {todayTransactions && todayTransactions.length > 0 && (
        <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#14b8a6]/30 p-6">
          <div className="text-xs text-[#14b8a6] font-medium uppercase tracking-wider mb-3 text-center">
            Latest Transaction
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white">
              {todayTransactions[0].description ||
                todayTransactions[0].category?.name ||
                "Expense"}
            </span>
            <span className="text-lg font-bold text-white">
              ${Number(todayTransactions[0].amount).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
