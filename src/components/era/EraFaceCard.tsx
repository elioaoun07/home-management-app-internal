"use client";

// src/components/era/EraFaceCard.tsx
// One of four face cards placed at the corners of the ERA hub.
// Clicking the card switches the active face (ERAMark transitions).
// Action buttons navigate to the face route or trigger ERA.

import { EraFaceWidget } from "@/components/era/face-widgets/EraFaceWidget";
import type { Face } from "@/features/era/types";
import { useEraStore } from "@/features/era/useEraStore";
import { useRouter } from "next/navigation";

type CardContent = {
  headline: string;
  body: string;
  meta: string;
  primary: string; // primary action label
  secondary: string; // secondary action label
};

const CARD_CONTENT: Record<string, CardContent> = {
  budget: {
    headline: "This month's spending",
    body: "",
    meta: "",
    primary: "View",
    secondary: "Brief",
  },
  schedule: {
    headline: "Today's schedule",
    body: "",
    meta: "",
    primary: "Add",
    secondary: "View all",
  },
  chef: {
    headline: "Recipe library",
    body: "",
    meta: "",
    primary: "Open",
    secondary: "Suggest",
  },
  brain: {
    headline: "Household memory",
    body: "",
    meta: "",
    primary: "Browse",
    secondary: "Add",
  },
};

// Stable hue per module — matches ERAMark's module palette
const MODULE_HUE: Record<string, number> = {
  financial: 175,
  recipe: 28,
  schedule: 256,
  health: 352,
  home: 205,
  trip: 155,
  fitness: 40,
  outfit: 325,
  chat: 190,
  memory: 220,
};

type Position = "tl" | "tr" | "bl" | "br";

const POSITION_CLASSES: Record<Position, string> = {
  tl: "top-6 left-5",
  tr: "top-6 right-5",
  bl: "bottom-[88px] left-5",
  br: "bottom-[88px] right-5",
};

type Props = {
  face: Face;
  isActive: boolean;
  position: Position;
};

export function EraFaceCard({ face, isActive, position }: Props) {
  const setActiveFace = useEraStore((s) => s.setActiveFace);
  const router = useRouter();
  const content = CARD_CONTENT[face.key] ?? CARD_CONTENT.budget;
  const hue = MODULE_HUE[face.eraModuleKey] ?? 175;
  const dotColor = `hsl(${hue}, 78%, 68%)`;
  const dotGlow = `0 0 7px hsl(${hue}, 78%, 58%)`;

  return (
    <div
      suppressHydrationWarning
      className={[
        // Only visible on desktop — mobile uses the chip row
        "era-face-card absolute hidden cursor-pointer rounded-2xl p-4 md:block",
        "w-[272px] lg:w-[290px]",
        POSITION_CLASSES[position],
        isActive ? "era-face-card-active" : "",
      ].join(" ")}
      onClick={() => setActiveFace(face.key)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && setActiveFace(face.key)}
    >
      {/* Module identifier */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: dotColor, boxShadow: dotGlow }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
          {face.label}
        </span>
      </div>

      {/* Headline */}
      <h3 className="mb-2.5 text-sm font-semibold leading-snug text-white/85">
        {content.headline}
      </h3>

      {/* Live widget — replaces static body + meta */}
      <div className="mb-3.5">
        <EraFaceWidget face={face} variant="card" />
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => face.route && router.push(face.route)}
          suppressHydrationWarning
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 transition-colors hover:border-white/35 hover:text-white/95"
        >
          {content.primary}
        </button>
        <button
          type="button"
          onClick={() => setActiveFace(face.key)}
          suppressHydrationWarning
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/55 transition-colors hover:border-white/28 hover:text-white/75"
        >
          {content.secondary}
        </button>
      </div>
    </div>
  );
}
