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
  const [touchStartY, setTouchStartY] = useState(0);

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

  // Swipe handlers - only allow horizontal swipes on insights screen
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart - touchEnd;
    const distanceY = Math.abs(touchStartY - (touchEnd || touchStartY));

    // Only process horizontal swipes (not vertical scrolling)
    if (distanceY > 30) {
      setTouchStart(0);
      setTouchEnd(0);
      setTouchStartY(0);
      return;
    }

    const isLeftSwipe = distanceX > 75; // Increased threshold
    const isRightSwipe = distanceX < -75;

    // Only allow left swipe from main screen
    if (isLeftSwipe && currentScreen === "main") {
      setCurrentScreen("insights");
    }
    // Only allow right swipe from insights screen
    if (isRightSwipe && currentScreen === "insights") {
      setCurrentScreen("main");
    }

    setTouchStart(0);
    setTouchEnd(0);
    setTouchStartY(0);
  };

  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f1d2e] to-[#1a2942] overflow-hidden touch-pan-y"
      style={{
        // Optimize for smartwatch displays
        maxWidth: "450px",
        margin: "0 auto",
        height: "100dvh", // Dynamic viewport height for better mobile support
      }}
    >
      <div
        className="relative w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Main Screen - Wallet & Microphone */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center px-4 transition-transform duration-300 ${
            currentScreen === "main" ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Wallet Balance - Optimized for small screens */}
          <div className="mb-8 text-center w-full">
            <div className="text-xs text-[#06b6d4]/70 font-medium uppercase tracking-wider mb-2">
              {defaultAccount?.name || "Wallet"}
            </div>
            <div className="text-5xl sm:text-6xl md:text-7xl font-bold tabular-nums text-white mb-2 drop-shadow-2xl">
              ${balance?.balance?.toFixed(2) || "0.00"}
            </div>
            {balance?.pending_drafts ? (
              <div className="text-xs text-orange-400/80 mt-1">
                {balance.draft_count} draft
                {balance.draft_count !== 1 ? "s" : ""}
              </div>
            ) : null}
          </div>

          {/* Voice Entry - Responsive sizing */}
          <div className="relative mb-6 scale-[2] sm:scale-[2.5]">
            <VoiceEntryButton
              categories={categories}
              accountId={defaultAccount?.id}
              onParsed={(result) => {
                console.log("Parsed:", result);
              }}
              onDraftCreated={() => {
                toast.success("Draft saved!", {
                  description: "Check your phone",
                });
              }}
              onPreviewChange={setPreviewText}
              className=""
            />
          </div>

          {/* Preview Text */}
          {previewText && (
            <div className="neo-card bg-[#1a2942]/90 p-3 text-center max-w-[85%] mt-8 animate-in fade-in">
              <div className="text-[10px] text-[#06b6d4] mb-1 font-medium uppercase">
                Listening
              </div>
              <div className="text-sm text-white font-medium line-clamp-3">
                {previewText}
              </div>
            </div>
          )}

          {/* Swipe Indicator */}
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <div className="text-[10px] text-[hsl(var(--text-muted)/0.4)] mb-2">
              Swipe left for stats
            </div>
            <div className="flex justify-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--text-muted)/0.3)]"></div>
            </div>
          </div>
        </div>

        {/* Insights Screen */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center px-4 py-8 transition-transform duration-300 overflow-y-auto ${
            currentScreen === "insights" ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="w-full max-w-sm space-y-4">
            {/* Header */}
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white mb-1">Stats</h2>
              <p className="text-xs text-[hsl(var(--text-muted)/0.7)]">
                Today&apos;s Activity
              </p>
            </div>

            {/* Insights Cards */}
            <QuickInsight accountId={defaultAccount?.id} />
          </div>

          {/* Swipe Indicator */}
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <div className="text-[10px] text-[hsl(var(--text-muted)/0.4)] mb-2">
              Swipe right to return
            </div>
            <div className="flex justify-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--text-muted)/0.3)]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]"></div>
            </div>
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
    <div className="space-y-3">
      {/* Today's Spending */}
      <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#3b82f6]/30 p-4 text-center">
        <div className="text-[10px] text-[#3b82f6] font-medium uppercase tracking-wider mb-1">
          Today&apos;s Spending
        </div>
        <div className="text-3xl font-bold text-white">
          ${todayTotal.toFixed(2)}
        </div>
      </div>

      {/* Transaction Count */}
      <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#06b6d4]/30 p-4 text-center">
        <div className="text-[10px] text-[#06b6d4] font-medium uppercase tracking-wider mb-1">
          Transactions
        </div>
        <div className="text-3xl font-bold text-[#38bdf8]">
          {transactionCount}
        </div>
      </div>

      {/* Last Transaction */}
      {todayTransactions && todayTransactions.length > 0 && (
        <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#14b8a6]/30 p-4">
          <div className="text-[10px] text-[#14b8a6] font-medium uppercase tracking-wider mb-2 text-center">
            Latest
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white truncate mr-2">
              {todayTransactions[0].description ||
                todayTransactions[0].category?.name ||
                "Expense"}
            </span>
            <span className="text-base font-bold text-white whitespace-nowrap">
              ${Number(todayTransactions[0].amount).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
