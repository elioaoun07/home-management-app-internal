// src/app/g/[tag]/guest-portal-client.tsx
"use client";

import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUp,
  Bot,
  Check,
  Cigarette,
  CookingPot,
  Download,
  Heart,
  Home,
  Loader2,
  MessageCircle,
  Music,
  PartyPopper,
  Send,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────
interface ChatMessage {
  id: string;
  text: string;
  sender: "guest" | "host";
  timestamp: number;
  guestName?: string;
}

type PortalSection =
  | "home"
  | "wifi"
  | "recipes"
  | "rules"
  | "allergies"
  | "feedback"
  | "download"
  | "chat";

// ─── Particle Background ──────────────────────────────
function PortalParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number;
      y: number;
      r: number;
      dx: number;
      dy: number;
      o: number;
      c: string;
    }[] = [];
    const colors = ["#3b82f6", "#06b6d4", "#14b8a6", "#22d3ee"];
    const count = Math.min(
      60,
      Math.floor((canvas.width * canvas.height) / 20000),
    );

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        o: Math.random() * 0.4 + 0.1,
        c: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = p.o;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.c;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(6,182,212,${0.1 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: "transparent" }}
    />
  );
}

// ─── Jarvis Orb ────────────────────────────────────────
function JarvisOrb({ pulsing = true }: { pulsing?: boolean }) {
  return (
    <div className="relative w-28 h-28 mx-auto">
      {/* outer ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/20",
          pulsing && "animate-ping",
        )}
        style={{ animationDuration: "3s" }}
      />
      {/* spinning ring */}
      <div
        className="absolute inset-2 rounded-full border-2 border-dashed border-[#06b6d4]/30"
        style={{ animation: "spin 10s linear infinite" }}
      />
      {/* glow */}
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#3b82f6]/30 to-[#14b8a6]/30 blur-sm" />
      {/* core */}
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#3b82f6] via-[#06b6d4] to-[#14b8a6] flex items-center justify-center shadow-2xl shadow-[#06b6d4]/40">
        <Bot className="w-10 h-10 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]" />
      </div>
      <Sparkles
        className="absolute -top-1 -right-1 w-5 h-5 text-[#22d3ee] animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <Sparkles
        className="absolute -bottom-1 -left-1 w-4 h-4 text-[#3b82f6] animate-pulse"
        style={{ animationDelay: "600ms" }}
      />
    </div>
  );
}

// ─── Glowing Card ──────────────────────────────────────
function GlowCard({
  children,
  className,
  onClick,
  glow = "cyan",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: "cyan" | "blue" | "teal" | "amber";
}) {
  const glowColors = {
    cyan: "hover:border-[#06b6d4]/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.12)]",
    blue: "hover:border-[#3b82f6]/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.12)]",
    teal: "hover:border-[#14b8a6]/40 hover:shadow-[0_0_30px_rgba(20,184,166,0.12)]",
    amber:
      "hover:border-[#f59e0b]/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.12)]",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl bg-[#0f1d2e]/70 backdrop-blur-xl border border-[#3b82f6]/15 transition-all duration-300",
        glowColors[glow],
        onClick && "cursor-pointer active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Section Nav Button ────────────────────────────────
function NavPill({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[64px] shrink-0",
        active
          ? "bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/20 border border-[#06b6d4]/30 shadow-lg shadow-[#06b6d4]/10"
          : "bg-[#0f1d2e]/40 border border-transparent hover:bg-[#0f1d2e]/70 hover:border-[#3b82f6]/10",
      )}
    >
      <Icon
        className={cn(
          "w-5 h-5 transition-colors duration-300",
          active
            ? "text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
            : "text-[#38bdf8]/50",
        )}
      />
      <span
        className={cn(
          "text-[10px] font-medium transition-colors duration-300",
          active ? "text-[#06b6d4]" : "text-[#38bdf8]/40",
        )}
      >
        {label}
      </span>
      {badge && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-[8px] font-bold flex items-center justify-center text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Typing Indicator ──────────────────────────────────
function TypingAnimation() {
  return (
    <span className="inline-flex gap-1 items-center ml-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
        />
      ))}
    </span>
  );
}

// ─── Wi-Fi Config Card ─────────────────────────────────
function WiFiCard() {
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Wi-Fi network details — change these to your actual values
  const WIFI_SSID = "MyHomeNetwork";
  const WIFI_PASSWORD = "ChangeMe123!";
  const WIFI_TYPE = "WPA"; // WPA, WEP, or nopass

  const wifiUri = `WIFI:T:${WIFI_TYPE};S:${WIFI_SSID};P:${WIFI_PASSWORD};;`;

  const handleConnect = () => {
    setConnecting(true);
    // On Android, opening a wifi: URI can trigger auto-connect
    // On iOS 11+, scanning a QR with the camera auto-joins
    // Best cross-platform: copy password + show SSID
    setTimeout(() => {
      // Try to open wifi settings on Android
      try {
        window.open(wifiUri, "_self");
      } catch {
        // fallback: do nothing, the user will see the password
      }
      setConnecting(false);
    }, 1500);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(WIFI_PASSWORD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = WIFI_PASSWORD;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <GlowCard className="p-5" glow="blue">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/10 flex items-center justify-center">
          <Wifi className="w-6 h-6 text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Wi-Fi Access</h3>
          <p className="text-[10px] text-[#38bdf8]/50">
            Connect to the home network
          </p>
        </div>
      </div>

      {/* SSID */}
      <div className="mb-3 p-3 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10">
        <div className="text-[10px] uppercase tracking-wider text-[#38bdf8]/40 mb-1">
          Network Name
        </div>
        <div className="text-sm font-mono text-[#06b6d4]">{WIFI_SSID}</div>
      </div>

      {/* Password */}
      <div className="mb-4 p-3 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10">
        <div className="text-[10px] uppercase tracking-wider text-[#38bdf8]/40 mb-1">
          Password
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-mono text-[#06b6d4]">
            {WIFI_PASSWORD}
          </div>
          <button
            onClick={copyPassword}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#38bdf8]/70 hover:bg-[#3b82f6]/20 transition-all duration-200"
          >
            {copied ? (
              <span className="flex items-center gap-1 text-[#14b8a6]">
                <Check className="w-3 h-3" /> Copied
              </span>
            ) : (
              "Copy"
            )}
          </button>
        </div>
      </div>

      {/* Connect Button */}
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-sm font-semibold text-white shadow-lg shadow-[#06b6d4]/20 hover:shadow-[#06b6d4]/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {connecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4" />
            Auto Connect
          </>
        )}
      </button>

      <p className="text-[9px] text-[#38bdf8]/30 text-center mt-2">
        Auto-connect works on most Android devices. On iOS, use camera to scan
        the QR code.
      </p>
    </GlowCard>
  );
}

// ─── Rules Card ────────────────────────────────────────
function RulesCard() {
  const dos = [
    {
      icon: Music,
      text: "Feel free to play music — ask Jarvis for playlist recommendations!",
    },
    {
      icon: UtensilsCrossed,
      text: "Help yourself to anything in the fridge — mi casa es su casa 🏠",
    },
    {
      icon: PartyPopper,
      text: "Make yourself at home and enjoy every moment!",
    },
    {
      icon: Heart,
      text: "Leave good vibes only — positive energy is always welcome ✨",
    },
  ];

  const donts = [
    {
      icon: Cigarette,
      text: "No smoking inside the house — balcony is available for that 🚬",
    },
  ];

  return (
    <GlowCard className="p-5" glow="teal">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#14b8a6]/20 to-[#06b6d4]/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-[#14b8a6] drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">House Guidelines</h3>
          <p className="text-[10px] text-[#38bdf8]/50">A few friendly notes</p>
        </div>
      </div>

      {/* Do's */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wider text-[#14b8a6] font-semibold mb-2 flex items-center gap-1.5">
          <Check className="w-3 h-3" /> Please Do
        </div>
        <div className="space-y-2">
          {dos.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#14b8a6]/5 border border-[#14b8a6]/10"
            >
              <item.icon className="w-4 h-4 text-[#14b8a6] mt-0.5 shrink-0" />
              <span className="text-xs text-[#38bdf8]/80 leading-relaxed">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Don'ts */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> Please Don&apos;t
        </div>
        <div className="space-y-2">
          {donts.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10"
            >
              <item.icon className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <span className="text-xs text-[#38bdf8]/80 leading-relaxed">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}

// ─── Allergies Card ────────────────────────────────────
function AllergiesCard() {
  const [allergies, setAllergies] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [guestName, setGuestName] = useState("");

  const handleSubmit = () => {
    if (!allergies.trim()) return;
    // Store in localStorage for persistence
    const key = "jarvis_guest_allergies";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push({
      name: guestName || "Anonymous Guest",
      allergies: allergies.trim(),
      timestamp: Date.now(),
    });
    localStorage.setItem(key, JSON.stringify(existing));
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setAllergies("");
    }, 3000);
  };

  return (
    <GlowCard className="p-5" glow="amber">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            Allergies & Dietary
          </h3>
          <p className="text-[10px] text-[#38bdf8]/50">
            Let us know so we can take care of you
          </p>
        </div>
      </div>

      <div className="mb-3">
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full px-3 py-2.5 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10 text-sm text-white placeholder:text-[#38bdf8]/30 focus:outline-none focus:border-[#06b6d4]/40 focus:ring-1 focus:ring-[#06b6d4]/20 transition-all duration-200"
        />
      </div>

      <textarea
        value={allergies}
        onChange={(e) => setAllergies(e.target.value)}
        placeholder="e.g. Peanuts, Lactose, Gluten-free..."
        rows={3}
        className="w-full px-3 py-2.5 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10 text-sm text-white placeholder:text-[#38bdf8]/30 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all duration-200 resize-none mb-3"
      />

      <button
        onClick={handleSubmit}
        disabled={!allergies.trim() || submitted}
        className={cn(
          "w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2",
          submitted
            ? "bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/30"
            : "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40",
        )}
      >
        {submitted ? (
          <>
            <Check className="w-4 h-4" /> Noted! Thank you
          </>
        ) : (
          "Submit Allergies"
        )}
      </button>
    </GlowCard>
  );
}

// ─── Feedback Card ─────────────────────────────────────
function FeedbackCard() {
  const [feedback, setFeedback] = useState("");
  const [type, setType] = useState<"suggestion" | "complaint">("suggestion");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!feedback.trim()) return;
    const key = "jarvis_guest_feedback";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push({
      type,
      text: feedback.trim(),
      timestamp: Date.now(),
    });
    localStorage.setItem(key, JSON.stringify(existing));
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFeedback("");
    }, 3000);
  };

  return (
    <GlowCard className="p-5" glow="blue">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-violet-500/10 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-[#3b82f6] drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            Suggestions & Feedback
          </h3>
          <p className="text-[10px] text-[#38bdf8]/50">
            Your opinion matters to us
          </p>
        </div>
      </div>

      {/* Type Toggle */}
      <div className="flex gap-2 mb-3">
        {(["suggestion", "complaint"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-medium transition-all duration-200 border",
              type === t
                ? t === "suggestion"
                  ? "bg-[#3b82f6]/15 border-[#3b82f6]/30 text-[#3b82f6]"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-[#0a1628]/40 border-transparent text-[#38bdf8]/40 hover:bg-[#0a1628]/60",
            )}
          >
            {t === "suggestion" ? "💡 Suggestion" : "📝 Complaint"}
          </button>
        ))}
      </div>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={
          type === "suggestion"
            ? "How can we make your stay better?"
            : "Let us know what went wrong — we'll fix it!"
        }
        rows={3}
        className="w-full px-3 py-2.5 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10 text-sm text-white placeholder:text-[#38bdf8]/30 focus:outline-none focus:border-[#3b82f6]/40 focus:ring-1 focus:ring-[#3b82f6]/20 transition-all duration-200 resize-none mb-3"
      />

      <button
        onClick={handleSubmit}
        disabled={!feedback.trim() || submitted}
        className={cn(
          "w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2",
          submitted
            ? "bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/30"
            : "bg-gradient-to-r from-[#3b82f6] to-violet-500 text-white shadow-lg shadow-[#3b82f6]/20 hover:shadow-[#3b82f6]/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40",
        )}
      >
        {submitted ? (
          <>
            <Check className="w-4 h-4" /> Received! Thank you
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit {type === "suggestion" ? "Suggestion" : "Complaint"}
          </>
        )}
      </button>
    </GlowCard>
  );
}

// ─── Recipes Card ──────────────────────────────────────
function RecipesCard() {
  return (
    <GlowCard className="p-5" glow="teal">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#14b8a6]/20 to-[#06b6d4]/10 flex items-center justify-center">
          <CookingPot className="w-6 h-6 text-[#14b8a6] drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">House Recipes</h3>
          <p className="text-[10px] text-[#38bdf8]/50">
            Our favorite dishes for you to try
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-16 h-16 rounded-full bg-[#14b8a6]/10 flex items-center justify-center mb-4 animate-pulse">
          <CookingPot className="w-8 h-8 text-[#14b8a6]/50" />
        </div>
        <p className="text-sm font-medium text-[#38bdf8]/60 mb-1">
          Coming Soon
        </p>
        <p className="text-[11px] text-[#38bdf8]/30 text-center max-w-[200px]">
          Jarvis is compiling the best recipes from this household. Stay tuned!
        </p>
        <div className="mt-4 px-4 py-2 rounded-xl bg-[#14b8a6]/5 border border-[#14b8a6]/10">
          <div className="flex items-center gap-2 text-[#14b8a6]/70 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            In Progress…
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

// ─── Download App Card ─────────────────────────────────
function DownloadCard() {
  return (
    <GlowCard className="p-5" glow="blue">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/10 flex items-center justify-center">
          <Download className="w-6 h-6 text-[#3b82f6] drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Download Our App</h3>
          <p className="text-[10px] text-[#38bdf8]/50">Join the ecosystem</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3b82f6]/10 to-[#06b6d4]/10 flex items-center justify-center mb-4 border border-[#3b82f6]/10">
          <Download className="w-8 h-8 text-[#3b82f6]/40" />
        </div>
        <p className="text-sm font-medium text-[#38bdf8]/60 mb-1">
          Coming Soon
        </p>
        <p className="text-[11px] text-[#38bdf8]/30 text-center max-w-[200px]">
          The Jarvis Home Manager app will be available for download soon.
        </p>
        <div className="mt-4 px-4 py-2 rounded-xl bg-[#3b82f6]/5 border border-[#3b82f6]/10">
          <div className="flex items-center gap-2 text-[#3b82f6]/70 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            In Progress…
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

// ─── Chat Interface ────────────────────────────────────
function ChatInterface({ tag }: { tag: string }) {
  const STORAGE_KEY = `jarvis_chat_${tag}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [guestName, setGuestName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
    const storedName = localStorage.getItem(`jarvis_guest_name_${tag}`);
    if (storedName) {
      setGuestName(storedName);
      setNameSet(true);
    }
  }, [STORAGE_KEY, tag]);

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages, STORAGE_KEY]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Poll for new messages (simulate real-time from host via localStorage)
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ChatMessage[];
          if (parsed.length !== messages.length) {
            setMessages(parsed);
          }
        } catch {
          /* ignore */
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [STORAGE_KEY, messages.length]);

  const setName = () => {
    if (!guestName.trim()) return;
    localStorage.setItem(`jarvis_guest_name_${tag}`, guestName.trim());
    setNameSet(true);

    // Add a welcome message from Jarvis
    const welcomeMsg: ChatMessage = {
      id: crypto.randomUUID(),
      text: `Welcome, ${guestName.trim()}! 👋 I'm Jarvis, your host's personal AI assistant. Feel free to ask me anything or leave a message for your host. They'll see it in real-time!`,
      sender: "host",
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      text: input.trim(),
      sender: "guest",
      timestamp: Date.now(),
      guestName: guestName || "Guest",
    };
    setMessages((prev) => [...prev, msg]);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (nameSet) sendMessage();
      else setName();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!nameSet) {
    return (
      <GlowCard className="p-5" glow="cyan">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#06b6d4]/20 to-[#3b82f6]/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Live Chat</h3>
            <p className="text-[10px] text-[#38bdf8]/50">
              Chat with your host in real-time
            </p>
          </div>
        </div>

        <div className="text-center py-6">
          <Bot className="w-12 h-12 mx-auto mb-3 text-[#06b6d4] drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
          <p className="text-sm text-[#38bdf8]/70 mb-4">
            Enter your name to start chatting
          </p>
          <div className="flex gap-2">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your name"
              className="flex-1 px-3 py-2.5 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10 text-sm text-white placeholder:text-[#38bdf8]/30 focus:outline-none focus:border-[#06b6d4]/40 focus:ring-1 focus:ring-[#06b6d4]/20 transition-all duration-200"
              autoFocus
            />
            <button
              onClick={setName}
              disabled={!guestName.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-sm font-semibold text-white shadow-lg shadow-[#06b6d4]/20 hover:shadow-[#06b6d4]/40 transition-all duration-300 disabled:opacity-40"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </GlowCard>
    );
  }

  return (
    <GlowCard className="flex flex-col" glow="cyan">
      {/* Header */}
      <div className="p-4 border-b border-[#3b82f6]/10 flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#14b8a6] border-2 border-[#0f1d2e]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            Jarvis Home Chat
          </h3>
          <div className="flex items-center gap-1 text-[10px] text-[#14b8a6]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] animate-pulse" />
            Online — Chatting as {guestName}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[350px] min-h-[200px] scrollbar-hide"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.sender === "guest" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed",
                msg.sender === "guest"
                  ? "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white rounded-br-md"
                  : "bg-[#0f1d2e] border border-[#3b82f6]/10 text-[#38bdf8]/90 rounded-bl-md",
              )}
            >
              <p>{msg.text}</p>
              <p
                className={cn(
                  "text-[9px] mt-1",
                  msg.sender === "guest"
                    ? "text-white/50 text-right"
                    : "text-[#38bdf8]/30",
                )}
              >
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#3b82f6]/10">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10 text-sm text-white placeholder:text-[#38bdf8]/30 focus:outline-none focus:border-[#06b6d4]/30 transition-all duration-200"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white shadow-lg shadow-[#06b6d4]/20 hover:shadow-[#06b6d4]/40 transition-all duration-300 disabled:opacity-30 disabled:shadow-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </GlowCard>
  );
}

// ═══════════════════════════════════════════════════════
// ─── MAIN PORTAL COMPONENT ────────────────────────────
// ═══════════════════════════════════════════════════════
export default function GuestPortalClient({ tag }: { tag: string }) {
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<PortalSection>("home");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const navItems: {
    id: PortalSection;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }[] = useMemo(
    () => [
      { id: "home", icon: Home, label: "Home" },
      { id: "wifi", icon: Wifi, label: "Wi-Fi" },
      { id: "rules", icon: ShieldCheck, label: "Rules" },
      { id: "allergies", icon: AlertTriangle, label: "Allergies" },
      { id: "recipes", icon: CookingPot, label: "Recipes" },
      { id: "feedback", icon: MessageCircle, label: "Feedback" },
      { id: "chat", icon: Bot, label: "Chat" },
      { id: "download", icon: Download, label: "App" },
    ],
    [],
  );

  const greetingText = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1628] relative">
      {/* Particles */}
      {mounted && <PortalParticles />}

      {/* Gradient blobs */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#3b82f6]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#06b6d4]/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#14b8a6]/5 rounded-full blur-[150px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-lg mx-auto px-4 pb-28">
        {/* ── HERO SECTION ──────────────────────────── */}
        <section className="pt-12 pb-6 text-center">
          {/* Jarvis Orb */}
          <div
            className={cn(
              "transition-all duration-1000",
              mounted
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-10 scale-90",
            )}
          >
            <JarvisOrb />
          </div>

          {/* Greeting */}
          <div
            className={cn(
              "mt-6 transition-all duration-1000 delay-200",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
            )}
          >
            <p className="text-[#38bdf8]/50 text-xs uppercase tracking-[0.2em] mb-1">
              Jarvis Home Portal
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              <span className="text-white">{greetingText()},</span>
              <br />
              <span className="bg-gradient-to-r from-[#3b82f6] via-[#06b6d4] to-[#14b8a6] bg-clip-text text-transparent">
                Welcome Home
              </span>
            </h1>
            <p className="text-[#38bdf8]/50 text-sm max-w-xs mx-auto leading-relaxed">
              Make yourself comfortable. Jarvis is here to assist you with
              anything you need during your stay.
            </p>
          </div>

          {/* Animated status bar */}
          <div
            className={cn(
              "mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0f1d2e]/80 backdrop-blur border border-[#3b82f6]/15 transition-all duration-1000 delay-400",
              mounted ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="w-2 h-2 rounded-full bg-[#14b8a6] animate-pulse" />
            <span className="text-[11px] text-[#38bdf8]/60">
              Jarvis AI Assistant is online
            </span>
            <TypingAnimation />
          </div>
        </section>

        {/* ── NAVIGATION PILLS ──────────────────────── */}
        <nav
          className={cn(
            "mb-6 transition-all duration-1000 delay-500",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1 px-0.5">
            {navItems.map((item) => (
              <NavPill
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeSection === item.id}
                onClick={() => setActiveSection(item.id)}
              />
            ))}
          </div>
        </nav>

        {/* ── CONTENT SECTIONS ──────────────────────── */}
        <div
          className={cn(
            "space-y-4 transition-all duration-700 delay-600",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          {/* Home */}
          {activeSection === "home" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <GlowCard
                  className="p-4 text-center"
                  glow="blue"
                  onClick={() => setActiveSection("wifi")}
                >
                  <Wifi className="w-7 h-7 mx-auto mb-2 text-[#06b6d4] drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
                  <p className="text-xs font-medium text-white">Connect WiFi</p>
                  <p className="text-[9px] text-[#38bdf8]/40 mt-0.5">
                    Auto-join network
                  </p>
                </GlowCard>

                <GlowCard
                  className="p-4 text-center"
                  glow="teal"
                  onClick={() => setActiveSection("rules")}
                >
                  <ShieldCheck className="w-7 h-7 mx-auto mb-2 text-[#14b8a6] drop-shadow-[0_0_10px_rgba(20,184,166,0.4)]" />
                  <p className="text-xs font-medium text-white">House Rules</p>
                  <p className="text-[9px] text-[#38bdf8]/40 mt-0.5">
                    Dos & Don&apos;ts
                  </p>
                </GlowCard>

                <GlowCard
                  className="p-4 text-center"
                  glow="amber"
                  onClick={() => setActiveSection("allergies")}
                >
                  <AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
                  <p className="text-xs font-medium text-white">Allergies</p>
                  <p className="text-[9px] text-[#38bdf8]/40 mt-0.5">
                    Tell us yours
                  </p>
                </GlowCard>

                <GlowCard
                  className="p-4 text-center"
                  glow="cyan"
                  onClick={() => setActiveSection("chat")}
                >
                  <Bot className="w-7 h-7 mx-auto mb-2 text-[#22d3ee] drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]" />
                  <p className="text-xs font-medium text-white">Live Chat</p>
                  <p className="text-[9px] text-[#38bdf8]/40 mt-0.5">
                    Talk to host
                  </p>
                </GlowCard>
              </div>

              {/* Additional quick links */}
              <div className="grid grid-cols-3 gap-2">
                <GlowCard
                  className="p-3 text-center"
                  glow="teal"
                  onClick={() => setActiveSection("recipes")}
                >
                  <CookingPot className="w-5 h-5 mx-auto mb-1.5 text-[#14b8a6]" />
                  <p className="text-[10px] font-medium text-[#38bdf8]/70">
                    Recipes
                  </p>
                </GlowCard>

                <GlowCard
                  className="p-3 text-center"
                  glow="blue"
                  onClick={() => setActiveSection("feedback")}
                >
                  <MessageCircle className="w-5 h-5 mx-auto mb-1.5 text-[#3b82f6]" />
                  <p className="text-[10px] font-medium text-[#38bdf8]/70">
                    Feedback
                  </p>
                </GlowCard>

                <GlowCard
                  className="p-3 text-center"
                  glow="blue"
                  onClick={() => setActiveSection("download")}
                >
                  <Download className="w-5 h-5 mx-auto mb-1.5 text-[#3b82f6]" />
                  <p className="text-[10px] font-medium text-[#38bdf8]/70">
                    Get App
                  </p>
                </GlowCard>
              </div>

              {/* Featured info */}
              <GlowCard className="p-4" glow="cyan">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">
                      Powered by Jarvis AI
                    </p>
                    <p className="text-[10px] text-[#38bdf8]/40 leading-relaxed">
                      Your host&apos;s personal ecosystem — intelligent home
                      management, automation, and beyond.
                    </p>
                  </div>
                </div>
              </GlowCard>
            </div>
          )}

          {/* Wi-Fi */}
          {activeSection === "wifi" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <WiFiCard />
            </div>
          )}

          {/* Rules */}
          {activeSection === "rules" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <RulesCard />
            </div>
          )}

          {/* Allergies */}
          {activeSection === "allergies" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AllergiesCard />
            </div>
          )}

          {/* Recipes */}
          {activeSection === "recipes" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <RecipesCard />
            </div>
          )}

          {/* Feedback */}
          {activeSection === "feedback" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <FeedbackCard />
            </div>
          )}

          {/* Chat */}
          {activeSection === "chat" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ChatInterface tag={tag} />
            </div>
          )}

          {/* Download */}
          {activeSection === "download" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <DownloadCard />
            </div>
          )}
        </div>

        {/* ── FOOTER ────────────────────────────────── */}
        <footer className="mt-12 pb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center">
              <Home className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-[#38bdf8]/60">
              Jarvis Home Portal
            </span>
          </div>
          <p className="text-[10px] text-[#38bdf8]/25">
            Part of the Home Manager Ecosystem • {new Date().getFullYear()}
          </p>
        </footer>
      </div>

      {/* ── SCROLL TO TOP ───────────────────────────── */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] flex items-center justify-center shadow-lg shadow-[#06b6d4]/30 hover:shadow-[#06b6d4]/50 transition-all duration-300 hover:scale-110 animate-in fade-in zoom-in duration-300"
        >
          <ArrowUp className="w-4 h-4 text-white" />
        </button>
      )}

      {/* ── CSS ANIMATIONS ──────────────────────────── */}
      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-15px) rotate(3deg);
          }
        }

        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes blob {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .animate-blob {
          animation: blob 12s ease-in-out infinite;
        }

        .animate-gradient {
          animation: gradient 6s ease infinite;
        }

        /* Smooth entrance animations */
        .animate-in {
          animation-fill-mode: both;
        }
      `}</style>
    </div>
  );
}
