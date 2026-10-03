"use client";

import { ChorePostponeSheet } from "@/components/chores/ChorePostponeSheet";
import {
  ChoreDayChips,
  formatChoreTime,
  PersonTag,
  useChoreTone,
  type ChorePerson,
} from "@/components/chores/choreUi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canUnassignOneOff,
  type ChoreDayOption,
  type ChoreSlot,
} from "@/features/chores/choreWeek";
import { useChoreSlotActions } from "@/features/chores/useChoreActions";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  CalendarClock,
  CalendarDays,
  CalendarMinus,
  CalendarX,
  Check,
  RotateCcw,
  UserRound,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

export interface ChoreSheetPersonAction {
  label: string;
  userId: string;
}

interface ChoreSheetProps {
  slot: ChoreSlot | null;
  person: ChorePerson | null;
  moveDays: ChoreDayOption[];
  personAction: ChoreSheetPersonAction | null;
  pending: boolean;
  onMove: (slot: ChoreSlot, date: string) => void;
  onUnassign: (slot: ChoreSlot) => void;
  onUnassignOneOff: (slot: ChoreSlot) => void;
  onSetResponsible: (slot: ChoreSlot, action: ChoreSheetPersonAction) => void;
  onClose: () => void;
}

/** Detail view for one chore slot: when, who, and its secondary actions. */
export function ChoreSheet(props: ChoreSheetProps) {
  if (!props.slot) return null;
  return <ChoreSheetBody key={props.slot.key} {...props} slot={props.slot} />;
}

function ChoreSheetBody({
  slot,
  person,
  moveDays,
  personAction,
  pending,
  onMove,
  onUnassign,
  onUnassignOneOff,
  onSetResponsible,
  onClose,
}: ChoreSheetProps & { slot: ChoreSlot }) {
  const tone = useChoreTone();
  const actions = useChoreSlotActions(slot);
  const [showPostpone, setShowPostpone] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [returnFocus] = useState(() =>
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const busy = pending || actions.isPending;
  const when = [
    format(parseISO(slot.date), "EEE d MMM"),
    formatChoreTime(slot.time),
  ]
    .filter(Boolean)
    .join(" · ");

  const run = (fn: () => unknown) => () => {
    fn();
    onClose();
  };

  const primaryAction = slot.done
    ? { label: "Reopen", Icon: RotateCcw, onClick: run(actions.reopen) }
    : { label: "Done", Icon: Check, onClick: run(actions.complete) };
  const buttons: {
    label: string;
    Icon: typeof Check;
    onClick: () => void;
  }[] = slot.done
    ? []
    : [
        { label: "Skip", Icon: CalendarX, onClick: run(() => actions.skip()) },
        ...(slot.flexible
          ? [
              {
                label: "Unassign",
                Icon: CalendarMinus,
                onClick: run(() => onUnassign(slot)),
              },
            ]
          : [
              {
                label: "Postpone",
                Icon: CalendarClock,
                onClick: () => setShowPostpone(true),
              },
              ...(canUnassignOneOff(slot)
                ? [
                    {
                      label: "Unassign",
                      Icon: CalendarMinus,
                      onClick: run(() => onUnassignOneOff(slot)),
                    },
                  ]
                : []),
            ]),
        ...(personAction
          ? [
              {
                label: personAction.label,
                Icon: UserRound,
                onClick: run(() => onSetResponsible(slot, personAction)),
              },
            ]
          : []),
      ];

  return (
    <>
      <Dialog
        open={!showPostpone}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!showPostpone && returnFocus?.isConnected) returnFocus.focus();
          }}
          className={cn(
            "left-0 top-auto bottom-0 max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 gap-5 overflow-y-auto rounded-b-none rounded-t-3xl border p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6",
            tone.tc.bgPage,
            tone.border,
          )}
        >
          <div
            className={cn(
              "mx-auto -mt-2 h-1 w-9 rounded-full sm:hidden",
              tone.tc.separatorBg,
            )}
            aria-hidden
          />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border",
                  tone.accentSurface,
                  tone.accent,
                )}
              >
                <CalendarDays className="h-5 w-5" aria-hidden />
              </div>
              <DialogTitle
                className={cn(
                  "break-words text-xl font-semibold leading-7 tracking-tight",
                  tone.main,
                )}
              >
                {slot.item.title}
              </DialogTitle>
              <DialogDescription
                className={cn("mt-2 text-sm tabular-nums", tone.soft)}
              >
                {when}
              </DialogDescription>
              <div className="mt-2 flex items-center gap-2">
                <PersonTag person={person} />
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                tone.ghost,
                tone.focus,
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {slot.flexible && !slot.done && (
            <div className={cn("space-y-3 rounded-2xl border p-3", tone.row)}>
              <p className={cn("text-xs font-semibold", tone.soft)}>Move to</p>
              <ChoreDayChips
                days={moveDays}
                selected={slot.date}
                disabled={busy}
                onPick={(option) => {
                  onMove(slot, option.date);
                  onClose();
                }}
              />
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={busy}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none",
                tone.tc.buttonPrimary,
                tone.tc.textButton,
                tone.focus,
              )}
            >
              <primaryAction.Icon className="h-4 w-4" />
              {primaryAction.label}
            </button>
            {buttons.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {buttons.map(({ label, Icon, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    disabled={busy}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none last:odd:col-span-2",
                      tone.ghost,
                      tone.focus,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ChorePostponeSheet
        isOpen={showPostpone}
        onClose={() => setShowPostpone(false)}
        onPostpone={(to, customDate) => {
          actions.postpone(to, customDate);
          setShowPostpone(false);
          onClose();
        }}
        plannedAt={slot.plannedAt}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // The detail dialog reopens before Postpone finishes its exit.
          // Restore focus after that exit instead of targeting its removed trigger.
          const target = closeButtonRef.current ?? returnFocus;
          if (target?.isConnected) target.focus();
        }}
      />
    </>
  );
}
