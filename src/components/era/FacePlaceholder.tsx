"use client";

// src/components/era/FacePlaceholder.tsx
// Phase 0 placeholder body for each face. Per-face real content lands in
// later phases (Budget summary, Schedule list, etc.). Until then this card
// gives the active face a presence on screen and confirms the registry-driven
// shapeshift slot is wired correctly.

import { ERAMark } from "@/components/shared/ERAMark";
import type { Face } from "@/features/era/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";

type Props = {
  face: Face;
};

export function FacePlaceholder({ face }: Props) {
  const tc = useThemeClasses();

  return (
    <div
      className={[
        "flex h-full w-full flex-col items-center justify-center gap-6 px-6 py-10 text-center",
        tc.text,
      ].join(" ")}
    >
      <ERAMark module={face.eraModuleKey} size={120} />

      <div className="flex flex-col gap-2">
        <h2 className={["text-2xl font-semibold", tc.textHighlight].join(" ")}>
          {face.label}
        </h2>
        <p
          className={["max-w-md text-sm leading-relaxed", tc.textMuted].join(
            " ",
          )}
        >
          {face.description}
        </p>
      </div>

      <p className={["text-xs", tc.textFaint].join(" ")}>
        Phase 1 will wire this face to live data.
      </p>
    </div>
  );
}
