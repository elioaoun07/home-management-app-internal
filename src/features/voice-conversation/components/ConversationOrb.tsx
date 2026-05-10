"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { ConversationState } from "../conversationEngine";

interface Props {
  state: ConversationState;
  transcript: string;
  /** User's theme color — "blue" | "pink" | "frost" | "calm" */
  theme?: string;
  className?: string;
}

function getOrbColors(theme: string | undefined, state: ConversationState) {
  // Color identity: blue-theme user = blue, pink-theme = pink (Hard Rule #14)
  const isActive = state !== "off" && state !== "idle";
  const baseColor = theme === "pink" ? "pink" : "blue";

  if (!isActive) return { ring: "ring-white/10", glow: "", dot: "bg-white/20" };

  if (state === "listening")
    return {
      ring: baseColor === "pink" ? "ring-pink-400/50" : "ring-blue-400/50",
      glow: baseColor === "pink" ? "shadow-pink-500/20" : "shadow-blue-500/20",
      dot: baseColor === "pink" ? "bg-pink-400" : "bg-blue-400",
    };

  if (state === "speaking" || state === "ai_streaming")
    return {
      ring: "ring-purple-400/50",
      glow: "shadow-purple-500/20",
      dot: "bg-purple-400",
    };

  if (state === "classifying" || state === "executing")
    return {
      ring: "ring-amber-400/50",
      glow: "shadow-amber-500/20",
      dot: "bg-amber-400",
    };

  if (state === "confirming")
    return {
      ring: "ring-emerald-400/50",
      glow: "shadow-emerald-500/20",
      dot: "bg-emerald-400",
    };

  return { ring: "ring-white/20", glow: "", dot: "bg-white/40" };
}

const LABEL: Partial<Record<ConversationState, string>> = {
  listening: "Listening…",
  classifying: "Thinking…",
  executing: "On it…",
  confirming: "Say yes or no",
  speaking: "ERA is speaking",
  ai_streaming: "ERA is thinking",
};

/**
 * Animated pulsing orb that reflects the conversation state.
 * Renders nothing when state is "off".
 */
export function ConversationOrb({ state, transcript, theme, className }: Props) {
  if (state === "off") return null;

  const { ring, glow, dot } = getOrbColors(theme, state);
  const label = LABEL[state] ?? "";
  const isPulsing = state === "listening";
  const isSpinning = state === "classifying" || state === "ai_streaming";

  return (
    <AnimatePresence>
      <motion.div
        key="orb"
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.9 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn("flex flex-col items-center gap-2 py-3", className)}
      >
        {/* Orb */}
        <div className="relative flex items-center justify-center">
          {/* Outer glow ring */}
          {isPulsing && (
            <span
              className={cn(
                "absolute w-12 h-12 rounded-full ring-2 animate-ping opacity-30",
                ring,
              )}
            />
          )}
          {/* Main orb body */}
          <div
            className={cn(
              "relative w-9 h-9 rounded-full ring-2 flex items-center justify-center shadow-lg",
              ring,
              glow && `shadow-lg ${glow}`,
            )}
          >
            {isSpinning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full"
              />
            ) : (
              <WaveIndicator state={state} dot={dot} />
            )}
          </div>
        </div>

        {/* Label */}
        {label && (
          <span className="text-[10px] font-medium text-white/50 tracking-wide">
            {label}
          </span>
        )}

        {/* Interim transcript ghost */}
        {transcript && state === "listening" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-white/40 italic max-w-[220px] text-center truncate"
          >
            {transcript}
          </motion.p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function WaveIndicator({ state, dot }: { state: ConversationState; dot: string }) {
  if (state === "speaking" || state === "ai_streaming") {
    return (
      <span className="flex items-end gap-px h-4">
        {[0, 150, 75, 225, 0].map((delay, i) => (
          <span
            key={i}
            className={cn("w-0.5 rounded-full animate-pulse", dot)}
            style={{
              height: `${[4, 8, 12, 8, 4][i]}px`,
              animationDelay: `${delay}ms`,
              animationDuration: "500ms",
            }}
          />
        ))}
      </span>
    );
  }
  return <span className={cn("w-2 h-2 rounded-full", dot)} />;
}
