// src/app/g/[tag]/guest-portal-client.tsx
"use client";

import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUp,
  BadgeCheck,
  Bed,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  Cigarette,
  ClipboardCopy,
  CookingPot,
  Download,
  Heart,
  HelpCircle,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Music,
  PartyPopper,
  Pencil,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────
interface ChatMessage {
  id: string;
  message: string;
  sender: "guest" | "host" | "bot";
  guest_name?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface GuestSession {
  id: string;
  tag_id: string;
  guest_name: string | null;
  fingerprint: string;
  created_at: string;
}

interface TagInfo {
  id: string;
  slug: string;
  label: string;
  destination: string;
  wifi_ssid: string | null;
  has_wifi_password: boolean;
  bio_data: Record<string, unknown>;
}

interface AllergyRecord {
  id: string;
  allergies: string;
  guest_name: string | null;
  updated_at: string;
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

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  intent: string;
  query?: string;
}

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
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/20",
          pulsing && "animate-ping",
        )}
        style={{ animationDuration: "3s" }}
      />
      <div
        className="absolute inset-2 rounded-full border-2 border-dashed border-[#06b6d4]/30"
        style={{ animation: "spin 10s linear infinite" }}
      />
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#3b82f6]/30 to-[#14b8a6]/30 blur-sm" />
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
function WiFiCard({
  tagInfo,
  sessionId,
}: {
  tagInfo: TagInfo | null;
  sessionId: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const ssid = tagInfo?.wifi_ssid;
  const hasPassword = tagInfo?.has_wifi_password;

  const copyPassword = async () => {
    if (!tagInfo?.id || !sessionId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/guest-portal/wifi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tagInfo.id, session_id: sessionId }),
      });
      if (res.ok) {
        const { password } = await res.json();
        await navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // Fallback - can't copy
    } finally {
      setLoading(false);
    }
  };

  if (!ssid) {
    return (
      <GlowCard className="p-5" glow="blue">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/10 flex items-center justify-center">
            <Wifi className="w-6 h-6 text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Wi-Fi Access</h3>
            <p className="text-[10px] text-[#38bdf8]/50">Not configured yet</p>
          </div>
        </div>
        <p className="text-xs text-[#38bdf8]/40 text-center py-4">
          Ask your host for the WiFi credentials.
        </p>
      </GlowCard>
    );
  }

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
        <div className="text-sm font-mono text-[#06b6d4]">{ssid}</div>
      </div>

      {/* Password — hidden, copy-only */}
      {hasPassword && (
        <div className="mb-4 p-3 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10">
          <div className="text-[10px] uppercase tracking-wider text-[#38bdf8]/40 mb-1">
            Password
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[#38bdf8]/50">
              <Lock className="w-3.5 h-3.5" />
              <span className="font-mono tracking-widest">••••••••••</span>
            </div>
          </div>
        </div>
      )}

      {/* Copy Password Button */}
      {hasPassword && (
        <button
          onClick={copyPassword}
          disabled={loading || copied}
          className={cn(
            "w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2",
            copied
              ? "bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/30"
              : "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white shadow-lg shadow-[#06b6d4]/20 hover:shadow-[#06b6d4]/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60",
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : copied ? (
            <>
              <Check className="w-4 h-4" />
              Password Copied!
            </>
          ) : (
            <>
              <ClipboardCopy className="w-4 h-4" />
              Copy Password to Clipboard
            </>
          )}
        </button>
      )}

      <p className="text-[9px] text-[#38bdf8]/30 text-center mt-2">
        Open your phone&apos;s WiFi settings, select &quot;{ssid}&quot;, and
        paste the password.
      </p>
    </GlowCard>
  );
}

// ─── Rules Card ────────────────────────────────────────
function RulesCard({ bioData }: { bioData?: Record<string, unknown> }) {
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

  // Add extra rules from bio_data if present
  const extraRules = bioData?.house_rules_extra;
  const extraRulesList: string[] = Array.isArray(extraRules) ? extraRules : [];

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

      {/* Extra rules from bio */}
      {extraRulesList.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-[#38bdf8]/40 font-semibold mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3 h-3" /> Additional Notes
          </div>
          <div className="space-y-2">
            {extraRulesList.map((rule, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#3b82f6]/5 border border-[#3b82f6]/10"
              >
                <span className="text-xs text-[#38bdf8]/80 leading-relaxed">
                  {rule}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlowCard>
  );
}

// ─── Allergies Card (view/edit) ────────────────────────
function AllergiesCard({
  tagInfo,
  session,
  onNameSet,
}: {
  tagInfo: TagInfo | null;
  session: GuestSession | null;
  onNameSet?: (name: string) => void;
}) {
  const [allergies, setAllergies] = useState("");
  const [guestName, setGuestName] = useState(session?.guest_name || "");
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [existing, setExisting] = useState<AllergyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep guestName in sync with session changes from other modules
  useEffect(() => {
    if (session?.guest_name && !guestName) {
      setGuestName(session.guest_name);
    }
  }, [session?.guest_name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing allergy record
  useEffect(() => {
    if (!session?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/guest-portal/allergies?session_id=${session.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.allergy) {
          setExisting(data.allergy);
          setAllergies(data.allergy.allergies);
          setGuestName(data.allergy.guest_name || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.id]);

  const handleSubmit = async () => {
    if (!allergies.trim() || !tagInfo?.id || !session?.id) return;
    setSubmitted(true);
    try {
      const res = await fetch("/api/guest-portal/allergies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag_id: tagInfo.id,
          session_id: session.id,
          guest_name: guestName || session.guest_name,
          allergies: allergies.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExisting(data.allergy);
        setEditing(false);
        // Propagate guest name to other modules (chat, etc.)
        if (guestName.trim() && onNameSet) {
          onNameSet(guestName.trim());
        }
      }
    } catch {
      /* ignore */
    }
    setTimeout(() => setSubmitted(false), 2000);
  };

  if (loading) {
    return (
      <GlowCard className="p-5" glow="amber">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        </div>
      </GlowCard>
    );
  }

  // View mode — already submitted
  if (existing && !editing) {
    return (
      <GlowCard className="p-5" glow="amber">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center">
            <BadgeCheck className="w-6 h-6 text-[#14b8a6] drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">
              Allergies Submitted
            </h3>
            <p className="text-[10px] text-[#14b8a6]">
              Your host has been notified
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="p-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 hover:bg-[#3b82f6]/20 transition-all"
          >
            <Pencil className="w-3.5 h-3.5 text-[#38bdf8]/60" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-[#0a1628]/60 border border-[#14b8a6]/15">
          {existing.guest_name && (
            <p className="text-[10px] text-[#38bdf8]/40 mb-1">
              {existing.guest_name}
            </p>
          )}
          <p className="text-sm text-[#38bdf8]/80">{existing.allergies}</p>
        </div>
      </GlowCard>
    );
  }

  // Edit/Create mode
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

      <div className="flex gap-2">
        {editing && (
          <button
            onClick={() => {
              setEditing(false);
              setAllergies(existing?.allergies || "");
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#0a1628]/60 border border-[#3b82f6]/10 text-[#38bdf8]/50 hover:bg-[#0a1628]/80 transition-all"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!allergies.trim() || submitted}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2",
            submitted
              ? "bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/30"
              : "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40",
          )}
        >
          {submitted ? (
            <>
              <Check className="w-4 h-4" /> Noted! Thank you
            </>
          ) : editing ? (
            "Update Allergies"
          ) : (
            "Submit Allergies"
          )}
        </button>
      </div>
    </GlowCard>
  );
}

// ─── Feedback Card (anonymous) ─────────────────────────
function FeedbackCard({ tagInfo }: { tagInfo: TagInfo | null }) {
  const [feedback, setFeedback] = useState("");
  const [type, setType] = useState<"suggestion" | "complaint">("suggestion");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim() || !tagInfo?.id) return;
    setSubmitted(true);
    try {
      await fetch("/api/guest-portal/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag_id: tagInfo.id,
          feedback_type: type,
          message: feedback.trim(),
        }),
      });
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      setSubmitted(false);
      setFeedback("");
    }, 3000);
  };

  return (
    <GlowCard className="p-5" glow="blue">
      <div className="flex items-center gap-3 mb-3">
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

      {/* Anonymous badge */}
      <div className="mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14b8a6]/5 border border-[#14b8a6]/10 w-fit">
        <ShieldAlert className="w-3 h-3 text-[#14b8a6]" />
        <span className="text-[10px] text-[#14b8a6] font-medium">
          🔒 100% Anonymous — your identity is never attached
        </span>
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
        <p className="text-[10px] text-[#06b6d4]/40 mt-2">
          💡 Ask Jarvis in the chat for today&apos;s menu or recipe list!
        </p>
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
      </div>
    </GlowCard>
  );
}

// ─── Chat Interface with Bot ───────────────────────────
function ChatInterface({
  tagInfo,
  session,
  onNameSet,
}: {
  tag: string;
  tagInfo: TagInfo | null;
  session: GuestSession | null;
  onNameSet: (name: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [guestName, setGuestName] = useState(session?.guest_name || "");
  const [nameSet, setNameSet] = useState(!!session?.guest_name);
  const [botTyping, setBotTyping] = useState(false);
  const [typingText, setTypingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastFetchRef = useRef<string>("");

  // Sync guest name from other modules (e.g. Allergies)
  useEffect(() => {
    if (session?.guest_name && !nameSet) {
      setGuestName(session.guest_name);
      setNameSet(true);
    }
  }, [session?.guest_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const quickActions: QuickAction[] = useMemo(
    () => [
      { label: "🛏️ Bedtime?", icon: Bed, intent: "bedtime" },
      { label: "🍽️ Today's menu", icon: UtensilsCrossed, intent: "menu" },
      { label: "📅 Schedule", icon: CalendarDays, intent: "schedule" },
      {
        label: "⚠️ Allergy check",
        icon: Search,
        intent: "allergy_check",
        query: "",
      },
      { label: "📶 WiFi help", icon: Wifi, intent: "wifi_help" },
      { label: "📋 House rules", icon: ShieldCheck, intent: "house_rules" },
      { label: "📖 Recipes", icon: CookingPot, intent: "recipes_list" },
    ],
    [],
  );

  // Load messages on mount
  useEffect(() => {
    if (!session?.id || !tagInfo?.id) return;
    fetch(
      `/api/guest-portal/chat?session_id=${session.id}&tag_id=${tagInfo.id}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.messages?.length) {
          setMessages(data.messages);
          lastFetchRef.current =
            data.messages[data.messages.length - 1].created_at;
          // If there are messages, the name was already set
          if (
            !nameSet &&
            data.messages.some((m: ChatMessage) => m.sender === "guest")
          ) {
            setNameSet(true);
          }
        }
      })
      .catch(() => {});
  }, [session?.id, tagInfo?.id, nameSet]);

  // Poll for new messages (host replies)
  useEffect(() => {
    if (!session?.id || !tagInfo?.id || !nameSet) return;

    pollRef.current = setInterval(async () => {
      try {
        const afterParam = lastFetchRef.current
          ? `&after=${encodeURIComponent(lastFetchRef.current)}`
          : "";
        const res = await fetch(
          `/api/guest-portal/chat?session_id=${session.id}&tag_id=${tagInfo.id}${afterParam}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newMsgs = data.messages.filter(
                (m: ChatMessage) => !existingIds.has(m.id),
              );
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
            });
            lastFetchRef.current =
              data.messages[data.messages.length - 1].created_at;
          }
        }
      } catch {
        /* ignore */
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session?.id, tagInfo?.id, nameSet]);

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  }, [messages, botTyping]);

  const sendMessageToAPI = useCallback(
    async (text: string, metadata?: Record<string, unknown>) => {
      if (!tagInfo?.id || !session?.id) return;
      try {
        const res = await fetch("/api/guest-portal/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tag_id: tagInfo.id,
            session_id: session.id,
            message: text,
            sender: "guest",
            guest_name: guestName || session.guest_name || "Guest",
            metadata,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [...prev, data.message]);
          lastFetchRef.current = data.message.created_at;
        }
      } catch {
        /* ignore */
      }
    },
    [tagInfo?.id, session?.id, guestName, session?.guest_name],
  );

  const askBot = useCallback(
    async (intent: string, query?: string) => {
      if (!tagInfo?.id) return;
      setBotTyping(true);
      try {
        const res = await fetch("/api/guest-portal/bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag_id: tagInfo.id, intent, query }),
        });
        if (res.ok) {
          const data = await res.json();
          // Save bot message to DB
          if (session?.id) {
            const botRes = await fetch("/api/guest-portal/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tag_id: tagInfo.id,
                session_id: session.id,
                message: data.response,
                sender: "bot",
                metadata: { intent },
              }),
            });
            if (botRes.ok) {
              const botData = await botRes.json();
              setMessages((prev) => [...prev, botData.message]);
              lastFetchRef.current = botData.message.created_at;
            }
          }
        }
      } catch {
        /* ignore */
      } finally {
        setBotTyping(false);
      }
    },
    [tagInfo?.id, session?.id],
  );

  // Typing animation for quick actions
  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      // If allergy check, we need to ask for the ingredient
      if (action.intent === "allergy_check") {
        const question = "Does the food contain ";
        setTypingText("");
        let typed = "";
        for (const char of question) {
          typed += char;
          setTypingText(typed);
          await new Promise((r) => setTimeout(r, 30));
        }
        setInput(typed);
        setTypingText("");
        inputRef.current?.focus();
        return;
      }

      const questionMap: Record<string, string> = {
        bedtime: "What time do we sleep?",
        menu: "What's on the menu today?",
        schedule: "What's the schedule for today?",
        wifi_help: "How do I connect to WiFi?",
        house_rules: "What are the house rules?",
        recipes_list: "What recipes do you have?",
        greeting: "Hello!",
      };

      const text = questionMap[action.intent] || action.label;

      // Animate typing on the input
      setTypingText("");
      let typed = "";
      for (const char of text) {
        typed += char;
        setTypingText(typed);
        await new Promise((r) => setTimeout(r, 25));
      }
      setTypingText("");
      setInput("");

      // Send as guest message
      await sendMessageToAPI(text, { quick_action: action.intent });

      // Get bot response
      await askBot(action.intent, action.query);
    },
    [sendMessageToAPI, askBot],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");

    // Check if it looks like an allergy check
    const lower = text.toLowerCase();
    if (
      lower.includes("contain") ||
      lower.includes("allerg") ||
      lower.includes("ingredient")
    ) {
      const words = lower
        .replace(
          /does|the|food|has|have|contain|contains|any|is|there|in|it|today/g,
          "",
        )
        .trim();
      await sendMessageToAPI(text, { quick_action: "allergy_check" });
      await askBot("allergy_check", words);
      return;
    }

    // Send to DB (notifies host via push)
    await sendMessageToAPI(text);

    // Try bot for known intents via freeform
    await askBot("freeform", text);
  }, [input, sendMessageToAPI, askBot]);

  const setName = useCallback(async () => {
    if (!guestName.trim()) return;
    setNameSet(true);
    onNameSet(guestName.trim());

    // Get greeting from bot
    await askBot("greeting");
  }, [guestName, onNameSet, askBot]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (nameSet) sendMessage();
      else setName();
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!nameSet) {
    return (
      <GlowCard className="p-5" glow="cyan">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#06b6d4]/20 to-[#3b82f6]/10 flex items-center justify-center">
            <Bot className="w-6 h-6 text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Jarvis Assistant
            </h3>
            <p className="text-[10px] text-[#38bdf8]/50">
              Chat with your host&apos;s AI assistant
            </p>
          </div>
        </div>

        <div className="text-center py-6">
          <Bot className="w-12 h-12 mx-auto mb-3 text-[#06b6d4] drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
          <p className="text-sm text-white font-medium mb-1">
            Hi! I&apos;m Jarvis 👋
          </p>
          <p className="text-xs text-[#38bdf8]/50 mb-4">
            Your host&apos;s personal AI assistant. What&apos;s your name?
          </p>
          <div className="flex gap-2">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name"
              className="flex-1 px-3 py-2.5 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10 text-sm text-white placeholder:text-[#38bdf8]/30 focus:outline-none focus:border-[#06b6d4]/40 focus:ring-1 focus:ring-[#06b6d4]/20 transition-all duration-200"
              autoFocus
            />
            <button
              onClick={setName}
              disabled={!guestName.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-sm font-semibold text-white shadow-lg shadow-[#06b6d4]/20 hover:shadow-[#06b6d4]/40 transition-all duration-300 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
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
            Online — Chatting as {guestName || session?.guest_name}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[60dvh] min-h-[200px] scrollbar-hide"
      >
        {/* Show quick actions prompt when no messages yet */}
        {messages.length === 0 && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-[#0f1d2e] border border-[#06b6d4]/15 text-sm leading-relaxed text-[#38bdf8]/90">
              <p className="text-[9px] font-semibold mb-0.5 text-[#06b6d4]/60">
                🤖 Jarvis
              </p>
              <div className="whitespace-pre-wrap">
                Hey {guestName || session?.guest_name}! 👋 How can I help? Tap any option below or type your own question.
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {quickActions.map((action) => (
                  <button
                    key={action.intent}
                    onClick={() => handleQuickAction(action)}
                    disabled={botTyping}
                    className="px-2.5 py-1 rounded-lg bg-[#06b6d4]/10 border border-[#06b6d4]/20 text-[10px] font-medium text-[#06b6d4] hover:bg-[#06b6d4]/20 hover:border-[#06b6d4]/30 transition-all duration-200 disabled:opacity-30"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          // Show quick actions on the last bot message in the conversation
          const isLastBotMsg =
            msg.sender === "bot" &&
            !messages.slice(idx + 1).some((m) => m.sender === "bot");

          return (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.sender === "guest" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed",
                  msg.sender === "guest"
                    ? "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white rounded-br-md"
                    : msg.sender === "bot"
                      ? "bg-[#0f1d2e] border border-[#06b6d4]/15 text-[#38bdf8]/90 rounded-bl-md"
                      : "bg-[#0f1d2e] border border-[#3b82f6]/15 text-[#38bdf8]/90 rounded-bl-md",
                )}
              >
                {msg.sender !== "guest" && (
                  <p className="text-[9px] font-semibold mb-0.5 text-[#06b6d4]/60">
                    {msg.sender === "bot" ? "🤖 Jarvis" : "🏠 Host"}
                  </p>
                )}
                {/* Render markdown bold */}
                <div className="whitespace-pre-wrap">
                  {(msg.message.split(/(\*\*[^*]+\*\*)/) as string[]).map((part, i) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return (
                        <strong key={i} className="font-semibold text-white">
                          {part.slice(2, -2)}
                        </strong>
                      );
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </div>
                {/* Quick actions — always on the last bot message */}
                {isLastBotMsg && (
                  <div className="mt-2.5 pt-2 border-t border-[#06b6d4]/10">
                    <p className="text-[9px] text-[#38bdf8]/40 mb-1.5">Ask me about:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickActions.map((action) => (
                        <button
                          key={action.intent}
                          onClick={() => handleQuickAction(action)}
                          disabled={botTyping}
                          className="px-2.5 py-1.5 rounded-lg bg-[#06b6d4]/8 border border-[#06b6d4]/15 text-[10px] font-medium text-[#06b6d4]/80 hover:bg-[#06b6d4]/20 hover:border-[#06b6d4]/30 hover:text-[#06b6d4] active:scale-95 transition-all duration-200 disabled:opacity-30"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p
                  className={cn(
                    "text-[9px] mt-1",
                    msg.sender === "guest"
                      ? "text-white/50 text-right"
                      : "text-[#38bdf8]/30",
                  )}
                >
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}

        {/* Bot typing indicator */}
        {botTyping && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2 rounded-2xl rounded-bl-md bg-[#0f1d2e] border border-[#06b6d4]/15">
              <p className="text-[9px] font-semibold mb-0.5 text-[#06b6d4]/60">
                🤖 Jarvis
              </p>
              <TypingAnimation />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#3b82f6]/10">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={typingText || input}
            onChange={(e) => {
              if (!typingText) setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Jarvis or message your host..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/10 text-sm text-white placeholder:text-[#38bdf8]/30 focus:outline-none focus:border-[#06b6d4]/30 transition-all duration-200"
            readOnly={!!typingText}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || botTyping || !!typingText}
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
  const [session, setSession] = useState<GuestSession | null>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [portalNotFound, setPortalNotFound] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        // Generate a simple fingerprint from available browser data
        const ua = navigator.userAgent;
        const lang = navigator.language;
        const screen = `${window.screen.width}x${window.screen.height}`;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const raw = `${ua}|${lang}|${screen}|${tz}`;
        // Simple hash
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
          const chr = raw.charCodeAt(i);
          hash = (hash << 5) - hash + chr;
          hash |= 0;
        }
        const fingerprint = Math.abs(hash).toString(36);

        const res = await fetch("/api/guest-portal/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tag_slug: tag,
            fingerprint,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSession(data.session);
          setTagInfo(data.tag);
        } else if (res.status === 404) {
          setPortalNotFound(true);
        }
      } catch {
        /* ignore */
      } finally {
        setSessionLoading(false);
      }
    };

    initSession();
  }, [tag]);

  // Update session name when set in chat
  const handleNameSet = useCallback(
    async (name: string) => {
      if (!session) return;
      setSession((prev) => (prev ? { ...prev, guest_name: name } : prev));
      // Update server
      try {
        await fetch("/api/guest-portal/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tag_slug: tag,
            guest_name: name,
            fingerprint: session.fingerprint,
          }),
        });
      } catch {
        /* ignore */
      }
    },
    [session, tag],
  );

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

  // Portal not found
  if (!sessionLoading && portalNotFound) {
    return (
      <div className="min-h-[100dvh] bg-[#0a1628] flex items-center justify-center px-4">
        <div className="text-center">
          <Bot className="w-16 h-16 mx-auto mb-4 text-[#3b82f6]/30" />
          <h1 className="text-xl font-bold text-white mb-2">
            Portal Not Found
          </h1>
          <p className="text-sm text-[#38bdf8]/40">
            This tag hasn&apos;t been configured yet. Ask your host to set it
            up.
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (sessionLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <JarvisOrb pulsing />
          <p className="mt-6 text-sm text-[#38bdf8]/50 animate-pulse">
            Initializing Jarvis…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a1628] relative">
      {/* Particles */}
      {mounted && <PortalParticles />}

      {/* Gradient blobs */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#3b82f6]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#06b6d4]/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#14b8a6]/5 rounded-full blur-[150px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6 pb-8">
        {/* ── HERO SECTION ──────────────────────────── */}
        <section className="pt-10 pb-5 text-center">
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

          <div
            className={cn(
              "mt-5 transition-all duration-1000 delay-200",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
            )}
          >
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">
              <span className="text-white">{greetingText()},</span>{" "}
              <span className="bg-gradient-to-r from-[#3b82f6] via-[#06b6d4] to-[#14b8a6] bg-clip-text text-transparent">
                {session?.guest_name || "Welcome Home"}
              </span>
            </h1>
            <p className="text-[#38bdf8]/45 text-xs max-w-[260px] mx-auto leading-relaxed">
              Make yourself comfortable — Jarvis is here to help.
            </p>
          </div>

          <div
            className={cn(
              "mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0f1d2e]/80 backdrop-blur border border-[#3b82f6]/15 transition-all duration-1000 delay-400",
              mounted ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] animate-pulse" />
            <span className="text-[10px] text-[#38bdf8]/50">
              Jarvis is online
            </span>
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
          {activeSection === "home" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-3">
                <GlowCard
                  className="p-4 text-center"
                  glow="blue"
                  onClick={() => setActiveSection("wifi")}
                >
                  <Wifi className="w-7 h-7 mx-auto mb-2 text-[#06b6d4] drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
                  <p className="text-xs font-medium text-white">Connect WiFi</p>
                  <p className="text-[9px] text-[#38bdf8]/40 mt-0.5">
                    Copy password
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
                  <p className="text-xs font-medium text-white">Chat Jarvis</p>
                  <p className="text-[9px] text-[#38bdf8]/40 mt-0.5">
                    Ask anything
                  </p>
                </GlowCard>
              </div>

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

          {activeSection === "wifi" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <WiFiCard tagInfo={tagInfo} sessionId={session?.id || null} />
            </div>
          )}

          {activeSection === "rules" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <RulesCard bioData={tagInfo?.bio_data} />
            </div>
          )}

          {activeSection === "allergies" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AllergiesCard tagInfo={tagInfo} session={session} onNameSet={handleNameSet} />
            </div>
          )}

          {activeSection === "recipes" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <RecipesCard />
            </div>
          )}

          {activeSection === "feedback" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <FeedbackCard tagInfo={tagInfo} />
            </div>
          )}

          {activeSection === "chat" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ChatInterface
                tag={tag}
                tagInfo={tagInfo}
                session={session}
                onNameSet={handleNameSet}
              />
            </div>
          )}

          {activeSection === "download" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <DownloadCard />
            </div>
          )}
        </div>


      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] flex items-center justify-center shadow-lg shadow-[#06b6d4]/30 hover:shadow-[#06b6d4]/50 transition-all duration-300 hover:scale-110 animate-in fade-in zoom-in duration-300"
        >
          <ArrowUp className="w-4 h-4 text-white" />
        </button>
      )}

      {/* CSS Animations */}
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
        .animate-in {
          animation-fill-mode: both;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
