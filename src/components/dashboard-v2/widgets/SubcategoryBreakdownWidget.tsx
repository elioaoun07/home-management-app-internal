"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

const PALETTE = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#e879f9",
];

type Transaction = {
  amount: number;
  category?: string | null;
  subcategory?: string | null;
  category_color?: string | null;
};

type Props = {
  transactions: Transaction[];
  activeCategories?: string[];
  onCategoryClick?: (category: string) => void;
  onCategoryDetailClick?: (category: string) => void;
};

type SubcategoryData = {
  name: string;
  amount: number;
  count: number;
  percent: number;
};

type CategoryGroup = {
  name: string;
  color: string;
  total: number;
  percent: number;
  count: number;
  subcategories: SubcategoryData[];
};

export default function SubcategoryBreakdownWidget({
  transactions,
  activeCategories = [],
  onCategoryClick,
  onCategoryDetailClick,
}: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpand = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const { groups, grandTotal } = useMemo(() => {
    const catMap = new Map<
      string,
      {
        color: string;
        total: number;
        count: number;
        subs: Map<string, { amount: number; count: number }>;
      }
    >();

    for (const t of transactions) {
      const cat = t.category || "Uncategorized";
      const sub = t.subcategory || null;
      const amt = Math.abs(t.amount);

      if (!catMap.has(cat)) {
        catMap.set(cat, {
          color: t.category_color || "#64748b",
          total: 0,
          count: 0,
          subs: new Map(),
        });
      }
      const entry = catMap.get(cat)!;
      entry.total += amt;
      entry.count += 1;

      if (sub) {
        if (!entry.subs.has(sub)) entry.subs.set(sub, { amount: 0, count: 0 });
        const s = entry.subs.get(sub)!;
        s.amount += amt;
        s.count += 1;
      }
    }

    const grandTotal = Array.from(catMap.values()).reduce(
      (s, c) => s + c.total,
      0,
    );

    const groups: CategoryGroup[] = Array.from(catMap.entries())
      .map(([name, data]) => ({
        name,
        color: data.color,
        total: data.total,
        percent: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
        count: data.count,
        subcategories: Array.from(data.subs.entries())
          .map(([subName, subData]) => ({
            name: subName,
            amount: subData.amount,
            count: subData.count,
            percent: data.total > 0 ? (subData.amount / data.total) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.total - a.total);

    return { groups, grandTotal };
  }, [transactions]);

  // Auto-expand filtered categories
  const effectiveExpanded = useMemo(() => {
    const set = new Set(expandedCategories);
    for (const cat of activeCategories) {
      set.add(cat);
    }
    return set;
  }, [expandedCategories, activeCategories]);

  // Filtered groups
  const visibleGroups = useMemo(() => {
    if (activeCategories.length === 0) return groups;
    return groups.filter((g) => activeCategories.includes(g.name));
  }, [groups, activeCategories]);

  if (transactions.length === 0) {
    return (
      <WidgetCard title="Category & Subcategory Breakdown">
        <p className="text-white/40 text-xs text-center py-8">
          No expense data for this period
        </p>
      </WidgetCard>
    );
  }

  const maxTotal = Math.max(...visibleGroups.map((g) => g.total), 1);

  return (
    <WidgetCard
      interactive
      title="Category & Subcategory Breakdown"
      subtitle={`${visibleGroups.length} categories · ${visibleGroups.reduce((s, g) => s + g.subcategories.length, 0)} subcategories`}
      filterActive={activeCategories.length > 0}
      action={
        visibleGroups.some((g) => g.subcategories.length > 0) ? (
          <button
            onClick={() => {
              const allExpanded = visibleGroups.every((g) =>
                effectiveExpanded.has(g.name),
              );
              if (allExpanded) {
                setExpandedCategories(new Set());
              } else {
                setExpandedCategories(
                  new Set(visibleGroups.map((g) => g.name)),
                );
              }
            }}
            className="text-[10px] text-white/40 hover:text-white/60 transition-colors px-2 py-0.5"
          >
            {visibleGroups.every((g) => effectiveExpanded.has(g.name))
              ? "Collapse all"
              : "Expand all"}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-1.5">
        {visibleGroups.slice(0, 12).map((group, gi) => {
          const isExpanded = effectiveExpanded.has(group.name);
          const hasSubs = group.subcategories.length > 0;
          const barWidth = (group.total / maxTotal) * 100;
          const color = group.color || PALETTE[gi % PALETTE.length];

          return (
            <div key={group.name}>
              {/* ── Category card ── */}
              <button
                onClick={() => {
                  if (hasSubs) toggleExpand(group.name);
                  else onCategoryClick?.(group.name);
                }}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 transition-all hover:bg-white/5",
                  isExpanded && "bg-white/[0.03] ring-1 ring-white/5",
                )}
              >
                {/* Row 1: icon + name + amount */}
                <div className="flex items-center gap-2.5">
                  {/* Expand / color dot */}
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {hasSubs ? (
                      isExpanded ? (
                        <ChevronDown
                          className="w-4 h-4 text-white/50"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <ChevronRight
                          className="w-4 h-4 text-white/30"
                          strokeWidth={2.5}
                        />
                      )
                    ) : null}
                  </div>

                  {/* Color dot */}
                  <div
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}40`,
                    }}
                  />

                  {/* Name */}
                  <span className="text-sm font-medium text-white/90 truncate min-w-0 flex-1 text-left">
                    {group.name}
                  </span>

                  {/* Count */}
                  <span className="text-xs text-white/30 shrink-0 tabular-nums">
                    {group.count}
                  </span>

                  {/* Amount */}
                  <BlurredAmount blurIntensity="sm">
                    <span
                      className="text-sm font-bold tabular-nums shrink-0"
                      style={{ color }}
                    >
                      $
                      {group.total.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </BlurredAmount>

                  {/* Detail view button */}
                  {onCategoryDetailClick && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCategoryDetailClick(group.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          onCategoryDetailClick(group.name);
                        }
                      }}
                      className="p-1 rounded-md text-cyan-400/70 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors shrink-0"
                      title={`View ${group.name} details`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Row 2: proportional bar + percentage */}
                <div className="flex items-center gap-3 mt-1.5 ml-[42px]">
                  <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${color}CC, ${color}80)`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-white/60 tabular-nums shrink-0 w-[38px] text-right">
                    {group.percent.toFixed(0)}%
                  </span>
                </div>
              </button>

              {/* ── Expanded subcategories ── */}
              {isExpanded && hasSubs && (
                <div className="ml-[42px] mt-1 mb-2 space-y-0.5 pl-4 border-l-2 border-white/[0.06]">
                  {/* Segmented bar showing subcategory proportions */}
                  {group.subcategories.length > 1 && (
                    <div className="flex h-2.5 rounded-full overflow-hidden mb-2">
                      {group.subcategories.map((sub, si) => (
                        <div
                          key={sub.name}
                          className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                          style={{
                            width: `${sub.percent}%`,
                            backgroundColor: color,
                            opacity: 0.8 - si * 0.12,
                          }}
                          title={`${sub.name}: ${sub.percent.toFixed(0)}%`}
                        />
                      ))}
                      {(() => {
                        const subTotal = group.subcategories.reduce(
                          (s, sub) => s + sub.amount,
                          0,
                        );
                        const remainder = group.total - subTotal;
                        if (remainder > 1) {
                          const pct =
                            group.total > 0
                              ? (remainder / group.total) * 100
                              : 0;
                          return (
                            <div
                              className="h-full last:rounded-r-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: "rgba(255,255,255,0.08)",
                              }}
                              title={`No subcategory: ${pct.toFixed(0)}%`}
                            />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {group.subcategories.map((sub, si) => {
                    return (
                      <div
                        key={sub.name}
                        className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: color,
                            opacity: 0.8 - si * 0.12,
                          }}
                        />
                        <span className="text-sm text-white/70 truncate min-w-0 flex-1">
                          {sub.name}
                        </span>
                        <span className="text-xs text-white/30 shrink-0 tabular-nums">
                          {sub.count}
                        </span>
                        <BlurredAmount blurIntensity="sm">
                          <span
                            className="text-sm font-semibold tabular-nums shrink-0"
                            style={{ color, opacity: 0.8 }}
                          >
                            $
                            {sub.amount.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </BlurredAmount>
                        <span className="text-xs font-medium text-white/50 tabular-nums shrink-0 w-[38px] text-right">
                          {sub.percent.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}

                  {/* Uncategorized remainder */}
                  {(() => {
                    const subTotal = group.subcategories.reduce(
                      (s, sub) => s + sub.amount,
                      0,
                    );
                    const remainder = group.total - subTotal;
                    if (remainder > 1) {
                      const pct =
                        group.total > 0 ? (remainder / group.total) * 100 : 0;
                      return (
                        <div className="flex items-center gap-2.5 py-1.5 px-2 opacity-60">
                          <div className="w-2 h-2 rounded-full shrink-0 bg-white/10" />
                          <span className="text-sm text-white/30 italic flex-1">
                            No subcategory
                          </span>
                          <BlurredAmount blurIntensity="sm">
                            <span className="text-sm text-white/30 tabular-nums shrink-0">
                              $
                              {remainder.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </BlurredAmount>
                          <span className="text-xs text-white/25 tabular-nums shrink-0 w-[38px] text-right">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grand total footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">
          Total
        </span>
        <BlurredAmount blurIntensity="sm">
          <span className="text-sm font-bold text-white/80 tabular-nums">
            $
            {grandTotal.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </span>
        </BlurredAmount>
      </div>
    </WidgetCard>
  );
}
