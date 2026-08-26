"use client";

// Detail for one row whose twin already sits in a different account.
//
// The list card can only show a truncated description, so the decision it asks
// for — same money, or a genuinely separate charge? — is made without seeing
// either side in full. This puts both sides on screen: the bank's row, and the
// transaction it resembles, each with its own date, amount and wording.

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { formatStatementDate } from "@/features/statement-import/sessionModel";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { ParsedTransaction } from "@/types/statement";

type Twin = {
  account: string;
  date: string;
  amount: number;
  description: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ParsedTransaction;
  twin: Twin;
  currency: string;
  onSkip: () => void;
  onImport: () => void;
  /** Shows the year on every date — only when this statement spans more than one. */
  showYear?: boolean;
};

export function OtherAccountSheet({
  open,
  onOpenChange,
  row,
  twin,
  currency,
  onSkip,
  onImport,
  showYear = false,
}: Props) {
  const tc = useThemeClasses();
  const symbol = getCurrencySymbol(currency);
  const longDate = (iso: string) =>
    formatStatementDate(iso, { weekday: true, year: showYear });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn(tc.cardBg)}>
        <div className="mx-auto w-full max-w-md flex flex-col min-h-0 flex-1">
          <div className="px-4 pt-3 pb-2">
            <DrawerTitle className={cn("text-base font-semibold", tc.headerText)}>
              {row.description}
            </DrawerTitle>
          </div>

          <div className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
            <Side
              label="This statement"
              date={longDate(row.date)}
              amount={`${symbol}${row.amount.toFixed(2)}`}
              description={row.description}
            />
            <Side
              label={twin.account}
              date={longDate(twin.date)}
              amount={`${symbol}${twin.amount.toFixed(2)}`}
              description={twin.description || "—"}
            />
          </div>

          <div
            className="px-4 pt-2 pb-4 flex gap-2"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => {
                onSkip();
                onOpenChange(false);
              }}
              className={cn(
                "rounded-xl h-12 flex-1 text-sm font-medium",
                tc.buttonPrimary,
              )}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => {
                onImport();
                onOpenChange(false);
              }}
              className={cn(
                "rounded-xl h-12 flex-1 text-sm",
                tc.buttonOutline,
              )}
            >
              Import
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Side({
  label,
  date,
  amount,
  description,
}: {
  label: string;
  date: string;
  amount: string;
  description: string;
}) {
  const tc = useThemeClasses();
  return (
    <div className={cn("rounded-xl p-3 flex flex-col gap-1.5", tc.pillBg)}>
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "text-[11px] uppercase tracking-wider truncate flex-1 min-w-0",
            tc.textFaint,
          )}
        >
          {label}
        </span>
        <span className={cn("text-sm tabular-nums shrink-0", tc.headerText)}>
          {amount}
        </span>
      </div>
      <p className={cn("text-xs", tc.text)}>{description}</p>
      <p className={cn("text-[11px]", tc.textFaint)}>{date}</p>
    </div>
  );
}
