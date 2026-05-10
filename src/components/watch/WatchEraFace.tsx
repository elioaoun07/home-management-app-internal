"use client";

// ERA DOT watch face — Galaxy Watch 7 (432×432 round display)
// Modules (swipe left/right): CHAT → BUDGET → SCHEDULE → RECIPE
// Tap anywhere: start / stop voice

import { useMyAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { CACHE_TIMES, getCachedBalance } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Module definitions ───────────────────────────────────────────────────────
const MODULES = [
  { id: "chat"    , label: "CHAT"    , hue: 190, sat: 85, lum: 62 },
  { id: "budget"  , label: "BUDGET"  , hue: 175, sat: 72, lum: 55 },
  { id: "schedule", label: "SCHEDULE", hue: 256, sat: 78, lum: 68 },
  { id: "recipe"  , label: "RECIPE"  , hue:  28, sat: 85, lum: 58 },
] as const;

type Mod = (typeof MODULES)[number];

// ─── Main component ───────────────────────────────────────────────────────────
export default function WatchEraFace() {
  const queryClient = useQueryClient();
  const [mounted, setMounted]     = useState(false);
  const [modIdx, setModIdx]       = useState(0);
  const [slideDir, setSlideDir]   = useState<"l" | "r">("l");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving]       = useState(false);

  const touchRef = useRef({ x: 0, t: 0 });
  const recRef   = useRef<SpeechRecognition | null>(null);
  const txRef    = useRef("");
  const swipedRef = useRef(false);   // skip slide anim on first mount

  const mod    = MODULES[modIdx];
  const accent = `hsl(${mod.hue},${mod.sat}%,${mod.lum}%)`;
  const dimmed = (a: number) => `hsla(${mod.hue},${mod.sat}%,${mod.lum}%,${a})`;

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: accounts = [] } = useMyAccounts();
  const defaultAcc = accounts.find((a) => a.is_default) ?? accounts[0];
  const { data: categories = [] } = useCategories(defaultAcc?.id);
  const cached = defaultAcc?.id ? getCachedBalance(defaultAcc.id) : null;

  const { data: balance } = useQuery<{ balance: number; draft_count?: number }>({
    queryKey: ["era-watch-bal", defaultAcc?.id],
    queryFn: async () => {
      const r = await fetch(`/api/accounts/${defaultAcc!.id}/balance`);
      if (!r.ok) throw new Error("bal");
      return r.json();
    },
    enabled: !!defaultAcc?.id && mounted,
    staleTime: CACHE_TIMES.BALANCE,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: cached ? { balance: cached.balance } : undefined,
  });

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const { data: scheduleItems = [] } = useQuery<any[]>({
    queryKey: ["era-watch-sched", today],
    queryFn: async () => {
      const r = await fetch(`/api/items?limit=5&date=${today}`);
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.items ?? []);
    },
    enabled: mounted,
    staleTime: CACHE_TIMES.TRANSACTIONS,
    refetchOnMount: false,
  });

  useEffect(() => { setMounted(true); }, []);

  // ── Speech recognition ────────────────────────────────────────────────────
  const SR = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
  }, []);

  function startVoice() {
    if (!SR || recording) return;
    const r: SpeechRecognition = new SR();
    recRef.current = r;
    txRef.current  = "";
    r.lang = "en-US";
    r.continuous     = true;
    r.interimResults = true;

    r.onresult = (e: SpeechRecognitionEvent) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0]?.transcript ?? "";
      txRef.current = t;
      setTranscript(t);
    };
    r.onerror = () => { setRecording(false); toast.error("Speech error"); };
    r.onend   = () => {
      setRecording(false);
      const t = txRef.current.trim();
      if (t) commitVoice(t);
    };

    r.start();
    setRecording(true);
    setTranscript("");
  }

  function stopVoice() {
    recRef.current?.stop();
    recRef.current = null;
  }

  async function commitVoice(text: string) {
    if (mod.id === "budget" && defaultAcc?.id) {
      setSaving(true);
      const parsed = parseSpeechExpense(text, categories);
      if (!parsed.amount) {
        toast.error("No amount detected");
        setSaving(false);
        setTranscript("");
        return;
      }
      const res = await safeFetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: defaultAcc.id,
          amount: parsed.amount,
          category_id: parsed.categoryId ?? null,
          description: text,
          voice_transcript: text,
          confidence_score: parsed.confidenceScore ?? null,
          date: parsed.date ?? today,
        }),
      });
      if (res.ok) {
        toast.success("Draft saved");
        queryClient.invalidateQueries({ queryKey: qk.drafts() });
        queryClient.invalidateQueries({ queryKey: ["era-watch-bal"] });
      } else {
        toast.error("Save failed");
      }
      setSaving(false);
    }
    // All modules: clear transcript after a brief preview
    setTimeout(() => setTranscript(""), 3500);
  }

  // ── Touch handling: tap vs swipe ──────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    touchRef.current = { x: e.touches[0].clientX, t: Date.now() };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchRef.current.x - e.changedTouches[0].clientX;
    const dt = Date.now() - touchRef.current.t;

    if (Math.abs(dx) > 40 && dt < 500) {
      // Swipe — switch module
      if (recording) stopVoice();
      setTranscript("");
      swipedRef.current = true;
      if (dx > 0) {
        setSlideDir("l");
        setModIdx((i) => (i + 1) % MODULES.length);
      } else {
        setSlideDir("r");
        setModIdx((i) => (i - 1 + MODULES.length) % MODULES.length);
      }
    } else if (Math.abs(dx) < 15 && dt < 350) {
      // Tap — toggle voice
      if (recording) stopVoice();
      else startVoice();
    }
  }

  // Slide animation direction for the center content
  const slideAnim = !swipedRef.current
    ? undefined
    : slideDir === "l"
      ? "era-watch-slide-l 0.32s cubic-bezier(.25,.46,.45,.94)"
      : "era-watch-slide-r 0.32s cubic-bezier(.25,.46,.45,.94)";

  return (
    <>
      <style>{`
        @keyframes era-watch-cw   { to { transform: rotate(360deg);  } }
        @keyframes era-watch-ccw  { to { transform: rotate(-360deg); } }
        @keyframes era-watch-breathe {
          0%,100% { opacity: .55; transform: scale(1); }
          50%     { opacity:  1;  transform: scale(1.05); }
        }
        @keyframes era-watch-recpulse {
          0%,100% { box-shadow: 0 0 0 0   rgba(239,68,68,.6); }
          50%     { box-shadow: 0 0 0 20px rgba(239,68,68,0); }
        }
        @keyframes era-watch-slide-l {
          from { transform: translateX(52px); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes era-watch-slide-r {
          from { transform: translateX(-52px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        @keyframes era-watch-wave {
          0%,100% { transform: scaleY(.3); }
          50%     { transform: scaleY(1);  }
        }
        @keyframes era-watch-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Full-screen backdrop ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 50% 50%, hsla(${mod.hue},45%,6%,1) 0%, #04070f 100%)`,
          transition: "background 0.65s ease",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: "default",
        }}
      >
        {/* ── Circular watch face ── */}
        <div
          style={{
            width:     "min(100vw, 100vh)",
            height:    "min(100vw, 100vh)",
            maxWidth:  432,
            maxHeight: 432,
            borderRadius: "50%",
            position:  "relative",
            overflow:  "hidden",
            background: `radial-gradient(ellipse at 50% 38%, hsla(${mod.hue},35%,10%,1) 0%, #080c1c 100%)`,
            boxShadow: `0 0 80px 14px ${dimmed(0.12)}, inset 0 0 100px rgba(0,0,0,0.6)`,
            border: `1px solid ${dimmed(0.2)}`,
            transition: "background 0.65s ease, box-shadow 0.65s ease, border-color 0.65s ease",
          }}
        >

          {/* ── ERA Ring: outer (full face, spinning CW) ── */}
          <div style={{
            position: "absolute", inset: 2,
            borderRadius: "50%",
            border: `1.5px solid ${dimmed(0.55)}`,
            boxShadow: `0 0 24px 4px ${dimmed(0.2)}`,
            animation: recording
              ? "era-watch-recpulse 1.1s ease-in-out infinite"
              : "era-watch-cw 9s linear infinite",
            transition: "border-color .65s ease, box-shadow .65s ease",
          }} />

          {/* ── ERA Ring: mid (82%, spinning CCW) ── */}
          <div style={{
            position: "absolute", inset: "9%",
            borderRadius: "50%",
            border: `1px solid ${dimmed(0.28)}`,
            animation: "era-watch-ccw 14s linear infinite",
            transition: "border-color .65s ease",
          }} />

          {/* ── ERA Ring: inner (64%, spinning CW) ── */}
          <div style={{
            position: "absolute", inset: "18%",
            borderRadius: "50%",
            border: `1px solid ${dimmed(0.14)}`,
            animation: "era-watch-cw 21s linear infinite",
            transition: "border-color .65s ease",
          }} />

          {/* ── ERA ambient glow core ── */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "46%", height: "46%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${dimmed(0.24)} 0%, transparent 70%)`,
            animation: "era-watch-breathe 3.5s ease-in-out infinite",
            pointerEvents: "none",
            transition: "background .65s ease",
          }} />

          {/* ── Module label — top ── */}
          <div style={{
            position: "absolute",
            top: "14%", left: 0, right: 0,
            textAlign: "center",
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: dimmed(0.82),
            transition: "color .65s ease",
            pointerEvents: "none",
          }}>
            ERA · {mod.label}
          </div>

          {/* ── Center content: keyed on modIdx for slide-in on module switch ── */}
          <div
            key={modIdx}
            style={{
              position: "absolute",
              top: "23%", left: "22%", right: "22%", bottom: "23%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              animation: slideAnim,
            }}
          >
            {recording ? (
              <RecordingView transcript={transcript} accent={accent} dimmed={dimmed} />
            ) : saving ? (
              <SavingView accent={accent} />
            ) : (
              <ModuleContent
                mod={mod}
                balance={balance}
                scheduleItems={scheduleItems}
                accent={accent}
                dimmed={dimmed}
              />
            )}
          </div>

          {/* ── Tap hint — above dots ── */}
          {!recording && !saving && (
            <div style={{
              position: "absolute",
              bottom: "22%",
              left: 0, right: 0,
              textAlign: "center",
              fontSize: 7.5,
              fontWeight: 600,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.18)",
              pointerEvents: "none",
            }}>
              tap · speak
            </div>
          )}

          {/* ── Module dot indicators — bottom ── */}
          <div style={{
            position: "absolute",
            bottom: "15%",
            left: 0, right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 5,
            alignItems: "center",
            pointerEvents: "none",
          }}>
            {MODULES.map((m, i) => (
              <div key={m.id} style={{
                width:        i === modIdx ? 12 : 5,
                height:       5,
                borderRadius: 3,
                background:   i === modIdx ? accent : "rgba(255,255,255,0.22)",
                boxShadow:    i === modIdx ? `0 0 7px ${accent}` : "none",
                transition:   "all .35s ease",
              }} />
            ))}
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecordingView({
  transcript,
  accent,
  dimmed,
}: {
  transcript: string;
  accent: string;
  dimmed: (a: number) => string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
      {/* Animated waveform bars */}
      <div style={{ display: "flex", gap: 3, alignItems: "center", height: 28 }}>
        {[70, 100, 55, 90, 40, 100, 75].map((pct, i) => (
          <div key={i} style={{
            width: 3,
            height: `${pct}%`,
            maxHeight: 28,
            minHeight: 4,
            borderRadius: 2,
            background: accent,
            transformOrigin: "center",
            animation: `era-watch-wave ${0.55 + i * 0.09}s ease-in-out ${i * 75}ms infinite`,
          }} />
        ))}
      </div>

      {/* Live transcript preview */}
      {transcript ? (
        <p style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.9)",
          textAlign: "center",
          lineHeight: 1.4,
          fontStyle: "italic",
          maxHeight: 44,
          overflow: "hidden",
          margin: 0,
        }}>
          {transcript}
        </p>
      ) : (
        <p style={{ fontSize: 9.5, color: dimmed(0.75), textAlign: "center", letterSpacing: "1px", margin: 0 }}>
          Listening…
        </p>
      )}

      <p style={{ fontSize: 7.5, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "1.5px", margin: 0 }}>
        tap to stop
      </p>
    </div>
  );
}

function SavingView({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 30, height: 30,
        borderRadius: "50%",
        border: `2px solid ${accent}`,
        borderTopColor: "transparent",
        animation: "era-watch-spin 0.8s linear infinite",
      }} />
      <p style={{ fontSize: 9, color: accent, letterSpacing: "1.5px", textTransform: "uppercase", margin: 0 }}>
        Saving…
      </p>
    </div>
  );
}

function ModuleContent({
  mod,
  balance,
  scheduleItems,
  accent,
  dimmed,
}: {
  mod: Mod;
  balance?: { balance: number; draft_count?: number };
  scheduleItems: any[];
  accent: string;
  dimmed: (a: number) => string;
}) {
  if (mod.id === "chat") {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 7, lineHeight: 1 }}>💬</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "1px" }}>ERA CHAT</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", marginTop: 5 }}>Speak to ERA</div>
      </div>
    );
  }

  if (mod.id === "budget") {
    const bal = balance?.balance ?? 0;
    const sign = bal < 0 ? "-" : "";
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, color: dimmed(0.72), letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 5 }}>
          Balance
        </div>
        <div style={{
          fontSize: 30,
          fontWeight: 800,
          background: `linear-gradient(135deg, ${accent} 0%, #fbbf24 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
        }}>
          {sign}${Math.abs(bal).toFixed(0)}
        </div>
        {(balance?.draft_count ?? 0) > 0 && (
          <div style={{ fontSize: 8.5, color: "#fb923c", marginTop: 5, letterSpacing: "0.5px" }}>
            {balance!.draft_count} draft{balance!.draft_count !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    );
  }

  if (mod.id === "schedule") {
    const count = scheduleItems.length;
    const next  = scheduleItems[0];
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, color: dimmed(0.72), letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 5 }}>
          Today
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, color: accent, lineHeight: 1 }}>
          {count}
        </div>
        <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          {count === 0 ? "All clear" : count === 1 ? "item" : "items"}
        </div>
        {next?.title && (
          <div style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.55)",
            marginTop: 7,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}>
            {next.title}
          </div>
        )}
      </div>
    );
  }

  if (mod.id === "recipe") {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 7, lineHeight: 1 }}>🍳</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "1px" }}>ERA CHEF</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", marginTop: 5 }}>Speak a recipe</div>
      </div>
    );
  }

  return null;
}
