"use client";

import { usePlanAction } from "@/features/fitness/hooks";
import { prescriptionLabel } from "@/lib/fitness/format";
import { isActivationReady } from "@/lib/fitness/ptPlan";
import { localWeekStart, shiftWeek, type SlotView } from "@/lib/fitness/progress";
import type { FitnessBundle, FitnessPlanSummary } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, Archive, CalendarClock, Pause, Play, Plus, RotateCcw, Upload } from "lucide-react";
import { useState } from "react";
import { useFitnessPalette } from "./fitnessTheme";
import { GhostButton, Panel, Pill, PrimaryButton, SectionTitle } from "./fitnessUi";

interface Props {
  bundle: FitnessBundle;
  slots: SlotView[];
  focusPlanId: string | null;
  readOnly?: boolean;
  onImport: (planId?: string) => void;
  onPlace: (slot: SlotView) => void;
  onStart: (slot: SlotView) => void;
}

const STATUS_TONE: Record<string, "accent" | "pending" | "mute"> = { active: "accent", ready: "accent", draft: "pending", paused: "pending", archived: "mute" };

export function PlanTab({ bundle, slots, focusPlanId, readOnly, onImport, onPlace, onStart }: Props) {
  const pal = useFitnessPalette();
  const action = usePlanAction();
  const live = bundle.live_plan;
  const [activating, setActivating] = useState<string | null>(null);
  const others = bundle.plans.filter((p) => p.id !== live?.plan.id);
  const run = (fn: () => void) => (readOnly ? undefined : fn());

  return (
    <div className="space-y-4">
      {live ? (
        <Panel glow>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn("text-lg font-semibold", pal.ink)}>{live.plan.name}</p>
              <p className={cn("text-xs", pal.mute)}>
                {[live.version.content.trainer, `v${live.version.version}`,
                  live.plan.activated_week ? `from ${format(parseISO(live.plan.activated_week), "MMM d")}` : null,
                  live.plan.ends_week ? `to ${format(addDays(parseISO(live.plan.ends_week), -1), "MMM d")}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Pill tone={STATUS_TONE[live.plan.status]}>{live.plan.status}</Pill>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {live.plan.status === "active" ? (
              <GhostButton onClick={() => run(() => action.mutate({ planId: live.plan.id, action: "pause" }))}><Pause className="w-4 h-4" /> Pause</GhostButton>
            ) : (
              <GhostButton onClick={() => run(() => action.mutate({ planId: live.plan.id, action: "resume" }))}><Play className="w-4 h-4" /> Resume</GhostButton>
            )}
            <GhostButton onClick={() => onImport(live.plan.id)}><Upload className="w-4 h-4" /> Version</GhostButton>
            <GhostButton onClick={() => run(() => action.mutate({ planId: live.plan.id, action: "archive" }))}><Archive className="w-4 h-4" /> Archive</GhostButton>
          </div>
        </Panel>
      ) : (
        <PrimaryButton className="w-full" onClick={() => onImport()}><Plus className="w-4 h-4" /> Import plan</PrimaryButton>
      )}

      {live && (
        <Panel>
          <SectionTitle>Weekly slots</SectionTitle>
          <ul className="space-y-2">
            {slots.map((s) => (
              <li key={s.slot.id} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", pal.line)}>
                <span className={cn("w-6 text-xs tabular-nums", pal.faint)}>{s.index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium truncate", pal.ink)}>{s.title}</p>
                  <p className={cn("text-[11px]", pal.faint)}>
                    {s.status === "done" ? "Done" : s.placement ? format(parseISO(s.placement.date), "EEE d") + (s.placement.time ? ` · ${s.placement.time.slice(0, 5)}` : "") : "Anytime"}
                  </p>
                </div>
                {live.plan.status === "active" && s.status !== "done" && (
                  <>
                    <GhostButton className="h-9 px-2.5" aria-label={`Place ${s.title}`} onClick={() => onPlace(s)}><CalendarClock className="w-4 h-4" /></GhostButton>
                    {s.status === "open" && <GhostButton className="h-9 px-2.5" aria-label={`Start ${s.title}`} onClick={() => onStart(s)}><Play className="w-4 h-4" /></GhostButton>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {live && (
        <Panel>
          <SectionTitle>Workouts</SectionTitle>
          <div className="space-y-2">
            {live.version.content.workouts.map((w) => (
              <details key={w.id} className={cn("rounded-xl border px-3 py-2", pal.line)}>
                <summary className={cn("text-sm font-medium cursor-pointer", pal.ink)}>
                  {w.name} <span className={cn("font-normal", pal.faint)}>· {w.kind}{w.estimated_minutes ? ` · ${w.estimated_minutes} min` : ""}</span>
                </summary>
                <ul className="mt-2 space-y-2">
                  {w.exercises.map((e) => (
                    <li key={e.id} className="text-xs">
                      <p className={pal.ink}>
                        {e.name}
                        <span className={pal.faint}> · {e.phase}{e.equipment ? ` · ${e.equipment}` : ""}{e.group_id ? ` · ${e.group_mode} ${e.group_id}` : ""}</span>
                      </p>
                      <ol className={cn("mt-0.5", pal.mute)}>
                        {e.sets.map((s, i) => <li key={i}>{s.kind === "warmup" ? "W" : i + 1}. {prescriptionLabel(s)}{s.rest_seconds ? ` · rest ${s.rest_seconds}s` : ""}</li>)}
                      </ol>
                      {e.notes && <p className={pal.faint}>{e.notes}</p>}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {live.version.content.progression_notes && <p className={cn("text-xs pt-1", pal.mute)}>{live.version.content.progression_notes}</p>}
          </div>
        </Panel>
      )}

      {others.length > 0 && (
        <Panel>
          <SectionTitle>Plans</SectionTitle>
          <ul className="space-y-2">
            {others.map((p) => (
              <PlanRow
                key={p.id} plan={p} highlighted={p.id === focusPlanId} canActivate={!live}
                activating={activating === p.id} onToggleActivate={() => setActivating((v) => (v === p.id ? null : p.id))}
                readOnly={readOnly}
              />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function PlanRow({ plan, highlighted, canActivate, activating, onToggleActivate, readOnly }: {
  plan: FitnessPlanSummary; highlighted: boolean; canActivate: boolean; activating: boolean; onToggleActivate: () => void; readOnly?: boolean;
}) {
  const pal = useFitnessPalette();
  const action = usePlanAction();
  const [week, setWeek] = useState(localWeekStart());
  const review = plan.issues.filter((i) => i.blocking && !i.fix);
  const needsFix = plan.issues.filter((i) => i.blocking && i.fix);
  const [ack, setAck] = useState<string[]>(plan.acknowledged);
  const ready = isActivationReady(plan.issues, ack);

  return (
    <li className={cn("rounded-xl border px-3 py-2.5", pal.line)} style={highlighted ? { borderColor: pal.a } : undefined}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium truncate", pal.ink)}>{plan.name}</p>
          <p className={cn("text-[11px]", pal.faint)}>{[plan.trainer, `${plan.slot_count}/week`, plan.duration_weeks ? `${plan.duration_weeks} wk` : null, `v${plan.current_version}`].filter(Boolean).join(" · ")}</p>
        </div>
        <Pill tone={STATUS_TONE[plan.status]}>{plan.status}</Pill>
        {plan.status === "archived" ? (
          <GhostButton className="h-9 px-2.5" aria-label="Restore" onClick={() => !readOnly && action.mutate({ planId: plan.id, action: "restore" })}><RotateCcw className="w-4 h-4" /></GhostButton>
        ) : (
          canActivate && <GhostButton className="h-9" onClick={onToggleActivate}>{plan.status === "draft" ? "Review" : "Activate"}</GhostButton>
        )}
      </div>

      {activating && (
        <div className="mt-3 space-y-3">
          {[...needsFix, ...review].length > 0 && (
            <ul className="space-y-1.5">
              {needsFix.map((i) => (
                <li key={i.id} className="text-xs flex gap-2"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" /><span className={pal.mute}><code className={pal.ink}>{i.path}</code> {i.message} · New version</span></li>
              ))}
              {review.map((i) => (
                <li key={i.id}>
                  <label className="text-xs flex gap-2 items-start">
                    <input type="checkbox" className="mt-0.5" checked={ack.includes(i.id)} onChange={(e) => setAck((a) => (e.target.checked ? [...a, i.id] : a.filter((x) => x !== i.id)))} />
                    <span className={pal.mute}><code className={pal.ink}>{i.path}</code> {i.message}{i.source === "ai" ? " (AI)" : ""}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {plan.status === "draft" && !needsFix.length && (
            <GhostButton className="w-full" disabled={readOnly} onClick={() => action.mutate({ planId: plan.id, action: "review", acknowledged: ack, previousAck: plan.acknowledged })}>
              Save review
            </GhostButton>
          )}
          {plan.status === "ready" && ready && (
            <ActivatePreview plan={plan} week={week} setWeek={setWeek} pending={action.isPending}
              onActivate={() => !readOnly && action.mutate({ planId: plan.id, action: "activate", week }, { onSuccess: onToggleActivate })} />
          )}
        </div>
      )}
    </li>
  );
}

function ActivatePreview({ plan, week, setWeek, pending, onActivate }: { plan: FitnessPlanSummary; week: string; setWeek: (w: string) => void; pending: boolean; onActivate: () => void }) {
  const pal = useFitnessPalette();
  const thisWeek = localWeekStart();
  const end = plan.duration_weeks ? addDays(parseISO(shiftWeek(week, plan.duration_weeks)), -1) : null;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[thisWeek, shiftWeek(thisWeek, 1)].map((w, i) => (
          <button key={w} onClick={() => setWeek(w)}
            className={cn("flex-1 h-10 rounded-xl border text-sm", pal.line, week === w ? pal.ink : pal.mute)}
            style={week === w ? { borderColor: pal.a, background: `${pal.a}1a` } : undefined}>
            {i === 0 ? "This week" : "Next week"}
          </button>
        ))}
      </div>
      <p className={cn("text-xs", pal.mute)}>
        {plan.slot_count} weekly routines · {format(parseISO(week), "MMM d")}{end ? ` → ${format(end, "MMM d")}` : " · open-ended"}
      </p>
      <PrimaryButton className="w-full" disabled={pending} onClick={onActivate}>Activate</PrimaryButton>
    </div>
  );
}

