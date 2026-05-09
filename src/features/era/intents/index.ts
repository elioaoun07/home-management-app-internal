// Root intent router — delegates to per-face routers, falls back to global detection.
import type { FaceKey, Intent, IntentRouter } from "../types";
import { useEraStore } from "../useEraStore";
import { brainRouter } from "./brain";
import { budgetRouter } from "./budget";
import type { FaceIntentRouter } from "./schedule";
import { scheduleRouter } from "./schedule";
import { chefRouter } from "./chef";

export type { FaceIntentRouter };

const FACE_KEYS: FaceKey[] = ["budget", "schedule", "chef", "brain"];

export const FACE_ROUTERS: Record<FaceKey, FaceIntentRouter> = {
  budget: budgetRouter,
  schedule: scheduleRouter,
  chef: chefRouter,
  brain: brainRouter,
};

/** Explicit face-switch keywords — checked before per-face routing. */
const FACE_SWITCH_KEYWORDS: Array<{ face: FaceKey; words: string[] }> = [
  { face: "budget",   words: ["open budget", "go to budget", "switch to budget", "budget face"] },
  { face: "schedule", words: ["open schedule", "go to schedule", "switch to schedule", "schedule face"] },
  { face: "chef",     words: ["open chef", "go to chef", "switch to chef", "chef face", "open kitchen", "cooking mode"] },
  { face: "brain",    words: ["open brain", "go to brain", "switch to brain", "brain face", "memory mode", "open memory"] },
];

export function detectFaceSwitch(text: string): FaceKey | null {
  const lo = text.toLowerCase();
  for (const { face, words } of FACE_SWITCH_KEYWORDS) {
    if (words.some((w) => lo.includes(w))) return face;
  }
  return null;
}

export const rootIntentRouter: IntentRouter = {
  parse(text: string): Intent {
    const trimmed = text.trim();
    if (!trimmed) return { kind: "unknown", rawText: text };

    // 1) Explicit face-switch commands always win
    const switchFace = detectFaceSwitch(trimmed);
    if (switchFace) return { kind: "switchFace", face: switchFace, rawText: text };

    // 2) Active face router gets first crack
    const active = useEraStore.getState().activeFaceKey;
    const local = FACE_ROUTERS[active].parse(trimmed, { activeFaceKey: active });
    if (local) return local;

    // 3) Try every other face's router as cross-face fallback
    for (const k of FACE_KEYS) {
      if (k === active) continue;
      const hit = FACE_ROUTERS[k].parse(trimmed, { activeFaceKey: active });
      if (hit) return hit;
    }

    return { kind: "unknown", rawText: text };
  },
};
