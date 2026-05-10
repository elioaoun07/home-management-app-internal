"use client";

// ERA DOT watch face — Galaxy Watch 7 (432×432 round display)
// The ERA Mark IS the watch face. Hub rings are halos around it.
// Modules (swipe left/right): CHAT → BUDGET → SCHEDULE → RECIPE
// Tap anywhere: start / stop voice.

import { ERAMark, type ERAModuleKey } from "@/components/shared/ERAMark";
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
// mark = ERAModuleKey so ERAMark shows the correct cue animation per module
const WATCH_MODULES = [
  { id: "chat"    , mark: "chat"      as ERAModuleKey, label: "CHAT"    , hue: 190, sat: 85, lum: 62 },
  { id: "budget"  , mark: "financial" as ERAModuleKey, label: "BUDGET"  , hue: 175, sat: 72, lum: 55 },
  { id: "schedule", mark: "schedule"  as ERAModuleKey, label: "SCHEDULE", hue: 256, sat: 78, lum: 68 },
  { id: "recipe"  , mark: "recipe"    as ERAModuleKey, label: "RECIPE"  , hue:  28, sat: 85, lum: 58 },
] as const;

type WMod = (typeof WATCH_MODULES)[number];

// ─── Component ────────────────────────────────────────────────────────────────
export default function WatchEraFace() {
  const queryClient = useQueryClient();
  const [mounted, setMounted]       = useState(false);
  const [modIdx, setModIdx]         = useState(0);
  const [slideDir, setSlideDir]     = useState<"l" | "r">("l");
  const [recording, setRecording]   = useState(false);
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving]         = useState(false);

  const touchRef  = useRef({ x: 0, t: 0 });
  const recRef    = useRef<SpeechRecognition | null>(null);
  const txRef     = useRef("");
  const swipedRef = useRef(false);

  const mod = WATCH_MODULES[modIdx];

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

  // ── Voice ─────────────────────────────────────────────────────────────────
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
    setTimeout(() => setTranscript(""), 3500);
  }

  // ── Touch: tap vs swipe ───────────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    touchRef.current = { x: e.touches[0].clientX, t: Date.now() };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchRef.current.x - e.changedTouches[0].clientX;
    const dt = Date.now() - touchRef.current.t;
    if (Math.abs(dx) > 40 && dt < 500) {
      if (recording) stopVoice();
      setTranscript("");
      swipedRef.current = true;
      if (dx > 0) { setSlideDir("l"); setModIdx((i) => (i + 1) % WATCH_MODULES.length); }
      else        { setSlideDir("r"); setModIdx((i) => (i - 1 + WATCH_MODULES.length) % WATCH_MODULES.length); }
    } else if (Math.abs(dx) < 15 && dt < 350) {
      if (recording) stopVoice();
      else startVoice();
    }
  }

  const slideAnim = !swipedRef.current
    ? undefined
    : slideDir === "l"
      ? "era-w-slide-l 0.32s cubic-bezier(.25,.46,.45,.94)"
      : "era-w-slide-r 0.32s cubic-bezier(.25,.46,.45,.94)";

  // Build CSS vars as inline style — drives hub rings + shell glow
  const eraVars = {
    "--era-hue":           mod.hue,
    "--era-sat":           `${mod.sat}%`,
    "--era-lum":           `${mod.lum}%`,
    "--era-accent":        `hsl(${mod.hue},${mod.sat}%,${mod.lum}%)`,
    "--era-accent-faint":  `hsla(${mod.hue},60%,65%,.38)`,
    "--era-border-subtle": `hsla(${mod.hue},45%,48%,.28)`,
  } as React.CSSProperties;

  return (
    <>
      <style>{`
        @keyframes era-w-slide-l {
          from { transform: translateX(36px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes era-w-slide-r {
          from { transform: translateX(-36px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        @keyframes era-w-recring {
          0%,100% { box-shadow: 0 0 0 0   hsla(var(--era-hue),var(--era-sat),var(--era-lum),.55); }
          50%     { box-shadow: 0 0 0 24px hsla(var(--era-hue),var(--era-sat),var(--era-lum),0); }
        }
        @keyframes era-w-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes era-w-wave {
          0%,100% { transform: scaleY(.3); }
          50%     { transform: scaleY(1);  }
        }
      `}</style>

      {/* ── Full-screen backdrop ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          ...eraVars,
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1220",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* Shell ambient glow — same class used by EraShell */}
        <div className="era-shell-glow pointer-events-none absolute inset-0" />

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
          }}
        >
          {/* ── ERA hub rings — exactly as in EraShell desktop ──
              Outer at 0, mid at ~5%, inner at ~11%
              These use --era-hue/sat/lum and breathe/orbit-breathe animations  */}
          <div className="era-hub-ring-outer absolute inset-0 rounded-full" />
          <div className="era-hub-ring-mid   absolute rounded-full" style={{ inset: "5.2%" }} />
          <div className="era-hub-ring-inner absolute rounded-full" style={{ inset: "10.8%" }} />

          {/* Recording pulse ring — replaces outer ring breathing with a hue-pulse */}
          {recording && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ animation: "era-w-recring 1.2s ease-in-out infinite" }}
            />
          )}

          {/* ── ERA Mark — slightly larger, centered ── */}
          <div className="absolute" style={{ inset: "20%" }}>
            <ERAMark module={mod.mark} size={207} className="!w-full !h-full" />
          </div>

          {/* ── Module data — below the ERA dot ── */}
          <div
            key={modIdx}
            className="absolute pointer-events-none"
            style={{
              bottom: "17%",
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              animation: slideAnim,
              zIndex: 2,
            }}
          >
            {recording ? (
              <RecordingView transcript={transcript} />
            ) : saving ? (
              <SavingView />
            ) : (
              <ModuleData
                mod={mod}
                balance={balance}
                scheduleItems={scheduleItems}
              />
            )}
          </div>

          {/* ── ERA label — top arch position ── */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "8.5%", left: 0, right: 0,
              textAlign: "center",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "3.5px",
              textTransform: "uppercase",
              color: `hsla(${mod.hue},${mod.sat}%,${mod.lum}%,.7)`,
              transition: "--era-hue 3.5s, color 3.5s cubic-bezier(.65,0,.35,1)",
            }}
          >
            ERA
          </div>

          {/* ── Module dot indicators — bottom arch ── */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: "10%", left: 0, right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 5,
              alignItems: "center",
            }}
          >
            {WATCH_MODULES.map((m, i) => (
              <div
                key={m.id}
                style={{
                  width:        i === modIdx ? 14 : 5,
                  height:       5,
                  borderRadius: 3,
                  background:   i === modIdx
                    ? `hsl(${m.hue},${m.sat}%,${m.lum}%)`
                    : "rgba(255,255,255,0.2)",
                  boxShadow:    i === modIdx
                    ? `0 0 8px hsl(${m.hue},${m.sat}%,${m.lum}%)`
                    : "none",
                  transition:   "all .4s cubic-bezier(.25,.46,.45,.94)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function RecordingView({ transcript }: { transcript: string }) {
  // Waveform bars — no emojis, pure geometric
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
      <div style={{ display: "flex", gap: 2.5, alignItems: "center", height: 24 }}>
        {[55, 100, 40, 85, 30, 100, 65, 80, 45].map((_, i) => (
          <div
            key={i}
            style={{
              width: 2.5,
              height: 22,
              borderRadius: 2,
              background: "var(--era-accent)",
              transformOrigin: "center",
              animation: `era-w-wave ${0.5 + (i % 4) * 0.12}s ease-in-out ${i * 65}ms infinite`,
              opacity: 0.85,
            }}
          />
        ))}
      </div>
      {transcript ? (
        <p
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.88)",
            textAlign: "center",
            lineHeight: 1.35,
            fontStyle: "italic",
            margin: 0,
            maxHeight: 36,
            overflow: "hidden",
          }}
        >
          {transcript}
        </p>
      ) : (
        <p
          style={{
            fontSize: 8,
            color: "var(--era-accent)",
            letterSpacing: "2px",
            textTransform: "uppercase",
            margin: 0,
            opacity: 0.75,
          }}
        >
          listening
        </p>
      )}
    </div>
  );
}

function SavingView() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        border: "2px solid var(--era-accent)",
        borderTopColor: "transparent",
        animation: "era-w-spin 0.8s linear infinite",
      }}
    />
  );
}

function ModuleData({
  mod,
  balance,
  scheduleItems,
}: {
  mod: WMod;
  balance?: { balance: number; draft_count?: number };
  scheduleItems: any[];
}) {
  if (mod.id === "chat") {
    // Chat: no data to show — ERA cue handles the visual (expanding rings)
    return null;
  }

  if (mod.id === "budget") {
    const bal  = balance?.balance ?? 0;
    const sign = bal < 0 ? "−" : "";
    return (
      <div style={{ textAlign: "center", lineHeight: 1 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "hsl(var(--era-hue),var(--era-sat),calc(var(--era-lum) + 22%))",
            letterSpacing: "-0.5px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {sign}${Math.abs(bal).toFixed(0)}
        </div>
        {(balance?.draft_count ?? 0) > 0 && (
          <div
            style={{
              marginTop: 4,
              fontSize: 7,
              fontWeight: 600,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.38)",
            }}
          >
            {balance!.draft_count} draft
            {balance!.draft_count !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    );
  }

  if (mod.id === "schedule") {
    const count = scheduleItems.length;
    const next  = scheduleItems[0];
    return (
      <div style={{ textAlign: "center", lineHeight: 1 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "hsl(var(--era-hue),var(--era-sat),calc(var(--era-lum) + 22%))",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 7,
            fontWeight: 600,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.36)",
          }}
        >
          {count === 0 ? "all clear" : count === 1 ? "item" : "items"}
        </div>
        {next?.title && (
          <div
            style={{
              marginTop: 5,
              fontSize: 7.5,
              color: "rgba(255,255,255,0.5)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {next.title}
          </div>
        )}
      </div>
    );
  }

  if (mod.id === "recipe") {
    // Recipe: ERA vapor-curl cue handles the visual — no text needed
    return null;
  }

  return null;
}
