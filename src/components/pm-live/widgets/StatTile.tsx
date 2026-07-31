// src/components/pm-live/widgets/StatTile.tsx
// A single number is a stat tile, not a chart (dataviz: "sometimes the answer
// is not a chart"). Text stays in ink tokens; only the optional dot carries
// colour, so status is never encoded by colour alone.
"use client";

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "warn" | "accent";
  onClick?: () => void;
}) {
  const toneColor =
    tone === "warn" ? "var(--pm-warn)" : tone === "accent" ? "var(--pm-accent)" : undefined;

  const body = (
    <>
      <span className="flex items-center gap-1.5">
        {toneColor && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: toneColor }} aria-hidden />}
        <span className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "var(--pm-fg-3)" }}>
          {label}
        </span>
      </span>
      <span className="block mt-1.5 text-[30px] font-bold tabular-nums leading-none" style={{ color: "var(--pm-fg-1)" }}>
        {value}
      </span>
      {hint && (
        <span className="block mt-1.5 text-[13px]" style={{ color: "var(--pm-fg-3)" }}>
          {hint}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="pm-card px-4 py-4 text-left w-full active:scale-[0.98] transition-transform">
        {body}
      </button>
    );
  }
  return <div className="pm-card px-4 py-4">{body}</div>;
}
