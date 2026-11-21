---
created: 2026-11-16
updated: 2026-11-16
type: plan
status: active
owner: Elio
evidence_cutoff: "2026-11-16 working tree at HEAD a9ef5bc1. Source reading and repository searches only. No model call, production query, served build or device witness. Table shapes come from migrations/schema.sql. migrations/db-state.json is 104 days old and was not used as evidence."
---

# ERA Top Layer — Rethink

**Proposed, not yet accepted.** Until you accept it, [ERA Top Layer](<ERA Top Layer.md>) (2026-09-27) still governs. Accepting means answering the seven [owner decisions](#7-owner-decisions) and running stage S0 of the [Runbook](<ERA Top Layer — Runbook.md>), which archives the old plan.

Two files, two jobs:

| File | Job | Read it |
|---|---|---|
| This one | The study: what is wrong, what ERA should become, what stops, what you must decide | Once |
| [Runbook](<ERA Top Layer — Runbook.md>) | Eight stages, each a self-contained execution sheet with its own exit gate | Every time you say "run stage S‹n›" |

## 1. Verdict

ERA has a good engine and no product around it. The engine (one turn pipeline, effect policy, confirm cards, Artifacts, Undo, lexicon, Gym) is sound and stays. What makes it feel pre-release:

1. **It waits.** ERA opens to a greeting and an empty box. Nothing proactive has shipped.
2. **It is a place, not a layer.** You go to `/era`; it is not on the pages where you work.
3. **It learns only through a developer.** A missed sentence becomes a ticket that waits weeks.
4. **It has never been proven live.** Most of what was built since late September has not run on your phone against the real database.
5. **Nobody is counting.** The plan's own success metric was never instrumented.

More understanding work will not fix any of these. The deterministic router already scores 89–91% on the Gym, and adding the model moved it 2.2 points ([Gym report](<../../../tests/era-gym/REPORT.md>)). The next 10x is in the other three words of ERA's identity: **personal, proactive, aware.**

## 2. What is worth keeping

| Asset | Where | Why it stays |
|---|---|---|
| One sentence-to-reply path for typed, voice and chips | `src/features/era/useEraTurn.ts` | No second brain to keep in sync |
| Effect policy and confirm cards showing effective values | `engine.ts`, `capabilities/effectiveAction.ts` | Money and schedule never move on a model's word |
| Artifacts with Undo for every write | `src/lib/era/artifacts.ts`, `recordArtifacts.ts` | Trust and an audit trail already exist |
| Capability registry with derived discovery | `capabilities/registry.ts`, `discovery.ts` | The seam for reach without new grammar |
| Lexicon, focus memory, composer memory | `lexicon.ts`, `focusMemory.ts`, `src/lib/era/captureMemory.ts` | The raw material for "personal" |
| Speech-act gate, shared amount extractor | `intents/speechAct.ts`, `src/lib/nlp/amount.ts` | Closed the dangerous parsing classes |
| ERA Gym, 205 cases | `tests/era-gym/` | Regression floor for every stage below |
| Notification actions, snooze and dismiss | `notifications` table, `public/sw.js`, `/api/notifications/*` | The proactive surface is half built and unused by ERA |
| Report from chat, `/era-wire` lane | `useEraIssues.ts`, `.claude/skills/era-wire/` | A cheap path from a miss to a fix |

## 3. The challenge

Each finding was checked in source on 2026-11-16.

### Setup and configuration

| # | Finding | Evidence |
|---|---|---|
| 1 | **Built is not live.** Lexicon ("Always", aliases), Artifacts for new entity types and the Activity Log each wait on a migration you have not run; 15 Hub items await your acceptance; the execution journal is flagged off. | PM index › Needs you: HUB-83 (since 09-27), HUB-91 (since 10-04), HUB-62; `NEXT_PUBLIC_ERA_DURABLE_EXECUTION` |
| 2 | **The model path has no current passing evidence.** The replay recordings went stale when the prompt changed; they skip, they do not pass. | HUB-111 record in the Master Book; Hard Rule 29 allows only an owner-started refresh |
| 3 | **RLS truth is 104 days old.** | `migrations/db-state.json` dated 2026-08-04 |
| 4 | **Six crons, no proof any of them runs.** | HUB-38 open; no `vercel.json`; scheduler lives outside the repo |
| 5 | **ERA is a separately installed app scoped to `/era`.** Handing off to `/expense?era=…` leaves that scope. There are 17 install manifests on one origin. What the handoff looks like from the installed ERA app has never been witnessed. | `public/manifests/era.webmanifest`; `public/manifests/` |

### UI and UX

| # | Finding | Evidence |
|---|---|---|
| 6 | **Signed-in users land on `/dashboard`.** The only in-app link into ERA is one icon in the Activity Log. | `src/app/page.tsx`; repo search for `"/era"` |
| 7 | **On a phone the hub knows nothing.** The four stat cards are desktop-only. A phone shows the mark, "Good morning", and the line "4 modules on deck. Speak to any of them." | `HubScatterWidgets.tsx` (`hidden md:flex`); `EraShell.tsx:352`; HUB-50 open |
| 8 | **The user is asked to pick a brain.** A ✨ button beside Send sends the same text to the model and skips ERA's own understanding. | `CommandBar.tsx` `askAIClick`; HUB-99 |
| 9 | **Faces are a mode.** The active face's router gets first try, so one sentence can route differently depending on which pill is lit. | `intents/index.ts` step 2 |
| 10 | **Offline, ERA forgets.** A capture with no signal answers "Tell me again once you're back on." The forms queue; the top layer does not. | `intents/formatters/budget.ts:305`; HUB-46 open |
| 11 | **Other pages still show a second assistant.** The floating chat button calls a different endpoint with a different prompt. | `src/components/ai/AIChatAssistant.tsx`, `/api/ai-chat` |
| 12 | **No push ever opens ERA.** Every notification links to `/expense`, `/reminders` or `/chat`. | `action_url` values in `src/app/api/cron/*` |

### Understanding and reach

| # | Finding | Evidence |
|---|---|---|
| 13 | **Each new phrase costs a code change.** 44 intent kinds routed by four regex routers; ERA is about 28,000 lines of non-test code. Three reports ("Add Mop Chores today", "Add Racha as a Contact", "Location for Women's night is Kobeize") have waited 29 to 44 days. | `src/features/era/types.ts`; HUB-87, HUB-93, HUB-117 |
| 14 | **The teach loop exists but is dark.** Miss → model proposes → confirm → remembered was built twice (templates, then lexicon). The lexicon's table is not applied; safe referents and verified-outcome learning are open. | HUB-83, HUB-47, HUB-64 |
| 15 | **Reach is narrow.** 15 of 39 modules have any inline action, 3 have a prefilled handoff, 24 are a door only. The model sees 18 capabilities. | [Reach Matrix](<../../03 - Junction Modules/AI Assistant/ERA Reach Matrix.md>); [Overview](<../../03 - Junction Modules/AI Assistant/Overview.md>) final review |
| 16 | **Money answers can disagree with the app.** The model's budget context uses a calendar month and treats a failed read as empty; the app uses your custom month. | Overview final review; HUB-45 |

### Proactive and aware

| # | Finding | Evidence |
|---|---|---|
| 17 | **Zero proactive rows shipped.** The briefing chain HUB-39 → HUB-43 has not started. No signal seam exists in code. | Checklist › Proactive briefing; no `getBriefingSignals` anywhere in `src/` |
| 18 | **The last plan cut proactive first.** Its sacrifice order drops the proactive track before anything else, so reactive work took every session. | [ERA Top Layer](<ERA Top Layer.md>) §8 |

### Planning

| # | Finding | Evidence |
|---|---|---|
| 19 | **Five plan generations in four months, none finished.** Top View study (07-17), Master Plan (09-02), 09-10, 09-27, and now this. Gate G0 passed its date silently. | `_Archive/Plans/` |
| 20 | **The stated metric was never built.** "Share of captures that move from forms to ERA (`capture_source`)" appears in the plan and nowhere in the schema or source. | repo search for `capture_source` |
| 21 | **Depth before the basics.** Six-step agent plans, a durable run journal and capability discovery shipped in three days (10-10 to 10-12), while a single offline capture is still lost. | HUB-103 to HUB-106 versus HUB-46 |
| 22 | **ERA has had no work for five weeks.** The last ERA commit is 2026-10-12. Delivery and PM Tooling account for 214 of 447 shipped rows (48%). | `git log -- src/features/era`; PM index campaign table |
| 23 | **Your acceptance is the bottleneck, and it is scattered.** 5 "Needs you" rows and 15 pending acceptances in Hub alone, each a separate visit. | PM index |

Finding 22 is the Design Doctrine's own warning (§6: the machine knows more than it does). This document is useful only if it is the last plan. The Runbook is built to make that true: a stage cannot start until the previous one is witnessed on your phone.

## 4. The rethink

### Identity, made measurable

| ERA is | Which means | Counted as |
|---|---|---|
| **Proactive** | It speaks first, with something you can finish in one tap | Cards acted on per person per day |
| **Aware** | It opens with facts, and answers only from the app's own reads | Facts on the phone hub at open; answers carrying their source |
| **Personal** | It learns your wording and your habits from you, not from a developer | Repeat misses per week; phrases and habits learned |
| **AI / deterministic** | Rules do the facts, the money, the dates and the acting. The model only turns unfamiliar language into a proposal you confirm. A confirmed proposal becomes a rule. | Native p50 latency; wrong money effects; model share of turns; cost per person per month |

### Three moves

**Move 1 — ERA speaks first ("Now").** The idle hub stops being a greeting and becomes a short stack of ready cards. Each card is a finished proposal: one line, one or two buttons. Tapping the button is the confirmation. No typing, no model.

```
        ◉  ERA

Generator · $60 · due today          [Paid]  [Later]
Dentist · 4:00 pm                    [Open]
Coffee · $4 · Wallet                 [Log]
                                              +2
┌──────────────────────────────────────────────┐
│ Message ERA                               🎙 │
└──────────────────────────────────────────────┘
```

**Move 2 — ERA learns from you.** One Send button. Familiar sentences resolve instantly on the device. An unfamiliar one goes to the model, comes back as a confirm card, and after it succeeds ERA offers **Always**. Say yes once and that phrasing is native from then on: instant, free, and working offline. Report remains for what ERA truly cannot do yet.

**Move 3 — ERA is everywhere.** A small ERA handle on every page opens the same composer and the top card, and it knows what "it" is: the reminder, trip or recipe you have open. The second assistant retires. Pushes land on their card.

### The card catalogue

All deterministic. Every card has a stable key (kind + entity + local date) so it appears once.

| Card | Source | Primary action | Stage |
|---|---|---|---|
| Payment due | `recurring_payments` | Paid (confirm card effect: `recurring.cover`) | S2 |
| Reminder due or overdue | `items` | Done · Tomorrow | S2 |
| Next event | `items` | Open | S2 |
| Drafts waiting | drafts | Review | S2 |
| Existing alerts | `notifications` rows | Their own action | S2 |
| Morning brief | signals above | Open | S4 |
| Close the day | drafts, undone reminders, tomorrow's first event | Done · Tomorrow · Drop | S4 |
| Habit spend | your own history (`captureMemory.ts`) | Log | S6 |
| Usual shopping | household list history | Add | S6 |
| Partner activity | Activity Log | Open | S8 |
| Leave-by, store list, dinner gap | [Learns Your World](<../../03 - Junction Modules/AI Assistant/ERA Learns Your World — Proposal.md>) | per card | S8 |

Rules: three cards visible at most; no red on a card (Hard Rule 3); no explanatory text (Hard Rule 28); a source that failed to load says so and never reads as "nothing due"; partner-owned rows follow the same household filter as their page.

### Rituals

Time-based only. No geofencing, no wake word.

- **Morning brief.** One push at your hour: three lines, built from signals. Opens Now.
- **Close the day.** One evening card stack that clears in under a minute. This is where data quality compounds: ERA can only be aware of what was recorded.
- **Weekly line.** Sunday: your numbers from the scoreboard and what ERA learned.

### Why this is the innovative part

Most of a household's life repeats: the same coffee, the same bills, the same list, the same chores. Today the fastest path for a repeated spend is a typed sentence. With habit cards it is one tap on a card ERA prepared from your own history. Capture cost for the habitual half drops from a sentence to a tap, and ERA earns the data it needs to be aware. Nothing here needs a model, a new store, or a new engine.

## 5. What stops

Stopping is half of this plan.

| Stop | Until |
|---|---|
| New regex grammar for long-tail phrasing | Never resumes. Only the top-frequency captures keep a fast path; everything else goes through Always. |
| Voice conversation mode, wake word, TTS polish | The scoreboard shows voice turns worth investing in. Hold-to-talk dictation into the composer stays. |
| New multi-step agent workflows and the run journal | S3 is witnessed and S5 has current model evidence. The flag stays off. |
| New widgets or tabs in the four face dashboards | S7 decides whether they stay. |
| Planning and auditing ERA again | This plan is retired or replaced by you. |
| More than one meta session (PM, Delivery tooling) per two product sessions | S4 is witnessed. The conventions already say this; it has not been followed. |

## 6. What 10x means here

Baselines are unknown today. S1 records them; the targets hold from the stage shown.

| Measure | Today | Target | From |
|---|---|---|---|
| Facts on the phone hub at open | 0 | 3 actionable cards | S2 |
| Cards acted on per person per day | 0 | 2 or more | S4 |
| Taps to record a habitual spend | a typed sentence | 1 | S6 |
| Time for ERA to learn a new phrase | 29–44 days (three open reports) | one confirm | S5 |
| Same sentence missed twice in a week | uncounted | 0 | S5 |
| Captures lost offline | every one | 0 | S3 |
| Share of spend, reminder and shopping captures made through ERA | uncounted | baseline + 30 points | S6 |
| Owner acceptance | 20 scattered rows | one sitting per stage | S1 |
| Wrong money effects | 0 in Gym | 0 live | always |
| Model cost per person per month | cap $1 | under $1 | always |

## 7. Owner decisions

Each has a recommendation. Answer them once; S0 records them.

| # | Decision | Recommendation |
|---|---|---|
| A | Accept this as the governing Top Layer plan and archive the 09-27 version | Yes |
| B | Lift the ERA layout freeze for exactly two changes: the hub tagline line becomes the Now stack; the ✨ button is removed. Everything else stays additive. | Yes. The tagline is explanatory text, and ✨ makes you choose a brain. |
| C | Brief hours (closes DEC-01). Quiet hours are 21:00–08:00. | Morning 08:05, evening 20:30, each person sets their own. |
| D | Signed-in landing becomes `/era` instead of `/dashboard` | Yes, but only after S2 is witnessed, when the hub is worth landing on. |
| E | A habit card tap posts the spend when amount, account, category and subcategory all come from your own history and the account is yours; otherwise it makes a draft | Yes. It matches the bulk-convert rule from 2026-06-16, and Undo plus an Artifact follow every post. |
| F | Park voice conversation and wake word | Yes. |
| G | Accept the stop list in §5 | Yes. |

## 8. Disposition of existing work

Nothing is filed or merged by this document. S0 applies this table.

| Existing | Becomes |
|---|---|
| HUB-83, HUB-91, HUB-62, HUB-38 (evidence part) and the 15 pending Hub acceptances | S1 |
| HUB-87, HUB-93, HUB-117, HUB-95, HUB-92, HUB-96 | Lane R (one report per session) |
| HUB-41, HUB-50, HUB-54 | S2 |
| HUB-46, with HUB-119 and HUB-120 as prerequisites that keep their own rows | S3 |
| HUB-39, HUB-42, HUB-43, HUB-49, HUB-51, NOTIF-19 (owner of delivery policy) | S4 |
| HUB-99, HUB-47, HUB-64, HUB-105 (model evidence), HUB-44 (caps) | S5 |
| HUB-48, HUB-40, HUB-82 | S7 |
| HUB-79, HUB-81, HUB-45, HUB-69, HUB-70, HUB-71, HUB-22, HUB-56, HUB-102 | S8, admitted one at a time by evidence |
| HUB-55, HUB-23 | Parked until S4 has four weeks of card data |
| HUB-2, HUB-104 rollout | Parked with decisions F and G |
| HUB-107 | Narrowed: ERA's model path stays on one provider; other AI routes move only when touched |
| D1–D18, U-1–U-7, DEC-24 | Still binding. The ones every stage needs are restated in the Runbook; the rest stay in the Hub & ERA Master Book. |
| D15 capture-source measurement | Delivered as the S1 scoreboard, counted from `era_actions` instead of a new column |

## 9. Not in the first run

Good ideas, each with the gate that admits it.

| Idea | Gate |
|---|---|
| Share to ERA (a receipt photo or forwarded message becomes a draft) | S5 witnessed; needs a model pass on images |
| Home-screen shortcuts (long-press the icon: Expense, Reminder, Shopping) | Rides S7 |
| Ask-partner cards ("Did you pay the generator?" → Yes · log it) | S4 witnessed on both phones |
| Lock-screen actions on iPhone | Native app (NAT); web push on iOS ignores action buttons |
| Model-written weekly reflection | S4 scoreboard shows the weekly line is read |

## 10. Retirement

Archive this file and the Runbook when S7 is witnessed and S8 has run for a month, or when you replace them. Before archiving, move any open stage to its HUB row and keep the decisions in the Hub & ERA Master Book. Progress is written in the Runbook's ledger and the checklist, never here.
