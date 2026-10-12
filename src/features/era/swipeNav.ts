// src/features/era/swipeNav.ts
// Swipe order for the ERA shell on a phone: ERA hub → faces → Artifacts.
// AI Usage is desktop-only, so it is never a swipe stop.

import { FACES } from "./faceRegistry";
import type { FaceKey } from "./types";
import type { EraView } from "./useEraStore";

export type EraStop = { view: EraView; face?: FaceKey };

export const ERA_SWIPE_STOPS: ReadonlyArray<EraStop> = [
  { view: "hub" },
  ...FACES.map((face) => ({ view: "dashboard" as const, face: face.key })),
  { view: "activity" },
];

/** The stop one swipe away, or null at either end. `step` is +1 (next) or -1 (previous). */
export function adjacentEraStop(
  view: EraView,
  face: FaceKey,
  step: 1 | -1,
): EraStop | null {
  const at = ERA_SWIPE_STOPS.findIndex(
    (stop) => stop.view === view && (view !== "dashboard" || stop.face === face),
  );
  if (at < 0) return null;
  return ERA_SWIPE_STOPS[at + step] ?? null;
}
