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
- **Main component**: `src/components/era/EraShell.tsx` — measured composer-height offsets and `visualViewport` keyboard sizing (HUB-112).
- **Sub-components** *(corrected 2026-08-25, HUB-17 — the six listed below were confirmed to have zero importers and deleted: `FaceHeader.tsx`, `FaceCanvas.tsx`, `QuickFaceChips.tsx`, `FacePlaceholder.tsx`, `EraFaceCard.tsx`, `EraHubView.tsx`, `EraTranscript.tsx`. This doc had described Phase 0's plan, not shipped reality — see the Master Book Shipped Log for what actually exists)*:
  - `src/components/era/CommandBar.tsx`
  - `src/components/era/EraComposer.module.css` — responsive unified composer and neutral sentence-input styles (HUB-112). ERA atmosphere adds the reused miniature mark, module-colored halo/chips/Send, tinted completion and brief step transitions; Frost contrast and reduced-motion preferences are handled locally.
  - `src/components/era/EraCaptureHelper.tsx` — native chatbot completion (HUB-112, reworked by HUB-113): the action pill and its one question share a line; below, what ERA understood reads as prose (“Call mom · Tomorrow at 5 PM · At time”) whose dotted parts open their choices; up to four fully named choices wrap in two columns. More uses an opaque searchable sheet; the ellipsis sheet holds action correction plus Priority and Location. The active action uses Schedule violet, Budget teal or Shopping/Kitchen orange and shows a check once everything required is understood. Shopping list previews stay in the sheet. Shopping Enter adds an item line (“What else?” offers remembered items) and Send submits. The sentence input has neutral text and no inner border/ring/glow; the toolbar holds mic, audio, Ask AI and Send.
  - Composer mirror (HUB-113, `CommandBar.tsx` + `.mirror`): understood phrases get a soft tint behind the neutral text; one faint completion follows the caret (Tab, → or a right swipe accepts). Send rings once when ready; Enter before then shakes the question.
  - `src/components/era/EraFaceNav.tsx` — face-switch pills (ERA/Budget/Schedule/Recipes/Brain), plus an **Artifacts** chip added 2026-08-27 (HUB-25) for the Activity log. On a phone, swiping left/right on the content area steps through the same pills (HUB-114, `src/features/era/swipeNav.ts`); the active pill scrolls into view.
  - While the composer detects a capture, the DOT, glow and toolbar mark take that module's look (`useEraStore.captureModuleKey`, set by `CommandBar.tsx`): reminders and events show the Schedule clock (HUB-114).
  - `src/components/era/EraDots.tsx`
  - `src/components/era/EraMotion.module.css` — HUB-115 top-layer motion: slow aurora, fine orbit trails, wake ripple, traveling face highlight and staggered card entrances. Ambient loops quiet outside the idle hub. Composer focus/starter feedback lives in `EraComposer.module.css`; mobile chat opens with a damped spring. Reduced-motion support covers all new effects; controls and data flows retain their existing behavior.
  - `src/components/era/HubScatterWidgets.tsx` — the 4 hub-mode scatter cards (Budget/Schedule/Chef/Brain), corner-positioned around the center orb — unchanged; a same-session redesign of this into a grid was reverted per owner feedback (see Master Book HUB-25 correction note)
  - `src/components/era/dashboards/ArtifactsView.tsx` — the Activity log's own view (day navigation, module groups tinted per module, per-row Undo/Redo), opened via the Artifacts chip exactly like a face dashboard (`useEraStore`'s `EraView` gained a third `"activity"` value alongside `"hub"`/`"dashboard"`)
  - `src/components/era/dashboards/AiUsageView.tsx` — **AI Usage** chip after Artifacts (2026-10-11, HUB-110), desktop only (`md:flex`; `EraShell` sends a phone back to the hub). `EraView` value `"usage"`. Month ‹ ›, three stat cards (est. cost, tokens, AI calls) and a per-day table: chats that reached the model (click → `useResumeEraConversation` + hub), calls (auto count), input, output, est. cost, Total row. Data: `GET /api/era/ai-usage?from&to` → `src/features/era/aiUsage.ts` (local-day buckets + list-price estimate)
  - `src/features/era/recordArtifacts.ts` — the Artifacts tab's single write point (not a component); entities, labels and deep links live in `src/lib/era/artifacts.ts` (2026-10-04)
  - `src/components/era/EraConversation.tsx` — the conversation (2026-10-03, HUB-86; replaced the inline `EraThreadTranscript`): bubbles in the person's own color, ERA replies beside a small orb in the answering face's hue, time breaks, a thinking indicator, the confirm card and question chips as the newest turn, a quiet "Report" offer under a missed reply, and a "New chat" divider once the chat has been silent 30 min. Layouts: `stage` (hub), `panel` (desktop dashboards), `sheet` (mobile chat sheet), `preview` (History). Keeps following the latest turn when the composer/viewport resizes (HUB-112).
  - `src/components/era/EraChatDrawer.tsx` — mobile chat sheet; viewport-aware height/bottom keep its embedded composer above the keyboard (HUB-112).
  - `src/components/era/EraChatToolbar.tsx` — History (left) and New chat (right) icons under the nav in hub view; New chat shows a dot once the chat has gone quiet
  - `src/components/era/EraHistorySheet.tsx` — past chats (HUB-52): side panel on desktop, bottom sheet on phones; grouped Today / Yesterday / This week / Earlier; tap = read-only preview with Archive / Continue
  - `src/components/era/EraReportCard.tsx` — the Report card (HUB-85): Missed / Wrong, an optional "Expected…" note, Send; Undo on the toast
  - `src/components/era/EraProposalCard.tsx` — the confirm card, moved out of `EraShell.tsx` (still re-exported there)
  - `src/components/era/EraRunCards.tsx` — saved execution receipts and Confirm / Resume / Recover / Skip / Stop controls in the conversation (HUB-104, opt-in after the owner-run migration). Interrupted writes require inspection; only reads offer retry. Existing History → Continue opens the original conversation and its unfinished plans.

## Hooks

- `src/features/era/useEraCapture.ts` — local parser suggestions, accepted choices and existing account/category/list/group queries; `captureProgress.ts` derives the next gap and completes sentence fragments; structured native Send through `useEraTurn`, without model inference.
- `src/features/era/useEraCaptureMemory.ts` — typing memory from `GET /api/era/capture-memory` (HUB-113): own spends/titles and household shopping rows, fetched on composer focus; `captureAssist.ts` turns state + memory into the question, choices, completion, summary and highlights.

- `src/features/era/useEraStore.ts` — `useEraStore` (Zustand); the old non-React `eraActions` export and `turns`/`pushTurn`/`clearTurns` were dead code (zero importers) and removed 2026-08-25
- `src/features/era/useEraTurn.ts` — **the one entry point from "a sentence" to "a reply"** (HUB-17): classify (`rootIntentRouter`) → resolve (`resolveIntent`) → persist (`era_messages`) → update store. `CommandBar` (typed) and `EraShell`'s voice wiring (spoken) both call this and nothing else.
- `src/features/era/useEraHousehold.ts` — `useEraHousehold` (current user + partner id)
- `src/features/era/useEraBudgetSubmit.ts` — money choke point for `draftTransaction`
- `src/features/era/useEraConversation.ts` — `era_conversations`/`era_messages` persistence + realtime; active-conversation choice, New chat, History (resume / archive)
- `src/features/era/useEraIssues.ts` — file / undo a Report (HUB-85)
- `src/features/era/thread.ts` — pure thread view-model: breaks, Report offer, quiet nudge, titles (HUB-86/52)

## Feature module

- **Effective confirmation (HUB-109, 2026-10-11)** — `src/components/era/EraActionPreview.tsx` is shared by default/saved cards. Reviewed registry action titles and effective fields replace model prose; original request is expandable, dependencies stay pending, and materially resolved/changed values need fresh Confirm. Completed effects remain visible and do not repeat. Source completion is SCH-24; owner SQL/RLS and 390 px visual acceptance are pending.

- `src/features/era/types.ts` — `FaceKey`, `Face`, `Intent`, `IntentRouter`
- `src/features/era/faceRegistry.ts` — `FACES`, `getFace`, `DEFAULT_FACE_KEY`
- `src/features/era/intentRouter.ts` — re-exports `rootIntentRouter` (`src/features/era/intents/index.ts`), a deterministic keyword router — shipped, not a stub; no Gemini-backed router exists
- `src/features/era/queryKeys.ts` — `eraKeys`
- `src/features/era/capabilities/plan.ts` — Agent v1 (2026-10-10): validated plans of up to six actions, typed result dependencies and per-step receipts. Read-only plans answer directly; writes use the existing Confirm/Dismiss card with deterministic effective fields (HUB-109). `confirmation.ts` prevents duplicate confirmation; source actions and artifacts remain shared with the app.

## API routes

- `src/app/api/era/runs/route.ts` — GET/POST owner-only saved plans; `src/app/api/era/runs/[id]/route.ts` — PATCH validated version/attempt transitions and atomic artifact projection (HUB-104). `src/features/era/execution/useEraRuns.ts` loads the original conversation's unfinished work; the migration and build-time flag are required before rollout.

- `src/app/api/era/ask/route.ts` — capability-aware Gemini interpretation into a single action or multi-step plan; no domain writes. Agent requests include the user's local calendar date.
- `src/app/api/era/conversations/route.ts`, `src/app/api/era/messages/route.ts` — shipped since Phase 0.5; append-only `era_messages`
- `src/app/api/era/actions/route.ts` — GET/POST for the Activity log (2026-08-27, HUB-25); GET returns the last 30 rows by default, one local day with `?from=&to=` and the list of days with `?view=days` (bucketed client-side in `useEraArtifacts` against the caller's timezone); `POST /api/era/actions/status` reports each reversible row's live state for Undo/Redo
- `src/app/api/era/conversations/route.ts?history=1` — History rows with deterministic titles; `src/app/api/era/conversations/[id]/route.ts` — PATCH resume / archive (HUB-52)
- `src/app/api/era/issues/route.ts` (POST) and `src/app/api/era/issues/[id]/route.ts` (DELETE = Undo) — file a Report as a system `era_messages` row (HUB-85); the PM bridge imports it as a Hub & ERA defect (R72)

## DB tables

- `era_runs` (migration `2026-10-10_era-execution-journal.sql`, **pending manual run**) — private consent/progress journal with a versioned transaction function; deterministic `era_actions` projection uses the same transaction. Feature flag defaults off.

- `era_conversations`, `era_messages` (`migrations/schema.sql`) — shipped since Phase 0.5
- `era_actions` (migration `2026-08-26_era-actions.sql`; entity/verb widened by `2026-10-04_era-artifacts-any-entity.sql`, **pending manual run**) — one row per ERA-initiated create/update/delete, feeds the Artifacts tab

## How to get here

- Direct URL: `/era` (auth-gated; redirects to `/login` for guests)
- Phase 0 does **not** add ERA to the bottom `MobileNav` — URL-only access while the design matures

## What it links to

- Each face's `route` (`/expense`, `/items`, `/recipe`, `/catalogue`) — Phase 1+ wires the placeholder body to deep-link into these
- Settings, Atlas, etc. via the global `ConditionalHeader` (visible above the shell)
- Artifact rows open `era_actions.route`, built server-side from `ERA_ARTIFACT_ENTITIES` in `src/lib/era/artifacts.ts` (2026-10-04 — that registry is now the source of truth; contacts open `/catalogue?item=<id>`, deletes open `/recycle-bin`). Historical note, 2026-08-27, HUB-25: `/items?openId=<id>&date=<yyyy-mm-dd>` (reminders — `WebDayPlanner`'s new `initialOpenItemId` prop opens the item's detail modal directly, independent of which day-section it's in), `/dashboard?openId=<id>` (confirmed transactions — `WebDashboard`'s `openId` search param), `/meal-plan` and `/era?face=brain` (no per-record deep link yet), `/expense` (transfers/debts — no detail view exists anywhere for these, tracked in the Master Book Pain Inventory)

## Related vault doc

- `ERA Notes/03 - Junction Modules/ERA/Overview.md`

## Screenshots

- _(pending Phase 1 design)_

## Notes

- The shell uses `fixed inset-x-0 top-16 bottom-0` to claim the viewport under the global `h-16` header. Mobile reserves 72px (`MOBILE_NAV_HEIGHT`) at the bottom for the `MobileNav` via `pb-[72px] md:pb-0`.
- Brand mark on the global header: `moduleFromPath()` in `src/components/layouts/ConditionalHeader.tsx` maps `/era` → `memory`. The shell itself shows the **active face's** mark inline in `EraShell.tsx` via `ERAMark` — `FaceHeader` (deleted 2026-08-25) never had an importer.
- Free text uses `IntentRouter`; native completion choices supply validated structured values to the same `useEraTurn` handler. All persistence, execution, receipts and artifacts remain on that shared path.
- `CommandBar` background uses `tc.bgPage` (Hard Rule #15: floating overlays must be opaque, never `neo-card`).
- ERA is **not** in `STANDALONE_APPS`, so the global `ConditionalHeader` and `MobileNav` remain visible.
- **Conversation layout (2026-10-03, owner-commissioned chat redesign, HUB-86).** With no open conversation the hub is exactly as before. While a conversation is open in hub view, the ERA DOT takes its existing module-mode position (same spring) and the thread fills the space between it and the command bar; New chat returns the DOT and greeting to the centre. Below 1280 px the corner cards step aside while chatting (`.era-shell[data-conversing]`). Revert path: `heroHub` → `isHub` in `EraShell.tsx`.
- **The centered animating ERA DOT + corner-scattered widget cards are original, unchanged Phase 0/0.5 design.** A same-session attempt to redesign this into a top-left icon + widget grid (HUB-25) was reverted at the owner's explicit request — the Activity log shipped instead as an additive "Artifacts" nav chip. Don't re-attempt the layout rework without asking first.
