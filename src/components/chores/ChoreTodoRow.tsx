"use client";

import {
  ChoreSwipe,
  type ChoreSwipeSide,
} from "@/components/chores/ChoreSwipe";
import {
  ChoreDayChips,
  PersonTag,
  personTone,
  useChoreTone,
  type ChorePerson,
} from "@/components/chores/choreUi";
import type { ChoreDayOption, ChoreTodo } from "@/features/chores/choreWeek";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronUp,
  Clock3,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { useId, useState } from "react";

const PERIOD_TAG = { biweekly: "2 wk", monthly: "Month" } as const;

export type ChoreHousehold = ChorePerson & { id: string };

interface ChoreTodoRowProps {
  todo: ChoreTodo;
  /** Who it belongs to now */
  person: ChorePerson | null;
  me: ChoreHousehold | null;
  partner: ChoreHousehold | null;
  open: boolean;
  pending: boolean;
  /** yyyy-MM-dd preselected when the chore can take it; the chips stay one tap away */
  targetDate?: string | null;
  onOpenChange: (open: boolean) => void;
  /** time null = all day; userId undefined = keep who it belongs to */
  onAssign: (
    option: ChoreDayOption,
    time: string | null,
    userId: string | undefined,
  ) => Promise<void>;
}

export function ChoreTodoRow({
  todo,
  person,
  me,
  partner,
  open,
  pending,
  targetDate,
  onOpenChange,
  onAssign,
}: ChoreTodoRowProps) {
  const tone = useChoreTone();
  const pickerId = useId();
  const target = targetDate
    ? todo.days.find((day) => day.date === targetDate && day.enabled)
    : undefined;
  const [chosen, setChosen] = useState<ChoreSwipeSide | null>(null);
  const [day, setDay] = useState<string | null>(
    () => (target ?? todo.days.find((d) => d.enabled))?.date ?? null,
  );
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  const owner = chosen === "me" ? me : chosen === "partner" ? partner : null;
  const shown = owner ?? person;
  const option = todo.days.find((d) => d.date === day && d.enabled);
  const meta = [
    todo.target > 1 ? `${todo.remaining} left` : null,
    todo.period === "biweekly" || todo.period === "monthly"
      ? PERIOD_TAG[todo.period]
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const setOpen = (next: boolean) => {
    if (!next) {
      setChosen(null);
    }
    onOpenChange(next);
  };
  const commit = async (at: string | null) => {
    if (!option) return;
    setBusy(true);
    try {
      await onAssign(option, at, owner?.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChoreSwipe
      me={me}
      partner={partner}
      disabled={pending}
      onSwipe={(side) => {
        setChosen(side);
        onOpenChange(true);
      }}
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border transition-colors",
          tone.row,
          shown
            ? personTone(shown.color, tone.isFrost).outline
            : open && tone.tc.border,
        )}
      >
        <div className="flex min-h-[76px] items-center gap-3 pl-3.5 pr-2.5">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={pickerId}
            disabled={pending}
            className={cn(
              "min-h-14 min-w-0 flex-1 rounded-lg py-3 text-left disabled:opacity-50",
              tone.focus,
            )}
          >
            <span
              className={cn(
                "block break-words text-sm font-semibold leading-5",
                tone.main,
              )}
            >
              {todo.title}
            </span>
            {(meta || shown) && (
              <span className="mt-1.5 flex flex-wrap items-center gap-2">
                {meta && (
                  <span className={cn("text-[11px]", tone.subtle)}>{meta}</span>
                )}
                <PersonTag person={shown} />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={pickerId}
            aria-label={`${open ? "Close assignment for" : "Assign"} ${todo.title}`}
            disabled={pending}
            className={cn(
              "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors active:scale-95 disabled:opacity-50 motion-reduce:transform-none",
              tone.focus,
              open
                ? tone.selected
                : cn(tone.accentSurface, tone.accent, tone.tc.bgHover),
            )}
          >
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Assign
          </button>
        </div>

        {open && (
          <div
            id={pickerId}
            className={cn("space-y-2.5 border-t px-2.5 pb-3 pt-3", tone.border)}
          >
            <ChoreDayChips
              days={todo.days}
              selected={day ?? undefined}
              disabled={busy}
              onPick={(picked) => setDay(picked.date)}
            />
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <button
                type="button"
                onClick={() => commit(null)}
                disabled={busy || !option}
                className={cn(
                  "h-11 rounded-xl border text-xs font-semibold transition-colors active:scale-95 disabled:opacity-50 motion-reduce:transform-none",
                  tone.accentSurface,
                  tone.accent,
                  tone.focus,
                )}
              >
                All day
              </button>
              <label
                className={cn(
                  "flex h-11 min-w-0 items-center gap-1.5 rounded-xl px-2.5 text-xs",
                  tone.ghost,
                )}
              >
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Time</span>
                <input
                  type="time"
                  value={time}
                  disabled={busy}
                  onChange={(event) => setTime(event.target.value)}
                  className={cn(
                    "h-full min-w-0 flex-1 rounded-md bg-transparent tabular-nums",
                    tone.focus,
                  )}
                  style={{ colorScheme: tone.isFrost ? "light" : "dark" }}
                />
              </label>
              <button
                type="button"
                onClick={() => commit(time || null)}
                disabled={busy || !option}
                aria-label={time ? `Assign at ${time}` : "Assign all day"}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors active:scale-95 disabled:opacity-50 motion-reduce:transform-none",
                  tone.selected,
                  tone.focus,
                )}
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </ChoreSwipe>
  );
}
