"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { Search, X } from "lucide-react";

type Props = { value: string; onChange: (v: string) => void };

export default function AtlasSearch({ value, onChange }: Props) {
  const tc = useThemeClasses();
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border ${tc.border} ${tc.bgSurface} px-3 py-1.5 w-44 md:w-72`}
    >
      <Search className={`w-4 h-4 ${tc.textMuted}`} />
      <input
        type="text"
        inputMode="search"
        placeholder="Search atlas…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 bg-transparent outline-none text-sm ${tc.text}`}
      />
      {value ? (
        <button onClick={() => onChange("")} className={tc.textMuted}>
          <X className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}
