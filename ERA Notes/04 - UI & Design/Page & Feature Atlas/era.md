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
  - `src/components/era/EraFaceNav.tsx` — face-switch pills (ERA/Budget/Schedule/Recipes/Brain), plus an **Artifacts** chip added 2026-08-27 (HUB-25) for the Activity log
  - `src/components/era/EraDots.tsx`
  - `src/components/era/HubScatterWidgets.tsx` — the 4 hub-mode scatter cards (Budget/Schedule/Chef/Brain), corner-positioned around the center orb — unchanged; a same-session redesign of this into a grid was reverted per owner feedback (see Master Book HUB-25 correction note)
  - `src/components/era/dashboards/ArtifactsView.tsx` — the Activity log's own view, opened via the Artifacts chip exactly like a face dashboard (`useEraStore`'s `EraView` gained a third `"activity"` value alongside `"hub"`/`"dashboard"`)
  - `src/features/era/logEraAction.ts` — the ERA Activity log's single write point (not a component)
  - `src/components/era/EraConversation.tsx` — the conversation (2026-10-03, HUB-86; replaced the inline `EraThreadTranscript`): bubbles in the person's own color, ERA replies beside a small orb in the answering face's hue, time breaks, a thinking indicator, the confirm card and question chips as the newest turn, a quiet "Report" offer under a missed reply, and a "New chat" divider once the chat has been silent 30 min. Layouts: `stage` (hub), `panel` (desktop dashboards), `sheet` (mobile chat sheet), `preview` (History)
  - `src/components/era/EraChatToolbar.tsx` — History (left) and New chat (right) icons under the nav in hub view; New chat shows a dot once the chat has gone quiet
  - `src/components/era/EraHistorySheet.tsx` — past chats (HUB-52): side panel on desktop, bottom sheet on phones; grouped Today / Yesterday / This week / Earlier; tap = read-only preview with Archive / Continue
  - `src/components/era/EraReportCard.tsx` — the Report card (HUB-85): Missed / Wrong, an optional "Expected…" note, Send; Undo on the toast
  - `src/components/era/EraProposalCard.tsx` — the confirm card, moved out of `EraShell.tsx` (still re-exported there)

## Hooks

- `src/features/era/useEraStore.ts` — `useEraStore` (Zustand); the old non-React `eraActions` export and `turns`/`pushTurn`/`clearTurns` were dead code (zero importers) and removed 2026-08-25
- `src/features/era/useEraTurn.ts` — **the one entry point from "a sentence" to "a reply"** (HUB-17): classify (`rootIntentRouter`) → resolve (`resolveIntent`) → persist (`era_messages`) → update store. `CommandBar` (typed) and `EraShell`'s voice wiring (spoken) both call this and nothing else.
- `src/features/era/useEraHousehold.ts` — `useEraHousehold` (current user + partner id)
- `src/features/era/useEraBudgetSubmit.ts` — money choke point for `draftTransaction`
- `src/features/era/useEraConversation.ts` — `era_conversations`/`era_messages` persistence + realtime; active-conversation choice, New chat, History (resume / archive)
- `src/features/era/useEraIssues.ts` — file / undo a Report (HUB-85)
- `src/features/era/thread.ts` — pure thread view-model: breaks, Report offer, quiet nudge, titles (HUB-86/52)

## Feature module

- `src/features/era/types.ts` — `FaceKey`, `Face`, `Intent`, `IntentRouter`
- `src/features/era/faceRegistry.ts` — `FACES`, `getFace`, `DEFAULT_FACE_KEY`
- `src/features/era/intentRouter.ts` — re-exports `rootIntentRouter` (`src/features/era/intents/index.ts`), a deterministic keyword router — shipped, not a stub; no Gemini-backed router exists
- `src/features/era/queryKeys.ts` — `eraKeys`

## API routes

- `src/app/api/era/conversations/route.ts`, `src/app/api/era/messages/route.ts` — shipped since Phase 0.5; append-only `era_messages`
- `src/app/api/era/actions/route.ts` — GET/POST for the Activity log (2026-08-27, HUB-25); GET returns the last 30 rows, "today" filtering happens client-side in `useEraActivity` against the caller's own timezone
- `src/app/api/era/conversations/route.ts?history=1` — History rows with deterministic titles; `src/app/api/era/conversations/[id]/route.ts` — PATCH resume / archive (HUB-52)
- `src/app/api/era/issues/route.ts` (POST) and `src/app/api/era/issues/[id]/route.ts` (DELETE = Undo) — file a Report as a system `era_messages` row (HUB-85); the PM bridge imports it as a Hub & ERA defect (R72)

## DB tables

- `era_conversations`, `era_messages` (`migrations/schema.sql`) — shipped since Phase 0.5
- `era_actions` (migration `2026-08-26_era-actions.sql`, **pending manual run**) — one row per ERA-initiated create/update, feeds the Activity card

## How to get here

- Direct URL: `/era` (auth-gated; redirects to `/login` for guests)
- Phase 0 does **not** add ERA to the bottom `MobileNav` — URL-only access while the design matures

## What it links to

- Each face's `route` (`/expense`, `/items`, `/recipe`, `/catalogue`) — Phase 1+ wires the placeholder body to deep-link into these
- Settings, Atlas, etc. via the global `ConditionalHeader` (visible above the shell)
- Activity log rows (2026-08-27, HUB-25, in `ArtifactsView.tsx`): `/items?openId=<id>&date=<yyyy-mm-dd>` (reminders — `WebDayPlanner`'s new `initialOpenItemId` prop opens the item's detail modal directly, independent of which day-section it's in), `/dashboard?openId=<id>` (confirmed transactions — `WebDashboard`'s `openId` search param), `/meal-plan` and `/era?face=brain` (no per-record deep link yet), `/expense` (transfers/debts — no detail view exists anywhere for these, tracked in the Master Book Pain Inventory)

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
- **Conversation layout (2026-10-03, owner-commissioned chat redesign, HUB-86).** With no open conversation the hub is exactly as before. While a conversation is open in hub view, the ERA DOT takes its existing module-mode position (same spring) and the thread fills the space between it and the command bar; New chat returns the DOT and greeting to the centre. Below 1280 px the corner cards step aside while chatting (`.era-shell[data-conversing]`). Revert path: `heroHub` → `isHub` in `EraShell.tsx`.
- **The centered animating ERA DOT + corner-scattered widget cards are original, unchanged Phase 0/0.5 design.** A same-session attempt to redesign this into a top-left icon + widget grid (HUB-25) was reverted at the owner's explicit request — the Activity log shipped instead as an additive "Artifacts" nav chip. Don't re-attempt the layout rework without asking first.
