"use client";

import { useAccounts } from "@/features/accounts/hooks";
import { useEffect, useRef, useState } from "react";

async function logError(error: any, context: string) {
  try {
    await fetch("/api/error-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error_message: `[SimpleWatchView - ${context}] ${error.message || String(error)}`,
        error_stack: error.stack || String(error),
        component_name: "SimpleWatchView",
        url: typeof window !== "undefined" ? window.location.href : "",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    });
  } catch (logErr) {
    console.error("Failed to log error:", logErr);
  }
}

export default function SimpleWatchView() {
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<"main" | "insights">(
    "main"
  );
  const [todaySpending, setTodaySpending] = useState<number>(0);
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Use the same hook as mobile UI
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!defaultAccount?.id) return;

    const fetchData = async () => {
      try {
        // Fetch balance
        const balanceRes = await fetch(
          `/api/accounts/${defaultAccount.id}/balance`,
          { cache: "no-store" }
        );
        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          setBalance(balanceData.balance || 0);
        }

        // Fetch today's transactions
        const today = new Date().toISOString().split("T")[0];
        const txRes = await fetch(
          `/api/transactions?account_id=${defaultAccount.id}&start_date=${today}&end_date=${today}`,
          { cache: "no-store" }
        );
        if (txRes.ok) {
          const txData = await txRes.json();
          const transactions = txData.transactions || [];
          const total = transactions.reduce(
            (sum: number, t: any) => sum + Number(t.amount || 0),
            0
          );
          setTodaySpending(total);
          setTransactionCount(transactions.length);
        }
      } catch (err: any) {
        console.error("Watch view error:", err);
        logError(err, "fetchData");
        setError(err.message || "Error loading data");
      }
    };

    fetchData();
  }, [defaultAccount?.id]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchStartX.current - touchEndX;

    if (Math.abs(deltaX) > 100) {
      if (deltaX > 0 && currentScreen === "main") {
        setCurrentScreen("insights");
      } else if (deltaX < 0 && currentScreen === "insights") {
        setCurrentScreen("main");
      }
    }
  };

  if (!mounted || accountsLoading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 20%, #667eea 0%, #764ba2 40%, #f093fb 100%)",
        }}
      >
        <div
          style={{
            width: "min(90vw, 90vh)",
            height: "min(90vw, 90vh)",
            maxWidth: "400px",
            maxHeight: "400px",
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #1e3a8a 0%, #6366f1 50%, #ec4899 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "inset 0 0 80px rgba(0,0,0,0.6), 0 0 40px rgba(147, 51, 234, 0.4)",
          }}
        >
          <div style={{ color: "white", fontSize: "18px" }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!defaultAccount || error) {
    const errorMsg = error || "No accounts. Create one in Settings → Accounts";
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div
          style={{
            width: "min(90vw, 90vh)",
            height: "min(90vw, 90vh)",
            maxWidth: "400px",
            maxHeight: "400px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #1e3a8a 0%, #831843 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{ color: "#ef4444", fontSize: "48px", marginBottom: "16px" }}
          >
            ⚠️
          </div>
          <div
            style={{ color: "white", fontSize: "16px", textAlign: "center" }}
          >
            {errorMsg}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "24px",
              padding: "12px 24px",
              borderRadius: "24px",
              background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
              color: "white",
              border: "none",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 30% 20%, #667eea 0%, #764ba2 40%, #f093fb 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "min(100vw, 100vh)",
          height: "min(100vw, 100vh)",
          maxWidth: "450px",
          maxHeight: "450px",
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, #1e3a8a 0%, #6366f1 50%, #ec4899 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "inset 0 0 80px rgba(0,0,0,0.6), 0 0 40px rgba(147, 51, 234, 0.4)",
          padding: "2rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Main Screen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            transform:
              currentScreen === "main" ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s ease-out",
          }}
        >
          {/* Balance Display */}
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div
              style={{
                fontSize: "14px",
                color: "#a5f3fc",
                marginBottom: "12px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                fontWeight: "600",
              }}
            >
              Balance
            </div>
            <div
              style={{
                fontSize: "56px",
                fontWeight: "bold",
                background:
                  "linear-gradient(135deg, #fbbf24 0%, #f97316 50%, #ec4899 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 4px 12px rgba(251, 191, 36, 0.5))",
              }}
            >
              ${balance !== null ? balance.toFixed(2) : "..."}
            </div>
          </div>

          {/* Microphone Button */}
          <div
            style={{
              width: "90px",
              height: "90px",
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow:
                "0 8px 32px rgba(139, 92, 246, 0.5), inset 0 2px 8px rgba(255,255,255,0.2)",
              border: "2px solid rgba(255,255,255,0.3)",
            }}
            onClick={() => {
              if (typeof window !== "undefined" && localStorage) {
                localStorage.setItem("app-view-mode", "mobile");
                setTimeout(() => {
                  window.location.href = "/expense";
                }, 100);
              }
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>

          {/* Swipe Indicator */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: 0,
              right: 0,
              textAlign: "center",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "center", gap: "6px" }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#a5f3fc",
                  boxShadow: "0 0 8px #a5f3fc",
                }}
              />
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.3)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Insights Screen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            transform:
              currentScreen === "insights"
                ? "translateX(0)"
                : "translateX(100%)",
            transition: "transform 0.3s ease-out",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              background: "linear-gradient(135deg, #a5f3fc 0%, #fbbf24 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: "24px",
            }}
          >
            Today's Activity
          </div>

          {/* Today's Spending Card */}
          <div
            style={{
              background: "rgba(59, 130, 246, 0.2)",
              border: "1px solid rgba(147, 51, 234, 0.3)",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              textAlign: "center",
              width: "80%",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#a5f3fc",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Spending
            </div>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "bold",
                background: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ${todaySpending.toFixed(2)}
            </div>
          </div>

          {/* Transaction Count Card */}
          <div
            style={{
              background: "rgba(6, 182, 212, 0.2)",
              border: "1px solid rgba(20, 184, 166, 0.3)",
              borderRadius: "16px",
              padding: "16px",
              textAlign: "center",
              width: "80%",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#a5f3fc",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Transactions
            </div>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "bold",
                background: "linear-gradient(135deg, #a5f3fc 0%, #67e8f9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {transactionCount}
            </div>
          </div>

          {/* Swipe Back Indicator */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: 0,
              right: 0,
              textAlign: "center",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "center", gap: "6px" }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.3)",
                }}
              />
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#a5f3fc",
                  boxShadow: "0 0 8px #a5f3fc",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
