"use client";

// src/components/era/QuickFaceChips.tsx
// Registry-driven row/column of face chips. Used by both the mobile command
// bar (horizontal scroll) and the desktop rail (vertical stack).

import { ERAMark } from "@/components/shared/ERAMark";
import { FACES } from "@/features/era/faceRegistry";
import { useEraStore } from "@/features/era/useEraStore";
import { useThemeClasses } from "@/hooks/useThemeClasses";

type Props = {
  /** Layout direction; default "row" for mobile chips, "column" for desktop rail. */
  orientation?: "row" | "column";
};

export function QuickFaceChips({ orientation = "row" }: Props) {
  const tc = useThemeClasses();
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const setActiveFace = useEraStore((s) => s.setActiveFace);

  const containerClasses =
    orientation === "row"
      ? "flex flex-row gap-2 overflow-x-auto no-scrollbar"
      : "flex flex-col gap-2";

  return (
    <div className={containerClasses} role="tablist" aria-label="ERA faces">
      {FACES.map((face) => {
        const isActive = face.key === activeFaceKey;
        return (
          <button
            key={face.key}
            type="button"
            role="tab"
            suppressHydrationWarning
            aria-selected={isActive}
            onClick={() => setActiveFace(face.key)}
            className={[
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
              isActive
                ? [tc.borderActive, tc.bgActive, tc.textHighlight].join(" ")
                : [tc.border, tc.textMuted, tc.bgHover].join(" "),
            ].join(" ")}
          >
            <ERAMark module={face.eraModuleKey} size={20} />
            <span>{face.label}</span>
          </button>
        );
      })}
    </div>
  );
}
