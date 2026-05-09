"use client";

import { useChefSummary } from "@/features/era/widgets/useChefSummary";

type Variant = "card" | "placeholder";

export function ChefWidget({ variant }: { variant: Variant }) {
  const { data, isLoading } = useChefSummary();

  if (isLoading || !data) {
    return <WidgetSkeleton variant={variant} />;
  }

  const stat =
    data.recipeCount === 0
      ? "No recipes yet"
      : `${data.recipeCount} recipe${data.recipeCount === 1 ? "" : "s"}`;
  const body = data.lastCooked ? `Last cooked: ${data.lastCooked}` : "Start cooking";

  return <WidgetContent variant={variant} stat={stat} body={body} hue={28} />;
}

function WidgetSkeleton({ variant }: { variant: Variant }) {
  return (
    <div className={variant === "placeholder" ? "flex flex-col items-center gap-2" : "flex flex-col gap-1.5"}>
      <div className="h-4 w-20 animate-pulse rounded-full bg-white/10" />
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
