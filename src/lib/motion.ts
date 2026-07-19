// src/lib/motion.ts
// Shared motion language for the app. Import these presets instead of writing
// ad-hoc spring numbers so every module animates with the same feel.
// All presets animate transform/opacity only — never layout properties.
//
// Reduced motion: components should call framer-motion's useReducedMotion()
// and pass the result through instant() so users with the OS setting get
// immediate state changes instead of springs.

import type { Transition } from "framer-motion";

export const springs = {
  /** Selection feedback: chips, toggles, active-cell emphasis. Fast settle, tiny overshoot. */
  snappy: { type: "spring", stiffness: 500, damping: 32, mass: 0.8 },
  /** Sheets, fades, list entrances. No overshoot. */
  gentle: { type: "spring", stiffness: 260, damping: 28, mass: 1 },
  /** Swapping a visible content layer (e.g. a garment in the paper doll). */
  layer: { type: "spring", stiffness: 380, damping: 30, mass: 0.9 },
} satisfies Record<string, Transition>;

/** House easing curve (same curve SemiDonutFAB ships) for tween transitions. */
export const easeOutQuint = [0.23, 1, 0.32, 1] as const;

export const durations = {
  fast: 0.15,
  base: 0.22,
  slow: 0.35,
} as const;

/** Ready-made variants for crossfading a swapped layer inside AnimatePresence. */
export const layerSwap = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
} as const;

/** Ready-made variants for bottom-sheet / panel content fading in. */
export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
} as const;

/**
 * Collapse a transition to an instant cut when the user prefers reduced motion.
 * Usage: transition={instant(prefersReduced, springs.layer)}
 */
export function instant(prefersReduced: boolean | null, transition: Transition): Transition {
  return prefersReduced ? { duration: 0 } : transition;
}
