"use client";

import { RANK_LABEL, levelProgress, type SlotView } from "@/lib/fitness/progress";
import type { FitnessBundle } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Check, Play, Plus } from "lucide-react";
import { DumbbellIcon, RecoveryIcon } from "./FitnessIcons";
import { useFitnessPalette } from "./fitnessTheme";
import { GhostButton, Meter, Panel, Pill, PrimaryButton, SectionTitle } from "./fitnessUi";
import { ProgressCore } from "./ProgressCore";

interface Props {
  bundle: FitnessBundle;
  slots: SlotView[];
  next: SlotView | null;
  streak: number;
  pendingFinish: boolean;
  onStart: (slot: SlotView) => void;
  onResume: () => void;
  onPlace: (slot: SlotView) => void;
  onImport: () => void;
}

export function TodayTab({ bundle, slots, next, streak, pendingFinish, onStart, onResume, onPlace, onImport }: Props) {
  const pal = useFitnessPalette();
  const lp = levelProgress(bundle.rewards.totals.xp, bundle.rules);
  const open = bundle.open_session;
  const live = bundle.live_plan;
  const cosmetic = bundle.preferences.cosmetic ?? lp.rank;
  const doneCount = slots.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="pt-2">
        <ProgressCore
          xp={lp.xp} level={lp.level} pct={lp.pct} rank={lp.rank} cosmetic={cosmetic}
          segments={slots.map((s) => s.status)} effects={bundle.preferences.effects_enabled} pending={pendingFinish}
        />
        <div className="mt-2 flex items-center justify-center gap-4 text-xs">
          <span className={pal.mute}><b className={cn("tabular-nums", pal.ink)}>{doneCount}/{slots.length || 0}</b> week</span>
          <span className={pal.mute}><b className={cn("tabular-nums", pal.ink)}>{streak}</b> streak</span>
          <span className={pal.mute}>{lp.nextRank ? <>{lp.xpPerLevel - lp.xpInLevel} XP → L{lp.level + 1}</> : RANK_LABEL[lp.rank]}</span>
        </div>
      </div>

      {open ? (
        <Panel glow>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={cn("text-[11px] uppercase tracking-widest", pal.faint)}>In progress</p>
              <p className={cn("text-lg font-semibold truncate", pal.ink)}>{open.workout_name}</p>
              <p className={cn("text-xs", pal.mute)}>{open.sets.length} logged{open.pending ? " · Pending" : ""}</p>
            </div>
            <PrimaryButton onClick={onResume}><Play className="w-4 h-4" /> Resume</PrimaryButton>
          </div>
        </Panel>
      ) : next ? (
        <Panel glow>
          <p className={cn("text-[11px] uppercase tracking-widest", pal.faint)}>Next</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${pal.a}1f`, color: pal.a }}>
              {next.workout && (next.workout.kind === "mobility" || next.workout.kind === "recovery") ? <RecoveryIcon size={22} /> : <DumbbellIcon size={22} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-lg font-semibold truncate", pal.ink)}>{next.title}</p>
              <p className={cn("text-xs", pal.mute)}>
                {[next.workout?.exercises.length ? `${next.workout.exercises.length} exercises` : null,
                  next.workout?.estimated_minutes ? `${next.workout.estimated_minutes} min` : null,
                  next.placement ? format(parseISO(next.placement.date), "EEE") + (next.placement.time ? ` ${next.placement.time.slice(0, 5)}` : "") : null]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <PrimaryButton className="w-full mt-4 h-14 text-base" onClick={() => onStart(next)}><Play className="w-5 h-5" /> Start</PrimaryButton>
        </Panel>
      ) : live ? (
        <Panel>
          <p className={cn("text-center text-sm py-2", pal.mute)}>{live.plan.status === "paused" ? "Plan paused" : "Week complete"}</p>
        </Panel>
      ) : (
        <Panel>
          <p className={cn("text-center text-sm", pal.mute)}>No active plan</p>
          <PrimaryButton className="w-full mt-3" onClick={onImport}><Plus className="w-4 h-4" /> Import plan</PrimaryButton>
        </Panel>
      )}

      {slots.length > 0 && (
        <Panel>
          <SectionTitle>This week</SectionTitle>
          <ul className="grid grid-cols-2 gap-2">
            {slots.map((s) => (
              <li key={s.slot.id}>
                <button
                  onClick={() => (s.status === "done" ? undefined : s.status === "active" ? onResume() : onPlace(s))}
                  className={cn("w-full text-left rounded-xl border px-3 py-2.5 transition-colors", pal.line)}
                  style={s.status === "done" ? { borderColor: `${pal.a}66`, background: `${pal.a}14` } : undefined}
                >
                  <span className="flex items-center gap-1.5">
                    {s.status === "done" && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: pal.a }} />}
                    <span className={cn("text-sm font-medium truncate", pal.ink)}>{s.title}</span>
                  </span>
                  <span className={cn("block text-[11px] mt-0.5", pal.faint)}>
                    {s.status === "active" ? "In progress" : s.status === "skipped" ? "Skipped" : s.placement ? format(parseISO(s.placement.date), "EEE d") + (s.placement.time ? ` · ${s.placement.time.slice(0, 5)}` : "") : s.status === "done" ? "Done" : "Anytime"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!!live && live.version.training_target > 0 && (
            <div className="mt-3">
              <Meter value={slots.filter((s) => s.status === "done" && s.workout && (s.workout.kind === "strength" || s.workout.kind === "cardio")).length} max={live.version.training_target} />
            </div>
          )}
        </Panel>
      )}

      {bundle.partner && (
        <Panel className={cn("border", pal.partner.ring)}>
          <div className="flex items-center gap-3">
            <span className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold", pal.partner.bg, pal.partner.text)}>
              {RANK_LABEL[bundle.partner.rank].slice(0, 1)}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", pal.partner.text)}>Partner · {RANK_LABEL[bundle.partner.rank]}</p>
              <p className={cn("text-xs", pal.faint)}>{bundle.partner.week.done}/{bundle.partner.week.target} this week · {bundle.partner.badges.length} badges</p>
            </div>
            {bundle.partner.week.target > 0 && bundle.partner.week.done >= bundle.partner.week.target && <Pill tone="accent">Done</Pill>}
          </div>
        </Panel>
      )}

      {live && !open && next && (
        <div className="flex justify-center">
          <GhostButton onClick={() => onPlace(next)}>Place {next.title}</GhostButton>
        </div>
      )}
    </div>
  );
}
