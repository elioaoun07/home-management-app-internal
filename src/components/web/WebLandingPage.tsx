"use client";

import { ERAMark, type ERAModuleKey } from "@/components/shared/ERAMark";
import { useUser } from "@/contexts/UserContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { safeFetch } from "@/lib/safeFetch";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Local type to avoid circular import with WebViewContainer
type WebViewMode = "budget" | "events" | "catalogue" | "recipes";

type Props = {
  onNavigate: (mode: WebViewMode) => void;
};

const LANDING_MODULES: Array<{
  mode: WebViewMode;
  label: string;
  role: string;
  eraModule: ERAModuleKey;
  gradient: string;
}> = [
  {
    mode: "events",
    label: "Schedule",
    role: "Events & Reminders",
    eraModule: "schedule",
    gradient: "from-violet-400 to-purple-400",
  },
  {
    mode: "budget",
    label: "Finance",
    role: "Budget Manager",
    eraModule: "financial",
    gradient: "from-cyan-400 to-teal-400",
  },
  {
    mode: "catalogue",
    label: "Memory",
    role: "Life Catalogue",
    eraModule: "memory",
    gradient: "from-blue-400 to-indigo-400",
  },
  {
    mode: "recipes",
    label: "Culinary",
    role: "Recipes & Meals",
    eraModule: "recipe",
    gradient: "from-orange-400 to-amber-400",
  },
];

// Card drift directions based on grid position (top-left, top-right, bottom-left, bottom-right)
const CARD_DRIFT = [
  { x: -40, y: -25 },
  { x: 40, y: -25 },
  { x: -40, y: 25 },
  { x: 40, y: 25 },
];

type GreetingVariant = {
  max: number;
  variants: Array<{
    line1: (firstName: string) => string;
    line2: (firstName: string) => string;
  }>;
};

const GREETING_GROUPS: GreetingVariant[] = [
  {
    max: 4,
    variants: [
      {
        line1: (name) => `Burning the midnight oil, ${name}?`,
        line2: () => "Let's tackle what's left on the list.",
      },
      {
        line1: (name) => `Still up, ${name}?`,
        line2: () => "Time to check that budget before things spiral?",
      },
      {
        line1: () => `Late night focus session?`,
        line2: (name) => `${name}, want to plan tomorrow's meals ahead?`,
      },
      {
        line1: (name) => `Night owl mode activated, ${name}.`,
        line2: () => "Review your spending today or just vibing?",
      },
    ],
  },
  {
    max: 11,
    variants: [
      {
        line1: (name) => `Good morning, ${name}.`,
        line2: () => "Check your balance before the day gets hectic?",
      },
      {
        line1: (name) => `Rise and shine, ${name}.`,
        line2: () => "What's on your plate today? Literally and financially?",
      },
      {
        line1: () => "Morning.",
        line2: (name) =>
          `${name}, your reminders are waiting. Ready to tackle them?`,
      },
      {
        line1: (name) => `Daybreak, ${name}.`,
        line2: () => "Review last night's transactions or plan today's meals?",
      },
      {
        line1: (name) => `Welcome back, ${name}.`,
        line2: () => "Budget check? Reminders? Or straight to meal planning?",
      },
    ],
  },
  {
    max: 16,
    variants: [
      {
        line1: (name) => `Afternoon, ${name}.`,
        line2: () => "How's your spending looking so far this month?",
      },
      {
        line1: (name) => `Midday status check, ${name}.`,
        line2: () => "Want to see what you've spent today?",
      },
      {
        line1: (name) => `Hey, ${name}. Post-lunch?`,
        line2: () => "Time to review your budget or plan dinner?",
      },
      {
        line1: () => "Still going strong.",
        line2: (name) => `${name}, any reminders you're putting off?`,
      },
      {
        line1: (name) => `Back at it, ${name}.`,
        line2: () => "Curious about your spending trends this week?",
      },
    ],
  },
  {
    max: 20,
    variants: [
      {
        line1: (name) => `Good evening, ${name}.`,
        line2: () => "Wrap up today's budget or prep tomorrow's agenda?",
      },
      {
        line1: (name) => `Evening, ${name}.`,
        line2: () => "Time to review the day's spending?",
      },
      {
        line1: (name) => `${name}, how's the day treating you?`,
        line2: () => "Check your reminders or browse recipes for dinner?",
      },
      {
        line1: () => "Golden hour.",
        line2: (name) =>
          `${name}, ready to organize your finances or schedule?`,
      },
      {
        line1: (name) => `Welcome back, ${name}.`,
        line2: () => "Let's review today's transactions and plan ahead.",
      },
    ],
  },
  {
    max: 23,
    variants: [
      {
        line1: (name) => `Winding down, ${name}?`,
        line2: () => "Reflect on today's spending before you rest?",
      },
      {
        line1: (name) => `Still going, ${name}.`,
        line2: () => "One last check on your budget for the day?",
      },
      {
        line1: (name) => `Almost there, ${name}.`,
        line2: () => "Anything you want to organize before tomorrow?",
      },
      {
        line1: () => "Late evening.",
        line2: (name) => `${name}, any last-minute reminders or meal plans?`,
      },
      {
        line1: (name) => `Last call, ${name}.`,
        line2: () => "Review pending transactions or rest your mind?",
      },
    ],
  },
];

function pickGreeting(firstName: string) {
  const hour = new Date().getHours();
  const group =
    GREETING_GROUPS.find((g) => hour <= g.max) ?? GREETING_GROUPS[1];
  const variant =
    group.variants[Math.floor(Math.random() * group.variants.length)];
  return {
    line1: variant.line1(firstName),
    line2: variant.line2(firstName),
  };
}

function useTypewriter(text: string, startDelay: number, speed: number) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!text) {
      setDisplayed("");
      return;
    }
    setDisplayed("");
    let cancelled = false;
    const t = setTimeout(() => {
      let i = 0;
      const iv = setInterval(() => {
        if (cancelled) {
          clearInterval(iv);
          return;
        }
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(iv);
      }, speed);
    }, startDelay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, startDelay, speed]);
  return displayed;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function playGreetingTTS(line1: string, line2: string) {
  const ssml = `<speak version="1.0" xml:lang="en-US">
  <voice name="en-US-AvaMultilingualNeural">
    <prosody pitch="+5%" rate="0.92">${escapeXml(line1)}</prosody>
    <break time="380ms"/>
    <prosody rate="0.95">${escapeXml(line2)}</prosody>
  </voice>
</speak>`;

  try {
    const res = await safeFetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssml }),
      timeoutMs: 15_000,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    try {
      await audio.play();
    } catch {
      document.addEventListener(
        "pointerdown",
        () => audio.play().catch(() => {}),
        { once: true },
      );
    }
  } catch {
    // Greeting audio failure is silent — non-critical
  }
}

type GhostState = {
  module: ERAModuleKey;
  // Source center (card's ERAMark center in viewport coords)
  fromX: number;
  fromY: number;
  // Target center (landing page's ERAMark center in viewport coords)
  toX: number;
  toY: number;
  // Ghost diameter — we keep ONE size throughout the flight (no FLIP scale)
  // because scaling the mark while the internal `era-breathe` + aura keyframes
  // are running produces visual stutter. A pure translation is buttery smooth,
  // and the smaller ghost lands "inside" the bigger 128 center mark — reading
  // as a merge into, not a teleport onto.
  size: number;
};

// Animation phases:
// idle       → waiting for user
// gathering  → cards dispersing, ghost flying toward center
// absorbing  → ghost arrived, ERA mark recoiling then expanding (absorption pulse)
// transforming → CSS color+cue transition plays out (1.8s) — ERA metamorphosing
// zooming    → ERA mark scales to fill screen (portal entrance)
type AnimPhase =
  | "idle"
  | "gathering"
  | "absorbing"
  | "transforming"
  | "zooming";

export default function WebLandingPage({ onNavigate }: Props) {
  const tc = useThemeClasses();
  const userData = useUser();
  const [greeting, setGreeting] = useState<{
    line1: string;
    line2: string;
  } | null>(null);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [modulesVisible, setModulesVisible] = useState(false);
  const [clickedMode, setClickedMode] = useState<WebViewMode | null>(null);
  const [centerModule, setCenterModule] = useState<ERAModuleKey>("chat");
  const [animPhase, setAnimPhase] = useState<AnimPhase>("idle");
  const ttsCalledRef = useRef(false);

  // Fusion animation refs and controls
  const centerMarkRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<WebViewMode, HTMLButtonElement>());
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const centerControls = useAnimation();
  const overlayControls = useAnimation();
  // Soft portal disk — radial gradient (solid black at center, transparent at
  // edges) positioned ABOVE the mark (z-[35]) and at its exact center. As it
  // scales up together with the mark, the mark's aura/ring stays visible
  // AROUND the dark core, so the viewer literally watches the central dot
  // "open" into a void. No pure-black occlusion — the mark remains a living,
  // glowing being all the way through the zoom.
  const portalControls = useAnimation();

  const firstName = userData?.name ? userData.name.split(" ")[0] : "there";

  useEffect(() => {
    if (userData?.name && !greeting) {
      setGreeting(pickGreeting(firstName));
    }
  }, [userData?.name, firstName, greeting]);

  useEffect(() => {
    if (!greeting || ttsCalledRef.current) return;
    ttsCalledRef.current = true;
    playGreetingTTS(greeting.line1, greeting.line2);
  }, [greeting]);

  useEffect(() => {
    const t1 = setTimeout(() => setGreetingVisible(true), 1800);
    const t3 = setTimeout(() => setModulesVisible(true), 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t3);
    };
  }, []);

  const line1Text = greetingVisible ? (greeting?.line1 ?? "") : "";
  const line2Text = greetingVisible ? (greeting?.line2 ?? "") : "";
  const typedLine1 = useTypewriter(line1Text, 0, 36);
  const typedLine2 = useTypewriter(line2Text, line1Text.length * 36 + 280, 28);

  const handleModuleClick = (mode: WebViewMode, eraModule: ERAModuleKey) => {
    if (clickedMode !== null) return;

    const cardEl = cardRefs.current.get(mode);
    const centerEl = centerMarkRef.current;

    setClickedMode(mode);
    setAnimPhase("gathering");

    // Atmospheric darkening — slow, low-key dim that sets the mood during absorption.
    // Stops at 0.55 so the mark's color transform is still readable.
    overlayControls.start({
      opacity: 0.55,
      transition: { duration: 2.0, ease: "easeIn" },
    });

    if (cardEl && centerEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const centerRect = centerEl.getBoundingClientRect();

      // Capture both centers in viewport coords. The ghost uses `position: fixed`,
      // so viewport coords line up directly. We do NOT change size during flight —
      // only translate. The ghost stays at its source size (68px) and lands
      // visually "inside" the 128px center mark, which then absorbs it. Pure
      // translation = no scale jitter + no stutter from keyframed internals.
      const fromX = cardRect.left + cardRect.width / 2;
      const fromY = cardRect.top + cardRect.height / 2;
      const toX = centerRect.left + centerRect.width / 2;
      const toY = centerRect.top + centerRect.height / 2;

      setGhost({
        module: eraModule,
        fromX,
        fromY,
        toX,
        toY,
        size: 68,
      });

      // T+700ms: ghost arrives — absorption begins
      setTimeout(() => {
        setGhost(null);
        setAnimPhase("absorbing");

        // ERA mark recoils and expands: the soul is being received
        centerControls.start({
          scale: [1, 0.8, 1.28, 0.92, 1.12, 0.97, 1.05, 1],
          transition: {
            duration: 0.7,
            ease: "easeInOut",
            times: [0, 0.08, 0.22, 0.38, 0.55, 0.7, 0.85, 1],
          },
        });

        // CSS color+cue transformation fires simultaneously (1.8s CSS transition)
        setCenterModule(eraModule);
        setAnimPhase("transforming");
      }, 700);

      // T+2200ms: pre-zoom breath — ERA inhales before the leap (tension build)
      setTimeout(() => {
        centerControls.start({
          scale: [1, 1.08, 1],
          transition: { duration: 0.5, ease: [0.45, 0, 0.55, 1] },
        });
      }, 2200);

      // T+2700ms: PORTAL — the mark zooms and stays SOLID the whole way in,
      // while a soft-edged dark disk grows from its central core. Because the
      // portal is a radial gradient (solid black center, transparent edges)
      // layered above the mark, the mark's aura and ring remain visible
      // AROUND the growing dark core — the viewer watches the central dot
      // literally open up and pull them through. The mark fades only at the
      // very end (last 25% of the zoom), after the dark core has already
      // dominated the viewport.
      setTimeout(() => {
        setAnimPhase("zooming");

        // Mark warp — scales massively while remaining opaque, then fades at
        // the tail so it "dissolves into the void it just opened".
        centerControls.start({
          scale: [1, 8, 40],
          opacity: [1, 1, 0],
          transition: {
            duration: 1.2,
            ease: [0.55, 0, 0.78, 0],
            times: [0, 0.6, 1],
          },
        });

        // Portal disk — grows from 48px base (core-sized) to cover the
        // viewport. Reaches peak early (70% of the zoom window) and plateaus
        // so the final stretch is unambiguously solid black before
        // onNavigate fires. Final scale 110 × 48px = 5280px — edge-to-edge
        // at any realistic viewport (even ultrawides).
        portalControls.start({
          scale: [0, 110, 110],
          transition: {
            duration: 1.1,
            times: [0, 0.7, 1],
            ease: [0.42, 0, 0.58, 1],
            delay: 0.08,
          },
        });
      }, 2700);

      // T+3750ms: portal has plateaued at full viewport coverage and the
      // mark has faded to 0 — the viewport is solid black. Safe to hand off
      // to the dashboard. The landing overlay's exit fade starts from this
      // already-black state, so the dashboard emerges *from* the void rather
      // than fading in over the old view.
      setTimeout(() => onNavigate(mode), 3750);
    } else {
      // Fallback — no refs
      setTimeout(() => onNavigate(mode), 300);
    }
  };

  const isNavigating = clickedMode !== null;

  return (
    <div
      className={cn(
        "h-full flex flex-col items-center justify-center relative overflow-hidden",
        tc.pageBg,
      )}
    >
      {/* Atmospheric radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full bg-[hsla(190,85%,62%,0.04)] blur-3xl" />
      </div>

      {/* Portal void overlay — dims the world as ERA transforms */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-[20] bg-black"
        initial={{ opacity: 0 }}
        animate={overlayControls}
      />

      {/* Center ERA Mark — the living being */}
      {/* z-[30] keeps it above the overlay during the zoom */}
      <motion.div
        className="mb-7 relative z-[30]"
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 55, damping: 14, delay: 0.3 }}
      >
        <motion.div animate={centerControls}>
          <div ref={centerMarkRef}>
            <ERAMark module={centerModule} size={128} />
          </div>
        </motion.div>

        {/* Portal disk — soft-edged radial gradient locked to the mark's
            center (absolute-centered inside the 128×128 mark wrapper). Solid
            black at the core, fully transparent at the edges. Above the mark
            in the stacking order, so as it grows the mark's aura/ring remain
            visible AROUND the darkening core — the central dot literally opens
            into a void. Base 48px ≈ the mark's own core (30% of 128). Final
            scale 100 × 48 = 4800px → edge-to-edge coverage at any viewport. */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 pointer-events-none rounded-full"
          style={{
            width: 48,
            height: 48,
            marginLeft: -24,
            marginTop: -24,
            background:
              "radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0.85) 65%, rgba(0,0,0,0.4) 85%, rgba(0,0,0,0) 100%)",
            zIndex: 5,
            willChange: "transform",
          }}
          initial={{ scale: 0 }}
          animate={portalControls}
        />
      </motion.div>

      {/* Greeting text */}
      <div className="mb-14 flex flex-col items-center relative z-[10]">
        <AnimatePresence>
          {greetingVisible && !isNavigating && greeting?.line1 && (
            <motion.div
              key="greeting"
              className="flex flex-col items-center gap-2 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.25 } }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <span className="text-2xl font-semibold text-white/90 tracking-tight">
                {typedLine1}
                {typedLine1.length > 0 &&
                  typedLine1.length < line1Text.length && (
                    <span className="opacity-50 animate-pulse">_</span>
                  )}
              </span>
              <span className="text-sm text-white/45 font-light tracking-wide">
                {typedLine2}
                {typedLine2.length > 0 &&
                  typedLine2.length < line2Text.length && (
                    <span className="opacity-40 animate-pulse">_</span>
                  )}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Module grid — stagger in, drift away on navigate */}
      <div
        className={cn(
          "grid grid-cols-2 gap-5 relative z-[10]",
          isNavigating && "pointer-events-none",
        )}
      >
        {LANDING_MODULES.map(
          ({ mode, label, role, eraModule, gradient }, i) => {
            const isClicked = clickedMode === mode;
            const isOther = isNavigating && !isClicked;
            const drift = CARD_DRIFT[i];

            return (
              <motion.button
                key={mode}
                type="button"
                ref={(el) => {
                  if (el) cardRefs.current.set(mode, el);
                  else cardRefs.current.delete(mode);
                }}
                onClick={() => handleModuleClick(mode, eraModule)}
                className={cn(
                  "flex flex-col items-center gap-3 px-8 py-6 rounded-2xl",
                  "border border-white/10 bg-white/[0.04]",
                  "hover:bg-white/[0.07] hover:border-white/20",
                  "transition-colors duration-200 cursor-pointer",
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  // Clicked card fully dissolves (not just its internals) — no lingering border/bg.
                  opacity: isOther ? 0 : isClicked ? 0 : modulesVisible ? 1 : 0,
                  x: isOther ? drift.x : 0,
                  y: isOther ? drift.y : modulesVisible ? 0 : 20,
                  scale: isOther ? 0.75 : isClicked ? 0.6 : 1,
                }}
                transition={
                  isClicked
                    ? {
                        // Brief delay lets the ghost launch first, then the source card
                        // dissolves behind it — ghost visually "lifts off" the card.
                        duration: 0.5,
                        ease: [0.32, 0, 0.6, 1],
                        delay: 0.18,
                      }
                    : isOther
                      ? { duration: 0.85, ease: [0.4, 0, 1, 1] }
                      : {
                          delay: modulesVisible ? 0.08 * i : 0,
                          duration: 0.45,
                          ease: "easeOut",
                        }
                }
                whileHover={isNavigating ? {} : { scale: 1.05, y: -3 }}
                whileTap={isNavigating ? {} : { scale: 0.97 }}
              >
                {/* Source ERAMark hides immediately when the ghost is spawned, so the
                    eye only tracks one moving mark (the ghost), not two overlapping ones. */}
                <motion.div
                  animate={{ opacity: isClicked && ghost ? 0 : 1 }}
                  transition={{ duration: 0.1 }}
                >
                  <ERAMark module={eraModule} size={68} />
                </motion.div>
                {/* Label fades immediately */}
                <motion.div
                  className="flex flex-col items-center gap-0.5"
                  animate={{ opacity: isClicked ? 0 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold bg-gradient-to-r bg-clip-text text-transparent",
                      gradient,
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-[11px] text-white/30 tracking-wide">
                    {role}
                  </span>
                </motion.div>
              </motion.button>
            );
          },
        )}
      </div>

      {/* Ghost ERAMark — flies from card to center via pure translation.
          We intentionally keep the ghost at its source size (68px) the whole
          flight: scaling a mark that has running CSS keyframes (era-breathe,
          aura pulses) causes visible stutter, whereas a pure translate is
          GPU-composited and buttery smooth. On arrival the 68px ghost sits
          inside the 128px center mark and dissolves into it — reading as a
          merge, not a teleport. Fixed-positioned in viewport coords so the
          coordinates from getBoundingClientRect() line up directly. */}
      {ghost && (
        <motion.div
          className="pointer-events-none fixed z-[60]"
          style={{
            left: ghost.fromX - ghost.size / 2,
            top: ghost.fromY - ghost.size / 2,
            width: ghost.size,
            height: ghost.size,
            willChange: "transform, opacity",
          }}
          initial={{ x: 0, y: 0, opacity: 0.95 }}
          animate={{
            x: ghost.toX - ghost.fromX,
            y: ghost.toY - ghost.fromY,
            opacity: [0.95, 0.95, 0],
          }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
            opacity: { times: [0, 0.82, 1], duration: 0.7 },
          }}
        >
          <ERAMark module={ghost.module} size={ghost.size} />
        </motion.div>
      )}

      {/* ERA watermark */}
      <motion.p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-white/15 tracking-[0.35em] uppercase select-none z-[10]"
        initial={{ opacity: 0 }}
        animate={{ opacity: modulesVisible && !isNavigating ? 1 : 0 }}
        transition={{ duration: 0.8, delay: isNavigating ? 0 : 0.4 }}
      >
        ERA Personal Assistant
      </motion.p>
    </div>
  );
}
