"use client";

import {
  ChoreSwipe,
  type ChoreSwipeSide,
} from "@/components/chores/ChoreSwipe";
import {
  formatChoreTime,
  PersonTag,
  personTone,
  useChoreTone,
  type ChorePerson,
} from "@/components/chores/choreUi";
import type { ChoreSlot } from "@/features/chores/choreWeek";
import { useChoreSlotActions } from "@/features/chores/useChoreActions";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Check, ChevronRight, Clock3, LoaderCircle } from "lucide-react";

interface ChoreRowProps {
  slot: ChoreSlot;
  person: ChorePerson | null;
  /** Show the day in the subline (Completed in week view) */
  showDay?: "weekday" | "date";
  /** Swipe targets; null when it already belongs to them */
  me?: ChorePerson | null;
  partner?: ChorePerson | null;
  onReassign?: (side: ChoreSwipeSide) => void;
  onOpen: () => void;
}

export function ChoreRow({
  slot,
  person,
  showDay,
  me = null,
  partner = null,
  onReassign,
  onOpen,
}: ChoreRowProps) {
  const tone = useChoreTone();
  const actions = useChoreSlotActions(slot);
  const time = formatChoreTime(slot.time) ?? "All day";
  const day = showDay
    ? format(parseISO(slot.date), showDay === "date" ? "MMM d" : "EEE d")
    : null;
  const sub = [day, time].filter(Boolean).join(" · ");

  return (
    <ChoreSwipe
      me={me}
      partner={partner}
      disabled={!onReassign || slot.done}
      onSwipe={(side) => onReassign?.(side)}
    >
      <div
        className={cn(
          "group flex min-h-[76px] items-center gap-1 rounded-2xl border p-1.5 transition-colors sm:gap-2 sm:p-2",
          tone.row,
          person
            ? personTone(person.color, tone.isFrost).outline
            : tone.tc.borderHover,
        )}
      >
        <button
          type="button"
          onClick={() => (slot.done ? actions.reopen() : actions.complete())}
          disabled={actions.isPending}
          aria-label={
            slot.done ? `Reopen ${slot.item.title}` : `Done: ${slot.item.title}`
          }
          aria-pressed={slot.done}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50",
            tone.focus,
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] transition-colors",
              slot.done
                ? cn(tone.tc.progressFill, "border-transparent text-white")
                : tone.isFrost
                  ? "border-slate-300 group-hover:border-indigo-400"
                  : cn("border-white/30", tone.tc.borderHover),
            )}
          >
            {actions.isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
            ) : slot.done ? (
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            ) : null}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${slot.item.title}`}
          className={cn(
            "flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-xl py-2 pr-2 text-left",
            tone.focus,
          )}
        >
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block break-words text-sm font-semibold leading-5",
                slot.done ? cn("line-through", tone.subtle) : tone.main,
              )}
            >
              {slot.item.title}
            </span>
            {(sub || person) && (
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {sub && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] tabular-nums",
                      tone.subtle,
                    )}
                  >
                    <Clock3 className="h-3 w-3" aria-hidden />
                    {sub}
                  </span>
                )}
                <PersonTag person={person} />
              </span>
            )}
          </span>
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none",
              tone.subtle,
            )}
            aria-hidden
          />
        </button>
      </div>
    </ChoreSwipe>
  );
}
