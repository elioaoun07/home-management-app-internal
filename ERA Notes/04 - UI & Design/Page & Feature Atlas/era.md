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
- **Sub-components** *(corrected 2026-08-25, HUB-17 — the six listed below were confirmed to have zero importers and deleted: `FaceHeader.tsx`, `FaceCanvas.tsx`, `QuickFaceChips.tsx`, `FacePlaceholder.tsx`, `EraFaceCard.tsx`, `EraHubView.tsx`, `EraTranscript.tsx`. This doc had described Phase 0's plan, not shipped reality — see the Master Book Shipped Log for what actually exists)*:
  - `src/components/era/CommandBar.tsx`
  - `src/components/era/EraFaceNav.tsx`
  - `src/components/era/EraDots.tsx`
  - `src/components/era/HubScatterWidgets.tsx`
  - `EraThreadTranscript` — defined inline in `EraShell.tsx`, the scrollable multi-turn conversation view above the command bar

## Hooks

- `src/features/era/useEraStore.ts` — `useEraStore` (Zustand); the old non-React `eraActions` export and `turns`/`pushTurn`/`clearTurns` were dead code (zero importers) and removed 2026-08-25
- `src/features/era/useEraTurn.ts` — **the one entry point from "a sentence" to "a reply"** (HUB-17): classify (`rootIntentRouter`) → resolve (`resolveIntent`) → persist (`era_messages`) → update store. `CommandBar` (typed) and `EraShell`'s voice wiring (spoken) both call this and nothing else.
- `src/features/era/useEraHousehold.ts` — `useEraHousehold` (current user + partner id)
- `src/features/era/useEraBudgetSubmit.ts` — money choke point for `draftTransaction`
- `src/features/era/useEraConversation.ts` — `era_conversations`/`era_messages` persistence + realtime

## Feature module

- `src/features/era/types.ts` — `FaceKey`, `Face`, `Intent`, `IntentRouter`
- `src/features/era/faceRegistry.ts` — `FACES`, `getFace`, `DEFAULT_FACE_KEY`
- `src/features/era/intentRouter.ts` — re-exports `rootIntentRouter` (`src/features/era/intents/index.ts`), a deterministic keyword router — shipped, not a stub; no Gemini-backed router exists
- `src/features/era/queryKeys.ts` — `eraKeys`

## API routes

- `src/app/api/era/conversations/route.ts`, `src/app/api/era/messages/route.ts` — shipped since Phase 0.5; append-only `era_messages`

## DB tables

- `era_conversations`, `era_messages` (`migrations/schema.sql`) — shipped since Phase 0.5

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
- Brand mark on the global header: `moduleFromPath()` in `src/components/layouts/ConditionalHeader.tsx` maps `/era` → `memory`. The shell itself shows the **active face's** mark inline in `EraShell.tsx` via `ERAMark` — `FaceHeader` (deleted 2026-08-25) never had an importer.
- All command-bar input must flow through `IntentRouter` — never bypass.
- `CommandBar` background uses `tc.bgPage` (Hard Rule #15: floating overlays must be opaque, never `neo-card`).
- ERA is **not** in `STANDALONE_APPS`, so the global `ConditionalHeader` and `MobileNav` remain visible.
