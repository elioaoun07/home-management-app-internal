// src/components/recycle-bin/FiltersPanel.tsx
"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { FilterField } from "@/lib/recycleBin/types";
import { cn } from "@/lib/utils";

interface Props {
  fields: FilterField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  deletedFrom: string;
  deletedTo: string;
  onDeletedRangeChange: (from: string, to: string) => void;
}

export function FiltersPanel({
  fields,
  values,
  onChange,
  deletedFrom,
  deletedTo,
  onDeletedRangeChange,
}: Props) {
  const tc = useThemeClasses();

  const setVal = (key: string, v: unknown) => {
    const next = { ...values };
    if (v == null || v === "") delete next[key];
    else next[key] = v;
    onChange(next);
  };

  const inputCls = cn(
    "w-full rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none",
    tc.border,
    tc.focusBorder,
    "focus:ring-1",
    tc.focusRing,
  );

  return (
    <div
      className={cn(
        "rounded-lg border p-3 grid grid-cols-1 gap-3 md:grid-cols-2",
        tc.border,
      )}
    >
      <div>
        <div className={cn("mb-1 text-xs", tc.textSecondary)}>Deleted from</div>
        <input
          type="date"
          value={deletedFrom}
          onChange={(e) => onDeletedRangeChange(e.target.value, deletedTo)}
          className={inputCls}
        />
      </div>
      <div>
        <div className={cn("mb-1 text-xs", tc.textSecondary)}>Deleted to</div>
        <input
          type="date"
          value={deletedTo}
          onChange={(e) => onDeletedRangeChange(deletedFrom, e.target.value)}
          className={inputCls}
        />
      </div>

      {fields.map((f) => {
        const v = values[f.key];
        if (f.kind === "text") {
          return (
            <div key={f.key}>
              <div className={cn("mb-1 text-xs", tc.textSecondary)}>
                {f.label}
              </div>
              <input
                type="text"
                value={(v as string) ?? ""}
                onChange={(e) => setVal(f.key, e.target.value)}
                className={inputCls}
              />
            </div>
          );
        }
        if (f.kind === "enum") {
          return (
            <div key={f.key}>
              <div className={cn("mb-1 text-xs", tc.textSecondary)}>
                {f.label}
              </div>
              <select
                value={(v as string) ?? ""}
                onChange={(e) => setVal(f.key, e.target.value)}
                className={inputCls}
              >
                <option value="">All</option>
                {f.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (f.kind === "boolean") {
          return (
            <label
              key={f.key}
              className="flex items-center gap-2 text-sm md:col-span-2"
            >
              <input
                type="checkbox"
                checked={Boolean(v)}
                onChange={(e) => setVal(f.key, e.target.checked || null)}
              />
              <span className={tc.textSecondary}>{f.label}</span>
            </label>
          );
        }
        if (f.kind === "dateRange") {
          const range = (v as { from?: string; to?: string }) ?? {};
          return (
            <div key={f.key} className="md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <div className={cn("mb-1 text-xs", tc.textSecondary)}>
                  {f.label} from
                </div>
                <input
                  type="date"
                  value={range.from ?? ""}
                  onChange={(e) =>
                    setVal(f.key, { ...range, from: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <div className={cn("mb-1 text-xs", tc.textSecondary)}>
                  {f.label} to
                </div>
                <input
                  type="date"
                  value={range.to ?? ""}
                  onChange={(e) =>
                    setVal(f.key, { ...range, to: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
            </div>
          );
        }
        if (f.kind === "numericRange") {
          const range = (v as { min?: number; max?: number }) ?? {};
          return (
            <div key={f.key} className="md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <div className={cn("mb-1 text-xs", tc.textSecondary)}>
                  {f.label} min
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={range.min ?? ""}
                  onChange={(e) =>
                    setVal(f.key, {
                      ...range,
                      min:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <div className={cn("mb-1 text-xs", tc.textSecondary)}>
                  {f.label} max
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={range.max ?? ""}
                  onChange={(e) =>
                    setVal(f.key, {
                      ...range,
                      max:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  className={inputCls}
                />
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
