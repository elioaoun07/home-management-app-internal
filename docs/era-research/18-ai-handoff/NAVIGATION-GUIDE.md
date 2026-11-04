---
created: 2026-11-04
updated: 2026-11-04
type: navigation
status: draft
owner: Elio
evidence_cutoff: "commit 1c586d0 (2026-11-04)"
---

# ERA Navigation Guide

[README](README.md) · [Briefing](ERA-BRIEFING.md) · **Navigation Guide** · [Handoff Template](HANDOFF-TEMPLATE.md)

Which source to trust, which document and code to open for a given task, and how to keep one fact in one place. The routing authority for coding tasks remains `.claude/skills/start-task/SKILL.md` Step 2; this guide adds the source-authority classes, the research layer and the code entry points, and does not replace it.

## 1. Source authority

| Class | Sources | Treat as |
|---|---|---|
| **Authoritative: behaviour** | Source under `src/`, plus its tests; migrations in `migrations/` | What the app does at HEAD. Wins over every document. Says nothing about what is deployed |
| **Authoritative: schema** | `migrations/schema.sql` (tables, columns, constraints) | End state of the schema. Cannot answer RLS or function questions |
| **Authoritative: production shape** | `migrations/db-state.json` (RLS, functions) and anything the owner pastes from the live database | The only repo evidence about RLS. Dated; check its age before use |
| **Authoritative: policy** | `CLAUDE.md` (mirrors `AGENTS.md`, `CODEX.md`, `.github/copilot-instructions.md` are generated), `.claude/skills/*/SKILL.md`, `.claude/hooks/*`, `.claude/settings.json` | Rules to follow. If code violates one, report a finding; do not treat the violation as the rule |
| **Living guidance, can drift** | Feature Map (`ERA Notes/01 - Architecture/Feature Map/`), module Overview docs (`02 - Standalone Modules/`, `03 - Junction Modules/`), `ERA Notes/01 - Architecture/*.md`, Design Doctrine, `docs/ENV.md` | Where to look and why it was built so. Check against code; known disagreements are in [01-atlas §8.4](../01-atlas/ARCHITECTURE.md#84-conflicting-or-stale-sources) |
| **Authoritative: work state** | Campaign `4 - Checklist.md` (queue), `<Campaign> — Master Book.md` (state, decisions, acceptance, shipped log), `_Decisions.md`, `_Conventions.md`, `Model-Registry.md` | What is planned, done and decided. Does not prove the code or database matches ("authored, applied, accepted and observed are separate states", PM `_index`) |
| **Evidence snapshots** | `Research/Major Bug Sweep.md`, `Mutation Integrity Audit.md`, [01-atlas](../01-atlas/README.md), [08-shared-data](../08-shared-data/README.md), [19-business-rules](../19-business-rules/README.md), this folder | True at their stated commit. Re-verify before relying on a line number or count |
| **Proposals** | `10 - Project Management/Plans/*`, `Research/Options.md`, `0 - Inbox.md`, "PROPOSED DESIGN" sections of the research folders, open decisions in `_Decisions.md`, `docs/ASTRA-Ideas.MD`, `temp.md` | Not approved. Implementing one needs an owner decision and a checklist item. Accepted designs (e.g. Delivery V2, ERA Top Layer) are accepted by their own status line, not by being in `Plans/` |
| **Historical** | `10 - Project Management/_Archive/` (indexed as `baseline-frozen`), `FABLED 2/` and `FABLED 3/` generations, `docs/ASTRA-*`, `docs/Delivery-UAT-*-2026-10-25.md`, `docs/*STUDY*.md`, `ERA Notes/03 - Junction Modules/ERA/Overview.md` (Phase 0 text, 2026-05-03) | Provenance and evidence only. No PM tool scans the archive. Do not extend, copy forward or recreate it |

**When two sources disagree** (facts, not policy), trust in this order: owner-supplied current evidence, then code at HEAD and its tests, then `schema.sql` for tables and `db-state.json` for RLS (dated), then `CLAUDE.md` and skills for what *should* hold, then Feature Map, vault docs and Master Books, then research snapshots, then plans and archive. Say which you used. Do not "fix" correct code to match a stale document, and fix the document in the same change when you find drift (Doctrine §7.3).

Frontmatter `status:` is a hint only. `living`, `active` and `current` appear on documents that are demonstrably out of date (see §5), so check the dated evidence cutoff or the code.

## 2. Reading order for a coding task

1. `CLAUDE.md` (Hard Rules, Module Model, Feature Index).
2. `.claude/skills/start-task/SKILL.md`: restate the task, pick playbooks, run the domain-risk gate.
3. Feature Map `_index.md`, then the module file. This names the exact files to edit.
4. The module's vault Overview doc, including its gotchas.
5. `migrations/schema.sql` only for DB work; `db-state.json` first for visibility bugs.
6. Design Doctrine only when designing or weighing a tradeoff.
7. The campaign Master Book; then `git log` since its evidence cutoff.
8. Before editing anything shared: [CHANGE-IMPACT-GUIDE](../01-atlas/CHANGE-IMPACT-GUIDE.md).
9. At the end: `.claude/skills/finish-task/SKILL.md`.

Hooks run for you and are part of the protocol: SessionStart prints the PM freshness radar; edits to `src/components/ui/` are blocked; CLAUDE.md edits regenerate the mirrors; `schema.sql` and migrations are checked for pairing; the Stop hook checks that PM files were touched when source changed.

## 3. Task to documents to code

"Skills" are in `.claude/skills/`. "FM" is the Feature Map file under `ERA Notes/01 - Architecture/Feature Map/`. Entry points are shared or choke-point files; the FM file lists the rest. All paths were checked to exist at `1c586d0`.

| Task | Open first | Code entry points | Skills and cautions |
|---|---|---|---|
| Log, edit or delete a spend | FM `standalone/transactions.md`; vault Transactions, Accounts & Balance/Balance System | `src/app/api/transactions/`, `src/services/transaction.service.ts`, `src/lib/balance.ts` | money-rules, api-route, cache-invalidation. Balance failures are non-throwing: read [BR-02](../19-business-rules/BUSINESS-RULES.md) |
| Balances, transfers, debts, envelopes | FM `accounts-and-balance`, `transfers`, `debts`, `budget-allocation` | `src/app/api/{accounts,transfers,debts,budget-allocations}/`, `src/lib/balance*.ts` | money-rules (before/after example and a test are required) |
| Recurring payments | FM `recurring-payments`; vault Recurring Payments | `src/lib/recurring.ts`, `src/features/recurring/commitments.ts`, `src/app/api/recurring-payments/` | recurrence-safety. Confirm is manual; the FM says a cron posts (it does not) |
| Statement import | FM `statement-import` | `src/app/api/statement-import/`, `src/lib/statement-*.ts` | money-rules; imports need `timeoutMs` |
| Schedule items, occurrences, completion | FM `items-and-reminders`; vault Items & Reminders; [CRITICAL-FLOWS](../01-atlas/CRITICAL-FLOWS.md) | `src/lib/items/{createContract,completeItems}.ts`, `src/lib/schedule/expandOccurrences.ts`, `src/features/items/`, `src/app/api/items/` | recurrence-safety, timezone-handling; never add a third expansion path |
| Chores, Focus, Plan My Day, prerequisites, NFC | FM `chores`, `plan-my-day`, `prerequisites`, `nfc-tags`; `focus.md` is stale (no `/focus` route) | `src/features/chores/`, `src/features/day-plan/`, `src/lib/prerequisites/`, `src/features/nfc/` | Several prerequisite types never fire ([BR-23](../19-business-rules/BUSINESS-RULES.md)) |
| Reminders, push, alerts, cron | FM `notifications`; vault Notifications; PM Notifications & Alerts | `src/app/api/cron/item-reminders/route.ts`, `src/lib/pushSender.ts`, `src/lib/schedule/alertResolution.ts` | api-route (cron variant). Whether the scheduler runs is UNKNOWN. UTC vs wall-clock: [BR-18](../19-business-rules/BUSINESS-RULES.md) |
| "Partner can't see X", empty list | Hard Rule 27, then `migrations/db-state.json`; `ERA Notes/01 - Architecture/Database RLS Posture.md`; FM `household-sharing` | `src/app/api/household/`, `src/lib/accountAccess.ts`, pattern in `src/app/api/accounts/route.ts` | Stop before reading route code. Visibility rules and their open questions: [BR-04, Q-02](../19-business-rules/OPEN-DECISIONS.md) |
| Offline, sync, stale cache | FM `sync-and-offline`; vault Sync and Offline (partly stale, see atlas F-U1) | `src/lib/{safeFetch,connectivityManager,offlineQueue,offlineSyncEngine}.ts`, `public/sw.js` | cache-invalidation; Hard Rules 6, 7 |
| ERA: change what the assistant does | FM `ai-assistant`; vault AI Assistant Overview (not `ERA/Overview.md`, which is Phase 0) | `src/features/era/engine.ts`, `src/features/era/capabilities/`, `src/app/api/era/ask`, `src/lib/era/artifacts.ts`, `src/lib/ai/{anthropic,rateLimit}.ts` | era-wire for HUB-n reports on shipped features; add a row to `src/features/era/artifacts.contract.test.ts`; no live paid calls (Rule 29), use `tests/era-gym` replays |
| Legacy AI chat (Gemini) | FM `ai-assistant` | `src/app/api/ai-chat/`, `src/lib/ai/gemini.ts` | Separate brain: do not add a third |
| Dates, time zones, billing month | `ERA Notes/01 - Architecture/Timezone Handling.md`; [08-shared-data contract 1](../08-shared-data/CROSS-MODULE-CONTRACTS.md) | `src/lib/utils/date.ts` | timezone-handling. Four billing-period implementations exist (08 SOURCE-OF-TRUTH-MATRIX) |
| Kitchen: recipes, meal plan, inventory, catalogue, shopping list | FM `recipes`, `meal-planning`, `inventory`, `catalogue`, `shopping-list` | `src/features/{recipes,meal-planning,inventory,catalogue}/`, `src/lib/mealPlanCoverage.ts` | Shopping list and meal plan are Junctions: read connected standalones |
| Healthcare and Fitness | FM `healthcare`, `fitness`; Healthcare Master Book | `src/features/{healthcare,fitness}/`, `src/lib/{health,fitness}/` | Medication times follow the stored home zone ([Q-15](../19-business-rules/OPEN-DECISIONS.md)) |
| Trips | FM `trips`; vault Trips | `src/features/trips/`, `src/lib/{tripSpend,tripAccess}.ts` | The cascade is off; see CHANGE-IMPACT-GUIDE "Re-enable the trip cascade" |
| Database change | db-migration skill; `migrations/README.md` (partly stale) | `migrations/YYYY-MM-DD_*.sql`, then `migrations/schema.sql` | The owner applies SQL. Never report it as applied |
| Fix bad production data | data-repair skill | A runbook file, not a script run | Hard Rule 26 |
| New page, route or module | new-module skill; vault `Templates/Feature Doc.md`; `04 - UI & Design/Page & Feature Atlas/_Index.md` | `src/app/`, `src/features/` | Update Feature Map, Feature Index and Atlas in the same commit (Rule 23) |
| UI, theme, components | ui-guardrails skill; `Color Identity.md` | `src/components/` (never `ui/`), `src/app/globals.css` | Rules 1-5, 10, 14-16, 19, 22, 28 |
| PM, Delivery, Command Center | `_index.md` and the campaign Master Book; FM `cross-cutting/pm-command-center.md` | `scripts/pm/`, `scripts/delivery-v2/`, `src/app/pm`, `src/middleware.ts` (gates `/pm`) | Triage never implements (triage-inbox) |
| Understand an unfamiliar area | [CAPABILITY-MAP](../01-atlas/CAPABILITY-MAP.md), then FM | n/a | CLAUDE.md lists a `graphify` playbook that does not exist; use the atlas and FM |
| Research or documentation only | This folder family; vault docs for the module | n/a | Update the existing doc rather than create one (Doctrine §6, Documentation Rules) |

## 4. The research layer

| Folder | Answers | Does not answer |
|---|---|---|
| [01-atlas](../01-atlas/README.md) | What exists, how journeys run, what a change touches, which documents are stale | What is deployed |
| [08-shared-data](../08-shared-data/README.md) | Entities, identifiers, sources of truth, six proposed shared contracts | Anything approved (all PROPOSED) |
| [19-business-rules](../19-business-rules/README.md) | 32 current rules with tests, 12 scenarios, 17 owner questions | Which behaviour is correct (owner's call) |
| 18-ai-handoff (this) | How to enter and leave a session | Content already held above |

## 5. Known traps in the sources this guide routes through

Not a full list; the full list is [01-atlas §8.4](../01-atlas/ARCHITECTURE.md#84-conflicting-or-stale-sources) and is not copied here (see §6).

- Feature Map `focus.md` and the `CLAUDE.md` Feature Index point at `src/app/focus/` and `src/components/focus/`, which do not exist.
- `CLAUDE.md` Engineer Playbooks lists `graphify`; no skill folder exists, though a prompt hook may still suggest `/graphify`.
- `ERA Notes/03 - Junction Modules/ERA/Overview.md` describes Phase 0 and says `none` for DB tables; `era_*` tables and Claude Ask AI exist.
- Feature Map `transactions.md` line 70 says the `safeFetch` default is 3 s; code and the corrected Doctrine say 8 s.
- `docs/` holds many historical briefs and UAT scripts. Filename recency is not authority.

## 6. One fact, one home

The failure this prevents: the same value written in several places, edited in one. A real instance is above: Doctrine §4 was corrected to 8 s on 2026-10-17 and Feature Map `transactions.md` still says 3 s.

| Kind of fact | Its single home | Everyone else |
|---|---|---|
| What the code does | The code | Cite `path:symbol` and the commit; do not paste logic |
| Table and column shape | `schema.sql` | Link; never list columns in prose |
| RLS and functions | `db-state.json` | Link; state its date |
| A rule for agents | `CLAUDE.md` | Cite "Hard Rule N"; never paraphrase the text into another file |
| A playbook step | The SKILL.md | Link to the skill |
| Which files implement an intent | Feature Map | Link; do not list file sets in vault docs or handoffs |
| Module behaviour and gotchas | The module Overview | Link |
| Task status and priority | Campaign checklist | Cite the task ID; never a second checkbox |
| Acceptance and lasting decisions | Master Book | Cite the section |
| An unresolved owner choice | `_Decisions.md` (cross-campaign) or the Master Book | Research files may *ask*; once answered, the answer moves to the home and the question is struck |
| Counts, versions, ages | The command that measures them | A dated "refresh" table that names the command (Briefing §7) |

Rules of thumb:

1. **Link, do not copy.** If you must quote, quote one line, name the source and the commit, and add it to the copy register below.
2. **Put a number next to its command and date,** or leave it out.
3. **A discovered conflict is a finding, filed once** where the owning document keeps drift (for sources, atlas §8.4 or the module Overview's gotchas), not patched in five files.
4. **Never hand-edit generated files:** `AGENTS.md`, `CODEX.md`, `.github/copilot-instructions.md`, `public/atlas/atlas.json`, `_dashboard.html`.
5. **Do not create a document for something an existing one should hold** (Doctrine §6; PM Conventions §3: each campaign has exactly a book and a checklist).
6. **Correct with a date.** When you fix a stale line, append the correction and your date rather than silently rewriting history (Doctrine §7.2).

**Copy register for this folder** (everything duplicated from another source, so a reviewer can re-check it):

| Copied item | Where here | Home | Re-check |
|---|---|---|---|
| Module groupings and types | Briefing §2 | `CLAUDE.md` Feature Index; PM `_index.md` | On any module change |
| Counts and ages | Briefing §7 | Measured by the listed commands | Each task |
| First four traps | §5 | 01-atlas §8.4 | When the atlas is refreshed; delete any that are fixed |
