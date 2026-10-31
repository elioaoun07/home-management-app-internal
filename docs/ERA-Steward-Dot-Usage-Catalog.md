# ERA Steward — Dot usage catalog

**Evidence cutoff:** 2026-10-28. Dot capabilities come from OpenAI's Dots docs (read 2026-10-28). PM facts come from this repo and the Drive status published 2026-10-27 21:55 UTC.

**Goal:** Dot works as the project manager and scrum master of PM Command Center, and you work as the CEO. Dot prioritizes, monitors, chases and reports. You set direction, keep taste and preferences, and own the irreversible calls.

Related: [Runbook](ERA-Steward-Runbook.md) · [Setup summary](ERA-Steward-Setup-Summary.md). Because this file is named `ERA-Steward-*`, the Drive mirror publishes it, so Dot can read its own job description at `01 - PM Documentation/Docs/`.

---

## 1. Operating model

| Responsibility | You (CEO) | Dot (PM) | Command Center (team) |
| --- | --- | --- | --- |
| Direction: which campaigns matter this month | Decide | Propose from pains and blockers | — |
| Backlog order inside a campaign | Approve (one tap after T3-01) | Propose weekly | — |
| Definition of Ready | — | Check every candidate item | Readiness gates enforce |
| Start a delivery | Yours today | Within your daily mandate (T3-02) | Runs it |
| Plan approval | Yours | Recommends; technical-only plans later (T4) | Proposes the plan |
| Agent questions | Preference questions | Drafts answers; technical ones later (T4) | Asks |
| Monitoring, chasing, reporting | Read the brief | Owns it | Pushes events to your phone |
| Apply | Yours, always | Prepares the Apply brief | Executes |
| UAT sign-off ("Shipped") | Yours, always | Prepares the test session | Records |
| Retro and process fixes | Accept or reject | Proposes | Agents implement |
| Budget | Set caps | Watches spend | Enforces |

## 2. What Dot works with today

| Dot sees (Drive mirror) | Dot does not see yet |
| --- | --- |
| `02 - Delivery Status/status.json` + `status.md`. They are republished when anything changes, and at least every 5 minutes. They cover runs, phase, progress, blockers, owner actions, Start requests, UAT counts and campaign rollups | Plan content, question text, result details (T2-02) |
| `02 - Delivery Status/UAT/<handover>.md` with test steps | Run events between two checks (T2-03) |
| Every campaign's Master Book and `4 - Checklist.md`, plus `_index`, `_Conventions`, `_Decisions`, `0 - Inbox`, `Plans/` and `Research/` | Token use and budget (T2-04) |
| `docs/Delivery-*`, `docs/ERA-Steward-*`, `docs/R44-*` | Coordination waits, settings mismatch, authorization window (T2-05, T2-06) |
| | Design Doctrine, Model Registry, `CLAUDE.md`, `_Planning.json`, git activity (T2-07, T2-10, T2-11) |
| | Closed runs older than the 20 most recent (T2-09) |

Dot's built-in tools: self-scheduled wake-ups, saved schedules, private notes, web research, a cloud browser, parallel background agents, any plugins you connect, messaging, and voice calls that you start.

Dot writes only to `03 - Steward Proposals/`. Nothing there is read back into PM until T3-01.

## 3. Effort tiers

| Tier | Meaning | Your effort |
| --- | --- | --- |
| **T0 — Instant** | Works today with the mirror and Dot's built-in tools. Paste the ask. | Minutes |
| **T1 — Small approach change** | No code. You change what you give Dot or how you work. | 15–60 min |
| **T2 — Small code change** | One agent session, mostly in `scripts/pm/drive-publish.mjs` and its test. Takes effect after you restart the bridge. | One session |
| **T3 — Medium build** | A new channel or UI piece: 2–4 sessions plus a design review. | Days |
| **T4 — Big refactor** | Changes who may do what in PM. A campaign of its own. | Weeks |
| **X — Possible, but don't** | Works technically, but breaks a hard rule or your control. | — |

---

## 4. T0 — Instant

### Start here

**T0-01 Kickoff.** One message sets Dot's role, cadence, journal and limits.
> "You're ERA Steward, the project manager of my PM Command Center. I'm the CEO. Read `01 - PM Documentation/Docs/ERA-Steward-Dot-Usage-Catalog.md` and work the T0 tier. Set up these schedules in Asia/Beirut and confirm them: a weekday morning brief at 08:30, a Friday review at 17:00 and a retro on the first Monday of each month. Interrupt me only under the interrupt policy in §11; everything else goes in the next brief. Never start, approve, apply, retry or change anything. Recommendations go to `03 - Steward Proposals/`. Before any Codex or Work task, tell me the model, effort and expected usage, then wait for my yes."

**T0-02 Steward journal.** After every check, Dot appends a dated entry to `03 - Steward Proposals/Steward Journal.md`: what it read (`generatedAt`), what changed, what it decided and what it told you. This is your readable audit trail, since OpenAI documents no way to view or edit Dot's own notes. It also gives Dot the history the mirror doesn't keep, such as trends and how long things have waited.
> "After each check, append one dated entry to Steward Journal.md: snapshot time, changes, decisions, messages sent."

### Monitor

**T0-03 Supervise one delivery to the end.** Dot checks about every 10 minutes until the run's phase starts with `CLOSED/`.
> "Supervise run `<run_id>` from status.json about every 10 min until it's CLOSED or I say stop. Tell me only what the interrupt policy says."

**T0-04 Mirror watchdog.** If `generatedAt` is older than 15 minutes, the PC is asleep, the bridge has stopped or Drive isn't syncing. PM's own phone pushes stop with the bridge too, so this is the one alarm that still fires.
> "If generatedAt is more than 15 min old while a run is active, tell me immediately."

**T0-05 Refused Starts.** Dot watches `requests[]` for `blocked` and translates the code using the runbook. *Today:* KIT-4 was refused twice on 2026-10-27 (19:42 and 19:44 UTC) with `delivery-not-ready`.
> "If a Start request is blocked, tell me within one check: the code, what it means per the runbook and the one action that fixes it."

**T0-06 Owner-action aging.** Dot tracks how long each real owner action has waited and escalates past a threshold. It must filter the noise: today's list includes results of cancelled runs and items already applied, which Dot flagged itself on 2026-10-25. T2-01 fixes that at the source.
> "List every owner action that's really mine, with its age. Skip cancelled runs and anything already applied."

**T0-07 Candidate rot.** Verified candidates that never get applied lose value as the code moves on. *Today:* BUD-83 (`r-83dddb67fea9`) is verified and not applied. KIT-11 has two candidates: one is applied and `r-54d5cf10d995` still offers Apply.
> "For every verified candidate not applied after 7 days, recommend Apply, re-run or discard, with the reason."

**T0-08 Apply problems.** Dot explains any application in `conflict`, `checks-failed` or `interrupted` state and recommends a next step. *Today:* DLV-107 has a conflict (`app-29460c358b3f`).
> "Explain the DLV-107 Apply conflict from the UAT and books, and tell me whether it needs anything from me."

**T0-09 Campaign trends.** Dot compares blockers and pain-blockers per campaign with last week's journal entry. *Today:* Hub & ERA has 9 blockers, Healthcare 6 and Native App 5.
> "Every Friday, compare campaign blockers with last week's journal and name the campaign getting worse."

### Prioritize

**T0-10 Next-delivery brief.** A ranked top 3–5 with reasons, using the priority rubric in §11. Dot already wrote one on 2026-10-25 (`Next Delivery Brief.md`).
> "Rank the next 5 deliveries across all campaigns with the §11 rubric. One line of reasoning each."

**T0-11 Weekly backlog refinement.** This is the weekly review `_Conventions.md` §6 asks of you: Now lanes, new Inbox captures, held decisions and old small tasks. For each campaign Dot proposes what to promote, demote, park or split, with evidence. It keeps Now at 3 or fewer per campaign and never promotes a blocked dependent just because it's severe.
> "Do the §6 weekly review for every campaign and write it to `03 - Steward Proposals/Refinement <date>.md`."

**T0-12 Definition-of-Ready check.** Dot checks every candidate item against the §11 list and reports either "ready" or exactly what's missing.
> "Check the top 10 Now/Next items against Definition of Ready and list what each one is missing."

**T0-13 Dependency unlocks.** When a prerequisite lands in a Shipped Log, Dot lists what became eligible. Example: DLV-137 is HELD on DLV-133.
> "When an item ships, tell me which HELD or dependent items it frees."

**T0-14 Review before re-run.** Dot prefers reviewing an existing verified candidate over paying for a new run. This was Dot's own 2026-10-25 recommendation; make it a standing rule.

**T0-15 Park or kill list.** Dot lists Later items with no movement and no evidence, and proposes parking or deleting them. You decide.
> "List Later items untouched for 60+ days and give a keep, park or delete call for each."

**T0-16 Overlap finder.** Dot finds duplicate or conflicting items across campaigns, and items whose `**Touches:**` collide with an active run.
> "Find items in different campaigns that describe the same change."

**T0-17 One-page roadmap.** Dot keeps a page of Now and Next per campaign, plus what each item waits on, refreshed weekly.
> "Keep `03 - Steward Proposals/Roadmap.md` current: Now and Next per campaign, plus what each is waiting on."

### Unblock

**T0-18 Decision packet.** Dot collects all your pending decisions into one message twice a day, using the template in §11. *Limit today:* plan text and question text aren't in the mirror (T2-02).
> "At 09:00 and 18:00 send me one decision packet with every decision waiting on me."

**T0-19 Owner-debt list.** Dot lists everything only you can do, ordered by how much it unblocks: migrations written but not run, fresh RLS exports (e.g., R43), bridge restarts after server updates, readiness renewals and UAT sign-offs.
> "List everything blocked on me personally, ordered by what each one unblocks."

**T0-20 Blocker explainer.** Dot explains any blocker code in plain words, with the exact fix, from the mirrored runbook and UAT docs.

**T0-21 UAT coordinator.** From the `uat` section and the `UAT/<id>.md` files, Dot tells you what's ready to test, in what order, how long it takes and the exact steps. Afterwards it checks the sign-off landed. *Today:* 1 handover is ready and 63 are drafts, so Dot should also propose which drafts to drop.
> "Plan a 15-minute phone test session from the ready UAT handovers, with steps in order."

**T0-22 Phone session prep.** Before your next phone sitting, Dot writes a short list of what to do: Apply X, test Y, answer Z, renew readiness.

### Report

**T0-23 Morning stand-up.** On weekdays, at most 10 lines: shipped since yesterday, in flight, blocked, and what needs you today.

**T0-24 Voice stand-up.** Call your Dot from your phone and ask "what needs me today?" You have to start the call; calls started by Dot aren't released yet.

**T0-25 Friday review.** What shipped (from the Shipped Logs), UAT sign-offs, runs verified or cancelled, how long work waited on you, risks, and next week's proposal.

**T0-26 Throughput and forecast.** Dot computes items per week per campaign from Shipped Log dates and forecasts, for example, "Kitchen's Now lane clears around <date>", with a confidence range.

**T0-27 Monthly campaign health.** Dot compares each Master Book's maturity read with last month's and names which campaign is starving and which is over-served.

**T0-28 Delivery retro.** Monthly, from the Delivery session logs, Dot finds recurring failure causes (readiness, check parsing, Docker) and proposes process fixes written as ready-to-file Inbox captures.

**T0-29 Partner update.** Dot writes "what's new in the app" for your household in plain words, from the Shipped Logs.

### Hygiene

**T0-30 Records drift.** Dot finds checklist or book wording that contradicts the delivery status and lists the PM records to correct (Hard Rule #25). Example: Dot found KIT-11 marked "not applied yet" while the status showed it applied.

**T0-31 Book freshness.** Dot flags Master Books whose evidence cutoff lags behind recently shipped work.

**T0-32 Grammar judgment.** Dot flags items missing `_(severity - effort)_`, Now lanes over 3, L items not split, and blocked dependents that were promoted. These are the judgment calls `pm:lint` doesn't make.

**T0-33 Decision recorder.** Decisions you make in chat with Dot go to `03 - Steward Proposals/Decisions to record.md`. The next agent session folds them into `_Decisions.md` or the book's Vision & Decisions.

**T0-34 Inbox triage proposals.** For each new `0 - Inbox.md` capture, Dot proposes a campaign, ID-ready wording and severity/effort. It keeps your original wording and implements nothing (`_Conventions.md` §7).

### Advise

**T0-35 Preference interview.** Dot asks 5 questions at a time about approach, taste and risk, and writes your answers verbatim to `03 - Steward Proposals/Owner Preferences — answers.md`. That file feeds T1-01.
> "Interview me: 5 questions about how I like features designed. Record my answers word for word."

**T0-36 Research for decisions.** Web research on an open option in `Research/Options.md` or a plan, with sources and a recommendation. Read-only.

**T0-37 Plan critique.** A second opinion on documents in `Plans/`: risks, missing acceptance criteria, sequencing.

**T0-38 Acceptance-criteria drafts.** For items that fail Definition of Ready, Dot drafts criteria into proposals and an agent session folds them in. Never marked owner-reviewed (`_Conventions.md` §9).

**T0-39 Cost sense.** From token figures recorded in session logs (e.g., KIT-11 run A used 80,028 tokens), Dot spots which kinds of items are expensive. Full accounting needs T2-04.

---

## 5. T1 — Small approach change (no code)

**T1-01 Owner Preferences doc.** Write `docs/ERA-Steward-Owner-Preferences.md`. Any `docs/ERA-Steward-*.md` file is mirrored automatically, so Dot reads it with no code. Seed it from Hard Rules #2, #3, #14 and #28, from "no unrequested redesign", "challenge my proposals" and "multi-row writes optimistic + bulk", and from your answers in T0-35. Give each preference an ID (P-01…) so Dot can cite it.

**T1-02 Steward Charter.** Write `docs/ERA-Steward-Charter.md`: mandate, decision rights (§1), interrupt policy, quiet hours, cadence and budget. It's Dot's job description, versioned in git.

**T1-03 Schedules.** Create the cadence as explicit Dot schedules with a time zone (Asia/Beirut) and an end date, and ask Dot to confirm them, as OpenAI recommends. You can review them under **Scheduled**.

**T1-04 Daily mandate ritual.** Press **Check readiness** each morning. It renews at least 24 hours of authority (DLV-142), so Starts don't fail mid-day. Dot reminds you at a fixed time, because it can't see the expiry until T2-06.

**T1-05 Agreement ledger.** Every Dot recommendation gets a verdict: agree, disagree or harmful. Dot can infer most of them from what you did next. The ledger lives in proposals and is the evidence for promotions (§12).

**T1-06 Interrupt routing.** Send decisions to one channel and routine updates to another (ChatGPT vs Slack or Teams, if you use one), and set quiet hours.

**T1-07 Google Calendar.** Dot books 20-minute "CEO review" blocks when 3 or more decisions or UAT sessions are waiting. Set calendar writes to *Ask before taking action*.

**T1-08 Gmail, read-only.** Dot reads infrastructure mail (Vercel deploy failures, Supabase usage and billing, GitHub security alerts, domain or SSL renewals) into a risk register and the briefs. This is monitoring beyond PM.

**T1-09 GitHub, read-only.** Dot reads commits on main, CI and Dependabot. It matches commits to Shipped Logs and checklists (orphan-fix audit, Hard Rule #25) and flags code changed since a book's evidence cutoff. Keep repo writes off.

**T1-10 Quick capture.** Use the iOS widget or Action button ("Open your dot"): "Inbox: …". Dot appends it to `03 - Steward Proposals/Inbox captures.md`, and the next PM session folds it into `0 - Inbox.md` (automatic after T3-01).

**T1-11 WIP limits.** For example: at most 1 active run and at most 3 decisions waiting on you. Dot stops recommending new Starts while you're the bottleneck.

**T1-12 Codex cloud for read-only investigations.** Sizing, locating files and risk scans in a Codex cloud environment that holds no production secrets. Each job counts against your usage, so Dot states the model, effort and expected usage, then waits for your yes.

---

## 6. T2 — Small code change (one session)

All of these are in `scripts/pm/drive-publish.mjs` and `tests/pm-drive-publish.test.ts`. They take effect after you restart the bridge.

**T2-01 Clean owner actions.** Publish "needs you" separately from notifications, dropping results of cancelled runs, already-applied applications and questions on closed runs. *Today:* 12 entries are listed and several aren't actions, e.g. `Result · r-69bc10ef3c60` and `Question · r-262a6aee5ed3`, both from cancelled runs.

**T2-02 Plan and question content.** Publish a summary of each proposed plan (`plans.body_json`) and the text of open blocking questions (`questions.text`), secret-scanned and size-capped. This unlocks real decision packets and pre-drafted answers.

**T2-03 Event cursor.** Publish the last `run_events.seq`, its kind and time per run, plus the last ~10 events. Dot then sees what happened between checks and can detect stalls by events instead of `updated_at`.

**T2-04 Cost.** Publish per-run token use (`accountingReport`, already behind the Steward's `/accounting` route) and the remaining fleet allowance. This puts spend in the briefs and enables budget alerts.

**T2-05 Missing owner-action kinds.** Publish coordination "Needs scope check" and "Settings mismatch". Your phone gets these and the mirror doesn't.

**T2-06 Mandate window.** Publish the "authorized until" time (DLV-142) and the last readiness verdict, so Dot can remind you before Starts would fail.

**T2-07 Mirror the rulebooks.** Add `ERA Notes/01 - Architecture/Design Doctrine.md`, `ERA Notes/Model-Registry.md` and `CLAUDE.md` to the allowlist. Dot can then apply the doctrine and recommend executor tiers by alias.

**T2-08 Throughput series.** The PM parser already turns Shipped Logs into completion history. Publish weekly counts per campaign so forecasts don't need the books re-read.

**T2-09 Longer run history.** Publish a compact outcome record for every closed run, not just the 20 most recent. This supports retros and success rates.

**T2-10 Planning data.** Publish a projection of `_Planning.json` (sprints) for sprint-level tracking.

**T2-11 Repo facts without GitHub.** Publish the last N commits on main with touched paths (no diffs). This gives the same audits as T1-09 without connecting GitHub.

---

## 7. T3 — Medium build (2–4 sessions)

**T3-01 Proposal cards.** This is the big unlock for prioritization. PM reads Dot's structured proposals from Drive (schema-validated): queue reorders, promote or park, inbox triage, acceptance-criteria drafts and decision records. It shows them as Accept/Reject cards on desktop and `/pm/live`. Accept writes through PM's existing guarded write paths. Dot prepares, you tap.

**T3-02 Drive command inbox.** Dot writes a command file (UUID, operation, item ID). PM validates it against the four Steward operations, runs it as `era-steward` with the same durable receipt (DLV-143) and shows the receipt in `status.json`. This lets Dot start deliveries over the Drive connection that already works, still capped by the server allowlist. Anyone who can write to that folder could request a Start, so keep it unshared.

**T3-03 Direct Steward tools.** The alternative to T3-02: finish the four-tool MCP connection (`pnpm pm:steward`). The code exists; what failed was proving that Dot actually receives the tools. OpenAI's Dots docs don't cover custom MCP servers, so this stays unverified.

**T3-04 Steward page.** Command Center shows Dot's journal and agreement-ledger stats in one place, e.g. "agreed with you 18 of 20 times on prioritization".

---

## 8. T4 — Big refactor (who may do what)

**T4-01 Delegated authority by category.** Widen the Steward credential (`scripts/delivery-v2/steward-surface.mjs`) one category at a time, and only after the category graduates (§12). Candidates: answer technical questions, reconcile, recheck or retry within budget, cancel a stalled run, reorder the queue. Each one gets server enforcement, an audit actor, a kill switch and a budget cap.

**T4-02 Preference gate.** PM decides deterministically which owner actions are preference calls: anything whose `**Touches:**` include UI pages or components or user-visible strings, plus money modules, recurrence and migrations. The Steward credential can never act on those, whatever Dot thinks.

**T4-03 Veto window.** Steward actions in graduated categories wait N minutes on your phone with a Cancel button, then run. Management by exception.

**T4-04 Self-running queue.** Dot owns the order inside your campaign focus. PM auto-starts the next ready item when a slot frees, and stops on budget, readiness or WIP limits. Needs T4-01, T3-01 and reliable readiness (DLV-133, DLV-137).

**T4-05 Budget governance.** PM enforces per-week caps per campaign (allowances already exist in `scripts/delivery-v2/allowances.mjs`). Dot plans within them and asks you for top-ups.

**T4-06 Specialist team.** When OpenAI ships teams of dots: e.g. a QA dot that writes UAT scripts and a research dot. Not available today.

---

## 9. X — Possible, but don't

- **X-01 Connect your PC to Dot.** Dot would get your files, your signed-in browser and local tasks, and your local setup can reach the production database (Rule #26). The runbook revoked this access on purpose.
- **X-02 Sign Dot into `/pm/live` or the app as you.** Its actions would be recorded as yours, not Steward's, and it would see your money data. Every PM button press writes relay rows to the live Supabase project, which counts as an agent writing to production under Rule #26 as written.
- **X-03 Let Dot Apply.** Apply changes your repo. It stays yours.
- **X-04 Let Dot approve plans or mark them owner-reviewed.** `_Conventions.md` §9 forbids setting `ownerReviewed: true` because an AI wrote a plan. Until T4-02 exists, every plan approval is yours.
- **X-05 Treat custom rules as limits.** OpenAI says Dot "tries to follow" them and "can make mistakes". Real limits live in PM (`steward-surface.mjs`).
- **X-06 Edit files in `01 - PM Documentation`.** They're overwritten on the next publish (the edited copy is kept under `Drive edits/`). Proposals go to `03`.
- **X-07 Codex cloud environments with production secrets, or live paid-API tests** (Rules #26 and #29).
- **X-08 Data repair or migrations through Dot.** These are deliverables handed to you (Rules #24 and #26).
- **X-09 Repo write access through the GitHub plugin.**

## 10. Not available yet (OpenAI)

- Calls started by Dot (planned after launch). Texting (coming soon / limited beta).
- Teams of dots.
- Drive change events. Dot checks on its own wake-ups, because event monitoring only works where the connected service supports it.
- Viewing or editing Dot's own notes (not documented). Use the Steward journal instead.
- Custom MCP servers for Dots (not documented).

---

## 11. Rubrics Dot uses

### Priority rubric (in order)

1. Your campaign focus for the month. Dot asks you if it isn't set.
2. Severity: `blocker` > `friction` > `annoyance`. Never `parked`, never `HELD`.
3. Unblocks the most other items (`**Depends on:**`).
4. Passes Definition of Ready.
5. Cheapest path to value: an existing verified candidate gets reviewed first.
6. `S` before `M` when tied; `L` gets split first.
7. No `**Touches:**` overlap with an active run.
8. Now stays at 3 or fewer per campaign; a blocked dependent is never promoted for its severity.

For anything about approach or taste, Dot cites a preference ID (T1-01) or asks you.

### Definition of Ready

- Listed in a campaign checklist and not `HELD`.
- Its `### <ID>` section has `**Acceptance:**`.
- `**Touches:**` declared (or `none`).
- Every `**Depends on:**` item has shipped.
- Effort `S` or `M`.
- No verified candidate is already waiting for the same item.
- No open owner prerequisite (migration run, RLS export, restart, readiness).

### Definition of Done chain

Verified candidate → Applied → UAT handover ready → your sign-off ("Shipped") → checklist ticked → Shipped Log entry → `pnpm pm:archive` sweep. Any gap goes on the next brief (e.g., "UAT unrecorded", "applied but missing from the Shipped Log").

### Interrupt policy (defaults; edit them in the Charter)

| Event | Interrupt now | Next brief |
| --- | --- | --- |
| Mirror older than 15 min during an active run | ✓ | |
| Start refused | ✓ | |
| Run finished (outcome and what to check) | ✓ | |
| Active run with no change for 45 min and not waiting on you | ✓ | |
| A decision waiting more than 4 h during your hours | ✓ | |
| New plan or question (PM already pushes these) | | ✓ |
| Priorities, hygiene, forecasts, research | | ✓ |

Quiet hours 23:00–08:00 Asia/Beirut: only active-run problems interrupt.

### Decision packet template

```
Decision packet — <date> <time>
1. <item / run> — <decision needed> — waiting <age>
   Context: <two lines>
   Options: A <…> / B <…>
   Recommendation: A, because <…> (confidence high / medium / low; preference P-xx if any)
   If you wait: <what stays blocked>
   Link: <run or doc link>
```

---

## 12. Delegation ladder

| Level | Dot | You | Needs |
| --- | --- | --- | --- |
| L0 Observe | Reads and reports | Everything | T0 |
| L1 Recommend | A written recommendation on every decision in the category | Decide | T0 (+T2 for content) |
| L2 Act with veto | PM queues its action for N minutes | Cancel if wrong | T4-03 |
| L3 Act and report | PM lets it act | Read the report | T4-01 |

**Promotion (suggested):** per category, at least 15 recommendations in the ledger over at least 30 days, at least 90% agreement and nothing marked harmful. One harmful miss drops it back a level.

**Never above L1:** preferences and taste, Apply, migrations and production data, money logic, policy and budget changes.

## 13. Roadmap to "PM while I'm CEO"

| Stage | Add | Dot feels like |
| --- | --- | --- |
| 1 — now | T0 + T1-01…T1-05 | A PM who reads everything, reports and recommends, but can't touch the board |
| 2 | T2-01…T2-07 (one session) | A PM who sees what you see (plans, questions, costs) and prepares every decision |
| 3 | T3-01 + T3-02 | A PM who moves the board with your one tap and starts work inside your daily mandate |
| 4 | T4, one category at a time | A PM who handles technical calls alone, leaving you preferences, money and Apply |

**Gates:**
- Stage 1 → 2: one delivery supervised end to end with no nudges from you.
- Stage 2 → 3: two weeks of briefs you rated accurate.
- Stage 3 → 4: per category, on the agreement ledger.

**Standing limits at every stage:** Dot's custom rules are fallible, so hard limits live in PM. The mirror only runs while `pnpm pm --bridge` is up and Drive is syncing. Background work and Codex/Work tasks count against your usage, and OpenAI hasn't published its long-term terms. No independent evaluation of Dots existed at launch, so prove each stage before trusting the next.

## Sources

- [Introducing dots — OpenAI](https://openai.com/index/introducing-dots/)
- [Dots docs overview](https://learn.chatgpt.com/docs/dots)
- [Getting started](https://learn.chatgpt.com/docs/dots/getting-started)
- [Tasks and memory](https://learn.chatgpt.com/docs/dots/tasks-and-memory)
- [Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps)
- [Messaging](https://learn.chatgpt.com/docs/dots/channels)
- [Controls](https://learn.chatgpt.com/docs/dots/controls)
- [DataCamp: OpenAI Dots explained](https://www.datacamp.com/blog/openai-dots)
