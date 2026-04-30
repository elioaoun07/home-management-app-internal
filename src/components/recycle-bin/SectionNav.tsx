// src/components/recycle-bin/SectionNav.tsx
"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";

interface SectionNavItem {
  id: string;
  label: string;
  count?: number;
}

interface Props {
  items: SectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function SectionNav({ items, activeId, onSelect }: Props) {
  const tc = useThemeClasses();

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="flex gap-2 md:flex-wrap">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? cn(tc.borderActive, tc.bgSurface, tc.textActive)
                  : cn(tc.border, tc.textSecondary, tc.borderHover),
              )}
            >
              <span>{item.label}</span>
              {typeof item.count === "number" && item.count > 0 && (
                <span
                  className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-xs",
                    active ? "bg-white/10" : "bg-white/5",
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
