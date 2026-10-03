"use client";

import type { ChoreSlot } from "@/features/chores/choreWeek";
import { useChoreSlotActions } from "@/features/chores/useChoreActions";
import { useChoreTone } from "@/components/chores/choreUi";
import { cn } from "@/lib/utils";
import { localToISO } from "@/lib/utils/date";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  SkipForward,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

interface ChoreCheckInPanelProps {
  entries: ChoreSlot[];
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
  const tone = useChoreTone();
  const contentId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const unresolved = useMemo(
    () =>
      entries
        .filter((entry) => !entry.done)
        .sort(
          (a, b) =>
            parseISO(a.plannedAt).getTime() - parseISO(b.plannedAt).getTime(),
        ),
    [entries],
  );

  if (unresolved.length === 0) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left transition-colors",
          tone.tc.bgHover,
          tone.focus,
        )}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className={cn("flex items-center gap-2 text-sm font-medium", tone.soft)}>
          <ClipboardCheck className={cn("h-4 w-4 shrink-0", tone.accent)} />
          Sunday check-in
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("text-xs font-medium tabular-nums", tone.subtle)}>
            {unresolved.length}
          </span>
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform motion-reduce:transition-none",
              tone.subtle,
              isOpen && "rotate-90",
            )}
          />
        </span>
      </button>

      {isOpen && (
        <div id={contentId} className="space-y-2">
          {unresolved.map((entry) => (
            <ChoreCheckInRow key={entry.key} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}

function ChoreCheckInRow({ entry }: { entry: ChoreSlot }) {
  const tone = useChoreTone();
  const choreActions = useChoreSlotActions(entry);
  const plannedAt = entry.plannedAt;
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
        "rounded-2xl border p-3 sm:p-4",
        tone.row,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-40">
          <p className={cn("break-words text-sm font-medium leading-relaxed", tone.main)}>
            {entry.item.title}
          </p>
          <p className={cn("mt-0.5 text-xs", tone.subtle)}>
            {format(parseISO(plannedAt), "EEE, MMM d 'at' h:mm a")}
          </p>
        </div>
        <div className={cn("flex shrink-0 rounded-xl p-1", tone.tc.tabsListBg)}>
          <button
            type="button"
            onClick={() => setChoice("done")}
            aria-pressed={choice === "done"}
            disabled={isResolving}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-50",
              choice === "done" ? tone.selected : cn(tone.soft, tone.tc.bgHover),
              tone.focus,
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Done
          </button>
          <button
            type="button"
            onClick={() => setChoice("skipped")}
            aria-pressed={choice === "skipped"}
            disabled={isResolving}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-50",
              choice === "skipped" ? tone.selected : cn(tone.soft, tone.tc.bgHover),
              tone.focus,
            )}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skipped
          </button>
        </div>
      </div>

      {choice === "done" && (
        <div className="mt-3 space-y-1.5">
          <label
            className={cn("block text-xs font-medium", tone.soft)}
            htmlFor={`done-${entry.key}`}
          >
            Completed at
          </label>
          <input
            id={`done-${entry.key}`}
            type="datetime-local"
            value={completedAt}
            onChange={(event) => setCompletedAt(event.target.value)}
            className={cn(
              "h-11 w-full min-w-0 rounded-xl border px-3 text-sm outline-none",
              tone.tc.formControlBg,
              tone.main,
              tone.focus,
              tone.isFrost ? "[color-scheme:light]" : "[color-scheme:dark]",
            )}
          />
        </div>
      )}

      {choice === "skipped" && (
        <div className="mt-3 space-y-2">
          <label
            className={cn("block text-xs font-medium", tone.soft)}
            htmlFor={`reason-${entry.key}`}
          >
            Reason
          </label>
          <textarea
            id={`reason-${entry.key}`}
            value={skipReason}
            onChange={(event) => setSkipReason(event.target.value)}
            rows={2}
            className={cn(
              "w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none",
              tone.tc.formControlBg,
              tone.main,
              tone.focus,
            )}
          />
        </div>
      )}

      {choice && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className={cn(
              "h-11 min-w-20 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              tone.tc.buttonPrimary,
              tone.tc.textButton,
              tone.focus,
            )}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
