# Delivery: what you asked for vs what exists

Checked 2026-09-15 against code, `.delivery/v2` and tests. Legend: ✅ built · 🟡 partly built · ❌ missing. "Built" is not "accepted": all your UAT results are still Pending.

**Summary:** 5 ✅ · 14 🟡 · 6 ❌. Review screens, rollback safety, diffs, token counting and the Work list are much better. The main goal is still not met: trusting agents to deliver while you are away.

## Blocking right now

1. **Your DLV-90 run from 22:36 tonight will never start.** It is queued behind the fleet allowance. DLV-107 already used 284,243 tokens, the new job reserves 50,000, and the limit is 200,000. Finished runs count forever (`scripts/delivery-v2/coordination.mjs:509`), so the queue never clears. To fix it, raise or remove `concurrency.fleetAllowance` in `.delivery/v2/execution-policy.json`, or change the code so only live runs count.
2. **The installed policy only covers DLV-107.** The agent's workspace holds only PM app files, Apply can only write `scripts/pm/app/Work.tsx`, and only "low" effort is allowed. DLV-90, DLV-108 and KIT-11 need files outside that list. Launch queued the run instead of refusing it.
3. **Two PM servers share one Delivery store:** port 4317 has been running old code since Sep 13, and port 4318 started tonight. Stop the old one.

## PM application

| You asked | Now | Not there | |
|---|---|---|---|
| A real app, not a dashboard over Markdown, in the ERA look *(Sep 5, 10)* | A React app replaced the old dashboard. The ERA Blue/Pink theme is back and the false "Offline" warning is fixed (R57, R58) | — | ✅ |
| Home cards showing what needs me and what's running *(Sep 10, 11)* | Module shelves, Now work, waiting decisions, live runs and recent shipments (R57, R60) | Running V2 work is not shown on Home (R55) | 🟡 |
| A backlog across all modules, a per-module view and links to source files *(Sep 11)* | Board/List by Now/Next/Later with filters, shareable links, and Checklist/Brief links that land on the exact row (R60) | — | ✅ |
| Kanban ↔ sprints, deliverables, timelines and "qualify for sprint" *(Sep 11)* | Kanban only | Sprints, deliverables and readiness checks (R61) | ❌ |
| Charts: pending, done, cancelled, bugs *(Sep 11)* | Outcomes and delivery attempts are counted separately (R62) | Sprint and run-comparison charts (R62) | 🟡 |
| Work lists only actionable items, with finished items under Done *(Sep 15)* | Work is split into To do and Done. Finished and owner-only items can't be launched (R65) | — | ✅ |
| The phone as a real remote surface *(Sep 10, 11, 13)* | `/pm/live` shows the same screens through the relay, and a repeated command can't run twice (R63, DLV-104) | `migrations/2026-09-12_pm-v2-relay.sql` has not been run, so the phone can't send V2 commands. Never tested on a real phone | 🟡 |

## Delivery engine

| You asked | Now | Not there | |
|---|---|---|---|
| Keep the Claude and Codex SDKs, with an explicit choice and no silent switching *(Sep 9, 11)* | Executor, model and effort are chosen per run and saved. No fallback (DLV-97) | Claude has never run a real job | 🟡 |
| Subscriptions only: no API keys, no extra cost *(Sep 13)* | Workers refuse API keys and paid sign-ins, and check included usage before every job (DLV-110) | Sign-in refresh for unattended runs (DLV-111) | 🟡 |
| Dependable rules: sandbox, policy, approvals *(Sep 9, 11)* | A Docker worker and a separate checker run with no host access. A policy file sets the rules, and you approve the plan and press Apply (DLV-96, DLV-97, DLV-105) | Each item's files must be added to the policy by hand, and Docker must be running | 🟡 |
| A fast lane, a normal lane and a deep dive that really differ *(Sep 5; Sep 14 #2)* | Fast lane runs 1 plan job and 1 build job with no auto-repair. Deep dive investigates first and has no job limit. The lane is suggested from risk, scope and dependencies | No "normal" lane (two lanes were chosen on Sep 11). Fast lane doesn't get a trimmed context or ready-made checks yet (DLV-118) | 🟡 |
| A suggested model and effort for each item *(Sep 11; Sep 14 #3, #7)* | Picking a lane fills in a fixed choice from the policy, for Fast lane only: Sonnet 5 low or GPT-5.6 Luna low | Suggestions don't depend on the item, there is none for Deep dive, and only "low" effort is installed (DLV-117) | 🟡 |
| Agents that know the feature, its docs and what it affects *(Sep 5, 15)* | The prompt carries the item's outcome, its Master Book section, the previous plan, and your answers and messages | No CLAUDE.md, skills, Feature Map, module docs or connected modules. Not in the backlog | ❌ |
| Context caching *(Sep 5)* | Plan and build continue one native session, so the provider caches input (198K of 282K input tokens on DLV-107) | Delivery sets no context budget of its own (DLV-118) | 🟡 |
| Agents suited to the work / multi-agent orchestration *(Sep 5, 11)* | Replaced by the plan adopted Sep 11: one writer per item plus an independent checker, with parallel items instead of agent teams | No reviewer or specialist agents. The plan's optional reviewer was never built | ❌ |
| Parallel delivery of independent items *(Sep 11)* | Up to 2 writers, with "Can run together", "Must follow" and "Needs scope check" verdicts, a queue, and one Apply at a time (DLV-106) | Never run for real. The installed policy allows only 1 writer | 🟡 |

## Running and reviewing a delivery (your 13 points on Sep 14 and follow-ups on Sep 15)

| You asked | Now | Not there | |
|---|---|---|---|
| Readable screens with larger text, no clutter and no collapsed sections *(#1, #11; Sep 15)* | Tabs run Plan → Verification → Activity → Changes. Text is 16px, and hint text and fleet labels are gone. Checked in a headless browser at 320–1920px (R64, R66) | Your UAT (U1–U7a). The Delivery home still hides "Pairs" in a collapsed section | 🟡 |
| Read and control plan.md before approving *(#5; Sep 15)* | Scope, Steps, Checks, Risks and Unknowns appear above Approve, with revisions, Artifacts beside the plan and a download (DLV-116) | Plans made before Sep 15 are still cut short | ✅ |
| See what the agents are doing while they work *(Sep 10, 11)* | The Activity tab shows messages and events | These appear only after each job ends (DLV-109), and a restart can strand a finished job (DLV-108) | ❌ |
| A token cap, with escalation when usage runs high *(#6, #7)* | The token count is fixed (284,243, not 482,416) and shown against the 200,000 limit (DLV-119) | Nothing stops a job that is already running, and there is no warning or Stop/Increase choice (DLV-114) | ❌ |
| Checks and buttons I can understand, including what "inconclusive" means *(#8, #9)* | One result per check with its test count, with earlier runs below. "Couldn't verify", "Failed" and "Not tested" are separate states, and "Check status" is a different button from "Recheck" (DLV-112) | Check logs aren't kept (DLV-120), and there's no way to send failures back for a fix (DLV-113) | 🟡 |
| See what changed in each file *(#10)* | Each file is marked Created, Modified or Deleted against the run's starting point, with a verified diff (DLV-116). `Work.tsx` existed before the run, so "update" was correct | Older candidates and large diffs (DLV-121) | 🟡 |
| Rollback that asks first and really undoes *(#12)* | A preview shows restore/delete/recreate counts, Cancel has focus, and stale previews are refused (DLV-115). The run didn't create `Work.tsx`, so restoring it was correct | Your UAT (U14–U16) | ✅ |
| A delivery history on each item, with Back returning to the session *(#13)* | Attempts reopen from the item, even after it is Done. The selected tab and position survive refresh and Back (R55, R65) | Paging, filters and retry lineage (R55) | 🟡 |
| Confidence to deliver remotely and unattended *(Sep 5, 9, 11)* | One real V2 run: DLV-107 (Codex, Luna low), applied and then rolled back | V2 hasn't delivered a single product item. Unattended use also needs DLV-108, DLV-109, DLV-114 and the relay migration | ❌ |

Sources: your messages from Sep 5 to Sep 15 in Claude and Codex sessions. Tests run on 2026-09-15: `tests/delivery-v2` and `tests/pm-ui` gave 661 passed and 4 Docker tests skipped. Manual checks: [Delivery-UAT.md](Delivery-UAT.md).
