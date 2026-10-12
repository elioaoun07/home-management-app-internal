"use client";

// Small shared building blocks for Fitness surfaces.
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useFitnessPalette } from "./fitnessTheme";

export function Panel({ children, className, glow }: { children: ReactNode; className?: string; glow?: boolean }) {
  const pal = useFitnessPalette();
  return (
    <section
      className={cn("rounded-2xl border p-4", pal.line, pal.card, className)}
      style={glow ? { boxShadow: `0 0 0 1px ${pal.a}33 inset, 0 10px 40px -20px ${pal.a}66` } : undefined}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const pal = useFitnessPalette();
  return (
    <div className="flex items-center justify-between mb-3 min-h-8">
      <h2 className={cn("text-sm font-semibold tracking-wide", pal.ink)}>{children}</h2>
      {action}
    </div>
  );
}

export function PrimaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const tc = useThemeClasses();
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 h-12 text-sm font-semibold transition-transform active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
        tc.buttonPrimary,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const pal = useFitnessPalette();
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 h-10 text-sm font-medium transition-colors active:scale-[0.97] disabled:opacity-40",
        pal.line, pal.ink, pal.chip,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Decimal text input with large steppers (Hard Rule 19: never type=number). */
export function Stepper({
  label, value, onChange, step, suffix, decimals = false, min = 0,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  suffix?: string;
  decimals?: boolean;
  min?: number;
}) {
  const pal = useFitnessPalette();
  const bump = (d: number) => {
    const n = Number(value.replace(",", ".")) || 0;
    const next = Math.max(min, Math.round((n + d) * 100) / 100);
    onChange(String(next));
  };
  return (
    <div className="flex-1 min-w-0">
      <span className={cn("block text-[11px] mb-1", pal.faint)}>{label}</span>
      <div className={cn("flex items-center rounded-xl border h-12", pal.line, pal.chip)}>
        <button type="button" aria-label={`Less ${label}`} onClick={() => bump(-step)} className={cn("w-11 h-full flex items-center justify-center", pal.mute)}>
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="text"
          inputMode={decimals ? "decimal" : "numeric"}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="—"
          className={cn("w-full min-w-0 bg-transparent text-center text-lg font-semibold tabular-nums outline-none", pal.ink)}
        />
        {suffix && <span className={cn("pr-1 text-xs", pal.faint)}>{suffix}</span>}
        <button type="button" aria-label={`More ${label}`} onClick={() => bump(step)} className={cn("w-11 h-full flex items-center justify-center", pal.mute)}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function Meter({ value, max }: { value: number; max: number }) {
  const pal = useFitnessPalette();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: pal.track }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct * 100}%`, background: `linear-gradient(90deg, ${pal.a}, ${pal.b})` }} />
    </div>
  );
}

export function Pill({ children, tone = "mute" }: { children: ReactNode; tone?: "mute" | "accent" | "pending" }) {
  const pal = useFitnessPalette();
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tone === "mute" && cn(pal.chip, pal.mute))}
      style={tone === "accent" ? { background: `${pal.a}22`, color: pal.a } : tone === "pending" ? { background: `${pal.b}22`, color: pal.b } : undefined}
    >
      {children}
    </span>
  );
}
