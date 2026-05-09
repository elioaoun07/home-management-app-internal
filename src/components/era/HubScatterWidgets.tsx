"use client";

// HubScatterWidgets — 4 compact floating stat cards positioned around the ERA DOT in hub view.
// Each card manages its own AnimatePresence and vaults open outward from the ERA DOT direction.
// Desktop only (hidden on mobile via "hidden md:block").

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useBudgetSummary } from "@/features/era/widgets/useBudgetSummary";
import { useScheduleSummary } from "@/features/era/widgets/useScheduleSummary";
import { useChefSummary } from "@/features/era/widgets/useChefSummary";
import { useBrainSummary } from "@/features/era/widgets/useBrainSummary";
import { useEraStore } from "@/features/era/useEraStore";

const POS: Record<string, React.CSSProperties> = {
  tl: { top: "14%",    left:  "3%" },
  tr: { top: "10%",    right: "3%" },
  bl: { bottom: "22%", left:  "3%" },
  br: { bottom: "22%", right: "3%" },
};

const ORIGIN: Record<string, string> = {
  tl: "bottom right",
  tr: "bottom left",
  bl: "top right",
  br: "top left",
};

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// ── Shared card shell ──────────────────────────────────────────────────────

interface CardProps {
  hue: number;
  pos: keyof typeof POS;
  delay: number;
  label: string;
  children: React.ReactNode;
}

function HubCard({ hue, pos, delay, label, children }: CardProps) {
  const isHub = useEraStore((s) => s.activeView === "hub");

  return (
    <AnimatePresence>
      {isHub && (
        <motion.div
          className="absolute hidden md:flex w-[230px] flex-col gap-2 rounded-2xl p-4"
          style={{
            ...POS[pos],
            transformOrigin: ORIGIN[pos],
            background: `hsla(${hue}, 20%, 7%, 0.92)`,
            border: `1px solid hsla(${hue}, 55%, 50%, 0.22)`,
            backdropFilter: "blur(18px)",
          }}
          initial={{ scaleY: 0.04, scaleX: 0.88, opacity: 0 }}
          animate={{
            scaleY: 1,
            scaleX: 1,
            opacity: 1,
            transition: { delay, duration: 0.4, ease: [0.34, 1.08, 0.64, 1] },
          }}
          exit={{
            scaleY: 0.04,
            scaleX: 0.88,
            opacity: 0,
            transition: { duration: 0.18, ease: "easeIn" },
          }}
        >
          {/* Hue accent line along top edge */}
          <div
            className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
            style={{ background: `hsl(${hue}, 70%, 62%)`, opacity: 0.65 }}
          />

          {/* Module label */}
          <span
            className="text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ color: `hsla(${hue}, 65%, 68%, 0.55)` }}
          >
            {label}
          </span>

          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────

function Divider({ hue }: { hue: number }) {
  return (
    <div
      className="h-px w-full"
      style={{ background: `hsla(${hue}, 40%, 50%, 0.12)` }}
    />
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────

function StatRow({
  hue,
  label,
  value,
  accent,
}: {
  hue: number;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-white/38">{label}</span>
      <span
        className="text-[11px] font-medium truncate max-w-[130px] text-right"
        style={{ color: accent ? `hsl(${hue}, 65%, 68%)` : "rgba(255,255,255,0.7)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Per-module cards ───────────────────────────────────────────────────────

function BudgetCard() {
  const { data, isLoading } = useBudgetSummary();
  const hue = 175;

  const total    = data?.total ?? 0;
  const topCat   = data?.topCategory;
  const topAmt   = data?.topCategoryAmount ?? 0;
  const dailyAvg = data?.dailyAvg ?? 0;
  const txCount  = data?.txCount ?? 0;

  return (
    <HubCard hue={hue} pos="tl" delay={0} label="Expenses">
      {/* Primary number */}
      <p className="text-[22px] font-semibold leading-none text-white/88">
        {isLoading ? "…" : fmt(total)}
      </p>

      <Divider hue={hue} />

      {/* Stats */}
      <div className="flex flex-col gap-1.5">
        {isLoading ? (
          <p className="text-[11px] text-white/35">Loading…</p>
        ) : (
          <>
            <StatRow
              hue={hue}
              label="Top category"
              value={topCat ? `${topCat}  ${fmt(topAmt)}` : "—"}
              accent
            />
            <StatRow hue={hue} label="Daily avg" value={dailyAvg > 0 ? fmt(dailyAvg) : "—"} />
            <StatRow hue={hue} label="Transactions" value={txCount > 0 ? `${txCount} this period` : "None yet"} />
          </>
        )}
      </div>
    </HubCard>
  );
}

function ScheduleCard() {
  const { data, isLoading } = useScheduleSummary();
  const hue      = 256;
  const today    = data?.todayCount ?? 0;
  const overdue  = data?.overdueCount ?? 0;
  const first    = data?.firstTitle;

  return (
    <HubCard hue={hue} pos="tr" delay={0.07} label="Schedule">
      {/* Primary number */}
      <p className="text-[22px] font-semibold leading-none text-white/88">
        {isLoading ? "…" : `${today} today`}
      </p>

      <Divider hue={hue} />

      <div className="flex flex-col gap-1.5">
        {isLoading ? (
          <p className="text-[11px] text-white/35">Loading…</p>
        ) : (
          <>
            <StatRow
              hue={hue}
              label="Overdue"
              value={overdue > 0 ? `${overdue} need attention` : "All clear"}
              accent={overdue > 0}
            />
            {first && (
              <StatRow hue={hue} label="Next up" value={first} />
            )}
          </>
        )}
      </div>
    </HubCard>
  );
}

function ChefCard() {
  const { data, isLoading } = useChefSummary();
  const hue = 28;

  const count    = data?.recipeCount ?? 0;
  const cooked   = data?.cookedCount ?? 0;
  const last     = data?.lastCooked;
  const cuisines = data?.cuisineCount ?? 0;

  return (
    <HubCard hue={hue} pos="bl" delay={0.14} label="Kitchen">
      <p className="text-[22px] font-semibold leading-none text-white/88">
        {isLoading ? "…" : `${count} recipes`}
      </p>

      <Divider hue={hue} />

      <div className="flex flex-col gap-1.5">
        {isLoading ? (
          <p className="text-[11px] text-white/35">Loading…</p>
        ) : (
          <>
            <StatRow hue={hue} label="Cuisines" value={cuisines > 0 ? `${cuisines} styles` : "—"} />
            <StatRow hue={hue} label="Cooked" value={cooked > 0 ? `${cooked} times` : "Not yet"} />
            {last && (
              <StatRow hue={hue} label="Last made" value={last} accent />
            )}
          </>
        )}
      </div>
    </HubCard>
  );
}

function BrainCard() {
  const { data, isLoading } = useBrainSummary();
  const hue = 220;

  const count     = data?.memoryCount ?? 0;
  const lastLabel = data?.lastLabel;
  const lastValue = data?.lastValue;

  return (
    <HubCard hue={hue} pos="br" delay={0.21} label="Memory">
      <p className="text-[22px] font-semibold leading-none text-white/88">
        {isLoading ? "…" : `${count} saved`}
      </p>

      <Divider hue={hue} />

      <div className="flex flex-col gap-1.5">
        {isLoading ? (
          <p className="text-[11px] text-white/35">Loading…</p>
        ) : count === 0 ? (
          <p className="text-[11px] text-white/30">No memories yet</p>
        ) : (
          <>
            {lastLabel && (
              <StatRow hue={hue} label="Latest" value={lastLabel} accent />
            )}
            {lastValue && (
              <StatRow hue={hue} label="Value" value={lastValue} />
            )}
          </>
        )}
      </div>
    </HubCard>
  );
}

export function HubScatterWidgets() {
  return (
    <>
      <BudgetCard />
      <ScheduleCard />
      <ChefCard />
      <BrainCard />
    </>
  );
}
