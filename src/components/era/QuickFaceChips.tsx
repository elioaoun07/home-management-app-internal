"use client";

// src/components/era/QuickFaceChips.tsx
// Registry-driven face selector chips.
// Active chip glows in the face's color via era-face-chip-active,
// which reads --era-hue/sat/lum from the parent era-shell.

import { ERAMark } from "@/components/shared/ERAMark";
import { FACES } from "@/features/era/faceRegistry";
import { useEraStore } from "@/features/era/useEraStore";
import { useThemeClasses } from "@/hooks/useThemeClasses";

type Props = {
  orientation?: "row" | "column";
};

export function QuickFaceChips({ orientation = "row" }: Props) {
  const tc = useThemeClasses();
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const setActiveFace = useEraStore((s) => s.setActiveFace);

  const containerClasses =
    orientation === "row"
      ? "flex flex-row gap-2 overflow-x-auto no-scrollbar"
      : "flex flex-col gap-1.5";

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
              "era-face-chip flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm",
              isActive
                ? "era-face-chip-active text-white/90"
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
