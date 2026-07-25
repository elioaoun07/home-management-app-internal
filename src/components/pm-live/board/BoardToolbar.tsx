// src/components/pm-live/board/BoardToolbar.tsx
// Search + quick filters + grouping/sorting.
//
// The group/sort controls are native <select>s on purpose: their popups are
// rendered by the OS, so they're opaque by construction (Hard Rule 15) and get
// the native wheel picker on a phone — better than any custom panel here.
"use client";

import { Search, X } from "lucide-react";
import { parseQuery } from "@/features/pm-live/query";
import { GROUP_OPTIONS, SORT_OPTIONS, useViewState, type GroupBy, type SortBy } from "@/features/pm-live/viewState";

const GROUP_LABEL: Record<GroupBy, string> = {
  campaign: "Campaign",
  lane: "Lane",
  severity: "Severity",
  effort: "Effort",
  none: "No grouping",
};

const SORT_LABEL: Record<SortBy, string> = {
  lane: "Lane order",
  severity: "Severity",
  effort: "Effort",
  campaign: "Campaign",
  file: "File order",
};

const QUICK_FILTERS: { key: string; value: string; label: string }[] = [
  { key: "s", value: "blocker", label: "Blockers" },
  { key: "lane", value: "Now", label: "Now" },
  { key: "e", value: "S", label: "Small" },
  { key: "is", value: "done", label: "Done" },
];

export function BoardToolbar({ shown, total }: { shown: number; total: number }) {
  const query = useViewState((s) => s.query);
  const setQuery = useViewState((s) => s.setQuery);
  const toggleFilter = useViewState((s) => s.toggleFilter);
  const groupBy = useViewState((s) => s.groupBy);
  const setGroupBy = useViewState((s) => s.setGroupBy);
  const sortBy = useViewState((s) => s.sortBy);
  const setSortBy = useViewState((s) => s.setSortBy);

  const filters = parseQuery(query).filters;

  return (
    <div
      className="sticky top-0 z-10 px-3 lg:px-5 pt-3 pb-2.5 space-y-2.5 border-b"
      style={{ backgroundColor: "var(--pm-bg)", borderColor: "var(--pm-border)" }}
    >
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--pm-fg-3)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — or m:Budget s:blocker lane:Now"
          className="pm-input pl-8 pr-8"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1" aria-label="Clear search">
            <X size={14} style={{ color: "var(--pm-fg-3)" }} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 pm-scroll-x pb-0.5">
        {QUICK_FILTERS.map(({ key, value, label }) => (
          <button
            key={`${key}:${value}`}
            onClick={() => toggleFilter(key, value)}
            data-active={String(filters[key as keyof typeof filters]?.toLowerCase() === value.toLowerCase())}
            className="pm-chip shrink-0"
          >
            {label}
          </button>
        ))}

        <span className="ml-auto shrink-0 flex items-center gap-2">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            aria-label="Group by"
            className="pm-chip appearance-none pr-2"
          >
            {GROUP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {GROUP_LABEL[option]}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            aria-label="Sort by"
            className="pm-chip appearance-none pr-2"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABEL[option]}
              </option>
            ))}
          </select>
        </span>
      </div>

      <p className="text-[11px]" style={{ color: "var(--pm-fg-3)" }}>
        {shown === total ? `${total} open` : `${shown} of ${total}`} · tap a row for detail
      </p>
    </div>
  );
}
