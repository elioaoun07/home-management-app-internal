// src/app/recycle-bin/page.tsx
"use client";

import { FiltersPanel } from "@/components/recycle-bin/FiltersPanel";
import { RecycleBinList } from "@/components/recycle-bin/RecycleBinList";
import { SearchBox } from "@/components/recycle-bin/SearchBox";
import { SectionNav } from "@/components/recycle-bin/SectionNav";
import {
  useEmptyBin,
  usePurge,
  useRecycleBinCounts,
  useRecycleBinList,
  useRestore,
  type RecycleBinListItem,
} from "@/features/recycle-bin/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { RECYCLE_BIN_MODULE_SUMMARIES } from "@/lib/recycleBin/registry";
import { cn } from "@/lib/utils";
import { ChevronLeft, Filter, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function RecycleBinPage() {
  const router = useRouter();
  const tc = useThemeClasses();

  const [activeId, setActiveId] = useState<string>(
    RECYCLE_BIN_MODULE_SUMMARIES[0]?.id ?? "transactions",
  );
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [deletedFrom, setDeletedFrom] = useState("");
  const [deletedTo, setDeletedTo] = useState("");
  const [ownOnly, setOwnOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const activeModule = useMemo(
    () =>
      RECYCLE_BIN_MODULE_SUMMARIES.find((m) => m.id === activeId) ??
      RECYCLE_BIN_MODULE_SUMMARIES[0],
    [activeId],
  );

  const counts = useRecycleBinCounts(ownOnly);
  const list = useRecycleBinList(activeId, {
    q: search || undefined,
    filters,
    deletedFrom: deletedFrom || undefined,
    deletedTo: deletedTo || undefined,
    ownOnly,
  });

  const restore = useRestore();
  const purge = usePurge();
  const empty = useEmptyBin();

  const items = (list.data?.rows ?? []) as RecycleBinListItem[];

  const onPurge = (row: RecycleBinListItem) => {
    if (
      !window.confirm(
        `Permanently delete this ${activeModule?.label ?? "item"}? This cannot be undone.`,
      )
    )
      return;
    purge.mutate({ module: activeId, id: row.id });
  };

  const onEmpty = () => {
    if (
      !window.confirm(
        `Permanently delete all ${activeModule?.label ?? "items"} in the bin? This cannot be undone.`,
      )
    )
      return;
    empty.mutate({ module: activeId, ownOnly });
  };

  return (
    <div className={cn("min-h-screen pb-12", tc.bgPage)}>
      <div
        className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-2 px-4 py-3 backdrop-blur"
        style={{ backgroundColor: "var(--theme-bg)" }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className={cn("rounded-md border p-2", tc.border, tc.borderHover)}
          aria-label="Back"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">Recycle Bin</h1>
        <div className="ml-auto flex items-center gap-2">
          <label
            className={cn("flex items-center gap-1 text-xs", tc.textSecondary)}
          >
            <input
              type="checkbox"
              checked={ownOnly}
              onChange={(e) => setOwnOnly(e.target.checked)}
            />
            Mine only
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className={cn(
              "rounded-md border p-2",
              tc.border,
              tc.borderHover,
              showFilters && tc.bgSurface,
            )}
            aria-label="Toggle filters"
            title="Filters"
          >
            <Filter className="size-4" />
          </button>
          <button
            type="button"
            onClick={onEmpty}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs",
              tc.border,
              tc.borderHover,
            )}
            title="Empty this section"
          >
            <Trash2 className="size-3.5" />
            Empty
          </button>
        </div>
      </div>

      <div className="px-4">
        <p className={cn("mb-3 text-xs", tc.textSecondary)}>
          Items deleted in the last 30 days. After 30 days they are removed
          permanently.
        </p>

        <SectionNav
          items={RECYCLE_BIN_MODULE_SUMMARIES.map((m) => ({
            id: m.id,
            label: m.label,
            count: counts.data?.counts?.[m.id],
          }))}
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id);
            setFilters({});
            setSearch("");
          }}
        />

        <div className="mt-3">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={`Search ${activeModule?.label.toLowerCase() ?? ""}`}
          />
        </div>

        {showFilters && activeModule && (
          <div className="mt-3">
            <FiltersPanel
              fields={activeModule.filterFields}
              values={filters}
              onChange={setFilters}
              deletedFrom={deletedFrom}
              deletedTo={deletedTo}
              onDeletedRangeChange={(f, t) => {
                setDeletedFrom(f);
                setDeletedTo(t);
              }}
            />
          </div>
        )}

        <div className="mt-4">
          <RecycleBinList
            rows={items}
            isLoading={list.isLoading}
            onRestore={(row) =>
              restore.mutate({ module: activeId, id: row.id })
            }
            onPurge={onPurge}
          />
        </div>
      </div>
    </div>
  );
}
