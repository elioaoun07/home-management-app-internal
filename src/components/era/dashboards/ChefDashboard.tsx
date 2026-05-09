"use client";

// ERA Chef Dashboard — recipe library overview, recently cooked, cuisine breakdown.

import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EraStatCard } from "./EraStatCard";

const HUE = 28;
const ACCENT = `hsl(${HUE}, 80%, 65%)`;

interface RecipeSummary {
  id: string;
  name: string;
  cuisine?: string | null;
  category?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  times_cooked: number;
  last_cooked_at?: string | null;
  image_url?: string | null;
  average_rating?: number | null;
  created_at?: string | null;
}

function useRecipeData() {
  return useQuery<RecipeSummary[]>({
    queryKey: ["era", "dashboard", "chef"],
    queryFn: async () => {
      const res = await safeFetch("/api/recipes?limit=200", {
        timeoutMs: 10_000,
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: CACHE_TIMES.PERMANENT,
  });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs text-white/80"
      style={{
        background: `hsla(${HUE}, 20%, 8%, 0.95)`,
        border: `1px solid hsla(${HUE}, 50%, 40%, 0.3)`,
      }}
    >
      <p className="font-semibold" style={{ color: ACCENT }}>
        {payload[0]?.value} recipes
      </p>
    </div>
  );
}

export function ChefDashboard() {
  const { data: rawRecipes, isLoading } = useRecipeData();
  const recipes = Array.isArray(rawRecipes) ? rawRecipes : [];
  // Gate date-sensitive + Recharts rendering to client only to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const recentlyCooked = useMemo(
    () =>
      [...recipes]
        .filter((r) => r.times_cooked > 0 && r.last_cooked_at)
        .sort((a, b) =>
          (b.last_cooked_at ?? "").localeCompare(a.last_cooked_at ?? ""),
        )
        .slice(0, 4),
    [recipes],
  );

  const cuisineData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of recipes) {
      const cuisine = r.cuisine ?? "Other";
      map[cuisine] = (map[cuisine] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [recipes]);

  const totalMinutes = useMemo(() => {
    const cooked = recipes.filter((r) => r.times_cooked > 0);
    if (!cooked.length) return null;
    const avg =
      cooked.reduce(
        (s, r) => s + ((r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0)),
        0,
      ) / cooked.length;
    return Math.round(avg);
  }, [recipes]);

  const thisMonthCooked = useMemo(() => {
    if (!mounted) return 0;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return recipes.filter(
      (r) => r.last_cooked_at && new Date(r.last_cooked_at) >= monthStart,
    ).length;
  }, [recipes, mounted]);

  const neverTried = useMemo(
    () =>
      [...recipes]
        .filter((r) => (r.times_cooked ?? 0) === 0)
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 4),
    [recipes],
  );

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <EraStatCard
          hue={HUE}
          label="Total recipes"
          value={isLoading ? "…" : recipes.length}
          sub="in your library"
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Cooked this month"
          value={mounted && !isLoading ? thisMonthCooked : "…"}
          sub="sessions"
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Favourite cuisine"
          value={cuisineData[0]?.name ?? "—"}
          sub={cuisineData[0] ? `${cuisineData[0].count} recipes` : undefined}
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Avg cook time"
          value={totalMinutes ? `${totalMinutes}m` : "—"}
          sub="prep + cook"
          loading={isLoading}
        />
      </div>

      {/* Recently cooked */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: `hsla(${HUE}, 18%, 7%, 0.82)`,
          border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
          backdropFilter: "blur(14px)",
        }}
      >
        <p
          className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
          style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
        >
          Recently cooked
        </p>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-white/5"
              />
            ))}
          </div>
        ) : recentlyCooked.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/30">
            Start cooking and they'll appear here.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {recentlyCooked.map((r) => {
              const total =
                (r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0);
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-1.5 rounded-xl p-3"
                  style={{
                    background: `hsla(${HUE}, 20%, 9%, 0.7)`,
                    border: `1px solid hsla(${HUE}, 50%, 40%, 0.14)`,
                  }}
                >
                  <span className="line-clamp-2 text-sm font-medium leading-snug text-white/80">
                    {r.name}
                  </span>
                  {total > 0 && (
                    <span
                      className="text-[10px]"
                      style={{ color: `hsla(${HUE}, 60%, 65%, 0.55)` }}
                    >
                      {total} min
                    </span>
                  )}
                  {r.times_cooked > 1 && (
                    <span className="text-[10px] text-white/30">
                      ×{r.times_cooked}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cuisine breakdown */}
      {cuisineData.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: `hsla(${HUE}, 18%, 7%, 0.82)`,
            border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
            backdropFilter: "blur(14px)",
          }}
        >
          <p
            className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
            style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
          >
            By cuisine
          </p>
          {!mounted ? (
            <div className="h-[120px] animate-pulse rounded-xl bg-white/5" />
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={cuisineData}
                layout="vertical"
                margin={{ top: 0, right: 8, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {cuisineData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${(HUE + i * 22) % 360}, 65%, 58%)`}
                    />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    fill="rgba(255,255,255,0.55)"
                    fontSize={10}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Never tried */}
      {neverTried.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: `hsla(${HUE}, 18%, 7%, 0.82)`,
            border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
            backdropFilter: "blur(14px)",
          }}
        >
          <p
            className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
            style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
          >
            Never tried
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {neverTried.map((r) => {
              const total =
                (r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0);
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-1.5 rounded-xl p-3"
                  style={{
                    background: `hsla(${HUE}, 20%, 9%, 0.55)`,
                    border: `1px dashed hsla(${HUE}, 50%, 40%, 0.22)`,
                  }}
                >
                  <span className="line-clamp-2 text-sm font-medium leading-snug text-white/70">
                    {r.name}
                  </span>
                  <div className="flex items-center justify-between">
                    {total > 0 && (
                      <span
                        className="text-[10px]"
                        style={{ color: `hsla(${HUE}, 60%, 65%, 0.55)` }}
                      >
                        {total} min
                      </span>
                    )}
                    {r.cuisine && (
                      <span className="ml-auto text-[10px] text-white/35">
                        {r.cuisine}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
