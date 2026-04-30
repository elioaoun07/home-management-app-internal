// src/components/recycle-bin/RecycleBinList.tsx
"use client";

import type { RecycleBinListItem } from "@/features/recycle-bin/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { RotateCcw, Trash2 } from "lucide-react";

interface Props {
  rows: RecycleBinListItem[];
  isLoading: boolean;
  onRestore: (row: RecycleBinListItem) => void;
  onPurge: (row: RecycleBinListItem) => void;
}

function formatDeletedAt(iso: string) {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export function RecycleBinList({ rows, isLoading, onRestore, onPurge }: Props) {
  const tc = useThemeClasses();

  if (isLoading) {
    return (
      <div className={cn("py-8 text-center text-sm", tc.textSecondary)}>
        Loading...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className={cn("py-8 text-center text-sm", tc.textSecondary)}>
        Nothing in this section. Items deleted in the last 30 days will appear
        here.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={`${row.moduleId}-${row.id}`}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2",
            tc.border,
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{row.title}</div>
            {row.subtitle && (
              <div
                className={cn("truncate text-xs", tc.textSecondary)}
                title={row.subtitle}
              >
                {row.subtitle}
              </div>
            )}
            <div
              className={cn(
                "mt-0.5 flex flex-wrap items-center gap-2 text-xs",
                "text-white/40",
              )}
            >
              <span>Deleted {formatDeletedAt(row.deletedAt)}</span>
              {row.meta && <span>· {row.meta}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRestore(row)}
            className={cn(
              "rounded-md border p-2 transition-colors",
              tc.border,
              tc.borderHover,
              tc.textActive,
            )}
            aria-label="Restore"
            title="Restore"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onPurge(row)}
            className={cn(
              "rounded-md border p-2 transition-colors",
              tc.border,
              tc.borderHover,
              "text-white/60 hover:text-white",
            )}
            aria-label="Delete permanently"
            title="Delete permanently"
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
