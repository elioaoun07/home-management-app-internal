// src/lib/health/medicationSchedule.ts
//
// Pure dose-slot math for the Healthcare medication checklist.
//
// Contract (mirrors health_rebuild_medication_reminders() in
// migrations/2026-09-26_healthcare-medications.sql — keep them in step):
//   * dose_times are wall-clock "HH:MM" in the medication's own `timezone`,
//     NOT the browser's — so the checklist, the dose-log keys (scheduled_at)
//     and the server-created reminders agree even when the phone travels.
//   * A slot exists iff starts_at <= slot < ends_at (ends_at null = ongoing).
//   * A course dose is identified by its slot instant; logs match on the exact
//     ISO instant.
//
// This is NOT an item-recurrence expansion engine — Schedule reminders keep
// using the existing rrule path. It only answers "which doses exist on day X".

export interface MedicationScheduleInput {
  mode: "course" | "as_needed";
  dose_times: string[];
  timezone: string;
  starts_at: string;
  ends_at: string | null;
  min_hours_between?: number | null;
  max_per_day?: number | null;
}

export interface DoseLogInput {
  scheduled_at: string | null;
  taken_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts: Record<string, string> = {};
  for (const p of zoneFormatter(timeZone).formatToParts(instant)) {
    parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Zone offset (ms) at `instant`: local wall clock minus UTC. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instant of wall-clock `date` ("YYYY-MM-DD") + `time` ("HH:MM") in `timeZone`. */
export function zonedDateTime(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = zoneOffsetMs(new Date(guess), timeZone);
  let t = guess - first;
  const second = zoneOffsetMs(new Date(t), timeZone);
  if (second !== first) t = guess - second;
  return new Date(t);
}

/** "YYYY-MM-DD" of `instant` as seen in `timeZone`. */
export function dateKeyInZone(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Calendar arithmetic on a "YYYY-MM-DD" key (zone-free). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function uniqueSortedTimes(times: string[]): string[] {
  return [...new Set(times)].sort();
}

/** Course dose slots on `dateKey` (medication's zone), inside the course window. */
export function doseSlotsOnDate(
  med: MedicationScheduleInput,
  dateKey: string,
): Date[] {
  if (med.mode !== "course") return [];
  const start = new Date(med.starts_at).getTime();
  const end = med.ends_at ? new Date(med.ends_at).getTime() : Infinity;
  return uniqueSortedTimes(med.dose_times)
    .map((t) => zonedDateTime(dateKey, t, med.timezone))
    .filter((slot) => slot.getTime() >= start && slot.getTime() < end);
}

/** Total course doses, or null for an ongoing course. */
export function countCourseSlots(med: MedicationScheduleInput): number | null {
  if (med.mode !== "course" || !med.ends_at) return null;
  const firstKey = dateKeyInZone(new Date(med.starts_at), med.timezone);
  const lastKey = dateKeyInZone(new Date(med.ends_at), med.timezone);
  let count = 0;
  // Courses are days-to-weeks; the cap only guards against a corrupt row.
  for (let key = firstKey, i = 0; key <= lastKey && i < 1000; key = addDaysToKey(key, 1), i++) {
    count += doseSlotsOnDate(med, key).length;
  }
  return count;
}

/** First course slot at or after `from`, or null when the course is over. */
export function nextDoseSlot(
  med: MedicationScheduleInput,
  from: Date,
): Date | null {
  if (med.mode !== "course") return null;
  const fromMs = Math.max(from.getTime(), new Date(med.starts_at).getTime());
  let key = dateKeyInZone(new Date(fromMs), med.timezone);
  for (let i = 0; i < 3; i++, key = addDaysToKey(key, 1)) {
    const slot = doseSlotsOnDate(med, key).find((s) => s.getTime() >= fromMs);
    if (slot) return slot;
  }
  return null;
}

/** Course day counter: `{ day: 3, total: 7 }` (total null when ongoing). */
export function courseDay(
  med: MedicationScheduleInput,
  now: Date,
): { day: number; total: number | null } | null {
  if (med.mode !== "course") return null;
  const start = new Date(med.starts_at).getTime();
  if (now.getTime() < start) return null;
  const total = med.ends_at
    ? Math.round((new Date(med.ends_at).getTime() - start) / DAY_MS)
    : null;
  const day = Math.floor((now.getTime() - start) / DAY_MS) + 1;
  return { day: total ? Math.min(day, total) : day, total };
}

export function isMedicationFinished(
  med: MedicationScheduleInput,
  now: Date,
): boolean {
  return !!med.ends_at && new Date(med.ends_at).getTime() <= now.getTime();
}

/** `perDay` times evenly spaced from `first` ("08:00", 3 → 08:00 16:00 00:00), sorted. */
export function evenlySpacedTimes(first: string, perDay: number): string[] {
  const [hh, mm] = first.split(":").map(Number);
  const startMin = hh * 60 + mm;
  const step = Math.round((24 * 60) / perDay);
  const times: string[] = [];
  for (let i = 0; i < perDay; i++) {
    const total = (startMin + i * step) % (24 * 60);
    times.push(
      `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
    );
  }
  return uniqueSortedTimes(times);
}

export interface AsNeededState {
  takenToday: number;
  lastTakenAt: Date | null;
  /** Earliest next dose when the minimum gap hasn't elapsed yet. */
  nextOkAt: Date | null;
  atDailyMax: boolean;
}

/** As-needed status from the medication's logs ("today" in its zone). */
export function asNeededState(
  med: MedicationScheduleInput,
  logs: DoseLogInput[],
  now: Date,
): AsNeededState {
  const todayKey = dateKeyInZone(now, med.timezone);
  const taken = logs
    .map((l) => new Date(l.taken_at))
    .sort((a, b) => b.getTime() - a.getTime());
  const takenToday = taken.filter(
    (t) => dateKeyInZone(t, med.timezone) === todayKey,
  ).length;
  const lastTakenAt = taken[0] ?? null;
  let nextOkAt: Date | null = null;
  if (lastTakenAt && med.min_hours_between) {
    const ok = new Date(lastTakenAt.getTime() + med.min_hours_between * 60 * 60 * 1000);
    if (ok.getTime() > now.getTime()) nextOkAt = ok;
  }
  return {
    takenToday,
    lastTakenAt,
    nextOkAt,
    atDailyMax: !!med.max_per_day && takenToday >= med.max_per_day,
  };
}
