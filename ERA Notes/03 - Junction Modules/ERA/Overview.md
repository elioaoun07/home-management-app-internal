---
created: 2026-05-03
type: feature-doc
module: era
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/era
  - scope/ai
related:
  - "[[Common Patterns]]"
  - "[[AI Assistant]]"
  - "[[Color Identity]]"
---

# ERA — Omnipotent Assistant Interface

> **Module:** `src/features/era/` | **Components:** `src/components/era/` | **Page:** `src/app/era/`
> **DB Tables:** none (Phase 0 reads from existing tables via downstream hooks; reserves no schema of its own)
> **Type:** Junction
> **Status:** Active — Phase 0 (skeleton)

## Overview

ERA is the face and identity of the application — a single, registry-driven assistant surface that shapeshifts into one of several **faces** (Budget, Schedule, Chef, Brain, … ) based on the user's intent. It coexists with the existing `/dashboard` and standalone routes; promotion to the root surface is a future decision.

Phase 0 ships the skeleton only:

- Route `/era` (auth-gated)
- Responsive shell (mobile column, desktop two-pane with rail)
- Face registry + types
- Active-face state (Zustand)
- Shapeshift slot (Framer Motion `AnimatePresence mode="wait"` + reserved `layoutId="era-face"`)
- Command bar (text input + mic placeholder + chips) → stub `IntentRouter`
- Auth gate + `useEraHousehold()` for downstream consumers
- Atlas entry, this doc

Phase 1 layers Claude-style fluid morph animations on the existing slot. Phase 2 swaps the stub `IntentRouter` for a Gemini-backed implementation (2.5 Flash-Lite for classification, 2.5 Flash for structured drafts) and wires real per-face content (drafted transactions / reminders / shopping list adds).

## Architecture

### Faces are data, not components

Every face is declared once in `src/features/era/faceRegistry.ts`. Each `Face` references an existing `ERAModuleKey` from `src/components/shared/ERAMark.tsx` — ERA does **not** invent a parallel icon system. Adding a face = adding a row.

### Shell is registry-driven

`EraShell` iterates `FACES` to produce both the desktop rail (`QuickFaceChips orientation="column"`) and the mobile chip row (`QuickFaceChips orientation="row"` rendered inside `CommandBar`). The active face drives `FaceHeader` and `FaceCanvas`.

### Single source of truth for state

`useEraStore` (Zustand) holds `activeFaceKey`, `lastIntent`, and `pendingTranscript`. Non-React modules can mutate via `eraActions.*`. There is no per-face component-local state for face selection.

### Intent contract is stable across phases

`IntentRouter.parse(text) → Intent` is the contract. Phase 0 stubs it with keyword matching; Phase 2 swaps the implementation, not the contract. Callers in `CommandBar` already pattern-match the discriminated `Intent` union exhaustively.

### Junction discipline

ERA is a Junction module. `src/features/era/` is allowed to import from any standalone feature (e.g. `src/features/transactions/` for draft creation in Phase 2). It must continue to honor Hard Rule #13 — every data hook routes through `useEraHousehold()` so partner data is automatically included.

## Database

ERA owns no tables in Phase 0. Phase 2+ may add:

- `era_transcripts` — optional log of command-bar inputs for personalization (not built yet)
- `era_face_preferences` — per-user pinned face order (currently lives in the registry constant)

When/if added, document here and update `migrations/schema.sql`.

## Key Files

- `src/features/era/types.ts` — `FaceKey`, `Face`, `Intent`, `IntentRouter`
- `src/features/era/faceRegistry.ts` — `FACES`, `getFace`, `DEFAULT_FACE_KEY`
- `src/features/era/intentRouter.ts` — `stubIntentRouter`
- `src/features/era/useEraStore.ts` — Zustand store + `eraActions`
- `src/features/era/useEraHousehold.ts` — auth + partner id
- `src/features/era/queryKeys.ts` — `eraKeys`
- `src/components/era/EraShell.tsx` — top-level layout
- `src/components/era/FaceHeader.tsx` — header above the canvas
- `src/components/era/FaceCanvas.tsx` — shapeshift slot (`layoutId="era-face"`)
- `src/components/era/QuickFaceChips.tsx` — registry-driven chips/rail
- `src/components/era/CommandBar.tsx` — text input + mic stub + submit
- `src/components/era/FacePlaceholder.tsx` — Phase 0 face body placeholder
- `src/app/era/page.tsx` — RSC entry, auth gate
- `src/components/layouts/ConditionalHeader.tsx` — `moduleFromPath()` extended for `/era`

## Hard Rules (ERA-specific)

In addition to the universal Hard Rules in `CLAUDE.md`:

1. **Faces are registry rows, not bespoke components.** Adding a face = appending to `FACES`. The shell must never branch on `face.key` for layout decisions.
2. **Never bypass `IntentRouter`.** All command-bar input flows through `IntentRouter.parse()` so Phase 2 can swap implementations cleanly.
3. **`CommandBar` background must use `tc.bgPage`**, never `neo-card` (Hard Rule #15: floating panels opaque).
4. **`layoutId="era-face"` is reserved.** Phase 1 animation work owns it; do not reuse the id for other elements.
5. **Every face that fetches data must route through `useEraHousehold()`** so partner data is included by default (Hard Rule #13).
6. **Mic button is a stub in Phase 0.** Real voice input wires to the Gemini audio path in a later phase. Keep the disabled state until then.

## Gotchas

- The shell uses `fixed inset-x-0 top-16 bottom-0` to claim the viewport between the global header (`h-16`) and the bottom edge. On mobile the main column reserves 72px (`MOBILE_NAV_HEIGHT`) for the fixed `MobileNav`.
- `ERAMark` does not have a `catalogue` key — Brain face uses `memory`.
- `useEraStore.pendingTranscript` persists across in-app navigation by design (Zustand survives unmount). Reset only on submit or via `useEraStore.getState().reset()`.
- `stubIntentRouter` is synchronous. Phase 2's Gemini implementation will be `async`. When that lands, update `CommandBar.submit()` to await and disable the form during inflight.

## Phase Roadmap

| Phase | Scope                                                                                 |
| ----- | ------------------------------------------------------------------------------------- |
| 0     | Skeleton: route, registry, store, shell, chips, command bar, stub router, atlas, doc. |
| 1     | Claude-style fluid morph between faces. `layoutId` choreography. Mood/state variants. |
| 2     | Gemini wiring: 2.5 Flash-Lite classifier, 2.5 Flash for drafts. Real per-face bodies. |
| 3     | Voice input (push-to-talk → Gemini audio). NFC/QR entry. Image drop for receipts.     |
| 4     | Doctor / Hub / Focus faces. Promotion decision (replace `/dashboard` or coexist).     |

## See Also

- [[Common Patterns]]
- [[AI Assistant]] — the Gemini wiring referenced for Phase 2
- [[Color Identity]] — face accent colors must respect person-absolute identity
- [[Sync and Offline]]
