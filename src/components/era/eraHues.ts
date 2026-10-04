// src/components/era/eraHues.ts
// Module hues for the ERA shell — "chat" is the hub default (190°). Shared by
// EraShell (glow, borders, accent) and the conversation (each ERA reply's
// avatar takes the hue of the face that answered it).

import { getFace } from "@/features/era/faceRegistry";
import type { FaceKey } from "@/features/era/types";

export const MODULE_COLORS: Record<string, { hue: number; sat: number; lum: number }> = {
  chat:      { hue: 190, sat: 85, lum: 62 },
  financial: { hue: 175, sat: 72, lum: 55 },
  recipe:    { hue:  28, sat: 85, lum: 58 },
  schedule:  { hue: 256, sat: 78, lum: 68 },
  memory:    { hue: 220, sat: 65, lum: 68 },
  health:    { hue: 352, sat: 82, lum: 62 },
  home:      { hue: 205, sat: 75, lum: 62 },
  trip:      { hue: 155, sat: 72, lum: 58 },
  fitness:   { hue:  40, sat: 92, lum: 62 },
  outfit:    { hue: 325, sat: 78, lum: 68 },
};

const FACE_KEYS = new Set<string>(["budget", "schedule", "chef", "brain"]);

/** Hue of the face that produced a message (`intent_face`); the hub hue otherwise. */
export function faceHue(face: string | null | undefined): number {
  if (!face || !FACE_KEYS.has(face)) return MODULE_COLORS.chat.hue;
  return (MODULE_COLORS[getFace(face as FaceKey).eraModuleKey] ?? MODULE_COLORS.chat).hue;
}
