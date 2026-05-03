// src/features/era/types.ts
// ERA Phase 0 — type contracts for the omnipotent assistant shell.
// These are deliberately small and stable; Phase 1+ adds animation metadata,
// Phase 2 swaps the stub IntentRouter for a Gemini-backed implementation.

import type { ERAModuleKey } from "@/components/shared/ERAMark";

/**
 * The set of ERA "faces" available in Phase 0. Doctor / Hub / Focus are
 * intentionally deferred. Adding a face later means: add the key here, add a
 * row to FACES in faceRegistry.ts, and the registry-driven UI picks it up
 * automatically.
 */
export type FaceKey = "budget" | "schedule" | "chef" | "brain";

/**
 * Declarative description of a face. The shell is purely registry-driven:
 * iterating over FACES yields the chips, the rail, and the placeholder body
 * for each face. `eraModuleKey` connects to the existing ERAMark identity
 * system in src/components/shared/ERAMark.tsx — do not invent a parallel
 * icon system.
 */
export interface Face {
  /** Stable identifier; never user-facing. */
  key: FaceKey;
  /** User-facing short label, e.g. "Budget". */
  label: string;
  /** One-line description shown on the placeholder body and tooltips. */
  description: string;
  /** Maps to the existing ERAMark module identity (icon + hue/sat/lum). */
  eraModuleKey: ERAModuleKey;
  /** Optional deep-link route this face represents in Phase 2+. */
  route?: string;
}

/**
 * Discriminated union of intents the IntentRouter can produce. Phase 0
 * implements only `switchFace` and `unknown`; the others are reserved so
 * downstream consumers can pattern-match exhaustively today and gain real
 * behavior in later phases without a type churn.
 */
export type Intent =
  | { kind: "switchFace"; face: FaceKey; rawText: string }
  | {
      kind: "draftTransaction";
      face: "budget";
      amount?: number;
      description?: string;
      rawText: string;
    }
  | {
      kind: "draftReminder";
      face: "schedule";
      title?: string;
      rawText: string;
    }
  | {
      kind: "showAnalytics";
      face: "budget";
      rawText: string;
    }
  | { kind: "unknown"; rawText: string };

/**
 * IntentRouter contract. The Phase 0 stub matches a handful of keywords;
 * Phase 2 replaces the implementation (not the contract) with Gemini
 * structured output. Always synchronous in Phase 0 to keep the command bar
 * latency-free; the Phase 2 implementation will return Promise<Intent>, so
 * callers should be ready to await.
 */
export interface IntentRouter {
  parse(text: string): Intent;
}
