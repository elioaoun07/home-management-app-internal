"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { ConversationState } from "../conversationEngine";

interface Props {
  isEnabled: boolean;
  isSupported: boolean;
  state: ConversationState;
  theme?: string;
  onToggle: () => void;
  onWake: () => void;
  onBargeIn: () => void;
}

/**
 * Mic button that doubles as the conversation mode toggle + wake trigger.
 *
 * Interactions:
 *   - Tap when mode is OFF → enable conversation mode (shows brief instruction toast)
 *   - Tap when mode is ON + state is idle → trigger wake (ERA starts listening)
 *   - Tap when state is speaking/ai_streaming → barge-in (stop ERA, return to listening)
 *   - Long press (500 ms) when mode is ON → same as tap-when-idle (wake)
 *   - Tap when mode is ON + listening → no-op (already listening)
 */
export function ConversationToggle({ isEnabled, isSupported, state, theme, onToggle, onWake, onBargeIn }: Props) {
  if (!isSupported) return null;

  const isActive = isEnabled && state !== "off";
  const isSpeaking = state === "speaking" || state === "ai_streaming";
  const isListening = state === "listening";
  const isProcessing = state === "classifying" || state === "executing" || state === "confirming";

  const baseColor = theme === "pink" ? "pink" : "blue";
  const activeGradient =
    baseColor === "pink"
      ? "from-pink-500 to-rose-600"
      : "from-blue-500 to-indigo-600";

  function handleClick() {
    if (!isEnabled) { onToggle(); return; }
    if (isSpeaking) { onBargeIn(); return; }
    if (state === "idle" || state === "listening") { onWake(); return; }
  }

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulsing ring when listening */}
      <AnimatePresence>
        {isListening && (
          <motion.span
            key="listening-ring"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.4, 0.1], scale: [1, 1.6] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
            className={cn(
              "absolute w-12 h-12 rounded-xl",
              baseColor === "pink" ? "bg-pink-400" : "bg-blue-400",
            )}
          />
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={handleClick}
        title={
          !isEnabled
            ? "Enable ERA conversation mode"
            : isSpeaking
              ? "Stop ERA (barge in)"
              : isListening
                ? "ERA is listening…"
                : isProcessing
                  ? "ERA is processing…"
                  : "Say Hey ERA"
        }
        className={cn(
          "relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-300 active:scale-90",
          isActive
            ? cn("bg-gradient-to-br text-white shadow-lg", activeGradient)
            : "bg-white/10 text-white/50 hover:text-white/80 hover:bg-white/15",
        )}
      >
        <AnimatePresence mode="wait">
          {isSpeaking ? (
            <motion.span
              key="stop"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className="flex items-end gap-px h-5"
            >
              {[0, 150, 75, 225, 0].map((delay, i) => (
                <span
                  key={i}
                  className="w-0.5 bg-white rounded-full animate-pulse"
                  style={{
                    height: `${[4, 8, 12, 8, 4][i]}px`,
                    animationDelay: `${delay}ms`,
                    animationDuration: "500ms",
                  }}
                />
              ))}
            </motion.span>
          ) : (
            <motion.svg
              key="mic"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </motion.svg>
          )}
        </AnimatePresence>

        {/* Active dot indicator */}
        {isActive && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-black/30",
              isListening ? (baseColor === "pink" ? "bg-pink-300 animate-pulse" : "bg-blue-300 animate-pulse") : "bg-white/60",
            )}
          />
        )}
      </button>
    </div>
  );
}
