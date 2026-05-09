"use client";

import { useBudgetSummary } from "@/features/era/widgets/useBudgetSummary";

type Variant = "card" | "placeholder";

export function BudgetWidget({ variant }: { variant: Variant }) {
  const { data, isLoading } = useBudgetSummary();

  if (isLoading || !data) {
    return <WidgetSkeleton variant={variant} />;
  }

  const stat = `$${data.total.toLocaleString("en-US", { maximumFractionDigits: 0 })} spent`;
  const body = data.topCategory ? `Most: ${data.topCategory}` : "This period";

  return <WidgetContent variant={variant} stat={stat} body={body} hue={175} />;
}

function WidgetSkeleton({ variant }: { variant: Variant }) {
  return (
    <div className={variant === "placeholder" ? "flex flex-col items-center gap-2" : "flex flex-col gap-1.5"}>
      <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
      <div className="h-3 w-28 animate-pulse rounded-full bg-white/6" />
    </div>
  );
}

function WidgetContent({
  variant,
  stat,
  body,
  hue,
}: {
  variant: Variant;
  stat: string;
  body: string;
  hue: number;
}) {
  if (variant === "placeholder") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span
          className="text-2xl font-semibold tabular-nums"
          style={{ color: `hsl(${hue}, 75%, 68%)` }}
        >
          {stat}
        </span>
        <span className="text-sm text-white/50">{body}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: `hsl(${hue}, 75%, 68%)` }}
      >
        {stat}
      </span>
      <span className="text-xs text-white/45 leading-snug">{body}</span>
    </div>
  );
}
