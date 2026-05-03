---
slug: era
title: ERA — Omnipotent Assistant
category: junction-page
route: /era
type: page
parent: null
children: []
status: active
tags:
  - era
  - ai
  - dashboard
  - junction
  - phase-0
---

# ERA — Omnipotent Assistant

> The face of the app. A registry-driven shell that shapeshifts between faces (Budget, Schedule, Chef, Brain) based on user intent. Phase 0 ships the skeleton.

## Files

- **Page**: `src/app/era/page.tsx`
- **Main component**: `src/components/era/EraShell.tsx`
- **Sub-components**:
  - `src/components/era/FaceHeader.tsx`
  - `src/components/era/FaceCanvas.tsx`
  - `src/components/era/QuickFaceChips.tsx`
  - `src/components/era/CommandBar.tsx`
  - `src/components/era/FacePlaceholder.tsx`

## Hooks

- `src/features/era/useEraStore.ts` — `useEraStore` (Zustand) + `eraActions` (non-React)
- `src/features/era/useEraHousehold.ts` — `useEraHousehold` (current user + partner id)

## Feature module

- `src/features/era/types.ts` — `FaceKey`, `Face`, `Intent`, `IntentRouter`
- `src/features/era/faceRegistry.ts` — `FACES`, `getFace`, `DEFAULT_FACE_KEY`
- `src/features/era/intentRouter.ts` — `stubIntentRouter` (Phase 0); replaced by Gemini in Phase 2
- `src/features/era/queryKeys.ts` — `eraKeys`

## API routes

- None in Phase 0. Phase 2 will add `/api/era/intent` for the Gemini-backed router.

## DB tables

- None in Phase 0. Phase 2+ may add `era_transcripts` and/or `era_face_preferences`.

## How to get here

- Direct URL: `/era` (auth-gated; redirects to `/login` for guests)
- Phase 0 does **not** add ERA to the bottom `MobileNav` — URL-only access while the design matures

## What it links to

- Each face's `route` (`/expense`, `/items`, `/recipe`, `/catalogue`) — Phase 1+ wires the placeholder body to deep-link into these
- Settings, Atlas, etc. via the global `ConditionalHeader` (visible above the shell)

## Related vault doc

- `ERA Notes/03 - Junction Modules/ERA/Overview.md`

## Screenshots

- _(pending Phase 1 design)_

## Notes

- The shell uses `fixed inset-x-0 top-16 bottom-0` to claim the viewport under the global `h-16` header. Mobile reserves 72px (`MOBILE_NAV_HEIGHT`) at the bottom for the `MobileNav` via `pb-[72px] md:pb-0`.
- Brand mark on the global header: `moduleFromPath()` in `src/components/layouts/ConditionalHeader.tsx` maps `/era` → `memory`. The shell itself shows the **active face's** mark via `FaceHeader`.
- `layoutId="era-face"` on `FaceCanvas` is reserved for Phase 1 morph animation.
- All command-bar input must flow through `IntentRouter` — never bypass.
- `CommandBar` background uses `tc.bgPage` (Hard Rule #15: floating overlays must be opaque, never `neo-card`).
- ERA is **not** in `STANDALONE_APPS`, so the global `ConditionalHeader` and `MobileNav` remain visible.
