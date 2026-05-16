"use client";

import { useCatalogueItems, useCatalogueModules } from "@/features/catalogue";
import {
  formatPeriodLabel,
  getPeriodBoundaries,
} from "@/features/items/useFlexibleRoutines";
import { useItems } from "@/features/items/useItems";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { CatalogueItem } from "@/types/catalogue";
import type { FlexiblePeriod, ItemWithDetails } from "@/types/items";
import { AnimatePresence, motion } from "framer-motion";
import { format, isWithinInterval } from "date-fns";
import {
  BookMarked,
  CheckCircle2,
  Clock,
  GripVertical,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_ORDER: FlexiblePeriod[] = ["weekly", "biweekly", "monthly"];

const PERIOD_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

const PERIOD_HEADER_DARK: Record<string, string> = {
  weekly: "text-cyan-300 border-cyan-500/20 bg-cyan-500/[0.07]",
  biweekly: "text-violet-300 border-violet-500/20 bg-violet-500/[0.07]",
  monthly: "text-amber-300 border-amber-500/20 bg-amber-500/[0.07]",
};

const PERIOD_HEADER_FROST: Record<string, string> = {
  weekly: "text-cyan-700 border-cyan-200 bg-cyan-50",
  biweekly: "text-violet-700 border-violet-200 bg-violet-50",
  monthly: "text-amber-700 border-amber-200 bg-amber-50",
};

const PERIOD_ICON_DARK: Record<string, string> = {
  weekly: "text-cyan-400",
  biweekly: "text-violet-400",
  monthly: "text-amber-400",
};

const PERIOD_ICON_FROST: Record<string, string> = {
  weekly: "text-cyan-600",
  biweekly: "text-violet-600",
  monthly: "text-amber-600",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateEntry = {
  tpl: CatalogueItem;
  period: FlexiblePeriod;
  target: number;
  scheduledCount: number;
  needsCount: number;
};

type PeriodGroup = {
  period: FlexiblePeriod;
  label: string;
  dateRange: string;
  entries: TemplateEntry[];
};

// ─── Drag Overlay Ghost ───────────────────────────────────────────────────────

export function CatalogueItemDragOverlay({
  item,
  isPink,
  isFrost,
}: {
  item: CatalogueItem;
  isPink: boolean;
  isFrost: boolean;
}) {
  const accentGradient = isPink
    ? "from-pink-500 via-purple-500 to-indigo-500"
    : isFrost
      ? "from-indigo-500 via-blue-500 to-cyan-500"
      : "from-cyan-500 via-blue-500 to-indigo-500";

  return (
    <div
      className={cn(
        "w-60 rounded-2xl overflow-hidden shadow-[0_24px_60px_-10px_rgba(0,0,0,0.55)]",
        "rotate-2 scale-105",
        isFrost
          ? "bg-white border border-slate-200"
          : "bg-gray-900/98 border border-white/20",
      )}
    >
      <div className={cn("h-1.5 w-full bg-gradient-to-r", accentGradient)} />
      <div className="p-3.5 flex items-center gap-2.5">
        <div
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
            isPink
              ? "bg-pink-500/20 ring-1 ring-pink-400/30"
              : isFrost
                ? "bg-indigo-100 ring-1 ring-indigo-200"
                : "bg-cyan-500/20 ring-1 ring-cyan-400/30",
          )}
        >
          <Sparkles
            className={cn(
              "w-4 h-4",
              isPink ? "text-pink-300" : isFrost ? "text-indigo-500" : "text-cyan-300",
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-bold truncate",
              isFrost ? "text-slate-800" : "text-white",
            )}
          >
            {item.name}
          </p>
          <p
            className={cn(
              "text-[10px] mt-0.5",
              isFrost ? "text-slate-500" : "text-white/40",
            )}
          >
            Drop on a time slot
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Draggable Card ───────────────────────────────────────────────────────────

function DraggableCatalogueCard({
  entry,
  isPink,
  isFrost,
}: {
  entry: TemplateEntry;
  isPink: boolean;
  isFrost: boolean;
}) {
  const { tpl, target, scheduledCount, needsCount } = entry;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: tpl.id, data: { catalogueItem: tpl } });

  const style = { transform: CSS.Translate.toString(transform) };
  const accentGradient = isPink
    ? "from-pink-500 to-purple-500"
    : isFrost
      ? "from-indigo-400 to-blue-500"
      : "from-cyan-400 to-blue-500";

  // Progress dots (max 5 shown, then "+N")
  const showDots = target > 1 && target <= 5;
  const dots = Array.from({ length: target }, (_, i) => i < scheduledCount);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      animate={{ opacity: isDragging ? 0.2 : 1 }}
      transition={{ duration: 0.12 }}
      className={cn(
        "relative rounded-xl border overflow-hidden",
        "select-none cursor-grab active:cursor-grabbing transition-shadow",
        isFrost
          ? "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md shadow-sm"
          : "bg-white/[0.04] border-white/[0.09] hover:bg-white/[0.07] hover:border-white/[0.16] hover:shadow-lg hover:shadow-black/30",
      )}
      whileHover={{ y: -1 }}
      {...attributes}
      {...listeners}
    >
      {/* Accent stripe */}
      <div className={cn("h-[3px] w-full bg-gradient-to-r", accentGradient)} />

      <div className="p-3">
        {/* Title + grip */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h4
              className={cn(
                "text-[12px] font-semibold leading-snug",
                isFrost ? "text-slate-800" : "text-white/90",
              )}
            >
              {tpl.name}
            </h4>
            {tpl.description && (
              <p
                className={cn(
                  "text-[10px] mt-0.5 line-clamp-1 leading-relaxed",
                  isFrost ? "text-slate-500" : "text-white/35",
                )}
              >
                {tpl.description}
              </p>
            )}
          </div>
          <GripVertical
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0 mt-0.5",
              isFrost ? "text-slate-300" : "text-white/15",
            )}
          />
        </div>

        {/* Meta row: duration + "N needed" badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {tpl.preferred_duration_minutes != null &&
              tpl.preferred_duration_minutes > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-medium border",
                    isFrost
                      ? "bg-slate-50 text-slate-500 border-slate-200"
                      : "bg-white/[0.04] text-white/40 border-white/[0.07]",
                  )}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {formatDuration(tpl.preferred_duration_minutes)}
                </span>
              )}

            {tpl.preferred_time && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-medium border",
                  isFrost
                    ? "bg-slate-50 text-slate-500 border-slate-200"
                    : "bg-white/[0.04] text-white/40 border-white/[0.07]",
                )}
              >
                <Zap className="w-2.5 h-2.5" />
                {tpl.preferred_time}
              </span>
            )}
          </div>

          {/* "N needed" pill */}
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-bold border flex-shrink-0",
              isFrost
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-amber-500/15 text-amber-300 border-amber-500/25",
            )}
          >
            {needsCount === 1 ? "1 left" : `${needsCount} left`}
          </span>
        </div>

        {/* Progress dots for multi-occurrence routines */}
        {showDots && (
          <div className="flex items-center gap-1 mt-2">
            {dots.map((filled, i) => (
              <div
                key={i}
                className={cn(
                  "w-4 h-1.5 rounded-full transition-all",
                  filled
                    ? isPink
                      ? "bg-pink-400"
                      : isFrost
                        ? "bg-indigo-400"
                        : "bg-cyan-400"
                    : isFrost
                      ? "bg-slate-200"
                      : "bg-white/[0.12]",
                )}
              />
            ))}
            {target > 5 && (
              <span
                className={cn(
                  "text-[9px] font-bold",
                  isFrost ? "text-slate-400" : "text-white/25",
                )}
              >
                +{target - 5}
              </span>
            )}
          </div>
        )}

        {/* Drag hint */}
        <div
          className={cn(
            "mt-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest",
            isFrost ? "text-slate-300" : "text-white/12",
          )}
        >
          <GripVertical className="w-2.5 h-2.5" />
          Drag to a time slot
        </div>
      </div>
    </motion.div>
  );
}

// ─── Period group header ──────────────────────────────────────────────────────

function PeriodGroupHeader({
  group,
  isFrost,
}: {
  group: PeriodGroup;
  isFrost: boolean;
}) {
  const colorDark = PERIOD_HEADER_DARK[group.period] ?? PERIOD_HEADER_DARK.weekly;
  const colorFrost = PERIOD_HEADER_FROST[group.period] ?? PERIOD_HEADER_FROST.weekly;
  const iconDark = PERIOD_ICON_DARK[group.period] ?? PERIOD_ICON_DARK.weekly;
  const iconFrost = PERIOD_ICON_FROST[group.period] ?? PERIOD_ICON_FROST.weekly;
  const total = group.entries.reduce((s, e) => s + e.needsCount, 0);

  return (
    <div
      className={cn(
        "flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[10px] font-bold",
        isFrost ? colorFrost : colorDark,
      )}
    >
      <div className="flex items-center gap-1.5">
        <RotateCcw
          className={cn("w-3 h-3", isFrost ? iconFrost : iconDark)}
        />
        <span>{PERIOD_LABELS[group.period]}</span>
        <span
          className={cn(
            "font-normal opacity-60",
            isFrost ? "text-current" : "text-current",
          )}
        >
          · {group.dateRange}
        </span>
      </div>
      <span
        className={cn(
          "px-1.5 py-0.5 rounded-full text-[9px] font-black",
          isFrost
            ? "bg-current/10 text-current"
            : "bg-current/15 text-current",
        )}
      >
        {total}
      </span>
    </div>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

interface CatalogueSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPink: boolean;
  isFrost: boolean;
  /** The Monday of the currently visible week, used to compute period boundaries */
  weekStart: Date;
}

export function CatalogueSidePanel({
  isOpen,
  onClose,
  isPink,
  isFrost,
  weekStart,
}: CatalogueSidePanelProps) {
  const { data: catalogueModules = [] } = useCatalogueModules();
  const { data: catalogueItemsData = [] } = useCatalogueItems();
  const { data: items = [] } = useItems();

  const tasksModuleId = useMemo(
    () => catalogueModules.find((m) => m.type === "tasks")?.id,
    [catalogueModules],
  );

  // All flexible catalogue templates
  const flexibleTemplates = useMemo(
    () =>
      catalogueItemsData.filter(
        (it) =>
          it.module_id === tasksModuleId &&
          it.is_flexible_routine === true &&
          it.recurrence_pattern !== null,
      ),
    [catalogueItemsData, tasksModuleId],
  );

  // Period boundaries keyed by FlexiblePeriod
  const periodInfo = useMemo(() => {
    const result = {} as Record<
      FlexiblePeriod,
      { start: Date; end: Date; label: string; dateRange: string }
    >;
    for (const p of PERIOD_ORDER) {
      const { start, end } = getPeriodBoundaries(weekStart, p);
      result[p] = {
        start,
        end,
        label: formatPeriodLabel(p, weekStart),
        dateRange: `${format(start, "MMM d")} – ${format(end, "MMM d")}`,
      };
    }
    return result;
  }, [weekStart]);

  // Build groups: only include entries that still need scheduling
  const periodGroups = useMemo<PeriodGroup[]>(() => {
    const map = new Map<FlexiblePeriod, TemplateEntry[]>();

    for (const tpl of flexibleTemplates) {
      const period = (tpl.recurrence_pattern ?? "weekly") as FlexiblePeriod;
      const { start, end } = periodInfo[period];
      const target = Math.max(1, tpl.flexible_occurrences ?? 1);

      const scheduled = (items as ItemWithDetails[]).filter((item) => {
        if (item.source_catalogue_item_id !== tpl.id) return false;
        const dueAt =
          item.reminder_details?.due_at ?? item.event_details?.start_at;
        if (!dueAt) return false;
        return isWithinInterval(new Date(dueAt), { start, end });
      });

      const scheduledCount = scheduled.length;
      const needsCount = Math.max(0, target - scheduledCount);
      if (needsCount === 0) continue; // fully scheduled — skip

      const entry: TemplateEntry = {
        tpl,
        period,
        target,
        scheduledCount,
        needsCount,
      };
      const list = map.get(period) ?? [];
      list.push(entry);
      map.set(period, list);
    }

    return PERIOD_ORDER.filter((p) => map.has(p)).map((p) => ({
      period: p,
      label: PERIOD_LABELS[p],
      dateRange: periodInfo[p].dateRange,
      entries: map.get(p)!,
    }));
  }, [flexibleTemplates, items, periodInfo]);

  const totalRemaining = periodGroups.reduce(
    (s, g) => s + g.entries.reduce((ss, e) => ss + e.needsCount, 0),
    0,
  );

  const iconGradient = isPink
    ? "from-pink-500 to-purple-600 shadow-pink-500/25"
    : isFrost
      ? "from-indigo-500 to-blue-600 shadow-indigo-500/25"
      : "from-cyan-500 to-blue-600 shadow-cyan-500/25";

  const accentIcon = isPink
    ? "text-pink-400"
    : isFrost
      ? "text-indigo-500"
      : "text-cyan-400";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="catalogue-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 272, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          className="flex-shrink-0 overflow-hidden"
        >
          <div
            className={cn(
              "w-[272px] flex flex-col rounded-2xl border",
              isFrost
                ? "bg-white/95 border-slate-200/70 shadow-xl shadow-slate-200/60"
                : "bg-[#0c1118]/90 border-white/[0.07] shadow-2xl shadow-black/50 backdrop-blur-xl",
            )}
          >
            {/* Header */}
            <div
              className={cn(
                "flex items-center justify-between px-4 py-3.5 border-b flex-shrink-0",
                isFrost ? "border-slate-100" : "border-white/[0.06]",
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shadow-lg",
                    `bg-gradient-to-br ${iconGradient}`,
                  )}
                >
                  <BookMarked className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3
                      className={cn(
                        "text-[13px] font-bold leading-tight",
                        isFrost ? "text-slate-800" : "text-white/90",
                      )}
                    >
                      Unscheduled
                    </h3>
                    {totalRemaining > 0 && (
                      <span
                        className={cn(
                          "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                          isPink
                            ? "bg-pink-500/20 text-pink-300"
                            : isFrost
                              ? "bg-indigo-100 text-indigo-600"
                              : "bg-cyan-500/20 text-cyan-300",
                        )}
                      >
                        {totalRemaining}
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-[10px] mt-0.5",
                      isFrost ? "text-slate-400" : "text-white/30",
                    )}
                  >
                    Drag to a time slot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                  isFrost
                    ? "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    : "hover:bg-white/[0.08] text-white/25 hover:text-white/55",
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 300px)", minHeight: 120 }}
            >
              {periodGroups.length === 0 ? (
                /* All done state */
                <div className="flex flex-col items-center justify-center py-10 gap-3 px-4">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      isFrost
                        ? "bg-green-50 ring-1 ring-green-200"
                        : "bg-green-500/[0.08] ring-1 ring-green-500/20",
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        "w-6 h-6",
                        isFrost ? "text-green-500" : "text-green-400",
                      )}
                    />
                  </div>
                  <div className="text-center">
                    <p
                      className={cn(
                        "text-[12px] font-semibold",
                        isFrost ? "text-slate-700" : "text-white/70",
                      )}
                    >
                      All scheduled!
                    </p>
                    <p
                      className={cn(
                        "text-[11px] mt-0.5 leading-relaxed",
                        isFrost ? "text-slate-400" : "text-white/30",
                      )}
                    >
                      All routines are scheduled for this period.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 space-y-4">
                  {periodGroups.map((group) => (
                    <div key={group.period} className="space-y-2">
                      {/* Group header */}
                      <PeriodGroupHeader group={group} isFrost={isFrost} />

                      {/* Cards */}
                      <div className="space-y-2 pl-0.5">
                        {group.entries.map((entry) => (
                          <DraggableCatalogueCard
                            key={entry.tpl.id}
                            entry={entry}
                            isPink={isPink}
                            isFrost={isFrost}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className={cn(
                "px-4 py-3 border-t flex items-center gap-2 flex-shrink-0",
                isFrost ? "border-slate-100" : "border-white/[0.05]",
              )}
            >
              <Sparkles className={cn("w-3 h-3 flex-shrink-0", accentIcon)} />
              <span
                className={cn(
                  "text-[10px] leading-snug",
                  isFrost ? "text-slate-400" : "text-white/22",
                )}
              >
                Only showing routines not yet scheduled
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
