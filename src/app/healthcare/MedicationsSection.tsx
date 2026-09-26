"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  medicationToSaveDTO,
  useCreateHealthMedication,
  useDeleteHealthMedication,
  useSetMedicationDose,
  useUpdateHealthMedication,
} from "@/features/healthcare/hooks";
import type {
  HealthMedication,
  HealthMedicationLog,
  HealthProfile,
  MedicationFoodTiming,
  MedicationMode,
  SaveHealthMedicationDTO,
} from "@/features/healthcare/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  addDaysToKey,
  asNeededState,
  countCourseSlots,
  courseDay,
  dateKeyInZone,
  doseSlotsOnDate,
  evenlySpacedTimes,
  isMedicationFinished,
  nextDoseSlot,
  zonedDateTime,
} from "@/lib/health/medicationSchedule";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pill,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal, chipCls, inputCls, labelCls } from "./healthUi";

const FOOD_LABEL: Record<MedicationFoodTiming, string | null> = {
  any: null,
  empty_stomach: "Empty stomach",
  with_food: "With food",
};

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function hhmm(d: Date): string {
  return format(d, "HH:mm");
}

/** Re-render every minute so "due" styling and as-needed waits stay current. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function dayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "Today";
  if (key === addDaysToKey(todayKey, -1)) return "Yesterday";
  if (key === addDaysToKey(todayKey, 1)) return "Tomorrow";
  return format(new Date(`${key}T12:00:00`), "EEE d MMM");
}

function FoodBadge({ timing }: { timing: MedicationFoodTiming }) {
  const label = FOOD_LABEL[timing];
  if (!label) return null;
  return (
    <Badge className="border-0 bg-amber-500/10 text-amber-300 font-normal">
      {label}
    </Badge>
  );
}

// ── Medication form ──────────────────────────────────────────────────────────

function MedicationForm({
  profileId,
  existing,
  onClose,
}: {
  profileId: string;
  existing: HealthMedication | null;
  onClose: () => void;
}) {
  const create = useCreateHealthMedication();
  const update = useUpdateHealthMedication();

  const initialStart = existing ? new Date(existing.starts_at) : roundedNow();
  const [name, setName] = useState(existing?.name ?? "");
  const [dosage, setDosage] = useState(existing?.dosage ?? "");
  const [mode, setMode] = useState<MedicationMode>(existing?.mode ?? "course");
  const [food, setFood] = useState<MedicationFoodTiming>(existing?.food_timing ?? "any");
  const [startDate, setStartDate] = useState(format(initialStart, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(hhmm(initialStart));
  const [times, setTimes] = useState<string[]>(
    existing?.dose_times.length ? existing.dose_times : [hhmm(initialStart)],
  );
  const [perDay, setPerDay] = useState<number | null>(existing ? null : 1);
  const [days, setDays] = useState(
    existing?.ends_at
      ? String(
          Math.round(
            (new Date(existing.ends_at).getTime() - new Date(existing.starts_at).getTime()) /
              86_400_000,
          ),
        )
      : "",
  );
  const [minHours, setMinHours] = useState(
    existing?.min_hours_between != null ? String(existing.min_hours_between) : "",
  );
  const [maxPerDay, setMaxPerDay] = useState(
    existing?.max_per_day != null ? String(existing.max_per_day) : "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const pickPerDay = (n: number) => {
    setPerDay(n);
    setTimes(evenlySpacedTimes(startTime, n));
  };
  const changeStartTime = (t: string) => {
    setStartTime(t);
    if (perDay && t) setTimes(evenlySpacedTimes(t, perDay));
  };
  const changeTime = (i: number, t: string) => {
    setPerDay(null);
    setTimes((prev) => prev.map((x, j) => (j === i ? t : x)));
  };

  const daysNum = days.trim() ? Number(days) : null;
  const daysValid = daysNum === null || (Number.isInteger(daysNum) && daysNum > 0);
  const validTimes = times.filter(Boolean);
  const canSave =
    !!name.trim() &&
    !!startDate &&
    !!startTime &&
    daysValid &&
    (mode === "as_needed" || validTimes.length > 0);

  const submit = () => {
    const tz = browserTimeZone();
    const startsAt = zonedDateTime(startDate, startTime, tz);
    const data: SaveHealthMedicationDTO = {
      name: name.trim(),
      dosage: dosage.trim() || null,
      mode,
      food_timing: food,
      dose_times: mode === "course" ? [...new Set(validTimes)].sort() : [],
      timezone: tz,
      starts_at: startsAt.toISOString(),
      // Same wall-clock time N days later → exactly N × times-per-day doses.
      ends_at:
        mode === "course" && daysNum
          ? zonedDateTime(addDaysToKey(startDate, daysNum), startTime, tz).toISOString()
          : null,
      min_hours_between: mode === "as_needed" && minHours ? Number(minHours) : null,
      max_per_day: mode === "as_needed" && maxPerDay ? Number(maxPerDay) : null,
      notes: notes.trim() || null,
    };
    if (existing) {
      update.mutate(
        { id: existing.id, data, previous: medicationToSaveDTO(existing) },
        { onSuccess: onClose },
      );
    } else {
      create.mutate({ ...data, profile_id: profileId }, { onSuccess: onClose });
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Name</label>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Amoxicillin"
          autoFocus
        />
      </div>
      <div>
        <label className={labelCls}>Dose</label>
        <input
          className={inputCls}
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="1 pill, 500 mg, 5 ml"
        />
      </div>
      <div className="flex gap-2">
        <button className={chipCls(mode === "course")} onClick={() => setMode("course")}>
          Full course
        </button>
        <button
          className={chipCls(mode === "as_needed")}
          onClick={() => setMode("as_needed")}
        >
          As needed
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["any", "empty_stomach", "with_food"] as const).map((f) => (
          <button key={f} className={chipCls(food === f)} onClick={() => setFood(f)}>
            {FOOD_LABEL[f] ?? "Anytime"}
          </button>
        ))}
      </div>

      {mode === "course" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First dose</label>
              <input
                type="date"
                className={inputCls}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>&nbsp;</label>
              <input
                type="time"
                className={inputCls}
                value={startTime}
                onChange={(e) => changeStartTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Per day</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} className={chipCls(perDay === n)} onClick={() => pickPerDay(n)}>
                  {n}×
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Times</label>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((t, i) => (
                <div key={i} className="flex items-center rounded-lg bg-white/5 border border-white/10">
                  <input
                    type="time"
                    className="bg-transparent px-2 py-1.5 text-sm text-white focus:outline-none"
                    value={t}
                    onChange={(e) => changeTime(i, e.target.value)}
                  />
                  {times.length > 1 && (
                    <button
                      className="p-1.5 text-white/40 hover:text-white"
                      onClick={() => {
                        setPerDay(null);
                        setTimes((prev) => prev.filter((_, j) => j !== i));
                      }}
                      aria-label="Remove time"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                className="p-2 rounded-lg border border-dashed border-white/20 text-white/60 hover:border-white/40"
                onClick={() => {
                  setPerDay(null);
                  setTimes((prev) => [...prev, startTime]);
                }}
                aria-label="Add time"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Days</label>
            <input
              type="text"
              inputMode="numeric"
              className={inputCls}
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Ongoing"
            />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Min hours apart</label>
            <input
              type="text"
              inputMode="decimal"
              className={inputCls}
              value={minHours}
              onChange={(e) => setMinHours(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </div>
          <div>
            <label className={labelCls}>Max per day</label>
            <input
              type="text"
              inputMode="numeric"
              className={inputCls}
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          className={cn(inputCls, "min-h-[56px]")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button className="w-full" disabled={!canSave || pending} onClick={submit}>
        {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {existing ? "Save changes" : "Add medication"}
      </Button>
    </div>
  );
}

function roundedNow(): Date {
  const d = new Date();
  d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

// ── Section ──────────────────────────────────────────────────────────────────

interface DoseRow {
  med: HealthMedication;
  slot: Date;
  taken: boolean;
}

export function MedicationsSection({
  profile,
  medications,
  logs,
}: {
  profile: HealthProfile;
  medications: HealthMedication[];
  logs: HealthMedicationLog[];
}) {
  const tc = useThemeClasses();
  const now = useNow();
  const setDose = useSetMedicationDose();
  const deleteMedication = useDeleteHealthMedication();
  const [modal, setModal] = useState<{ existing: HealthMedication | null } | null>(null);

  const todayKey = dateKeyInZone(now, browserTimeZone());
  const [dayKey, setDayKey] = useState(todayKey);

  const logsByMed = useMemo(() => {
    const map = new Map<string, HealthMedicationLog[]>();
    for (const l of logs) {
      const list = map.get(l.medication_id) ?? [];
      list.push(l);
      map.set(l.medication_id, list);
    }
    return map;
  }, [logs]);

  const takenSlots = useMemo(
    () =>
      new Set(
        logs
          .filter((l) => l.scheduled_at)
          .map((l) => `${l.medication_id}|${new Date(l.scheduled_at!).getTime()}`),
      ),
    [logs],
  );

  const doseRows: DoseRow[] = useMemo(
    () =>
      medications
        .flatMap((med) =>
          doseSlotsOnDate(med, dayKey).map((slot) => ({
            med,
            slot,
            taken: takenSlots.has(`${med.id}|${slot.getTime()}`),
          })),
        )
        .sort((a, b) => a.slot.getTime() - b.slot.getTime()),
    [medications, dayKey, takenSlots],
  );

  const asNeeded = medications.filter(
    (m) => m.mode === "as_needed" && !isMedicationFinished(m, now),
  );
  const hasActive = medications.some((m) => !isMedicationFinished(m, now));
  const nextUpcoming = doseRows.find((r) => !r.taken && r.slot.getTime() >= now.getTime());

  const toggleDose = (row: DoseRow) =>
    setDose.mutate({
      medication_id: row.med.id,
      taken: !row.taken,
      scheduled_at: row.slot.toISOString(),
    });

  const takeAsNeeded = (med: HealthMedication) =>
    setDose.mutate({
      medication_id: med.id,
      taken: true,
      log_id: crypto.randomUUID(),
      taken_at: new Date().toISOString(),
      label: med.name,
    });

  return (
    <>
      {hasActive && (
        <Card className={cn("p-4", tc.surfaceBg, "border-white/10")}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-white flex items-center gap-2">
              <Check className="w-4 h-4 text-cyan-400" />
              Doses
            </h2>
            <div className="flex items-center gap-1">
              <button
                className="p-2 text-white/50 hover:text-white"
                onClick={() => setDayKey((k) => addDaysToKey(k, -1))}
                aria-label="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="text-sm text-white/80 min-w-[84px] text-center"
                onClick={() => setDayKey(todayKey)}
              >
                {dayLabel(dayKey, todayKey)}
              </button>
              <button
                className="p-2 text-white/50 hover:text-white"
                onClick={() => setDayKey((k) => addDaysToKey(k, 1))}
                aria-label="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {doseRows.length === 0 && (dayKey !== todayKey || asNeeded.length === 0) ? (
            <p className="text-sm text-white/40">No doses</p>
          ) : (
            <ul className="space-y-2">
              {doseRows.map((row) => {
                const past = row.slot.getTime() < now.getTime();
                const isNext = row === nextUpcoming;
                return (
                  <li key={`${row.med.id}-${row.slot.getTime()}`}>
                    <button
                      onClick={() => toggleDose(row)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 text-left",
                        isNext && "ring-1 ring-cyan-400/40",
                      )}
                      aria-pressed={row.taken}
                    >
                      <span
                        className={cn(
                          "shrink-0 w-6 h-6 rounded-full border flex items-center justify-center",
                          row.taken
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                            : "border-white/30",
                        )}
                      >
                        {row.taken && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 w-12 text-sm tabular-nums",
                          row.taken
                            ? "text-white/40"
                            : past
                              ? "text-white/40"
                              : "text-white/90",
                        )}
                      >
                        {hhmm(row.slot)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-sm truncate",
                            row.taken ? "text-white/50" : "text-white/90",
                          )}
                        >
                          {row.med.name}
                          {row.med.dosage && (
                            <span className="text-white/50"> · {row.med.dosage}</span>
                          )}
                        </span>
                      </span>
                      <FoodBadge timing={row.med.food_timing} />
                    </button>
                  </li>
                );
              })}

              {dayKey === todayKey &&
                asNeeded.map((med) => {
                  const state = asNeededState(med, logsByMed.get(med.id) ?? [], now);
                  const wait = state.nextOkAt ?? null;
                  return (
                    <li
                      key={med.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/90 truncate">
                          {med.name}
                          {med.dosage && (
                            <span className="text-white/50"> · {med.dosage}</span>
                          )}
                        </p>
                        <p className="text-xs text-white/50">
                          {state.takenToday}
                          {med.max_per_day ? `/${med.max_per_day}` : ""} today
                          {wait && ` · Next ${hhmm(wait)}`}
                        </p>
                      </div>
                      <FoodBadge timing={med.food_timing} />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={state.atDailyMax}
                        onClick={() => takeAsNeeded(med)}
                      >
                        Take
                      </Button>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>
      )}

      <Card className={cn("p-4", tc.surfaceBg, "border-white/10")}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-white flex items-center gap-2">
            <Pill className="w-4 h-4 text-cyan-400" />
            Medications
          </h2>
          <Button size="sm" variant="outline" onClick={() => setModal({ existing: null })}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        {medications.length === 0 ? (
          <p className="text-sm text-white/40">No medications.</p>
        ) : (
          <ul className="space-y-2">
            {medications.map((med) => {
              const finished = isMedicationFinished(med, now);
              const medLogs = logsByMed.get(med.id) ?? [];
              const total = countCourseSlots(med);
              const day = courseDay(med, now);
              const next = finished ? null : nextDoseSlot(med, now);
              return (
                <li
                  key={med.id}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5",
                    finished && "opacity-60",
                  )}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setModal({ existing: med })}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white/90 text-sm font-medium">{med.name}</span>
                      {med.dosage && (
                        <span className="text-xs text-white/50">{med.dosage}</span>
                      )}
                      {finished && (
                        <Badge className="border-0 bg-white/10 text-white/60">Done</Badge>
                      )}
                      <FoodBadge timing={med.food_timing} />
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">
                      {med.mode === "course"
                        ? [
                            med.dose_times.join(" · "),
                            day && !finished
                              ? `Day ${day.day}${day.total ? `/${day.total}` : ""}`
                              : null,
                            total
                              ? `${medLogs.filter((l) => l.scheduled_at).length}/${total}`
                              : null,
                            next ? `Next ${hhmm(next)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : [
                            "As needed",
                            med.min_hours_between ? `≥${med.min_hours_between}h` : null,
                            med.max_per_day ? `max ${med.max_per_day}/day` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                  </button>
                  <button
                    className="p-2 text-white/50 hover:text-amber-400 shrink-0"
                    onClick={() => deleteMedication.mutate(med.id)}
                    aria-label="Delete medication"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {modal && (
        <Modal
          title={
            modal.existing ? modal.existing.name : `Medication — ${profile.name}`
          }
          onClose={() => setModal(null)}
        >
          <MedicationForm
            profileId={profile.id}
            existing={modal.existing}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </>
  );
}
