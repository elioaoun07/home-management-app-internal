"use client";

// Milestone reveals (badges, records, rank-up). One at a time; each is marked
// celebrated on the server so no device replays it after re-sync.
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { fmtDistance, fmtDuration, fmtKg } from "@/lib/fitness/format";
import { BADGE_LABEL, RANK_LABEL } from "@/lib/fitness/progress";
import type { RankId, RewardEvent } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { BadgeFrame } from "./FitnessIcons";
import { useFitnessPalette } from "./fitnessTheme";
import { PrimaryButton } from "./fitnessUi";

function describe(e: RewardEvent) {
  const p = e.payload as Record<string, unknown>;
  if (e.kind === "rank") return { title: RANK_LABEL[p.rank as RankId] ?? "Rank up", sub: `Level ${p.level}`, eyebrow: "Rank up" };
  if (e.kind === "badge") return { title: BADGE_LABEL[p.badge as string] ?? String(p.badge), sub: "Badge unlocked", eyebrow: "Badge" };
  const v = Number(p.value), prev = Number(p.previous);
  const fmt = (n: number) => (p.metric === "load" ? fmtKg(n) : p.metric === "reps" ? `${n} reps` : p.metric === "duration" ? fmtDuration(n) : fmtDistance(n));
  return { title: String(p.exercise), sub: `${fmt(v)} · was ${fmt(prev)}`, eyebrow: "Personal record" };
}

export function Celebration({ event, effects, onDone }: { event: RewardEvent | null; effects: boolean; onDone: () => void }) {
  const pal = useFitnessPalette();
  const tc = useThemeClasses();
  const reduced = useReducedMotion() || !effects;
  if (typeof document === "undefined") return null;
  const d = event ? describe(event) : null;
  return createPortal(
    <AnimatePresence>
      {event && d && (
        <motion.div
          key={event.source_key}
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="alertdialog" aria-label={`${d.eyebrow}: ${d.title}`}
        >
          <div className="absolute inset-0 bg-black/70" onClick={onDone} />
          <motion.div
            className={cn("relative w-full max-w-xs rounded-3xl border p-6 text-center overflow-hidden", tc.bgPage, pal.line)}
            initial={reduced ? false : { scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
          >
            {!reduced && event.kind === "rank" && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(circle at 50% 35%, ${pal.a}55, transparent 60%)` }}
                initial={{ scale: 0.2, opacity: 1 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.4, ease: "easeOut" }}
              />
            )}
            <p className={cn("text-[11px] uppercase tracking-widest", pal.faint)}>{d.eyebrow}</p>
            <motion.div
              className="mx-auto my-4 w-fit"
              initial={reduced ? false : { rotate: -90, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 14, delay: 0.15 }}
            >
              <BadgeFrame unlocked frame={event.kind === "rank" ? String(event.payload.rank) : "vanguard"} color={pal.a} size={88} />
            </motion.div>
            <p className={cn("text-xl font-semibold", pal.ink)}>{d.title}</p>
            <p className={cn("text-sm mt-1", pal.mute)}>{d.sub}</p>
            <PrimaryButton className="w-full mt-6" onClick={onDone} autoFocus>Continue</PrimaryButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
