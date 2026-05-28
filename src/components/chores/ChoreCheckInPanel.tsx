"use client";

import {
  getChorePlannedAt,
  useChoreActions,
} from "@/features/chores/useChoreActions";
import { type FlexibleRoutineItem } from "@/features/items/useFlexibleRoutines";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { localToISO } from "@/lib/utils/date";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  SkipForward,
} from "lucide-react";
import { useMemo, useState } from "react";

interface ChoreCheckInPanelProps {
  entries: FlexibleRoutineItem[];
}

function toLocalDateTimeInputValue(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
}

function localDateTimeInputToISO(value: string): string | null {
  const [date, time] = value.split("T");
  if (!date || !time) return null;
  return localToISO(date, time);
}

export function ChoreCheckInPanel({ entries }: ChoreCheckInPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unresolved = useMemo(
    () =>
      entries
        .filter((entry) => !entry.completedAction)
        .sort((a, b) => {
          const aTime = parseISO(getChorePlannedAt(a)).getTime();
          const bTime = parseISO(getChorePlannedAt(b)).getTime();
          return aTime - bTime;
        }),
    [entries],
  );

  if (unresolved.length === 0) return null;

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between px-1 text-left"
        aria-expanded={isOpen}
      >
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/45">
          <ClipboardCheck className="h-3.5 w-3.5 text-amber-300" />
          Sunday check-in
        </h3>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
            {unresolved.length} pending
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-white/35 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </span>
      </button>

      {isOpen && (
        <div className="space-y-2">
          {unresolved.map((entry) => (
            <ChoreCheckInRow
              key={`${entry.id}-${getChorePlannedAt(entry)}`}
              entry={entry}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ChoreCheckInRow({ entry }: { entry: FlexibleRoutineItem }) {
  const tc = useThemeClasses();
  const choreActions = useChoreActions(entry);
  const plannedAt = getChorePlannedAt(entry);
  const [choice, setChoice] = useState<"done" | "skipped" | null>(null);
  const [completedAt, setCompletedAt] = useState(() =>
    toLocalDateTimeInputValue(plannedAt),
  );
  const [skipReason, setSkipReason] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  if (isResolved) return null;

  const handleSave = async () => {
    if (!choice) return;
    setIsResolving(true);
    try {
      if (choice === "done") {
        const completedIso = localDateTimeInputToISO(completedAt);
        if (!completedIso) return;
        await choreActions.completeAt(completedIso);
      } else {
        const reason = skipReason.trim();
        if (!reason) return;
        await choreActions.skip(reason);
      }
      setIsResolved(true);
    } finally {
      setIsResolving(false);
    }
  };

  const saveDisabled =
    isResolving ||
    !choice ||
    (choice === "done" && !completedAt) ||
    (choice === "skipped" && skipReason.trim().length === 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-400/15 px-4 py-3",
        tc.surfaceBg,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-medium", tc.headerText)}>
            {entry.title}
          </p>
          <p className="mt-0.5 text-xs text-white/35">
            {format(parseISO(plannedAt), "EEE, MMM d 'at' h:mm a")}
          </p>
        </div>
        <div className="flex shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          <button
            type="button"
            onClick={() => setChoice("done")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
              choice === "done"
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-white/45 hover:text-white/70",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Done
          </button>
          <button
            type="button"
            onClick={() => setChoice("skipped")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
              choice === "skipped"
                ? "bg-amber-500/20 text-amber-300"
                : "text-white/45 hover:text-white/70",
            )}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skipped
          </button>
        </div>
      </div>

      {choice === "done" && (
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs font-medium text-white/45" htmlFor={`done-${entry.id}`}>
            Completed at
          </label>
          <input
            id={`done-${entry.id}`}
            type="datetime-local"
            value={completedAt}
            onChange={(event) => setCompletedAt(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-400/40"
          />
        </div>
      )}

      {choice === "skipped" && (
        <div className="mt-3 space-y-2">
          <label className="text-xs font-medium text-white/45" htmlFor={`reason-${entry.id}`}>
            Reason
          </label>
          <textarea
            id={`reason-${entry.id}`}
            value={skipReason}
            onChange={(event) => setSkipReason(event.target.value)}
            rows={2}
            placeholder="What got in the way?"
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-amber-400/40"
          />
        </div>
      )}

      {choice && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
