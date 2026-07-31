// src/components/pm-live/board/BoardToolbar.tsx
// Search + a lane segmented control inline; everything else (quick severity
// chips, grouping, sorting) collapses into a Filters sheet so the sticky bar
// stays to two rows on a phone instead of stacking search + 4 chips + 2
// selects + a status line all at once.
"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Sheet } from "../Sheet";
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
  { key: "e", value: "S", label: "Small" },
  { key: "is", value: "done", label: "Done" },
];

const LANES: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "Now", label: "Now" },
  { value: "Next", label: "Next" },
  { value: "Later", label: "Later" },
];

function FiltersSheet({ onClose }: { onClose: () => void }) {
  const query = useViewState((s) => s.query);
  const toggleFilter = useViewState((s) => s.toggleFilter);
  const groupBy = useViewState((s) => s.groupBy);
  const setGroupBy = useViewState((s) => s.setGroupBy);
  const sortBy = useViewState((s) => s.sortBy);
  const setSortBy = useViewState((s) => s.setSortBy);
  const filters = parseQuery(query).filters;

  return (
    <Sheet title="Filters" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--pm-fg-3)" }}>
            Quick filters
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map(({ key, value, label }) => (
              <button
                key={`${key}:${value}`}
                onClick={() => toggleFilter(key, value)}
                data-active={String(filters[key as keyof typeof filters]?.toLowerCase() === value.toLowerCase())}
                className="pm-chip"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--pm-fg-3)" }}>
            Group by
          </p>
          {/* Native <select>: OS-rendered, opaque by construction (Hard Rule
              15), and gets the native wheel picker on a phone. */}
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="pm-input">
            {GROUP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {GROUP_LABEL[option]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--pm-fg-3)" }}>
            Sort by
          </p>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="pm-input">
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABEL[option]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Sheet>
  );
}

export function BoardToolbar({ shown, total }: { shown: number; total: number }) {
  const query = useViewState((s) => s.query);
  const setQuery = useViewState((s) => s.setQuery);
  const toggleFilter = useViewState((s) => s.toggleFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const parsed = parseQuery(query);
  const activeLane = parsed.filters.lane || "";
  const activeCount = Object.keys(parsed.filters).filter((k) => k !== "lane").length;

  return (
    <div
      className="sticky top-0 z-10 px-4 pt-3 pb-2.5 space-y-2.5 border-b"
      style={{ backgroundColor: "var(--pm-bg)", borderColor: "var(--pm-border)" }}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--pm-fg-3)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — or m:Budget s:blocker"
            className="pm-input pl-9 pr-8"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1" aria-label="Clear search">
              <X size={15} style={{ color: "var(--pm-fg-3)" }} />
            </button>
          )}
        </div>
        <button onClick={() => setFiltersOpen(true)} className="pm-btn relative shrink-0" aria-label="Filters">
          <SlidersHorizontal size={16} />
          {activeCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold leading-4 text-center"
              style={{ backgroundColor: "var(--pm-accent)", color: "var(--pm-accent-ink)" }}
            >
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex gap-1.5">
        {LANES.map((lane) => {
          const active = lane.value ? activeLane.toLowerCase() === lane.value.toLowerCase() : !activeLane;
          return (
            <button
              key={lane.label}
              onClick={() => {
                if (lane.value) toggleFilter("lane", lane.value);
                else if (activeLane) toggleFilter("lane", activeLane);
              }}
              data-active={String(active)}
              className="pm-chip flex-1 justify-center"
            >
              {lane.label}
            </button>
          );
        })}
      </div>

      <p className="text-[12px]" style={{ color: "var(--pm-fg-3)" }}>
        {shown === total ? `${total} open` : `${shown} of ${total}`} · tap a row for detail · swipe for Deliver
      </p>

      {filtersOpen && <FiltersSheet onClose={() => setFiltersOpen(false)} />}
    </div>
  );
}
