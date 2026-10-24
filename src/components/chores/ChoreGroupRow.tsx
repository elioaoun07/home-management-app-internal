"use client";

import {
  formatChoreTime,
  PersonTag,
  personTone,
  TargetTag,
  useChoreTone,
  type ChorePerson,
} from "@/components/chores/choreUi";
import type { ChoreGroup } from "@/features/chores/choreGroups";
import type { ChoreSlot } from "@/features/chores/choreWeek";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Clock3, Layers, LoaderCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

interface ChoreGroupRowProps {
  group: ChoreGroup;
  /** Shared owner of every slot, else null */
  person: ChorePerson | null;
  pending: boolean;
  onComplete: () => void;
  renderSlot: (slot: ChoreSlot) => ReactNode;
}

/** One chore across several rooms: one tap completes them all, expand for each room. */
export function ChoreGroupRow({
  group,
  person,
  pending,
  onComplete,
  renderSlot,
}: ChoreGroupRowProps) {
  const tone = useChoreTone();
  const [open, setOpen] = useState(false);
  const { slots, title } = group;
  const sameTime = slots.every((slot) => slot.time === slots[0].time);
  const time = sameTime ? (formatChoreTime(slots[0].time) ?? "All day") : null;
  const over = slots.reduce<ChoreSlot["over"]>(
    (best, slot) =>
      slot.over && (!best || slot.over.rank > best.rank) ? slot.over : best,
    undefined,
  );
  const rooms = slots.every(
    (slot) => typeof slot.item.metadata_json?.room_id === "string",
  );

  return (
    <div
      className={cn(
        "rounded-2xl border transition-colors",
        tone.row,
        person
          ? personTone(person.color, tone.isFrost).outline
          : tone.tc.borderHover,
      )}
    >
      <div className="group flex min-h-[76px] items-center gap-1 p-1.5 sm:gap-2 sm:p-2">
        <button
          type="button"
          onClick={onComplete}
          disabled={pending}
          aria-label={`Done: ${title}, ${slots.length}`}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50",
            tone.focus,
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] transition-colors",
              tone.isFrost
                ? "border-slate-300 group-hover:border-indigo-400"
                : cn("border-white/30", tone.tc.borderHover),
            )}
          >
            {pending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
            ) : (
              <Check className="h-3.5 w-3.5 opacity-0" strokeWidth={3} />
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn(
            "flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-xl py-2 pr-2 text-left",
            tone.focus,
          )}
        >
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block break-words text-sm font-semibold leading-5",
                tone.main,
              )}
            >
              {title}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] tabular-nums",
                  tone.accent,
                )}
              >
                <Layers className="h-3 w-3" aria-hidden />
                {rooms ? `${slots.length} rooms` : slots.length}
              </span>
              {time && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] tabular-nums",
                    tone.subtle,
                  )}
                >
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {time}
                </span>
              )}
              <PersonTag person={person} />
              {over && <TargetTag label={`${over.rank}/${over.target}`} />}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-50 transition-transform motion-reduce:transition-none",
              tone.subtle,
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>
      {open && (
        <div className="space-y-2 px-1.5 pb-1.5 sm:px-2 sm:pb-2">
          {slots.map(renderSlot)}
        </div>
      )}
    </div>
  );
}
