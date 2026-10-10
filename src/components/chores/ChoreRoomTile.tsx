"use client";

import { useChoreTone } from "@/components/chores/choreUi";
import {
  roomGradient,
  type RoomStyle,
} from "@/components/chores/roomStyle";
import type { RoomStat } from "@/features/chores/roomStats";
import { cn } from "@/lib/utils";
import { Check, CircleDashed, Clock3 } from "lucide-react";

const DONE = "#34d399";

interface ChoreRoomTileProps {
  name: string;
  style: RoomStyle;
  stat: RoomStat | undefined;
  onOpen: () => void;
}

/** Gradient room tile: done · assigned · still to place, with a split bar. */
export function ChoreRoomTile({ name, style, stat, onOpen }: ChoreRoomTileProps) {
  const tone = useChoreTone();
  const done = stat?.done ?? 0;
  const assigned = stat?.assigned ?? 0;
  const unassigned = stat?.unassigned ?? 0;
  const total = done + assigned + unassigned;
  const cleared = total > 0 && unassigned === 0;

  const segment = (count: number) => (total > 0 ? (count / total) * 100 : 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${name}: ${done} done, ${assigned} assigned, ${unassigned} to plan`}
      className={cn(
        "relative min-h-[148px] select-none overflow-hidden rounded-2xl text-left transition-transform duration-150 active:scale-95 motion-reduce:transform-none",
        tone.focus,
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: roomGradient(style),
          opacity: cleared ? 0.65 : 1,
        }}
      />
      <div
        className="absolute inset-0 rounded-2xl"
        style={{ border: `1px solid ${style.accent}40` }}
      />
      <div className="relative flex h-full min-h-[148px] flex-col p-3.5">
        <div className="flex flex-1 items-center justify-center pt-1">
          <div
            className="rounded-2xl p-2"
            style={{ backgroundColor: `${style.accent}1f` }}
          >
            {style.icon(style.accent)}
          </div>
        </div>
        <p className={cn("mt-2 truncate text-sm font-semibold", tone.main)}>
          {name}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-xs font-semibold tabular-nums">
          <span className="flex items-center gap-1" style={{ color: DONE }}>
            <Check className="h-3 w-3" aria-hidden />
            {done}
          </span>
          <span className="flex items-center gap-1" style={{ color: style.accent }}>
            <Clock3 className="h-3 w-3" aria-hidden />
            {assigned}
          </span>
          <span className={cn("flex items-center gap-1", tone.subtle)}>
            <CircleDashed className="h-3 w-3" aria-hidden />
            {unassigned}
          </span>
        </div>
        <div
          className="mt-2 flex h-1 w-full overflow-hidden rounded-full bg-white/10"
          aria-hidden
        >
          <div
            className="h-1 transition-all duration-500"
            style={{ width: `${segment(done)}%`, backgroundColor: DONE }}
          />
          <div
            className="h-1 transition-all duration-500"
            style={{ width: `${segment(assigned)}%`, backgroundColor: style.accent }}
          />
        </div>
      </div>
    </button>
  );
}
