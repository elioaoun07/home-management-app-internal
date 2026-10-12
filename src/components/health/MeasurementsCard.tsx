"use client";

// Shared body-measurement card: Healthcare and Fitness render the same rows
// (health_measurements). Owner-private. BMI is informational only.
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateMeasurement, useDeleteMeasurement, useHealthMeasurements } from "@/hooks/useHealthMeasurements";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  cmToFtIn, deriveBmiSeries, inToCm, kgToLb, latestOf, lbToKg, parseDecimal, type HealthMeasurement,
} from "@/lib/health/measurements";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Info, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

interface Tone {
  ink: string;
  mute: string;
  faint: string;
  line: string;
  accent: string;
}

const DEFAULT_TONE: Tone = { ink: "text-white", mute: "text-white/60", faint: "text-white/35", line: "border-white/10", accent: "#22d3ee" };

export function MeasurementsCard({
  profileId, source, tone = DEFAULT_TONE, className,
}: {
  profileId: string;
  source: "healthcare" | "fitness";
  tone?: Tone;
  className?: string;
}) {
  const tc = useThemeClasses();
  const { data = [], isLoading, error } = useHealthMeasurements(profileId);
  const remove = useDeleteMeasurement();
  const [adding, setAdding] = useState(false);
  const series = useMemo(() => deriveBmiSeries(data), [data]);
  const weight = latestOf(data, "weight_kg");
  const height = latestOf(data, "height_cm");
  const latestBmi = series.at(-1)?.bmi ?? null;

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Weight" value={weight?.weight_kg != null ? `${weight.weight_kg} kg` : "—"} sub={weight ? format(parseISO(weight.measured_at), "MMM d") : "Missing"} tone={tone} />
        <Stat label="Height" value={height?.height_cm != null ? `${height.height_cm} cm` : "—"} sub={height ? format(parseISO(height.measured_at), "MMM d") : "Missing"} tone={tone} />
        <div className={cn("rounded-xl border p-3 relative", tone.line)}>
          <div className="flex items-center gap-1">
            <span className={cn("text-[11px]", tone.faint)}>BMI</span>
            <Popover>
              <PopoverTrigger aria-label="About BMI" className={tone.faint}><Info className="w-3.5 h-3.5" /></PopoverTrigger>
              <PopoverContent className={cn("w-64 text-xs border rounded-xl", tc.bgPage, tone.line, tone.mute)}>
                Weight ÷ height² using the latest height recorded on or before each weight. Informational only; it does not score or judge training.
              </PopoverContent>
            </Popover>
          </div>
          <p className={cn("text-lg font-semibold tabular-nums", tone.ink)}>{latestBmi ?? "—"}</p>
          <p className={cn("text-[11px]", tone.faint)}>{latestBmi === null ? (weight ? "Needs height" : "Missing") : "Latest"}</p>
        </div>
      </div>

      {series.length > 1 && <Trend points={series.map((p) => p.weight_kg)} accent={tone.accent} />}

      {error ? (
        <p className={cn("mt-3 text-xs", tone.faint)}>Unavailable</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {isLoading && <li className={cn("text-xs", tone.faint)}>Loading…</li>}
          {[...data].slice(0, 6).map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className={cn("w-16 shrink-0 text-xs tabular-nums", tone.faint)}>{format(parseISO(m.measured_at), "MMM d")}</span>
              <span className={cn("flex-1 tabular-nums", tone.ink)}>
                {[m.weight_kg != null && `${m.weight_kg} kg`, m.height_cm != null && `${m.height_cm} cm`].filter(Boolean).join(" · ")}
              </span>
              <button aria-label="Delete measurement" onClick={() => remove.mutate(m)} className={cn("p-1.5 hover:text-amber-400", tone.faint)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <MeasurementForm profileId={profileId} source={source} tone={tone} onDone={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className={cn("mt-3 w-full h-10 rounded-xl border border-dashed text-sm flex items-center justify-center gap-1.5", tone.line, tone.mute)}>
          <Plus className="w-4 h-4" /> Add
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: Tone }) {
  return (
    <div className={cn("rounded-xl border p-3", tone.line)}>
      <span className={cn("text-[11px]", tone.faint)}>{label}</span>
      <p className={cn("text-lg font-semibold tabular-nums truncate", tone.ink)}>{value}</p>
      <p className={cn("text-[11px]", tone.faint)}>{sub}</p>
    </div>
  );
}

function Trend({ points, accent }: { points: number[]; accent: string }) {
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * 100},${30 - ((p - min) / span) * 26 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-3 w-full h-10" aria-label="Weight trend">
      <polyline points={d} fill="none" stroke={accent} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MeasurementForm({ profileId, source, tone, onDone }: { profileId: string; source: "healthcare" | "fitness"; tone: Tone; onDone: () => void }) {
  const create = useCreateMeasurement();
  const [imperial, setImperial] = useState(false);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [when, setWhen] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const w = parseDecimal(weight);
  const h = parseDecimal(height);
  const hi = parseDecimal(heightIn);
  const weightKg = w === null || Number.isNaN(w) ? null : imperial ? lbToKg(w) : w;
  const heightCm = h === null || Number.isNaN(h) ? null : imperial ? inToCm(h * 12 + (hi && !Number.isNaN(hi) ? hi : 0)) : h;
  const invalid = [w, h, hi].some((v) => v !== null && Number.isNaN(v));
  const field = cn("h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none", tone.line, tone.ink);

  const save = () => {
    if (invalid || (weightKg === null && heightCm === null)) return;
    create.mutate(
      { id: crypto.randomUUID(), profile_id: profileId, measured_at: new Date(when).toISOString(), weight_kg: weightKg, height_cm: heightCm, source },
      { onSuccess: onDone },
    );
  };

  return (
    <div className={cn("mt-3 rounded-2xl border p-3 space-y-2", tone.line)}>
      <div className="flex gap-1.5">
        {(["Metric", "Imperial"] as const).map((u) => (
          <button key={u} onClick={() => setImperial(u === "Imperial")} className={cn("px-3 h-8 rounded-full text-xs border", tone.line, (u === "Imperial") === imperial ? tone.ink : tone.faint)}>
            {u}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={field} type="text" inputMode="decimal" placeholder={imperial ? "lb" : "kg"} aria-label="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
        {imperial ? (
          <div className="flex gap-2">
            <input className={field} type="text" inputMode="decimal" placeholder="ft" aria-label="Height feet" value={height} onChange={(e) => setHeight(e.target.value)} />
            <input className={field} type="text" inputMode="decimal" placeholder="in" aria-label="Height inches" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
          </div>
        ) : (
          <input className={field} type="text" inputMode="decimal" placeholder="cm" aria-label="Height" value={height} onChange={(e) => setHeight(e.target.value)} />
        )}
      </div>
      <input className={field} type="datetime-local" aria-label="Measured at" value={when} onChange={(e) => setWhen(e.target.value)} />
      {imperial && weightKg !== null && <p className={cn("text-[11px]", tone.faint)}>{weightKg} kg{heightCm ? ` · ${heightCm} cm` : ""}</p>}
      {!imperial && heightCm !== null && <p className={cn("text-[11px]", tone.faint)}>{(({ ft, in: i }) => `${ft}′${i}″`)(cmToFtIn(heightCm))}{weightKg ? ` · ${kgToLb(weightKg)} lb` : ""}</p>}
      <div className="flex gap-2">
        <button onClick={onDone} className={cn("flex-1 h-11 rounded-xl border text-sm", tone.line, tone.mute)}>Cancel</button>
        <button
          onClick={save}
          disabled={invalid || (weightKg === null && heightCm === null) || create.isPending}
          className="flex-[2] h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: tone.accent }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export type { HealthMeasurement };
