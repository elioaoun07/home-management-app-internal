// src/components/recycle-bin/SearchBox.tsx
"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBox({ value, onChange, placeholder }: Props) {
  const tc = useThemeClasses();
  return (
    <div className="relative w-full">
      <Search
        className={cn(
          "absolute top-1/2 left-3 size-4 -translate-y-1/2",
          tc.textSecondary,
        )}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search..."}
        className={cn(
          "w-full rounded-lg border bg-transparent py-2 pr-3 pl-9 text-sm outline-none",
          tc.border,
          tc.focusBorder,
          tc.focusRing,
          "focus:ring-2",
        )}
      />
    </div>
  );
}
