"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { cn } from "@/lib/utils";
import { format, subMonths } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Focus,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

type Transaction = {
  amount: number;
  date: string;
  category?: string | null;
  subcategory?: string | null;
  category_color?: string | null;
};

type Props = {
  transactions: Transaction[];
  filtersOpen?: boolean;
  onCategoryDetailClick?: (
    category: string,
    zoomedMonth: string | null,
  ) => void;
};

type MonthBucket = { key: string; label: string };

type CategoryMonthly = {
  name: string;
  color: string;
  total: number;
  count: number;
  monthlyData: { month: string; label: string; amount: number }[];
  subcategories: SubcategoryMonthly[];
};

type SubcategoryMonthly = {
  name: string;
  color: string;
  total: number;
  monthlyData: { month: string; label: string; amount: number }[];
};

/** Visibility state per category: visible (default), hidden, or solo */
type VisibilityMode = "visible" | "hidden" | "solo";

// ── Palette for subcategories ─────────────────────────────────────────────────

const SUB_PALETTE = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#e879f9",
  "#4ade80",
  "#f87171",
  "#38bdf8",
  "#c084fc",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  if (n >= 10_000) return `$${(n / 1000).toFixed(0)}k`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

/** Build 12 month buckets ending at the current month */
function build12Months(): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    buckets.push({
      key: format(d, "yyyy-MM"),
      label: format(d, "MMM yy"),
    });
  }
  return buckets;
}

// ── Grouping ────────────────────────────────────────────────────────────────

type Grouping = "month" | "quarter" | "year";

/** Map a date string (yyyy-MM-dd or yyyy-MM) to a bucket key for the given grouping */
function dateToBucketKey(dateStr: string, grouping: Grouping): string {
  if (grouping === "month") return dateStr.slice(0, 7);
  if (grouping === "quarter") {
    const m = parseInt(dateStr.slice(5, 7), 10);
    return `${dateStr.slice(0, 4)}-Q${Math.ceil(m / 3)}`;
  }
  return dateStr.slice(0, 4);
}

/** Build buckets for the last 12 months, collapsed by grouping */
function buildBuckets(grouping: Grouping): MonthBucket[] {
  if (grouping === "month") return build12Months();
  const months = build12Months();
  const seen = new Map<string, string>();
  for (const m of months) {
    const key = dateToBucketKey(`${m.key}-01`, grouping);
    if (!seen.has(key)) {
      if (grouping === "quarter") {
        const q = Math.ceil(parseInt(m.key.slice(5, 7), 10) / 3);
        seen.set(key, `Q${q} ${m.key.slice(2, 4)}`);
      } else {
        seen.set(key, m.key.slice(0, 4));
      }
    }
  }
  return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
}

// ── Tooltip styling ─────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: "rgba(10,12,20,0.96)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: 500,
  padding: "12px 16px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
  backdropFilter: "blur(12px)",
} as const;

/** SVG defs for outlined bars with luminous glow */
function ChartDefs({ id, color }: { id: string; color: string }) {
  const bright = lightenHex(color, 30);
  return (
    <defs>
      {/* Inner fill: rich translucent gradient */}
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={bright} stopOpacity={0.45} />
        <stop offset="50%" stopColor={color} stopOpacity={0.22} />
        <stop offset="100%" stopColor={color} stopOpacity={0.1} />
      </linearGradient>
      {/* Top highlight shimmer — brighter, wider */}
      <linearGradient id={`${id}-highlight`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.28} />
        <stop offset="20%" stopColor="#fff" stopOpacity={0.1} />
        <stop offset="50%" stopColor="#fff" stopOpacity={0} />
      </linearGradient>
      {/* Outer glow — wider, stronger + subtle drop shadow for depth */}
      <filter id={`${id}-glow`} x="-40%" y="-15%" width="180%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
          result="glow"
        />
        {/* Drop shadow for bar depth */}
        <feDropShadow
          dx="0"
          dy="2"
          stdDeviation="3"
          floodColor="#000"
          floodOpacity="0.35"
          result="shadow"
        />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** Custom bar shape: outlined rectangle with inner glow fill + top highlight */
function OutlinedBar({
  x,
  y,
  width,
  height,
  fillId,
  highlightId,
  filterId,
  strokeColor,
  dimmed,
  onClick,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fillId: string;
  highlightId: string;
  filterId: string;
  strokeColor: string;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  if (!height || height <= 0) return null;
  const r = Math.min(5, width / 2, height);
  const bright = lightenHex(strokeColor, 25);
  return (
    <g
      filter={`url(#${filterId})`}
      opacity={dimmed ? 0.25 : 1}
      style={{
        cursor: onClick ? "pointer" : undefined,
        transition: "opacity 0.3s ease",
      }}
      onClick={onClick}
    >
      {/* Main translucent fill */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={r}
        ry={r}
        fill={`url(#${fillId})`}
      />
      {/* Top shimmer overlay — covers upper half */}
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.min(height, height * 0.55)}
        rx={r}
        ry={r}
        fill={`url(#${highlightId})`}
      />
      {/* Inner vertical side highlights */}
      <rect
        x={x}
        y={y}
        width={2}
        height={height}
        rx={1}
        fill={strokeColor}
        fillOpacity={0.15}
      />
      <rect
        x={x + width - 2}
        y={y}
        width={2}
        height={height}
        rx={1}
        fill={strokeColor}
        fillOpacity={0.08}
      />
      {/* Crisp outline — brighter */}
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={width - 1}
        height={height - 1}
        rx={r}
        ry={r}
        fill="none"
        stroke={bright}
        strokeWidth={1.3}
        strokeOpacity={0.7}
      />
      {/* Bright top edge accent — glowing */}
      <line
        x1={x + r}
        y1={y + 0.5}
        x2={x + width - r}
        y2={y + 0.5}
        stroke={bright}
        strokeWidth={2}
        strokeOpacity={0.9}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Lighten a hex color by a percentage */
function lightenHex(hex: string, pct: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round((255 * pct) / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round((255 * pct) / 100));
  const b = Math.min(255, (num & 0xff) + Math.round((255 * pct) / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ── Sidebar Category Index ──────────────────────────────────────────────────

function CategorySidebar({
  categories,
  visibility,
  onToggleVisibility,
  onResetAll,
  expandedSidebar,
  onToggleExpand,
  filtersOpen,
}: {
  categories: CategoryMonthly[];
  visibility: Map<string, VisibilityMode>;
  onToggleVisibility: (name: string, mode: VisibilityMode) => void;
  onResetAll: () => void;
  expandedSidebar: Set<string>;
  onToggleExpand: (name: string) => void;
  filtersOpen?: boolean;
}) {
  const hasSolo = Array.from(visibility.values()).some((v) => v === "solo");
  const hasHidden = Array.from(visibility.values()).some((v) => v === "hidden");
  const hasFilters = hasSolo || hasHidden;

  return (
    <div
      className={`fixed left-4 z-40 w-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent transition-all duration-300 ${filtersOpen ? "top-[28rem] max-h-[calc(100vh-29rem)]" : "top-[15.5rem] max-h-[calc(100vh-16rem)]"}`}
    >
      <div className="neo-card rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl shadow-black/30">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">
            Categories
          </span>
          {hasFilters && (
            <button
              onClick={onResetAll}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Reset
            </button>
          )}
        </div>

        {/* Category list */}
        <div className="px-2 pb-2.5 space-y-0.5">
          {categories.map((cat) => {
            const mode = visibility.get(cat.name) ?? "visible";
            const isVisible =
              mode === "visible" ? !hasSolo : mode === "solo" ? true : false;
            const isExpanded = expandedSidebar.has(cat.name);

            return (
              <div key={cat.name}>
                {/* Category row */}
                <div
                  className={cn(
                    "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-200 cursor-pointer",
                    isVisible
                      ? "hover:bg-white/[0.06]"
                      : "opacity-40 hover:opacity-60",
                  )}
                  onClick={() =>
                    cat.subcategories.length > 0 && onToggleExpand(cat.name)
                  }
                >
                  {/* Expand toggle for subcategories */}
                  {cat.subcategories.length > 0 ? (
                    <div className="p-0.5 shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-white/40" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-white/40" />
                      )}
                    </div>
                  ) : (
                    <div className="w-4" />
                  )}

                  {/* Color dot */}
                  <div
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10"
                    style={{ backgroundColor: cat.color }}
                  />

                  {/* Name */}
                  <span className="text-[12px] font-medium text-white/80 truncate flex-1 min-w-0">
                    {cat.name}
                  </span>

                  {/* Amount */}
                  <span
                    className="text-[11px] tabular-nums font-semibold shrink-0 mr-1"
                    style={{ color: isVisible ? cat.color : undefined }}
                  >
                    {fmtDollar(cat.total)}
                  </span>

                  {/* Action buttons (show on hover) */}
                  <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {" "}
                    {/* Solo button */}
                    <button
                      onClick={() =>
                        onToggleVisibility(
                          cat.name,
                          mode === "solo" ? "visible" : "solo",
                        )
                      }
                      className={cn(
                        "p-1 rounded transition-colors",
                        mode === "solo"
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "text-white/30 hover:text-white/60 hover:bg-white/10",
                      )}
                      title={
                        mode === "solo" ? "Remove solo" : "Solo this category"
                      }
                    >
                      <Focus className="w-3 h-3" />
                    </button>
                    {/* Hide button */}
                    <button
                      onClick={() =>
                        onToggleVisibility(
                          cat.name,
                          mode === "hidden" ? "visible" : "hidden",
                        )
                      }
                      className={cn(
                        "p-1 rounded transition-colors",
                        mode === "hidden"
                          ? "bg-red-500/20 text-red-400"
                          : "text-white/30 hover:text-white/60 hover:bg-white/10",
                      )}
                      title={mode === "hidden" ? "Show" : "Hide this category"}
                    >
                      {mode === "hidden" ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded subcategories */}
                <AnimatePresence>
                  {isExpanded && cat.subcategories.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="ml-8 pl-2.5 border-l border-white/[0.06] space-y-0.5 py-0.5">
                        {cat.subcategories.map((sub) => (
                          <div
                            key={sub.name}
                            className="flex items-center gap-2 px-2 py-1 rounded-md"
                          >
                            <div
                              className="w-2 h-2 rounded-sm shrink-0"
                              style={{ backgroundColor: sub.color }}
                            />
                            <span className="text-[11px] text-white/55 truncate flex-1 min-w-0">
                              {sub.name}
                            </span>
                            <span className="text-[10px] tabular-nums text-white/35 font-medium shrink-0">
                              {fmtDollar(sub.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Summary footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/40 font-medium">Total</span>
            <BlurredAmount blurIntensity="sm">
              <span className="text-[12px] text-white/70 font-bold tabular-nums">
                {fmtDollar(categories.reduce((s, c) => s + c.total, 0))}
              </span>
            </BlurredAmount>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function CategoriesV2TabContent({
  transactions,
  filtersOpen,
  onCategoryDetailClick,
}: Props) {
  const [grouping, setGrouping] = useState<Grouping>("month");
  const buckets = useMemo(() => buildBuckets(grouping), [grouping]);
  const bucketKeys = useMemo(
    () => new Set(buckets.map((b) => b.key)),
    [buckets],
  );

  // Toggle state: which categories are in "subcategory" view
  const [subcatView, setSubcatView] = useState<Set<string>>(new Set());
  // Sidebar: category visibility (solo/hide)
  const [visibility, setVisibility] = useState<Map<string, VisibilityMode>>(
    () => new Map(),
  );
  // Sidebar: expanded subcategory lists
  const [expandedSidebar, setExpandedSidebar] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleView = useCallback((cat: string) => {
    setSubcatView((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleToggleVisibility = useCallback(
    (name: string, mode: VisibilityMode) => {
      setVisibility((prev) => {
        const next = new Map(prev);
        // If switching to solo, clear other solos
        if (mode === "solo") {
          for (const [k, v] of next) {
            if (v === "solo") next.set(k, "visible");
          }
        }
        next.set(name, mode);
        return next;
      });
    },
    [],
  );

  const handleResetVisibility = useCallback(() => {
    setVisibility(new Map());
  }, []);

  const handleToggleSidebarExpand = useCallback((name: string) => {
    setExpandedSidebar((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── Aggregate transactions into per-category monthly data ──────────────

  const categories = useMemo(() => {
    const catMap = new Map<
      string,
      {
        color: string;
        total: number;
        count: number;
        months: Map<string, number>;
        subs: Map<
          string,
          { color: string; total: number; months: Map<string, number> }
        >;
      }
    >();

    for (const t of transactions) {
      const bucketKey = dateToBucketKey(t.date, grouping);
      if (!bucketKeys.has(bucketKey)) continue;

      const cat = t.category || "Uncategorized";
      const sub = t.subcategory || null;
      const amt = Math.abs(t.amount);

      if (!catMap.has(cat)) {
        catMap.set(cat, {
          color: t.category_color || "#64748b",
          total: 0,
          count: 0,
          months: new Map(),
          subs: new Map(),
        });
      }
      const entry = catMap.get(cat)!;
      entry.total += amt;
      entry.count += 1;
      entry.months.set(bucketKey, (entry.months.get(bucketKey) ?? 0) + amt);

      if (sub) {
        if (!entry.subs.has(sub)) {
          entry.subs.set(sub, {
            color: "",
            total: 0,
            months: new Map(),
          });
        }
        const se = entry.subs.get(sub)!;
        se.total += amt;
        se.months.set(bucketKey, (se.months.get(bucketKey) ?? 0) + amt);
      }
    }

    // Build sorted result
    const result: CategoryMonthly[] = [];

    for (const [name, data] of catMap) {
      if (data.total <= 0) continue;

      // Assign palette colors to subcategories
      const subEntries = Array.from(data.subs.entries()).sort(
        (a, b) => b[1].total - a[1].total,
      );

      const subcategories: SubcategoryMonthly[] = subEntries.map(
        ([subName, subData], idx) => ({
          name: subName,
          color: SUB_PALETTE[idx % SUB_PALETTE.length],
          total: subData.total,
          monthlyData: buckets.map((b) => ({
            month: b.key,
            label: b.label,
            amount: subData.months.get(b.key) ?? 0,
          })),
        }),
      );

      result.push({
        name,
        color: data.color,
        total: data.total,
        count: data.count,
        monthlyData: buckets.map((b) => ({
          month: b.key,
          label: b.label,
          amount: data.months.get(b.key) ?? 0,
        })),
        subcategories,
      });
    }

    result.sort((a, b) => b.total - a.total);
    return result;
  }, [transactions, buckets, bucketKeys, grouping]);

  // Compute visible categories based on visibility state
  const visibleCategories = useMemo(() => {
    const hasSolo = Array.from(visibility.values()).some((v) => v === "solo");
    return categories.filter((cat) => {
      const mode = visibility.get(cat.name) ?? "visible";
      if (mode === "hidden") return false;
      if (hasSolo && mode !== "solo") return false;
      return true;
    });
  }, [categories, visibility]);

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 text-white/40 text-sm">
        No expense data in the last 12 months
      </div>
    );
  }

  return (
    <>
      {/* Fixed floating sidebar — left of content, aligned with first widget */}
      <CategorySidebar
        categories={categories}
        visibility={visibility}
        onToggleVisibility={handleToggleVisibility}
        onResetAll={handleResetVisibility}
        expandedSidebar={expandedSidebar}
        onToggleExpand={handleToggleSidebarExpand}
        filtersOpen={filtersOpen}
      />

      {/* Main widget area */}
      <div className="space-y-6">
        {/* Period info */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 tracking-wide font-medium">
          <span className="flex-1">
            {buckets[0].label} — {buckets[buckets.length - 1].label} ·{" "}
            {buckets.length}{" "}
            {grouping === "month"
              ? "months"
              : grouping === "quarter"
                ? "quarters"
                : "years"}{" "}
            · {visibleCategories.length}/{categories.length} categories
          </span>
          <div className="flex rounded-lg bg-white/[0.08] p-0.5 shrink-0">
            {(["month", "quarter", "year"] as Grouping[]).map((g) => (
              <button
                key={g}
                onClick={() => setGrouping(g)}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all",
                  grouping === g
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60",
                )}
              >
                {g === "month" ? "Mo" : g === "quarter" ? "Qtr" : "Yr"}
              </button>
            ))}
          </div>
        </div>

        {/* One widget per visible category */}
        <AnimatePresence mode="popLayout">
          {visibleCategories.map((cat) => (
            <motion.div
              key={cat.name}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <CategoryWidget
                category={cat}
                isSubcatView={subcatView.has(cat.name)}
                onToggleView={() => toggleView(cat.name)}
                onDetailClick={onCategoryDetailClick}
                grouping={grouping}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {visibleCategories.length === 0 && (
          <div className="text-center py-16 text-white/40 text-sm">
            All categories hidden — use the sidebar to show them
          </div>
        )}
      </div>
    </>
  );
}

// ── Per-Category Widget ─────────────────────────────────────────────────────

function CategoryWidget({
  category,
  isSubcatView,
  onToggleView,
  onDetailClick,
  grouping,
}: {
  category: CategoryMonthly;
  isSubcatView: boolean;
  onDetailClick?: (category: string, zoomedMonth: string | null) => void;
  onToggleView: () => void;
  grouping: Grouping;
}) {
  const hasSubs = category.subcategories.length > 0;
  const showSubs = isSubcatView && hasSubs;

  // Month zoom state: null = show all, string = zoomed bucket key
  const [zoomedMonth, setZoomedMonth] = useState<string | null>(null);

  // Clear zoom when grouping changes
  useEffect(() => {
    setZoomedMonth(null);
  }, [grouping]);

  const avg = useMemo(() => {
    const nonZero = category.monthlyData.filter((m) => m.amount > 0);
    return nonZero.length > 0
      ? nonZero.reduce((s, m) => s + m.amount, 0) / nonZero.length
      : 0;
  }, [category.monthlyData]);

  const activeMonths = category.monthlyData.filter((m) => m.amount > 0).length;
  const groupLabel =
    grouping === "month" ? "mo" : grouping === "quarter" ? "qtr" : "yr";

  // Chart data for zoomed month view (just the single bar, centered)
  const zoomedData = useMemo(() => {
    if (!zoomedMonth) return null;
    return category.monthlyData.filter((m) => m.month === zoomedMonth);
  }, [zoomedMonth, category.monthlyData]);

  const zoomedLabel = zoomedData?.[0]?.label ?? "";
  const zoomedAmount = zoomedData?.[0]?.amount ?? 0;

  // Build chart data for subcategory stacked view
  const stackedData = useMemo(() => {
    if (!showSubs) return null;
    const data = category.monthlyData.map((m, i) => {
      const row: Record<string, string | number> = {
        label: m.label,
        month: m.month,
      };
      for (const sub of category.subcategories) {
        row[sub.name] = sub.monthlyData[i].amount;
      }
      // Add "Other" for uncategorized portion
      const subTotal = category.subcategories.reduce(
        (s, sub) => s + sub.monthlyData[i].amount,
        0,
      );
      const other = m.amount - subTotal;
      if (other > 0.01) {
        row["Other"] = other;
      }
      return row;
    });
    if (zoomedMonth) return data.filter((d) => d.month === zoomedMonth);
    return data;
  }, [showSubs, category, zoomedMonth]);

  // Subcategory names/colors (including "Other" if needed)
  const subEntries = useMemo(() => {
    if (!showSubs) return [];
    const entries = category.subcategories.map((s) => ({
      name: s.name,
      color: s.color,
    }));
    // Check if there's any "Other" amount
    const hasOther = category.monthlyData.some((m, i) => {
      const subTotal = category.subcategories.reduce(
        (s, sub) => s + sub.monthlyData[i].amount,
        0,
      );
      return m.amount - subTotal > 0.01;
    });
    if (hasOther) {
      entries.push({ name: "Other", color: "#475569" });
    }
    return entries;
  }, [showSubs, category]);

  // Zoomed sub-breakdown for single month
  const zoomedSubBreakdown = useMemo(() => {
    if (!zoomedMonth || !showSubs) return null;
    const monthIdx = category.monthlyData.findIndex(
      (m) => m.month === zoomedMonth,
    );
    if (monthIdx < 0) return null;
    return category.subcategories
      .map((sub) => ({
        name: sub.name,
        color: sub.color,
        amount: sub.monthlyData[monthIdx].amount,
      }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [zoomedMonth, showSubs, category]);

  const handleBarClick = useCallback((monthKey: string) => {
    setZoomedMonth((prev) => (prev === monthKey ? null : monthKey));
  }, []);

  const clearZoom = useCallback(() => setZoomedMonth(null), []);

  return (
    <WidgetCard
      title={category.name}
      subtitle={
        zoomedMonth
          ? `${zoomedLabel} · $${Math.round(zoomedAmount).toLocaleString()}`
          : undefined
      }
      filterActive={!!zoomedMonth}
      onFilterReset={clearZoom}
      action={
        <BlurredAmount blurIntensity="sm">
          <span
            className="text-[15px] font-bold tabular-nums tracking-tight"
            style={{ color: category.color }}
          >
            {fmtDollar(category.total)}
          </span>
        </BlurredAmount>
      }
    >
      {/* Consolidated stats bar */}
      {!zoomedMonth && (
        <div className="flex items-center gap-2 flex-wrap px-1 mb-2 text-[11px] text-white/45 font-medium tabular-nums">
          <BlurredAmount blurIntensity="sm">
            <span>
              Total:{" "}
              <span
                className="text-white/70 font-semibold"
                style={{ color: category.color }}
              >
                {fmtDollar(category.total)}
              </span>
            </span>
          </BlurredAmount>
          <span className="text-white/20">|</span>
          <BlurredAmount blurIntensity="sm">
            <span>
              Avg:{" "}
              <span className="text-white/70 font-semibold">
                {fmtDollar(avg)}/{groupLabel}
              </span>
            </span>
          </BlurredAmount>
          <span className="text-white/20">|</span>
          <span>
            <span className="text-white/70 font-semibold">{activeMonths}</span>{" "}
            {grouping === "month"
              ? "months"
              : grouping === "quarter"
                ? "quarters"
                : "years"}
          </span>
          <span className="text-white/20">|</span>
          <span>
            <span className="text-white/70 font-semibold">
              {category.count}
            </span>{" "}
            txns
          </span>
        </div>
      )}
      {/* Color accent bar */}
      <div
        className="h-[3px] rounded-full mb-4"
        style={{
          background: `linear-gradient(90deg, ${category.color}cc, ${category.color}40 60%, transparent)`,
        }}
      />

      {/* Chart with zoom animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${showSubs ? "subs" : "cat"}-${zoomedMonth ?? "all"}`}
          initial={
            zoomedMonth
              ? { opacity: 0, scale: 1.08, filter: "blur(6px)" }
              : { opacity: 0, scale: 0.94, filter: "blur(4px)" }
          }
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={
            zoomedMonth
              ? { opacity: 0, scale: 0.94, filter: "blur(4px)" }
              : { opacity: 0, scale: 1.06, filter: "blur(6px)" }
          }
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <CategoryChart
            category={category}
            showSubs={showSubs}
            stackedData={stackedData}
            subEntries={subEntries}
            zoomedMonth={zoomedMonth}
            onBarClick={handleBarClick}
          />
        </motion.div>
      </AnimatePresence>

      {/* ── Action strip: toggle + CTA ─────────────────────────────── */}
      <div className="flex items-center gap-2 mt-3">
        {/* Segmented category/subcategory toggle */}
        {hasSubs && (
          <div className="flex rounded-lg bg-white/[0.06] p-0.5">
            <button
              onClick={showSubs ? onToggleView : undefined}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                !showSubs
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/40 hover:text-white/60",
              )}
            >
              Category
            </button>
            <button
              onClick={!showSubs ? onToggleView : undefined}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                showSubs
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/40 hover:text-white/60",
              )}
            >
              Subs
            </button>
          </div>
        )}
        <div className="flex-1" />
        {/* View Transactions CTA */}
        {onDetailClick && (
          <button
            onClick={() => onDetailClick(category.name, zoomedMonth)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-cyan-400/80 hover:text-cyan-300 bg-cyan-500/[0.08] hover:bg-cyan-500/15 transition-colors"
          >
            {zoomedMonth ? `View ${zoomedLabel}` : "View All"}
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── Selected month panel ──────────────────────────────────────── */}
      <AnimatePresence>
        {zoomedMonth && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 mt-2 px-2 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <div
                className="w-1 h-8 rounded-full shrink-0"
                style={{ backgroundColor: category.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white/50 font-medium">
                  {zoomedLabel}
                </div>
                <BlurredAmount blurIntensity="sm">
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: category.color }}
                  >
                    ${Math.round(zoomedAmount).toLocaleString()}
                  </span>
                </BlurredAmount>
              </div>
              {/* Sub-breakdown in zoomed view */}
              {zoomedSubBreakdown && zoomedSubBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {zoomedSubBreakdown.map((sub) => (
                    <div key={sub.name} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{ backgroundColor: sub.color }}
                      />
                      <span className="text-[10px] text-white/50">
                        {sub.name}
                      </span>
                      <span className="text-[10px] tabular-nums text-white/70 font-semibold">
                        ${Math.round(sub.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subcategory legend (when in subcategory view, not zoomed) */}
      {showSubs && !zoomedMonth && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 px-1">
          {subEntries.map((sub) => (
            <div key={sub.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${lightenHex(sub.color, 15)}, ${sub.color})`,
                }}
              />
              <span className="text-xs text-white/65 font-medium">
                {sub.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ── Chart with Outlined Glow Bars ───────────────────────────────────────────

function CategoryChart({
  category,
  showSubs,
  stackedData,
  subEntries,
  zoomedMonth,
  onBarClick,
}: {
  category: CategoryMonthly;
  showSubs: boolean;
  stackedData: Record<string, string | number>[] | null;
  subEntries: { name: string; color: string }[];
  zoomedMonth: string | null;
  onBarClick: (monthKey: string) => void;
}) {
  const uid = useId().replace(/:/g, "");

  const commonAxisProps = {
    tickLine: false as const,
    axisLine: false as const,
  };

  // Build subcategory breakdown lookup by month for custom tooltip
  const subBreakdownByMonth = useMemo(() => {
    const map = new Map<
      string,
      { name: string; color: string; amount: number }[]
    >();
    for (let mi = 0; mi < category.monthlyData.length; mi++) {
      const m = category.monthlyData[mi];
      const subs = category.subcategories
        .map((sub) => ({
          name: sub.name,
          color: sub.color,
          amount: sub.monthlyData[mi].amount,
        }))
        .filter((s) => s.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      // Add "Other" if there's a gap
      const subTotal = subs.reduce((s, x) => s + x.amount, 0);
      const other = m.amount - subTotal;
      if (other > 0.5) {
        subs.push({ name: "Other", color: "#475569", amount: other });
      }
      map.set(m.month, subs);
    }
    return map;
  }, [category]);

  // Custom tooltip that always shows subcategory breakdown
  const renderTooltip = useCallback(
    ({ active, label }: { active?: boolean; label?: string }) => {
      if (!active || !label) return null;
      // Find the month entry by label
      const monthEntry = category.monthlyData.find((m) => m.label === label);
      if (!monthEntry) return null;
      const subs = subBreakdownByMonth.get(monthEntry.month) ?? [];
      const total = monthEntry.amount;

      return (
        <div style={TOOLTIP_STYLE}>
          <div
            style={{
              color: "rgba(255,255,255,0.7)",
              fontWeight: 600,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            {label}
          </div>
          {subs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {subs.map((s) => (
                <div
                  key={s.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 3,
                        backgroundColor: s.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {s.name}
                    </span>
                  </div>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 12,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${Math.round(s.amount).toLocaleString("en-US")}
                  </span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  marginTop: 4,
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    color: category.color,
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ${Math.round(total).toLocaleString("en-US")}
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 13,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ${Math.round(total).toLocaleString("en-US")}
            </div>
          )}
        </div>
      );
    },
    [category, subBreakdownByMonth],
  );

  const tooltipProps = {
    content: renderTooltip as any,
    cursor: { fill: "rgba(255,255,255,0.04)", radius: 4 } as const,
  };

  const xAxisProps = {
    dataKey: "label" as const,
    tick: { fill: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 },
    ...commonAxisProps,
    tickMargin: 8,
  };

  const yAxisProps = {
    tick: { fill: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 500 },
    ...commonAxisProps,
    tickFormatter: (v: number) => fmtDollar(v),
    width: 52,
    tickMargin: 4,
  };

  // ── Stacked subcategory view ──────────────────────────────────────────
  if (showSubs && stackedData) {
    return (
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={stackedData}
            barCategoryGap={zoomedMonth ? "40%" : "20%"}
            onClick={(state: any) => {
              if (state?.activePayload?.[0]?.payload?.month) {
                onBarClick(state.activePayload[0].payload.month as string);
              }
            }}
          >
            {/* One set of defs per subcategory color */}
            {subEntries.map((sub, i) => (
              <ChartDefs key={sub.name} id={`${uid}-s${i}`} color={sub.color} />
            ))}
            <CartesianGrid
              strokeDasharray="3 6"
              stroke="rgba(255,255,255,0.10)"
              vertical={false}
            />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} />
            {subEntries.map((sub, i) => (
              <Bar
                key={sub.name}
                dataKey={sub.name}
                stackId="subs"
                fill="transparent"
                maxBarSize={zoomedMonth ? 90 : undefined}
                style={{ cursor: "pointer" }}
                shape={(props: any) => (
                  <OutlinedBar
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={props.height}
                    fillId={`${uid}-s${i}-fill`}
                    highlightId={`${uid}-s${i}-highlight`}
                    filterId={`${uid}-s${i}-glow`}
                    strokeColor={sub.color}
                  />
                )}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Single category view (zoomed or all) ─────────────────────────────
  const chartData = zoomedMonth
    ? category.monthlyData.filter((m) => m.month === zoomedMonth)
    : category.monthlyData;
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap={zoomedMonth ? "40%" : "20%"}>
          <ChartDefs id={uid} color={category.color} />
          <CartesianGrid
            strokeDasharray="3 6"
            stroke="rgba(255,255,255,0.10)"
            vertical={false}
          />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Bar
            dataKey="amount"
            fill="transparent"
            maxBarSize={zoomedMonth ? 90 : undefined}
            style={{ cursor: "pointer" }}
            shape={(props: any) => {
              const monthKey = chartData[props.index]?.month;
              return (
                <OutlinedBar
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  fillId={`${uid}-fill`}
                  highlightId={`${uid}-highlight`}
                  filterId={`${uid}-glow`}
                  strokeColor={category.color}
                  onClick={() => monthKey && onBarClick(monthKey)}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
