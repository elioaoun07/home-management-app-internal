"use client";

// One merchant in the review list — a single tap target, two lines.
//
// The card used to hold everything: a group category picker, a date-shift row,
// and every statement row expanded with its own date input, two icon buttons
// and a pair of dropdowns. On a phone that is unreadable, so the card is now
// only a *statement of state* — merchant, money, and whether a category is set
// — and all the controls moved into GroupSheet.
//
// Grouping is by the FULL normalized merchant, so "Le Gray" and "Le Mall" stay
// separate (the old key was the first word).

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { ChevronRight } from "lucide-react";

type Props = {
  label: string;
  rowCount: number;
  total: number;
  currency: string;
  /** Resolved category for the group — null while it still needs one. */
  category: { name: string; color: string; slug?: string | null } | null;
  /**
   * Resolved SUBcategory, when every row in the group agrees on one. Shown as a
   * child chip beside the parent so the card states the full assignment
   * (Food › Groceries) rather than only half of it.
   */
  subcategory: { name: string; color: string; slug?: string | null } | null;
  /** Rows inside the group that were given a different category of their own. */
  overrides: number;
  /**
   * A single row's date, or a range ("12 Aug – 14 Aug") when the group spans
   * more than one day. Previously the date was visible only after opening
   * GroupSheet — a card that otherwise reads as a receipt line had no "when"
   * on it at all.
   */
  dateLabel: string;
  onOpen: () => void;
};

export function ReviewGroupCard({
  label,
  rowCount,
  total,
  currency,
  category,
  subcategory,
  overrides,
  dateLabel,
  onOpen,
}: Props) {
  const tc = useThemeClasses();
  const symbol = getCurrencySymbol(currency);
  const Icon = category
    ? getCategoryIcon(category.name, category.slug ?? undefined)
    : null;
  const SubIcon = subcategory
    ? getCategoryIcon(subcategory.name, subcategory.slug ?? undefined)
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-2xl px-4 py-3.5 text-left flex flex-col gap-2 active:scale-[0.99] transition-transform",
        tc.sectionCard,
      )}
    >
      <div className="flex items-baseline gap-3">
        <p
          className={cn(
            "text-[15px] font-medium truncate flex-1 min-w-0",
            tc.headerText,
          )}
        >
          {label || "(no merchant)"}
        </p>
        <span className={cn("text-sm tabular-nums shrink-0", tc.text)}>
          {symbol}
          {total.toFixed(2)}
        </span>
      </div>

      <p className={cn("text-[11px] -mt-1", tc.textFaint)}>{dateLabel}</p>

      <div className="flex items-center gap-2">
        {category && Icon ? (
          <span className="inline-flex items-center gap-1 min-w-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 h-7 min-w-0"
              style={{ backgroundColor: `${category.color}20` }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: category.color, color: "#fff" }}
              >
                <Icon className="w-3 h-3" />
              </span>
              <span
                className="text-xs truncate"
                style={{ color: category.color }}
              >
                {category.name}
              </span>
            </span>

            {subcategory && SubIcon && (
              <>
                <ChevronRight
                  className={cn("w-3 h-3 shrink-0", tc.textFaint)}
                  aria-hidden
                />
                <span
                  className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 h-7 min-w-0"
                  style={{ backgroundColor: `${subcategory.color}20` }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: subcategory.color, color: "#fff" }}
                  >
                    <SubIcon className="w-3 h-3" />
                  </span>
                  <span
                    className="text-xs truncate"
                    style={{ color: subcategory.color }}
                  >
                    {subcategory.name}
                  </span>
                </span>
              </>
            )}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 h-7 text-xs font-medium",
              tc.buttonPrimary,
            )}
          >
            Choose category
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}

        <span className={cn("text-[11px] ml-auto shrink-0", tc.textFaint)}>
          {rowCount > 1 ? `${rowCount} rows` : "1 row"}
          {overrides > 0 && ` · ${overrides} custom`}
        </span>
      </div>
    </button>
  );
}
