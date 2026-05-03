"use client";

// src/components/era/FaceHeader.tsx
// Top-of-canvas header that shows the current face's mark + label. On mobile
// the chips live in the CommandBar; on desktop the rail is rendered by
// EraShell, so this header stays minimal everywhere.

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
      className={["flex items-center gap-3 px-4 py-3 border-b", tc.border].join(
        " ",
      )}
    >
      <ERAMark module={face.eraModuleKey} size={36} />
      <div className="flex flex-col">
        <span
          className={["text-base font-semibold", tc.textHighlight].join(" ")}
        >
          ERA · {face.label}
        </span>
        <span className={["text-xs", tc.textMuted].join(" ")}>
          {face.description}
        </span>
      </div>
    </div>
  );
}
