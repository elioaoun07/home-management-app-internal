---
created: 2026-06-12
type: review
status: living
owner: Elio
tags:
  - pm/far
  - scope/cross-cutting
---

# FAR 1 · North Star — The Goal Revisited

> **FAR:** [_index](<_index.md>) · **1 · North Star** · [2 · Strengths](<2 - Where the App Stands Strong.md>) · [3 · Enhancements](<3 - Enhancement Map — Sharpen What Exists.md>) · [4 · Junctions](<4 - Junction Leverage — Compound Advantages.md>) · [5 · Missed](<5 - Missed & Forgotten — The Blind Spots.md>) · [6 · Market & Challenges](<6 - Market Lens & Challenge Letter.md>) · [7 · Synthesis](<7 - Synthesis — The 90-Day Path.md>)

---

## 1. How the goal evolved (the honest arc)

| Phase | Evidence | What the app *was* |
|---|---|---|
| **Sep 2025 — a budget tracker** | First commit 2025-09-13, "Create Next App"; repo literally named `budget-app` | Accounts, transactions, categories. A ledger. |
| **Oct 2025–Mar 2026 — a household OS** | Items/Reminders, Recipes, Inventory, Meal Planning, Chores, Catalogue, NFC, Guest Portal, Trips… ~40 modules, ~80 tables | A multi-module PWA: everything a two-person household tracks, in one graph. |
| **Apr–May 2026 — an AI face on the OS** | ERA faces/intents (May 9–26), Voice Conversation (May), Focus briefing, Hub as "top-layer primary interface" | A *conversational* household OS — you can talk to it, it parses and acts. |
| **Today — the stated goal** | CLAUDE.md header: "**Reactive + Proactive** AI Personal Assistant… responds to user input **and** AI-driven briefings, alerts, and scheduled actions" | The claim. The rest of this file audits it. |

The repo is still named `budget-app` while the README of record describes a proactive assistant. That gap — between the name and the claim — is exactly the gap this review measures.

---

## 2. What "proactive assistant" actually requires

A proactive assistant is a **loop**, not a feature: **Sense → Reason → Act → Deliver → Learn.** Audit of each organ against `main` (2026-06-12):

| Organ | What it needs | What exists today | Verdict |
|---|---|---|---|
| **Sense** | One queryable graph of the household's money, time, food, home, travel | ~80 tables across all domains; `household_links` spine; `account_daily_summaries`, `cooking_logs`, `trip_side_effects` even capture *history* | 🟢 **World-class.** The best organ. |
| **Reason** | Detection: anomalies, forecasts, thresholds, patterns | `anomalyDetection.ts` (z-score spikes/drops/inactive categories), `ForecastWidget`/`BudgetForecastWidget`/`CategoryForecastWidget`, `ai_budget_suggestions` + `api/budget-allocations/ai-suggest`, `api/suggest-schedule`, Prerequisites evaluator engine | 🟡 **Built — but fragmented and pull-only.** Intelligence exists as *dashboard widgets*, not as signals. |
| **Act** | The ability to do things, not just say things | Message Actions (chat→transaction/reminder/item), Drafts (voice→pending tx), trip activation/completion RPCs, inventory `add-to-shopping` | 🟡 **Rails exist; no unified proposal/approval pattern.** Each action path is bespoke. |
| **Deliver** | Reaching you at the right moment, on the right channel, without noise | Web Push + in-app notifications, subscription health, `push_event_logs` telemetry, 5 cron routes | 🟠 **Pipe exists; policy doesn't.** No quiet hours, no batching, no priority, no digest. The crons are content-blind or item-scoped. |
| **Learn** | Getting better from outcomes | `merchant_mappings` (statement import only); `push_event_logs` written but never read; no correction memory for ERA; no briefing feedback | 🔴 **Almost absent.** The assistant never learns from being right or wrong. |

**The headline finding:** the bottleneck is **not intelligence** — much of it is already written. It's that *nothing runs server-side on your behalf*. The clearest proof: `src/app/api/focus-insights/route.ts:156` — the briefing endpoint requires **the client to send the items in the request body**. The server cannot compose a briefing on its own. If you don't open the app, ERA literally cannot think.

The entire scheduled surface is five cron routes: `daily-reminder` (content-blind "log your expenses" ping), `daily-items-reminder` / `item-reminders` (item alerts), `chat-notifications`, `purge-recycle-bin`. None reads money, food, or trips. That is the whole of today's "proactive."

---

## 3. The Proactive Maturity Model

A ladder to locate every feature and every roadmap item on. **An app's level = the highest level it does *reliably*, not occasionally.**

| Level | Name | Behavior | Status today |
|---|---|---|---|
| **L0** | Time-fired, content-blind | "Don't forget to log expenses" at 7pm | ✅ Shipped (`daily-reminder`) |
| **L1** | Content-aware alerts | "Rent reminder due tomorrow" — knows *what*, fires on *schedule* | ✅ Shipped (`item-reminders`, recurring alerts) |
| **L2** | Composed briefing **on open** | Focus insight, ERA face widgets — synthesized view *when you ask / open* | 🟡 Partial — items-only, pull-only, 24h cache |
| **L3** | Server-composed, **scheduled** briefings | Morning brief *pushed* at 7:15 reading money + time + food + trips; Sunday digest | ❌ **Missing — this is the frontier** |
| **L4** | Trigger-based intervention | Anomaly/threshold fires → ERA pings you *within minutes*, unprompted | ❌ Detection exists (`anomalyDetection.ts`), delivery doesn't |
| **L5** | Closed-loop autonomy | ERA *acts* (drafts, reorders, reschedules) via approvals, and **learns** from your responses | ❌ Seeds only (Drafts, merchant map) |

**Verdict: the app is a strong L2.** The vision statement describes L4–L5. The good news: because Sense is world-class and Reason is half-built, **L3 is weeks away, not months** — it's plumbing, not invention.

```
        L0 ── L1 ── L2 ── L3 ── L4 ── L5
TODAY:  ████████████████░░
GOAL:                       ████████████
                    ▲
            you are here — and the gap is
            pipeline, not intelligence
```

---

## 4. The five missing organs (what L3–L5 require)

These are the *systems* the roadmap should be organized around. Every bridge and enhancement in the existing Track A/B lists either feeds one of these or rides one.

1. **Signals Registry** — each module exposes a pure, server-callable `getBriefingSignals()` (FABLED [E1](<../Hub & ERA/FABLED/4 - FABLED — Future Enhancements.md>) already names this seam; the ERA per-face resolvers prove the pattern). A signal = `{source, severity, headline, data, expiresAt, audience}`.
2. **Context Assembler** — a server-side `get_briefing_bundle()` (the `get_schedule_bundle` RPC pattern, aimed at briefings) so the server can think without the client. This single change unlocks everything above L2.
3. **Trigger Engine** — *generalize Prerequisites* (see [FAR 4 · J1](<4 - Junction Leverage — Compound Advantages.md>)): time windows, thresholds, formula conditions over the graph. You already own the seed of this engine; it currently only unlocks NFC checklists.
4. **Delivery Policy** — quiet hours, a *notification budget* (max N pushes/day, digest the rest), priority classes, channel choice (push vs hub-feed card vs ERA chat message). The pipe exists; the judgment doesn't.
5. **Feedback Store** — every proactive touch records `seen / acted / dismissed / wrong`; `push_event_logs` already captures delivery, nothing captures *reception*. This is what makes L5 trustworthy instead of annoying.

---

## 5. How to know you've arrived (KPIs for "proactive")

Pick numbers now, so "proactive" stops being a vibe:

| KPI | Definition | Target |
|---|---|---|
| **Proactive Hit Rate** | Unprompted ERA touches per week that you act on or thumbs-up | ≥ 5/week at ≥ 80% positive |
| **Notification Regret** | % of pushes dismissed without action (from feedback store) | < 20% |
| **Time-to-Capture** | Median seconds from "spend happened / thought occurred" to "recorded" | < 5s (see [FAR 3 · R1](<3 - Enhancement Map — Sharpen What Exists.md>)) |
| **Speaks-First Ratio** | ERA messages initiated by ERA vs by you | > 0 (today it is exactly 0 outside static reminders) |

> **The one-line verdict:** you set out to build a proactive assistant and have built an exceptional *reactive* one on top of the best household data graph I've seen in a personal project. The remaining work is not "more AI" — it's giving the intelligence you already wrote a heartbeat, a mouth, a permission system, and a memory.

→ Strengths in detail: [FAR 2](<2 - Where the App Stands Strong.md>) · The build order: [FAR 7](<7 - Synthesis — The 90-Day Path.md>)
