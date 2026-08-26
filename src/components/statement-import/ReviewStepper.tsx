"use client";

// One undecided row at a time, for the tail end of a review.
//
// The merchant list is the right shape for the BULK of a statement: most rows
// belong to a handful of merchants, and one tap categorizes all of them. It is
// the wrong shape for the last stretch — a dozen one-off rows, each its own
// group, each needing a scroll-find-tap-close cycle. This is the escape hatch
// for exactly that: the queue of rows that still owe a category, presented one
// per screen with the picker already open.
//
// Why not a carousel over the WHOLE statement: it would cost one interaction
// per row even for rows that need nothing, hide the overview, and fight the
// horizontal scroll of the content underneath. So the stepper is opt-in and
// only ever walks rows the owner genuinely has to answer for.

import { CategoryPicker } from "@/components/statement-import/CategoryPicker";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { formatStatementDate } from "@/features/statement-import/sessionModel";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCurrencySymbol } from "@/lib/currency";
import type { GroupCategory, RowDecision } from "@/lib/statementImportSession";
import { cn } from "@/lib/utils";
import type { ParsedTransaction } from "@/types/statement";
import { ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The undecided queue, read once when the stepper opens. */
  rows: ParsedTransaction[];
  accountId: string;
  currency: string;
  decisions: Record<string, RowDecision>;
  resolveCategory: (row: ParsedTransaction) => GroupCategory;
  onRowChange: (rowId: string, patch: Partial<RowDecision>) => void;
  /** Shows the year on every date — only when this statement spans more than one. */
  showYear?: boolean;
};

export function ReviewStepper({
  open,
  onOpenChange,
  rows,
  accountId,
  currency,
  decisions,
  resolveCategory,
  onRowChange,
  showYear = false,
}: Props) {
  const tc = useThemeClasses();
  const symbol = getCurrencySymbol(currency);
  const longDate = (iso: string) =>
    formatStatementDate(iso, { weekday: true, year: showYear });

  // The queue is SNAPSHOT on open, never live. Answering a row removes it from
  // the caller's undecided list, so a live queue would renumber under the
  // owner's thumb — "3 of 12" would jump to "3 of 11" and skip the next row.
  const [queue, setQueue] = useState<ParsedTransaction[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQueue(rows);
      setIndex(0);
    }
    // `rows` is deliberately not a dependency — re-snapshotting mid-review is
    // the exact renumbering bug described above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const row = queue[index];
  const isLast = index >= queue.length - 1;

  const advance = () => {
    if (isLast) onOpenChange(false);
    else setIndex((i) => i + 1);
  };

  if (!row) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn(tc.cardBg)}>
          <div className="mx-auto w-full max-w-md px-4 py-10">
            <DrawerTitle className="sr-only">Review queue</DrawerTitle>
            <p className={cn("text-sm text-center", tc.textFaint)}>
              Nothing left to review.
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  const target = resolveCategory(row);
  const decision = decisions[row.id];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn(tc.cardBg)}>
        <div className="mx-auto w-full max-w-md flex flex-col min-h-0 flex-1">
          <div className="px-4 pt-3 pb-2 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className={cn("h-1.5 rounded-full flex-1", tc.progressBg)}>
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    tc.progressFill,
                  )}
                  style={{ width: `${((index + 1) / queue.length) * 100}%` }}
                />
              </div>
              <span className={cn("text-[11px] shrink-0", tc.textFaint)}>
                {index + 1} of {queue.length}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <DrawerTitle
                className={cn(
                  "text-base font-semibold truncate min-w-0 flex-1",
                  tc.headerText,
                )}
              >
                {decision?.description?.trim() || row.description}
              </DrawerTitle>
              <span className={cn("text-sm tabular-nums shrink-0", tc.text)}>
                {symbol}
                {row.amount.toFixed(2)}
              </span>
            </div>

            <p className={cn("text-[11px] truncate", tc.textFaint)}>
              {longDate(decision?.date || row.date)}
            </p>
          </div>

          <div className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
            <input
              type="text"
              value={decision?.description ?? ""}
              onChange={(e) =>
                onRowChange(row.id, { description: e.target.value })
              }
              placeholder={row.description}
              maxLength={500}
              aria-label="Save this transaction as"
              className={cn("rounded-lg px-3 h-11 text-sm w-full", tc.formInput)}
            />

            <CategoryPicker
              accountId={accountId}
              categoryId={target.category_id}
              subcategoryId={target.subcategory_id}
              onChange={(next) => onRowChange(row.id, next)}
              onDone={advance}
            />
          </div>

          <div
            className={cn("px-4 pt-2 pb-4 flex items-center gap-2 border-t", tc.border)}
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40",
                tc.buttonGhost,
                tc.textMuted,
              )}
              aria-label="Previous row"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                onRowChange(row.id, { resolution: "skip" });
                advance();
              }}
              className={cn(
                "rounded-xl h-12 px-4 text-xs flex items-center gap-1.5",
                tc.buttonOutline,
              )}
            >
              <EyeOff className="w-4 h-4" />
              Skip
            </button>

            <button
              type="button"
              onClick={advance}
              className={cn(
                "rounded-xl h-12 flex-1 text-sm font-medium flex items-center justify-center gap-1.5",
                tc.buttonPrimary,
              )}
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
