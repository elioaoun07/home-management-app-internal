"use client";

import { useEffect, useState } from "react";

export default function SimpleWatchView() {
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // Fetch balance
    const fetchBalance = async () => {
      try {
        const accountsRes = await fetch("/api/accounts");
        if (!accountsRes.ok) {
          throw new Error("Failed to fetch accounts");
        }
        const accountsData = await accountsRes.json();
        const accounts = accountsData.accounts || [];

        if (accounts.length === 0) {
          setError("No accounts");
          return;
        }

        const defaultAccount =
          accounts.find((a: any) => a.is_default) || accounts[0];

        const balanceRes = await fetch(
          `/api/accounts/${defaultAccount.id}/balance`
        );
        if (!balanceRes.ok) {
          throw new Error("Failed to fetch balance");
        }
        const balanceData = await balanceRes.json();
        setBalance(balanceData.balance || 0);
      } catch (err: any) {
        setError(err.message || "Error");
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
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
        <div style={{ color: "white", fontSize: "18px" }}>Loading...</div>
      </div>
    );
  }

  if (error) {
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
            {error}
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
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
          background: "linear-gradient(135deg, #1e3a8a 0%, #831843 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
          padding: "2rem",
        }}
      >
        {/* Balance Display */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              fontSize: "12px",
              color: "#67e8f9",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Balance
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color: "#a5f3fc",
            }}
          >
            ${balance !== null ? balance.toFixed(2) : "..."}
          </div>
        </div>

        {/* Microphone Button */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
          onClick={() => {
            window.location.href = "/expense";
          }}
        >
          <div style={{ color: "white", fontSize: "32px" }}>🎤</div>
        </div>

        {/* Hint */}
        <div
          style={{
            marginTop: "32px",
            fontSize: "10px",
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
          }}
        >
          Tap mic to add expense
        </div>
      </div>
    </div>
  );
}
