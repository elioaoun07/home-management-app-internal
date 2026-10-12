"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shared/DropdownMenu";
import {
  FitnessApiError, useFitnessView, useMarkCelebrated, useResolveHeld, useStartSession, useUpdatePreferences, type FinishResult,
} from "@/features/fitness/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { FIXTURE_STATES, type FixtureState } from "@/lib/fitness/fixtures";
import { resultLabel } from "@/lib/fitness/format";
import {
  localDate, localWeekStart, nextSlot, pendingCelebrations, trainingStreak, weekSlots, type SlotView,
} from "@/lib/fitness/progress";
import type { RewardEvent } from "@/lib/fitness/types";
import { instant, springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { parseISO } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Settings2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Celebration } from "./Celebration";
import { CoreIcon, PlanIcon, ProgressIcon, QuestIcon } from "./FitnessIcons";
import { useFitnessPalette } from "./fitnessTheme";
import { GhostButton, Panel, Pill, PrimaryButton } from "./fitnessUi";
import { ImportSheet } from "./ImportSheet";
import { PlaceSheet } from "./PlaceSheet";
import { PlanTab } from "./PlanTab";
import { ProgressTab } from "./ProgressTab";
import { QuestsTab } from "./QuestsTab";
import { TodayTab } from "./TodayTab";
import { WorkoutScreen } from "./WorkoutScreen";

type Tab = "today" | "plan" | "quests" | "progress";
const TABS: { id: Tab; label: string; Icon: typeof CoreIcon }[] = [
  { id: "today", label: "Today", Icon: CoreIcon },
  { id: "plan", label: "Plan", Icon: PlanIcon },
  { id: "quests", label: "Quests", Icon: QuestIcon },
  { id: "progress", label: "Progress", Icon: ProgressIcon },
];

export default function FitnessPage() {
  const tc = useThemeClasses();
  const pal = useFitnessPalette();
  const reduced = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fixtureParam = params.get("fixture") as FixtureState | null;
  // Synthetic visual states are a development tool only.
  const fixture = process.env.NODE_ENV !== "production" && fixtureParam && FIXTURE_STATES.includes(fixtureParam) ? fixtureParam : null;
  const tab = (params.get("tab") as Tab) || "today";
  const workoutOpen = params.get("w") === "1";
  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (v === null) next.delete(k); else next.set(k, v);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const { query, view } = useFitnessView(fixture);
  const start = useStartSession();
  const prefs = useUpdatePreferences();
  const celebrated = useMarkCelebrated();
  const resolve = useResolveHeld();
  const [importFor, setImportFor] = useState<{ open: boolean; planId?: string }>({ open: false });
  const [placing, setPlacing] = useState<SlotView | null>(null);
  const [focusPlan, setFocusPlan] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinishResult | null>(null);
  const [localSeen, setLocalSeen] = useState<string[]>([]);

  const bundle = view?.bundle ?? null;
  const week = localWeekStart();
  const slots = useMemo(
    () => (bundle?.live_plan ? weekSlots(bundle.live_plan, bundle.recent_sessions, bundle.open_session, week) : []),
    [bundle, week],
  );
  const next = nextSlot(slots);
  const streak = bundle?.live_plan
    ? trainingStreak({
        weeks: bundle.weeks, currentWeek: week, activatedWeek: bundle.live_plan.plan.activated_week,
        activatedOn: bundle.live_plan.plan.activated_at ? localDate(parseISO(bundle.live_plan.plan.activated_at)) : null,
        pauses: bundle.live_plan.pauses, target: bundle.live_plan.version.training_target,
      })
    : 0;
  const queue: RewardEvent[] = bundle ? pendingCelebrations(bundle.rewards.events).filter((e) => !localSeen.includes(e.source_key)) : [];
  const celebrating = !workoutOpen && !summary ? queue[0] ?? null : null;

  // A workout opened via ?w=1 that no longer exists (finished elsewhere) closes itself.
  useEffect(() => {
    if (workoutOpen && bundle && !bundle.open_session && !start.isPending) setParam("w", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutOpen, bundle?.open_session?.id, start.isPending]);

  const startSlot = (s: SlotView) => {
    if (!bundle?.live_plan) return;
    if (bundle.open_session) { setParam("w", "1"); return; }
    if (fixture) return;   // display-only
    start.mutate(
      { planId: bundle.live_plan.plan.id, slotId: s.slot.id, workoutId: s.workout?.id ?? null, label: s.title },
      {
        onSuccess: () => setParam("w", "1"),
        onError: (e) => { if (e instanceof FitnessApiError && e.body.reason === "open_session") setParam("w", "1"); },
      },
    );
  };

  const doneCelebrating = () => {
    if (!celebrating) return;
    setLocalSeen((s) => [...s, celebrating.source_key]);
    if (!fixture) celebrated.mutate([celebrating.source_key]);
  };

  if (query.isLoading || (!bundle && !query.error)) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", tc.pageBg)}>
        <Loader2 className={cn("w-8 h-8 animate-spin", pal.faint)} />
      </div>
    );
  }
  if (!bundle) {
    const setup = (query.error as FitnessApiError | null)?.status === 503;
    return (
      <div className={cn("min-h-screen px-4 pt-24", tc.pageBg)}>
        <Panel className="max-w-md mx-auto text-center">
          <p className={cn("font-medium", pal.ink)}>{setup ? "Fitness setup pending" : "Fitness unavailable"}</p>
          {setup && <p className={cn("text-xs mt-1", pal.faint)}>migrations/2026-10-12_fitness-module.sql</p>}
          {!setup && <GhostButton className="mt-3" onClick={() => query.refetch()}>Retry</GhostButton>}
        </Panel>
      </div>
    );
  }

  const p = bundle.preferences;
  const toggle = (key: "effects_enabled" | "sound_enabled" | "share_summary") => {
    if (fixture) return;
    prefs.mutate({ patch: { [key]: !p[key] }, previous: { [key]: p[key] }, quiet: key !== "share_summary" });
  };

  return (
    <div className={cn("min-h-screen pb-28", tc.pageBg)}>
      <div className="max-w-2xl mx-auto px-4 pt-20">
        {/* Tabs + settings — below the global fixed h-16 header (Hard Rule 16) */}
        <div className="flex items-center gap-2 mb-4">
          <div className={cn("flex-1 flex rounded-2xl p-1", tc.tabsListBg)} role="tablist">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id} role="tab" aria-selected={active}
                  onClick={() => setParam("tab", id === "today" ? null : id)}
                  className={cn("relative flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs sm:text-sm font-medium", active ? tc.text : pal.mute)}
                >
                  {active && <motion.span layoutId="fitness-tab" transition={instant(reduced, springs.snappy)} className={cn("absolute inset-0 rounded-xl", tc.tabsTriggerActive)} />}
                  <Icon size={16} className="relative" />
                  <span className="relative">{label}</span>
                </button>
              );
            })}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Fitness settings" className={cn("w-11 h-11 rounded-xl border flex items-center justify-center", pal.line, pal.mute)}>
              <Settings2 className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {([["effects_enabled", "Effects"], ["sound_enabled", "Rest sound"], ["share_summary", "Share rank with partner"]] as const).map(([k, label]) => (
                <DropdownMenuItem key={k} onSelect={(e) => { e.preventDefault(); toggle(k); }} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <span className={cn("w-8 h-5 rounded-full relative transition-colors", p[k] ? "" : pal.chip)} style={p[k] ? { background: pal.a } : undefined}>
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", p[k] ? "left-3.5" : "left-0.5")} />
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {fixture && <p className={cn("text-[11px] mb-2 text-center", pal.faint)}>Fixture · {fixture}</p>}

        {view && (view.pendingCount > 0 || view.held.length > 0) && (
          <Panel className="mb-4">
            {view.pendingCount > 0 && <p className={cn("text-sm", pal.mute)}><Pill tone="pending">Pending</Pill> {view.pendingCount} to sync</p>}
            {view.held.map((op) => (
              <div key={op.id} className="flex items-center gap-2 mt-2">
                <span className={cn("flex-1 min-w-0 text-sm truncate", pal.ink)}>{op.label ?? op.body.op}</span>
                <GhostButton className="h-9" onClick={() => resolve.mutate({ op, keep: true })}>Keep mine</GhostButton>
                <GhostButton className="h-9" onClick={() => resolve.mutate({ op, keep: false })}>Discard</GhostButton>
              </div>
            ))}
          </Panel>
        )}

        {tab === "today" && (
          <TodayTab
            bundle={bundle} slots={slots} next={next} streak={streak}
            pendingFinish={(view?.pendingFinish.size ?? 0) > 0}
            onStart={startSlot} onResume={() => setParam("w", "1")} onPlace={setPlacing}
            onImport={() => setImportFor({ open: true })}
          />
        )}
        {tab === "plan" && (
          <PlanTab bundle={bundle} slots={slots} focusPlanId={focusPlan} readOnly={!!fixture}
            onImport={(planId) => setImportFor({ open: true, planId })} onPlace={setPlacing} onStart={startSlot} />
        )}
        {tab === "quests" && <QuestsTab bundle={bundle} readOnly={!!fixture} />}
        {tab === "progress" && <ProgressTab bundle={bundle} streak={streak} readOnly={!!fixture} />}
      </div>

      <ImportSheet
        open={importFor.open} planId={importFor.planId}
        onClose={() => setImportFor({ open: false })}
        onOpenExisting={(id) => { setFocusPlan(id); setParam("tab", "plan"); }}
      />
      <PlaceSheet slot={placing} onClose={() => setPlacing(null)} onStart={startSlot} readOnly={!!fixture} />

      {workoutOpen && bundle.open_session && (
        <WorkoutScreen
          session={bundle.open_session}
          previous={bundle.previous_sets}
          soundEnabled={p.sound_enabled}
          readOnly={!!fixture}
          onMinimize={() => setParam("w", null)}
          onFinished={(r) => { setParam("w", null); setSummary(r ?? { session: { ...bundle.recent_sessions[0] } }); }}
        />
      )}

      {summary && <FinishSummary result={summary} onClose={() => setSummary(null)} />}
      <Celebration event={celebrating} effects={p.effects_enabled} onDone={doneCelebrating} />
    </div>
  );
}

function FinishSummary({ result, onClose }: { result: FinishResult; onClose: () => void }) {
  const pal = useFitnessPalette();
  const tc = useThemeClasses();
  const xp = result.rewards?.events.filter((e) => e.kind === "xp").reduce((n, e) => n + e.xp, 0) ?? 0;
  const records = result.rewards?.events.filter((e) => e.kind === "record") ?? [];
  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={cn("relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]", tc.bgPage, pal.line)} role="dialog" aria-label="Workout summary">
        <p className={cn("text-[11px] uppercase tracking-widest", pal.faint)}>Done</p>
        <p className={cn("text-xl font-semibold", pal.ink)}>{result.session?.workout_name ?? "Workout"}</p>
        {result.rewards ? (
          <div className="flex gap-2 mt-3">
            <Pill tone="accent">+{xp} XP</Pill>
            {records.length > 0 && <Pill tone="accent">{records.length} record{records.length > 1 ? "s" : ""}</Pill>}
            <Pill>L{result.rewards.totals.level}</Pill>
          </div>
        ) : (
          <div className="mt-3"><Pill tone="pending">Rewards pending</Pill></div>
        )}
        {records.length > 0 && (
          <ul className="mt-3 space-y-1">
            {records.map((r) => (
              <li key={r.source_key} className={cn("text-sm", pal.ink)}>
                {String(r.payload.exercise)} <span className={pal.mute}>· {resultLabel({ status: "done", reps: r.payload.metric === "reps" ? Number(r.payload.value) : null, load_kg: r.payload.metric === "load" ? Number(r.payload.value) : null, duration_seconds: r.payload.metric === "duration" ? Number(r.payload.value) : null, distance_m: r.payload.metric === "distance" ? Number(r.payload.value) : null, load_kind: "external" })}</span>
              </li>
            ))}
          </ul>
        )}
        <PrimaryButton className="w-full mt-5" onClick={onClose}>Close</PrimaryButton>
      </div>
    </div>
  );
}
