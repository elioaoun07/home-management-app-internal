---
created: 2026-09-10
updated: 2026-11-10
type: master-book
status: active
owner: Elio
---

# Hub & ERA — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

A dependable daily assistant that reads broadly, proposes safely and speaks first when useful. Junction and primary interaction layer; owns household, shared sync and cross-module AI contracts.

## Current state & evidence

**2026-11-10 — Fable 2 filing (documentation only):** HUB-118, HUB-119, HUB-120, HUB-121, HUB-122 added to the checklist with criteria below. Sources are the 2026-11-04 Major Bug Sweep, whose IDs had not been filed, and the [Fable 2 analysis](<../Fable 2/_index.md>) at commit `8da80ae`. Nothing is implemented, applied or verified by this entry.

**2026-10-25 — owner UAT wording backfilled (documentation only):** [Hub and ERA walkthroughs](<../../../docs/Delivery-UAT-Hub-2026-10-25.md>) give completed slices awaiting acceptance numbered navigation/actions, expected results, setup and cleanup. Partial broader items retain their open engineering gates; old receipts and owner observations are unchanged. New manual results are Pending. [Delivery-wide index and feedback format](<../../../docs/Delivery-UAT-Scenarios-2026-10-25.md>). No app/provider/production acceptance was exercised during drafting.

Final review 2026-10-11 (**HUB-108**, working tree after HUB-103–106; HEAD `82a564f0`): a supervised assistant with composable reviewed actions, not an unrestricted application operator. Default-mode confirmation, partial NFC receipts, recurrence refusal and Ask AI metering were hardened. The [final assessment](<../../03 - Junction Modules/AI Assistant/Overview.md#final-review-and-hardening--2026-10-11-hub-108>) records actual reach, intelligence limits, remaining source/consent defects and deployment/device gates. No new production, paid-model or device witness is implied.

Intent routing and turn-latency repairs shipped. Proactive delivery, source coverage, safe learned referents and durable capture remain incomplete. September research supplies bounded evidence, not production incidents or completed deliveries.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- **HUB-116 — Multi-write actions are always optimistic, bulk and connectivity-proof (owner requirement, 2026-10-17).** Any action that writes several rows shows them at once, sends them as one idempotent request (every row carries its own id, so a retry cannot duplicate), queues the whole batch when the network will not take it, and never lets a slow write mark the app offline. SCH-25 delivered the pattern for item creation (`src/features/items/bulkItems.ts`, `/api/items/bulk`); this item carries it to every other multi-write flow and to the connectivity manager. One engine per concept: callers reuse the shared path rather than adding another queue or request shape.

- **HUB-115 — Subtle, expressive motion on ERA's top layer (owner request, 2026-10-12).** Add atmosphere and interaction polish around the existing centered mark, scatter cards, face pills and composer. Preserve all functionality and the current layout. Slow ambient motion belongs at the edges; reading surfaces stay still; reduced-motion preferences disable movement. *(IMPLEMENTED 2026-10-12 — repository and local checks; browser/mobile visual acceptance pending.)*

- **HUB-113 — The composer finishes your sentence the way you usually finish it (owner request, 2026-10-12).** "Feel like talking to a person who can autocomplete my sentences and understand what I am saying, while being native" — for spends, reminders/events and shopping. ERA keeps a read-only memory of the person's own wording (spends, titles) and the household's list items; completes from it and from the next gap; understands each module grammar's phrasing anywhere plus the household's remembered phrasing; infers account/category/list/group from history without ever changing an amount's currency; asks only what the manual flows require (shopping group and alert become corrections in a prose summary, not questions). No model on typing or Send; the 2026-08-31 "no generic reminder verbs" decision stands. *(IMPLEMENTED 2026-10-12 — repository, unit/route/render checks and a static visual review; device acceptance pending.)*

- **HUB-112 — Native chatbot completion (owner request and corrections, 2026-10-12).** Reminder/event, expense and shopping prefixes progressively complete the sentence inside one calm composer. The owner rejected both the creation form and the scrolling token rail. One in-flow assistant question owns the next step; fully named choices wrap, with More in a searchable native sheet and Details for optional values. The detected action keeps its module hue; ellipsis opens vertical intent correction without mixing feature tabs. Natural date/time summary, neutral sentence text, separate toolbar and Close/Escape preserve focus. After accepting that layout, the owner requested ERA atmosphere: reused miniature mark, module-colored halo/chips/Send and subtle autocomplete transitions, with theme contrast and reduced-motion support. Keep source adapters, drafts, Undo and artifacts; no new database store. *(IMPLEMENTED 2026-10-12 — repository, replay and rendered-component checks; mobile/browser acceptance pending.)*

- **HUB-109 — Consent describes the effective application action.** Reviewed registry fields, validated/defaulted slots and source lookups own the card; model labels cannot authorize a different effect. Unknown dependencies remain pending; materially resolved/changed values need fresh consent, with completed work retained. Reuse the current executor/journal/source seams. *(IMPLEMENTED 2026-10-11 — repository; 390 px/saved-card owner acceptance pending.)*

- **HUB-108 — Harden before widening reach (owner final-review request, 2026-10-11).** Keep the source-adapter/registry/journal architecture. Put single model actions through the same executor as plans, bind default-mode consent and private results to the original account/chat, retain partial facts, refuse unsupported parsed recurrence and record real provider usage. Broader adoption waits on truthful source receipts, effective-value confirmation and current acceptance evidence; another model or framework does not supply those guarantees. *(IMPLEMENTED 2026-10-11 — local code and fixtures; source/deployment/device/model gaps explicitly remain.)*

- **HUB-106 — Adaptive intelligence through attributed evidence (owner request, 2026-10-10).** Reuse the existing private transcript, lexicon, settings, source-aware activity and capability contracts to supply personal context on every face. Separate working dialogue, historical user statements, acknowledged actions, explicit preferences and tentative observations; do not silently promote inferred habits to household notes or phrase rules. Current requests/source permissions and Confirm remain authoritative. Recognize keyword-free follow-ups within a live dialogue and expose bounded gaps honestly. *(IMPLEMENTED 2026-10-10 — repository and isolated fixtures; live-model/device acceptance pending.)*

- **HUB-105 — Contract-derived discovery (owner request, 2026-10-10).** Make purpose, schemas, dependencies, source provenance and retry limits discoverable from one reviewed capability contract. Inventory new backend methods automatically while keeping them unreviewed until adapted; a route is not authority. Preserve Confirm and conservative durable recovery; source idempotency comes before new write families. *(IMPLEMENTED 2026-10-10 — local discovery/audit and dependency preflight; prompt recording validation pending explicit Gemini disclosure approval.)*

- **HUB-104 — Durable execution before wider agent reach (owner request, 2026-10-10).** Keep the Phase 2 planner and source adapters; add one versioned, owner-bound run journal for consent, outputs, pending questions and partial receipts. Persist an attempt before dispatch, fence competing/late completions, restore unfinished work in its original conversation and require explicit recovery. Unknown writes cannot be replayed. Journal receipts and artifact projection are atomic; source writes still require future endpoint idempotency under HUB-46. No parallel offline queue or background execution. *(IMPLEMENTED 2026-10-10 — repository and isolated transaction/adapter evidence; flag off pending owner migration and device acceptance.)*

- **HUB-103 / HUB-100 — ERA Agent v1 (owner implementation request, 2026-10-10).** Extend the accepted Top Layer source-adapter/confirmation architecture with bounded multi-step plans in the existing typed/voice pipeline. The model discovers capabilities from the real catalog; the deterministic executor validates all steps, binds real outputs, confirms writes and records completed/partial artifacts. Native commands stay available. No new DB store or independent assistant. This is an initial workflow slice, not completion of HUB-81, HUB-46 or the entire U0–U5 programme. *(IMPLEMENTED 2026-10-10 — repository and isolated/live-model evidence; device/production acceptance pending.)*

- **HUB-94 — ERA learns the places you go (owner request 2026-10-04).** When ERA creates an event it asks where. A new place gets one offer to save it to Catalogue → **Places**, and next time ERA recognises it by name or alias tag without asking. The event is written first, and the questions are skippable chips that never block it. A place is a Catalogue item in a custom module ERA creates and marks `settings_json.era_role = "places"`, so no DB change is needed. The event keeps `location_text` plus `metadata_json.place_id` as the seam for proactive use. Proactive use stays time-based (owner no-geofencing exclusion). Similar patterns are proposed in [ERA Learns Your World — Proposal](<../../03 - Junction Modules/AI Assistant/ERA Learns Your World — Proposal.md>). *(IMPLEMENTED 2026-10-04 — repository; device acceptance pending.)*

- **HUB-90 — Every ERA write is "ERA using the app's functionality", and it leaves an Artifact (owner rule 2026-10-04).** Every create, update and delete ERA performs appears in /era → Artifacts and opens the item (deletes open the Recycle Bin); the Activity Log's ERA row opens the same target. One template for every feature: the adapter reuses the app's own route and returns `artifacts`; one logger (`recordArtifacts.ts`), one entity/link registry (`src/lib/era/artifacts.ts`), one contract test. Per-feature identity is data (entity, title, link), never a per-feature code path. `/era-wire` mandates it for new wirings. *(IMPLEMENTED 2026-10-04 — repository; owner SQL and device acceptance in HUB-91; item-level links for the remaining entities in HUB-92.)*

- **HUB-85 / HUB-86 / HUB-52 — The ERA chat is a conversation, and its misses become work (owner-commissioned 2026-10-03).** The owner asked for: a way to log a missed or wrongly handled request with its chat history and actions, landing in the weekly sprint as standalone defects/hotfixes to deliver now; a conversation-grade chat on web and mobile instead of small text above the bar; New chat to reset "it", with a subtle, unforced cue when a conversation has ended; and subtle history. Decisions: a Report is a system `era_messages` row carrying a server-built snapshot (no new store — D4); the PM bridge imports it read-only toward the DB into Now › **ERA reports** (PM Tooling R72), where Sprints lists it as a Hotfix (wrong) or Defect (missed) whatever week it was filed. New chat is client state (plus a per-device marker so it survives a reload); the cue appears after 30 minutes of silence — the focus-memory TTL, exactly when "it" stops resolving. History keeps every chat, lists the 50 most recent, and a chat auto-closes after 6 h. **Layout-freeze exception (owner request):** while a conversation is open in hub view the ERA DOT takes its existing module-mode position so the thread can be read; the idle hub is unchanged. *(IMPLEMENTED 2026-10-03 — repository; device acceptance in HUB-83.)*

- **HUB-74 — Phone-width chat composer.** Keep the draft field flexible and use one prominent mic/send action; voice recording controls follow the same edge sizing. *(IMPLEMENTED 2026-09-27 — repository; device acceptance pending.)*

- **HUB-73 — Compact chat selection.** Long press starts message selection; the toolbar exposes bulk add and delete, while mobile secondary controls move to Chat options. Deletion asks for viewer scope and keeps Undo. *(IMPLEMENTED 2026-09-27 — repository; device acceptance pending.)*

- **HUB-72 — Household activity.** Owner adopted a standalone, installable `/activity-log` for household source changes on 2026-09-26. Capture in source transactions, with module/feature/person/date filters; partner-private budget entries are hidden entirely. Snapshot audience intersects current source/parent privacy. Existing HUB-25 assistant Artifacts remain separate. *(IMPLEMENTED 2026-09-26 — repository; owner SQL application and device acceptance pending.)*

- **Understanding track — ERA Top Layer revision 2026-09-27.** The owner commissioned a final challenge of the capability study, the Understanding Engine study and its counter-review, and one plan. [Plan §2](<../Plans/ERA Top Layer.md#2-final-challenge-rulings-on-the-four-sources>) records the rulings; phases U0–U5 are HUB-75–82 with evidence gates and session budgets. Decisions U-1–U-7 are resolved there. DEC-24 (model-interpreted one-time reminders as Act + Undo) stays with the owner, and until it is decided they need Confirm. *(DEC-24 decided 2026-09-27 by the owner: keep Confirm.)* *(U0 partial: HUB-75 and HUB-76 IMPLEMENTED 2026-09-27 — repository; device acceptance pending. HUB-77 IMPLEMENTED 2026-09-27 — U-1's model-first condition failed on the owner export, so ERA keeps "model on miss or conflict only"; see [HUB-77](<../_Archive/Shipped/Hub & ERA.md#hub-77>). U0 complete except device witnesses.)*

- The accepted Top Layer plan governs the product target; checklists own status. Preserve D1–D18, including the existing ERA layout freeze, personal-first sequencing and the owner’s no-wake-word/no-geofencing exclusions.
- ERA is the top interface. Chef remains the Kitchen specialist; Brain retains bounded memory; standalone forms are precision tools. Retire floating/Focus surfaces only after the replacement is reachable.
- Never learn from failed, pending, uncertain or wrong-target actions. Read coverage and provenance are part of a fact, not optional telemetry. Proposals require human confirmation before money or schedule mutation.
- HUB-5 is an on-touch rider, not an extraction programme. HUB-16 is the sanctioned HubPage rider; no broad redesign is authorized.
- NOTIF-19 owns E-19 once; BUD-2 owns Hub merchant matching once. Source modules own canonical facts and inverses; Hub owns transport, orchestration and recoverable input.
- DEC-01/02 settle recipient hours/sequencing and persistent colors. DEC-13/18 settle household lifecycle/schema choices; undocumented production state is not evidence.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🔴 **HUB-118** Require host sign-in for Guest Portal bulk reads. Filed 2026-11-10 from [Major Bug Sweep S1](<../Research/Major Bug Sweep.md#s1>) (2026-11-04: evidence, fix, test and UAT); re-verified 2026-11-10: [Fable 2 note](<../Fable 2/02 - Standalone Modules/Guest Portal/Guest Data Exposure Still Unqueued.md>). See [acceptance](<#hub-118>).

🔴 **HUB-119** Keep every queued offline write until the user decides. Filed 2026-11-10 from [Major Bug Sweep O1](<../Research/Major Bug Sweep.md#o1>) (2026-11-04: evidence, fix, test and UAT). See [acceptance](<#hub-119>).

🟠 **HUB-120** Make transaction creates safe to replay. Filed 2026-11-10 from [Major Bug Sweep O2](<../Research/Major Bug Sweep.md#o2>) (2026-11-04: evidence, fix, test and UAT). See [acceptance](<#hub-120>).

🟠 **HUB-121** Resolve the household link in one place. Filed 2026-11-10 from [Major Bug Sweep H1](<../Research/Major Bug Sweep.md#h1>) (2026-11-04: evidence, fix, test and UAT). See [acceptance](<#hub-121>).

🟡 **HUB-122** Tighten Guest Portal bot and chat routes. Filed 2026-11-10 from [Major Bug Sweep G1](<../Research/Major Bug Sweep.md#g1>) (2026-11-04: evidence, fix, test and UAT). See [acceptance](<#hub-122>).

- 🟠 **HUB-94 acceptance gap — source review, 2026-10-25.** The current typed event composer passes structured capture through `useEraTurn` → `resolveIntent` → `resolveScheduleCapture`; that path returns the event receipt without the older event resolver's Where?/Save-to-Places follow-up. [H06](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h06--create-a-placecontact-use-the-place-and-open-its-artifact>) retains the accepted expectation and labels the divergence. No runtime reproduction or owner FAIL is claimed; a bounded follow-up needs its own engineering scope before implementation.

🟠 **HUB-117** ERA missed "Location for Women's night is Kobeize" (ERA report, 2026-10-18). See [acceptance](<#hub-117>).

- 🟠 **HUB-116 — A burst of slow writes can flip the whole app offline, and other multi-write flows still fan out one request per row.** From source reading during SCH-25, not reproduced (production writes are barred): `safeFetch` answers a timeout with an `/api/health` probe on the same origin; if that probe fails under load, `connectivityManager` sets the global state offline and every later write takes the offline path. Hub bulk convert, flexible-routine assignment and the day planner create or write rows one request at a time. Sheets and acceptance under [criteria](<#hub-116>).

- 🟡 **ERA hydration mismatch on `CommandBar` form id — Resolved locally, 2026-10-12.** `/era` logged a `useId` hydration warning. Likely cause (not reproduced): `EraShell` `conversing` read persisted query-cache messages on the first client render, so the thread block above `CommandBar` rendered client-only. Fix: `conversing`/`hasTurns` gated behind a `useSyncExternalStore` hydrated flag in `EraShell.tsx`. Unverified in browser.

**HUB-113 — Resolved locally, 2026-10-12.** Three capture-path defects found while building composer memory: (1) shared `parseTime` let a named period win over a written clock, so "tonight at 9pm" saved 20:00 and left "at 9pm" in titles (the HUB-112 known follow-up); (2) `parseSpeechExpense` dated relative days by the UTC day (`toISOString`), so an early-morning "yesterday" in Beirut was dated two days back; (3) the composer's expense prefix rule accepted "spent 2 hours studying" as a spend. All three have source regressions under [HUB-113](<#hub-113>).

- 🟠 **HUB-112 — Native completion crowded the composer and advanced on a false title.** Owner screenshots, 2026-10-12: floating shapes, horizontal scrollbars, truncated options and identical-colored Reminder/Event/Expense/Shopping choices made the next step unclear. The UI used a scrolling token/choice rail instead of a single assistant question. A separate parser cause made `Remind me today at 5pm` look titled: optional ` to` consumed the start of `today`, producing “Day” and showing Alert. The chatbot refactor replaces that rail and the prefix stripper now requires complete filler words; current revision checks and mobile acceptance are recorded under [HUB-112](<#hub-112>).

**HUB-111 — Resolved locally, 2026-10-12.** AI Usage showed $0.0030 against a $0.02 console bill for 2026-10-11 (Claude Haiku 5.5). Cause: two agent-run HUB-107 acceptance passes (`.tmp/era-agent-record.pass1.lock` 12 calls + `.tmp/era-agent-record.lock` 13 calls, ~5.5K input tokens each, ≈ $0.019) called the model directly and wrote no receipts; app calls ≈ $0.003. Fixes: (1) live calls are impossible from tests — `tests/setup/blockPaidApis.ts` rejects Anthropic/Gemini/Azure hosts in every Vitest process; the Gemini gym recorder, the agent-record refresh and the `.tmp` one-off live scripts were deleted; stale recordings skip instead of failing; Hard Rule #29 now says only the owner starts a live pass; (2) prompt caching — the ~5K-token stable system block (contract + catalogs) is cached, the per-request date/focus/face/personal context moved after it; (3) SDK retries off, 429/5xx retried once, timeouts never retried and metered as an estimated-input receipt; (4) `model_used` `:cache=R/W` suffix reprices cache reads 0.1× / writes 1.25× in AI Usage, plus the Haiku 5.5 >100K-prompt tier. (5) monthly cap on Ask AI is now **$1/user** estimated from receipts, paged past the 1,000-row limit (replaces 1M tokens). Unit tests cover all five; related suites 672 pass, typecheck clean. Not verified live (no paid calls): the console Caching page should show reads after the first two Ask AI taps within 5 minutes. The 13 Haiku replay cases now skip (prompt order changed) until an owner-started refresh.

🟠 **HUB-108 — Default execution bypassed plan safeguards and some replies overstated success.** Source inspection and failing isolated regressions on 2026-10-11: single model cards dispatched directly without focus/live-target/artifact re-admission, owner/chat changes were unchecked between default-mode steps, invalid proposals could repeat model-authored “done” prose, and failed NFC trigger setup discarded a created reminder's artifact. Ask AI usage estimated only visible text and attributed the configured primary. Fixed in this review; native-path convergence/source idempotency remain HUB-46, source completeness is SCH-24, and semantic consent is HUB-109. This is repository evidence, not a new production incident.

**HUB-109 — Resolved locally, 2026-10-11.** Model-authored consent descriptions were replaced by a shared deterministic effective-action view and fresh consent after source resolution/change. Isolated adversarial values, actual adapters, React hook continuation and journal reload pass. Owner mobile/saved-card acceptance remains under [criteria](<#hub-109>); whole-goal language fidelity remains HUB-105.

🟠 **HUB-106 — ERA's existing memory was disconnected from interpretation.** Source inspection 2026-10-10: Ask AI supplied eight cached turns and selected-face context, while private history, lexicon and activity stayed outside the model. Keyword-free follow-ups could be stopped as capability gaps; optimistic rows had no speaker identity. Addressed by bounded private retrieval, owner-attributed tails and active-dialogue escalation. Shared Brain note storage/audience remains an unverified readiness gap; no production claim or automatic shared-memory ingestion.

🟠 **HUB-105 — Capability knowledge was duplicated, and dependent data could fail after an intervening write.** Root cause: hand-written slot descriptions and per-workflow prompt instructions diverged from executable schemas; dependency values were checked only when their destination ran. Source inspection and isolated tests demonstrate empty/oversized recipe ingredients could be discovered after meal assignment, including Resume from a saved receipt. Local contract discovery and early consumer preflight address this; current-prompt model recording validation remains pending approval.

🟠 **HUB-104 — Phase 2 execution lost progress and consent on reload and had no cross-client arbitration.** Root cause: session-only plan/card state, optional transcript persistence and a local lock without durable attempt claims; a source commit followed by response loss could be repeated. Evidence: code inspection plus injected lost-response, competing-confirmation and fresh-session tests, not a production incident. Addressed by the opt-in journal foundation below; source-endpoint exactly-once reconciliation remains HUB-46 and owner rollout is pending.

🟠 **HUB-102** Artifacts for debts, memories, meal plans, shopping, recurring cover and every "updated" verb (complete, skip, postpone, confirm, reschedule) have no Undo/Redo. Cause: their backend inverse is a hard delete (debts, memories, meal plans) or does not exist, so there is no restore to reuse. Each needs a soft-delete + restore pair, or a stored before-image, first. See [acceptance](<#hub-102>).

🔴 **HUB-93** ERA did the wrong thing with "Add Racha as a Contact" (ERA report, 2026-10-04). See [acceptance](<#hub-93>).

🟠 **HUB-90** ERA's writes did not show in /era → Artifacts, and the Activity Log's ERA "Open" went to `/era` instead of the item. Owner screenshots 2026-10-04: "Add Racha as a Contact" → "Added · Racha", Artifacts shows "0 · Nothing yet today"; Activity Log row "Added · Racha · ERA · Messages" → Open → /era Artifacts. Cause: `src/features/era/logEraAction.ts` mapped six intent kinds onto a fixed six-value `era_actions.entity_type` CHECK, so every newer write (contact, shopping add/edit/remove, shopping group, recurring cover, NFC via capability) logged nothing; `activitySourceHref` sent every ERA row to `/era` and schedule items to `/items?openId=`, a page that does not exist. Resolved in repository 2026-10-04 (artifact contract — every adapter returns `artifacts`, one logger, one link registry, contract test); migration and device witness in HUB-91.

🟡 **HUB-92** ERA artifacts for transfers, debts, drafts, meal plans, memories, recurring payments and shopping open their module page, not the item. Cause: those pages take no per-item URL parameter (only Schedule `?openId=`, Dashboard `?openId=` and, since 2026-10-04, Catalogue `?item=` do). Links are built in one place (`src/lib/era/artifacts.ts`), so each fix is one page param plus one registry row.

🟠 **HUB-89** ERA missed "Add Laura as a contact person" (ERA report, 2026-10-03). See [acceptance](<../_Archive/Shipped/Hub & ERA.md#hub-89>).

🟠 **HUB-88** ERA missed "Add Kobeize as a location" (ERA report, 2026-10-03). Cause: ERA had no place grammar or Places store. Resolved in repository 2026-10-04 by HUB-94 (Catalogue → Places). See [acceptance](<../_Archive/Shipped/Hub & ERA.md#hub-88>).

🟠 **HUB-87** ERA missed "Add Mop Chores today" (ERA report, 2026-10-03). See [acceptance](<#hub-87>).

🟠 **HUB-84** A follow-up about something that isn't a reminder was read as a reschedule. Owner screenshot 2026-09-27: "Add salt to my shopping list" → "Added · Salt"; "make it under Spinneys group" → "I'm not sure what \"that\" refers to — what should I reschedule?". Cause: focus memory only held reminders, the "make it …" grammar was fixed to reminder reschedule, and the shopping adapter had no edit contract. Resolved in repository 2026-09-27 (typed focus + per-type edit contracts); device witness in HUB-83.

🔴 **HUB-76** ERA treats negated and hypothetical money sentences as commands. With a reset ERA store, `Don't transfer $300 from Drawer to Wallet` and `What if I transfer $300 from Drawer to Wallet?` produce the same transfer intent as the affirmative command. Cause: the transfer grammar in `src/features/era/intents/budget.ts` (~line 107) matches the substring with no speech-act guard, and the native resolver POSTs `/api/transfers` with no confirm or inline Undo. The same direct-write path applies to native debt record and reminder delete. Evidence: 2026-09-27 counter-review probes (5 isolated probes plus the router suite, 110 tests). No resolver ran and no production transfer occurred. [Reproduction inputs](<../_Archive/Studies/ERA Understanding/ERA Understanding Engine.md#r2--the-proposed-fast-path-needs-speech-act-guards>). Resolved in repository 2026-09-27 (speech-act gate + native confirm card); device witness pending.

🟠 **HUB-74** The chat send action appeared clipped at the right edge on a narrow phone. Owner screenshot on 2026-09-27 shows the input, mic and a sliver of the send control. Source cause: the input lacked `min-w-0` while a second conversation toggle and layered mic/send/fallback buttons occupied the same flex row. Resolved in repository; mobile runtime witness pending.

🟠 **HUB-73** Mobile chat header crowded out the bulk-add control, and long-press deletion split single and bulk paths. Source evidence: `HubPage.tsx` held selection controls beside the title plus search, filter, voice, settings and sync; bulk deletion was limited to shopping/notes selection while Budget/Reminder selection offered add only. Resolved in repository; mobile runtime witness pending.

🟠 **HUB-75** ERA misses amounts written the household's way. `spent 12$ on coffee`, `paid 300$` and `coffee 4$` return clarify, and `500k lbp groceries` is unread. Hub chat's `messageTransactionParser` reads the same `12$` sentences. Cause: `MARKED_AMOUNT_RE` in `src/features/era/intents/budget.ts` ends with `\b`, which needs a word character after `$`/`€`/`£`; the positional fallback then fails because `$` follows the digits. Neither parser supports the `k` thousands shorthand. Evidence: temporary router probe on 2026-09-27, recorded in [archived probe §1.2](<../_Archive/Studies/ERA Understanding/ERA Understanding Engine.md#12-amount-format-two-parsers-disagree-on-the-households-own-notation>). Resolved in repository 2026-09-27 (`src/lib/nlp/amount.ts`); device witness pending.

🟠 **HUB-62** Record current schema and application evidence. See [acceptance](<#hub-62>) for the root cause, evidence and gate.

🔴 **HUB-37** Verify CI and recoverable capture failures. See [acceptance](<#hub-37>) for the root cause, evidence and gate.

🔴 **HUB-38** Record authenticated cadence-aware cron liveness. See [acceptance](<#hub-38>) for the root cause, evidence and gate.

🟠 **HUB-16** Preserve voice reminder time through the shared turn engine. Dated source diagnosis; cause and witness limits are in [criteria](<../_Archive/Shipped/Hub & ERA.md#hub-16>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-57** Link conversions to the returned draft ID. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-57>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-58** Report bulk Undo failures honestly. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-58>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-59** Use the source message date for transaction conversion. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-59>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-63** Align chat receipts and badges with notification policy. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-63>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-64** Reject learned actions with unsafe referents. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-64>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-67** Make bulk message conversion and inverse atomic. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-67>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-70** Correct saved notes with ID and revision preconditions. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-70>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

🟡 **HUB-95** ERA's "add a contact" never checks for an existing contact. "Add Laura" twice creates two rows. For the partner, `resolveAddContact` picks the owner's shared `contacts` module and writes a private row there (`src/features/era/intents/resolvers/contacts.ts`). Places already dedupes by name and tag. See [acceptance](#hub-95).

🟠 **HUB-97** ERA missed "Add BBQ sauce, Small Pepsi Can, bread, cheese, and eggs to spinneys shopping list" and "Add BBQ Sauce to shopping chat" (owner screenshots, 2026-10-05 08:03). Only "Add to shopping list BBQ Sauce" worked. Cause: the shopping grammar in `src/features/era/intents/chef.ts` required `to (the|my|our) shopping list`. A store word between "to" and "shopping list" broke it, and "shopping chat" wasn't a list noun. Evidence: router probe on all 7 sentences, 4 Gym reds. Resolved in repository 2026-10-10. See [acceptance](#hub-97).

🟠 **HUB-98** Ask AI answered "I couldn't reach the AI just now" 3 times out of 5 in the same session, with no trace of why. Causes: `generateAskAIResponse` swallowed every failure silently (`src/lib/ai/eraAskProposal.ts`). `generateContentWithFallback` retried only 429s, so a 503 "model overloaded" rethrew without trying the fallback model (`src/lib/ai/gemini.ts`). `maxOutputTokens: 1024` also counts a thinking model's thinking tokens, which can cut the JSON off. That last one is a hypothesis; the new log line will confirm it. Resolved in repository 2026-10-10. See [acceptance](#hub-98).

🟠 **HUB-99** Typed sentences can skip ERA entirely. The ✨ Ask AI icon sits next to Send as two bare 16 px icons (`CommandBar.tsx`), and with text typed it sends that text straight to `/api/era/ask` without routing it first. Evidence: "Add to shopping list Small Pepsi Can, bread, cheese, and eggs" routes to `addShopping` deterministically, yet got an AI reply twice. `useEraTurn` only calls the AI on a router miss, so those turns came from the ✨ button. Owner decision needed. See [acceptance](#hub-99).

🟡 **HUB-100** Ask AI says "I don't have a shopping list feature". Its catalog (`src/features/era/capabilities/registry.ts`) has no `shopping.add`, so the model can't propose one. See [acceptance](#hub-100).

## Acceptance Criteria Index

### HUB-118

**Outcome:** Only the tag's host (or household partner) can list every guest's allergies and drinks.

**Kind:** bug
**Implementation:** done
**UAT:** pending
**Touches:** `src/app/api/guest-portal/allergies/route.ts`, `src/app/api/guest-portal/drinks/route.ts`, `src/app/g/drinks-admin/page.tsx`, `src/app/api/guest-portal/admin/orders/route.ts`, `migrations/2026-11-21_guest-drinks-enable-rls.sql`

- **Source:** [Major Bug Sweep S1](<../Research/Major Bug Sweep.md#s1>) (2026-11-04: evidence, fix, test and UAT); re-verified 2026-11-10: [Fable 2 note](<../Fable 2/02 - Standalone Modules/Guest Portal/Guest Data Exposure Still Unqueued.md>). Filed 2026-11-10; implemented 2026-11-21: the `all` branches are gone from the public routes, the host view is `GET /api/guest-portal/admin/orders` (401 anonymous · 403 other host · 404 unknown tag · 200 host or active partner) and `/g/drinks-admin` calls only it. Evidence: `src/app/api/guest-portal/bulkReads.test.ts` (red before the fix, green after) and `admin/orders/route.test.ts`; anonymous curl on a dev server gave 401 / 400. Not run: a signed-in host, partner or other account against the real database.
- **Owner UAT:** [Major Bug Sweep S1 UAT](<../Research/Major Bug Sweep.md#s1>) steps 2–4 (logged out → 401/400; host → list; unrelated account → "No access"), then run `migrations/2026-11-21_guest-drinks-enable-rls.sql` after confirming `guest_drinks` still has RLS off (the only evidence is the 2026-08-04 snapshot).
- **Acceptance:** Anonymous `GET ?all=true` → 401; host of another tag → 403; owning host → 200. The public routes no longer accept `all`. `/g/drinks-admin` requires login and resolves the tag from the host's own tags.
- **Tier:** CLAUDE_MID, effort high; owner review (auth). Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** `src/app/api/guest-portal/allergies/route.ts:14-18`. If a refreshed `migrations/db-state.json` still shows RLS disabled on `guest_drinks`, hand the owner the migration in the same change (Hard Rules 24, 26).

### HUB-119

**Outcome:** No queued offline operation is deleted without the user choosing to discard it.

**Kind:** bug
**Touches:** `src/lib/offlineQueue.ts`, `src/lib/offlineSyncEngine.ts`

- **Source:** [Major Bug Sweep O1](<../Research/Major Bug Sweep.md#o1>) (2026-11-04: evidence, fix, test and UAT). Filed 2026-11-10; not started.
- **Acceptance:** A 25-hour-old transaction operation is still queued and flagged for review. A 401 during replay increments the retry count and keeps the operation. Only 400, 403, 404, 409 and 422 are terminal, and terminal operations go to review, not deletion.
- **Tier:** CLAUDE_HIGH. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** `src/lib/offlineSyncEngine.ts:157`, `:327-338`; `src/lib/offlineQueue.ts:422-435`. Related: HUB-116.

### HUB-120

**Outcome:** A replayed or retried transaction create never produces a second row.

**Kind:** bug
**Touches:** `src/app/api/transactions/route.ts`, `src/services/transaction.service.ts`, `src/lib/offlineSyncEngine.ts`

- **Source:** [Major Bug Sweep O2](<../Research/Major Bug Sweep.md#o2>) (2026-11-04: evidence, fix, test and UAT). Filed 2026-11-10; not started.
- **Acceptance:** `POST /api/transactions` accepts a client-generated id, inserts with it and returns the existing row on `23505`. Queued operations carry that id from creation. Test: the same create replayed after a timeout yields one row and one balance adjustment.
- **Tier:** CLAUDE_HIGH; owner review (money). Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Pattern: `replayTransfer` in `src/app/api/transfers/route.ts`. Do after BUD-90, by the same author.

### HUB-121

**Outcome:** Every route resolves the active partner through one helper, and the database allows one active claimed link per user.

**Kind:** bug
**Touches:** `src/lib/accountAccess.ts`, `migrations/`

- **Source:** [Major Bug Sweep H1](<../Research/Major Bug Sweep.md#h1>) (2026-11-04: evidence, fix, test and UAT). Filed 2026-11-10; not started.
- **Acceptance:** One `getActiveHouseholdLink` filters `active = true` and a non-null partner, newest first, limit 1; no route keeps an inline `.maybeSingle()` lookup. A migration file deactivates stale duplicates and adds a partial unique index; the owner applies it. Tests cover two active rows and a pending invite newer than the real link.
- **Tier:** CLAUDE_HIGH; owner review (household, migration). Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** About 23 call sites per the sweep. Read `migrations/db-state.json` first (Hard Rule 27); it is 97 days old, so ask the owner to refresh it.

### HUB-122

**Outcome:** Guest routes answer only for an active tag, guests cannot post as host or bot, and messages are validated.

**Kind:** bug
**Touches:** `src/app/api/guest-portal/bot/route.ts`, `src/app/api/guest-portal/chat/route.ts`

- **Source:** [Major Bug Sweep G1](<../Research/Major Bug Sweep.md#g1>) (2026-11-04: evidence, fix, test and UAT). Filed 2026-11-10; not started.
- **Acceptance:** Every guest route refuses an inactive tag. The public chat POST forces `sender: "guest"` and validates the body with a Zod schema including a length cap. Bot answers derive from `bio_data` and recipes.
- **Tier:** CLAUDE_MID; owner review (public routes). Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Follow HUB-118 in the same area.

### HUB-123

**Outcome:** Contacts can be filed under a category from ERA and from Catalogue, and the ERA thread is never hidden behind the starter pills.

**Kind:** bug
**Source:** owner report 2026-11-25 (ERA top layer screenshot): "Move Racha Contact under Family Category" answered `No "Racha Contact" on the list.`; "In Catalogue, move …" answered that Catalogue changes aren't possible; "Add Racha as a Contact" filed Racha under no category; the Catalogue edit form had no category field; the Expense/Reminder/Event/Shopping pills covered the newest message.
**Implementation:** done
**UAT:** pending

- **Acceptance:** "Move Racha contact under Family (category)", "In Catalogue, move …", "move contact Racha to the Friends category" and "Move Racha under Friends category" file the contact with Undo. "Add Laura as a contact under Friends" / "as a family contact" create it in that category. A missing category asks `No "X" category. Create it?` [Create] [No]; Create makes it and files the contact, Undo reverts both. A plain add asks **Category?** (category chips, Details, Skip). An existing contact is reused. Catalogue's item dialog has a Category select. The thread clears the starter pills. "Don't move …" writes nothing.
- **Evidence (2026-11-25):** Gym `report-hub-123` … `-i` and `report-hub-95` red → green, `-neg` green; known-miss list unchanged (20). Contract rows `contact.create (category)`, `contact.update`, `contact.category`, `contact.newCategory` + Undo test. Router rows (HUB-123) in `rootIntentRouter.test.ts`. `pnpm vitest run tests/era-gym src/features/era src/lib/era tests/catalogue-patch.test.ts`: 785 passed. Typecheck clean. Local dev, read-only: stage bottom 1069 px vs pills top 1082 px (overlapped by 35 px before); Edit Contact shows Category (None, House Maintenance, Car Maintenance, Family); nothing saved.
- **Owner check (phone):** in ERA, send "Move Racha contact under Family category" → `Racha → Family` with Undo, and Racha appears under Family in Catalogue → Contacts. Send "Add Test Person as a contact under Pets" → [Create] → both exist; Undo removes the filing and the Pets category. Open a contact's Edit in Catalogue → change Category → Save → Undo. With a long ERA thread, the newest reply sits above the four pills.
- **Follow-up (2026-11-25, owner: "does that mean it is still working?"):** a 7:53 PM retry answered `Over to Brain.`: a tab still running the old code (localhost served the fix; a hard refresh loads it). That reply is a keyword echo that does nothing yet read as a hand-off in progress. A switch the person did not ask for (`switchFace` without `explicit`) now answers `Nothing done — <face> can't do that from here yet.` and offers Report; "open brain" keeps the old lines. The thinking dots now read `Working…`. Tests: `rootIntentRouter.test.ts` + `thread.test.ts` (HUB-123 rows).
- **Reading guide:** `src/features/era/intents/brain.ts#parseContactIntent` → `resolvers/contacts.ts`; pills: `src/components/era/CommandBar.tsx` (`--era-starters-height`) + `EraComposer.module.css`; Catalogue: `src/components/web/CatalogueItemDialog.tsx`.

### HUB-117

**Outcome:** ERA handles "Location for Women's night is Kobeize".

**Kind:** bug
**Source:** ERA report e1069cd0-c5fa-44ca-a502-b2c3c5e138d9 · missed · owner · 2026-10-18 17:11 (Asia/Beirut)

- **Acceptance:** This request ends in the right outcome — done with Undo, one confirm card, one question with chips, a prefilled form, or an honest limit with a door — never a wrong action or a dead end. An ERA Gym case replays the transcript below.
- **Comment:** Locations should have been added
- **Reading guide:** start at `src/features/era/useEraTurn.ts` (one turn), then the router in `src/features/era/intents/` and the capability's resolver; add the sentence to `tests/era-gym/`.

**Transcript**

- You · 17:08 — Add an event for Group next Tuesday at 8:30 PM _(draftEvent)_
- ERA · 17:08 — Added · Group · Tuesday at 8:30 PM _(draftEvent · done)_
- You · 17:09 — Add an event for women's night November 18 at 8:30 PM _(draftEvent)_
- ERA · 17:09 — Added · Women's night · Wed, Nov 18 at 8:30 PM _(draftEvent · done)_
- You · 17:10 — Location for Women's night is Kobeize _(unknown)_
- ERA · 17:10 — I can't set a location for Women's night, since ERA has no action for editing an event's location. You can add it in the Schedule page. _(ai\_answer)_ ← reported

**ERA actions**

- created event — Group · 17:08
- created event — Women's night · 17:09

### HUB-116

**Outcome:** Every flow that writes several rows shows them at once, saves them as one idempotent request, survives a slow server or lost network, and a slow write never marks the app offline.

**Kind:** feature
**Depends on:** SCH-25 (the shared item bulk path and its migration run by the owner)
**Related:** HUB-46 (durable idempotent capture), HUB-58, HUB-67 (bulk conversion Undo and atomicity), SCH-4.5, SCH-21
**Touches:** src/lib/connectivityManager.ts, src/lib/safeFetch.ts, src/features/items/bulkItems.ts, src/components/hub/BulkConvertReviewSheet.tsx, src/components/planner/MobileFlexibleAssignmentPage.tsx, src/components/web/{AddFlexibleFromCatalogueDialog,DropSlotConfigSheet,WebDayPlanner}.tsx, src/features/chores/useChoreActions.ts, src/features/items/useFlexibleRoutines.ts

- **Acceptance:** Each migrated flow, with 30 rows: rows are visible before the first request returns; at most ⌈30 ÷ chunk⌉ requests leave; a timeout or 5xx is retried with the same ids and never duplicates; offline, the batch waits as one queued operation and its rows stay visible; a refusal removes only the refused rows and tells the person how many; one toast whose Undo is one request. Separately, a burst of slow writes while `/api/health` answers leaves `isReallyOnline()` true, and a real network failure still goes offline.
- **Why:** SCH-25 (2026-10-17) showed the shape: N requests, N refetches and a probe that shares the saturated origin. The pattern now exists for item creation and Undo; the same failure waits in every other loop of writes.
- **Split before dispatch — ordered sheets, each its own change, completing one never completes the parent:**
  - **A. Connectivity.** A write-path timeout must not flip global offline while other requests are in flight (defer or repeat the probe, or require consecutive failures — pick with a test, do not guess). Extend `safeFetch.test.ts` / `connectivityManager.test.ts`. Touches every module: land alone.
  - **B. Item multi-create callers.** Hub bulk convert (`BulkConvertReviewSheet`, with HUB-58/67), flexible assignment dialogs, the day planner and ERA multi-step plans use `createItemsBulk`/`deleteItemsBulk`. Chores' desktop per-row assign joins the same path.
  - **C. Flexible-slot and undated placements.** `item_flexible_schedules` upserts and undated `due_at` updates in Chores (`placeFlexible`, `placeUndated`) are direct and sequential; they need a bulk RPC with the same client-id contract.
  - **D. Inventory.** Search for loops of writes in other modules (shopping list, trips packing, meal plan, recipes→list, catalogue, inventory) and record per site: migrate, already fine, or not applicable — evidence, not assumption.
  - **E. Make it the default.** Add the rule to the `add-feature` and `ui-guardrails` playbooks and a `finish-task` grep for `mutateAsync`/`safeFetch` inside loops or `Promise.all`; consider a Hard Rule once two callers have migrated (owner decision).
- **Reading guide:** `src/features/items/bulkItems.ts` (chunking, optimistic rows, retry, queue), `src/app/api/items/bulk/route.ts`, `migrations/2026-10-17_items-bulk-create.sql`, SCH-25 in the Schedule book. Known limits there: queued rows live only in the creating session's cache; an Undo racing an in-flight queue replay can leave a zombie item.

### HUB-115

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h01--era-motion-and-readable-navigation>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA's top layer gains subtle, expressive animation without changing functionality.

**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** src/components/era/{EraShell,EraFaceNav,HubScatterWidgets,CommandBar,EraChatDrawer}.tsx, src/components/era/{EraMotion,EraComposer}.module.css

- **Acceptance:** The existing idle hub has slow module-colored aurora, fine orbital trails and one wake ripple. The mark morphs continuously between modules. One active-pill highlight travels between the same views; corner cards settle with a brief light pass; composer focus/starters and mobile chat have tactile transitions. Ambient loops pause outside the idle hub. Decorative layers cannot intercept input. Reduced-motion users get immediate movement transitions, static atmosphere and no sheen. Existing navigation/swipe, capture, mic/Send, conversation and source operations are unchanged.
- **Evidence (2026-10-12):** Typecheck and changed-component ESLint pass; 98 existing composer/capture/assist/progress/swipe tests pass. Both CSS modules compile through the project's PostCSS/Tailwind pipeline. The existing local Next server serves `/era` and its new motion/composer stylesheet with HTTP 200; the unauthenticated page streams its normal login redirect, so this proves compilation, not an exercised UI. PM archive/lint/docs checks and the local dashboard rebuild pass (one existing Delivery empty-lane warning). No production writes or paid APIs.
- **Owner acceptance:** At 390 × 844 and desktop widths, in Blue and Frost, inspect wake, idle hub, face changes, typing, conversation and opening/closing mobile chat. Confirm readable text, clear controls, no overflow and calm reduced-motion behavior. Computer Use returned no browsers and opening the in-app browser was unavailable; visual/device acceptance is not certified.

### HUB-113

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h03--personal-completion-known-phrases-and-explicit-time>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA's composer completes and understands everyday captures from the household's own wording.

**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** src/lib/era/captureMemory.ts, src/app/api/era/capture-memory/route.ts, src/features/era/{capture,captureAssist,captureProgress,useEraCapture,useEraCaptureMemory,useEraTurn,queryKeys}.ts, src/components/era/{CommandBar,EraCaptureHelper}.tsx, src/components/era/EraComposer.module.css, src/lib/nlp/{amount,speechExpense}.ts, src/lib/smartTextParser.ts, src/hooks/useMerchantMappings.ts, src/lib/queryConfig.ts

- **Acceptance:** Typing "remind me to ca" offers the person's own titles and a faint "ll mom"; Tab, → at the end, a right swipe or the first chip accepts. After "remind me to call mom " one chip sets day and time; only times still ahead are offered. "15$ pharmacy", "remember to …", "we're out of milk", "buy milk and eggs", "add milk" (known item), "coffee 4" (known spend) and "call mom tomorrow at 5" (known title) are understood; "Gaz yaris 38", "spent 2 hours studying", "buy milk tomorrow" and an unknown "call mom tomorrow" are not. A known spend fills its usual category, and its account only in the amount's currency; "from <account>" works when currencies agree and is never part of the description. Shopping never asks for a group; it files remembered items under their group and lists under their usual list, and "What else?" after a new line offers remembered items not already on the list. The summary reads as prose with tappable parts; understood phrases are tinted behind the neutral sentence; Enter before a required detail shakes the question instead of sending; Send rings once when ready. No model call while typing or on native Send.
- **Evidence (2026-10-12):** `pnpm vitest run` — 3,906 passed, 24 skipped; one PM tooling build test (`tests/pm-ui/react-app-build.test.ts`) timed out at 5 s under full-suite load and passes alone (3.1 s). New: `src/lib/era/captureMemory.test.ts`, `src/features/era/captureAssist.test.ts`, `src/app/api/era/capture-memory/route.test.ts`, `src/lib/smartTextParser.time.test.ts`; extended capture, progress, amount and composer render tests. Typecheck clean; changed-file ESLint has no errors. A static page of the real composer markup and CSS (no app, no database) was reviewed in Chrome in Blue and Frost: marks align with the text, completion follows the caret, summary and chips wrap without overflow.
- **Owner acceptance:** On a phone in two themes, type each example above in both composers; confirm suggestions come from your own history, completions accept by swipe and chip, the summary corrections open the right choices, and Send creates the same reminder, draft or list rows (with Undo) as before. Device keyboard/touch behaviour and live memory content are not machine-verified.

### HUB-112

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h02--one-clear-next-question-while-typing-a-reminder>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA completes native commands through a calm chatbot composer while the person types.

**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** src/components/era/{CommandBar,EraCaptureHelper,EraShell,EraChatDrawer,EraConversation}.tsx, src/components/era/EraComposer.module.css, src/features/era/{capture,captureProgress,useEraCapture,useEraTurn,useEraBudgetSubmit,types,engine}.ts, src/features/era/intents/resolveIntent.ts, src/features/era/intents/resolvers/{capture,budget,shopping}.ts, src/lib/items/createContract.ts, src/lib/queryKeys.ts

- **Acceptance:** Typing advances through one missing detail in a unified chatbot composer. Only the next assistant question is shown; up to four fully named choices wrap in two columns, without horizontal scrollbars or truncated labels. More opens a searchable, opaque portaled sheet. The active action uses its existing icon and module hue (Schedule violet, Budget teal, Shopping/Kitchen orange); ellipsis opens vertical action correction, never other feature tabs beside the current question. Accepted details use a readable natural date/time summary; Details handles corrections and optional priority/location. The original neutral textarea is the only sentence input, with no inner border/ring/glow; mic/audio/Ask AI/Send occupy a separate toolbar. Reminder/event title, date, time and optional alert advance from typing or touch/Tab completion. Filled steps skip; backspacing restores a missing step and blocks Send rather than accepting parser defaults. Expense amount/description/category/subcategory use existing local inference; "I paid for event 5$" remains Expense. Close/Escape preserves text and suppresses suggestions. Shopping previews chats, then groups; Enter adds another item and Send submits the lines. Source-owned execution, artifacts, Undo and recurrence handoff remain intact.
- **Incidental defect fixed:** A successful budget draft's Change handoff previously outranked its `drafted` outcome, suppressing Undo. The receipt now remains drafted while retaining Change; tested through the actual shared turn hook.
- **Evidence (2026-10-12):** `pnpm vitest run src/features/era tests/era-gym src/lib/items src/app/api/items/route.test.ts` — 43 files passed, 654 tests passed, 13 existing recorded-model cases skipped; no paid calls. Local parser/source/turn tests cover ambiguous words, edited values, currency units, list/group revalidation, No alert, artifacts/inverses, stale pending turns, no model escalation and duplicate-submit fencing. Source alert suppression is exercised against the actual migration in isolated PGlite. Typecheck, changed-file ESLint, docs check, PM lint/check-docs and diff whitespace check pass. PM archive swept only HUB-112. Browser/device acceptance remains pending.
- **Earlier revision evidence (2026-10-12):** 5 focused files / 51 tests passed for progressive typing/backspacing, missing title/date/time guards, partial-word completion without duplication, date/time replacement, ambiguous Expense wording and shopping group progression. The owner then rejected the rail's shapes, scrollbars, clipped choices and mixed action labels in mobile screenshots. This receipt proves earlier behavior only; it does not certify the chatbot refactor's presentation.
- **Screenshot root cause (2026-10-12):** `Remind me today at 5pm` should ask for a title. The prefix's optional ` to` lacked a word boundary, consumed the first letters of `today`, and seeded “Day” as a title, allowing the wrong Alert step. The capture prefix now matches whole filler words; the exact screenshot sentence is covered by the revision tests below.
- **Chatbot refactor verification (2026-10-12):** Six focused files / 70 tests pass, covering the native parser/progression/source/turn path and server-rendering the real `CommandBar`. Regressions cover the screenshot's missing title, one form/textarea, no mixed action tabs, natural “Today at 5 PM,” full long list names with previews moved to the sheet, multiline input, typed No alert, polite lead-ins, location-only title, priority phrases and midnight defaults. Changing shopping threads deletes the prior group choice rather than silently choosing General. Final typecheck, changed-file ESLint, docs check, PM lint/check-docs and diff whitespace check pass; PM archive had nothing to sweep. PM lint retains only the pre-existing Delivery empty-Next warning. No horizontal overflow/truncation classes remain in the helper. Shell/drawer follow measured composer height and `visualViewport` size/keyboard bottom; the conversation follows container resize. Structural render tests do not prove device layout. CUA again returned `apps: []`, `browsers: []`; creating Chrome was rejected with `Browser not available: chrome`, so mobile screenshots and actual touch/keyboard behavior could not be observed. No new production, notification or paid-model witness is claimed.
- **Known parser follow-up:** Shared parsing still has a precedence edge for “tonight at 9pm.” Preserve explicit clock time over the evening default in that existing parser with a narrow regression; this refactor does not certify the phrase or create a second parsing engine.
- **ERA atmosphere refinement (2026-10-12):** The owner accepted the cleaner chatbot layout and requested personal assistant styling. Reused the miniature ERAMark, module-colored rim/halo, faint surface stars, tonal suggestion chips, accent Send and tinted completion with brief step transitions. Kept full labels, wrapping, neutral sentence text, opaque surfaces and the existing native pipeline. Frost accents darken for contrast; reduced-motion preferences disable the new decoration and miniature mark motion. Typecheck, changed-file ESLint and the four real composer render tests pass; visual/mobile acceptance of this styling is pending.
- **Owner acceptance:** At 390 px in two themes, type naturally in both composers; confirm one calm surface, only the next question, fully visible wrapped choice names, natural date/time wording and action-specific identity. Open More/Details and ellipsis correction sheets; verify they close with the drawer and preserve the sentence. Touch/Tab completion keeps typing focus, editing/backspacing recomputes the step, and dismissal preserves text. Exercise shopping multiline Send and source Undo. No visual, live notification or production acceptance is claimed. Earlier SCH-24 owner SQL remains a source dependency.

### HUB-94

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h06--create-a-placecontact-use-the-place-and-open-its-artifact>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA asks where an event happens and learns your places.

**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** src/features/era/intents/eventText.ts, src/features/era/intents/freeTextAnswer.ts, src/features/era/intents/resolvers/events.ts, src/features/era/intents/resolvers/places.ts, src/features/era/intents/{schedule,brain,chef,index,resolveIntent}.ts, src/features/era/intents/resolvers/{slots,slotBuilders,routeWrite}.ts, src/features/era/{types,engine,useEraTurn,replyFormatter,reach}.ts, src/lib/era/artifacts.ts, src/lib/smartTextParser.ts (two exports), src/app/api/catalogue/modules/route.ts (`settings_json` on POST), src/components/web/WebCatalogue.tsx (`map-pin` icon)

- **Acceptance:** "Add an event dinner tomorrow at 8pm" creates the event with Undo, then asks **Where?** with chips for up to 3 saved places (pinned first) plus [Skip]. A typed new place is set on the event, then ERA asks `Save "<place>" to Places?` [Save] [No]. With no date, ERA asks **When?** [Today] [Tomorrow] and writes nothing until it has one. A saved place or alias tag named in the sentence ("dinner at parents") fills the location with no question. "Add X as a location" saves a place (HUB-88). Repeating events hand off to the form. Every write leaves an Artifact (`event`, `place`, `catalogue_module`). A free-text answer that is really a new command is routed as a new request.
- **Evidence (2026-10-04):** `pnpm vitest run tests/era-gym src/features/era src/lib/era` gave 478 passed. The Gym router path went from 169/189 to 179/199: all 10 new `reports.jsonl` cases pass (HUB-88 ×3, HUB-94 ×7, including both negated twins and the "new request while Where? is open" case). The known-miss list is unchanged (20), with wrong effects 1 and wrong money 0, both as before. `eventText.test.ts` (title/place/date split, place matching) and 4 new artifact-contract rows pass. Typecheck is clean.
- **Owner check (phone):** "Add an event dinner tomorrow at 8pm" → Where? → type a place → Save → Catalogue shows **Places** with it. Then "add an event lunch at <that place> Friday at 1pm" sets the place with no question. Artifacts open the event and the place. The `place`/`event` artifacts need HUB-91's migration first.
- **Reading guide:** `src/features/era/intents/eventText.ts` (sentence → title/place/when) → `resolvers/events.ts` (write, then ask) → `resolvers/places.ts` (Places module, matching, save) → `resolvers/slots.ts` (answers).

### HUB-93

**Outcome:** ERA gets "Add Racha as a Contact" right.

**Kind:** bug
**Source:** ERA report 6e4bfd59-7aec-461c-90c2-43fc4dafe210 · wrong · owner · 2026-10-04 15:34 (Asia/Beirut)

- **Acceptance:** This request ends in the right outcome — done with Undo, one confirm card, one question with chips, a prefilled form, or an honest limit with a door — never a wrong action or a dead end. An ERA Gym case replays the transcript below.
- **Comment:** Adding Racha as a Contact should request me to fill more info. So the form for creating a Contact should fire to prompt me into adding more details
- **Reading guide:** start at `src/features/era/useEraTurn.ts` (one turn), then the router in `src/features/era/intents/` and the capability's resolver; add the sentence to `tests/era-gym/`.
- **Implementation:** done (2026-11-25). A plain add of a new contact saves nothing: ERA replies "New contact · Racha" with an Open door to `/catalogue?newContact=Racha`, where the contact form opens prefilled, Category picker included (`contacts.ts#resolveAddContact`, `WebCatalogue.tsx`, `CatalogueItemDialog.tsx#initialName`). Ported from the Local candidate `5dcada5e` (run `local-15f95526`) into the HUB-123 work, which collided with it in five files; that run is superseded, Discard it. An add naming a category ("add Racha to Family") or an existing contact keeps HUB-123's path. Gym `report-hub-89`/`-b`/`-c` and `report-hub-93` expect `handed_off`; contract test "a plain add opens the prefilled form and saves nothing".
- **UAT:** pending. Owner: "Add Rana as a contact" → Open → the form shows Rana; Cancel leaves no contact.

**Transcript**

- You · 15:31 — Add Racha as a Contact _(addContact)_
- ERA · 15:31 — Added · Racha _(addContact · answered)_ ← reported

**ERA actions**

- created contact — Racha · 15:31

### HUB-91

**Outcome:** Run the era-artifacts migration and witness Artifacts + Activity Log links on the phone.

**Kind:** verification
**Depends on:** HUB-90
**Touches:** none

- **Acceptance:** Owner runs `migrations/2026-10-04_era-artifacts-any-entity.sql` in the Supabase SQL Editor; its verify query shows exactly `era_actions_action_check` (created/updated/deleted) and `era_actions_entity_type_check` (slug). Then on the phone: "Add <name> as a contact" → the contact appears in /era → Artifacts as "Contact" and opens its detail; the Activity Log's "Added · <name>" row Open lands on the same detail; Undo removes the contact.
- **Why it blocks:** until the migration runs, the DB rejects artifacts for the new entities (contact, draft, shopping_item, shopping_group, recurring_payment) and every `deleted` row — they are logged server-side and never appear.

### HUB-92

**Outcome:** ERA artifacts for every entity open the exact item.

**Kind:** feature
**Depends on:** HUB-90
**Touches:** src/lib/era/artifacts.ts

- **Acceptance:** Transfer, debt, draft, meal plan, memory, recurring payment and shopping artifacts each open their own row (detail, highlight or scroll-to) via a page URL parameter; the registry row switches from the module home to that URL; `src/lib/era/artifacts.test.ts` covers each.

### HUB-87

**Outcome:** ERA handles "Add Mop Chores today".

**Kind:** bug
**Source:** ERA report 747f8f21-6e74-4e8f-8ee8-992c928ac19e · missed · owner · 2026-10-03 18:10 (Asia/Beirut)

- **Acceptance:** This request ends in the right outcome — done with Undo, one confirm card, one question with chips, a prefilled form, or an honest limit with a door — never a wrong action or a dead end. An ERA Gym case replays the transcript below.
- **Expected:** It should have added Mop Chores today and/or ask me for the time i want to add it, and how is responsible of it
- **Reading guide:** start at `src/features/era/useEraTurn.ts` (one turn), then the router in `src/features/era/intents/` and the capability's resolver; add the sentence to `tests/era-gym/`.

**Transcript**

- You · 18:09 — Add Mop Chores today _(navigate)_
- ERA · 18:09 — Chores _(navigate · handed\_off)_ ← reported

### HUB-83

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h08--conversation-new-chat-history-and-report>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** The lexicon table exists in production and today's ERA flows are witnessed on both phones.

- **Acceptance (owner):**
  - Run `migrations/2026-09-27_era-lexicon.sql` in the Supabase SQL Editor and paste its two verify queries' output.
  - On each phone after deploy: `I took 300$ from Drawer` → chips → Wallet → Confirm → Undo restores; `Don't transfer…` does nothing; `move the dentist to Friday` (a real reminder name); `taxi 250k` → Open → form prefilled; `mark internet as paid` (or a real recurring name); `add milk to the shopping list`; the "Always" toggle after choosing the same destination twice; `Add salt to my shopping list` → `make it under Spinneys` (and Undo); `spent 12$ on coffee` → `no, 15`.
  - ERA chat (HUB-85/86/52), phone and desktop: send a sentence ERA can't handle → Report chip → Missed + a note → Send → "Reported" shows; Undo removes it; send it again and keep it, then within ~5 min with `pnpm pm` + bridge running the item appears in Hub & ERA › Now and on Sprints › Hotfixes. Tap New chat → the DOT returns to centre and `move it to 5 PM` no longer targets the earlier reminder. History → pick an old chat → Continue → it becomes the thread; Archive → Undo restores it. Leave a chat 30 min → the divider and the toolbar dot appear.
- **Why an ID:** D12 — applied SQL and device acceptance stay distinct from implementation history.

### HUB-79

**Outcome:** ERA reaches every Budget, Schedule and Kitchen operation family, and completes the ten most frequent inline.

- **Acceptance:**
  - Families are ordered by the HUB-77 export frequency. Every family reaches at least useful prefill, and the top 10 complete inline through source-owned adapters.
  - It delivers the chat side of HUB-22 (debt settle; recurring covered, which separates *link existing* from *create then link*) and HUB-6 (split), whose acceptance stays with their IDs.
  - Skip and pause go through Schedule's occurrence contract (`recurrence-safety`).
  - Shopping and pantry additions happen only on an explicit request; DEC-03 governs automatic ones.
  - Every money family carries a `money-rules` worked example and a test.
  - Production AI caps change only through HUB-44.
- **Gate:**
  - held-out correctness at least 75% (only if route C was adopted)
  - zero wrong money effects
  - reach matrix recorded
- **Depends:** HUB-78; HUB-44 for cap changes.
- **Status 2026-09-27 — most families done; two blocked.**
  - Done (repository): top-10 by export frequency complete inline; plus `spend.day` (today / yesterday / this week), `balance.read`, `time.now`, `reminder.skip` (occurrence exception, Confirm), `recurring.cover` (links an existing transaction behind a re-checked Confirm card with Undo; no match → `/expense` prefilled), income → `/expense` on the default income account and split → `/expense` with the Split toggle on (owner decisions 2026-09-27), long amount-first captures, bare trailing amounts on Budget, greetings, bare dish names on Chef. Gate: zero non-gap wrong money effects; reach matrix recorded (`ERA Reach Matrix.md`); the 75% gate does not apply (route C not adopted).
  - Blocked: debt settle waits on BUD-68 (debt reads mutate); pantry/stock reads wait on KIT-1/KIT-2; recurring **add** from chat not built. Found BUD-85 (mark-covered advances on every call).

### HUB-81

**Outcome:** Every Feature Index module is reachable from ERA, and two named cross-module workflows report per-step outcomes.

- **Acceptance:**
  - A reach matrix (navigation, useful prefill, inline, verified final state) is generated from the registry.
  - Every module reaches at least navigation, and at least useful prefill where a form exists.
  - Reads cover Trips, Healthcare (after HLTH-25), Catalogue (HUB-69), Chores, NFC history, Activity and Future Purchases.
  - Workflows:
    - Meal + shopping: unknown stock stays unknown and partial results are reported honestly. Depends on KIT-1/KIT-2 contracts.
    - Trip departure preparation: depends on TRIP-1–3 and DEC-04.
  - Page context acts as a ranking signal only.
- **Gate:** held-out correctness at least 90%.
- **Depends:** HUB-79.
- **Status 2026-09-27 — navigation floor reached; reads and workflows partly blocked.** `src/features/era/reach.ts` is the registry; `reach.test.ts` checks every Feature Index module has a row and regenerates the vault `ERA Reach Matrix.md`. Every owner-facing module reaches navigation through "open X" (explicit) or implicit doors from real usage (Outfits, Trips, wishlist, meds, chores, pantry); Guest Portal and Sync & Offline are n/a with reasons. New reads: household activity (needs HUB-72's SQL) and future purchases. Blocked: Trips reads (TRIP-1–3), Healthcare (HLTH-25), Catalogue search (HUB-69 ← KIT-20/22), meal+shopping workflow (KIT-1/2), trip departure workflow (TRIP-1–3, DEC-04). Page-context ranking not built (ERA runs from `/era`; faces already rank). The 90% gate is for route C, not adopted.

### HUB-82

**Outcome:** One interpretation path serves typed, voice and Hub message input.

- **Acceptance:**
  - Voice turns (HUB-16) and Hub message conversion route through the engine.
  - The legacy voice `intentClassifier` is removed after parity, keeping greeting variants (D10/D16).
  - `/api/ai-chat` retires after HUB-48 parity.
  - `vocab.ts`/`missTracking.ts` are replaced by outcome telemetry.
  - A grep verification shows a single router.
- **Depends:** HUB-78, HUB-16, HUB-48.
- **Status 2026-09-27 — voice unified; two paths left.** Typed ERA, ERA voice and Hub `/chat` voice now share `runTurn` (one router, one set of resolvers, model on misses via `/api/era/ask`); `intentClassifier.ts`, the five Hub voice callbacks and the voice `/api/ai-chat/stream` path are deleted; spoken yes/no answers a confirm card. Grep (2026-09-27): zero `intentClassifier`/`classifyIntent` references. Left: Hub long-press conversion prefill still categorizes through `messageTransactionParser` (kept — the partner's daily Hub captures; unify only with evidence), the floating `/api/ai-chat` assistant (HUB-48), and `vocab.ts`/`missTracking.ts` still gate escalation (outcome telemetry is now recorded on every turn but not yet the gate).

### HUB-62

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C00. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Record current schema and application evidence.

- **Acceptance:** E-00 and Catalogue C00: owner supplies current DB snapshot, migration application and household/role witnesses for the selected slices. DEC-18 resolves household_members retain/drop. Written SQL and schema.sql are not deployment proof; agents do not apply migrations.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner-supplied DB evidence; agents do not apply migrations (Hard Rule #26). **Read `migrations/db-state.json` first** — per Hard Rule #27 it is the only repo artifact that is evidence about RLS, policies, cascades, triggers and SECURITY DEFINER bodies; written SQL and `migrations/schema.sql` are not deployment proof. DEC-18 (`household_members` retain/drop) must be recorded in `_Decisions.md` before anything acts on it; the live household mechanism in code is `household_links` + `profiles` (Hard Rule #13, canonical usage in `src/app/api/accounts/route.ts`), so confirm which of the two the DB actually has. This gates KIT-18 and several Catalogue slices.

**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Run `pnpm db:verify-rls` against the owner-refreshed snapshot; record generated_at, application receipts and the selected household/role cases. A passing snapshot validator is not application or device proof.

```delivery-plan-v1
{
  "outcome": "A dated schema/application evidence packet identifies which selected slices can safely proceed.",
  "acceptance": [
    "Record current owner-supplied catalogue metadata and migration receipts for each selected slice.",
    "Record DEC-18 retain/drop only after deployed household_members use is established; no table is changed by this investigation."
  ],
  "scope": [],
  "steps": [
    "Start with migrations/db-state.json and Catalogue C00; list only missing evidence needed by the selected slices.",
    "Ask the owner for a refreshed untruncated snapshot and application receipts; the checked-in snapshot was generated 2026-08-04.",
    "Compare observed policies, RPCs and relationships with the selected migration contracts; distinguish absent, present and unverified.",
    "Record role witnesses and the DEC-18 decision in their canonical homes; hand any necessary reviewed SQL to the owner separately."
  ],
  "invariants": [
    "Schema files and migration existence do not establish deployment.",
    "Table existence alone does not authorize household_members removal.",
    "Agents neither query nor modify production outside the permitted PM bridge scope."
  ],
  "exclusions": [
    "Applying SQL, deleting household structures, repairing production data or certifying every module."
  ],
  "risks": [
    "A stale snapshot can make a correct-looking route appear authorized."
  ],
  "unknowns": [
    "Current deployment/application evidence and actual household_members use require the owner."
  ],
  "dependencies": [
    "DEC-18"
  ],
  "risk": "high",
  "provenance": "2026-09-26: read current acceptance, Catalogue C00 reference and parsed db-state generated_at (2026-08-04T10:06:44Z). Planning only; no current DB witness.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-37

**Outcome:** Verify CI and recoverable capture failures.

- **Acceptance:** CI runs typecheck/test/lint on push and PR; ERA preserves recoverable input on rejected capture and distinguishes offline, timeout and uncertain results. HEAD is already committed; no git write is part of this packet.
- **Status 2026-09-27 — repository complete; first CI run pending (owner push).** `.github/workflows/ci.yml` runs typecheck, lint, tests (incl. the ERA Gym replay — no model calls), `pm:lint` and `docs:check` on push to main and on PRs; full lint has 0 errors on a clean checkout (the one local error lives in git-ignored `.tmp/`). Capture: a draft refused before sending (offline) keeps its text in the command bar (`keepInput`); a timeout after sending is `uncertain` ("Not sure it saved. Check Drafts."), never restored or retried; money POSTs already report uncertain (HUB-76). Test: `src/features/era/engine.test.ts`.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two halves. **CI does not exist for this**: `.github/workflows/` contains only `check-docs-sync.yml` (verified 2026-09-20) — there is no typecheck/test/lint workflow, so that is net-new. The commands it must run are the repo's own (`pnpm typecheck`, `pnpm lint`, `pnpm test`) plus `pnpm pm:lint` and `pnpm docs:check`, which pre-commit already runs (`.claude/hooks/pre-commit.sh`). The capture half is about `safeFetch` classification: read `src/lib/safeFetch.ts` and `src/lib/connectivityManager.ts` (`isReallyOnline`) — a timeout is *not* offline (Hard Rule #6), and the three states the acceptance wants distinguished are exactly offline / timeout / uncertain. Capture entry points: `src/components/era/CommandBar.tsx` and `src/features/era/useEraTurn.ts` (`runTurn`). "No git write is part of this packet."

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** First run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm pm:lint`, `pnpm docs:check`; use `pnpm exec vitest run src/lib/safeFetch.test.ts src/lib/connectivityManager.test.ts` for classification. Add proposed capture fixtures for rejection, timeout-after-send and caller abort; verify retained text without a second write.

```delivery-plan-v1
{
  "outcome": "CI checks each push/PR and rejected captures retain recoverable input with truthful failure states.",
  "acceptance": [
    "CI runs the repository's typecheck, lint and test commands on push and PR.",
    "Offline, endpoint timeout and uncertain write results remain distinguishable; original input stays recoverable."
  ],
  "scope": [
    ".github/workflows",
    "src/components/era/CommandBar.tsx",
    "src/features/era/useEraTurn.ts",
    "src/lib/safeFetch.test.ts"
  ],
  "steps": [
    "Dispatch the CI sheet first: reuse package versions and lockfile installation, then add a proposed checks workflow alongside docs sync.",
    "Dispatch capture recovery separately: trace CommandBar clearing input and useEraTurn swallowing resolver errors; return an explicit outcome rather than infer success from reply text.",
    "Retain the submitted text and distinguish rejected, queued and uncertain results; offer existing recovery affordances without automatically resending an uncertain write.",
    "Exercise the actual submit path with injected failures and preserve optimistic transcript ordering."
  ],
  "invariants": [
    "Timeout is not offline; caller abort cannot enqueue a mutation.",
    "A plausible error reply is not a successful capture.",
    "No commit, reset or other git write is part of the packet."
  ],
  "exclusions": [
    "Durable queue/idempotency implementation owned by HUB-46; broad ERA layout changes."
  ],
  "risks": [
    "Clearing the composer before a resolver fails can lose the only recoverable input."
  ],
  "unknowns": [
    "Current full-suite failures must be recorded before deciding whether CI requires a separate repair."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 source review: CommandBar.tsx:95-111, useEraTurn.ts:130-264, safeFetch.test.ts:34-96; only check-docs-sync.yml currently exists. No runtime test executed by this planning pass.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-38

**Outcome:** Record authenticated cadence-aware cron liveness.

- **Acceptance:** Owner-verified cron ledger and six wrappers provide authenticated cadence-aware liveness; record APPLIED migrations separately. E-02a follows ledger implementation. Cron logging reconciliation remains held under NOTIF-5.4; this packet waives neither applicable rule.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** There is no cron ledger today — grep for `cron_runs`/`last_run` under `src/app/api/cron/` returns nothing (verified 2026-09-20). The six routes are `chat-notifications`, `daily-items-reminder`, `daily-reminder`, `gcal-reconcile`, `item-reminders`, `purge-recycle-bin`; each already has the `Bearer CRON_SECRET` check, `supabaseAdmin()` and `maxDuration = 60` per Hard Rule #8 — read one (`src/app/api/cron/gcal-reconcile/route.ts`) as the wrapper template. The liveness problem is structural: there is no `vercel.json`, so nothing proves a cron ran; a ledger row written by each wrapper is what makes "how do I know it ran" answerable. Cadence-aware means the ledger records expected versus observed interval. A ledger table is a migration (Hard Rules #24/#26/#27 — policy in the same migration). Cron *logging* stays held under NOTIF-5.4; this packet waives nothing.

**Execution plan — 2026-09-26**

**Readiness:** investigation first; instrumentation held on DEC-06.

**Verify:** Proposed isolated wrapper fixtures: missing/wrong secret, successful/failed/empty runs, missing job, late cadence and concurrent invocation. Run `pnpm typecheck` and `pnpm lint`; owner verifies scheduler calls plus dated ledger observations after manual application.

```delivery-plan-v1
{
  "outcome": "Each of the six authenticated jobs exposes a truthful, cadence-aware run record.",
  "acceptance": [
    "All six wrappers record start, finish and outcome without treating an empty successful scan as a missing run.",
    "Expected cadence is compared with observed execution; applied migration and scheduler/device evidence remain separate."
  ],
  "scope": [
    "src/app/api/cron",
    "migrations/schema.sql"
  ],
  "steps": [
    "Inventory the actual per-job cadence and draft the ledger contract; resolve DEC-06 before adding runtime instrumentation.",
    "Define the smallest shared ledger/wrapper contract with a proposed migration and helper; read current schema before choosing names and include access policy.",
    "After the diagnostic decision, wrap chat-notifications, daily-items-reminder, daily-reminder, gcal-reconcile, item-reminders and purge-recycle-bin without changing their business actions.",
    "Add cadence-aware health calculation and isolated failure fixtures; hand SQL and scheduler verification steps to the owner."
  ],
  "invariants": [
    "Unauthorized requests never start a job or write a successful ledger result.",
    "A last_synced_at item stamp is not proof every cron ran.",
    "Bearer validation, admin client and execution limit survive wrapping."
  ],
  "exclusions": [
    "Changing job frequency, enabling briefing delivery, resolving policy by silently adding or removing console logs."
  ],
  "risks": [
    "A wrapper that records success before awaited work settles hides real failures."
  ],
  "unknowns": [
    "DEC-06 resolution, deployed ledger state and actual external schedules."
  ],
  "dependencies": [
    "HUB-62",
    "DEC-06"
  ],
  "risk": "high",
  "provenance": "2026-09-26: six route auth/admin/maxDuration declarations inspected; no cron_runs/last_run matches in their directory. gcal-reconcile:9-10 only cites per-item sync stamps. No runtime liveness witness.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-39

**Outcome:** Configure eligible local-time scheduling.

- **Acceptance:** Owner configures the existing scheduler-of-record plan with polling and IANA local-date eligibility; DST and duplicate ticks are verified. The briefing slot stays inactive until recipient policy and owner-recorded C01 eligible-hour/C03 partner-sequencing decisions are satisfied.
- **Depends on:** [HUB-38](<Hub & ERA — Master Book.md#hub-38>), [NOTIF-19](<../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-19>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner configuration on top of HUB-38's ledger, gated also on NOTIF-19's recipient policy. The scheduling primitives to reuse rather than reinvent: `src/lib/utils/date.ts` for IANA-local-date handling and `startOfCustomMonth`, plus `.claude/skills/timezone-handling/SKILL.md` — DST is the named risk and a polled scheduler makes duplicate ticks the second one, so eligibility must be idempotent per local date, not per invocation. The briefing slot stays inactive until DEC-C01 (eligible hour) and DEC-C03 (partner sequencing) are recorded. Delivery target is HUB-42's stored briefing.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft; owner activation held on DEC-01.

**Verify:** Proposed eligibility fixtures cover Beirut DST, repeated polling, missed tick, local-date rollover, mute and each recipient's hour. Owner records pg_cron/pg_net configuration and observed authenticated calls; a cron expression alone cannot pass.

```delivery-plan-v1
{
  "outcome": "The existing scheduler selects each recipient's eligible local date/time without duplicate briefing ticks.",
  "acceptance": [
    "Use the accepted Supabase pg_cron/pg_net scheduler-of-record and IANA local time.",
    "Keep briefing activation disabled until DEC-01 and recipient-policy prerequisites pass."
  ],
  "scope": [
    "src/app/api/cron",
    "src/lib/utils/date.ts"
  ],
  "steps": [
    "Read HUB-38's ledger and NOTIF-19's policy contract; implement eligibility against explicit recipient configuration while DEC-01 remains an activation gate.",
    "Specify polling and a pure local-date eligibility function; reuse existing date utilities instead of fixed UTC offsets or an invented default briefing hour.",
    "Integrate eligibility with the future HUB-42 claim identity, so repeat ticks select the same recipient/day operation.",
    "Prepare the owner-run scheduler configuration with activation disabled; after DEC-01 resolution, owner supplies the configured hour and observed-run evidence."
  ],
  "invariants": [
    "21:00–08:00 quiet policy is not bypassed by the old 07:15 target.",
    "A new scheduler or second briefing claim mechanism is not introduced.",
    "The partner's own toggle/hour remain required."
  ],
  "exclusions": [
    "Enabling pg_cron, applying SQL or delivering actual briefings during implementation."
  ],
  "risks": [
    "Fixed UTC conversion silently shifts behavior at DST boundaries."
  ],
  "unknowns": [
    "DEC-01 resolution and owner scheduler credentials/configuration."
  ],
  "dependencies": [
    "HUB-38",
    "NOTIF-19",
    "DEC-01"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points are revalidation targets, not runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-40

**Outcome:** Complete the assistant treaty and verified retirement.

- **Acceptance:** Retain the M-00 treaty: ERA owns general conversation, Chef keeps Kitchen specialty, Brain keeps bounded memory, and the floating assistant retires only after its report is reachable. Remove only source-proven dead routes/helpers; no ERA layout redesign. Historical manifest/line counts are evidence cutoffs, not acceptance thresholds. Existing plan supersession is complete.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A boundary treaty plus a narrow deletion, with two explicit prohibitions: no ERA layout redesign, and remove only *source-proven* dead routes/helpers. The four parties are real code: ERA general conversation (`src/app/api/era/ask/route.ts`, `src/features/era/intentRouter.ts`, `src/features/era/intents/`), Chef (`src/features/era/intents/chef.ts` + `resolvers/chef.ts` + `formatters/chef.ts`), Brain (`intents/brain.ts`, `src/features/era/focusMemory.ts`), and the floating assistant `src/components/ai/AIChatAssistant.tsx` (lazy-loaded via `src/components/DeferredComponents.tsx`) over `src/app/api/ai-chat/`. The assistant retires only once its report is reachable from ERA — that is HUB-48's `analysis.report` capability, so sequence after it. Historical line counts are evidence cutoffs, not thresholds.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Use targeted `rg` for every proposed deleted export, route and report-history consumer; run `pnpm typecheck`, `pnpm lint` and the affected ERA resolver/capability tests. Owner checks the report/history door before retiring its old surface.

```delivery-plan-v1
{
  "outcome": "ERA, Chef and Brain have one explicit responsibility treaty and obsolete surfaces retire only after replacement parity.",
  "acceptance": [
    "ERA owns general interaction; Chef keeps Kitchen specialty and Brain bounded memory.",
    "Report and history stay reachable from ERA before floating assistant removal; delete only source-proven dead code."
  ],
  "scope": [
    "src/components/ai/AIChatAssistant.tsx",
    "src/components/DeferredComponents.tsx",
    "src/app/api/ai-chat",
    "src/features/era"
  ],
  "steps": [
    "Write a compact ownership/call-site matrix from current imports and routes, including report history, Focus insights and the memory stub.",
    "Separate the treaty inventory from the retirement sheet; preserve any live telemetry or analysis-history dependency.",
    "Wait for HUB-48 report/history reachability, then re-run importer checks and delete only the proven retired surface/helpers.",
    "For Focus-insights retirement, use HUB-42 replacement evidence and a separately reviewed owner-run SQL handoff where needed."
  ],
  "invariants": [
    "Existing ERA layout is frozen; no orb/widget/navigation redesign.",
    "era_* remains the assistant store; ai_* history/telemetry is preserved.",
    "Historical line counts are not a deletion target."
  ],
  "exclusions": [
    "Building HUB-48 inside this item, a new memory engine or broad HubPage extraction."
  ],
  "risks": [
    "Deleting a route because its visible component retired can orphan persisted report history."
  ],
  "unknowns": [
    "HUB-48 is currently Later; retirement cannot complete while that dependency remains unavailable."
  ],
  "dependencies": [
    "HUB-48",
    "HUB-42"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points are revalidation targets, not runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-41

- **Retained campaign gate (D3):** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only). *(→ HUB-41/E-04, HUB-42/E-05)*

**Outcome:** Build signals with coverage and provenance.

- **Acceptance:** Signals distinguish complete, partial and unavailable facts with provenance. Reuse canonical Schedule/Budget inputs; BUD-66 and the Schedule day-adapter/parity prerequisites must pass before their summaries are certified. Existing recurring-dues/overdraw scope remains.
- **Depends on:** [BUD-66](<../Budget/Budget — Master Book.md#bud-66>), [SCH-8](<../Schedule/Schedule — Master Book.md#sch-8>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on BUD-66 and SCH-8 — the acceptance says their summaries are not certified until those pass, so build the provenance machinery now and mark the money/schedule signals uncertified until then. The three-state vocabulary (complete / partial / unavailable) is the same distinction HLTH-21 and KIT-4 are making, and it is the opposite of defaulting to an empty array. Canonical inputs: money via `src/lib/balance-utils.ts` and `startOfCustomMonth` in `src/lib/utils/date.ts`; schedule via the single expansion engine SCH-4.3b is landing. The ERA read side is `src/features/era/intents/resolvers/` (`budget.ts`, `schedule.ts`) with formatters alongside. Existing recurring-dues/overdraw scope stays as-is. Feeds HUB-42, HUB-54, HUB-56.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend existing `src/features/era/intents/resolveIntent.test.ts` after revalidation; test complete, partial and unavailable inputs, no zero/default on read failure, source IDs/timestamps and certified Schedule/Budget parity. Run `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "ERA signals carry trustworthy facts, source provenance and explicit coverage.",
  "acceptance": [
    "Signals preserve complete/partial/unavailable status and enough source identity to verify each fact.",
    "Budget and Schedule summaries are certified only after BUD-66 and SCH-8; existing recurring-dues/overdraw scope remains."
  ],
  "scope": [
    "src/features/era/intents/resolvers",
    "src/features/era/intents/formatters",
    "src/features/era/intents/resolveIntent.test.ts"
  ],
  "steps": [
    "Revalidate the current Budget/Schedule read contracts and prerequisite evidence; define one bounded typed signal envelope.",
    "Adapt canonical facts into that envelope with provenance, scope and coverage instead of querying or expanding independently.",
    "Keep uncertified/failed inputs partial or unavailable; compose deterministic descriptions without invented empty-state claims.",
    "Compare known fixtures with the owning module's displayed facts, including recurrence dues and overdraw, before enabling briefing consumption."
  ],
  "invariants": [
    "No second balance calculator, billing-period helper or occurrence expansion engine.",
    "Unavailable is not zero, empty or proof there is nothing to do.",
    "Read adapters do not mutate domain data."
  ],
  "exclusions": [
    "Full financial forecast BUD-4, model-written phrasing or additional module signals HUB-56."
  ],
  "risks": [
    "Correct-looking prose can hide partial source coverage or private household facts."
  ],
  "unknowns": [
    "Prerequisite acceptance and exact current day-adapter contract must be rechecked at dispatch."
  ],
  "dependencies": [
    "BUD-66",
    "SCH-8"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points are revalidation targets, not runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-42

- **Retained campaign gate (D5):** *(new 2026-09-02)* ERA has spoken first for 5 consecutive mornings (Speaks-First Ratio ≥ 5/7) — the plan's own G1 gate, Oct 12.

- **Retained campaign gate (D3):** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only). *(→ HUB-41/E-04, HUB-42/E-05)*

**Outcome:** Deliver one stored briefing per eligible recipient day.

- **Acceptance:** Deterministic stored briefing delivers once per eligible local date and recipient, with verified identity/claim and recipient hour/toggle policy. Activate only at an owner-resolved eligible hour; D5 stays binding. Composition and focus-insights retirement remain parent obligations.
- **Depends on:** [HUB-39](<Hub & ERA — Master Book.md#hub-39>), [HUB-41](<Hub & ERA — Master Book.md#hub-41>), [NOTIF-19](<../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-19>), [NOTIF-21](<../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-21>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The most gated item here: HUB-39, HUB-41, NOTIF-19 and NOTIF-21 all precede it, and it activates only at an owner-resolved hour. "Once per eligible local date and recipient" is an exactly-once problem, not a scheduling one — read `.claude/skills/recurrence-safety/SKILL.md` for the claim/idempotence discipline and NOTIF-21 for the durable per-recipient claim it must share rather than duplicate. Local-date eligibility comes from HUB-39; the delivery path is `src/lib/pushSender.ts` under NOTIF-19's policy. Storage is a new briefing table (Hard Rules #24/#26/#27). The AI Assistant vault doc has a Focus-briefing cache hard rule — read `ERA Notes/03 - Junction Modules/AI Assistant/` before caching anything.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed fixtures cover deterministic composition, concurrent ticks, same recipient/date replay, two recipients, DST and failed/uncertain delivery. Owner records five consecutive eligible delivered mornings and SFR₇ evidence; cron success alone is insufficient.

```delivery-plan-v1
{
  "outcome": "Each eligible recipient receives one stored deterministic briefing for their local day.",
  "acceptance": [
    "Storage and claim identity are recipient/local-date based and use verified household identity.",
    "Composition, recoverable delivery and Focus-insights retirement remain parent obligations; D5 is evidenced separately."
  ],
  "scope": [
    "src/app/api/cron",
    "src/features/era",
    "src/lib/pushSender.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "After schema and policy gates, dispatch storage/identity first: propose one migration with atomic recipient/day uniqueness and permitted reads.",
    "Compose typed HUB-41 signals deterministically and persist the result before requesting delivery.",
    "Use NOTIF-21's claim/recovery and NOTIF-19's policy; expose failed/uncertain outcomes without silently creating another briefing.",
    "Dispatch activation and Focus replacement/retirement separately; owner confirms DEC-01 hour, recipient opt-ins and real delivery evidence."
  ],
  "invariants": [
    "Retry reuses the same stored briefing and recipient/day identity.",
    "SDK acceptance, phone delivery and attention remain distinct observations.",
    "No optional model phrasing before truthful HUB-44 attribution and explicit allowance."
  ],
  "exclusions": [
    "A second notification recovery store, new assistant persistence or unrequested layout changes."
  ],
  "risks": [
    "An accepted push request does not prove exactly-once visible arrival."
  ],
  "unknowns": [
    "Current schema, DEC-01 and complete prerequisite evidence; Focus retirement needs its actual consumer inventory."
  ],
  "dependencies": [
    "HUB-62",
    "HUB-39",
    "HUB-41",
    "NOTIF-19",
    "NOTIF-21",
    "DEC-01"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points are revalidation targets, not runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-43

**Outcome:** Measure briefing feedback and vital signs.

- **Acceptance:** *(E-06)* Briefing feedback (👍/👎) + the "ERA vital signs" tile block (SFR₇, precision, cron liveness) in the Activity view.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Feedback plus a vital-signs tile block in the Activity view. The ERA action/outcome trail already exists: `src/features/era/logEraAction.ts` and `src/features/era/missTracking.ts` (with its test) are where SFR and precision would be computed from, and `src/app/api/era/actions/route.ts` is the write path — read those before adding a metric store. Cron liveness is HUB-38's ledger, so depend on it rather than inventing a second signal. Card/tile components: `src/components/era/dashboards/EraStatCard.tsx`. Charts follow the `dataviz` skill; Hard Rule #3 (no red on individual rows) and #28 (numbers and labels, no explanation).

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Proposed pure metric fixtures cover zero eligible days, seven-day boundary, no attention signal, explicit negative feedback and missing cron evidence. Revalidate existing `src/features/era/missTracking.test.ts`; run `pnpm typecheck` and `pnpm lint`; verify Activity at 390×844.

```delivery-plan-v1
{
  "outcome": "Activity shows explicit briefing feedback and honest ERA vital signs.",
  "acceptance": [
    "A stored briefing accepts attributable thumbs-up/down feedback.",
    "Activity reports SFR₇, precision and cron liveness with defined denominators and unavailable states."
  ],
  "scope": [
    "src/features/era",
    "src/app/api/era/actions/route.ts",
    "src/components/era/dashboards"
  ],
  "steps": [
    "Read the real HUB-42 delivery/eligibility records and HUB-38 ledger; define each metric's event source, denominator and time window.",
    "Add feedback keyed to the briefing/recipient with one current vote; use existing persistence where sufficient, proposing migration only for a verified gap.",
    "Compute bounded metrics deterministically and keep delivery, attention and accepted action separate.",
    "Add the small Activity tile block and feedback controls using existing cards; retain actual navigation doors."
  ],
  "invariants": [
    "A cron tick or created notification cannot count as a delivered briefing.",
    "No feedback is not positive feedback; zero denominator is not 100%.",
    "UI stays labels, numbers and compact actions."
  ],
  "exclusions": [
    "Feedback-weighted ranking HUB-23, model-generated metrics or a separate analytics dashboard."
  ],
  "risks": [
    "Reusing generic action success rows as delivery evidence inflates SFR or precision."
  ],
  "unknowns": [
    "Exact metric definitions and storage must be matched to accepted Top Layer evidence before implementation."
  ],
  "dependencies": [
    "HUB-38",
    "HUB-42"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points are revalidation targets, not runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-44

**Outcome:** Attribute model usage and enforce degradation controls.

- **Delivered slice — 2026-10-11 (HUB-108):** `/api/era/ask` records actual response model and complete provider token counts, including thought tokens; explicit estimated/unknown attribution replaces fabricated visible-text estimates. Missing monthly/auto quota data returns 503 before inference. This does not close per-attempt retry/fallback accounting, other AI consumers, asynchronous persistence gaps, atomic budget reservation, kill switches or the degradation matrix.

- **Acceptance:** Dispatch the M provider/model/usage-attribution sheet first, then the retained quota gauge, degradation matrix and `AI_MODEL`/`AI_FALLBACK_MODEL` pin/kill-switch obligations. One bounded child per session; E-07a alone does not close the parent. Must ship before new Gemini consumers (HUB-45).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Must ship before any new Gemini consumer, which explicitly includes HUB-45. The model layer is `src/lib/ai/gemini.ts` — `generateContentWithFallback()` with a fallback model on a separate quota bucket and daily-versus-per-minute 429 discrimination (`isDailyQuotaError`) — plus `src/lib/ai/rateLimit.ts` and `src/lib/ai/tokenUtils.ts`. The existing usage surface is the AI Usage module (`src/types/aiUsage.ts` and its page), which is deliberately outside the CLAUDE.md Feature Index. `AI_MODEL`/`AI_FALLBACK_MODEL` are env pins — see `docs/ENV.md`. The obligation is attribution per provider/model/call and an enforced degradation matrix, so read what is already recorded before adding fields. One bounded child per session; E-07a alone does not close the parent.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed injected-provider fixtures cover primary success, fallback success, per-minute/daily 429, disabled provider and missing usage. Run `pnpm typecheck`, `pnpm lint` and affected existing tests after inventory. No paid provider call is required to test control flow.

```delivery-plan-v1
{
  "outcome": "Every model call has truthful attribution and bounded degradation controls before ERA adds consumers.",
  "acceptance": [
    "Record actual provider/model/feature/usage first; retain unknown usage explicitly.",
    "Quota gauge, degradation matrix, environment pins and kill switches all pass before this parent closes."
  ],
  "scope": [
    "src/lib/ai/gemini.ts",
    "src/lib/ai/rateLimit.ts",
    "src/lib/ai/tokenUtils.ts",
    "src/types/aiUsage.ts",
    "docs/ENV.md"
  ],
  "steps": [
    "Inventory current call sites and recorded usage against source; dispatch the M attribution sheet alone first.",
    "Record the actual responding model, including fallback, and distinguish absent usage from zero.",
    "Dispatch quota/degradation controls next; map each failure class to the accepted deterministic fallback or refusal.",
    "Dispatch environment pin/kill-switch wiring and the existing usage surface; verify disabled providers cannot be called."
  ],
  "invariants": [
    "One bounded child per session; attribution alone does not complete the parent.",
    "Fallback attribution names the model actually used.",
    "No new Gemini consumer before the complete parent contract passes."
  ],
  "exclusions": [
    "Changing provider strategy, speculative new models, model-generated quota estimates or unrelated UI work."
  ],
  "risks": [
    "Configured model aliases can differ from the responding model and invalidate cost/quota claims."
  ],
  "unknowns": [
    "Current provider/model capabilities and rate limits require fresh official evidence if implementation relies on them."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points are revalidation targets, not runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-45

**Outcome:** Connect canonical balances and meal coverage to ERA.

- **Final-review evidence — 2026-10-11:** `fetchBudgetContext` uses calendar-month start and degrades failed account/dependent reads to empty/zero-shaped context, while the registered `spend.month` uses custom billing months. The Budget prompt also appends a legacy assistant persona/output contract to ERA. Acceptance must include non-first billing day, failed reads as unavailable rather than zero, and one consistent ERA prompt contract before broader financial reasoning. Source inspection only; no production balances were queried.

- **Acceptance:** ERA reads balances and scoped meal coverage and supplies bounded Chef/Brain context. Reuse the existing Chef meal read; complete meal/person/status coverage and canonical money facts precede a trusted answer.
- **Depends on:** [HUB-44](<Hub & ERA — Master Book.md#hub-44>), [KIT-4](<../_Archive/Shipped/Kitchen.md#kit-4>), [BUD-66](<../Budget/Budget — Master Book.md#bud-66>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on HUB-44 (attribution first), KIT-4 (meal coverage) and BUD-66 (canonical money). "Reuse the existing Chef meal read" is the instruction — that path is `src/features/era/intents/chef.ts` with `resolvers/chef.ts` and `formatters/chef.ts`, and the AI context assembler `src/lib/ai/context.ts`. The money read is `src/features/era/intents/resolvers/budget.ts` and must use `src/lib/balance-utils.ts` plus `startOfCustomMonth` rather than its own arithmetic. "Bounded context" is a token cost, so keep it to the facts the answer needs — see the same bounding discipline in Delivery's DLV-118. A trusted answer waits on its prerequisites; an untrusted one must say so (HUB-41's provenance states).

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend the existing ERA resolver fixtures for custom-month money, person/status-scoped meals, complete-empty versus unavailable and bounded context. Run `pnpm exec vitest run src/features/era/intents/resolveIntent.test.ts`, `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "ERA answers balance and meal-coverage questions from canonical, scoped facts.",
  "acceptance": [
    "Reuse the Chef meal read and canonical Budget facts after their producer acceptance.",
    "Chef/Brain context stays bounded and does not erase person, date, status or availability."
  ],
  "scope": [
    "src/features/era/intents/resolvers/budget.ts",
    "src/features/era/intents/resolvers/chef.ts",
    "src/features/era/intents/formatters",
    "src/lib/ai/context.ts",
    "src/features/era/intents/resolveIntent.test.ts"
  ],
  "steps": [
    "Recheck HUB-44, KIT-4, BUD-66 and Schedule parity receipts before treating their facts as trustworthy.",
    "Wire the existing balance and Chef meal adapters into the ERA read path; reuse ownership and billing-cycle semantics.",
    "Pass only the requested period/person/status facts to Chef/Brain with source and coverage metadata.",
    "Prove the same fixture yields the same canonical facts in the owning module and ERA, including failure and partial reads."
  ],
  "invariants": [
    "No independent balance arithmetic, full-history prompt or duplicate Chef fetch.",
    "Private records do not become household context.",
    "Unverified/partial input cannot produce a confident all-clear."
  ],
  "exclusions": [
    "New Gemini consumers before HUB-44, meal-planning mutation changes or broad forecasting."
  ],
  "risks": [
    "A compact prompt can still mislead if it drops the scope of the facts it summarizes."
  ],
  "unknowns": [
    "Current producer payloads and evidence must be confirmed at dispatch."
  ],
  "dependencies": [
    "HUB-44",
    "KIT-4",
    "BUD-66",
    "SCH-8"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-46

- **2026-10-10 child delivery:** HUB-104 supplies durable registered-plan consent, progress, partial receipts and conservative recovery. This parent remains open: native capture/offline acceptance and source-endpoint idempotency are not delivered by the journal. A journal transition cannot prove the outcome of a lost source response.

**Outcome:** Make conversational capture durable and idempotent.

- **Final-review boundary — 2026-10-11:** The opt-in agent journal arbitrates saved runs but not the source-commit/receipt gap. Native single actions, native confirmation cards and NFC compounds still have separate consent/recovery behavior. Reuse the journal/outcome seam when converging these paths; protect account/chat boundaries and acknowledged partial effects without replaying an unknown write. HUB-108 hardens default model cards and NFC partial receipts, not source exactly-once execution.

- **Acceptance:** Durable queue acknowledgment, idempotent draft/nonrecurring-item endpoints and owner-bound reconciliation precede income/event extensions. Dispatch one bounded child sheet per session; reuse existing queue feature keys. Parent remains open until every retained criterion passes.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Capture durability, and it gates SCH-15. Three parts, each with a home. Durable queue acknowledgment: `src/lib/offlineQueue.ts` (`addToQueue`, `findPendingOperation`, `updateQueuedOperation`, `cancelCreateDeletePair`) and `src/lib/offlineSyncEngine.ts` — the acceptance says reuse existing queue feature keys, so do not add a parallel store; background in `ERA Notes/01 - Architecture/Sync and Offline.md`. Idempotent endpoints: the draft path (`src/features/drafts/`, `src/app/api/transactions/`) and non-recurring item creation (`src/app/api/items/route.ts`) — idempotence means a unique key plus 409 (Hard Rule #9), not a pre-check. Owner-bound reconciliation: whose queue replayed what. Capture surface: `src/features/era/useEraTurn.ts` (`runTurn`) and `src/components/era/CommandBar.tsx`. Income/event extensions come after.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed injected queue/endpoint fixtures: durable enqueue failure, double tap, response loss after commit, same operation replay, owner switch and offline restart. Run existing relevant tests plus `pnpm typecheck` and `pnpm lint`; use isolated DB fixtures for uniqueness/transaction proof.

```delivery-plan-v1
{
  "outcome": "Conversational capture is acknowledged only after durable acceptance and reconciles exactly once to its owner.",
  "acceptance": [
    "Existing queue feature keys support durable capture acknowledgment.",
    "Draft and nonrecurring-item endpoints reconcile repeat operation IDs to the same result before income/event extensions."
  ],
  "scope": [
    "src/lib/offlineQueue.ts",
    "src/lib/offlineSyncEngine.ts",
    "src/features/era/useEraTurn.ts",
    "src/components/era/CommandBar.tsx",
    "src/app/api/drafts",
    "src/app/api/items/route.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Split E-09a–f into bounded sheets; verify actual draft endpoint ownership and current queue contracts before declaring the first write set.",
    "Implement durable enqueue acknowledgment first; failed storage keeps input recoverable and cannot claim queued.",
    "Implement owner-bound idempotent draft/item creation with atomic uniqueness, exact retry identity and a reviewed migration if required.",
    "Implement reconciliation, then income/event capture only after SCH-7 refusal and SCH-9 alert parity; retain separate confirmation replay policy."
  ],
  "invariants": [
    "No parallel ERA queue or silent in-memory success.",
    "Timeout/uncertain response cannot trigger a new operation ID.",
    "Creating a draft and confirming it are different permissions."
  ],
  "exclusions": [
    "Automatic replay of money confirmation, recurring-item writes or income/event work before prerequisite sheets."
  ],
  "risks": [
    "A uniqueness error alone is not reconciliation; replay must recover the original operation result."
  ],
  "unknowns": [
    "Endpoint/schema identity and safe replay contract require code/schema revalidation."
  ],
  "dependencies": [
    "HUB-37",
    "SCH-7",
    "SCH-9"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-47

**Outcome:** Count only verified actions as successful learning.

- **Acceptance:** Failed/pending/uncertain actions cannot count as success or improve templates; Activity covers capability outcomes and opens real doors. Verify current conversation behavior with owner evidence; any needed migration belongs to E-05a, not a duplicate trigger guess.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The learning loop must not count unverified outcomes. Read `src/features/era/logEraAction.ts` (what an action records), `src/features/era/missTracking.ts`, and the template learner `src/features/era/templates/` — `learn.ts`, `matcher.ts`, `normalize.ts`, `vocabGrowth.ts`, each with its own test, plus `useEraTemplates.ts`/`useTaughtPhrases.ts` and the API at `src/app/api/era/templates/`. The rule is that only a *verified* action feeds `learn.ts`; failed, pending and uncertain must be inert. Activity coverage means the Activity view shows capability outcomes and links to the real destination (see `ERA_CAPABILITIES` in `src/features/era/capabilities/registry.ts` — 13 capabilities today). Verify current behaviour with owner evidence; any migration belongs to E-05a, not a guessed trigger. HUB-64 depends on this.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend `src/features/era/templates/learn.test.ts`, `src/features/era/missTracking.test.ts` and relevant resolver/capability fixtures; assert failed/pending/uncertain/wrong-target results never improve templates, and confirmed outcomes open real destinations. Run `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "ERA learns and reports success only from verified, correctly targeted actions.",
  "acceptance": [
    "Failed, pending and uncertain outcomes do not improve templates or appear as successful Activity actions.",
    "Activity covers capability outcomes with real destinations; current conversation persistence has owner evidence."
  ],
  "scope": [
    "src/features/era/logEraAction.ts",
    "src/features/era/missTracking.ts",
    "src/features/era/templates",
    "src/features/era/useEraTurn.ts",
    "src/features/era/useEraAskAI.ts",
    "src/components/era/dashboards"
  ],
  "steps": [
    "Trace one deterministic action and one Ask AI confirmation from resolver result to Activity and learner.",
    "Define the shared verified-outcome gate using actual result IDs/status, retaining failure and uncertainty rather than inferring from reply wording.",
    "Apply the gate to each learning path and Activity outcome; wire existing module destinations for confirmed records.",
    "Reproduce current conversation behavior with isolated fixtures and owner evidence; route any required E-05a schema work to HUB-42."
  ],
  "invariants": [
    "A proposal, queued operation or HTTP return is not verified domain success.",
    "Wrong-target execution never becomes positive training.",
    "Domain resolvers remain the authority for results."
  ],
  "exclusions": [
    "A duplicate conversation trigger migration, learned referent hardening owned by HUB-64 or new ranking."
  ],
  "risks": [
    "Independent success booleans in Activity and learning can diverge again."
  ],
  "unknowns": [
    "Actual deployed conversation/persistence behavior needs the owner witness."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-59

**Outcome:** Use the source message date for transaction conversion.

- **Acceptance:** H-03 and Aug1 Inbox: default to the selected message’s created_at local date, preserving explicit user date overrides and UTC storage. Test old threads and timezone boundaries.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small and precisely scoped: a chat→transaction conversion should default to the **source message's** `created_at` local date, not today. The conversion surface is `src/components/hub/AddTransactionFromMessageModal.tsx` with `src/features/hub/messageActions.ts` (`useCreateMessageAction`) and the API `src/app/api/hub/message-actions/route.ts`; the transaction write is `src/app/api/transactions/route.ts`. The whole item is a timezone problem — storage stays UTC, display and default are local — so read `.claude/skills/timezone-handling/SKILL.md` and use `src/lib/utils/date.ts`, never raw `Date` arithmetic. Preserve an explicit user override. Test old threads and a midnight boundary, which is where this silently goes wrong.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Proposed conversion-date fixture covers an old message, Beirut midnight, a negative-offset locale, explicit user override and UTC request storage. Run affected existing tests, `pnpm typecheck` and `pnpm lint`; verify the date field at 390×844.

```delivery-plan-v1
{
  "outcome": "Message conversion defaults to the selected message's local creation date while preserving a chosen override.",
  "acceptance": [
    "Initial transaction date comes from source created_at rather than the day conversion is opened.",
    "Explicit user edits survive rerenders; storage remains UTC and money behavior is unchanged."
  ],
  "scope": [
    "src/components/hub/AddTransactionFromMessageModal.tsx"
  ],
  "steps": [
    "Read the modal's date initialization/reset effects, actual created_at prop and transaction request contract.",
    "Derive the local calendar default using the canonical date utility; distinguish initialization from a user-edited date.",
    "Carry the chosen date through the existing submit path without changing transaction/draft amounts or posting mode.",
    "Exercise old-thread and timezone-boundary cases, including reopening for a different message."
  ],
  "invariants": [
    "A rerender cannot overwrite a deliberate date selection.",
    "Source timestamps remain instants; local date conversion happens at the UI boundary.",
    "Date-only strings are not parsed as UTC midnight by accident."
  ],
  "exclusions": [
    "Changing financial math, bulk conversion atomicity, historical transaction backfill or draft linking HUB-57."
  ],
  "risks": [
    "A date effect keyed too broadly can reset the user's override during async parsing."
  ],
  "unknowns": [
    "Current prop/reset flow and canonical helper signature must be re-read before editing; add a small proposed helper/test only if needed."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-61

**Outcome:** Verify guest-drinks household access.

- **Acceptance:** H-01 and Aug19 Inbox: owner supplies current guest_drinks RLS/role evidence; historical disabled-RLS assertion is not current proof. Produce only any necessary manual runbook and verify intended guest/household scope.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A visibility question, so Hard Rule #27's gate applies: **get the DB's RLS state before reading route code**, and treat the historical "RLS disabled on guest_drinks" claim as a hypothesis, not a fact — `migrations/db-state.json` is the only repo artifact that counts. The code path is `src/app/api/guest-portal/drinks/route.ts` with the public views under `src/app/g/[tag]/` and `src/components/guest/`; Guest Portal has its own slug-URL hard rule in `ERA Notes/02 - Standalone Modules/Guest Portal/`. The tension to resolve is deliberate: a guest must read without an account while household scope still applies. Deliverable is a manual runbook if one is needed — agents never apply it (Hard Rule #26).

**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Run `pnpm db:verify-rls` after owner snapshot refresh; owner provides guest, own-household, partner and unrelated-household observations without truncated policy bodies. Keep application receipts separate from route/source review.

```delivery-plan-v1
{
  "outcome": "Guest-drinks access is evidenced for the intended public guest and household boundaries.",
  "acceptance": [
    "Current owner RLS/role evidence establishes the relevant read/write boundary.",
    "Produce only a necessary manual runbook; do not change correct routes to chase an unverified policy hypothesis."
  ],
  "scope": [],
  "steps": [
    "Read snapshot metadata first; the available 2026-08-04 export cannot certify current guest_drinks access.",
    "Ask the owner for current policies/enablement and role witnesses for every table on the read path, preserving full restrictive/permissive bodies.",
    "After the evidence gate, trace the guest-drinks route and slug resolution against the intended guest/household scopes.",
    "If a discrepancy is confirmed, prepare the narrow inspect/fix/verify/rollback SQL handoff and retain the owner-applied result separately."
  ],
  "invariants": [
    "A historical disabled-RLS statement is not present-day evidence.",
    "Guest unauthenticated access does not grant unrelated household scope.",
    "An agent never applies the runbook to production."
  ],
  "exclusions": [
    "Blanket public policies, switching slug URLs to raw UUIDs or unrelated guest-portal redesign."
  ],
  "risks": [
    "A permissive policy can still be constrained by a restrictive one; incomplete policy output misleads."
  ],
  "unknowns": [
    "Current guest_drinks policy state and intended role observations require owner input."
  ],
  "dependencies": [
    "HUB-62"
  ],
  "risk": "high",
  "provenance": "2026-09-26: accepted H-01 scope and parsed snapshot timestamp reviewed before any guest route read. Snapshot is dated 2026-08-04; no current access diagnosis or live test.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-64

**Outcome:** Reject learned actions with unsafe referents.

- **Acceptance:** UU-X1 synthetic learner/router/dispatcher chain changed a named dentist request into zero-slot focus and deleted Call bank. Require explicit grounded target slots and safe clarification at learning, routing and dispatch; wrong-target actions never count as successful training. No claim of observed live incidence.
- **Depends on:** [HUB-47](<Hub & ERA — Master Book.md#hub-47>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on HUB-47. The failure is a chain, so the fix is at three points, all in `src/features/era/`: learning (`templates/learn.ts`, `normalize.ts`), routing (`intentRouter.ts`, `intents/resolveIntent.ts`, `intents/rootIntentRouter.test.ts`) and dispatch (`capabilities/registry.ts` — `ERA_CAPABILITIES`, `getCapability`, and `capabilities/types.ts` for the slot shape). The rule: a capability invocation with an unresolved or ambiguous target slot must refuse and ask, never fall back to a zero-slot variant or a nearest match — the synthetic incident turned a named-dentist request into a zero-slot focus action and deleted an unrelated reminder. Destructive capabilities (`reminderDelete`, `reminderComplete`) need the strictest grounding. A wrong-target action must also be excluded from training (HUB-47). No claim of live incidence — this is a hardening item.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend `src/features/era/templates/learn.test.ts`, `src/features/era/intents/rootIntentRouter.test.ts` and `src/features/era/capabilities/registry.test.ts` with named-dentist/unrelated-focus, ambiguous name, deleted target and missing slots. Assert zero writes and zero learning on refusal; run `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "Learned commands preserve target meaning and refuse unsafe referents before dispatch.",
  "acceptance": [
    "Learning, routing and dispatch require explicit grounded target slots for target-bearing capabilities.",
    "The named-dentist synthetic case cannot fall back to unrelated focus or become successful training."
  ],
  "scope": [
    "src/features/era/templates/learn.ts",
    "src/features/era/templates/normalize.ts",
    "src/features/era/intentRouter.ts",
    "src/features/era/intents/resolveIntent.ts",
    "src/features/era/capabilities",
    "src/features/era/intents/rootIntentRouter.test.ts"
  ],
  "steps": [
    "Reproduce the synthetic learner→router→dispatcher chain against current source with unrelated focus present.",
    "Preserve named target intent through template learning and reject a target-bearing example that normalizes into a zero-slot action.",
    "Validate grounded IDs/type/current availability again at dispatch; missing or ambiguous targets produce clarification with zero mutation.",
    "Connect refusal/wrong-target outcomes to HUB-47's verified-learning gate and test every destructive capability path."
  ],
  "invariants": [
    "Named targets never silently degrade to pronoun focus.",
    "Schema-valid slots alone do not establish target authorization or meaning.",
    "Wrong-target actions cannot train or improve a template."
  ],
  "exclusions": [
    "A new fuzzy matcher, broader intent vocabulary or claims of observed production incidence."
  ],
  "risks": [
    "Fixing only the learner leaves direct capability dispatch able to repeat the same unsafe fallback."
  ],
  "unknowns": [
    "Current learned-template representation and every destructive dispatcher call site require revalidation."
  ],
  "dependencies": [
    "HUB-47"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from this item's accepted criteria, reading guide and Plans/ERA Top Layer.md; source entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-57

**Outcome:** Link conversions to the returned draft ID.

- **Acceptance:** Future chat conversion links the actual returned draft ID and never automatically recreates a draft after link failure.

**Retained contract — ASTRA-HUB-1:**

- **Outcome:** A future-payment conversion links its source message to the saved draft's real ID.
- **Boundary:** Extract only the modal's existing future-draft create/link sequence into the injectable adapter, retaining the existing request functions. Destructure/validate the successful draft envelope using its real response shape; a missing draft/id must not create a null-target action or report completion. Keep the returned ID through the existing action-link call; do not resubmit domain creation when only tracking failed. Reuse installed Zod if a runtime validator is needed. Test the adapter that the modal actually calls, not a duplicate sequence. This does not make the two writes atomic or introduce a new API client or queue.
- **Money/schedule math?:** Draft-only invariant: account $100 → create future expense draft $20 → account stays $100; action references the draft UUID. No date conversion or posting behavior changes.
- **Gate:** `pnpm exec vitest run tests/hub-created-draft.test.ts --reporter=verbose` → nonzero cases pass: real `{draft:{id}}` envelope, malformed/missing ID and error body. Mocked conversion fixture confirms one draft request, the returned UUID passed to linking, zero confirmation requests, no automatic draft retry on link failure. Common gates pass. Existing test tooling only; no live money fixture.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Start with `src/components/hub/AddTransactionFromMessageModal.tsx`'s future-payment branch and `src/app/api/drafts/route.ts`'s actual response envelope. The current modal reads `draft.id` from the entire JSON response and treats link failure as non-critical (source read 2026-09-26). Keep the actual returned draft identity through `src/features/hub/messageActions.ts`; a tracking failure must not recreate the saved draft. The accepted injectable adapter/test boundary below remains deliberately narrower than HUB-67 atomicity.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Add the accepted proposed `tests/hub-created-draft.test.ts`; run it with `pnpm exec vitest run tests/hub-created-draft.test.ts --reporter=verbose`. Assert real envelope, missing ID, create error and link failure; one draft request, no confirmation request. Run `pnpm typecheck` and `pnpm lint` after the scoped change.

```delivery-plan-v1
{
  "outcome": "Future-payment conversion links its source message to the actual saved draft.",
  "acceptance": [
    "The create response's real draft ID reaches the existing message-action link.",
    "Missing IDs or failed linking never report complete conversion or automatically recreate the draft."
  ],
  "scope": [
    "src/components/hub/AddTransactionFromMessageModal.tsx",
    "src/features/hub/createdDraft.ts",
    "tests/hub-created-draft.test.ts"
  ],
  "steps": [
    "Read the current /api/drafts response and the modal's future-payment branch together.",
    "Extract only that create/link sequence into the proposed injectable createdDraft adapter; preserve existing request functions.",
    "Validate the draft envelope and carry its ID through linking; distinguish saved-but-unlinked from failed creation.",
    "Test the adapter actually used by the modal, including recovery that retries tracking only after its saved identity is known."
  ],
  "invariants": [
    "Account $100 plus a $20 future draft leaves the balance at $100.",
    "No missing/null target is recorded as a successful action.",
    "One failed tracking request cannot cause a second domain create."
  ],
  "exclusions": [
    "Atomic conversion HUB-67, new API client/queue, date behavior or historical data repair."
  ],
  "risks": [
    "The modal currently reads draft.id from the entire response instead of the nested draft envelope."
  ],
  "unknowns": [
    "Revalidate the server envelope at implementation time; do not preserve a guessed response type."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26: AddTransactionFromMessageModal.tsx:92-134 read; existing accepted ASTRA-HUB-1 contract retained. Adapter/test paths are proposed; no live conversion performed.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-58

**Outcome:** Report bulk Undo failures honestly.

- **Acceptance:** Bulk conversion Undo checks every inverse result and refuses a false completion acknowledgment.

**Retained contract — ASTRA-HUB-2:**

- **Outcome:** A failed inverse prerequisite stops bulk Undo before further destructive steps and prevents a success claim.
- **Boundary:** Extract only the existing per-record inverse into an injectable adapter; check every HTTP status and SDK error before advancing or marking that record reversed. Keep confirmed, failed and uncertain results distinct; overall success requires every selected inverse to be confirmed. Preserve truthful partial results and invalidate affected existing keys even after partial completion. Do not bypass the missing endpoint with direct DB calls, invent an atomic guarantee or silently compensate. No new production text is specified; existing failure/success affordances receive the correct branch.
- **Money/schedule math?:** Financial guard: account $80 after a $20 expense; action-link DELETE returns 404 → zero downstream transaction deletes, account remains $80, reversal is not marked complete. A mocked successful owning inverse returns $100 once; this sheet does not certify that server inverse's atomicity.
- **Gate:** `pnpm exec vitest run tests/hub-conversion-undo.test.ts --reporter=verbose` → nonzero cases pass: first response 404 prevents target deletion; second response 500 is not success; resolved SDK `error` is not success; mixed batch retains partial evidence; duplicate result handling does not report double reversal. Common gates pass. Tests inject fake effects; no real row deletions.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Bulk Undo must check every inverse result before acknowledging. The surface is `src/components/hub/BulkConvertReviewSheet.tsx` with `useDeleteMessageAction()` in `src/features/hub/messageActions.ts`. Two rules: stop at the first failed inverse rather than continuing into further destructive steps, and never show a success toast for a partial inverse — Hard Rule #1 requires Undo to exist, this item requires it to be honest. The same truthfulness problem appears in TRIP-29 (zero-row writes reported as success); read it for the pattern. Feeds HUB-67.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Add proposed `tests/hub-conversion-undo.test.ts`; run it with `pnpm exec vitest run tests/hub-conversion-undo.test.ts --reporter=verbose`. Cover 404 prerequisite, second-step 500, SDK error, mixed batch and repeated result. Assert no downstream delete after the failed prerequisite.

```delivery-plan-v1
{
  "outcome": "Bulk conversion Undo reports only confirmed inverses and preserves partial or uncertain outcomes.",
  "acceptance": [
    "Every HTTP and SDK result is checked before that record advances to its next destructive step.",
    "Overall success requires every selected inverse to be confirmed; partial changes still refresh affected views."
  ],
  "scope": [
    "src/components/hub/BulkConvertReviewSheet.tsx",
    "src/features/hub/conversionUndo.ts",
    "tests/hub-conversion-undo.test.ts"
  ],
  "steps": [
    "Read the current per-record inverse sequence and endpoint availability before changing its order.",
    "Extract only the sequence into the proposed injectable conversionUndo adapter; check statuses and SDK error values.",
    "Stop the affected record at its first failed prerequisite, preserve confirmed/failed/uncertain evidence across the batch, and invalidate affected keys.",
    "Use existing result affordances truthfully; never invent compensation or direct DB access for a missing endpoint."
  ],
  "invariants": [
    "$80 after a $20 expense remains $80 when link DELETE fails and no transaction inverse ran.",
    "A mocked owning inverse restoring $100 once does not certify server atomicity.",
    "Cache rollback is not a domain inverse."
  ],
  "exclusions": [
    "Atomic redesign HUB-67, retry queue, live row deletion or replacing the financial inverse."
  ],
  "risks": [
    "Promise resolution does not mean a fetch or Supabase operation succeeded."
  ],
  "unknowns": [
    "Current missing-endpoint behavior must be reproduced with injected effects, not production deletions."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26: BulkConvertReviewSheet.tsx:374-410 still advances after unchecked responses. Accepted ASTRA-HUB-2 retained; helper/test paths are proposed.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-2

- **Retained campaign gate (D2):** Voice degrades gracefully with no Azure connection, and the setup is documented. *(→ HUB-2/E-17)*

**Outcome:** Degrade voice gracefully and document setup.

- **Acceptance:** Voice graceful degradation + setup docs *(now packet **E-17**, Phase 2)* — one `speak()` seam with a `speechSynthesis` fallback promoted from `useEraReplyTTS`, distinct orb states for token-mint/SDK/worklet/mid-stream failures. Wake-word setup itself is out of scope per owner decision 2026-09-02 (D2) — voice degradation is about the TTS/STT pipeline, not wake.

- **Acceptance:** with no Azure connection the voice path degrades with a visible, non-crashing state, the wake-word setup is documented, and a degradation test exists.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Voice degradation, not wake-word — wake is explicitly out of scope (owner decision 2026-09-02 D2). The pipeline is `src/features/voice-conversation/`: `azureTTS.ts`, `azureSTT.ts`, `sttCapture.ts`, `audioContext.ts`, `vadGate.ts`, `ttsQueue.ts` (with its test) and `conversationEngine.ts`. The seam the acceptance names exists: `useEraReplyTTS()` in `src/features/voice-conversation/hooks/useEraReplyTTS.ts`, consumed by `src/components/era/CommandBar.tsx` as `play: speakReply` — promote a single `speak()` from there with a browser `speechSynthesis` fallback. The four distinct failure states (token mint, SDK, worklet, mid-stream) surface on the orb: `src/components/era/EraDots.tsx` / `EraShell.tsx`. Azure keys are in `docs/ENV.md`; with none configured the path must degrade visibly and not crash, and a degradation test is part of the acceptance.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend existing `src/features/voice-conversation/ttsQueue.test.ts` where relevant; add proposed injected degradation fixtures for missing Azure config, token mint, SDK, worklet and mid-stream failure. Run `pnpm typecheck` and `pnpm lint`; verify visible non-crashing fallback on a phone separately.

```delivery-plan-v1
{
  "outcome": "Voice uses one speech seam and degrades visibly when Azure or the audio pipeline fails.",
  "acceptance": [
    "Promote the existing reply-TTS fallback into one speak seam used by the relevant callers.",
    "Token, SDK, worklet and mid-stream failures remain distinguishable; browser speech fallback is available when supported."
  ],
  "scope": [
    "src/features/voice-conversation",
    "src/components/era/CommandBar.tsx",
    "src/components/era/EraDots.tsx",
    "src/components/era/EraShell.tsx",
    "docs/ENV.md"
  ],
  "steps": [
    "Trace current useEraReplyTTS, queue and conversation-engine callers; retain already-working fallback behavior.",
    "Consolidate speech dispatch behind one seam without duplicating synthesis or replaying an entire partially spoken reply.",
    "Map each failure stage to a recoverable orb state and keep typed interaction usable.",
    "Document required voice setup and the tested fallback matrix, then run injected failures and owner phone verification."
  ],
  "invariants": [
    "No successful action is claimed solely because speech played.",
    "Typed and voice domain actions keep the shared turn engine.",
    "Missing platform speech support yields a visible quiet failure, not a crash."
  ],
  "exclusions": [
    "Wake-word setup or changes, geofencing, new provider adoption and ERA layout redesign."
  ],
  "risks": [
    "Retry after partial audio can repeat speech or keep the microphone in the wrong state."
  ],
  "unknowns": [
    "Actual platform audio permissions and Azure/device behavior require fresh owner evidence."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted ERA Top Layer constraints; focused source entry points must be revalidated before edits. No runtime or deployment certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-48

**Outcome:** Add briefing status and retire the floating report assistant.

- **Acceptance:** *(E-10)* Status line + in-hub briefing card (additive, doesn't move the orb/widgets/nav) + `analysis.report` capability so the floating `AIChatAssistant` can be retired once the report is reachable from ERA.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two additive pieces and one retirement. The capability is genuinely missing: `ERA_CAPABILITIES` in `src/features/era/capabilities/registry.ts` holds 13 entries (schedule, reminder CRUD, spend, drafts, recipes, meals, memory) and no `analysis.report` (verified 2026-09-20) — add it there with a type in `capabilities/types.ts`; the report itself is `src/lib/ai/analysisReport.ts`. The status line and in-hub briefing card must be additive — the acceptance says they do not move the orb, widgets or nav (`src/components/era/EraShell.tsx`, `HubScatterWidgets.tsx`), and the ERA layout freeze plus "no unrequested UI redesign" both apply. Only once the report is reachable from ERA may `src/components/ai/AIChatAssistant.tsx` retire (HUB-40 owns that deletion).

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Extend existing ERA capability/resolver fixtures for analysis.report and stored-report reopening; verify no extra model call when opening history. Check briefing loading/cached/unavailable states and 390×844 layout without moving existing orb/widgets/nav; run `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "ERA exposes stored briefing status and the report/history capability needed to retire the floating assistant.",
  "acceptance": [
    "An additive briefing card/status opens the stored HUB-42 result with truthful availability.",
    "analysis.report and historical reports are reachable before HUB-40 removes the old surface."
  ],
  "scope": [
    "src/features/era/capabilities",
    "src/features/era/intents",
    "src/components/era",
    "src/lib/ai/analysisReport.ts"
  ],
  "steps": [
    "Revalidate report storage/history and the current capability registry; identify the existing report service to reuse.",
    "Add the analysis.report capability and exact owner navigation with the existing proposal/read contract.",
    "Add the stored briefing card and compact status using HUB-42 records; preserve owner-bound cached recovery and unknown states.",
    "Verify report/history parity and hand its evidence to HUB-40; keep retirement ownership there."
  ],
  "invariants": [
    "Opening a stored report does not regenerate it.",
    "No new assistant persistence store or alternative inference route.",
    "The existing ERA composition remains additive."
  ],
  "exclusions": [
    "Floating-assistant deletion, optional model briefing composition or replacing Budget's report calculations."
  ],
  "risks": [
    "A new current-report button alone can leave historical reports stranded."
  ],
  "unknowns": [
    "Actual report/history response contracts and HUB-42 storage readiness require revalidation."
  ],
  "dependencies": [
    "HUB-42"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted ERA Top Layer constraints; focused source entry points must be revalidated before edits. No runtime or deployment certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-49

**Outcome:** Bundle the Top View data read.

- **Acceptance:** *(E-14)* `get_era_topview_bundle()` RPC — collapses the four widget hooks' ~7 round trips into 1 *(absorbs **HUB-7**'s "fresh cache" half)*.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A textbook Hard Rule #21 case: four widget hooks doing ~7 round trips at ~170–200 ms each. Collapse into one SECURITY DEFINER RPC `get_era_topview_bundle()` returning JSON aggregates — `get_schedule_bundle` is the canonical example, and `get_health_bundle` / `get_trip_bundle` are working instances to copy (`src/app/api/healthcare/route.ts`, `src/app/api/trips/[id]/bundle/route.ts`). The widgets are `src/components/era/face-widgets/` (`BudgetWidget`, `ScheduleWidget`, `ChefWidget`, `BrainWidget`, `EraFaceWidget`) — find their hooks and the query keys in `src/features/era/queryKeys.ts` before changing the read shape, and see `.claude/skills/cache-invalidation/SKILL.md` for collapsing several keys into one. Hard Rules #20 (no EXISTS policies on hot children — own the WHERE inside the function), #24 and #26. Absorbs HUB-7's fresh-cache half.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed isolated RPC/adapter fixtures compare the four existing widget meanings, private/shared/own-only cases, partial source failure and one bundle read. Verify Network request count without live mutations; owner applies reviewed SQL separately. Run `pnpm typecheck` and `pnpm lint` and affected resolver tests.

```delivery-plan-v1
{
  "outcome": "ERA Top View loads canonical widget facts through one household-scoped bundle.",
  "acceptance": [
    "get_era_topview_bundle replaces redundant widget reads without changing their meaning.",
    "Each section preserves owner permissions, source coverage and freshness; dependent views refresh after mutations."
  ],
  "scope": [
    "migrations",
    "src/app/api/era",
    "src/features/era/widgets",
    "src/features/era/queryKeys.ts"
  ],
  "steps": [
    "Measure current requests and map each widget field to its canonical source contract; do not copy current incorrect arithmetic into SQL.",
    "Read schema/current owner evidence and propose the SECURITY DEFINER bundle migration with explicit authorized scope.",
    "Add the bounded server/read adapter, then move existing widget hooks to shared cached data while retaining their external contracts.",
    "Update the complete invalidation set and prove one read plus field/permission parity before removing old fetches."
  ],
  "invariants": [
    "Bundle optimization cannot widen household access.",
    "Missing sources remain partial/unavailable rather than fabricated zero summaries.",
    "No second money or recurrence engine."
  ],
  "exclusions": [
    "Widget redesign, new metrics, database application or changing standalone ownership."
  ],
  "risks": [
    "Combining individually authorized reads into an admin RPC can accidentally bypass source privacy."
  ],
  "unknowns": [
    "Current RPC/schema and canonical producer readiness; the historical seven-request count must be measured again."
  ],
  "dependencies": [
    "HUB-41",
    "BUD-66",
    "SCH-8"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and Plans/ERA Top Layer.md; source/schema and predecessor receipts require dispatch-time revalidation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-50

**Outcome:** Keep mobile vitals available while conversation sleeps.

- **Acceptance:** *(E-15)* Vitals strip on mobile, rendered even while asleep — "data is always awake; only the conversational layer sleeps."

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** "Data is always awake; only the conversational layer sleeps" is the whole design rule. Read `src/components/era/EraShell.tsx` for what sleep currently gates, then render the vitals strip outside that gate. Sources should be HUB-49's bundle once it exists — build against the widget hooks now and migrate, rather than adding a fifth round trip. Mobile-first (Hard Rule #5), opaque panels via `tc.bgPage` if anything floats (#15), fixed-header offset (#16), and the ERA layout freeze means additive only. Hard Rule #28: numbers and labels, no captions.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Verify 390×844 awake/asleep transitions, reload with cached own data, no cached data, failed refresh and account switch. Check request count and fixed-header clearance; run `pnpm typecheck` and `pnpm lint`. Owner phone behavior remains separate from local viewport evidence.

```delivery-plan-v1
{
  "outcome": "Mobile vitals remain available while ERA's conversational layer sleeps.",
  "acceptance": [
    "Sleeping the orb does not hide the vitals strip.",
    "Cached facts remain owner-bound and distinguish stale/unavailable data without adding explanatory prose."
  ],
  "scope": [
    "src/components/era/EraShell.tsx",
    "src/components/era/HubScatterWidgets.tsx",
    "src/components/era/face-widgets",
    "src/features/era/widgets"
  ],
  "steps": [
    "Identify what sleep currently hides and choose the smallest existing vitals presentation that can remain outside that gate.",
    "Reuse current widget data, preferring HUB-49's bundle once available; do not add an independent read path.",
    "Keep compact values/status visible on mobile and handle cached reload or unavailable data truthfully.",
    "Verify sleep/wake, navigation and household/account transitions without moving the accepted orb or navigation layout."
  ],
  "invariants": [
    "Conversation sleep does not imply stale facts are current.",
    "User changes cannot reveal a previous user's persisted data.",
    "New floating elements stay opaque and clear fixed navigation."
  ],
  "exclusions": [
    "Additional dashboards, metrics, a fifth fetch or broad layout redesign."
  ],
  "risks": [
    "Moving a component outside a visibility gate can start duplicate subscriptions or reads."
  ],
  "unknowns": [
    "Whether current widget hooks already mount during sleep and the available bundle contract must be checked."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and Plans/ERA Top Layer.md; source/schema and predecessor receipts require dispatch-time revalidation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-51

**Outcome:** Deliver partner preferences and persistent person colors.

- **Acceptance:** Implement persistent person identity colors across blue/pink/frost/calm, the partner’s own briefing hour/toggle and her chosen flow. Current role-relative theme fallbacks are insufficient. DEC-01/02 must settle sequencing and color derivation; the Sep2 personal-first decision is not permission to skip partner acceptance.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two halves, and the colour half has a repo-wide rule. Hard Rule #14 is the authority: colour identity is **person-absolute**, not role-relative — blue-theme user is `blue-400/500` on both phones always, derived from `useTheme()`, with the full account in `ERA Notes/01 - Architecture/Color Identity.md`. "Current role-relative theme fallbacks are insufficient" means find and remove those fallbacks; `src/contexts/ThemeContext.tsx` and `src/lib/theme-colors.ts` are the machinery, and a theme change invalidates all queries (Hard Rule #10). The partner-preferences half is per-recipient briefing hour and toggle, which is NOTIF-19's per-recipient policy and HUB-42's per-recipient delivery — store it with those, not in a third place. DEC-01/02 settle sequencing and derivation; the personal-first decision is not permission to skip partner acceptance.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed identity fixtures render the same two people from both accounts under blue/pink/frost/calm and after theme change/relink. Verify each recipient's hour/toggle independently, plus disabled-before-consent behavior. Run `pnpm typecheck` and `pnpm lint`; owner confirms partner's chosen flow.

```delivery-plan-v1
{
  "outcome": "Person colors remain stable and the partner receives only her chosen briefing flow.",
  "acceptance": [
    "Color follows the person across viewers and neutral themes.",
    "The partner's own toggle/hour and the accepted five-owner-mornings sequencing precede her activation."
  ],
  "scope": [
    "src/contexts/ThemeContext.tsx",
    "src/lib/theme-colors.ts",
    "src/features/era",
    "src/components/era",
    "src/app/api/notifications/preferences/route.ts",
    "migrations"
  ],
  "steps": [
    "Inventory role-relative color fallbacks and existing recipient preferences without changing behavior.",
    "Resolve DEC-02's stable identity source; implement one shared derivation rather than using the viewer's current theme as the person's identity.",
    "Reuse NOTIF-19/HUB-42 recipient preference/delivery contracts; add only missing validated persistence through a proposed migration if needed.",
    "Verify both viewers and partner controls; keep activation held until DEC-01 and the partner's chosen hour/toggle are recorded."
  ],
  "invariants": [
    "Personal-first rollout does not waive partner acceptance.",
    "Display theme changes cannot swap household identity colors.",
    "No third store for briefing preferences."
  ],
  "exclusions": [
    "Recoloring the entire app, changing quiet policy or choosing the partner's preferences for her."
  ],
  "risks": [
    "A theme-derived fallback may look correct on one phone while reversing identities on the other."
  ],
  "unknowns": [
    "DEC-02 stable color derivation and DEC-01 activation choices; inventory work can proceed now."
  ],
  "dependencies": [
    "NOTIF-19",
    "HUB-42",
    "DEC-01",
    "DEC-02"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and Plans/ERA Top Layer.md; source/schema and predecessor receipts require dispatch-time revalidation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-54

**Outcome:** Connect signal cards to confirmed actions and real destinations.

- **Acceptance:** *(E-20)* Signal stack + card actions (draft-only, never a direct write) + doors from every tile.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** "Draft-only, never a direct write" is the load-bearing clause and it matches the app-wide rule that AI proposes and the human confirms. Signal data comes from HUB-41 (with its complete/partial/unavailable provenance); the card actions must create a draft through the existing drafts contract (`src/features/drafts/`, `src/app/api/transactions/`) or an equivalent proposal, never call a domain mutation. "Doors from every tile" means each card routes to the real destination — the route vocabulary already exists as `resolveRoute` in `src/lib/notifications/registry.tsx` and `VALID_PAGE_ROUTES`; reuse that idea rather than hardcoding paths. Surfaces: `src/components/era/HubScatterWidgets.tsx`, `face-widgets/`, `dashboards/`.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Proposed capability/card fixtures cover a real destination, missing source, draft creation, rejected confirmation, stale source revision and replay. Assert card action alone never posts money or schedule state. Run affected ERA tests, `pnpm typecheck` and `pnpm lint` and a mobile door/Undo pass.

```delivery-plan-v1
{
  "outcome": "Signal cards open real source destinations and offer reviewable confirmed actions.",
  "acceptance": [
    "Every actionable card has a valid owning-module destination.",
    "Actions create the appropriate draft/proposal and require human confirmation before domain mutation."
  ],
  "scope": [
    "src/components/era/HubScatterWidgets.tsx",
    "src/components/era/face-widgets",
    "src/components/era/dashboards",
    "src/features/era/capabilities",
    "src/features/era/intents"
  ],
  "steps": [
    "Map each HUB-41 signal to its source ID, authorized route and supported action; leave unsupported actions unavailable.",
    "Render the bounded signal stack using existing cards and minimal labels.",
    "Delegate action creation to owning draft/proposal contracts, carrying target/revision identity through confirmation.",
    "Test navigation and invalidation after confirmed action or Undo, including sources removed between rendering and confirmation."
  ],
  "invariants": [
    "Partial/unavailable signals cannot authorize a confident mutation.",
    "Opening a card and confirming an action remain distinct.",
    "Source modules retain calculation, write and inverse authority."
  ],
  "exclusions": [
    "New direct AI writes, speculative actions for unimplemented modules or a dashboard redesign."
  ],
  "risks": [
    "A valid-looking route string may not actually open the referenced record."
  ],
  "unknowns": [
    "Final signal schema and which domain actions have real inverses must be confirmed."
  ],
  "dependencies": [
    "HUB-41"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and Plans/ERA Top Layer.md; source/schema and predecessor receipts require dispatch-time revalidation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-55

**Outcome:** Turn a transaction anomaly into one policy-gated proposal.

- **Acceptance:** *(E-21)* Anomaly → proposal: outlier transaction gets exactly one policy-gated card with a "why" line.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** "Exactly one policy-gated card" — the anomaly detector already exists: `src/lib/utils/anomalyDetection.ts` (with `anomalyDetection.test.ts`, which the repo notes stresses a bimodal-threshold fixture). Read it before adding detection logic. The proposal must be a draft, not a write (HUB-54's rule), and the "why" line is one clause, not a paragraph (Hard Rule #28). Policy gating means the same recipient/quiet-hours/severity policy NOTIF-19 centralizes — do not add a second gate. Money framing must use `src/lib/balance-utils.ts` and the custom billing period (`startOfCustomMonth`); `.claude/skills/money-rules/SKILL.md` applies to anything that states an amount.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend existing `src/lib/utils/anomalyDetection.test.ts` only for changed detection behavior; add proposed proposal-identity fixtures for repeated scans, two recipients, muted policy, partial data and confirmation failure. Run `pnpm typecheck` and `pnpm lint` and affected ERA tests.

```delivery-plan-v1
{
  "outcome": "A transaction anomaly produces one eligible, explainable proposal card.",
  "acceptance": [
    "The same source anomaly does not create duplicate cards during repeated observation.",
    "The card carries one factual why clause and follows recipient policy; any action remains a proposal."
  ],
  "scope": [
    "src/lib/utils/anomalyDetection.ts",
    "src/features/era",
    "src/components/era/dashboards",
    "src/lib/notifications"
  ],
  "steps": [
    "Read the existing detector and its bimodal fixtures; reuse its accepted result rather than creating another detector.",
    "Define stable anomaly/source identity and provenance within HUB-41 signals, preserving billing period and source authorization.",
    "Create one policy-gated card via HUB-54's proposal path and NOTIF-19 eligibility; use durable delivery identity if pushed.",
    "Verify repeated scans, policy suppression and corrected/deleted transactions without retaining a stale claim as current fact."
  ],
  "invariants": [
    "An anomaly is not evidence that the transaction is wrong.",
    "No automatic transaction correction or model-written financial recommendation.",
    "Unavailable/partial money facts cannot become a confident anomaly."
  ],
  "exclusions": [
    "Changing anomaly thresholds without evidence, new forecasting or duplicate notification policy."
  ],
  "risks": [
    "A changing display title is not a stable event identity and can defeat deduplication."
  ],
  "unknowns": [
    "Final signal/card persistence and available source revision fields need revalidation."
  ],
  "dependencies": [
    "HUB-41",
    "HUB-54",
    "NOTIF-19",
    "BUD-66"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and Plans/ERA Top Layer.md; source/schema and predecessor receipts require dispatch-time revalidation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-56

**Outcome:** Add Kitchen, Trips and Healthcare signals.

- **Acceptance:** *(E-22)* Module signals from Kitchen/Trips/Healthcare *(absorbs **HUB-9**)*.
- **Depends on:** [KIT-4](<../_Archive/Shipped/Kitchen.md#kit-4>), [HLTH-21](<../Healthcare/Healthcare — Master Book.md#hlth-21>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on KIT-4 and HLTH-21, and both dependencies are the same reason: those modules must first distinguish unavailable from empty, or the signals will confidently report "nothing planned" / "no allergies" on a failed read. Sources: Kitchen via the Chef meal read (`src/features/era/intents/chef.ts`, `src/app/api/meal-plans/route.ts`), Trips via `get_trip_bundle` (`src/app/api/trips/[id]/bundle/route.ts`) and `src/features/trips/tripPhase.ts`, Healthcare via `get_health_bundle` (`src/app/api/healthcare/route.ts`) — and Healthcare carries PHI, so respect `shared_with_household` and do not surface a private condition in a household signal. Build on HUB-41's provenance states and HUB-54's draft-only actions. Absorbs HUB-9.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed adapter fixtures cover meal person/status coverage, trip planner/live meaning, private healthcare exclusion and unavailable feeds. Pending medication signals remain fixture-only. Run affected ERA tests, `pnpm typecheck` and `pnpm lint`; owner confirms permitted two-account visibility separately.

```delivery-plan-v1
{
  "outcome": "Kitchen, Trips and Healthcare contribute bounded, source-aware ERA signals.",
  "acceptance": [
    "Each module signal preserves authorized scope and complete/partial/unavailable evidence.",
    "Existing domain owners supply facts; pending medication functionality is never represented as live."
  ],
  "scope": [
    "src/features/era/intents/resolvers",
    "src/features/era/intents/formatters",
    "src/lib/ai/context.ts"
  ],
  "steps": [
    "Take one producer at a time and inventory its accepted read contract through the Feature Map.",
    "Adapt Kitchen after KIT-4, using actual meal/person/status coverage; adapt Trips with planner/live phase semantics intact.",
    "Adapt Healthcare after HLTH-21, using the correct profile-sharing boundary and minimal permitted fields.",
    "Feed each adapter through HUB-41 provenance and HUB-54 proposal/door behavior; verify failures and cross-account scopes before enabling that producer."
  ],
  "invariants": [
    "An empty failed read never becomes no meals, no trip or no allergies.",
    "Healthcare clinical detail is not generic household context.",
    "No new mutation or recurrence engine is introduced by a signal adapter."
  ],
  "exclusions": [
    "Building medications, trip cascades, clinical advice or enabling all producers in one unbounded session."
  ],
  "risks": [
    "A shared container can hold private descendants whose existence must not leak through counts or summaries."
  ],
  "unknowns": [
    "Current producer maturity and privacy witnesses; independent ready producers can proceed while another remains gated."
  ],
  "dependencies": [
    "HUB-41",
    "KIT-4",
    "HLTH-21"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints. Revalidate cited source contracts and prerequisite receipts at dispatch; no live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-23

**Outcome:** Rank signals using explicit feedback.

- **Acceptance:** *(E-23)* Feedback-weighted ranker — 👎 history halves a signal type's rank. *(Plan sacrifice #4 if a gate is missed.)*

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Ranking over HUB-43's feedback and HUB-41's signals — do not start before both exist, or there is nothing to weight. The rule is narrow: a 👎 history halves that signal *type's* rank. Type identity should come from the signal registry HUB-41 establishes; the feedback store is HUB-43's. Keep the function pure and tested, in the style of `src/features/era/templates/vocabGrowth.ts` and `missTracking.ts`. Plan sacrifice #4 — droppable if a gate is missed.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Proposed pure ranker fixtures cover no feedback, positive feedback, an affected negative type, unrelated types, deterministic ties and unavailable source evidence. Verify the accepted half-weight rule without hidden compound decay. Run affected ERA tests, `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "Explicit briefing feedback adjusts signal ranking deterministically.",
  "acceptance": [
    "A signal type with applicable negative history receives the accepted half-weight penalty.",
    "No implicit click, missing response or failed delivery is treated as feedback."
  ],
  "scope": [
    "src/features/era",
    "src/components/era/dashboards"
  ],
  "steps": [
    "Read HUB-43's stored feedback identity and HUB-41's type/rank contract; define the exact applicable history window before enabling weighting.",
    "Implement a small pure rank function that applies the stated half-weight rule and stable tie ordering.",
    "Keep source availability, recipient eligibility and action safety gates ahead of presentation ranking.",
    "Measure the resulting type order with fixtures and show only the existing compact feedback affordances."
  ],
  "invariants": [
    "Ranking cannot create facts, broaden permissions or make an ineligible signal deliverable.",
    "No feedback leaves baseline rank unchanged.",
    "The same input and feedback snapshot yields the same order."
  ],
  "exclusions": [
    "A learning model, inferred sentiment, autonomous reinforcement or replacing the programme's delivery/usefulness gates."
  ],
  "risks": [
    "Repeatedly multiplying by one half per event can silently suppress a type more than the accepted rule specifies."
  ],
  "unknowns": [
    "History window and repeated-vote aggregation are not explicit; resolve only these semantics before activating the penalty."
  ],
  "dependencies": [
    "HUB-43",
    "HUB-41"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints. Revalidate cited source contracts and prerequisite receipts at dispatch; no live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-5

**Outcome:** Extract HubPage code only alongside a real feature.

- **Acceptance:** Decompose `HubPage.tsx` — no standalone extraction packet; per D10 it only shrinks as a rider on a real feature (E-13/HUB-16 is the sanctioned one this window).

- **Acceptance:** each extraction moves one pure concern out of `HubPage.tsx` with its own test, and the file's line count goes down rather than up in that session.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Not a standalone packet by owner decision D10: `src/components/hub/HubPage.tsx` (6,275 lines, verified 2026-09-20) shrinks only as a rider on a real feature, and HUB-16/E-13 is the sanctioned rider this window. The acceptance is measurable and strict — each extraction moves **one pure concern** out with its own test, and the file's line count must go down in that session. Read `ERA Notes/01 - Architecture/Common Patterns.md` first; the risk in extracting from this file is the Framer-Motion-versus-HTML5-drag conflict and the optimistic-mutation/ID-only-state idioms, not the size. Hub Chat is a Junction module (`ERA Notes/03 - Junction Modules/Hub Chat/`) bridging Budget, Items and the Shopping List — trace before moving anything.

**Execution plan — 2026-09-26**

**Readiness:** rider only.

**Verify:** Record HubPage line count before/after the sanctioned feature; run the extracted concern's focused test plus `pnpm typecheck` and `pnpm lint`. Exercise that feature's actual mobile flow. A line-count decrease alone cannot prove parity or justify unrelated cleanup.

```delivery-plan-v1
{
  "outcome": "HubPage sheds one pure concern while a real accepted feature is delivered.",
  "acceptance": [
    "Each extraction moves one concern with a meaningful regression test and reduces HubPage's size.",
    "HUB-16 is the sanctioned rider for this window; there is no standalone extraction programme."
  ],
  "scope": [
    "src/components/hub/HubPage.tsx",
    "src/components/hub",
    "src/features/voice-conversation"
  ],
  "steps": [
    "Select the accepted feature being implemented and identify exactly one pure concern that obstructs that work.",
    "Trace consumers and state/mutation ownership before choosing the proposed destination file; preserve shared-layer/module boundaries.",
    "Move the concern with a test for its real behavior, then wire the original host through the new seam.",
    "Verify the feature and imports, compare line counts and record the extraction as part of the feature's receipt."
  ],
  "invariants": [
    "No behavior change is justified merely by file size.",
    "Optimistic state, Undo and query invalidation retain one owner.",
    "Do not mix Framer Motion drag and HTML5 draggable semantics during movement."
  ],
  "exclusions": [
    "An independent HUB-5 dispatch, broad component decomposition, styling refresh or an extraction that only relocates duplication."
  ],
  "risks": [
    "Moving React state casually can change lifetimes and create stale selections or duplicate effects."
  ],
  "unknowns": [
    "The exact destination and concern are chosen from the sanctioned feature's source evidence, not predetermined by this plan."
  ],
  "dependencies": [
    "HUB-16"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints. Revalidate cited source contracts and prerequisite receipts at dispatch; no live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-21

**Outcome:** Verify the served revision and original product flows.

- **Acceptance:** Record actual served revision and both-device acceptance for the original ERA slice. CI alone is insufficient. Any old test-data cleanup requires fresh owner inspection and a manual runbook; no production experiment by an agent.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Verification, and the acceptance is explicit that CI alone is insufficient and that no agent runs a production experiment. Record the actual served revision — which is a deployment fact, not a repo fact — and both-device acceptance for the original ERA slice (`src/app/era/page.tsx`, `src/components/era/EraShell.tsx`, `CommandBar.tsx`). Any old test-data cleanup requires fresh owner inspection and a manual runbook produced with `.claude/skills/data-repair/SKILL.md`; the agent writes the SQL, the owner runs it (Hard Rule #26).

**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Record actual served revision, both devices and original ERA flows using the owner's application session. Attach expected/actual results and only necessary screenshots; compilation/CI are separate evidence. Any cleanup uses owner-reviewed inspect/backup/fix/verify/rollback SQL.

```delivery-plan-v1
{
  "outcome": "The original ERA slice has actual served-revision and two-device acceptance evidence.",
  "acceptance": [
    "The running deployment's revision is identified rather than assumed from HEAD.",
    "Both devices demonstrate the agreed original product flows; unresolved runtime failures are recorded precisely."
  ],
  "scope": [],
  "steps": [
    "Read the original shipped ERA criteria and current deployment/version indicator to build a short acceptance matrix.",
    "Reconcile existing owner receipts first; request only missing device/revision observations.",
    "Have the owner exercise typed/voice capture, correct time/result, source navigation and recoverable failure on both devices as applicable.",
    "Record each result separately; if obsolete test data needs removal, inspect scope and provide a manual repair runbook before any owner action."
  ],
  "invariants": [
    "Local source, CI success and deployment are different facts.",
    "Agents do not create or delete production money/schedule fixtures.",
    "A successful model reply does not establish a saved domain action."
  ],
  "exclusions": [
    "Rebuilding shipped ERA, changing unrelated UI, live agent cleanup or turning missing evidence into an invented defect."
  ],
  "risks": [
    "A cached PWA revision can make two phones exercise different code while the repository is clean."
  ],
  "unknowns": [
    "Current served revision, device versions and outstanding owner witnesses."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints. Revalidate cited source contracts and prerequisite receipts at dispatch; no live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-22

**Outcome:** Add debt settlement and recurring-payment actions.

- **Acceptance:** Propose and confirm debt settlement and recurring-payment add/skip through existing domain contracts. Expense splitting is owned only by HUB-6; do not duplicate it here.
- **Status 2026-09-27:** recurring **covered** from chat is built (HUB-79: links an existing transaction behind a re-checked Confirm card with Undo; no match → prefilled form). Still open: debt settle (waits on BUD-68), recurring add and recurring-payment skip from chat.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two new ERA capabilities over **existing** domain contracts — the acceptance says propose and confirm, so both go through the draft/confirmation pattern, never a direct write. Register them in `ERA_CAPABILITIES` (`src/features/era/capabilities/registry.ts`, 13 entries today) with slots typed in `capabilities/types.ts`, resolvers under `src/features/era/intents/resolvers/budget.ts` and formatters alongside. Debt settlement's existing contract is `src/features/debts/`, `src/app/api/debts/` and `src/components/expense/DebtSettlementModal.tsx` — fix BUD-68's write-on-read before building on that GET. Recurring add/skip is `src/features/recurring/` and `src/app/api/recurring/`; `.claude/skills/recurrence-safety/SKILL.md` — skip is not postpone. Expense splitting belongs to HUB-6 only. Grounded target slots per HUB-64. `.claude/skills/money-rules/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Extend existing ERA capability/resolver fixtures for debt settle and recurring add/skip, including wrong target, mixed currency, repeat confirmation and failed inverse. Use a worked Budget balance example and owning recurrence tests; run `pnpm typecheck` and `pnpm lint`. No live money fixture.

```delivery-plan-v1
{
  "outcome": "ERA proposes and confirms debt settlement and recurring-payment actions through existing domain contracts.",
  "acceptance": [
    "Debt settlement and recurring add/skip require explicit review and use their owning APIs.",
    "Target identity, money/currency and recurring occurrence semantics survive confirmation and Undo."
  ],
  "scope": [
    "src/features/era/capabilities",
    "src/features/era/intents",
    "src/features/era/useEraAskAI.ts"
  ],
  "steps": [
    "Read the existing debt/recurring contracts, including BUD-68 repair evidence and any currency gate relevant to the chosen action.",
    "Dispatch debt settlement and recurring add/skip as separate bounded capability sheets with validated slots.",
    "Resolve exact authorized targets and present the existing proposal/confirmation flow; delegate to domain commands rather than writing records directly.",
    "Verify returned IDs/outcomes feed Activity and learning only on confirmed success, and bind Undo to the owning inverse."
  ],
  "invariants": [
    "Skip is not postpone; occurrence identity cannot be guessed from a label.",
    "No direct model money mutation or repeated posting on confirmation retry.",
    "A failed action never counts as successful learning."
  ],
  "exclusions": [
    "Expense splitting HUB-6, rebuilding recurring expansion, debt read-path repair or new currency conversion rules."
  ],
  "risks": [
    "A correctly parsed amount can still settle the wrong debt or skip the wrong payment occurrence."
  ],
  "unknowns": [
    "Current domain idempotency/inverse readiness and exact accepted currency behavior require revalidation."
  ],
  "dependencies": [
    "BUD-68",
    "HUB-64",
    "HUB-47"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints. Revalidate cited source contracts and prerequisite receipts at dispatch; no live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-60

**Outcome:** Provide household data export and verified restore.

- **Acceptance:** M-04: owner-controlled export includes schemas/relationships and an inspectable restore contract, household privacy and secrets exclusion. Rehearse on isolated data; restore must use domain inverses, not generic money row insertion.
- **Depends on:** [BUD-24](<../Budget/Budget — Master Book.md#bud-24>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on BUD-24, and for a good reason: "restore must use domain inverses, not generic money row insertion" is the same exactly-once inverse problem. Read `src/lib/balance-utils.ts` (`getBalanceDelta`, `getTransferDeltas`) and `src/features/recycle-bin/` for what a domain inverse looks like today. Export scope is the household, so `household_links` + `profiles` (Hard Rule #13) define the boundary, and secrets exclusion means no tokens, no push subscriptions, no Google refresh tokens — check `migrations/schema.sql` for which tables hold credentials before enumerating. Rehearse on isolated data; the agent never runs it against production (Hard Rule #26). Schemas and relationships in the export means the FK/cascade facts, which live in `migrations/db-state.json`, not `schema.sql` (Hard Rule #27).

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed isolated export/restore fixtures verify relationship completeness, secret exclusion, private household scope, repeated restore and money before/after through domain commands. Owner rehearses on isolated data with recorded counts/invariants; no production restore is performed by an agent.

```delivery-plan-v1
{
  "outcome": "The owner can inspect a household export and a verified, reversible restore contract.",
  "acceptance": [
    "Export covers agreed records, schemas and relationships while excluding credentials and unauthorized private data.",
    "Restore preserves domain semantics and idempotency; money is restored through owning contracts rather than generic row insertion."
  ],
  "scope": [],
  "steps": [
    "Inventory supported modules and classify relationships, private ownership and secret-bearing fields from current schema and owner-supplied DB metadata.",
    "Specify one versioned export manifest and a per-domain restore matrix; retain unsupported coverage explicitly instead of silently omitting it.",
    "After BUD-24's inverse contract, prepare a bounded implementation scope and isolated fixture for the first domain, then extend by module.",
    "Produce owner-controlled export/restore instructions with backup, verification and rollback evidence; record unverified production applicability separately."
  ],
  "invariants": [
    "No refresh tokens, push credentials, service keys or hidden partner records enter the export.",
    "Repeated restore cannot double-post balances or occurrences.",
    "Parked modules' retained history is considered explicitly."
  ],
  "exclusions": [
    "A generic database dump advertised as safe restore, production experiments or automatic cloud backup adoption."
  ],
  "risks": [
    "A readable export is not sufficient to reconstruct cross-module lifecycle and financial effects safely."
  ],
  "unknowns": [
    "Exact accepted coverage, current FK/cascade state and each domain's restore readiness; first pass is an inspectable contract."
  ],
  "dependencies": [
    "BUD-24"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints; exact source/schema and owner evidence need revalidation before implementation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-63

**Outcome:** Align chat receipts and badges with notification policy.

- **Acceptance:** Make chatNotificationPolicy the agreed recipient/read boundary for receipt and badge counts; avoid one surface reporting a delivered/unread state another suppresses. Include household and reconnect cases.
- **Depends on:** [NOTIF-19](<../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-19>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on NOTIF-19. The policy module already exists and is already the boundary in one place: `src/features/hub/chatNotificationPolicy.ts` (with `chatNotificationPolicy.test.ts`), imported by `src/app/api/hub/messages/route.ts` (verified 2026-09-20). The mismatch to fix is other surfaces computing delivered/unread independently — read `src/app/api/hub/mark-read/route.ts`, `src/app/api/hub/stats/route.ts`, `src/app/api/hub/feed/route.ts` and the badge counts in `src/components/hub/HubPage.tsx`, and make them all consult the same policy. Household cases follow Hard Rule #13; reconnect cases are the realtime/offline path (`src/contexts/SyncContext.tsx`). Note the private-thread exclusion already enforced on both the immediate push path and the cron — do not regress it.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend existing `src/features/hub/chatNotificationPolicy.test.ts` and proposed receipt/count fixtures for private/public threads, read-before-send, two accounts and reconnect. Assert receipt state and counts reflect the same event identity; run `pnpm typecheck` and `pnpm lint` without sending live pushes.

```delivery-plan-v1
{
  "outcome": "Chat receipts and badges use the agreed recipient/read boundary consistently.",
  "acceptance": [
    "Immediate/fallback delivery, receipt reads and badge counts do not independently contradict recipient eligibility.",
    "Household and reconnect behavior preserves private-thread exclusion and durable read state."
  ],
  "scope": [
    "src/features/hub/chatNotificationPolicy.ts",
    "src/features/hub/chatNotificationPolicy.test.ts",
    "src/app/api/hub/mark-read/route.ts",
    "src/app/api/hub/stats/route.ts",
    "src/app/api/hub/feed/route.ts",
    "src/components/hub/HubPage.tsx"
  ],
  "steps": [
    "Trace one message identity through immediate push, fallback, receipt marking and each badge query; enumerate actual discrepancies.",
    "Separate delivery eligibility from durable read state so mute/quiet policy cannot automatically mark a message read.",
    "Apply the agreed chatNotificationPolicy decisions at the relevant shared boundaries without duplicating NOTIF-19.",
    "Verify reconnect and partner read races, preserving receipt identity and refreshing all displaying query keys."
  ],
  "invariants": [
    "Private threads never notify or reveal unread content to the partner.",
    "Suppressed push does not imply delivered or read.",
    "Repeated receipt updates do not inflate badge counts."
  ],
  "exclusions": [
    "New notification policy, chat redesign, changing private-thread scope or a second receipt store."
  ],
  "risks": [
    "Making all surfaces 'match' by dropping unread messages can hide real household conversation."
  ],
  "unknowns": [
    "Current policy shape and observed receipt/count divergence require source-level reproduction first."
  ],
  "dependencies": [
    "NOTIF-19"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints; exact source/schema and owner evidence need revalidation before implementation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-65

**Outcome:** Resolve household identity across unlink and relink.

- **Acceptance:** Held for DEC-13. Decide stable household container versus link-epoch identity, then align retained data and new sharing. Do not migrate household ownership from stale prose.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-13, and the prohibition is pointed: do not migrate household ownership from stale prose. The choice is a stable household container versus link-epoch identity, and what makes it hard is retained data — every module's household reads go through `household_links` today (Hard Rule #13, canonical in `src/app/api/accounts/route.ts`), so an unlink/relink either preserves or severs visibility of everything shared before. Get the current DB shape from `migrations/db-state.json` (Hard Rule #27), including whether `household_members` exists at all — DEC-18 under HUB-62 is deciding that. Write the decision, with a worked before/after for one shared record, into `_Decisions.md` before any migration.

**Execution plan — 2026-09-26**

**Readiness:** investigation first; lifecycle mutation held on DEC-13.

**Verify:** Use worked read-only scenarios: A/B share record, unlink, relink same partner, link a different partner and owner deletion. Compare visibility/ownership outcomes for each option; current DB snapshot and owner decision are required before any migration.

```delivery-plan-v1
{
  "outcome": "A recorded household-lifecycle decision defines ownership and visibility across unlink/relink.",
  "acceptance": [
    "DEC-13 chooses stable container or link-epoch identity with explicit treatment of retained shared history.",
    "Any future migration is based on current deployed shape and preserves the chosen privacy contract."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md"
  ],
  "steps": [
    "Use HUB-62 evidence to inventory current household_links/profiles/household_members ownership references without changing data.",
    "Build the small scenario matrix for historical records, new sharing and independent user-owned data under both identity options.",
    "Ask the owner to settle only the consequential lifecycle differences; record the choice and affected canonical consumers.",
    "Prepare a separate migration/rollout plan after the choice, including retained-history verification and rollback rather than inferring a safe conversion."
  ],
  "invariants": [
    "Current visibility rules continue until an explicit accepted change.",
    "Relinking must not silently disclose an old partner's private/history data.",
    "A table's existence is not evidence of its active ownership role."
  ],
  "exclusions": [
    "Choosing the household model for the owner, dropping household_members or running a production unlink experiment."
  ],
  "risks": [
    "Changing identity globally can alter every module's sharing boundary at once."
  ],
  "unknowns": [
    "DEC-13 and DEC-18, current deployed use and intended retained-history policy."
  ],
  "dependencies": [
    "HUB-62",
    "DEC-13",
    "DEC-18"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints; exact source/schema and owner evidence need revalidation before implementation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-66

**Outcome:** Choose keep, maintain or park for the module estate.

- **Acceptance:** Top Layer phase2 owner census: record one disposition per existing module and which daily flow justifies it. Preserve data/history for parked modules; no speculative new campaign or deletion.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A census, not engineering: one recorded disposition (keep / maintain / park) per module, each justified by a daily flow. The module list is CLAUDE.md's Feature Index and `ERA Notes/01 - Architecture/Feature Map/_index.md`; the per-page inventory is `ERA Notes/04 - UI & Design/Page & Feature Atlas/_Index.md` and `public/atlas/atlas.json`. Two constraints: parked modules keep their data and history (no deletion), and this produces no new campaign. Record dispositions in the PM vault per `ERA Notes/10 - Project Management/_Conventions.md`, not in code.

**Execution plan — 2026-09-26**

**Readiness:** owner decision supported by inventory.

**Verify:** Reconcile the Feature Map/module list and Atlas against current routes; verify each module receives exactly one keep/maintain/park disposition and a daily-flow reason. Run `pnpm pm:lint` and `pnpm pm:check-docs` after documentation; do not count unavailable owner preferences as completed decisions.

```delivery-plan-v1
{
  "outcome": "The module estate has one owner-chosen keep, maintain or park disposition per existing module.",
  "acceptance": [
    "Each module is accounted for with the household flow that justifies its status.",
    "Parked modules keep data/history; no deletion or speculative campaign is implied."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md"
  ],
  "steps": [
    "Build a compact inventory from Feature Map and Atlas, reconciling aliases and hidden/legacy routes rather than listing every component.",
    "Attach only existing evidence of actual household use or owner statements; label unknown usage honestly.",
    "Present the owner a short per-module disposition list and record the chosen category plus one-line daily-flow rationale.",
    "Link consequences to existing campaign items without changing priorities, deleting code or inventing new work automatically."
  ],
  "invariants": [
    "Park means retained and out of active expansion, not deleted.",
    "The census has one canonical home and no duplicate backlog.",
    "A planning recommendation is not an accepted owner disposition."
  ],
  "exclusions": [
    "Instrumentation projects to infer usage, automatic feature removal or reorganizing campaigns."
  ],
  "risks": [
    "Route counts overstate independent modules and can make the inventory noisy or misleading."
  ],
  "unknowns": [
    "Current household preferences for modules without recent direct evidence."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints; exact source/schema and owner evidence need revalidation before implementation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-67

**Outcome:** Make bulk message conversion and inverse atomic.

- **Acceptance:** Complete the remaining conversion/link/inverse transaction contract: returned draft IDs, no duplicate recreation, exact retry and real inverse on partial failure. HUB-57/58 truthful acknowledgments alone do not prove atomicity.
- **Depends on:** [HUB-57](<Hub & ERA — Master Book.md#hub-57>), [HUB-58](<Hub & ERA — Master Book.md#hub-58>), [BUD-63](<../Budget/Budget — Master Book.md#bud-63>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on HUB-57, HUB-58 and BUD-63 — and the acceptance is explicit that truthful acknowledgments (57/58) do not prove atomicity. The conversion/link/inverse triple lives in `src/features/hub/messageActions.ts` (`useCreateMessageAction`, `useDeleteMessageAction`), `src/app/api/hub/message-actions/route.ts` and the bulk surface `src/components/hub/BulkConvertReviewSheet.tsx`, with the created object on the Budget side (`src/features/drafts/`, `src/app/api/transactions/`). Atomic means the draft/transaction and its link row commit together — which is BUD-63's shared boundary and should reuse it, not a second mechanism. "Exact retry" means idempotent under replay (`src/lib/offlineQueue.ts`), and "real inverse on partial failure" means the domain inverse, not a cache rollback.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed isolated transaction fixtures cover create+link rollback, response loss/retry, mixed selected records, confirmed/draft branches and exact inverse. Include $100→$80→$100 once for confirmed expense and $100 unchanged for draft. Run domain tests/`pnpm typecheck` and `pnpm lint`; owner SQL evidence is separate.

```delivery-plan-v1
{
  "outcome": "Bulk conversion and its inverse have one atomic, idempotent owning contract.",
  "acceptance": [
    "Each accepted conversion links the returned record identity within its transaction boundary.",
    "Exact retries cannot recreate a domain record; inverse handles partial failure without false completion."
  ],
  "scope": [
    "src/features/hub/messageActions.ts",
    "src/components/hub/BulkConvertReviewSheet.tsx",
    "src/app/api/hub/message-actions",
    "migrations"
  ],
  "steps": [
    "Verify HUB-57/58 truthful acknowledgments and BUD-63's shared financial boundary before extending it.",
    "Define per-record operation identity and conversion/link/inverse transactions for confirmed transactions, drafts and reminders; avoid claiming the whole mixed batch is atomic unless implemented.",
    "Implement the narrow server contract and reviewed migration, then route client conversion through it with explicit per-record outcomes.",
    "Exercise concurrent retry and inverse failure in isolated fixtures; invalidate affected views once per completed batch."
  ],
  "invariants": [
    "One operation identity survives response loss and queue replay.",
    "The real domain inverse owns balance/occurrence effects.",
    "Truthful client messages alone do not establish atomicity."
  ],
  "exclusions": [
    "Direct DB fallback, a parallel money engine, silently compensating unrelated records or production repair."
  ],
  "risks": [
    "A mixed-domain batch can partially commit even when each record is locally atomic; report that boundary precisely."
  ],
  "unknowns": [
    "BUD-63's final transaction API and reminder inverse readiness require revalidation."
  ],
  "dependencies": [
    "HUB-57",
    "HUB-58",
    "BUD-63"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints; exact source/schema and owner evidence need revalidation before implementation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-68

**Outcome:** Resolve existing floating-panel debt within the style freeze.

- **Acceptance:** Held for DEC-23: inventory source-present translucent overlays and agree the bounded correction compatible with the accepted ERA layout freeze. Future new panels already obey Hard Rule15; do not use this debt as permission to redesign.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-23, and the first deliverable is an inventory, not a fix: find the source-present translucent overlays. The rule they violate is Hard Rule #15 — a panel floating above page content must use `tc.bgPage` from `useThemeClasses()`, never `neo-card`, because glass/blur bleeds text through. Grep for `neo-card` in floating contexts across `src/components/` (`src/components/hub/`, `src/components/era/`, dropdowns and command palettes are the likely holders). The correction must stay compatible with the accepted ERA layout freeze, and the acceptance says explicitly this debt is not permission to redesign. New panels already obey the rule. `.claude/skills/ui-guardrails/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** investigation first; correction held on DEC-23.

**Verify:** Inventory only actual floating overlays and capture evidence of bleed-through at 390×844 under each relevant theme. Compare a minimal opaque-background correction without moving layout; after the decision run `pnpm typecheck` and `pnpm lint` and the affected open/close/focus checks.

```delivery-plan-v1
{
  "outcome": "Existing floating-panel debt has an agreed correction compatible with the ERA layout freeze.",
  "acceptance": [
    "A bounded inventory distinguishes floating panels from legitimate non-overlaid glass cards.",
    "DEC-23 selects the correction scope before changes; new panels already follow the opaque-panel rule."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md"
  ],
  "steps": [
    "Inspect actual floating contexts using neo-card/translucent backgrounds and list only verified overlay cases.",
    "Record route/component and mobile/theme evidence; do not treat every glass card as a violation.",
    "Prepare the smallest tc.bgPage correction for the identified panels and obtain the DEC-23 scope decision.",
    "After adoption, declare a separate exact UI write set and verify opacity, focus, dismissal and unchanged geometry."
  ],
  "invariants": [
    "The ERA orb/widget/navigation layout stays frozen.",
    "Inventory work does not authorize redesign.",
    "Person/theme identity survives any background correction."
  ],
  "exclusions": [
    "Repo-wide glass removal, card restyling, implementing an unaccepted visual option or treating future-panel compliance as a hold."
  ],
  "risks": [
    "A broad class replacement can flatten intentional non-floating cards and exceed the accepted design scope."
  ],
  "unknowns": [
    "Owner-approved existing-panel correction boundary under DEC-23."
  ],
  "dependencies": [
    "DEC-23"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints; exact source/schema and owner evidence need revalidation before implementation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-69

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C10. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Expose authorized catalogue search to ERA.

- **Acceptance:** Catalogue C10: bounded lexical search adapter returns permitted references with source IDs and availability; preserve source-owner permissions and no hallucinated document contents.
- **Depends on:** [KIT-20](<../_Archive/Shipped/Kitchen.md#kit-20>), [KIT-22](<../Kitchen/Kitchen — Master Book.md#kit-22>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C10, depends on KIT-20 and KIT-22. "Bounded lexical search" is deliberate — no embeddings, no model in the retrieval path; the risk being managed is hallucinated document contents, so the adapter returns **references with source IDs and availability**, never content it synthesized. Read `src/features/catalogue/hooks.ts` (`useCatalogueItems`, `useCatalogueItem`, `useCatalogueSubItems`) and `src/app/api/catalogue/items/route.ts` for the permission model, plus `src/types/catalogue.ts` for what a reference is. Source-owner permissions must survive the adapter — the same private-leakage constraint as KIT-18, TRIP-33 and HLTH-23. Register it as an ERA capability (`src/features/era/capabilities/registry.ts`). Gates HUB-70/71.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Proposed authorized-search fixtures cover exact/prefix/notes ranking, Arabic/Arabizi labels, duplicate titles, pagination ties, punctuation, private/deleted/unlinked records and revoked source. Assert no private count/snippet or model-invented ID. Run `pnpm typecheck` and `pnpm lint` and affected ERA tests.

```delivery-plan-v1
{
  "outcome": "ERA can find permitted Catalogue references through bounded lexical search with trustworthy sources.",
  "acceptance": [
    "Search authenticates and authorizes before ranking/counts/snippets, returns explicit coverage and opens the correct owner.",
    "Results carry existing IDs, source type, permitted snippet and revision/time where available."
  ],
  "scope": [
    "src/app/api/catalogue/search/route.ts",
    "src/lib/catalogue",
    "src/features/catalogue/queryKeys.ts",
    "src/features/era/capabilities",
    "src/features/era/intents"
  ],
  "steps": [
    "After KIT-20/22 contracts, inspect current Catalogue list/detail authorization and avoid GET-side initialization.",
    "Implement the proposed src/app/api/catalogue/search/route.ts and shared service under proposed src/lib/catalogue, with parameterized inputs, deterministic relevance and stable paging.",
    "Project only permitted per-kind fields, excluding clinical details/document numbers from generic context; expose partial/unavailable results.",
    "Register the ERA read capability and owner doors; keep ephemeral cache scoped to viewer/query and invalidate on edit/archive/logout/unlink."
  ],
  "invariants": [
    "No admin-read-everything/model-redact pattern.",
    "Exact selected IDs outrank fuzzy labels; ambiguous effects require choice.",
    "D17 note deployment does not block Catalogue search."
  ],
  "exclusions": [
    "Embeddings, vector/persistent search store, note migration or Schedule actions before Schedule gates."
  ],
  "risks": [
    "Ranking a truncated candidate set without coverage can confidently select the wrong reference."
  ],
  "unknowns": [
    "Measured query shape may justify an index/RPC; propose migration only with that evidence and explicit scope."
  ],
  "dependencies": [
    "KIT-20",
    "KIT-22"
  ],
  "risk": "high",
  "provenance": "2026-09-26: accepted Catalogue final build plan §10.4 and C10/C11a/C11b read against this item's criteria; planned paths and current data contracts must be revalidated at dispatch. No live permission/deployment claim.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-70

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C11a. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Correct saved notes with ID and revision preconditions.

- **Acceptance:** Catalogue C11a: use the deployed D17 branch, exact source ID, revision preconditions and complete paging; confirmation states the actual target. No correction from truncated search or unrelated memory.
- **Depends on:** [KIT-20](<../_Archive/Shipped/Kitchen.md#kit-20>), [HUB-69](<Hub & ERA — Master Book.md#hub-69>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The accepted Catalogue C11a packet owns the surviving saved-note path: `src/app/api/memories/route.ts`, `[id]/route.ts`, `src/features/memories/`, and Brain consumers. It is not a generic Catalogue `metadata_json` correction. Read Catalogue final build plan §10.4/C11a and current owner note existence/audience evidence; select D17's deployed-retain, approved ID-preserving fold, or absent-backend branch before writes. Preserve exact ID, revision preconditions, real inverse and complete paging; ambiguous names require choice. The existing declared dependencies remain part of the full item; do not invent a second note store.

**Execution plan — 2026-09-26**

**Readiness:** investigation first; note writes require D17 evidence.

**Verify:** Proposed note fixtures cover duplicate labels, same-ID correction/Undo, stale revision, creator/partner audience, complete paging and absent backend. If folding, owner-run isolated reconciliation verifies count/content/IDs/audience before retirement. Run `pnpm typecheck` and `pnpm lint` after scoped implementation.

```delivery-plan-v1
{
  "outcome": "Saved-note correction uses the retained note owner, exact identity and revision preconditions.",
  "acceptance": [
    "D17 selects the actual deployed note branch; one writer preserves existing IDs/authors/audience.",
    "Correction names and edits the selected note, supports a real inverse and never treats a capped list as all notes."
  ],
  "scope": [
    "src/app/api/memories",
    "src/features/memories",
    "src/features/era/intents/resolvers/brain.ts",
    "src/components/era/dashboards/BrainDashboard.tsx",
    "src/features/era/widgets/useBrainSummary.ts",
    "migrations"
  ],
  "steps": [
    "Use HUB-62 current note existence/audience evidence and HUB-40's D17 decision before enabling or moving any writer.",
    "If household_memories exists, repair that API; if an approved fold exists, use one ID-preserving facade; if absent, do not install a new store merely for Brain.",
    "Add revision-checked same-ID correction and real Undo, complete paging/total semantics and explicit ambiguity choice.",
    "Remove unsupported overwrite promises and invalidate relevant snippets/proposals so old transcript content cannot override corrected source truth."
  ],
  "invariants": [
    "This is C11a's saved-note path, not a generic Catalogue metadata writer.",
    "No correction from truncated search or unrelated focus.",
    "A fold preserves audience and history before retiring the old writer."
  ],
  "exclusions": [
    "Unapproved note migration, a new Memory service or forcing notes into Catalogue."
  ],
  "risks": [
    "Changing storage ownership can expose private historical notes or lose their IDs."
  ],
  "unknowns": [
    "Current note deployment and D17 branch; code existence alone does not resolve either."
  ],
  "dependencies": [
    "KIT-20",
    "HUB-69",
    "HUB-62",
    "HUB-40"
  ],
  "risk": "high",
  "provenance": "2026-09-26: accepted Catalogue final build plan §10.4 and C10/C11a/C11b read against this item's criteria; planned paths and current data contracts must be revalidated at dispatch. No live permission/deployment claim.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-71

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C11b. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Ground reference retrieval and correction in sources.

- **Acceptance:** Catalogue C11b: source-aware retrieval/correction uses authorized records and visible lineage, handles partial/unavailable evidence and never takes ownership from the source module.
- **Depends on:** [HUB-69](<Hub & ERA — Master Book.md#hub-69>), [HUB-70](<Hub & ERA — Master Book.md#hub-70>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Read accepted Catalogue C11b and HUB-69's authorized search contract. ERA validates returned source IDs, preserves complete/partial/unavailable coverage and opens/delegates corrections to the owning module with permission/revision rechecks. C11b permits Catalogue-only integration before C11a notes, but this full item's declared HUB-70 prerequisite remains: reconcile a separately bounded slice's scope/dependency declaration before dispatching it independently. Note-source integration waits for HUB-70; Schedule projections retain their own parity gate. Source targets are Brain resolver/formatters, capability registry and `/api/era/ask`, not a universal ERA writer.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft; current full item retains declared prerequisites.

**Verify:** Extend existing ERA capability/resolver fixtures with two matches, forged model ID, source chips, stale/revoked/deleted source at confirmation and partial/unavailable context. Assert read failure causes zero writes/learning and corrected values replace cached snippets; run `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "ERA retrieves authorized source facts and routes corrections back to their owning records.",
  "acceptance": [
    "Factual answers cite returned permitted references with lineage and coverage.",
    "Confirmation rechecks authorization/revision; ERA does not create an overriding Brain fact."
  ],
  "scope": [
    "src/features/era/intents",
    "src/features/era/capabilities",
    "src/app/api/era/ask/route.ts",
    "src/lib/ai/context.ts",
    "src/lib/ai/eraAskProposal.ts",
    "src/components/era/dashboards/BrainDashboard.tsx"
  ],
  "steps": [
    "Connect HUB-69's Catalogue source adapter to a bounded source-aware read capability and existing Brain/Ask AI consumers.",
    "Validate model references against the authorized returned candidate set and show ambiguity choices rather than selecting a title match.",
    "Open the correct source editor or delegate a revision-checked owner command; reauthorize at confirmation and invalidate affected previews/proposals.",
    "Enable the note source only after HUB-70. C11b permits a Catalogue-only slice after HUB-69, but reconcile that slice's scope/dependency declaration before dispatch; the current full item still follows its declared HUB-70 prerequisite."
  ],
  "invariants": [
    "Historical transcript text is not fallback current truth after correction or deletion.",
    "Private amounts/clinical facts are omitted before model context, not merely visually masked.",
    "No mutation or successful learning follows read failure."
  ],
  "exclusions": [
    "Projection tables, new memory authority, unrequested ERA redesign or cross-domain generic writes."
  ],
  "risks": [
    "A previously permitted reference can become unauthorized between an answer and action confirmation."
  ],
  "unknowns": [
    "Current producer revisions and note/Schedule readiness; any Catalogue-only slice needs scope/declaration reconciliation before independent dispatch."
  ],
  "dependencies": [
    "HUB-69",
    "HUB-70"
  ],
  "risk": "high",
  "provenance": "2026-09-26: accepted Catalogue final build plan §10.4 and C10/C11a/C11b read against this item's criteria; planned paths and current data contracts must be revalidated at dispatch. No live permission/deployment claim.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-95

**Outcome:** ERA reuses an existing contact instead of duplicating it.

- **Acceptance:** "Add Laura as a contact" when Laura exists (by normalized name) answers `Already in Contacts · Laura` with a door to open it, and writes nothing. The partner's adds land in a module the partner can see and keep using. Gym cases cover the duplicate, a near-name and the partner path.
- **Depends on:** [HUB-93](#hub-93) (the same resolver; do both in one pass).
- **Progress (2026-11-25, HUB-123):** the duplicate path is done: a normalized-name match answers `Already in Contacts · <name>` and writes nothing (Gym `report-hub-95`); an uncategorized match also asks **Category?** with a [Details] door. Still open: the partner path and the near-name case.
- **Reading guide:** Copy the `loadPlaces` / `matchPlace` pattern from `resolvers/places.ts`. Audience rule (Kitchen KIT-26, owner 2026-10-05): shared unless explicitly private, so ERA-created catalogue rows take `is_public = true`.

### HUB-96

**Outcome:** An event at a saved place carries that place's Maps link.

- **Acceptance:** When ERA attaches a saved place (`metadata_json.place_id`) to an event, it also fills the event's location link from the place's `maps_url` if one is set. Editing the place's link later doesn't rewrite past events (live-reference vs snapshot, ASTRA §10.2).
- **Reading guide:** Place metadata keys: `PlaceItemMetadata` in `src/types/catalogue.ts`. Entry point: the HUB-94 "Where?" flow.

### HUB-97

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h05--shopping-lists-groups-and-multiline-capture>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA adds a list of items to the shopping list however the household phrases it.

**Kind:** bug
**Implementation:** done
**UAT:** pending

- **Acceptance:** "Add A, B, C. To spinneys shopping list", "Add A, B and C to spinneys shopping list", "Add A to shopping chat" and "Add to shopping list A, B and C" each add every item with Undo. A store named before "shopping list" files the items under that group; an unknown store adds them to General and offers the group. "Weekly"/"usual" etc. are not groups. "Don't add …" writes nothing.
- **Evidence (2026-10-10):** Gym `report-hub-97` (+ `-b`, `-c`, `-d`) red → green; `-e` and `-neg` green throughout. Known-miss list unchanged (20), release gates pass. `pnpm vitest run tests/era-gym src/features/era src/lib/era src/lib/ai`: 512 passed. Router rows in `rootIntentRouter.test.ts` (HUB-97). Typecheck clean.
- **Owner check (phone):** send the four sentences above with **Send** (not ✨).
- **Reading guide:** `src/features/era/intents/chef.ts` (shopping grammar) → `resolvers/shopping.ts` (`splitShoppingItems`, `resolveAddShopping`).

### HUB-98

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h13--provider-failures-stay-honest-and-diagnosable>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Ask AI fails less often, and when it does fail the reason is in the server log.

**Kind:** bug
**Implementation:** done
**UAT:** pending

- **Acceptance:** A 5xx from the primary Gemini model goes straight to the fallback model; a 400 never does. Every Ask AI failure logs `[era-ask] model call failed: <reason>` or `[era-ask] unusable model answer {finishReason, chars}` to the Vercel log. The output cap leaves room for thinking tokens.
- **Evidence (2026-10-10):** `src/lib/ai/gemini.test.ts` (503 → fallback, 500 on both → rethrown and not a rate-limit error, 400 → no fallback). Typecheck clean. Live Gemini not called.
- **Owner check:** next time "I couldn't reach the AI" appears, search the Vercel logs for `[era-ask]`. `finishReason: MAX_TOKENS` confirms the thinking-token hypothesis. A 503 means both models were down.
- **Reading guide:** `src/lib/ai/gemini.ts` (`generateContentWithFallback`) → `src/lib/ai/eraAskProposal.ts` (`generateAskAIResponse`).

### HUB-99

**Outcome:** A typed sentence never skips ERA's own understanding by accident.

**Kind:** decision
**Implementation:** not started

- **Acceptance:** Tapping beside Send can't send a sentence to the AI that ERA itself handles. Owner picks one: (a) give ✨ its own padded target with clear space from Send (keeps the "always visible" decision); (b) show ✨ only after a miss or an open question, not while typing (changes that decision). Recommendation: (b), because the router-first rule (HUB-77) then holds for every typed sentence.
- **Evidence:** 2026-10-05 transcript. The two "Add to shopping list Small Pepsi Can, bread, cheese, and eggs" turns got the server's AI fallback line, although the router returns `addShopping` for that sentence and `useEraTurn` only calls the AI on a miss. To confirm, run this read-only query in the SQL Editor: `select created_at, role, intent_kind, left(content,60) from era_messages where created_at::date = '2026-10-05' and created_at::time between '04:55' and '05:30' order by created_at;` In the result, a user row with `intent_kind` null was sent with ✨.
- **Reading guide:** `src/components/era/CommandBar.tsx` (`askAIClick`, `canAskAI`, the two buttons).

### HUB-100

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h10--ai-shopping-and-a-reviewed-recipe-to-meal-plan>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Ask AI knows the shopping list exists and can propose adding to it.

**Kind:** enhancement
**Implementation:** done

**UAT:** pending

- **Acceptance:** A shopping sentence the grammar misses gets a confirm card from Ask AI, never "I don't have a shopping list feature". `shopping.add` (items, optional group) wraps `resolveAddShopping`, has a `shopping` vocab bucket, and a registry test row.
- **Cost:** any registry change alters the Ask AI prompt, so every recorded Gym model reply goes stale (`tests/era-gym/gym.ts` `replayModel`). Re-record in the same session; that is a live Gemini run the owner approves.
- **Reading guide:** `src/features/era/capabilities/{registry,vocab,types}.ts`.

- **Evidence — 2026-10-10:** `shopping.add` wraps the shipped adapter; `shopping` vocabulary participates in miss classification. A real Gemini grocery paraphrase produced the validated confirm proposal. Registry tests and agent route-fixture tests pass. Older Gym recordings refreshed with 16 new model calls; no production DB used.

### HUB-103

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h10--ai-shopping-and-a-reviewed-recipe-to-meal-plan>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA understands compound requests, discovers registered capabilities and executes bounded dependent steps through the existing application.

**Kind:** feature
**Implementation:** done
**UAT:** pending

- **Acceptance:** Every step in a supported compound request reaches a registered action; actual earlier results supply dependent slots. All steps validate before execution. Reads answer from the app; writes require Confirm. Ambiguous/missing references, invalid outputs and failures stop subsequent work. Duplicate confirmation cannot repeat a write. Completed and partial artifacts and source caches survive a failed later step. Document supported requests, limitations and next work.
- **Scope:** Existing `useEraTurn`/`useEraAskAI`/`/api/era/ask` and `capabilities/`; no production writes or new schema. Preserve native single-command and voice wiring, source-module permissions, parser and financial paths.
- **Evidence — 2026-10-10:** Eight real Gemini synthetic-request probes pass and replay in CI. Actual adapters execute recipe → meal + shopping, named-reminder rescheduling, and shopping + reminder against isolated route fixtures. Admission, partial-failure, invalid reference, stale-focus and one-time confirmation tests pass; existing ERA/Gym regression suite passes. Existing 205-case Gym baseline is legacy-path evidence, not agent general accuracy. See [Agent v1 implementation and limits](<../../03 - Junction Modules/AI Assistant/Overview.md#era-agent-v1--2026-10-10-hub-103--hub-100>).
- **Owner acceptance:** Try the documented positive requests at phone width on the served revision. Confirm Dismiss produces no domain writes, Confirm records all artifacts and source pages refresh. Live DB/RLS and device effects were not exercised. Browser QA was blocked by the Computer Use Node runtime requirement (≥22.22 versus installed 22.20); no environment changes performed.
- **Verification receipt:** Typecheck and changed-file ESLint pass; 526 scoped ERA/Gym/Ask AI tests pass, one existing opt-in recording test skipped. Four live-model recordings also execute through real adapters on isolated routes; HTTP/network partial shopping failures retain prior artifacts. Full-suite failures are outside ERA: three sandbox PM build failures passed with directory access; two untouched Delivery journey cases expect raw test output despite the redacted-output receipt contract. Full lint errors are confined to generated `.tmp/chores-ui-qa/dist/app.js` (20). PM/doc checks pass. No production DB access.
- **Next:** HUB-104 supplies opt-in saved execution and pending-step continuity. Owner migration/device acceptance precede enabling it. HUB-46 retains offline capture acknowledgment and source-endpoint idempotency; HUB-81 broader source-adapter reach, HUB-102 complete inverses and HUB-44 usage attribution remain open.

### HUB-104

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h11--resume-saved-progress-without-repeating-an-uncertain-write>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Registered agent plans retain consent and progress across sessions, resume from real outputs and stop ambiguous writes from being replayed.

**Kind:** feature
**Implementation:** done
**UAT:** pending

- **Acceptance:** Save a plan before execution; acquire a versioned attempt before each source call. Completed outputs/artifacts survive partial failures, reload and missing transcript delivery. Restore confirmation or the exact pending step through History → Continue. Competing confirmations cannot dispatch twice. Recover interrupted reads safely; interrupted/partial writes remain uncertain and offer inspection/Skip/Stop. New chat suspends later steps and late answers stay in the originating conversation. Retain source permissions, date semantics, cache refresh and existing native paths.
- **Design:** `era_runs` plus authenticated `save_era_run` transaction, owner-only read RLS, server-validated transitions and attempt fencing. The same executor/resolvers run in the client; no worker, second queue or model-driven replay. Relative dates use the original request date; changed time zones and stale/changed reminder targets refuse resumed writes. Canonical artifact projection shares the journal transaction and deduplicates receipts.
- **Verification — 2026-10-10:** 555 ERA/Gym/Ask AI tests pass, one existing opt-in recording test skipped. The 29 execution tests include isolated actual-migration PostgreSQL concurrency/RLS/rollback, lost receipt after commit followed by fresh-session resume, competing confirmations, pending reminder completion, partial shopping checkpoint failure, owner/new-chat interruption and changed targets/dates/time zones. Typecheck and changed-source ESLint pass; two pre-existing schedule warnings remain. Full repository run passes 3,536 tests with five failures; three PM build tests pass on rerun with directory access, leaving the two existing Delivery receipt-output assertions. PM lint and doc/criteria/links checks pass. No new model calls or production DB access.
- **Rollout:** Owner runs `migrations/2026-10-10_era-execution-journal.sql`, refreshes the DB-state snapshot, then enables `NEXT_PUBLIC_ERA_DURABLE_EXECUTION=true` and rebuilds. Flag defaults off. Do not report the migration as applied or production reliability as witnessed.
- **Owner acceptance:** At phone width, resume a meal + shopping plan after reload without repeating the meal, resume a pending date question, race confirmation on two devices, and recover an interrupted shopping write without a retry button. Computer Use initialized but returned no browser surfaces; Chrome creation was unavailable, so visual/device QA could not run.
- **Limits:** No source exactly-once guarantee across the source-write/checkpoint gap; no whole-plan rollback, automatic continuation/retries or automatic reconciliation of unacknowledged shopping creates. Native standalone capture/cards and the NFC two-write path remain unchanged. HUB-46 remains open.
- **Reading guide:** [Execution contract and rollout](<../../03 - Junction Modules/AI Assistant/Overview.md#durable-execution-foundation--2026-10-10-hub-104>); `src/features/era/execution/`, `src/app/api/era/runs/`, `src/components/era/EraRunCards.tsx` and the owner-run migration.

### HUB-105

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#hub-105-and-hub-107--partial-implementation-not-full-delivery-acceptance>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA discovers reviewed capabilities and module reach from current contracts, while new backend functions become visible integration candidates without acquiring write authority.

**Kind:** feature
**Touches:** `src/features/era/capabilities/`, `src/lib/ai/eraAskProposal.ts`, `scripts/era/`, `scripts/era-capabilities.mjs`, `tests/era-gym/`, `package.json`
**UAT:** pending

- **Acceptance:** Purpose, strict input/output schemas, source routes and confirmation/recovery constraints are derived from the registry; no separate prompt slot shape or per-workflow prompt teaching. All Feature Index modules remain discoverable, with executable actions separated from pages/native reach. New API methods enter a static report; disappeared registered routes/methods fail tests. Real dependency outputs must fit every consumer before any later step runs. Current-prompt synthetic model recordings and isolated source-adapter requests pass, including unsupported compound requests that must not be partially proposed.
- **Source-present — 2026-10-10:** 18 registered capabilities; read-only `app.capabilities`; memory recall output bindings; strict single-action validation; early downstream-data preflight; static API audit across 400 exported operations (18 declared adapter source operations, 382 unreviewed). No write-family expansion or DB changes. Existing journal, confirmation, source resolvers, artifacts and cache handling are retained.
- **Verification:** 555 local ERA/Ask AI/real-adapter tests pass, including saved-receipt dependency preflight; typecheck and changed-source ESLint pass. The wider ERA suite's eight old pinned recordings fail because the prompt changed; four new model cases also need recordings. No hashes or model responses were fabricated. See [discovery contract](<../../03 - Junction Modules/AI Assistant/Overview.md#capability-discovery--2026-10-10-hub-105>).
- **Remaining gate (updated 2026-10-11):** The owner explicitly approved Google Gemini but limited testing to one combined call for all twelve scenarios, with a request/response/status Markdown report and confirmation before any further tests. Exactly one HTTPS request ran with no retries or fallback and a 4,096-token generated-output cap. Gemini returned HTTP 200 / `MAX_TOKENS`, with truncated JSON: 3,065 input, 150 visible output, 3,932 thinking, 7,147 total API-reported tokens. No individual scenario was scored; the batch JSON decode failed before per-case admission/assertions. [One-call report](<../../../tests/era-gym/AGENT-BATCH-2026-10-11.md>) preserves requests, returned fragments, missing responses and statuses; the adjacent JSON receipt preserves the outbound body and API envelope. Original individual-call recordings remain stale/missing because batch evidence is a different request shape. No retry, Vitest replay or other tests followed. Further testing requires fresh owner confirmation. No household records or production data were sent or accessed.
- **Paced pass — 2026-10-11 (owner-approved):** the original per-scenario method, 12 sequential calls 30 s apart, no retries/fallback: **12/12 PASSED**, all `STOP`, 126–1,717 thinking tokens per call. [Paced report](<../../../tests/era-gym/AGENT-PACED-2026-10-11.md>). `recordings/agent-responses.json` deliberately not refreshed, so the replay test still fails on stale hashes until a recorded refresh is approved. Protocol codified as Hard Rule #29 + `01 - Architecture/Live API Testing Protocol.md`.
- **Next priorities:** HUB-46 source-endpoint idempotency and authenticated reconciliation; HUB-102 inverses; HUB-69 and HUB-81 source-owned read adapters with privacy/readiness contracts. Keep full catalog visibility now; measure bounded schema retrieval only when catalog growth warrants it. No unrestricted HTTP execution, automatic replay or unreviewed tool exposure.

- **Final-review gate — 2026-10-11 (HUB-108):** Twelve replay failures persist (eight stale fingerprints, four missing entries). The paced 12/12 report is historical evidence without the matching prompt/schema fingerprints, not authority to rewrite old hashes. Before another approved paid pass, make the recorder enforce Hard Rule #29: fixed scenarios/call ceiling, exclusive lock, ≥30-second pacing, no retries/fallback, stop on error and incremental receipt with system/schema/request fingerprints. The legacy `ERA_AGENT_RECORD=1` branch does not enforce these guarantees. Extend held-out evaluation to omitted constraints, conditional money, corrections, private-context injection and actual whole-goal completion; capability-ID equality alone is insufficient. No paid rerun was performed by this review.

### HUB-106

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h12--context-belongs-to-its-speaker-chat-and-actual-outcomes>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA reuses meaningful personal context and prior experience across faces, understands contextual follow-ups and recognizes limitations without adding taught phrases or sharing private learning.

**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** `src/lib/ai/eraAdaptiveContext.ts`, `src/lib/ai/eraAdaptiveContextSource.ts`, `src/lib/ai/eraAdaptiveContext.test.ts`, `src/lib/ai/eraAdaptiveContextSource.test.ts`, `src/lib/ai/eraAdaptiveContext.integration.test.ts`, `src/lib/ai/eraAskProposal.ts`, `src/app/api/era/ask/route.ts`, `src/app/api/era/ask/route.test.ts`, `src/features/era/adaptiveTurn.ts`, `src/features/era/adaptiveTurn.test.ts`, `src/features/era/conversationOwnership.test.ts`, `src/features/era/useEraAskAI.ts`, `src/features/era/useEraTurn.ts`, `src/features/era/useEraConversation.ts`

- **Acceptance:** Authenticated private episodes, valid explicit choices, acknowledged experience, source coverage and own activity counts reach the existing model on every face. Histories merge without duplicating the current question or confusing speakers. A recent dialogue can interpret a keyword-free router miss; New chat/expiry/negation remain guarded. Failed/pending/uncertain/partial/reported actions cannot become successful experience; unconfirmed legacy examples, revoked choices and stale references are inert. Historical evidence cannot grant entity IDs, write authority or a new capability. No automatic preference promotion, shared-memory values, new phrase rules or new DB store.
- **Design:** Read-only context assembled per request, bounded by 30 days/400 historical rows/six episodes/12,000 characters; current history at most 24 turns/12,000 characters. Six independent optional source reads share one latency layer and each has a two-second abort. User statements remain attributed; successful action descriptions require receipts. Explicit lexicon choices retain conditions; observations remain tentative. Usage is currently visible own-record/own-actor module counts, never personal values or partner facts. A source receipt is persisted without copying private context.
- **Verification — 2026-10-11:** All 54 new synthetic-context, retrieval-boundary, actual conversation-mutation, real API wiring and SDK/admission cases pass. They cover preferences/conflicts, follow-ups, account switches, unknown offline identities, malformed input, archived-parent predicates, reports, stale dependencies, plan receipts, missing sources, historical target IDs and an initial confirmation card followed by a real acknowledged receipt. Typecheck and changed-source ESLint pass. Final wider ERA/AI/Gym run: 652 pass, one existing opt-in test skipped, twelve pre-existing stale/missing agent-model recordings fail under HUB-105 (`Refresh with ERA_AGENT_RECORD=1` / `Prompt changed: refresh the model evidence`). No recordings/hashes were fabricated or refreshed. PM lint, criteria/links and Feature Map checks pass; only the existing empty Delivery Next-lane warning remains. The local static PM dashboard was rebuilt with the filesystem access esbuild requires, without publishing.
- **Owner acceptance:** On a served build, state a preference, continue on another face, then ask a related question in a new chat; check attribution/clarification rather than invented current facts. Ask a keyword-free follow-up in the active chat. Switch accounts and confirm no previous speaker's context is submitted. Report a wrong result and verify it is not reused as successful experience. Live model quality, deployed source readiness and mobile/browser behavior remain unverified. No production DB access or migration was performed or required.
- **Limits / next:** This is bounded lexical episode retrieval and model context, not model retraining or permanent inferred preference storage. Whole-history semantic recall and automatic preference extraction need source scope, correction/revocation and measured recall gates. Shared `household_memories` is referenced by the existing route but absent from schema/DB-state evidence, so automatic ingestion is unavailable; D17/HUB-70 remain authoritative. Source-adapter expansion stays with HUB-69/71/81; outcome/template hardening remains HUB-47/64 and is not declared complete here. See [adaptive architecture and inventory](<../../03 - Junction Modules/AI Assistant/Overview.md#adaptive-context-foundation--2026-10-10-hub-106>).

### HUB-107

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#hub-105-and-hub-107--partial-implementation-not-full-delivery-acceptance>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** The app's AI layer runs on Claude Haiku 5.5 (Anthropic) instead of Gemini, with equal-or-better ERA accuracy.

**Kind:** feature
**UAT:** pending
**Touches:** `src/lib/ai/` (gemini.ts, eraAskProposal.ts), `src/app/api/era/ask`, `ai-chat`, `ai-chat/stream`, `focus-insights`, `suggest-schedule`, `budget-allocations/ai-suggest`, 5 recipe AI routes, `tests/era-gym/`, `docs/ENV.md`

- **Why (owner, 2026-10-11):** Gemini is causing friction and the owner prefers the Anthropic ecosystem. Cost: Gemini paid-as-you-go $0.25 over 90 days; the same token volume on Haiku 5.5 ($0.10/$0.50 per MTok vs Gemini 3.8 Flash $0.75/$3.75 intro, doubling 2027-01-01) ≈ $0.03.
- **Acceptance:** (1) One paced pass of the 12 ERA agent scenarios on Haiku 5.5 (Hard Rule #29) scores ≥ the Gemini 12/12 before any code swap. (2) One provider-neutral client in `src/lib/ai/` replaces Gemini call sites; schemas converted to Claude structured outputs. (3) ERA first, then ai-chat (streaming), then the remaining routes, each verified. (4) Gemini code, env vars and fallback removed; gym recordings re-recorded; AI Assistant vault doc + ENV.md updated.
- **Gate:** needs `ANTHROPIC_API_KEY` with prepaid credit from the owner.
- **Progress — 2026-10-11 (ERA slice, code only, not deployed):** `src/lib/ai/anthropic.ts` (`generateClaudeJson`: SDK `@anthropic-ai/sdk` 0.133.0, default `claude-haiku-5-5`, JSON-schema structured output, effort `low`, 40 s timeout, one SDK retry). `eraAskProposal.ts` calls it; `ASK_AI_RESPONSE_SCHEMA` is now plain JSON Schema; prompt and admission unchanged. `agent-record.test.ts` records against Claude under Hard Rule #29 (stale cases only, 30 s apart, `maxRetries: 0`, `.tmp/era-agent-record.lock`). Typecheck + changed-file ESLint clean; ERA/AI/Gym run 641 pass, 1 skipped, 12 recorder failures pending the approved pass (Gemini evidence is stale for the new provider). Other routes still Gemini. **Acceptance (1) pass, 2026-10-11:** owner-approved 12 calls, all served by `claude-haiku-5-5` → **11/12** (Gemini 12/12). Miss: `unsupported-stock-subtraction` stated the pantry limit but still proposed `meal.assign`. Not met; no expectation changed. Receipt `tests/era-gym/AGENT-HAIKU-2026-10-11.md`. **Still open:** owner decision on that miss (prompt fix + new approved pass, or accept), then deploy; ai-chat and remaining routes; Gemini removal. Setup log: `08 - Sessions/Wizards/anthropic-era-ask-2026-10-11.md`.

### HUB-102

**Outcome:** Every Artifact row ERA writes can be undone and redone, not only the soft-deletable ones.

**Kind:** enhancement
**Implementation:** not started

- **Acceptance:** debts, memories, meal plans, shopping items/groups, recurring cover and the "updated" verbs each get an inverse that moves money and state exactly as the app's own control does, then a row in `eraArtifactReversal` (`src/lib/era/artifacts.ts`). A hard-deleted row gets no Redo.
- **Constraint:** Undo/Redo is derived from the row's live status (`POST /api/era/actions/status`), never a stored flag. Money inverses need a worked balance example and a test (money-rules).
- **Reading guide:** `src/lib/era/artifacts.ts`, `src/features/era/widgets/useEraArtifacts.ts`, `src/app/api/recycle-bin/restore/route.ts`.

### HUB-108

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h12--context-belongs-to-its-speaker-chat-and-actual-outcomes>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Critically assess ERA Agent's actual reach and harden the default confirmation, truthful-result and cost boundaries using existing infrastructure.

**Kind:** maintenance
**Implementation:** done
**UAT:** pending
**Touches:** `src/features/era/useEraAskAI.ts`, `src/features/era/useEraAskAI.test.ts`, `src/features/era/types.ts`, `src/features/era/capabilities/plan.ts`, `src/features/era/capabilities/plan.test.ts`, `src/features/era/capabilities/registry.ts`, `src/features/era/intents/resolvers/schedule.ts`, `src/features/era/intents/resolvers/schedule.hardening.test.ts`, `src/lib/ai/eraAskProposal.ts`, `src/lib/ai/eraAskProposal.test.ts`, `src/app/api/era/ask/route.ts`, `src/app/api/era/ask/route.test.ts`

- **Acceptance:** Default-mode single and multi-step proposals share deterministic execution checks and original owner/chat/date context. Expired/changed reminder references and account switches cannot dispatch stale model cards or publish private read results. New chat stops subsequent steps. Missing artifacts and partial NFC effects cannot become complete success. Parsed recurrence cannot become a one-time write or misleading date question. Invalid proposals cannot repeat model success text. Conditional money cannot bypass strict admission. Provider usage includes the actual full request/response and thought tokens, with explicit uncertainty; unavailable quota state refuses inference.
- **Verified — 2026-10-11:** Six initial hook regressions plus three recurrence/conditional-money regressions failed before the fixes. Final affected ERA/AI/API/Gym run: **638 passed, 12 stale/missing recording failures, one opt-in test skipped**. Actual-hook/recurrence follow-up: 14 passed, including positive confirmation and account change during a read. Typecheck passes. Full repository run before the final two extra regressions: 3,617 passed, 18 failed, 11 skipped; three sandbox-limited PM build failures pass with filesystem access and one loaded-run timeout passes alone. Two existing Delivery output-redaction assertions remain red alongside the twelve recording gaps. No tests were skipped or recordings rewritten to manufacture a pass.
- **Scope of completion:** Review plus implemented local hardening, not certification of the original application-wide vision. No new source business logic, capability family, migration, production write or live API call. Source receipt work is [SCH-24](<../Schedule/Schedule — Master Book.md#sch-24>); confirmation preview is HUB-109; source idempotency/native lifecycle convergence remains HUB-46. Parsed recurrence guard is a delivered portion of SCH-7.
- **Finish checks:** Changed-source ESLint has zero errors and two pre-existing `schedule.ts` `no-explicit-any` warnings. PM lint, criteria/links and Feature Map checks pass; only the existing empty Delivery Next-lane warning remains. `pm:archive` swept HUB-108 only. The local PM dashboard was regenerated with the filesystem access its bundler requires; nothing was published. No route, page, navigation or schema change was introduced by this review, so no new Atlas entry or migration pair is required.
- **Owner acceptance:** Follow the [deployment/device matrix and prioritized roadmap](<../../03 - Junction Modules/AI Assistant/Overview.md#owner-deployment-and-daily-use-acceptance>). The DB snapshot is 67 days old and `db:verify-rls` reports disabled RLS on two tables; no current DB state is inferred. Journal SQL/flag rollout, both-phone interruption and privacy tests, current-model quality, voice and source alert delivery remain pending. Empty browser inventory prevented UI/mobile QA; no served build was exercised.
- **Reading guide:** [Final review](<../../03 - Junction Modules/AI Assistant/Overview.md#final-review-and-hardening--2026-10-11-hub-108>), then the new actual-hook regression tests. Preserve the prior phases' uncommitted work and their separate rollout gates.

### HUB-109

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h10--ai-shopping-and-a-reviewed-recipe-to-meal-plan>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Confirm shows the operation and effective values ERA will execute, independently of model-authored prose.

**Kind:** bug
**Implementation:** done
**UAT:** pending
**Touches:** `src/components/era/EraProposalCard.tsx`, `src/components/era/EraRunCards.tsx`, `src/features/era/capabilities/`, `src/features/era/execution/`

- **Acceptance:** Generate compact preview fields from reviewed capability contracts and validated slots (target, date/time, amounts/list and replacement/delete effects where applicable); use the same view for default and journal cards. Dependency values that are not yet known must be visibly unresolved, not invented. If a later read materially changes a consequential target/effect, obtain confirmation for the effective action before dispatch. Keep model prose optional and non-authoritative. Preserve original request for comparison and obey minimal-text/mobile rules.
- **Evidence:** An isolated adversarial fixture must give benign labels with different valid mutation slots and demonstrate that the actual slots are what the user sees; cover named lookup/dependency values and changed targets. Verify mobile 390 px on a served build. This does not pretend deterministic previews prove that every natural-language constraint has been preserved; HUB-105 owns whole-goal evaluation.
- **Reading guide:** `EraProposalCard.tsx`, `EraRunCards.tsx`, `capabilities/discovery.ts`/`plan.ts`, and `execution/state.ts`. Reuse the current card/journal and schema contracts; do not add another planner or per-utterance templates.

- **Implementation — 2026-10-11:** All registered writes declare reviewed action/field vocabulary; write admission rejects a missing contract. `EraActionPreview` renders validated/defaulted slots and original request context in normal and journal cards. Real reminder title/date/priority/alert, expense amount/currency/account/date, recipe/default meal/replacement, shopping ingredients/list/group and Recycle Bin effects replace model descriptions. References remain pending until source reads return. Adapters compare actual values before dispatch and recheck owner/chat; differences persist a new consent snapshot. Confirm resumes acknowledged steps without rerunning them. Saved consent survives reload and Resume does not grant approval. Recipe assignment reads all matches instead of masking ambiguity with `limit=1`.
- **Evidence — 2026-10-11:** Adversarial benign-label previews, changed draft amount/account, owned reminder/date identity, pending then actual ingredient lists, ambiguous recipes, source rollback/partial/unknown distinctions, journal consent reload and the actual default React hook's repeat-free continuation pass. Server-rendered preview contains real action fields and omits model labels. Affected ERA/AI/API/Gym run: 699 passed, one existing opt-in skipped, one known `unsupported-stock-subtraction` replay failure (expected `[]`, actual `[meal.assign]`). No model responses/hashes were rewritten or paid calls made. Typecheck/scoped ESLint pass. See [P0 architecture, evidence and limits](<../../03 - Junction Modules/AI Assistant/Overview.md#p0-action-trust--2026-10-11-sch-24--hub-109>).
- **Owner UAT:** At 390 px and both themes on an isolated served build, inspect normal/saved Confirm/Dismiss cards with long values, request comparison and pending dependencies; confirm recipe→meal/shopping and changed draft/reminder values, then reload saved consent and verify completed effects do not repeat. Browser inventory was empty, so no visual/real-click witness exists here. HUB-104's migration/flag and SCH-24's source SQL/RLS gates remain prerequisites for their deployed paths. No deployment or production data modification occurred.
- **Limits:** These previews describe the admitted adapter's effective attempt; they do not prove all natural-language constraints survived interpretation. Haiku's unsupported pantry subtraction case still needs owner disposition under HUB-105/107. Source revision preconditions, native money/occurrence/group lifecycle convergence and exactly-once/reconciliation remain HUB-46; no autonomous retry or new agent framework was added.

## Backlog reconciliation

- 2026-09-10 — **HUB-53** → NOTIF-19. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **HUB-10** → BUD-2. Scope is retained in the destination criteria; duplicate removed, not shipped.

### HUB-72

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Hub-2026-10-25.md#h14--activity-filters-source-links-and-household-privacy>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Open an installable household Activity Log and filter authorized changes by module, feature, person and local date.

**Provenance:** Owner request, 2026-09-26: Budget entries respecting public/private sharing, reminders created, chats sent and activity across the household. Existing HUB-25 is assistant-only; the broader audit-timeline option was unadopted until this request.

**Implementation:** done

**UAT:** pending

**Acceptance:** `/activity-log` has its own hook, read API, manifest/icons and discoverable menu/Artifacts links. Source writes record transactionally without client log calls; rollback/retry/upsert cannot invent successful creates. Filters and pagination run behind authentication and current household/source/parent visibility. Partner-private transactions are absent; private-to-public changes do not disclose private snapshots, public-to-private changes revoke old visibility, unlink/relink does not grant a replacement partner old history. Deleted entries remain history without a broken Open link. Failed/missing setup is distinct from empty activity. No source money/schedule value is changed by capture.

**Reading guide:** [Activity Log overview](<../../03 - Junction Modules/Activity Log/Overview.md>), `src/features/activity-log/`, `src/app/activity-log/`, `src/app/api/activity-log/`, `migrations/2026-09-26_household-activity-log.sql`. The source registry is explicit; operational telemetry, PM relay/auth infrastructure and unregistered/new backends are outside current coverage. Guest Portal activity is host-only and generic, with no credential/guest-payload capture; this does not resolve HUB-61.

**Evidence — 2026-09-26:** 33 isolated PostgreSQL/API tests pass, covering all 80 registered source ownership paths across 12 modules against checked-in schema columns, guest secret exclusion, legitimate nullable parents, absent optional sources and atomic rejection of incompatible source keys. Typecheck, changed-file lint, Feature Index checks, PM grammar/link checks and dashboard build pass. No production connection was used by tests; PGlite creates an empty in-memory database. Source RLS/business constraints are not reproduced by that fixture and are not certified. Full-repo lint finds an unrelated existing `.tmp/kit11-checker-candidate` explicit-any error; changed-file lint passes separately.

**Owner UAT:** Apply the migration manually in Supabase SQL Editor, then confirm a public/private transaction, reminder create/complete, household/private/hidden chat and a child record in each enabled source module across both accounts. Confirm a private transition removes old partner history; try date/person/module/feature filters and Load more. Verify 390px layout and install/launch Activity alongside Trips/PM on the target phone. Check current live schema and actual module mutation paths if any capture error occurs. No browser backend was available for local device/visual verification; migration application is unverified. Optional source tables missing at install need migration reapplication after installation. History starts with application; there is no backfill.

## Shipped Log

- ✅ 2026-10-12 — **HUB-114** ERA DOT follows the sentence being typed: when the composer detects a capture ("Remind me to…"), the big DOT, background glow and toolbar… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-114>)

- ✅ 2026-10-11 — **HUB-110** ERA AI Usage tab (desktop only, next to Artifacts): one month at a time, a table per local day of the chats that reached the model… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-110>)

- ✅ 2026-10-10 — **HUB-101** ERA Artifacts view: browse by day (‹ › skip days with nothing, calendar greys them out), grouped by module in each module's ERA hue, and a… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-101>)

- ✅ 2026-09-29 — **HUB-84** ERA Top Layer voice chat is off by default: mic icon toggles voiceChatEnabled… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-84>)

- ✅ 2026-09-26 — **HUB-72** Household Activity Log implementation: /activity-log, own hook/API/install manifest/icons, menu and Artifacts entry points, source triggers… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-72>)

- ✅ 2026-09-02 — **HUB-36** removed the avoidable latency chain behind the owner-reported slow ERA Top Layer: established-thread message inserts are optimistic and… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-36>)
- ✅ 2026-06-16 — Hub bulk convert ("Multi-add" → `BulkConvertReviewSheet`) with unconfirmed rows saved as draft items (`items.status='draft'`, reviewed via `DraftRemindersDrawer`)
- ✅ 2026-06-16 — bulk-convert "complete transaction" rule tightened: a budget row auto-confirms only with Amount + Category + Subcategory (description = the chat message); any missing field forces a draft
- ✅ 2026-06-16 — full-screen in-thread view (global header hidden) + edge-swipe-back to the thread list
- ✅ 2026-07-10 — **notification visibility policy** (0f33396): chatNotificationPolicy.ts (33 lines, pure, the cluster's first test file) makes visibility the single choke point — private… → [record](<../_Archive/Shipped/Hub & ERA.md#2026-07-10--notification-visibility-policy>)
- ✅ 2026-07-10 — per-user receipts extended to shopping child messages: `unread_reply_count` drives the item dot, opening the item thread marks replies read, realtime restores the dot only for a _newer_ partner reply
- ✅ 2026-07-10 — net complexity went **down** with a feature for the first time in this cluster (`useHubPersistence.ts` −27, `chat-notifications` cron −17), and the vault docs were updated in the same commit
- ✅ 2026-07-17 — ERA Top View design study recorded as the standing spec for proactive
- ✅ 2026-08-22 — **HUB-1** intent-routing tests + graceful fallback (src/features/era/intents/rootIntentRouter.test.ts, 38 green) — new clarify Intent member… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-1>)
- ✅ 2026-08-22 — **HUB-1 follow-up** post-delivery review caught two false negatives in the same-day landing: the flat cross-face fallback let a bare switchFace keyword echo… → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-22--hub-1-follow-up>)
- ✅ 2026-08-22 — **HUB-12** ERA Phase 2 intents: draftReminder, showAnalytics, and draftTransaction all resolve for real → [record](<../_Archive/Shipped/Hub & ERA.md#hub-12>)
- ✅ 2026-08-22 — **HUB-15** ERA stopped reading from a script → [record](<../_Archive/Shipped/Hub & ERA.md#hub-15>)
- ✅ 2026-08-22 — **HUB-15 fallout** building the pools surfaced four defects in the phrasing engine, all caught by the sample harness before shipping: fill orphaned a… → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-22--hub-15-fallout>)
- ✅ 2026-08-22 — **HUB-12 title fix** the schedule router had been copying the whole utterance into the reminder title, so "remind me to call the bank" created an item literally… → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-22--hub-12-title-fix>)
- ✅ 2026-08-26 — **HUB-23** ERA "Ask AI" (Slice 4, delivers WP-10): the manual escape hatch for when the deterministic router can't handle a request — a sparkle button… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-23>)
- ✅ 2026-08-26 — **HUB-20** Meal planning joins ERA (Slice 5): three new Chef intents — listRecipes ("what recipes do I have"), assignMeal… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-20>)
- ✅ 2026-08-26 — **HUB-19** Reminder time becomes a required slot (Slice 3): resolveDraftReminder no longer writes an undated item when parseSmartText finds no date —… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-19>)
- ✅ 2026-08-26 — **HUB-18** Budget capability set (Slice 2): four new intents — transfer… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-18>)
- ✅ 2026-08-25 — **HUB-17** ERA Hub (/era) voice had never actually worked: EraShell mounted useConversationMode with only onWillSpeak wired, so… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-17>)
- ✅ 2026-08-06 — **HUB-11** per-message color tags + color filter (hub_messages.color, src/features/hub/messageColors.ts) — compose-bar palette picker… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-11>)
- ✅ 2026-08-27 — **HUB-25** /era Activity log… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-25>)
- ✅ 2026-08-27 — **HUB-25 fix** Activity reminder deep-link 404'd — logEraAction.ts built /items?openId= → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-27--hub-25-fix>)
- ✅ 2026-08-27 — **HUB-26** Named-day schedule queries answered for the wrong day… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-26>)
- ✅ 2026-08-27 — **HUB-27** Capability registry + focus memory (Stage 1 of the same plan) — the two building blocks the plan's other worked example needed: "Remind me… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-27>)
- ✅ 2026-08-31 — **HUB-27 enhancement: named-target support** Stage 1's three reminder intents now also accept named targets, not only pronouns → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-31--hub-27-enhancement-named-target-support>)
- ✅ 2026-08-27 — **HUB-28..31** ERA conversational-context plan, Stages 2–5 — the loop the owner's plan aimed for: native miss → Ask AI → map to existing capability → ERA… → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-27--hub-2831>)
- ✅ 2026-08-27 — **HUB-28..31 fix** own real-usage testing of the session above surfaced a pre-existing routing bug… → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-27--hub-2831-fix>)
- ✅ 2026-08-27 — **HUB-32** mobile-only design pass on /era… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-32>)
- ✅ 2026-08-27 — **HUB-32 polish** owner liked the mobile chat-bubble FAB's (EraChatDrawer.tsx, from HUB-32 above) module-hue color but wanted it glossy/gradient instead of… → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-27--hub-32-polish>)
- ✅ 2026-08-27 — owner-reported bug fix: "Transfer 2$ from my account to drawer" never transferred anything — ERA replied only "Switched to Budget." Root… → [record](<../_Archive/Shipped/Hub & ERA.md#2026-08-27--owner-reported-bug-fix-transfer-2-from-my-account-to-drawer-never>)
- ✅ 2026-08-31 — **HUB-33** closed the four real gaps in HUB-27..31's "native miss → Ask AI → learn → native next time" loop that a fresh audit found… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-33>)
- ✅ 2026-08-31 — **HUB-34** two verified defects in HUB-33's taught-template loop, surfaced by an owner-requested second-opinion review of the whole pipeline… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-34>)
- ✅ 2026-08-31 — **HUB-35** native-router coverage + collision hardening pass across all three per-face Layer 1 routers (intents/{schedule,budget,chef}.ts), requested… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-35>)
- ✅ 2026-09-27 — **HUB-73** Unified message selection for bulk add/delete, deletion scope with Undo, and a compact mobile thread header → [record](<../_Archive/Shipped/Hub & ERA.md#hub-73>)
- ✅ 2026-09-27 — **HUB-74** Replaced the layered mic/send/fallback controls with one 48px action, allowed the input to shrink, removed the duplicate conversation… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-74>)
- ✅ 2026-09-27 — **HUB-75** One shared amount extractor (src/lib/nlp/amount.ts) for ERA's budget router, Hub messageTransactionParser and the voice classifier: 12$,… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-75>)
- ✅ 2026-09-27 — **HUB-75** follow-up from the HUB-77 Gym: 🔴 paid $2,000 for rent drafted $2 because parseSpeechExpense (the draft write path and the mic) split… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-75>)
- ✅ 2026-09-27 — **HUB-84** follow-up from the owner's second test: "make it under Spinneys group" with nothing in focus now asks "Change what?" AND waits — chips list… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-84>)
- ✅ 2026-09-27 — **HUB-84** Follow-ups edit the last result, whatever its type: typed focus memory, followUp.ts field parser, amendLast routing by referent type, edit… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-84>)
- ✅ 2026-09-27 — **HUB-16** Hub /chat voice uses the shared ERA turn engine (runTurn), so voice reminders keep their time → [record](<../_Archive/Shipped/Hub & ERA.md#hub-16>)
- ✅ 2026-09-27 — **HUB-80** Household lexicon (repository): era_lexicon migration + owner-only RLS, /api/era/lexicon, aliases / "Always" defaults / examples /… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-80>)
- ✅ 2026-09-27 — **HUB-6** Split from chat: "split 60$ dinner with Racha" opens /expense?era=<id> with the Split toggle on and the total filled → [record](<../_Archive/Shipped/Hub & ERA.md#hub-6>)
- ✅ 2026-09-27 — **HUB-78** Understanding engine pilot: chip turn state, by-name reminders with this one / series, ?era= handoff to /expense, shopping-add, outcome on… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-78>)
- ✅ 2026-09-27 — **HUB-77** ERA Gym: tests/era-gym/ (159 full-context cases — 87 synthetic, 72 from the owner export — all mandatory slices), real router + pure… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-77>)
- ✅ 2026-09-27 — **HUB-76** Speech-act gate (intents/speechAct.ts) on every routed write: negated/hypothetical/question/conditional/reported → clarify{speechAct},… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-76>)
- ✅ 2026-10-03 — **HUB-86** The ERA chat is a conversation: bubbles in the person's color, 15–16 px ERA replies, time breaks, a thinking indicator for every turn, the… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-86>)
- ✅ 2026-10-03 — **HUB-85** Report from the ERA chat: a quiet Report chip under a missed reply (and on any reply's details), Missed / Wrong + "Expected…", a… → [record](<../_Archive/Shipped/Hub & ERA.md#hub-85>)
- ✅ 2026-10-03 — **HUB-52** ERA History: titled, grouped past chats with read-only preview, Continue (clean context) and Archive with Undo → [record](<../_Archive/Shipped/Hub & ERA.md#hub-52>)
- ✅ 2026-10-04 — **HUB-89** ERA handles "Add Laura as a contact person" → [record](<../_Archive/Shipped/Hub & ERA.md#hub-89>)
- ✅ 2026-10-04 — **HUB-90** Every ERA write leaves an Artifact that opens the item → [record](<../_Archive/Shipped/Hub & ERA.md#hub-90>)
- ✅ 2026-10-04 — **HUB-88** ERA handles "Add Kobeize as a location" → [record](<../_Archive/Shipped/Hub & ERA.md#hub-88>)
- ✅ 2026-10-04 — Catalogue → Places item form shows place fields (Maps link, address, phone, notes) instead of progress/status/frequency — `CatalogueItemDialog.tsx`, `CatalogueItemDetailDialog.tsx`
- ✅ 2026-10-04 — **HUB-94** ERA asks where an event happens and learns your places — [criteria](<Hub & ERA — Master Book.md#hub-94>)
- ✅ 2026-10-10 — **HUB-97** ERA adds a list of items to the shopping list however the household phrases it — [criteria](<Hub & ERA — Master Book.md#hub-97>)
- ✅ 2026-10-10 — **HUB-98** Ask AI fails less often and logs why when it does — [criteria](<Hub & ERA — Master Book.md#hub-98>)
- ✅ 2026-10-10 — **HUB-100** Ask AI knows the shopping list exists and can propose adding to it — [criteria](<Hub & ERA — Master Book.md#hub-100>)
- ✅ 2026-10-10 — **HUB-103** ERA executes validated multi-step requests through existing application capabilities — [criteria](<Hub & ERA — Master Book.md#hub-103>)
- ✅ 2026-10-10 — **HUB-104** Preserve agent consent and execution progress with safe session recovery — [criteria](<Hub & ERA — Master Book.md#hub-104>)
- ✅ 2026-10-10 — **HUB-106** Reuse private context and acknowledged experience for adaptive ERA dialogue — [criteria](<Hub & ERA — Master Book.md#hub-106>)
- ✅ 2026-10-11 — **HUB-108** Review ERA Agent and harden confirmation, truthful outcomes and usage accounting — [criteria](<Hub & ERA — Master Book.md#hub-108>)
- ✅ 2026-10-11 — **HUB-109** Show actual effective actions and values before Confirm — [criteria](<Hub & ERA — Master Book.md#hub-109>)
- ✅ 2026-10-12 — **HUB-112** Add native sentence completion for reminders, expenses and shopping → [record](<../_Archive/Shipped/Hub & ERA.md#hub-112>)
- ✅ 2026-10-12 — **HUB-113** ERA's composer completes and understands everyday captures from the household's own wording — [criteria](<Hub & ERA — Master Book.md#hub-113>)
- ✅ 2026-10-12 — ERA composer mic/send are one WhatsApp-style button: mic when empty, Send when text → [record](<../_Archive/Shipped/Hub & ERA.md#2026-10-12--era-composer-micsend-are-one-whatsapp-style-button-mic-when-empty>)
- ✅ 2026-10-12 — **HUB-115** Polish ERA's top-layer motion while preserving functionality — [criteria](<Hub & ERA — Master Book.md#hub-115>)
- ✅ 2026-11-21 — **HUB-118** Require host sign-in for Guest Portal bulk reads → [record](<../_Archive/Shipped/Hub & ERA.md#hub-118>)
- ✅ 2026-11-25 — **HUB-123** Contacts file under a category from ERA and Catalogue → [record](<../_Archive/Shipped/Hub & ERA.md#hub-123>)
- ✅ 2026-11-25 — **HUB-93** ERA gets "Add Racha as a Contact" right → [record](<../_Archive/Shipped/Hub & ERA.md#hub-93>)

## Delivery session log

_(Delivery runner appends dated progress bullets here automatically.)_

- 2026-08-22 — **HUB-1** delivery session `s-20260822-093143-t7tm` ended **paused — needs a decision** at NEEDS_DECISION. 0 file(s) changed.

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
