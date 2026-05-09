"use client";

// src/components/era/FacePlaceholder.tsx
// Empty-state body for each face. Shows the ERAMark centered inside
// two orbital rings (same breathing rhythm as the mark), a face-specific
// headline using the gradient text, and decorative dots below.

import { ERAMark } from "@/components/shared/ERAMark";
import { EraFaceWidget } from "@/components/era/face-widgets/EraFaceWidget";
import type { Face } from "@/features/era/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";

const FACE_INTROS: Record<string, { headline: string; sub: string }> = {
  budget: {
    headline: "Financial intelligence",
    sub: "Tell me what you spent. I'll handle the rest.",
  },
  schedule: {
    headline: "Time, organized",
    sub: "What needs to happen? I'll make sure it does.",
  },
  chef: {
    headline: "Kitchen command",
    sub: "From ingredients to meals — speak, and it's planned.",
  },
  brain: {
    headline: "Household memory",
    sub: "Everything you own, catalogued and ready to surface.",
  },
};

type Props = {
  face: Face;
};

export function FacePlaceholder({ face }: Props) {
  const tc = useThemeClasses();
  const intro = FACE_INTROS[face.key] ?? {
    headline: face.label,
    sub: face.description,
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-6 py-10 text-center">
      {/* ERAMark inside orbital rings */}
      <div className="relative" style={{ width: 180, height: 180 }}>
        {/* Outer orbit */}
        <div className="era-orbit absolute inset-0 rounded-full" />
        {/* Inner orbit */}
        <div
          className="era-orbit era-orbit-inner absolute rounded-full"
          style={{ inset: 16 }}
        />
        {/* Mark — centered inside the 180px container */}
        <div
          className="absolute flex items-center justify-center"
          style={{ inset: 30 }}
        >
          <ERAMark module={face.eraModuleKey} size={120} />
        </div>
      </div>

      {/* Live stat widget — mobile active-face view */}
      <div className="mb-1">
        <EraFaceWidget face={face} variant="placeholder" />
      </div>

      {/* Text */}
      <div className="flex flex-col gap-3">
        <h2 className="era-gradient-text text-2xl font-semibold tracking-tight">
          {intro.headline}
        </h2>
        <p className={["max-w-xs text-sm leading-relaxed", tc.textMuted].join(" ")}>
          {intro.sub}
        </p>
      </div>

      {/* Decorative dots — same DOTS effect as ERA logos */}
      <div className="flex items-center gap-2.5">
        <div className="era-dot-sm rounded-full" style={{ width: 5, height: 5 }} />
        <div className="era-dot-sm rounded-full" style={{ width: 3.5, height: 3.5 }} />
        <div className="era-dot-sm rounded-full" style={{ width: 5, height: 5 }} />
      </div>
    </div>
  );
}
