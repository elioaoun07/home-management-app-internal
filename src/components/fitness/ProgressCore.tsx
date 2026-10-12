"use client";

// The Fitness progression core: XP ring (level), weekly slot segments, rank.
// Ambient motion is restrained and stops when effects are off, the OS asks for
// reduced motion, or the tab is hidden. Cosmetic unlocks change rings/trails.
import type { SlotStatus } from "@/lib/fitness/progress";
import { RANK_LABEL } from "@/lib/fitness/progress";
import type { RankId } from "@/lib/fitness/types";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { useFitnessPalette, usePageVisible } from "./fitnessTheme";

interface Props {
  xp: number;
  level: number;
  pct: number;
  rank: RankId;
  cosmetic: RankId;
  segments: SlotStatus[];
  effects: boolean;
  pending?: boolean;
  size?: number;
}

const C = 120;
const R_XP = 100;
const R_WEEK = 82;

function arc(r: number, start: number, end: number) {
  const p = (a: number) => [C + r * Math.cos(a - Math.PI / 2), C + r * Math.sin(a - Math.PI / 2)];
  const [x1, y1] = p(start);
  const [x2, y2] = p(end);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
}

export function ProgressCore({ xp, level, pct, rank, cosmetic, segments, effects, pending, size = 240 }: Props) {
  const pal = useFitnessPalette();
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const ambient = effects && !reduced && visible;
  const gid = useId().replace(/:/g, "");
  const tier = ["initiate", "momentum", "vanguard", "apex"].indexOf(cosmetic);

  // XP gain → particles flow into the meter (once per increase, never on mount).
  const prevXp = useRef(xp);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (xp > prevXp.current && effects && !reduced) setBurst((b) => b + 1);
    prevXp.current = xp;
  }, [xp, effects, reduced]);

  const n = Math.max(segments.length, 1);
  const gap = n > 1 ? 0.09 : 0;
  const circumference = 2 * Math.PI * R_XP;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img"
      aria-label={`Level ${level}, ${RANK_LABEL[rank]}, ${segments.filter((s) => s === "done").length} of ${segments.length} this week`}>
      {/* Ambient glow */}
      <motion.div
        className="absolute inset-[18%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${pal.a}55, ${pal.b}22 60%, transparent 70%)` }}
        animate={ambient ? { opacity: [0.55, 0.85, 0.55], scale: [0.96, 1.03, 0.96] } : { opacity: 0.6, scale: 1 }}
        transition={ambient ? { duration: 6, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
      />
      <svg viewBox="0 0 240 240" width={size} height={size} className="relative">
        <defs>
          <linearGradient id={`xp-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={pal.a} />
            <stop offset="100%" stopColor={tier >= 2 ? pal.c : pal.b} />
          </linearGradient>
          <filter id={`glow-${gid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Orbit (all ranks), tick crown (Vanguard+), second orbit (Apex) */}
        <motion.g
          style={{ originX: "120px", originY: "120px" }}
          animate={ambient ? { rotate: 360 } : { rotate: 0 }}
          transition={ambient ? { duration: 60, repeat: Infinity, ease: "linear" } : { duration: 0 }}
        >
          <circle cx={C} cy={C} r={114} fill="none" stroke={pal.a} strokeOpacity={0.22} strokeWidth={1} strokeDasharray="2 7" />
          {tier >= 3 && [0, 1, 2].map((i) => (
            <circle key={i} cx={C + 114 * Math.cos((i * 2 * Math.PI) / 3)} cy={C + 114 * Math.sin((i * 2 * Math.PI) / 3)} r={2.2} fill={pal.c} filter={`url(#glow-${gid})`} />
          ))}
        </motion.g>
        {tier >= 2 && (
          <g opacity={0.5}>
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i / 60) * Math.PI * 2;
              const r1 = 120, r2 = i % 5 === 0 ? 116 : 118;
              return <line key={i} x1={C + r1 * Math.cos(a)} y1={C + r1 * Math.sin(a)} x2={C + r2 * Math.cos(a)} y2={C + r2 * Math.sin(a)} stroke={i % 5 === 0 ? pal.a : pal.track} strokeWidth={1} />;
            })}
          </g>
        )}
        {tier >= 3 && <circle cx={C} cy={C} r={108} fill="none" stroke={pal.c} strokeOpacity={0.25} strokeWidth={0.75} />}

        {/* XP ring */}
        <circle cx={C} cy={C} r={R_XP} fill="none" stroke={pal.track} strokeWidth={8} />
        <motion.circle
          cx={C} cy={C} r={R_XP} fill="none" stroke={`url(#xp-${gid})`} strokeWidth={8} strokeLinecap="round"
          transform={`rotate(-90 ${C} ${C})`}
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - Math.max(0.015, pct)) }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 18 }}
          filter={tier >= 1 ? `url(#glow-${gid})` : undefined}
          strokeOpacity={pending ? 0.55 : 1}
        />
        {/* Momentum+: comet trail circling the XP ring */}
        {tier >= 1 && (
          <motion.g
            style={{ originX: "120px", originY: "120px" }}
            animate={ambient ? { rotate: 360 } : { rotate: 0 }}
            transition={ambient ? { duration: 14, repeat: Infinity, ease: "linear" } : { duration: 0 }}
          >
            <path d={arc(R_XP, 0, 0.5)} stroke={pal.a} strokeOpacity={0.55} strokeWidth={2} fill="none" strokeLinecap="round" />
            <circle cx={C + R_XP * Math.cos(0.5 - Math.PI / 2)} cy={C + R_XP * Math.sin(0.5 - Math.PI / 2)} r={2.5} fill={pal.a} />
          </motion.g>
        )}

        {/* Weekly slot segments */}
        {segments.map((s, i) => {
          const start = (i / n) * Math.PI * 2 + gap / 2;
          const end = ((i + 1) / n) * Math.PI * 2 - gap / 2;
          const lit = s === "done";
          return (
            <motion.path
              key={i}
              d={arc(R_WEEK, start, end)}
              fill="none"
              strokeWidth={lit ? 10 : 8}
              strokeLinecap="round"
              stroke={lit ? `url(#xp-${gid})` : s === "active" ? pal.b : pal.track}
              strokeDasharray={s === "skipped" ? "2 6" : undefined}
              initial={false}
              animate={s === "active" && ambient ? { strokeOpacity: [0.45, 1, 0.45] } : { strokeOpacity: lit ? 1 : s === "active" ? 0.9 : 1 }}
              transition={s === "active" && ambient ? { duration: 2.4, repeat: Infinity } : { duration: reduced ? 0 : 0.6 }}
              filter={lit ? `url(#glow-${gid})` : undefined}
            />
          );
        })}

        {/* Particles flowing into the XP meter */}
        {burst > 0 &&
          Array.from({ length: 10 }, (_, i) => (
            <motion.circle
              key={`${burst}-${i}`}
              r={2.2}
              fill={i % 2 ? pal.a : pal.c}
              initial={{ cx: C + (i - 5) * 6, cy: C + 40, opacity: 0 }}
              animate={{ cx: C + R_XP * Math.cos(pct * 2 * Math.PI - Math.PI / 2), cy: C + R_XP * Math.sin(pct * 2 * Math.PI - Math.PI / 2), opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, delay: i * 0.05, ease: "easeIn" }}
            />
          ))}
      </svg>

      {/* Center readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <span className={`text-[11px] uppercase tracking-widest ${pal.faint}`}>Level</span>
        <span className={`text-5xl font-semibold tabular-nums leading-none ${pal.ink}`}>{level}</span>
        <span className="mt-1 text-xs font-medium tracking-wide" style={{ color: pal.a }}>{RANK_LABEL[rank]}</span>
        <span className={`mt-0.5 text-[11px] tabular-nums ${pal.faint}`}>{pending ? "Pending" : `${xp} XP`}</span>
      </div>
    </div>
  );
}
