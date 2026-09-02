---
created: 2026-09-02
type: master-plan
status: active
owner: Elio
author: Claude Fable 5.1
tags:
  - pm/master-plan
  - module/hub-era
  - ai/proactive
---

# ERA Top Layer — Master Plan (2026-09-02 → 2026-12-31)

> **What this file is.** (1) A deep, verified analysis of the ERA Top Layer as it exists on 2026-09-02; (2) a decision-complete, packetized 17-week program covering the manual modules, the reactive ERA, the proactive ERA, the AI layer, voice, offline, security, data safety and native, written so lower-tier models can execute it packet by packet; (3) the implementation steps that turn this plan into vault documents and checklist items once approved.
>
> **Supersedes:** `ERA Awakening — Master Execution Plan (2026-07-06)` and `ERA Top View — Design Study (2026-07-17)`. Their gates are scored as missed in their own ledgers first (honesty), then both are marked superseded; every still-valid decision is carried into §3 so nothing is re-litigated. Awakening packet IDs (WP-nn) are cited on each packet that inherits one.

---

## 0 · Context

The app is two things at once: precision tools the owner drives by hand (expense form, reminders, recipes, meal plan, trips, healthcare, outfits) and an assistant layer, ERA, that is supposed to do those things on request and eventually speak first. The owner asked for a deep read of where the ERA Top Layer stands, an honest view of where the effort is going wrong, and a plan for the coming months that a weaker model can execute without missing anything.

Everything in §1 was verified against the working tree on 2026-09-02 by three exploration passes (reactive layer, proactive layer, platform layer), cross-checked with the PM Master Books and a critique pass. Book claims that turned out stale are named.

---

## 1 · Deep analysis — verified state

### 1.1 One-paragraph diagnosis

Between Aug 22 and Sep 2 the reactive ERA brain went from "untested router" to a genuinely good architecture: a deterministic 4-face router (20 intents), a 13-entry capability registry with Zod slot schemas, Ask-AI structured proposals validated server-side that never write without a tap, taught templates that make a learned phrasing native next time, focus memory for pronoun follow-ups, capped auto-escalation, 2,105 green tests. That work is real and the right shape. **It is the only half that moved.** The proactive half, which the Awakening plan called the identity gap on Jul 6, is at zero: no scheduler, no run ledger, no signals, no briefing; ERA has never spoken first. Awakening missed gates G0, G1 and G2 and was never scored, which its own §6 says must trigger stop-and-shrink. The modules ERA reads are thinner than ERA (Kitchen 3.0, Trips 2.8 with cascades never verified), seven shipped features sit on migrations nobody ran, ERA is the only path into the money table with no offline queue, no CI runs a single test, and two assistants coexist with no written treaty.

### 1.2 Reactive ERA (`/era`) — what exists

| Layer | State | Evidence |
|---|---|---|
| Shell | `EraShell.tsx` (550 LOC): orbital mark, 3 views (hub / dashboard / activity), wake on click or wake word; **no sleep transition** (`reset()` never called) | `src/components/era/EraShell.tsx:80-148` |
| Input | `CommandBar.tsx`: mic (browser SpeechRecognition), text, speaker toggle, Ask AI, send; mobile module views use the `EraChatDrawer` sheet | `src/components/era/CommandBar.tsx` |
| Pipeline | `useEraTurn.runTurn`: pending-slot intercept → `rootIntentRouter.parse` (greeting → face switch → active face → cross-face tiering → Layer-2 taught templates → weak clarify → unknown) → optimistic user row → `classifyMiss` → auto Ask-AI on language-gap → `resolveIntent` → `era_actions` log → focus push → assistant row | `src/features/era/useEraTurn.ts:130-265`, `intents/index.ts:145-202` |
| Intents (20) | Budget `monthSpend` `transfer` `recordDebt` `confirmDraft` `listDrafts` `draftTransaction` `showAnalytics` · Schedule `todaySchedule` `draftReminder` `reminderReschedule` `reminderComplete` `reminderDelete` · Chef `recipeSearch` `assignMeal` `mealPlanGaps` `listRecipes` · Brain `memorySave` `memoryRecall` · Root `greeting` `switchFace` `capabilityAction` `clarify` `unknown` | `src/features/era/intents/{budget,schedule,chef,brain}.ts` |
| Capabilities (13) | `schedule.forDay`, `reminder.{create,reschedule,complete,delete}`, `spend.month`, `draft.{list,confirm}`, `recipe.{search,list}`, `meal.assign`, `memory.{save,recall}` | `src/features/era/capabilities/registry.ts` |
| LLM escape hatch | `POST /api/era/ask` → `eraAskProposal.ts`: Gemini structured JSON (`prose` / `propose_nfc_reminder` / `propose_action`), 4 validation gates, `FOCUS` sentinel instead of raw ids, prose fallback on any failure; quotas 15 auto/day · 1M tokens/month · 5/min | `src/lib/ai/eraAskProposal.ts:325-360`, `src/app/api/era/ask/route.ts` |
| Learning loop | `era_templates` learned only after a successful proposal execution; `{slot}` matcher; normalize at learn and match; vocab growth per entity | `src/features/era/templates/*` |
| Persistence | `era_conversations`, `era_messages`, `era_templates`, `era_actions` (only the last has `household_id`) | `migrations/schema.sql:438,1481,1492,1508` |
| Tests | 10 files under `features/era`, `eraAskProposal.test.ts`, `phrasing.test.ts`. **Untested:** `useEraTurn`, `useEraAskAI`, `useEraConversation` (new optimistic write queue), every `/api/era/*` route, every component | exploration map |

**Reactive gaps users hit daily (confirmed, none built):** no balance query · no income write path ("I got paid $2000" is vetoed, not recorded) · no event/appointment creation · no meal-plan read · Chef and Brain faces get **zero** domain context in Ask AI (`ask/route.ts:154-157`) · focus memory knows only `reminder` entities.

**Correctness defects (confirmed):**

- `era_conversations.updated_at` is never bumped: the "6 h inactivity" session roll measures from creation; `useCreateEraMessage` invalidates the conversations query on every message for a value that never changes.
- `capabilityAction` drops `result.ok`, so `bumpTemplateMatch` fires on failure and a failing template climbs the ranking.
- `logEraCapabilityAction` only logs `reminder.*`; Stage-D capabilities never reach the Activity view.
- `logEraAction` writes `/era?face=brain` but no `?face=` handler exists.
- `era_messages.intent_face` has no CHECK; the parent's `active_face_key` does.
- Dead code: `src/components/era/face-widgets/` (5 files, 0 importers), `recipeOfferGenerate` (no producer, "coming soon"), `stubIntentRouter`, `useEraHousehold` (0 consumers), 5 unreachable `MODULE_COLORS` entries, `Face.route` never read; `EraFaceNav` keeps its own label/hue tables that disagree with `faceRegistry`.

### 1.3 Proactive ERA — almost nothing runs

| Mechanism | Evidence it ran | Gap |
|---|---|---|
| 6 cron routes (`chat-notifications`, `daily-reminder`, `daily-items-reminder`, `item-reminders`, `gcal-reconcile`, `purge-recycle-bin`) | side-effect columns only (`last_sent_slots`, `item_alerts.last_fired_at`); `purge-recycle-bin` leaves nothing | **no `vercel.json`, no `cron_runs`, no job liveness in `/api/health`**; 30 `console.*` across three cron routes |
| Briefing | — | **`src/lib/briefing/` does not exist**; `WebTodayView` has a render-time briefing + TTS that needs a user gesture |
| AI focus insights | — | `/api/focus-insights`, `focus_insights` table and `useFocusInsights` exist; **the hook is mounted nowhere: dead feature** |
| Budget / bill alerts | — | `budget_exceeded`, `bill_due`, `bill_overdue` declared in the registry; **no producer** |
| Push | `push_event_logs` per send | works; `pushSender.sendPushToUser()` is the single choke point; `sw.js` is 1,415 hand-written lines |
| Delivery policy | — | no quiet hours, no send budget, no per-type mute |
| Google Calendar | `last_synced_at` | one-way, never live-tested, cron unscheduled |

**Stale book claim:** the Notifications book's 🔴 top pain ("daily items summary opens the expense form") is fixed in code (`daily-items-reminder/route.ts:363,371` use `daily_items_summary` + `/reminders`). NOTIF-1.1…1.6 are done and must be swept.

### 1.4 Voice

Azure STT/TTS live; `conversationEngine.ts` hands `runTurn` to ERA on `/era` (one brain for typed and voice). The legacy path (`intentClassifier.ts`, 8 intents, hardcoded confidences; `HubPage.onQueryItems` answers with placeholder strings) still serves `/chat`; verified: `classifyIntent` has exactly one caller, `conversationEngine.ts:522`. Three TTS entry points (`engine.speak`, `greetingCache`, new `useEraReplyTTS`); only the last has a `speechSynthesis` fallback. **Owner decision 2026-09-02: wake word stays as is; the wake topic (including `azureWake.ts`, `sttCapture.ts`, `vadGate.ts`, both wake regexes) is out of scope for this plan.**

### 1.5 Offline / sync — ERA is the unsafe path

`safeFetch` at 23 ERA sites (good; the uncommitted timeout-is-not-offline fix is right). But **ERA never calls `addToQueue`**. Offline, `resolveIntent` throws `OfflineError` pre-flight, `useEraTurn` collapses it to "Something went wrong. Try again.", and the optimistic row rolls back: **an expense spoken to ERA offline is silently lost, while the same expense typed in the form is queued and replayed.** `useEraConversation.ts:10-11` claims offline-queue behaviour that does not exist. Two raw `fetch()` reads at `useEraConversation.ts:49,92`.

### 1.6 Two assistants, three doors

| | `/era` ERA | `/chat` HubPage AI thread | `AIChatAssistant.tsx` floating |
|---|---|---|---|
| Deterministic layer | 20 intents, registry, templates | none | none |
| LLM | `/api/era/ask` structured proposals | `/api/ai-chat` free-markdown "Budget AI" persona | same |
| Store | `era_*` | `ai_sessions`/`ai_messages` | same |
| Voice | `runTurn` | legacy classifier + placeholders | — |

`HubPage.tsx` is **6,275 LOC** (+297 since the book's 5,978). "Which assistant for what" (Awakening WP-16) was never written.

### 1.7 Platform, tests, data

- **CI runs nothing** (one workflow diffs three markdown mirrors). `vitest` include omits `*.test.tsx`; no jsdom, no testing-library, no Playwright. 30 of 36 feature dirs untested, including `transactions`, `accounts`, `balance`, `debts`, `transfers`, `drafts`, `items`.
- **No migration applied/unapplied ledger.** Pending owner runs, each blocking a shipped feature: `2026-08-26_era-actions`, `2026-08-27_era-templates`, `2026-08-06_hub-message-color`, `2026-08-04_trips-packing-checkpoint-recyclebin`, Healthcare core (HLTH-7), Outfits core (OUT-19), `2026-08-01_pm-commands-instant-gates` (DLV-77). `migrations/db-state.json` is dated Aug 4 and does not contain `era_actions`/`era_templates`.
- **No backup/export path exists** (no export route, no dump runbook; free-tier Supabase has no point-in-time recovery).
- Person-absolute color identity (Hard Rule 14) has **no helper and no data**: `profiles` is 3 columns.
- `household_members` exists in the live DB (RLS on) with zero references in `src/`, beside `household_links`.
- Inbox 2026-08-19: RLS **disabled** on `guest_drinks` and `item_prerequisites`.
- Native: 0% (no `capacitor.config.*`, no `android/`/`ios/`, no `@capacitor/*`); the Native trigger fired 2026-07-11, so building it is sanctioned. 14 per-route manifests under `public/manifests/` (book says 9).
- Working tree: 32 modified + 4 untracked files (HUB-35/36, ~1,442 insertions), finished, uncommitted, never run in CI.

### 1.8 Manual modules — the graphs ERA reads

| Campaign | Maturity | What limits ERA |
|---|---|---|
| Budget | 5.8 | statement-import repair queue (BUD-39/36/32) leaves duplicates in the money graph |
| Schedule | 5.5 | `task` type not retired (SCH-6.1); occurrence engines still diverge (SCH-4.3b) |
| Kitchen | 3.0, unchanged 3 generations | no low-stock→shopping (KIT-1), no recipe→inventory (KIT-2): the Chef face has nothing to anticipate |
| Trips | 2.8, unchanged 3 generations | lifecycle cascades never end-to-end verified (TRIP-1/2/3); no impact panel (TRIP-4) |
| Healthcare | 4.8 | core migration unrun (HLTH-7); Phase 2 meds unbuilt; `get_health_bundle` RPC exists |
| Outfits | — | core migration unrun (OUT-19) |
| Notifications | 5.8 | bell perpetual, drawer over-described, no policy; NOTIF-1.x already fixed |

### 1.9 Where the effort is going wrong — seven findings

1. **The plan-of-record failed silently.** Awakening G0/G1/G2 missed and never scored. Its own rule says stop and shrink. This plan is that shrink, in writing.
2. **Reactive depth outran proactive existence.** Twelve days produced a phrasing-learning loop before ERA could answer "what's my balance" or say one unprompted sentence. Doctrine §5 ranks foresight below trust and capture, but a *zero* on foresight after three months is the identity failure the Testament names.
3. **ERA is smarter than the graphs it reads.** Kitchen and Trips at 3.0/2.8 and unverified. Module maturity is ERA's input, not a separate hobby.
4. **Shipped ≠ live.** Seven migrations unrun; `era_templates` (the learning loop) and `era_actions` (Activity) do not exist in production. No ledger records what was applied.
5. **The flagship capture path is the only one that loses data offline.** A Doctrine-priority-1 bug, not polish.
6. **Two brains, no treaty.** HubPage grew ~300 lines; its voice still speaks placeholders.
7. **Nothing verifies anything automatically.** No CI, no e2e, money hooks untested; every "green" in the Shipped Log was local.

---

## 2 · North star and definitions (carried forward, not re-argued)

**One line:** turn ERA from a chat box that answers into a household brain that anticipates, reading the full time + money graph and speaking first, correctly, at the right moment, with the right context.

**Proactive ladder (kept):** L0 answers · L1 scheduled static · L2 composed ranked brief · L3 brief with attached draft action · L4 learns from feedback. **Targets: L2 by Oct 12 · L3 by Dec 7 · first L4 loop by Dec 31.**

**Interaction ladder (kept):** L-0 glance · L-1 one-tap draft action · L-2 door into the owning module · L-3 sentence (CommandBar/voice).

**"Which assistant for what" (decided here; written into the vault in M-00):**
- **ERA** (`/era`, and voice anywhere) is *the* assistant: every action, every household question, every proactive message. One router, one registry, one persistence. Briefings deep-link to `/era`.
- **Hub Chat** is the household's conversation with each other; its message actions stay the message-first bridge into transactions/items. Its AI thread and legacy voice classifier are retired into ERA (E-13).
- **Budget analysis reports** (`AnalysisReport`) become a Budget-face capability rendered where asked; the floating `AIChatAssistant` is deleted once the report is reachable from ERA (E-10).

**Two lanes, WIP-1 each.** Lane **E** (ERA + platform), lane **M** (manual modules that feed ERA), lane **N** (native), lane **H** (hygiene, fills half-sessions). ≈2 packets/week total; a packet is ≤1 session (2–4 h); L-sized packets are forbidden and split. Lane M is not optional: every Phase-3 signal has a Lane-M prerequisite.

---

## 3 · Decision register (defaults binding; owner answers of 2026-09-02 recorded)

| # | Decision | Binding default | Source |
|---|---|---|---|
| D1 | Scheduler of record | **Supabase `pg_cron` + `pg_net`** calling the web deployment with `Bearer CRON_SECRET` (Hobby tier confirmed; Vercel crons capped at 2/day) | owner 09-02 |
| D2 | Wake word | **Out of scope, untouched.** No park text, no spike, no deletions under the wake topic | owner 09-02 |
| D3 | Composer engine | Deterministic templates over typed signals; LLM phrasing never before the quota gauge (E-07) | Awakening D3 |
| D4 | Conversation stores | `era_*` is the assistant store; `ai_sessions/ai_messages` is AI telemetry + analysis-report history; no fourth store | Awakening D4, resolved |
| D5 | Delivery policy | Quiet 21:00–08:00 Beirut · 3 pushes/day/user · classes urgent/info/digest · overflow → digest | Awakening D5 |
| D6 | Partner inclusion | Partner is a **daily user** → she receives the briefing from **day 6** (after 5 owner-only mornings) with her own toggle and hour; person-absolute colors ship in Phase 2 | owner 09-02 |
| D7 | Cadence | ~2 packets/week ≈ 34 slots; catalog ≈ 37 sessions + owner days; sacrifice order pre-written (§5.8) | owner 09-02 |
| D8 | Native | Accounts/groundwork start **Sep 15** (weeks of verification waits, zero code); shell + push + store tracks in December; Android first. Justification: native buys **reliability** (DND, exact alarms, NFC auto-open) for a payload that now exists, not a new channel | Native book |
| D9 | `focus_insights` | **Retire** (route, hook, table) in the E-05 migration; the briefing replaces it. One engine per concept | this plan |
| D10 | HubPage | Only shrinks; every extraction rides a feature (E-13 is the one sanctioned rider) | Awakening O2 |
| D11 | ERA offline | Write intents ride the **existing** `offlineQueue` feature types (`transaction`, `item`) through one choke point `enqueueCapabilityAction()`; **no `era` key in `FEATURE_QUERY_KEYS`**; Phase 0 makes failure honest, Phase 1 makes it queued | Doctrine choke points |
| D12 | Migrations | `migrations/README.md` gains an **Applied** table only the owner edits; a feature is not "shipped" in a Master Book until its migration row is stamped | this plan |
| D13 | LLM model | Keep the `-latest` aliases; add `AI_MODEL`/`AI_FALLBACK_MODEL` env overrides as a pin/kill switch; monthly one-line check in the hygiene ritual | verified |
| D14 | `household_members` | Owner verdict on the Phase-0 owner day: drop by migration (Corollary B) or document why it stays in `Household Sharing/Overview.md` | critique |
| D15 | Capture-share measurement | `transactions.source text check(era\|form\|import\|chat)` added in the E-05 migration; every write path stamps it | Awakening §8 |
| D16 | `intentClassifier.ts` | Retired inside E-13 (its only caller is the legacy voice branch); `getWakeGreetingVariants` in `speechTemplates.ts` survives for the greeting cache | verified 09-02 |
| D17 | `features/memories/` | Awakening D7 fold date (Sep 13) stands: fold unless E-04's signals need a memory read; decided in M-00 | Awakening D7 |
| D18 | Declared-but-unproduced notification types | `budget_exceeded`/`bill_due`/`bill_overdue` are produced by E-21/E-22 or deleted in Phase 3 | critique |

---

## 4 · Program overview

| Phase | Window | Theme | Exit gate (binary) |
|---|---|---|---|
| **0 · Ground truth** | Sep 2–14 | commit, CI, migrations applied, cron ledger + scheduler, offline honesty, doc truth | **G0** (§6) |
| **1 · ERA speaks first** | Sep 15–Oct 12 | signals → briefing → push → feedback; quota gauge; reactive reads then writes with the offline choke point; Trips/Kitchen truth; native accounts opened | **G1** |
| **2 · One brain, two people** | Oct 13–Nov 9 | status line + card, HubPage voice → ERA, Top View bundle + mobile vitals, partner, voice degradation, export/backup, security pass | **G2** |
| **3 · Proposes and learns** | Nov 10–Dec 7 | delivery policy first, then L3 cards, anomaly, module signals, ranker; Notifications calm; Healthcare meds | **G3** |
| **4 · Native** | Dec 8–31 | Capacitor shell + FCM push on both phones; Schedule task-type retirement while native waits | **G4** |

Gate protocol: on each gate date score it in §8, pass or miss with one-sentence cause. Two consecutive misses ⇒ drop Phase 4 (native slides to January), then §5.8's list in order; never stretch dates silently.

---

## 5 · Packet catalog (the execution contract)

### 5.0 Packet template — every packet carries all fields; executors STOP if one is missing

```
ID · name · size (S ≤ 0.5 session, M ≤ 1 session; L forbidden — split) · lane · phase
Outcome:   one user-visible sentence, present tense
Prereqs:   packet IDs · migrations that must be APPLIED (owner-stamped in migrations/README.md, not merely written)
Skills:    start-task → [domain skills in order] → finish-task
Files:     ALLOWLIST of paths to touch. FORBIDDEN always: src/components/ui/**, HubPage.tsx (unless the packet is its rider), schema.sql without a paired migration file
DB change? yes → write migrations/YYYY-MM-DD_*.sql + schema.sql, then STOP and hand the SQL to the owner. Never report it applied.
AI call added? yes → E-07 must be ✅ and the packet names the feature key it counts under.
Money/schedule math? yes → worked before/after example in the PR text + one test.
Gate:      copy-pasteable command(s) + expected output, or a screenshot spec
PM:        checklist line to tick + the Master Book Shipped Log sentence
NOT done:  migration written ≠ applied · test file ≠ test in CI include · comment changed ≠ behaviour changed · "works locally" ≠ evidence pasted

STOP (any one ⇒ stop, write a 5-line handoff, do not improvise):
 S1 a file outside the allowlist needs editing
 S2 a DB write is required to proceed (Hard Rule 26)
 S3 test count decreases, or typecheck/lint/test is red
 S4 HubPage.tsx line count increases, or a new import of HubPage internals
 S5 a new dependency must be installed
 S6 the packet will not finish in one session
 S7 the symptom is "X can't see Y" → Hard Rule 27's two queries before any code
 S8 the spec is ambiguous on money/schedule → ask one question, never pick a default
 S9 an AI proposal path would write without a confirm tap (drafts pattern)
 S10 a second engine/queue/toast/regex/aggregation for an existing concept would be created
 S11 the packet says "wake word" (D2)
 S12 a UI change moves or restyles an existing /era element (additive only — memory `feedback-no-unrequested-ui-redesign`)
```

Every gate that touches shared data is verified on **both phones** (the partner is the second viewer; visibility leaks are a silent-failure class).

### Phase 0 · Ground truth (Sep 2–14) — 4 code packets + 1 owner day

- [ ] **E-01 · Commit the WIP + CI that runs + offline honesty · M · E.** Commit the current tree (HUB-35 router hardening, HUB-36 latency, three new test files) as one commit. Add `.github/workflows/ci.yml` (`pnpm install --frozen-lockfile`, `typecheck`, `test`, `lint`) on push + PR; add `"src/**/*.test.tsx"` to `vitest.config.ts` include. **Offline honesty rider (S):** replace the two raw `fetch()` in `useEraConversation.ts:49,92` with `safeFetch`; delete the false comment at `:10-11`; in `useEraTurn`, when a write intent hits `OfflineError`, reply from a new phrasing pool "You're offline — open the expense form to log this" with a door to `/expense` (prefill via the existing `?amount=` params if present), never "Something went wrong". Files: `.github/workflows/ci.yml`, `vitest.config.ts`, `src/features/era/useEraConversation.ts`, `src/features/era/useEraTurn.ts`, `src/lib/era/phrasing.ts`, new `src/features/era/useEraTurn.test.ts`. Pattern: `.claude/hooks/pre-commit.sh`. → *Gate:* `gh run list -L1` success; airplane-mode "spent $5 on coffee" shows the refusal, no "Drafting…" reply. *PM:* HUB-21 (the stale-server verification) closed by CI; new PM Tooling item R49 (CI).

- [ ] **E-02 · Cron run ledger + migration ledger + health liveness (WP-01) · M · E.** Migration `2026-09-xx_cron-runs.sql`: `cron_runs(id, job, started_at, finished_at, status check(running|ok|error), detail jsonb)`, index `(job, started_at desc)`, owner-read policy. New `src/lib/cron/ledger.ts` `withCronRun(job, fn)`. Wrap all six `src/app/api/cron/*/route.ts`; strip their `console.*` (NOTIF-5.4). `/api/health?jobs=1` returns `{job, last_finished_at, last_status}` per job (the 15-line HEAD path stays untouched — `connectivityManager` depends on it). `migrations/README.md`: **Applied** table (file · applied on · by). Skills: `db-migration`, `api-route` (cron). → *Gate:* each route hit locally with the Bearer → 6 `cron_runs` rows; `curl -s /api/health?jobs=1 | jq .jobs` lists 6; `grep -rc "console\." src/app/api/cron` → 0. *PM:* NOTIF-5.4 ticked; HUB-37.

- [ ] **E-03 · Scheduler of record = pg_cron (WP-02) · S · E + owner.** Migration `2026-09-xx_pg-cron-schedule.sql`: `cron.schedule` for the six routes (`chat-notifications` and `item-reminders` every minute; `daily-reminder` and `daily-items-reminder` every 5 min; `gcal-reconcile` 02:00 UTC; `purge-recycle-bin` 03:00 UTC) plus a **commented** `era-briefing` slot at 04:15 UTC (07:15 Beirut), each `net.http_post` to `https://<web-domain>/api/cron/<job>` with the Bearer read from `vault.decrypted_secrets` (owner stores `CRON_SECRET` in Vault; never in migration text). Owner first checks `select extname from pg_extension where extname in ('pg_cron','pg_net')` and enables both. Document in `docs/ENV.md` + the Native book's "cron targets web only" rule. Skills: `db-migration`, `timezone-handling`. → *Gate:* next calendar day, `select job, max(finished_at) from cron_runs group by 1` shows six unattended fires. *STOP if:* pg_cron unavailable → GitHub Actions `schedule:` fallback, jitter noted.

- [ ] **M-00 · Truth sweep: scores, treaty, decisions, dead ERA code · M · M.** (a) Append three dated **MISSED** lines to Awakening §14 (G0 Jul 8, G1 Jul 19, G2 Aug 16 — cause: Program A never started) and set both Awakening and Top View frontmatter `status: superseded` with a pointer here. (b) Write the "Which assistant for what" paragraph (§2) into `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`. (c) Decision lines in the Hub & ERA book: `focus_insights` → retire (D9); `features/memories/` → fold/keep (D17); declared-unproduced types (D18); gcal → owner live-tests once in Phase 1 or parks in writing; NFC inbox entry → triaged to Later, no code before N-05. (d) `pnpm pm:archive` NOTIF-1.1…1.6 with the file:line evidence; fix the Native book manifest count (14) and Hub book LOC (6,275). (e) Delete ERA dead code: `src/components/era/face-widgets/`, `recipeOfferGenerate`, `stubIntentRouter`, `useEraHousehold.ts`, 5 unreachable `MODULE_COLORS`, `Face.route`; `EraFaceNav` reads labels/hues from `faceRegistry`. Nothing under `voice-conversation/` (D2). → *Gate:* `pnpm test` green; `grep -rl "face-widgets\|recipeOfferGenerate\|useEraHousehold" src | wc -l` → 0; `pnpm pm:lint` clean; Awakening §14 has 3 MISSED lines.

- [ ] **M-01 · BUD-32 free the statement fingerprint on delete · S · M.** `DELETE /api/transactions/[id]` nulls `statement_hash` on soft delete; recycle-bin restore re-stamps it. Must precede the owner's BUD-39/36 repair or freed rows re-skip. Skills: `money-rules`. → *Gate:* route test: delete → hash null → restore → hash back.

- [ ] **E-00 · Owner day (no agent code) · 0.25.** In the Supabase SQL Editor, in order: `2026-08-06_hub-message-color`, `2026-08-04_trips-packing-checkpoint-recyclebin`, `2026-08-26_era-actions`, `2026-08-27_era-templates`, `2026-08-01_pm-commands-instant-gates`, Healthcare core (HLTH-7), Outfits core (OUT-19), then E-02's `cron-runs`, E-03's `pg-cron-schedule`, and the two agent-authored security migrations below. Then BUD-39 runbook (`2026-08-24_repair-delete-duplicates.sql`) and BUD-36 month-by-month re-import. Then D14 verdict on `household_members`. Then run `migrations/db-state.sql`, commit `db-state.json`, stamp every row in the Applied table. Agent-authored before the day: **H-01** RLS migration for `guest_drinks` (SECURITY DEFINER RPC keyed on the tag slug for the guest flow, Hard Rule 20) and `item_prerequisites` (direct `user_id` policy or via the items bundle). → *Gate:* `pnpm db:verify-rls` passes; `db-state.json` stamp ≥ the owner day and contains `era_actions`, `era_templates`, `cron_runs`; `2026-08-24_diagnose-imported-transactions.sql` reports 0 duplicates. *PM:* HLTH-7, OUT-19, TRIP-18, DLV-77, BUD-39, BUD-36 ticked.

### Phase 1 · ERA speaks first (Sep 15–Oct 12) — 8 slots

- [ ] **N-00 · Native accounts and groundwork · owner, async from Sep 15 · N.** Apple Developer, Play Console, Firebase project (FCM only), the `era-mobile` Vercel project with env parity, final mobile domain, Supabase redirect allow-list; register the `NAT` prefix in `_Conventions.md` + `scripts/pm/lint.mjs`, create `Native App/4 - Checklist.md`. → *Gate (by Oct 12):* both store accounts verified; `era-mobile` deploys the same commit as web.

- [ ] **E-04 · Signals v0 (WP-03) · M · E.** `src/lib/briefing/signals.ts` (server-side, pure, typed): `Signal { id, face, severity: "urgent"|"info"|"digest", claim, provenance: {table, ids[]}, action?: {capabilityId, slots}, doorRoute }`. Three builders over existing substrates, no new aggregation: `scheduleTodaySignals` (from `get_schedule_bundle` output), `recurringDueSignals` (next 7 days via `src/features/recurring/commitments.ts`, **including the cheap overdraw check: due amount > account balance → urgent**; this is HUB-4/BUD-4's whole first version), `spendVsPlanSignals` (yesterday + month-to-date vs allocation, custom billing month via `startOfCustomMonth`). `rankSignals()` deterministic (severity, due proximity, amount). `signals.test.ts` on fixtures. Skills: `money-rules`, `timezone-handling`. → *Gate:* tests green; every signal has provenance ids; `grep -rn gemini src/lib/briefing` → 0.

- [ ] **E-05 · Briefing v0.5 — compose, store, push (WP-04) · M · E.** `src/lib/briefing/compose.ts` `composeBriefing(signals)` deterministic over `src/lib/era/phrasing.ts` pools. Registry entry `era_briefing` (route `/era`, class System). One migration: `notifications` type CHECK; unique partial index on `group_key` for `era_briefing:<user>:<date>` (exactly-once); `transactions.source` (D15); drop `focus_insights` + delete its route/hook (D9); `era_conversations.updated_at` trigger + `era_messages.intent_face` CHECK (from §1.2). New `src/app/api/cron/era-briefing/route.ts` (Bearer, `supabaseAdmin`, `maxDuration=60`, `withCronRun`), recipients from `notification_preferences.metadata.era_briefing {enabled, hour}`, owner only for 5 days (D6). Owner activates the pg_cron slot. Skills: `api-route` cron, `db-migration`, `recurrence-safety`. → *Gate:* push on the owner's phone next morning; tap lands on `/era`; second manual fire same day returns `{skipped:"dedupe"}`; `cron_runs` row for `era-briefing`.

- [ ] **E-06 · Briefing feedback + ERA vital signs (WP-05) · M · E.** Migration `briefing_feedback(id, user_id, notification_id, verdict check(up|down), acted, dismissed_at, created_at)`. 👍/👎 on the drawer and `/alerts` rows for `era_briefing`; SW notification actions in `public/sw.js` (registry vs sw: change both). "ERA vital signs" block at the top of `ArtifactsView.tsx`: SFR₇, precision (14 d), cron liveness (`/api/health?jobs=1`) as three `EraStatCard`s. Skills: `ui-guardrails`, `dataviz`. → *Gate:* SFR tile > 0 after the first fire; a 👎 writes a row; Undo on 👎.

- [ ] **E-07 · AI quota gauge + degradation matrix + model pin (WP-22) · S · E.** View `ai_usage_daily` over `ai_messages` (calls, tokens, per `session_id` feature key); sparkline tile joins the vital-signs block; matrix paragraph in the AI Assistant vault doc (which feature dies first at quota and what it says). `AI_MODEL`/`AI_FALLBACK_MODEL` env overrides in `gemini.ts` (D13); route `streamMessageToGemini` through `generateContentWithFallback`; delete the per-process cooldown globals in `/api/ai-chat/route.ts`. One vault line: `ai-usage` module = manual subscription planner; this gauge = automatic per-call counter; never a third. → *Gate:* sparkline moves after one Ask AI; matrix exists; `AI_MODEL=x pnpm dev` is honored.

- [ ] **E-08 · Reactive reads: balance, meal plan, Chef/Brain context · M · E.** `balanceQuery` ("what's my balance", "how much in wallet"; per-account via the same `fuzzyMatchAccount` as `transfer`; household vs own via existing `?ownOnly`) → `GET /api/accounts`; `mealPlanRead` ("what's for dinner tonight", "meal plan this week") → `meal_plans` range read; capabilities `balance.query`, `meal.read`; vocab buckets. In `/api/era/ask` inject `fetchChefContext` (recipe titles + this week's plan, ≤40 rows) and `fetchBrainContext` (memory labels, ≤50) from `src/lib/ai/context.ts` (counts under feature key `era-ask`, E-07 ✅). Router rows + resolve tests + phrasing pools. → *Gate:* fixtures green; live "what's my balance" answers with the real number; "what's for dinner tonight" answers; Ask AI on Chef proposes `recipe.search` for a phrasing the router misses.

- [ ] **E-09 · Reactive writes: income + events through the offline choke point · M+S · E.** New `src/features/era/enqueueCapabilityAction.ts`: on `OfflineError` for a write capability, `addToQueue` with `feature: "transaction"` (op shape from `useDashboardTransactions.ts`) or `feature: "item"` (from `useItems.ts`); reply "queued, will sync when back online"; `era_messages.intent_payload.queued = true`. `draftTransaction` and `draftReminder` move onto it (replacing E-01's refusal for these two). `incomeDraft` ("I got paid $2000", "received 300 from John") → `useEraBudgetSubmit` `kind: "income"` posting an `is_draft` transaction against `accounts.is_default_income`; `INCOME_RE` routes instead of vetoing. `eventCreate` ("dentist appointment tomorrow at 5", "book a meeting Friday 10–11") → `POST /api/items` `type: "event"`, start/end from `parseSmartText` `startDate/startTime`; capability `event.create`; no rrule from text (SCH-1b.4 stays gated). Money fixtures: `src/lib/balance-utils.test.ts` gains income-draft-confirm and transfer double-entry cases. Skills: `money-rules` (worked before/after example), `recurrence-safety`, `cache-invalidation`. → *Gate:* airplane mode "spent $5 on coffee" → one queued op with `feature:"transaction"` → reconnect → exactly one transaction + Undo toast; income draft in Drafts with the right sign; event created with the right start.

- [ ] **E-11 · ERA correctness bundle · S · E.** Stop invalidating `eraKeys.conversations()` per message; `resolveIntent` `capabilityAction` returns `ok` and skips `bumpTemplateMatch` when `ok === false`; `logEraCapabilityAction` maps every registry entity (`transaction`, `meal_plan`, `memory`, `event`); `/era?face=` read once on mount in `EraShell`. Tests for each. → *Gate:* ≥4 new cases green; `/era?face=brain` lands on Brain.

- [ ] **M-02 · Trips cascades verified + impact panel · M · M.** Build TRIP-4 (read-only "Trip impact" panel over `trip_side_effects`) first; then the owner activates and completes one household trip and one solo trip on the live app (TRIP-1/2/3) with the panel as checklist. Skills: `recurrence-safety`, `ui-guardrails`. → *Gate:* `select count(*) from trip_side_effects where reversed_at is null` after completion → 0; `recurring_payments` untouched; Trips D1/D2/D3 ticked. *STOP if:* a cascade fails → 🔴 in the Trips book; do not patch RPC bodies that live only in the DB.

- [ ] **M-03 · Kitchen: low-stock → shopping list (KIT-1) · M · M.** In the inventory mutation route, when quantity drops below threshold, upsert a shopping-list row via the existing hub shopping-list write path (respect the legacy localStorage queue; do not migrate it). Export pure `lowStockItems(inventoryRows)` from `src/features/inventory/` for E-22 to reuse (built once). → *Gate:* Kitchen D1; a second drop does not duplicate the row; `lowStockItems.test.ts` green.

### Phase 2 · One brain, two people (Oct 13–Nov 9) — 8 slots

- [ ] **E-10 · Status line + in-hub briefing card + analysis capability (WP-11/T2) · M · E.** `GET /api/era/briefing/today` returns today's stored briefing row + ranked signals (`eraKeys.briefing()`, `staleTime = CACHE_TIMES.TRANSACTIONS`). Replace the static "4 modules on deck." subtitle with the deterministic status sentence; render the briefing as one card **above the transcript in hub view, additively** (S12). Offline paints from cache with an "as of HH:MM" stamp. Add capability `analysis.report` (Budget face) that calls the existing `generateAnalysisReport` and renders the existing report component in the transcript; then delete `AIChatAssistant.tsx` + its deferred loader (§2 treaty). Skills: `ui-guardrails`, `cache-invalidation`. → *Gate:* 390×844 screenshot: greeting, status line, card; airplane reload paints with stamp; `ls src/components/ai/AIChatAssistant.tsx` → absent; the same money question yields the report component in ERA.

- [ ] **E-13 · HubPage voice → ERA (HUB-16, the sanctioned rider) · M+S · E.** HubPage's `useConversationMode` instance gets `runTurn` from `useEraTurn` with `conversationId: null` (no `era_*` rows from `/chat`; replies post as hub system messages). Delete `intentClassifier.ts`, the legacy five callbacks (`HubPage.tsx:1819-1880`), the legacy branch (`conversationEngine.ts:518-551`), `invokeAI` if nothing else calls `/api/ai-chat/stream`; keep `getWakeGreetingVariants` (D16). ERA turn errors go to the Error Logs module (`src/app/api/error-logs/`), joined with miss classification. → *Gate:* "remind me tomorrow at 9" via `/chat` voice saves with 09:00; `wc -l src/components/hub/HubPage.tsx` < 6,275; `ls src/features/voice-conversation/intentClassifier.ts` → absent. *STOP if:* any HubPage line added that is not a deletion or the one hook call.

- [ ] **E-14 · `get_era_topview_bundle()` RPC (T1) · M+S · E.** SECURITY DEFINER RPC returning `{budget, schedule, chef, brain}` shaped exactly like the four `*Summary` interfaces, household-scoped inside the function (copy `get_schedule_bundle`'s WHERE from `db-state.json`). The four `widgets/use*Summary.ts` become selectors over `eraKeys.topview()`; `useScheduleSummary`'s 300-row client bucketing deleted. Invalidation union listed in `Cache Invalidation.md`. Skills: `db-migration`, `cache-invalidation`, `money-rules`. → *Gate:* network tab: 1 request where 7 fired; all four scatter widgets render unchanged.

- [ ] **E-15 · Vitals strip on mobile, ambient (T3) · M · E.** 2×2 strip under the greeting **mobile only** (`md:hidden`), fed by `eraKeys.topview()`, rendered in the asleep state too. Desktop untouched. First `*.test.tsx` (jsdom + testing-library devDeps — S5 pre-approved here). Skills: `ui-guardrails`. → *Gate:* 390×844 shows four vitals from cache < 1 s; airplane paints with stamp; desktop screenshot unchanged.

- [ ] **E-16 · Partner: colors, her briefing, her flow · M · E.** `src/lib/personColor.ts` `personColor(userId)` per Hard Rule 14 from `useTheme()`, used by the strip, Activity rows and briefing card. Partner briefing on her `notification_preferences.metadata.era_briefing` (hour, enabled), flipped on after 5 owner mornings (D6). Ask her the one flow she wants ERA to handle (Q-PARTNER) and file it as the next E packet. → *Gate:* her phone receives at her hour; the same reminder shows the same color on both phones.

- [ ] **E-17 · Voice degradation (HUB-2/WP-15) · M · E.** One `speak()` seam used by `conversationEngine`, `greetingCache`, `useEraReplyTTS`, with the `speechSynthesis` fallback promoted into it. Orb states + text fallback for token-mint fail, SDK load fail, worklet fail, mid-stream drop; tests with forced failures. No wake code (D2). → *Gate:* each forced failure visibly distinct; four tests green.

- [ ] **M-04 · Household export + restore runbook · M · M.** SECURITY DEFINER `export_household(uid)` RPC returning JSON of every household table; owner-only `GET /api/export` streaming it; Settings download button; `migrations/RESTORE.md` monthly `pg_dump` + restore runbook. Testament P5. → *Gate:* export downloads and parses; restore dry-runs on a scratch project (owner).

- [ ] **M-05 · Kitchen: recipe → inventory deduction (KIT-2) · M · M.** "Cooked" in cooking mode deducts unit-matching ingredients (else skip with a note), feeding M-03. → *Gate:* Kitchen D2; cook twice deducts twice; cancel restores.

- [ ] **Owner, 1 h, Phase 2:** estate census — one line per module (Watch, Analytics, Future Purchases, Debts, Catalogue, Focus, Chores, Plan My Day, Dashboard, Recycle Bin, Error Logs, Guest Portal, NFC): keep / maintain-only / park, in `10 - Project Management/_index.md`. Security pass: owner opens Supabase → Advisors (security + performance) and pastes findings into the Inbox; agent runs `/security-review` on the branch. → *Gate:* 0 RLS-disabled public tables; census table exists.

- [ ] **E-18 · ERA sessions picker + deterministic titles · M · E (sacrifice #1).** (Inbox 2026-08-27.) Session sheet from `GET /api/era/conversations`, reopen, archive with Undo (`PATCH is_archived`), new session. Title = `"<Face> · <first resolved intent title>"`, no LLM. → *Gate:* reopen yesterday's session; title non-empty.

### Phase 3 · Proposes and learns (Nov 10–Dec 7) — 8 slots

- [ ] **E-19 · Delivery policy v1 (WP-12) · M · E.** `src/lib/notifications/deliveryPolicy.ts`, pure and tested like `chatNotificationPolicy.ts`: quiet hours per user timezone, 3 pushes/day/user, class routing, overflow → one `digest` push at 08:00. Consulted inside `pushSender.sendPushToUser` so every producer inherits it. Preferences UI: quiet hours + per-type mute (NOTIF-5.7). → *Gate:* test: forced 4th push suppressed into the digest; a 21:30 info push defers to 08:00.

- [ ] **E-20 · Signal stack + card actions + doors (T4/T5) · M+S · E.** Max-3 ranked `Signal` cards in hub view and the briefing card (same component): provenance line, one action (`Log it` → draft via `useEraBudgetSubmit`; `Postpone` → `reminder.reschedule`; `Review` → door), empty state "Nothing needs you", `dismissed_at` on dismiss < 5 s (regret). Doors from `faceRegistry` + card-type → route map. → *Gate:* seeded urgent signal ranks first; its action produces a draft, never a direct write (S9); doors navigate.

- [ ] **E-21 · Anomaly → proposal (WP-18) · M · E.** After-insert check in `POST /api/transactions` (`after()`): amount > 3× the category's 90-day median, or first-seen merchant > $50 → `Signal` (type `budget_exceeded`, D18) → policy-gated push → "Recategorize" opens the existing edit modal. No LLM. Skills: `money-rules`. → *Gate:* seeded anomaly → exactly one card with a "why" line; identical second insert → none.

- [ ] **E-22 · Module signals: Kitchen, Trips, Healthcare (WP-20) · M · E.** `lowStockItems()` (M-03) + `mealPlanGaps` → "low on 3 staples, nothing planned Thursday"; Trips re-entry (TRIP-9) from trip end dates; Healthcare dose-due from `get_health_bundle` (HLTH-17; only if M-07 landed, else fixture-only). Each a `getBriefingSignals` contributor with a fixture proving it appears only when real. → *Gate:* fixtures green; next morning's briefing mentions a seeded low-stock item.

- [ ] **M-06 · Notifications: calm bell + one-tier drawer + Undo · M · M.** NOTIF-2.1–2.5, 3.1–3.5, 5.6. Skills: `ui-guardrails`. → *Gate:* `prefers-reduced-motion` static dot; one-tier rows; Undo on dismiss/snooze.

- [ ] **M-07 · Healthcare Phase 2 medications (HLTH-8..12) · split into M-07a migration+routes, M-07b UI+battery · M (sacrifice #3).** Per the Healthcare book. Skills: `db-migration`, `recurrence-safety`. → *Gate:* a 2-dose med = exactly 2 items; edit → 0 duplicates.

- [ ] **E-23 · Feedback-weighted ranker + "why am I seeing this" (WP-19) · M · E (sacrifice #4).** `rankSignals` reads `briefing_feedback`: two consecutive 👎 on a type halves its rank for 14 days; every card shows its provenance line. → *Gate:* fixture demotes deterministically.

- [ ] **M-08 · Outfits Phase 2 auto-tag (OUT-7/8) · M · M (sacrifice #2; only if OUT-19 acceptance passed on the owner day).** → *Gate:* auto-tag pre-fills editable fields with `timeoutMs: 60_000`.

### Phase 4 · Native (Dec 8–31) — 6 slots

- [ ] **N-01 · Capacitor shell — Android · M+S · N.** Prereq line: manifest inventory (`ls public/manifest.json public/pm.webmanifest public/manifests/` → 16 files) recorded in the Native book. `capacitor.config.ts` with `server.url`, committed `android/`, icons/splash/status bar, `src/lib/native/` bridge skeleton (the only `@capacitor/*` import surface, S5 pre-approved), SW platform guards. → *Gate:* app runs on the owner's Android: login, `/era` (mic works), hub chat, offline banner.

- [ ] **N-02 · iOS shell + `WKAppBoundDomains` spike · M · N.** Commit `ios/`; run the spike on the partner's iPhone (SW offline cold start + bridge injection). → *Gate:* verdict written in the Native book; app launches and logs in.

- [ ] **N-03 · Native push end-to-end · M+S · N.** Migration `native_push.sql` (platform column, nullable `p256dh`/`auth`), Zod discriminated union on subscribe, `pushSender.ts` FCM v1 branch with the `data.type` → channel/priority table, native branch in `usePushNotifications.ts`, Android channels, iOS Time Sensitive. → *Gate:* the 07:15 briefing lands on both locked phones with the right sound and deep-links to `/era`; browser web-push unregressed via the test endpoint.

- [ ] **N-04 · Distribution · owner · N.** Play internal + TestFlight internal; partner onboarded; auto-update proven with a trivial bump. → *Gate:* both phones on store-track builds.

- [ ] **M-09 · Schedule: retire the `task` type (SCH-6.1) · split M-09a DB+types, M-09b surfaces+docs · M (Lane M while native waits).** Skills: `db-migration`, `recurrence-safety`. → *Gate:* `grep -rn '"task"' src --include=*.ts*` → migration note only; tests green.

- [ ] **N-05 · Native wave 1 · M · N (sacrifice #5).** App/Universal Links, native NFC read → existing tag flow, haptics shim. → *Gate:* a real tag opens the app to the tag route on Android.

### Hygiene lane (fills any half-session; no phase)

- [ ] **H-02 · Lint guards for Hard Rules 6 and 22 (R44, R47) · S.** warn-level `no-restricted-syntax` for raw mutating `fetch` in client dirs; scoped `no-console`. → *Gate:* `pnpm lint` reports counts; CI unchanged.
- [ ] **H-03 · Hub message → transaction default date · S.** (Inbox 2026-08-01) `AddTransactionFromMessageModal` defaults to the message's `created_at`. → *Gate:* test + manual.
- [ ] **H-04 · Inbox triage · S.** Run `/triage-inbox` on: NFC arrive/leave enhancement (→ Later, after N-05), dual-approval transactions (→ Budget, design first), Trips shared-account/FX (→ Trips Later; partly shipped by multi-currency 08-04), e-statement transfer (→ already shipped `2026-08-24_statement-import-transfers`, close). → *Gate:* Inbox "New" empty.

### 5.8 Capacity and the sacrifice order

Sessions: Phase 0 ≈ 3 + owner day · Phase 1 ≈ 8.5 · Phase 2 ≈ 9 · Phase 3 ≈ 9.5 · Phase 4 ≈ 7 → ≈ 37 against ≈ 34 slots. Pre-decided sacrifice order when a gate is missed: **#1 E-18 sessions picker · #2 M-08 Outfits · #3 M-07 Healthcare meds · #4 E-23 ranker · #5 N-05 native wave 1 · #6 all of Phase 4 (native slides to January).** Phases 0 and 1 are never sacrificed; they are the point.

---

## 6 · Gate table (binary; one command or one screenshot each)

| Gate | Date | Check | Command / artefact | Pass |
|---|---|---|---|---|
| **G0** | Sep 14 | WIP committed | `git status --porcelain \| wc -l` | 0 |
| | | CI green | `gh run list -L1` | success incl. test/typecheck/lint |
| | | Every cron ran | `select job, max(finished_at) from cron_runs group by 1` | 6 rows < 24 h |
| | | Liveness | `curl -s /api/health?jobs=1 \| jq .jobs` | 6 entries |
| | | Migrations applied, snapshot fresh | `pnpm db:verify-rls`; Applied table | pass; every pending row stamped; `era_templates` in `db-state.json` |
| | | Dead ERA code gone | `grep -rl "face-widgets\|recipeOfferGenerate\|useEraHousehold" src \| wc -l` | 0 |
| | | Awakening scored | `grep -c MISSED "ERA Awakening — Master Execution Plan (2026-07-06).md"` | ≥3 |
| | | Offline honesty | airplane mode, "spent $5" | refusal + form door, no "Drafting" |
| | | Money graph healed | diagnose runbook | 0 duplicates |
| | | RLS gaps closed | `pg_policies` for `guest_drinks`, `item_prerequisites` | rows present |
| **G1** | Oct 12 | Spoke first 5 mornings | `select date(finished_at) from cron_runs where job='era-briefing' and status='ok'` | 5 consecutive |
| | | Exactly-once | second manual fire | `{skipped:"dedupe"}` |
| | | Lands on `/era` | phone screenshot | route `/era` |
| | | SFR tile | `/era` Activity screenshot | SFR₇ > 0 |
| | | Signals tested | `pnpm vitest run src/lib/briefing` | green, 3 builders with provenance |
| | | Gap-closers | fixtures balance/income/event/meal-read | green |
| | | Offline write queued | airplane → reconnect | exactly one transaction |
| | | Trips cascade | `trip_side_effects where reversed_at is null` after completion | 0 |
| | | Quota gauge | sparkline after one Ask AI | moves |
| | | Native accounts | 3 console screenshots | verified |
| **G2** | Nov 9 | Treaty written | AI Assistant Overview section | ≤1 page |
| | | HubPage shrank | `wc -l src/components/hub/HubPage.tsx` | < 6,275 |
| | | Voice via runTurn | `/chat` voice "remind me tomorrow at 9" | saved 09:00 |
| | | Top View 1 request | network tab on `/era` | 1 RPC |
| | | Partner receiving | her phone at her hour | briefing present, colors correct on both |
| | | Degradation | forced token-mint failure | distinct orb state |
| | | Export exists | `GET /api/export` | JSON downloads |
| | | Security | Advisors screenshot | 0 RLS-disabled public tables |
| **G3** | Dec 7 | Policy caps | forced 4th push test | suppressed → digest |
| | | L3 card | seeded urgent signal | one card, action = draft |
| | | Anomaly | seeded transaction | exactly one card |
| | | Module signal | seeded low stock | in next briefing |
| | | Bell calm | reduced-motion screenshot | static dot |
| **G4** | Dec 31 | Store-track builds | TestFlight + Play screenshots | both phones |
| | | Native push | lockscreen screenshots at 07:15 | both |
| | | Web push unregressed | test endpoint | delivered |

---

## 7 · Metrics ("ERA vital signs", E-06/E-07)

| Metric | Definition | Source | Target |
|---|---|---|---|
| Cron liveness | jobs with `finished_at` inside their window ÷ scheduled | `cron_runs` | 100% visible |
| SFR₇ | days in trailing 7 with a delivered `era_briefing` ÷ 7 | `notifications` | ≥5/7 Oct 12; 7/7 Nov 9 |
| Briefing precision | 👍 ÷ (👍+👎), 14 d | `briefing_feedback` | ≥80% Dec 7 |
| Regret | dismissed < 5 s ÷ delivered | `briefing_feedback` | < 20% |
| Proactive hit rate | cards acted on / week | feedback | ≥5/wk Dec 31 |
| Router safety | fixtures green; ambiguous money → question | CI | 100% |
| Capture share | `transactions.source = 'era'` ÷ all, monthly | D15 column | trend up |
| Offline loss | ERA write intents failed offline with no queued op | `intent_payload.queued` | 0 |
| Quota headroom | daily calls/tokens per feature | `ai_usage_daily` | gauge exists |
| HubPage LOC | `wc -l` | git | strictly decreasing from 6,275 |

## 8 · Anti-plan

No new standalone modules before January · no open banking · no two-way calendar sync · **no wake-word work of any kind (D2)** · no LLM-composed briefings or titles before E-07 · no fourth conversation store, second toast system, third recurrence engine, second assistant brain, second aggregation engine, second offline queue key · no HubPage line without a rider that deletes more · no new plan or audit document until G1 is scored in §9 · no `/era` redesign (additive only) · no L-sized packet (split it) · no direct production DB write by any agent, ever.

## 9 · Delta ledger (append-only; gate scores go here)

- **2026-09-02** — Plan created from three verified code maps, all Master Books and a critique pass. Supersedes Awakening (G0/G1/G2 missed, to be scored in its §14 by M-00) and Top View (folded in as E-10/E-14/E-15/E-20). Owner answers: Hobby → pg_cron; wake word untouched; ~2 packets/week; partner daily → Phase 2.

---
