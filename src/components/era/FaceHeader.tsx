"use client";

// src/components/era/FaceHeader.tsx
// Header showing the active face mark + gradient title.
// The title uses `era-gradient-text` which follows --era-hue,
// and the bottom glow line softly marks the boundary.

import { ERAMark } from "@/components/shared/ERAMark";
import { getFace } from "@/features/era/faceRegistry";
import { useEraStore } from "@/features/era/useEraStore";
import { useThemeClasses } from "@/hooks/useThemeClasses";

export function FaceHeader() {
  const tc = useThemeClasses();
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const face = getFace(activeFaceKey);

  return (
    <div
      className={[
        "relative flex items-center gap-3 border-b px-4 py-3",
        tc.border,
      ].join(" ")}
    >
      <ERAMark module={face.eraModuleKey} size={36} />

      <div className="flex min-w-0 flex-col">
        <span className="era-gradient-text text-base font-semibold tracking-tight">
          ERA · {face.label}
        </span>
        <span className={["truncate text-xs", tc.textFaint].join(" ")}>
          {face.description}
        </span>
      </div>

      {/* Bottom glow line that fades in from center, in the face's color */}
      <div className="era-header-glow-line pointer-events-none absolute bottom-0 left-0 right-0 h-px opacity-60" />
    </div>
  );
}
