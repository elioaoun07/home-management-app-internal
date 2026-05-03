// src/features/era/faceRegistry.ts
// Phase 0 face registry. The shell renders faces by iterating this array.
// Doctor / Hub / Focus are deferred — add them here when Phase 2 lands.

import type { Face, FaceKey } from "./types";

export const FACES: ReadonlyArray<Face> = [
  {
    key: "budget",
    label: "Budget",
    description:
      "Money in, money out. Log expenses, track balances, see where it went.",
    eraModuleKey: "financial",
    route: "/expense",
  },
  {
    key: "schedule",
    label: "Schedule",
    description:
      "Reminders, tasks, and events. Capture anything that has a when.",
    eraModuleKey: "schedule",
    route: "/items",
  },
  {
    key: "chef",
    label: "Chef",
    description: "Recipes, meal plans, and the shopping list that feeds them.",
    eraModuleKey: "recipe",
    route: "/recipe",
  },
  {
    key: "brain",
    label: "Brain",
    description:
      "Catalogue and inventory — the long-term memory of the household.",
    eraModuleKey: "memory",
    route: "/catalogue",
  },
];

export const DEFAULT_FACE_KEY: FaceKey = "budget";

const FACE_BY_KEY: Record<FaceKey, Face> = FACES.reduce(
  (acc, face) => {
    acc[face.key] = face;
    return acc;
  },
  {} as Record<FaceKey, Face>,
);

export function getFace(key: FaceKey): Face {
  return FACE_BY_KEY[key];
}
