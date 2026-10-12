"use client";

// HubScatterWidgets — 4 compact floating stat cards positioned around the ERA DOT in hub view.
// Each card manages its own AnimatePresence and settles into place on wake.
// Desktop only (hidden on mobile via "hidden md:block").

import { useEraStore } from "@/features/era/useEraStore";
import { useBrainSummary } from "@/features/era/widgets/useBrainSummary";
import { useBudgetSummary } from "@/features/era/widgets/useBudgetSummary";
import { useChefSummary } from "@/features/era/widgets/useChefSummary";
import { useScheduleSummary } from "@/features/era/widgets/useScheduleSummary";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React, { useMemo } from "react";
import styles from "./EraMotion.module.css";

const POS: Record<string, React.CSSProperties> = {
  tl: { top: "12%", left: "3%" },
  tr: { top: "10%", right: "3%" },
  bl: { bottom: "20%", left: "3%" },
  br: { bottom: "22%", right: "3%" },
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
  const isHub   = useEraStore((s) => s.activeView === "hub");
  const isAwake = useEraStore((s) => s.isAwake);
  const show    = isHub && isAwake;
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`era-scatter-card absolute hidden md:flex w-[340px] flex-col rounded-2xl overflow-hidden ${styles.card}`}
          style={{
            ...POS[pos],
            "--card-hue": hue,
            background: `hsla(${hue}, 20%, 7%, 0.92)`,
            border: `1px solid hsla(${hue}, 55%, 50%, 0.28)`,
            backdropFilter: "blur(18px)",
          } as React.CSSProperties}
          initial={reducedMotion ? false : { y: pos.startsWith("t") ? -12 : 12, scale: 0.975, opacity: 0 }}
          animate={{
            y: 0,
            scale: 1,
            opacity: 1,
            transition: { delay: reducedMotion ? 0 : delay, duration: reducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] },
          }}
          exit={{
            opacity: 0,
            transition: { duration: reducedMotion ? 0 : 0.15, ease: "easeIn" },
          }}
        >
          {/* Top accent edge */}
          <div
            className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
            style={{ background: `hsl(${hue}, 75%, 65%)`, opacity: 0.9 }}
          />
          {/* Bottom accent edge */}
          <div
            className="absolute inset-x-0 bottom-0 h-px rounded-b-2xl"
            style={{ background: `hsl(${hue}, 70%, 62%)`, opacity: 0.35 }}
          />

          {/* A single quiet light pass, never a repeating sweep over the data. */}
          {!reducedMotion && (
            <div className={styles.cardSheen} aria-hidden="true">
              <motion.span
                initial={{ x: "-120%" }}
                animate={{ x: "120%" }}
                transition={{ delay: delay + 0.2, duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 p-5 w-full">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: `hsla(${hue}, 65%, 68%, 0.55)` }}
            >
              {label}
            </span>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Divider({ hue }: { hue: number }) {
  return (
    <div
      className="h-px w-full"
      style={{ background: `hsla(${hue}, 40%, 50%, 0.12)` }}
    />
  );
}

// ── Headline + delta chip ──────────────────────────────────────────────────

function Headline({
  hue,
  value,
  deltaPct,
}: {
  hue: number;
  value: string;
  deltaPct?: number | null;
}) {
  const showDelta = typeof deltaPct === "number" && Number.isFinite(deltaPct);
  const up = showDelta && deltaPct! > 0;
  const flat = showDelta && Math.abs(deltaPct!) < 1;

  return (
    <div className="flex items-baseline gap-2">
      <p className="text-[30px] font-semibold leading-none text-white/90">
        {value}
      </p>
      {showDelta && (
        <span
          className="rounded-full px-1.5 py-[1px] text-[10px] font-semibold"
          style={{
            background: flat
              ? "rgba(255,255,255,0.06)"
              : up
                ? "hsla(0, 60%, 50%, 0.16)"
                : `hsla(${hue}, 60%, 50%, 0.16)`,
            color: flat
              ? "rgba(255,255,255,0.45)"
              : up
                ? "hsl(0, 70%, 70%)"
                : `hsl(${hue}, 70%, 70%)`,
          }}
        >
          {flat ? "—" : `${up ? "▲" : "▼"} ${Math.abs(Math.round(deltaPct!))}%`}
        </span>
      )}
    </div>
  );
}

// ── Inline SVG sparkline (no Recharts) ────────────────────────────────────

function Sparkline({
  data,
  hue,
  width = 218,
  height = 32,
}: {
  data: number[];
  hue: number;
  width?: number;
  height?: number;
}) {
  if (!data.length) {
    return <div className="h-6 w-full" aria-hidden />;
  }
  const max = Math.max(1, ...data);
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = `hsl(${hue}, 70%, 65%)`;
  const fillId = `era-spark-${hue}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon
        fill={`url(#${fillId})`}
        points={`0,${height} ${points} ${width},${height}`}
      />
    </svg>
  );
}

// ── List rows ──────────────────────────────────────────────────────────────

function ListRow({
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
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="truncate text-[13px] text-white/60">{label}</span>
      <span
        className="shrink-0 text-[13px] font-medium"
        style={{
          color: accent ? `hsl(${hue}, 65%, 70%)` : "rgba(255,255,255,0.7)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

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
      <span className="text-[13px] text-white/42">{label}</span>
      <span
        className="text-[13px] font-medium truncate max-w-[160px] text-right"
        style={{
          color: accent ? `hsl(${hue}, 65%, 68%)` : "rgba(255,255,255,0.7)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Per-module cards ───────────────────────────────────────────────────────

function BudgetCard({ delay }: { delay: number }) {
  const { data, isLoading } = useBudgetSummary();
  const hue = 175;

  const total = data?.total ?? 0;
  const top3 = data?.top3Categories ?? [];
  const spark = data?.last7Days ?? [];
  const dailyAvg = data?.dailyAvg ?? 0;
  const txCount = data?.txCount ?? 0;

  return (
    <HubCard hue={hue} pos="tl" delay={delay} label="Expenses">
      <Headline
        hue={hue}
        value={isLoading ? "…" : fmt(total)}
        deltaPct={data?.deltaPct ?? null}
      />

      <Sparkline data={spark} hue={hue} />

      <Divider hue={hue} />

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-[13px] text-white/35">Loading…</p>
        ) : top3.length === 0 ? (
          <p className="text-[13px] text-white/35">No transactions yet</p>
        ) : (
          top3.map((c, i) => (
            <ListRow
              key={c.name}
              hue={hue}
              label={c.name}
              value={fmt(c.amount)}
              accent={i === 0}
            />
          ))
        )}
      </div>

      <Divider hue={hue} />

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-white/40">
          {txCount > 0 ? `${txCount} tx` : "—"}
        </span>
        <span className="text-[12px] text-white/40">
          {dailyAvg > 0 ? `${fmt(dailyAvg)}/day` : ""}
        </span>
      </div>
    </HubCard>
  );
}

function ScheduleCard({ delay }: { delay: number }) {
  const { data, isLoading } = useScheduleSummary();
  const hue = 256;

  const today = data?.todayCount ?? 0;
  const overdue = data?.overdueCount ?? 0;
  const tomorrow = data?.tomorrowCount ?? 0;
  const week = data?.thisWeekCount ?? 0;
  const unscheduled = data?.unscheduledCount ?? 0;
  const next = data?.nextThree ?? [];

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const same = d.toDateString() === now.toDateString() ? "Today" : "";
    const tomorrowD = new Date(now);
    tomorrowD.setDate(now.getDate() + 1);
    const isTomorrow =
      d.toDateString() === tomorrowD.toDateString() ? "Tmrw" : "";
    const time = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${same || isTomorrow || d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  };

  return (
    <HubCard hue={hue} pos="tr" delay={delay} label="Schedule">
      <Headline hue={hue} value={isLoading ? "…" : `${today} today`} />

      <Divider hue={hue} />

      <div className="flex flex-col gap-1">
        <StatRow
          hue={hue}
          label="Overdue"
          value={overdue > 0 ? `${overdue}` : "0"}
          accent={overdue > 0}
        />
        <StatRow hue={hue} label="Tomorrow" value={`${tomorrow}`} />
        <StatRow hue={hue} label="This week" value={`${week}`} />
        {unscheduled > 0 && (
          <StatRow
            hue={hue}
            label="No date"
            value={`${unscheduled}`}
            accent={false}
          />
        )}
      </div>

      <Divider hue={hue} />

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-[13px] text-white/35">Loading…</p>
        ) : next.length === 0 ? (
          <p className="text-[13px] text-white/35">
            {unscheduled > 0 ? `${unscheduled} items — no due date` : "All clear"}
          </p>
        ) : (
          next.map((it, i) => (
            <ListRow
              key={it.id}
              hue={hue}
              label={it.title}
              value={fmtTime(it.scheduledAt)}
              accent={i === 0}
            />
          ))
        )}
      </div>
    </HubCard>
  );
}

function ChefCard({ delay }: { delay: number }) {
  const { data, isLoading } = useChefSummary();
  const hue = 28;

  const count = data?.recipeCount ?? 0;
  const cookedMonth = data?.cookedThisMonth ?? 0;
  const cuisines = data?.top3Cuisines ?? [];
  const mostMade = data?.mostMade;

  return (
    <HubCard hue={hue} pos="bl" delay={delay} label="Kitchen">
      <Headline hue={hue} value={isLoading ? "…" : `${count} recipes`} />

      <Divider hue={hue} />

      <div className="flex items-center justify-between">
        <StatRow
          hue={hue}
          label="Cooked this month"
          value={`${cookedMonth}`}
          accent={cookedMonth > 0}
        />
      </div>
      {mostMade && (
        <div className="flex items-center justify-between">
          <StatRow
            hue={hue}
            label="Most made"
            value={`${mostMade.name} ×${mostMade.times}`}
          />
        </div>
      )}

      <Divider hue={hue} />

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-[13px] text-white/35">Loading…</p>
        ) : cuisines.length === 0 ? (
          <p className="text-[13px] text-white/35">No recipes yet</p>
        ) : (
          cuisines.map((c, i) => (
            <ListRow
              key={c.name}
              hue={hue}
              label={c.name}
              value={`${c.count}`}
              accent={i === 0}
            />
          ))
        )}
      </div>
    </HubCard>
  );
}

function BrainCard({ delay }: { delay: number }) {
  const { data, isLoading } = useBrainSummary();
  const hue = 220;

  const count = data?.memoryCount ?? 0;
  const lastLabel = data?.lastLabel;
  const lastValue = data?.lastValue;

  return (
    <HubCard hue={hue} pos="br" delay={delay} label="Memory">
      <p className="text-[30px] font-semibold leading-none text-white/90">
        {isLoading ? "…" : `${count} saved`}
      </p>

      <Divider hue={hue} />

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-[13px] text-white/35">Loading…</p>
        ) : count === 0 ? (
          <p className="text-[13px] text-white/30">No memories yet</p>
        ) : (
          <>
            {lastLabel && (
              <StatRow hue={hue} label="Latest" value={lastLabel} accent />
            )}
            {lastValue && <StatRow hue={hue} label="Value" value={lastValue} />}
          </>
        )}
      </div>
    </HubCard>
  );
}

export function HubScatterWidgets() {
  const isAwake = useEraStore((s) => s.isAwake);

  // Shuffle the appearance order every time ERA wakes — keeps each wake-up feeling fresh.
  const [d0, d1, d2, d3] = useMemo(() => {
    const slots = [0.04, 0.16, 0.29, 0.42];
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    return slots;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAwake]);

  return (
    <>
      <BudgetCard delay={d0} />
      <ScheduleCard delay={d1} />
      <ChefCard delay={d2} />
      <BrainCard delay={d3} />
    </>
  );
}
