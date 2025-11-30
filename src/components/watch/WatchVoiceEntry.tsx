"use client";

import VoiceEntryButton from "@/components/expense/VoiceEntryButton";
import { useMyAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function WatchVoiceEntry() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  // Use only current user's accounts for adding transactions
  const { data: accounts = [], isLoading: accountsLoading } = useMyAccounts();
  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const { data: categories = [] } = useCategories(defaultAccount?.id);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!defaultAccount) {
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
            style={{ color: "white", fontSize: "16px", textAlign: "center" }}
          >
            No accounts. Create one in Settings → Accounts
          </div>
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
        {/* Title */}
        <div
          style={{
            fontSize: "18px",
            color: "#a5f3fc",
            marginBottom: "40px",
            textTransform: "uppercase",
            letterSpacing: "3px",
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Voice Entry
        </div>

        {/* Large Microphone Button */}
        <div style={{ position: "relative" }}>
          <VoiceEntryButton
            categories={categories}
            accountId={defaultAccount.id}
            onDraftCreated={() => {
              // Navigate back to dashboard after creating draft
              setTimeout(() => {
                router.push("/dashboard");
              }, 2000);
            }}
            onParsed={() => {
              // Fallback
            }}
            className="flex items-center justify-center"
          />
        </div>

        {/* Instructions */}
        <div
          style={{
            marginTop: "40px",
            fontSize: "14px",
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
            maxWidth: "300px",
            lineHeight: "1.6",
          }}
        >
          Tap microphone and say:
          <br />
          <span style={{ color: "#a5f3fc", fontStyle: "italic" }}>
            "Spent 25 dollars on coffee"
          </span>
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            position: "absolute",
            bottom: "30px",
            fontSize: "13px",
            color: "rgba(255,255,255,0.5)",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "20px",
            padding: "8px 20px",
            cursor: "pointer",
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
