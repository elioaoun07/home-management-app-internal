"use client";

import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useDrafts } from "@/features/drafts/useDrafts";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { qk } from "@/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface Balance {
  account_id: string;
  balance: number;
  pending_drafts?: number;
  draft_count?: number;
}

export default function WatchView() {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<"main" | "insights">(
    "main"
  );
  const touchStartX = useRef(0);

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>("");

  // Data hooks
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const { data: categories = [] } = useCategories(defaultAccount?.id);
  const { data: drafts = [] } = useDrafts();

  // Fetch balance
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
    enabled: !!defaultAccount?.id && mounted,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch today's transactions
  const today = new Date().toISOString().split("T")[0];
  const { data: todayTransactions = [] } = useQuery({
    queryKey: ["transactions-today", defaultAccount?.id, today],
    queryFn: async () => {
      if (!defaultAccount?.id) return [];
      const res = await fetch(
        `/api/transactions?account_id=${defaultAccount.id}&start_date=${today}&end_date=${today}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.transactions || [];
    },
    enabled: !!defaultAccount?.id && mounted,
  });

  const todaySpending = useMemo(
    () =>
      todayTransactions.reduce(
        (sum: number, t: any) => sum + Number(t.amount || 0),
        0
      ),
    [todayTransactions]
  );

  const SpeechRecognitionImpl = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null
    );
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Voice recording
  const startRecording = () => {
    if (!SpeechRecognitionImpl) {
      toast.error("Speech recognition not supported");
      return;
    }
    try {
      const rec: SpeechRecognition = new SpeechRecognitionImpl();
      recognitionRef.current = rec;
      transcriptRef.current = "";
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let text = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0]?.transcript ?? "";
        }
        transcriptRef.current = text;
        setPreview(text);
      };

      rec.onerror = () => {
        toast.error("Speech recognition error");
        stopRecording();
      };

      rec.onend = () => {
        setRecording(false);
        const sentence = transcriptRef.current.trim();
        if (sentence) saveDraft(sentence);
      };

      rec.start();
      setRecording(true);
    } catch (e) {
      toast.error("Could not start speech recognition");
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  };

  const saveDraft = async (sentence: string) => {
    if (!sentence || !defaultAccount?.id) return;

    const parsed = parseSpeechExpense(sentence, categories);

    if (!parsed.amount) {
      toast.error("Could not detect amount in speech");
      setPreview("");
      return;
    }

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: defaultAccount.id,
          amount: parsed.amount,
          category_id: parsed.categoryId || null,
          subcategory_id: parsed.subcategoryId || null,
          description: sentence,
          voice_transcript: sentence,
          confidence_score: parsed.confidenceScore || null,
          date: parsed.date || new Date().toISOString().split("T")[0],
        }),
      });

      if (response.ok) {
        toast.success("Saved as draft!");
        queryClient.invalidateQueries({ queryKey: qk.drafts() });
        queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      } else {
        toast.error("Failed to save draft");
      }
    } catch (error) {
      toast.error("Failed to save voice entry");
    }
    setPreview("");
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(deltaX) > 100) {
      if (deltaX > 0 && currentScreen === "main") {
        setCurrentScreen("insights");
      } else if (deltaX < 0 && currentScreen === "insights") {
        setCurrentScreen("main");
      }
    }
  };

  if (!mounted || accountsLoading) {
    return <LoadingScreen />;
  }

  if (!defaultAccount) {
    return <ErrorScreen />;
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 10px 40px rgba(239, 68, 68, 0.8), inset 0 3px 10px rgba(255,255,255,0.2), 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            box-shadow: 0 10px 40px rgba(239, 68, 68, 0.8), inset 0 3px 10px rgba(255,255,255,0.2), 0 0 0 20px rgba(239, 68, 68, 0);
          }
        }
      `}</style>
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
        }}
      >
        <div
          style={{
            width: "min(100vw, 100vh)",
            height: "min(100vw, 100vh)",
            maxWidth: "480px",
            maxHeight: "480px",
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #1e3a8a 0%, #6366f1 50%, #ec4899 100%)",
            boxShadow:
              "inset 0 0 100px rgba(0,0,0,0.7), 0 0 50px rgba(147, 51, 234, 0.5)",
            border: "4px solid rgba(147, 51, 234, 0.3)",
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
                currentScreen === "main"
                  ? "translateX(0)"
                  : "translateX(-100%)",
              transition: "transform 0.3s ease-out",
            }}
          >
            {/* Balance */}
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
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
                {defaultAccount?.name || "Balance"}
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
                ${balance?.balance?.toFixed(2) || "0.00"}
              </div>

              {/* Draft Info */}
              {balance && (balance.draft_count ?? 0) > 0 && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    background: "rgba(251, 146, 60, 0.15)",
                    border: "1px solid rgba(251, 146, 60, 0.3)",
                    display: "inline-block",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#fb923c",
                      marginBottom: "4px",
                      fontWeight: "600",
                    }}
                  >
                    {balance.draft_count} DRAFT
                    {balance.draft_count !== 1 ? "S" : ""}
                  </div>
                  {balance.pending_drafts && balance.pending_drafts > 0 && (
                    <div
                      style={{
                        fontSize: "16px",
                        color: "#fbbf24",
                        fontWeight: "bold",
                      }}
                    >
                      -${balance.pending_drafts.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Microphone Button */}
            <div
              onClick={recording ? stopRecording : startRecording}
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: recording
                  ? "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)"
                  : "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: recording
                  ? undefined
                  : "0 10px 40px rgba(139, 92, 246, 0.6), inset 0 3px 10px rgba(255,255,255,0.2)",
                border: "3px solid rgba(255,255,255,0.3)",
                animation: recording
                  ? "pulse 1.5s ease-in-out infinite"
                  : "none",
              }}
            >
              {recording ? (
                <svg
                  width="45"
                  height="45"
                  viewBox="0 0 24 24"
                  fill="white"
                  stroke="white"
                  strokeWidth="2"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  width="45"
                  height="45"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </div>

            {/* Preview */}
            {recording && preview && (
              <div
                style={{
                  marginTop: "24px",
                  padding: "14px 18px",
                  borderRadius: "16px",
                  background: "rgba(0,0,0,0.4)",
                  maxWidth: "85%",
                  textAlign: "center",
                  border: "1px solid rgba(165, 243, 252, 0.3)",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    color: "#a5f3fc",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    fontWeight: "600",
                  }}
                >
                  🎤 Listening...
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "rgba(255,255,255,0.95)",
                    fontStyle: "italic",
                  }}
                >
                  {preview}
                </div>
              </div>
            )}

            {/* Swipe Indicator */}
            <div
              style={{
                position: "absolute",
                bottom: "24px",
                display: "flex",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#a5f3fc",
                  boxShadow: "0 0 10px #a5f3fc",
                }}
              />
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.3)",
                }}
              />
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
                marginBottom: "32px",
              }}
            >
              Today's Activity
            </div>

            {/* Spending Card */}
            <div
              style={{
                background: "rgba(59, 130, 246, 0.2)",
                border: "1px solid rgba(147, 51, 234, 0.3)",
                borderRadius: "20px",
                padding: "20px",
                marginBottom: "16px",
                textAlign: "center",
                width: "85%",
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
                💸 Spending
              </div>
              <div
                style={{
                  fontSize: "36px",
                  fontWeight: "bold",
                  background:
                    "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                ${todaySpending.toFixed(2)}
              </div>
            </div>

            {/* Transactions Card */}
            <div
              style={{
                background: "rgba(6, 182, 212, 0.2)",
                border: "1px solid rgba(20, 184, 166, 0.3)",
                borderRadius: "20px",
                padding: "20px",
                marginBottom: "16px",
                textAlign: "center",
                width: "85%",
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
                📊 Transactions
              </div>
              <div
                style={{
                  fontSize: "36px",
                  fontWeight: "bold",
                  background:
                    "linear-gradient(135deg, #a5f3fc 0%, #67e8f9 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {todayTransactions.length}
              </div>
            </div>

            {/* Drafts Card */}
            {drafts.length > 0 && (
              <div
                style={{
                  background: "rgba(251, 146, 60, 0.2)",
                  border: "1px solid rgba(251, 146, 60, 0.3)",
                  borderRadius: "20px",
                  padding: "20px",
                  textAlign: "center",
                  width: "85%",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#fb923c",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  🎤 Pending Drafts
                </div>
                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: "bold",
                    background:
                      "linear-gradient(135deg, #fbbf24 0%, #fb923c 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {drafts.length}
                </div>
              </div>
            )}

            {/* Swipe Back */}
            <div
              style={{
                position: "absolute",
                bottom: "24px",
                display: "flex",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.3)",
                }}
              />
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#a5f3fc",
                  boxShadow: "0 0 10px #a5f3fc",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function LoadingScreen() {
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
          width: "min(100vw, 100vh)",
          height: "min(100vw, 100vh)",
          maxWidth: "480px",
          maxHeight: "480px",
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, #1e3a8a 0%, #6366f1 50%, #ec4899 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 0 100px rgba(0,0,0,0.7)",
          border: "4px solid rgba(147, 51, 234, 0.3)",
        }}
      >
        <div style={{ color: "#a5f3fc", fontSize: "18px", fontWeight: "600" }}>
          Loading...
        </div>
      </div>
    </div>
  );
}

function ErrorScreen() {
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
          width: "min(100vw, 100vh)",
          height: "min(100vw, 100vh)",
          maxWidth: "480px",
          maxHeight: "480px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1e3a8a 0%, #831843 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem",
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.6)",
          border: "4px solid rgba(239, 68, 68, 0.3)",
        }}
      >
        <div
          style={{ color: "#ef4444", fontSize: "56px", marginBottom: "20px" }}
        >
          ⚠️
        </div>
        <div
          style={{
            color: "white",
            fontSize: "16px",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          No accounts found. Create one in Settings → Accounts
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "14px 28px",
            borderRadius: "28px",
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
            color: "white",
            border: "none",
            fontSize: "15px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          🔄 Reload
        </button>
      </div>
    </div>
  );
}
