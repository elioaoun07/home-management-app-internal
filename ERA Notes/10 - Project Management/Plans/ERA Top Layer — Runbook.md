---
created: 2026-11-16
updated: 2026-11-16
type: plan
status: active
owner: Elio
evidence_cutoff: "2026-11-16 working tree at HEAD a9ef5bc1. File paths, table columns and routes named below were read that day. Nothing here was run, applied or witnessed. Recheck each path against the code before editing."
---

# ERA Top Layer — Runbook

**Proposed, not yet accepted.** The reasons are in the [Rethink](<ERA Top Layer — Rethink.md>). This file is the part you execute.

## How to run it

Say: **"Run stage S‹n› of the ERA Top Layer Runbook."**

The agent then reads three things and nothing else from this file: this section, [Rules for every stage](#rules-for-every-stage), and that one stage sheet. It follows `start-task`, works the sheet top to bottom, ends with `finish-task`, and updates the stage's row in the ledger.

A stage is finished only when **you** have done its Witness steps on your phone. The next stage does not start before that. This is the one rule that makes this plan different from the four before it.

## Ledger

Status moves `proposed` → `ready` → `built` → `witnessed`. An agent may write `built`. Only your evidence writes `witnessed`. After S0, each stage also has one HUB row; `pnpm pm:ship` closes it when the stage is witnessed.

| Stage | Outcome | Sessions | Tier | Status | Evidence |
|---|---|---:|---|---|---|
| [S0 Adopt](#s0--adopt) | Decisions recorded, one row per stage, old plan archived | 1 | `CLAUDE_MID` | proposed | |
| [S1 Live](#s1--live) | Everything already built runs on both phones; baseline counted | 2 | `CLAUDE_MID` | proposed | |
| [S2 Now](#s2--now) | ERA opens with cards you can finish in one tap | 3 | `CLAUDE_HIGH` | proposed | |
| [S3 Durable](#s3--durable) | A sentence typed offline is never lost and never doubled | 3 | `CLAUDE_HIGH` | proposed | |
| [S4 Speaks first](#s4--speaks-first) | One morning brief, one evening close, pushes that land on their card | 3 | `CLAUDE_HIGH` | proposed | |
| [S5 Learns](#s5--learns) | A miss is taught with one confirm and stays taught | 3 | `CLAUDE_HIGH` | proposed | |
| [S6 Habits](#s6--habits) | What you always do is one tap | 3 | `CLAUDE_HIGH` | proposed | |
| [S7 Everywhere](#s7--everywhere) | ERA is on every page and knows what "it" is | 3 | `CLAUDE_MID` | proposed | |
| [S8 Reach](#s8--reach) | Capabilities grow from evidence, one per session | rolling | `CLAUDE_MID` | proposed | |

Tiers are aliases from the [Model Registry](<../../Model-Registry.md>); effort is the registry default unless a sheet says otherwise. About 21 sessions before S8. At two a week the first visible change (S2) lands in week three.

## Rules for every stage

1. **Witness before next.** No stage starts while the previous one reads `built`.
2. **No agent touches the production database or a paid API.** Migrations are files you run (Hard Rules 24, 26). Model evidence is refreshed only in a pass you start (Hard Rule 29).
3. **One engine per concept.** No new store beyond `era_*` and `notifications`. No new offline queue: use `src/lib/offlineQueue.ts`. No second recurrence path. No second assistant.
4. **Rules act, the model proposes.** No model call on the hot path, on typing, or to produce a fact, an amount or a date. Money movement always passes a confirm showing effective values. A model-interpreted reminder still needs Confirm (DEC-24).
5. **Every write** reuses the module's own route through its adapter, returns `artifacts`, and has Undo where an inverse exists (Hard Rule 1; `artifacts.contract.test.ts`).
6. **Household.** Every new read applies the same partner filter as the source page (Hard Rule 13). A "can't see" bug starts at RLS evidence, not route code (Hard Rule 27).
7. **Words.** One line per card, one- or two-word buttons, no explanatory text (Hard Rule 28). No red on a card (Hard Rule 3).
8. **Layout.** Additive only, except the two changes in decision B.
9. **Time.** Local dates through `src/lib/utils/date.ts`; billing periods through `startOfCustomMonth`; scheduled work selects by each person's IANA zone.
10. **Pushes.** Quiet 21:00–08:00, three a day per person, overflow goes to the Now stack. NOTIF-19 owns this policy; implement it there once.
11. **The Gym is the floor.** `tests/era-gym/` passes before and after every stage. A stage that changes routing adds its cases first.
12. **Lane R.** A session may first close one ERA report through `/era-wire`, in under 30 minutes. No report should be older than 14 days.
13. **Stop rules are real.** When a sheet's stop rule fires, stop and report. Do not tune around it.

---

## S0 · Adopt

**Outcome.** This plan governs, and it is the only one.

**Needs from you.** Answers to decisions A–G in the [Rethink §7](<ERA Top Layer — Rethink.md#7-owner-decisions>).

**Read first.** `_Conventions.md` §1, §2.1, §8; the Rethink §8 disposition table.

**Build.**
1. Record decisions A–G in the Hub & ERA Master Book › Vision & Decisions. Close DEC-01 in `_Decisions.md` with decision C.
2. File one row per stage S1–S8 in `Hub & ERA/4 - Checklist.md` › Next under the label `**ERA top layer**`. Each row's `### <ID>` section holds three lines: the outcome, a link to its sheet here, and `**Acceptance:** the sheet's exit gate`. Do not copy the sheet.
3. Apply the disposition table: for each absorbed row, remove its checkbox and record old ID → stage ID under Backlog reconciliation. Rows listed as prerequisites or parked keep their own rows.
4. Move `Plans/ERA Top Layer.md` to `_Archive/Plans/ERA Top Layer (2026-09-27).md`. Retarget every link to it. Update the Plans table in `_index.md`.
5. Set every ledger status here to `ready`. Remove the "Proposed, not yet accepted" line from both files.

**Verify.** `pnpm pm:lint`, `pnpm pm:check-docs`, `pnpm pm:index`.

**Exit gate.** Eight rows under one label; the old plan is in the archive; all three checks pass.

**Not in this stage.** Any source change.

---

## S1 · Live

**Outcome.** What is already built runs on both phones against the real database, and there is a baseline to beat.

**Maps to.** HUB-83, HUB-91, HUB-62, HUB-38 (evidence), the 15 Hub items awaiting acceptance, HUB-87, HUB-93, HUB-117.

**Read first.** `.claude/skills/wizard/SKILL.md`; `ERA Notes/01 - Architecture/Database RLS Posture.md` §Debugging; [Hub walkthroughs](<../../../docs/Delivery-UAT-Hub-2026-10-25.md>).

**Build.**
1. Write one wizard for a single owner sitting (about 90 minutes). Its steps, in order:
   - Run `migrations/db-state.sql` in the SQL Editor and save the output over `migrations/db-state.json`. The agent then runs `pnpm db:verify-rls` and lists every finding with a proposed disposition.
   - From that fresh state, the agent says which of these are missing; you apply the missing ones in date order: `2026-09-26_household-activity-log.sql`, `2026-09-27_era-lexicon.sql`, `2026-10-04_era-artifacts-any-entity.sql`, `2026-10-10_era-execution-journal.sql`, `2026-10-11_atomic-item-create.sql`, `2026-10-17_items-bulk-create.sql`. The journal flag stays off.
   - Cron proof: you paste the scheduler's run history for the six `src/app/api/cron/*` routes, or state that none is scheduled.
   - Walk scenarios H01–H14 on both phones and mark each PASS or FAIL in the walkthrough document.
2. Close the three open ERA reports through `/era-wire`.
3. Scoreboard v0. A read-only `GET /api/era/scoreboard` and a compact strip at the top of `src/components/era/dashboards/ArtifactsView.tsx`. Per person, per week:
   - ERA writes, from `era_actions`
   - all creates in the same families (transactions including drafts, items, shopping rows), as exact counts
   - misses: user turns in `era_messages` with `intent_kind` `unknown` or `clarify`
   - repeat misses: the same normalized text (`templates/normalize.ts`) missed twice
   - model calls and cost, reusing `src/features/era/aiUsage.ts`
   
   No new column, no migration. This is a desktop statistic, not a hot path; count queries may run concurrently.

**Verify.** Route test: auth, own versus partner rows, a failed count reads as unavailable and never as zero. `pnpm typecheck`, `pnpm lint`, Gym.

**Witness.** The wizard itself. Then open Artifacts on desktop and read last week's numbers.

**Exit gate.** `db-state.json` is under 7 days old and every RLS finding has a disposition; "Always" teaches an alias on your phone; a contact, a place and a shopping row each open from Artifacts; the three reports are shipped; one baseline week is written in the ledger.

**Stop rule.** A wrong money effect or a partner seeing private data in the walkthrough stops the plan until fixed. Any other FAIL becomes an ERA report and does not block.

**Not in this stage.** New features. Enabling the journal flag.

---

## S2 · Now

**Outcome.** Opening ERA on a phone shows up to three cards you can finish in one tap.

**Maps to.** HUB-41, HUB-50, HUB-54. Uses decision B.

**Read first.** `ui-guardrails`, `api-route`, `cache-invalidation`, `money-rules` (for the Paid card); `ERA Notes/03 - Junction Modules/Notifications/Overview.md`; `src/app/api/notifications/in-app/route.ts`; `src/features/era/nativeActions.ts`.

**Build.**
1. **Signals.** Pure functions, one per source, each returning cards plus a coverage value (`complete`, `partial`, `unavailable`):
   - payment due within one day and not covered (`recurring_payments`)
   - reminder or event due today or overdue and still open (`items`)
   - next event today
   - drafts waiting (count)
   
   Each card: `key` (kind + entity id + local date), one line of text, module, primary action, optional second action, `href`.
2. **Read.** `GET /api/era/now`: runs the signal reads concurrently, adds live `notifications` rows (not dismissed, not snoozed, not expired), dedupes by key against `group_key`, ranks (overdue, due, next, counts), returns at most eight with per-source coverage. It never writes.
3. **Hook.** `useEraNow()` with a key in `src/features/era/queryKeys.ts`, served from the persisted cache first so the hub paints at once. Every mutation that changes a source invalidates it; list those keys in the PR.
4. **UI.** `EraNowStack` in the idle hub between the mark and the composer, phone and desktop. It replaces the line "4 modules on deck. Speak to any of them." in `EraShell.tsx`. Three cards, then `+N`. Tap the card body to open the item; tap the button to act. While a conversation is open the stack collapses to a count.
5. **Actions.** Each button calls the existing adapter (`recurring.cover`, reminder complete or reschedule, drafts review, the notification's own action route). The card shows the effective values, so the tap is the confirmation. Artifact and Undo follow.
6. **Later.** The second button hides the card on this device until tomorrow (local storage, guarded). The server ledger arrives in S4.
7. **Door.** Add ERA to the app's existing navigation (`Feature Map/cross-cutting/layout-and-nav.md`).
8. **Docs.** Atlas entry, Feature Map `junction/ai-assistant.md`, AI Assistant Overview.

**Verify.** Unit tests per signal: nothing due, due today, overdue, partner-owned, custom month boundary, a DST day. Route test: one source failing returns the others with `partial`. Render check at 390 px. Money worked example for Paid: balance before and after.

**Witness.** On your phone: cards appear within a second of opening. Mark a payment Paid: it is covered in Recurring, an Artifact exists, Undo restores it. Your partner's phone shows her cards, not yours. In airplane mode the last cards show and say they are stale.

**Exit gate.** For five days running you act on at least one card a day (scoreboard: cards acted).

**Stop rule.** Fewer than three cards acted on in the first week: stop adding signals and review which cards were noise before S4.

**Not in this stage.** Push, a migration, habit cards, dismiss synced across devices, changes to the face dashboards.

---

## S3 · Durable

**Outcome.** A spend, a reminder or a shopping item typed with no signal is kept, sent once when the network returns, and never doubled.

**Maps to.** HUB-46. Prerequisites that keep their own rows: HUB-119 (queued writes are kept), HUB-120 (transaction creates replay safely).

**Read first.** `ERA Notes/01 - Architecture/Sync and Offline.md`; `money-rules`; `cache-invalidation`; `src/lib/offlineQueue.ts`; `src/lib/safeFetch.ts`; `src/features/items/bulkItems.ts` (the client-id pattern); `src/features/era/useEraBudgetSubmit.ts`.

**Build.**
1. Each of the three hot captures carries a client-generated id end to end. The create endpoint treats a repeated id as the same row.
2. Not online (`isReallyOnline()` false): enqueue in the existing IndexedDB queue and show a receipt that says it is saved and will send. The reply "Tell me again once you're back on" is deleted.
3. A timeout after the request may have left: outcome `uncertain`. Retry only because the endpoint is idempotent by client id. Never mark the app offline for a timeout (Hard Rule 6).
4. A sentence that needs the model while offline is kept as pending text. On reconnect it becomes a proposal with its original time, never an automatic write (U-6).
5. Queued rows render optimistically in the thread and in Now with a pending mark.

**Verify.** Tests: enqueue then flush once; replay twice gives one row; timeout then success gives one row; pending text is proposed, not executed. Gym slice "response loss". Money worked example for a queued spend.

**Witness.** Airplane mode: record one spend, one reminder, one shopping item. Turn the network on: each appears exactly once. Force-close the app mid-send and reopen: still exactly once.

**Exit gate.** The witness passes on both phones; captures lost offline on the scoreboard read zero for a week.

**Stop rule.** Any duplicate money row in testing: stop and fix the endpoint before continuing.

**Not in this stage.** A new queue. Offline for transfers, debts or anything behind a confirm card.

---

## S4 · Speaks first

**Outcome.** One morning brief and one evening close per person, each sent exactly once, each landing on its card.

**Maps to.** HUB-39, HUB-42, HUB-43, HUB-49, HUB-51, HUB-38; NOTIF-19 owns the delivery policy. Uses decision C.

**Read first.** `db-migration`, `api-route` (cron variant), `timezone-handling`; `ERA Notes/03 - Junction Modules/Notifications/`; `public/sw.js` (notification actions and click handling); `src/lib/pushSender.ts`; `src/app/api/cron/daily-items-reminder/route.ts` (the per-slot dedupe it uses today).

**Build.**
1. **Migration, you run it.** A unique index on `notifications (user_id, group_key)` where `group_key` is not null, preceded by a count query for existing duplicates that you run first. A `get_era_now_bundle()` SECURITY DEFINER function replacing S2's concurrent reads (Hard Rule 21). Update `schema.sql` in the same change.
2. **One cron route**, `src/app/api/cron/era-brief/route.ts`, polled every 15 minutes: bearer secret, `supabaseAdmin()`, `maxDuration = 60`. For each person whose local time has reached their hour and who has no row for `brief:<local date>`: build the brief from the S2 signals, insert the notification (the unique index makes it once), send the push. The evening close uses the same route with `close:<local date>`. Each run writes a last-run stamp the scoreboard shows.
3. **Scheduler runbook** for you: the pg_cron job that calls the route with the secret (D1).
4. **Landing.** Push clicks open `/era?card=<id>`, which focuses that card. Android action buttons finish in place through the existing actions route; iPhone opens the card.
5. **Close the day.** A stack of drafts to confirm, undone reminders (Done, Tomorrow, Drop) and tomorrow's first event.
6. **Policy.** Quiet hours, three a day, overflow to Now, each person's hour and an off switch in Settings.
7. **Feedback.** Each card records shown, acted, dismissed. The scoreboard gains cards acted per day and push-to-action rate. Dismiss now syncs across devices.

**Verify.** Tests: the hour is selected by IANA zone across a DST change; two overlapping runs send one push; a failed send is retried once and visible; quiet hours hold; the overflow lands in Now. No live push from an agent.

**Witness.** Five mornings: one brief at your hour, the tap lands on its card. One evening: the close clears in under a minute. Your partner becomes eligible after your five mornings (D5/D6).

**Exit gate.** Five consecutive correct mornings, zero duplicates, and a missed run shows on the scoreboard within a day.

**Stop rule.** Two duplicates, or one brief outside its hour: switch the route off by its env flag and fix before resuming.

**Not in this stage.** Model-written text. Geofencing. Anomaly proposals (HUB-55).

---

## S5 · Learns

**Outcome.** One Send button. A sentence ERA misses is taught with one confirm and is native from then on.

**Maps to.** HUB-99, HUB-47, HUB-64, HUB-105 (model evidence), HUB-44 (caps). Uses decision B.

**Read first.** `src/features/era/useEraAskAI.ts`, `missTracking.ts`, `lexicon.ts`, `templates/`; `src/lib/ai/eraAskProposal.ts`; [Live API Testing Protocol](<../../01 - Architecture/Live API Testing Protocol.md>); the Overview's final review.

**Build.**
1. **One Send.** Remove the separate ✨ send from `CommandBar.tsx`. Escalation is decided only inside `useEraTurn`. A reply the model interpreted carries a small ✦ mark.
2. **Always.** After a model proposal is confirmed and its outcome is `done` or `drafted` (never `uncertain`, `failed` or `partial`), offer Always once. Yes writes one `era_lexicon` rule. Templates are frozen: lexicon is the single store for learned phrasing (U-4).
3. **Safe referents.** A rule never stores an entity id. Accounts, people and items are re-bound every turn from live candidates; an ambiguous or missing referent asks instead of guessing (HUB-64).
4. **Forget.** "Forget that" revokes the last applied rule; a rule that produced a result you then undid is disabled and offered for removal.
5. **Honest limit.** When no capability matches, say so in one line with a prefilled Report. Nothing else goes to Report.
6. **Evidence.** One pass you start, under the protocol: the corpus is the Gym plus the last 60 days of real misses you export. Record the fingerprints so replay passes again.
7. **Caps.** Keep the $1 per person per month ceiling; the scoreboard shows spend and model share of turns.

**Verify.** Sequence test: miss → proposal → Confirm → Always → the same sentence resolves natively with no model call → paraphrase behaves as the rule says → Forget → asks again. Adversarial: a learned phrase can never move money without a confirm card. Gym unchanged or better.

**Witness.** Teach three real phrases on your phone. The next day, in airplane mode, each resolves. Repeat misses on the scoreboard read zero for a week.

**Exit gate.** The witness passes and the replay suite passes with current fingerprints.

**Stop rule.** A learned rule produces a wrong money effect: disable learned rules for money capabilities and keep money on grammar plus confirm.

**Not in this stage.** New capabilities. Multi-step plans. A second learning store.

---

## S6 · Habits

**Outcome.** A spend, a list or a chore you repeat is offered as one card and recorded with one tap.

**Maps to.** HUB-113's memory; patterns 5 and 7 of [Learns Your World](<../../03 - Junction Modules/AI Assistant/ERA Learns Your World — Proposal.md>). Uses decision E.

**Read first.** `money-rules`, `recurrence-safety`; `src/lib/era/captureMemory.ts`; `src/app/api/era/capture-memory/route.ts`.

**Build.**
1. `habitSignals(history, now)`: a pure function. A candidate needs at least four matches in the last six same-weekday windows, within 90 minutes of now, with the same description, account and category, and no matching entry today. Thresholds are named constants with tests.
2. One habit card visible at a time. The line shows amount, description and account; the currency is the one in history and is never converted or guessed.
3. Tap: per decision E, post when every field comes from your own history and the account is yours; otherwise draft. Artifact and Undo either way.
4. Declined twice: suppressed for 30 days through a lexicon suppression rule. Accepted: the count strengthens.
5. Usual shopping: the items you add most weeks, offered as one card with Add.
6. A reminder you recreate by hand three times in five weeks: offer to make it recurring, behind a confirm card.

**Verify.** Fixtures for each threshold edge; a day with the habit already logged shows nothing; LBP and USD histories stay separate; worked balance example; partner history never feeds your cards.

**Witness.** Two weeks of normal use. Check three posted habit spends against the account's history.

**Exit gate.** At least 40% of shown habit cards accepted over two weeks; zero wrong-amount posts; ERA's share of spend captures at least 15 points above the S1 baseline.

**Stop rule.** Acceptance under 20% after two weeks: raise the thresholds once, and if it stays under, remove the signal.

**Not in this stage.** Any model. Auto-posting without a tap. Predicting amounts that vary.

---

## S7 · Everywhere

**Outcome.** ERA is one tap away on every page and understands "it" as the thing you have open. There is one assistant.

**Maps to.** HUB-48, HUB-40, HUB-82. Uses decision D.

**Read first.** `ui-guardrails` §4–5, `pwa-install`; `ERA Notes/01 - Architecture/Standalone PWA Apps.md`; `src/components/era/EraChatDrawer.tsx`; `src/features/era/focusMemory.ts`; `src/components/ai/AIChatAssistant.tsx`.

**Build.**
1. `EraHandle`: a small ERA mark mounted in the signed-in layout (not on guest, watch or PM pages). It opens the existing sheet: the top Now card, the embedded `CommandBar`, the thread.
2. Page context: a page with one open entity (reminder, transaction, trip, recipe) pushes it into focus memory, so "move it to Friday" needs no name. Context raises ranking; it never decides an intent alone.
3. Routing loses its mode: the active face no longer gets first try. Confidence tiers apply across all four routers, with page context and recency as tie-breaks. Hue still follows what ERA understood.
4. Retire the floating assistant once the analysis report it serves is reachable from ERA.
5. Landing: signed-in `/` goes to `/era`.
6. Install identity: first witness what a handoff to `/expense?era=…` looks like from the installed ERA app, then follow `pwa-install`. Add home-screen shortcuts for Expense, Reminder and Shopping.

**Verify.** Gym with the routing change: no regression across 205 cases, plus new page-context cases. Render check that the handle never covers a page's own primary action at 390 px.

**Witness.** From an open reminder say "move it to Friday". From a trip say "add sunscreen". Confirm the old chat button is gone everywhere.

**Exit gate.** Both sentences work with no name; one assistant remains; Gym at or above baseline.

**Stop rule.** The handle collides with existing page controls on more than two pages: ship it on the clean pages and list the rest.

**Not in this stage.** Redesigning the hub or the face dashboards.

---

## S8 · Reach

**Outcome.** ERA's reach grows where the evidence points, one capability per session.

**Maps to.** HUB-79, HUB-81, HUB-45, HUB-69, HUB-70, HUB-71, HUB-22, HUB-56, HUB-102.

**How it runs.** This is a lane, not a project.
1. Pick from two sources only: the oldest ERA report, or the top of the scoreboard's "couldn't do" list.
2. One capability per session through `/era-wire`: contract, adapter on the module's own route, Artifact, one Gym case, one contract-test row. No new grammar; language arrives through S5.
3. Reads come as fact tools with coverage: spend by category, merchant, account, period or person on the custom month; schedule by range; balances; debts. The model may answer only from a tool result. This closes the calendar-month gap in `src/lib/ai/context.ts` (HUB-45).
4. New card kinds (partner activity, leave-by, store list, dinner gap) enter the same way, one at a time.

**Exit gate, rolling.** No ERA report older than 14 days; the "couldn't do" list is shorter each month.

**Stop rule.** A capability that needs a DB change, money movement or a recurrence edit leaves this lane for a full session at high effort.

---

## Pre-mortem

Against the Design Doctrine's silent-failure table.

| Class | Where this plan adds risk | Guard |
|---|---|---|
| Money drift | Paid from a card (S2), habit post (S6) | Existing adapters only; worked balance example; Undo and Artifact |
| Duplicate | Brief push (S4), offline replay (S3) | Unique `group_key`; client ids; replay tests |
| Visibility leak | Cards built from partner-visible rows (S2) | Source page's filter reused; partner fixtures; RLS evidence first |
| Stale truth | Now served from cache (S2) | Stale mark; listed invalidation keys |
| False offline | Slow writes during S3 | Timeout is never offline |
| Zombie schedule | The brief cron (S4) | Last-run stamp on the scoreboard |

## Retirement

Archive with the Rethink when S7 is witnessed and S8 has run for a month, or when you replace it.
