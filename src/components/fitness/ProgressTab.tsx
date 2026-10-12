"use client";

import { MeasurementsCard } from "@/components/health/MeasurementsCard";
import { useDeleteSession, useSessionHistory } from "@/features/fitness/hooks";
import { useCreateSelfHealthProfile } from "@/hooks/useHealthMeasurements";
import { fmtDistance, fmtDuration, fmtKg } from "@/lib/fitness/format";
import { localWeekStart, shiftWeek } from "@/lib/fitness/progress";
import type { FitnessBundle, RecentSession } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useFitnessPalette } from "./fitnessTheme";
import { GhostButton, Panel, Pill, PrimaryButton, SectionTitle } from "./fitnessUi";

export function ProgressTab({ bundle, streak, readOnly }: { bundle: FitnessBundle; streak: number; readOnly?: boolean }) {
  const pal = useFitnessPalette();
  const [more, setMore] = useState(false);
  const history = useSessionHistory(more && !readOnly);
  const remove = useDeleteSession();
  const createProfile = useCreateSelfHealthProfile();
  const sessions: RecentSession[] = useMemo(() => {
    const extra = history.data?.pages.flat() ?? [];
    const seen = new Set(bundle.recent_sessions.map((s) => s.id));
    return [...bundle.recent_sessions, ...extra.filter((s) => !seen.has(s.id))];
  }, [bundle.recent_sessions, history.data]);

  // 12-week consistency strip (oldest → newest).
  const current = localWeekStart();
  const weeks = Array.from({ length: 12 }, (_, i) => shiftWeek(current, i - 11)).map((w) => {
    const s = bundle.weeks.find((x) => x.week_start === w);
    const target = s?.target ?? bundle.live_plan?.version.training_target ?? 0;
    return { w, done: s?.training_done ?? 0, target };
  });
  const maxBar = Math.max(1, ...weeks.map((w) => Math.max(w.done, w.target)));

  return (
    <div className="space-y-4">
      <Panel>
        <SectionTitle action={<Pill tone="accent">{streak} wk streak</Pill>}>Consistency</SectionTitle>
        <div className="flex items-end gap-1.5 h-24" role="img" aria-label="Training sessions per week, last 12 weeks">
          {weeks.map(({ w, done, target }) => (
            <div key={w} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
              <div className="w-full rounded-md relative" style={{ height: `${(Math.max(done, 0.15) / maxBar) * 100}%`, background: done >= target && target > 0 ? `linear-gradient(${pal.a}, ${pal.b})` : pal.track }} />
              <span className={cn("text-[9px]", w === current ? pal.ink : pal.faint)}>{format(parseISO(w), "d")}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle>Records</SectionTitle>
        {bundle.records.length === 0 ? (
          <p className={cn("text-sm", pal.faint)}>None yet</p>
        ) : (
          <ul className="space-y-1.5">
            {bundle.records.map((r) => (
              <li key={`${r.exercise}|${r.equipment}|${r.load_kind}`} className="flex items-center gap-2 text-sm">
                <span className={cn("flex-1 min-w-0 truncate", pal.ink)}>
                  {r.exercise}
                  <span className={pal.faint}>{r.equipment ? ` · ${r.equipment}` : ""}{r.load_kind !== "external" ? ` · ${r.load_kind === "bodyweight" ? "BW" : r.load_kind}` : ""}</span>
                </span>
                <span className={cn("tabular-nums text-sm font-medium", pal.ink)}>
                  {r.best_load_kg != null ? fmtKg(r.best_load_kg) : r.best_reps != null ? `${r.best_reps} reps` : r.best_duration_seconds != null ? fmtDuration(r.best_duration_seconds) : r.best_distance_m != null ? fmtDistance(r.best_distance_m) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <SectionTitle>History</SectionTitle>
        {sessions.length === 0 ? (
          <p className={cn("text-sm", pal.faint)}>No workouts yet</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.id} className={cn("flex items-center gap-3 rounded-xl px-2 py-2", pal.line)}>
                <span className={cn("w-12 shrink-0 text-xs tabular-nums", pal.faint)}>{s.finished_at ? format(parseISO(s.finished_at), "MMM d") : "—"}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm truncate", pal.ink)}>{s.workout_name}</p>
                  <p className={cn("text-[11px]", pal.faint)}>
                    {s.status === "abandoned" ? "Not finished" : !s.has_sets ? "No detailed log" : `${s.sets_done} sets${s.volume_kg ? ` · ${Math.round(s.volume_kg).toLocaleString()} kg` : ""}`}
                    {s.source === "schedule" ? " · Schedule" : ""}
                  </p>
                </div>
                {s.pending ? <Pill tone="pending">Pending</Pill> : (
                  <button aria-label="Delete workout" disabled={readOnly} onClick={() => remove.mutate({ sessionId: s.id, label: s.workout_name })} className={cn("p-2 hover:text-amber-400", pal.faint)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && sessions.length >= 20 && (history.hasNextPage ?? true) && (
          <GhostButton className="w-full mt-2" disabled={history.isFetching} onClick={() => (more ? history.fetchNextPage() : setMore(true))}>More</GhostButton>
        )}
      </Panel>

      <Panel>
        <SectionTitle>Body</SectionTitle>
        {bundle.health_profile ? (
          readOnly ? (
            <p className={cn("text-sm", pal.faint)}>Healthcare measurements</p>
          ) : (
            <MeasurementsCard
              profileId={bundle.health_profile.id}
              source="fitness"
              tone={{ ink: pal.ink, mute: pal.mute, faint: pal.faint, line: pal.line, accent: pal.a }}
            />
          )
        ) : (
          <div className="text-center py-2">
            <p className={cn("text-sm mb-3", pal.mute)}>No Healthcare profile</p>
            <PrimaryButton disabled={readOnly || createProfile.isPending} onClick={() => createProfile.mutate("Me")}>Create profile</PrimaryButton>
          </div>
        )}
      </Panel>
    </div>
  );
}
