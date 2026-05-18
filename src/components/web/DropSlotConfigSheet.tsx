"use client";

import { ResponsibleUserPicker } from "@/components/items/ResponsibleUserPicker";
import {
  useCreateReminder,
  useCreateTask,
  useDeleteItem,
} from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { CatalogueItem } from "@/types/catalogue";
import type { CreateSubtaskInput } from "@/types/items";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Calendar,
  Clock,
  Sparkles,
  Timer,
  Undo2,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AlertOption = { value: number | null; label: string; short: string };
const ALERT_OPTIONS: AlertOption[] = [
  { value: null, label: "No alert", short: "Off" },
  { value: 0, label: "At time", short: "At time" },
  { value: 15, label: "15 min", short: "15m" },
  { value: 30, label: "30 min", short: "30m" },
  { value: 60, label: "1 hour", short: "1h" },
  { value: 1440, label: "1 day", short: "1d" },
];

function parseSubtasks(text: string | null | undefined): CreateSubtaskInput[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l, i) => ({
      title: l.replace(/^[-*•]\s*|\d+\.\s*/g, "").trim(),
      order_index: i,
    }))
    .filter((s) => s.title.length > 0);
}

function combineDateAndTime(date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const dt = new Date(date);
  dt.setHours(h ?? 9, m ?? 0, 0, 0);
  return dt.toISOString();
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DropSlotConfigSheetProps {
  catalogueItem: CatalogueItem;
  targetDate: Date;
  /** Time pre-filled from the dropped hour slot (e.g. "09:00"). Overrides the catalogue default. */
  droppedTime?: string;
  onClose: () => void;
  isPink: boolean;
  isFrost: boolean;
}

export function DropSlotConfigSheet({
  catalogueItem,
  targetDate,
  droppedTime,
  onClose,
  isPink,
  isFrost,
}: DropSlotConfigSheetProps) {
  const createReminder = useCreateReminder();
  const createTask = useCreateTask();
  const deleteItem = useDeleteItem();

  // droppedTime (from the exact hour slot) takes priority over the catalogue default
  const defaultTime = droppedTime ?? catalogueItem.preferred_time ?? "09:00";
  const defaultDurationStr =
    catalogueItem.preferred_duration_minutes != null &&
    catalogueItem.preferred_duration_minutes > 0
      ? String(catalogueItem.preferred_duration_minutes)
      : "";

  const [time, setTime] = useState(defaultTime);
  const [durationStr, setDurationStr] = useState(defaultDurationStr);
  const [alertOffset, setAlertOffset] = useState<number | null>(0);
  const [responsibleUserId, setResponsibleUserId] = useState<
    string | undefined
  >(undefined);
  const [notifyAll, setNotifyAll] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const period = (catalogueItem.recurrence_pattern as string) ?? "weekly";

  // ── Accent palette ────────────────────────────────────────────────────────
  const accentGradient = isPink
    ? "from-pink-500 to-purple-600"
    : isFrost
      ? "from-indigo-500 to-blue-600"
      : "from-cyan-500 to-blue-600";

  const accentActivePill = isPink
    ? "bg-pink-500/30 ring-1 ring-pink-400/60 text-pink-100"
    : isFrost
      ? "bg-indigo-600 text-white shadow-sm"
      : "bg-cyan-500/30 ring-1 ring-cyan-400/60 text-cyan-100";

  const inactivePill = isFrost
    ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200"
    : "bg-white/[0.05] text-white/50 ring-1 ring-white/[0.08] hover:bg-white/[0.09]";

  const inputClass = cn(
    "w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-all",
    "focus:outline-none focus:ring-2",
    isFrost
      ? "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:ring-indigo-200 focus:border-indigo-300"
      : "bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/25 focus:ring-cyan-500/30 focus:border-white/20",
  );

  const labelClass = cn(
    "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest",
    isFrost ? "text-slate-400" : "text-white/35",
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (isPending) return;
    setIsPending(true);
    try {
      const dueAtIso = combineDateAndTime(targetDate, time);
      const duration = durationStr
        ? parseInt(durationStr, 10) || undefined
        : undefined;
      const subtasks = parseSubtasks(catalogueItem.subtasks_text);
      const priority =
        catalogueItem.priority === "critical"
          ? "urgent"
          : ((catalogueItem.priority as
              | "low"
              | "normal"
              | "high"
              | "urgent") ?? "normal");

      const alertsInput =
        alertOffset === null
          ? []
          : alertOffset === 0
            ? [{ kind: "absolute" as const, trigger_at: dueAtIso, channel: "push" as const }]
            : [
                {
                  kind: "relative" as const,
                  offset_minutes: alertOffset,
                  relative_to: "due" as const,
                  channel: "push" as const,
                },
              ];

      const itemType: "reminder" | "task" =
        catalogueItem.item_type === "reminder" ? "reminder" : "task";
      let createdId: string | undefined;

      if (itemType === "reminder") {
        const res = await createReminder.mutateAsync({
          type: "reminder",
          title: catalogueItem.name,
          description: catalogueItem.description || undefined,
          priority,
          is_public: catalogueItem.is_public,
          responsible_user_id: catalogueItem.is_public
            ? responsibleUserId
            : undefined,
          due_at: dueAtIso,
          estimate_minutes: duration,
          has_checklist: subtasks.length > 0,
          subtasks,
          source_catalogue_item_id: catalogueItem.id,
          is_template_instance: true,
          alerts: alertsInput,
        });
        createdId = (res as { id?: string } | undefined)?.id;
      } else {
        const res = await createTask.mutateAsync({
          type: "task",
          title: catalogueItem.name,
          description: catalogueItem.description || undefined,
          priority,
          is_public: catalogueItem.is_public,
          responsible_user_id: catalogueItem.is_public
            ? responsibleUserId
            : undefined,
          due_at: dueAtIso,
          estimate_minutes: duration,
          subtasks: subtasks.length > 0 ? subtasks : undefined,
          source_catalogue_item_id: catalogueItem.id,
          is_template_instance: true,
          alerts: alertsInput,
        });
        createdId = (res as { id?: string } | undefined)?.id;
      }

      if (!createdId) throw new Error("Item creation failed");
      const newItemId = createdId;

      toast.success(
        `"${catalogueItem.name}" scheduled for ${format(targetDate, "EEE, MMM d")} at ${time}`,
        {
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await deleteItem.mutateAsync(newItemId);
                toast.success("Reverted", {
                  icon: <Undo2 className="w-4 h-4" />,
                });
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        },
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/65 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 36 }}
          className={cn(
            "relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl",
            isFrost
              ? "bg-white border border-slate-200/80"
              : "bg-[#0d1117] border border-white/[0.09]",
          )}
        >
          {/* Top gradient strip */}
          <div
            className={cn(
              "h-1.5 w-full bg-gradient-to-r",
              accentGradient,
            )}
          />

          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 sm:hidden">
            <div
              className={cn(
                "w-10 h-1 rounded-full",
                isFrost ? "bg-slate-300" : "bg-white/20",
              )}
            />
          </div>

          {/* Header */}
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg",
                  `bg-gradient-to-br ${accentGradient}`,
                )}
              >
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h2
                  className={cn(
                    "text-[15px] font-bold leading-tight truncate",
                    isFrost ? "text-slate-900" : "text-white",
                  )}
                >
                  {catalogueItem.name}
                </h2>
                <p
                  className={cn(
                    "text-[11px] mt-0.5 font-medium",
                    isFrost ? "text-slate-500" : "text-white/40",
                  )}
                >
                  {format(targetDate, "EEEE, MMMM d")} ·{" "}
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
                  isFrost
                    ? "hover:bg-slate-100 text-slate-400"
                    : "hover:bg-white/[0.08] text-white/25",
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div
            className={cn(
              "h-px mx-5",
              isFrost ? "bg-slate-100" : "bg-white/[0.05]",
            )}
          />

          {/* Form */}
          <div className="px-5 py-5 space-y-4">
            {/* Time */}
            <div className="space-y-2">
              <label className={labelClass}>
                <Clock className="w-3 h-3" />
                Time
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="09:00"
                className={inputClass}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className={labelClass}>
                <Timer className="w-3 h-3" />
                Duration (minutes)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder={defaultDurationStr || "e.g. 30"}
                className={inputClass}
              />
            </div>

            {/* Alert */}
            <div className="space-y-2">
              <label className={labelClass}>
                <Bell className="w-3 h-3" />
                Alert when
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALERT_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setAlertOffset(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all",
                      alertOffset === opt.value
                        ? accentActivePill
                        : inactivePill,
                    )}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Responsible – only for shared/public items */}
            {catalogueItem.is_public && (
              <div className="space-y-2">
                <label className={labelClass}>
                  <User className="w-3 h-3" />
                  Responsible
                </label>
                <ResponsibleUserPicker
                  value={responsibleUserId}
                  notifyAllHousehold={notifyAll}
                  onChange={(userId, notifyAllValue) => {
                    setResponsibleUserId(userId);
                    setNotifyAll(notifyAllValue);
                  }}
                  isPublic
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-6 space-y-2">
            <motion.button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              whileHover={{ scale: isPending ? 1 : 1.01 }}
              whileTap={{ scale: isPending ? 1 : 0.98 }}
              className={cn(
                "w-full py-3.5 rounded-2xl font-bold text-[14px] text-white",
                "flex items-center justify-center gap-2 transition-all shadow-lg",
                `bg-gradient-to-r ${accentGradient}`,
                isPending && "opacity-60 cursor-wait",
                !isPending && "hover:shadow-xl",
              )}
            >
              {isPending ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Scheduling…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Add to Calendar
                </>
              )}
            </motion.button>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "w-full py-2.5 rounded-xl text-sm font-medium transition-colors",
                isFrost
                  ? "text-slate-500 hover:bg-slate-100"
                  : "text-white/30 hover:bg-white/[0.05] hover:text-white/50",
              )}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
