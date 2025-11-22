"use client";

import VoiceEntryButton from "@/components/expense/VoiceEntryButton";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/hooks";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

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
    refetchInterval: 5000,
  });

  // Prevent default browser swipe/back behavior
  useEffect(() => {
    const preventSwipeBack = (e: TouchEvent | MouseEvent) => {
      if (isDragging.current) {
        e.preventDefault();
      }
    };

    // Disable browser back gesture
    document.addEventListener("touchmove", preventSwipeBack, {
      passive: false,
    });
    document.addEventListener("mousemove", preventSwipeBack, {
      passive: false,
    });

    // Prevent overscroll
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.removeEventListener("touchmove", preventSwipeBack);
      document.removeEventListener("mousemove", preventSwipeBack);
      document.body.style.overscrollBehavior = "";
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;

    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);

    // If horizontal movement is significant, mark as dragging
    if (deltaX > 10 && deltaX > deltaY) {
      isDragging.current = true;
      e.preventDefault(); // Prevent browser back
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current || !touchStartX.current) {
      touchStartX.current = 0;
      touchStartY.current = 0;
      isDragging.current = false;
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchStartX.current - touchEndX;

    // Only switch screens if swipe distance > 100px
    if (Math.abs(deltaX) > 100) {
      if (deltaX > 0 && currentScreen === "main") {
        // Swipe left on main -> insights
        setCurrentScreen("insights");
      } else if (deltaX < 0 && currentScreen === "insights") {
        // Swipe right on insights -> main
        setCurrentScreen("main");
      }
    }

    touchStartX.current = 0;
    touchStartY.current = 0;
    isDragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        touchAction: "none",
        WebkitUserSelect: "none",
        background:
          "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Circular mask for watch display */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative overflow-hidden"
          style={{
            width: "min(100vw, 100vh)",
            height: "min(100vw, 100vh)",
            maxWidth: "450px",
            maxHeight: "450px",
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #1e3a8a 0%, #3b0764 50%, #831843 100%)",
            boxShadow:
              "inset 0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,0,0,0.3)",
          }}
        >
          {/* Main Screen - Wallet & Microphone */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center transition-transform duration-300 ${
              currentScreen === "main" ? "translate-x-0" : "-translate-x-full"
            }`}
            style={{ touchAction: "none" }}
          >
            {/* Wallet Balance */}
            <div className="text-center mb-6 px-4">
              <div className="text-xs text-cyan-300 font-medium uppercase tracking-wider mb-2 opacity-80">
                {defaultAccount?.name || "Wallet"}
              </div>
              <div
                className="text-5xl font-bold tabular-nums mb-2"
                style={{
                  background:
                    "linear-gradient(135deg, #a5f3fc 0%, #fbbf24 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 2px 10px rgba(165, 243, 252, 0.5))",
                }}
              >
                ${balance?.balance?.toFixed(2) || "0.00"}
              </div>
              {balance?.pending_drafts ? (
                <div className="text-xs text-orange-300 mt-1">
                  {balance.draft_count} draft
                  {balance.draft_count !== 1 ? "s" : ""}
                </div>
              ) : null}
            </div>

            {/* Voice Entry Button */}
            <div className="relative mb-4 scale-[2]">
              <VoiceEntryButton
                categories={categories}
                accountId={defaultAccount?.id}
                onParsed={(result) => console.log("Parsed:", result)}
                onDraftCreated={() => {
                  toast.success("Draft saved!");
                }}
                onPreviewChange={setPreviewText}
                className=""
              />
            </div>

            {/* Preview Text */}
            {previewText && (
              <div
                className="absolute bottom-16 left-4 right-4 p-3 rounded-2xl text-center animate-in fade-in backdrop-blur-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(30, 58, 138, 0.9) 0%, rgba(59, 7, 100, 0.9) 100%)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                }}
              >
                <div className="text-[10px] text-cyan-300 mb-1 font-medium uppercase">
                  Listening
                </div>
                <div className="text-sm text-white font-medium line-clamp-2">
                  {previewText}
                </div>
              </div>
            )}

            {/* Swipe Indicator */}
            <div className="absolute bottom-6 left-0 right-0 text-center">
              <div className="text-[10px] text-white/40 mb-2">
                ← Swipe for stats
              </div>
              <div className="flex justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                <div className="w-2 h-2 rounded-full bg-white/20"></div>
              </div>
            </div>
          </div>

          {/* Insights Screen */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center px-6 py-8 transition-transform duration-300 overflow-y-auto ${
              currentScreen === "insights"
                ? "translate-x-0"
                : "translate-x-full"
            }`}
            style={{ touchAction: "pan-y" }}
          >
            <div className="w-full space-y-3 max-h-full overflow-y-auto">
              {/* Header */}
              <div className="text-center mb-2">
                <h2
                  className="text-2xl font-bold mb-1"
                  style={{
                    background:
                      "linear-gradient(135deg, #a5f3fc 0%, #fbbf24 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Dashboard
                </h2>
                <p className="text-xs text-white/60">Today&apos;s Activity</p>
              </div>

              {/* Insights Cards */}
              <QuickInsight accountId={defaultAccount?.id} />
            </div>

            {/* Swipe Indicator */}
            <div className="absolute bottom-6 left-0 right-0 text-center">
              <div className="text-[10px] text-white/40 mb-2">
                Swipe right →
              </div>
              <div className="flex justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-white/20"></div>
                <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
              </div>
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
      <div
        className="p-4 rounded-2xl text-center backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="text-[10px] text-cyan-300 font-medium uppercase tracking-wider mb-1">
          Today&apos;s Spending
        </div>
        <div
          className="text-3xl font-bold"
          style={{
            background: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          ${todayTotal.toFixed(2)}
        </div>
      </div>

      {/* Transaction Count */}
      <div
        className="p-4 rounded-2xl text-center backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(20, 184, 166, 0.3) 100%)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="text-[10px] text-cyan-300 font-medium uppercase tracking-wider mb-1">
          Transactions
        </div>
        <div
          className="text-3xl font-bold"
          style={{
            background: "linear-gradient(135deg, #a5f3fc 0%, #67e8f9 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {transactionCount}
        </div>
      </div>

      {/* Last Transaction */}
      {todayTransactions && todayTransactions.length > 0 && (
        <div
          className="p-4 rounded-2xl backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.3) 100%)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div className="text-[10px] text-emerald-300 font-medium uppercase tracking-wider mb-2 text-center">
            Latest
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/90 truncate mr-2">
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
