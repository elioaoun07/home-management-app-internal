"use client";

// A compact category summary for a single-row card outside the merchant-group
// list (Transfers tab, Cash section) — the same chip ReviewGroupCard shows,
// without the surrounding group card. Tapping it opens the row's editor
// (GroupSheet, opened as a synthetic one-row group).
//
// `interactive: false` drops the `<button>` wrapper down to a `<div>` — for
// the read-only summary state, where this chip sits inside a card-level
// button (edit affordance for the whole row) and a nested `<button>` would be
// invalid HTML.

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { ChevronRight } from "lucide-react";

type CategoryRef = { name: string; color: string; slug?: string | null } | null;

export function CategoryChip({
  category,
  subcategory,
  onClick,
  interactive = true,
}: {
  category: CategoryRef;
  subcategory: CategoryRef;
  onClick?: () => void;
  interactive?: boolean;
}) {
  const tc = useThemeClasses();
  const Icon = category
    ? getCategoryIcon(category.name, category.slug ?? undefined)
    : null;
  const SubIcon = subcategory
    ? getCategoryIcon(subcategory.name, subcategory.slug ?? undefined)
    : null;

  const content =
    category && Icon ? (
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
          <span className="text-xs truncate" style={{ color: category.color }}>
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
              <span className="text-xs truncate" style={{ color: subcategory.color }}>
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
    );

  if (!interactive) {
    return <div className="flex items-center gap-2 self-start">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 self-start"
    >
      {content}
    </button>
  );
}
