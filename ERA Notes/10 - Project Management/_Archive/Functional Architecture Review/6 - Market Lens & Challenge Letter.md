---
created: 2026-06-12
type: review
status: living
owner: Elio
tags:
  - pm/far
  - scope/cross-cutting
---

# FAR 6 · Market Lens & Challenge Letter

> **FAR:** [_index](<_index.md>) · [1 · North Star](<1 - North Star — The Goal Revisited.md>) · [2 · Strengths](<2 - Where the App Stands Strong.md>) · [3 · Enhancements](<3 - Enhancement Map — Sharpen What Exists.md>) · [4 · Junctions](<4 - Junction Leverage — Compound Advantages.md>) · [5 · Missed](<5 - Missed & Forgotten — The Blind Spots.md>) · **6 · Market & Challenges** · [7 · Synthesis](<7 - Synthesis — The 90-Day Path.md>)
>
> Part 1: what the market builds, praises, and abandons (assistant knowledge through early 2026 — directionally solid, verify specifics before betting on them). Part 2: what *you'd* ask for as your own most demanding user. Part 3: **the challenge letter** — you asked to be pushed back on; here are ten pushes, numbered so you can accept or reject each *in writing*.

---

## Part 1 — What the market says

| Category | Exemplars | What users praise | What kills them | Lesson for ERA |
|---|---|---|---|---|
| Money | YNAB, Monarch, Copilot Money | The *ritual* (YNAB), household sharing (Monarch), auto-categorization quality (Copilot) | Manual entry fatigue; sync breakage; subscription fatigue | Ritual (M6) + capture cost (R1) decide survival, not chart count |
| Family orgs | Cozi, OurHome, Maple | Shared calendar everyone actually sees; chores+rewards for kids | Feature sprawl; no money story; ad-cluttered | One calendar of truth → M1; simplicity is a feature |
| Tasks | Todoist, TickTick, Structured | NL entry quality; daily-planning ritual | Notification spam → users mute → app dies | Your NL bar is Todoist; your spam guard is J5 |
| AI companions | Replika-class, Dot-class "proactive" companions | Feeling *known* (memory) | Confident wrongness; novelty decay; privacy unease | Memory (E6) + provenance (R8) + accuracy gates (C8) |
| Platform assistants | Gemini on Android, Apple Intelligence | Zero-setup, OS-level reach | Generic — no household graph, no LBP, no chores | **Your moat = private graph + acting in *your* system + Lebanon reality.** Generic proactivity will be commoditized; *household* proactivity won't. |

**What the market would demand of ERA on day one:** notifications that are *always* worth reading (one bad ping costs ten good ones), sub-second perceived UI on mid-range Android, an onboarding/empty-state story, a privacy & export answer, and reliability over demo-magic. Note that *none* of these is a new module.

## Part 2 — What you would ask for (the Elio test)

Reading your own backlog's shape, the asks recur: **faster capture** (voice, NLP, templates), **fewer taps** (bridges that remove reconciliation), **briefings that actually know the day** (E1 obsession across every folder), **partner parity** (color identity, household everywhere), and **money truth in a two-currency life**. Every recommendation in this review traces to one of those five. When in doubt, score features against them — they are your revealed preferences, more honest than any roadmap.

---

## Part 3 — The Challenge Letter

*You asked not to be agreed with. Each challenge names the current thinking, the push, and what acting on it looks like. Accept or reject each — but in writing, here, with a date.*

**C1 — "Proactive" is currently a brand promise, not a behavior.** CLAUDE.md's first line claims it; the architecture is L2 ([FAR 1](<1 - North Star — The Goal Revisited.md>)). The Speaks-First Ratio is zero. *The push:* treat the word as unearned until a server-composed briefing lands on your lock screen. Either build L3 next quarter or soften the claim — a vision statement you've stopped believing quietly poisons prioritization.

**C2 — Module-building has become your comfort zone.** ~40 modules in 9 months; meanwhile the keystone bridge (2a) and four evaluator stubs sat untouched for weeks. Your own file 3 says "more modules is not the moat" — and then Trips, Chores, Focus, Dashboard-V2 shipped anyway. *The push:* **a one-quarter standalone-module freeze.** New nouns forbidden; only verbs between existing nouns (bridges, signals, proposals). The `new-module` skill should refuse politely until October.

**C3 — Decide who this is for, once.** Half the backlog tension (onboarding? multi-household? i18n? guest features?) dissolves if you write down: *"ERA is for our household; design quality as if for thousands, build scope as if for two."* Personal-first means: no onboarding polish, no multi-tenant work, no kid-roles until your household changes shape — and no guilt about it. If the answer is ever "product for others," that's a different roadmap entirely (tests first, then onboarding, then pricing). Pick. Write it in the PM index.

**C4 — The intent router won't scale the way FABLED assumes.** Every E-item adds intents × resolvers × formatters — linear hand-coding forever, and the long tail ("split yesterday's Spinneys run with Racha minus the diapers") will never be enumerable. *The push:* adopt the hybrid now (J10): deterministic router for the hot 20, tool-calling fallback for the rest, both behind the same confirm card. Your Zod schemas are most of the tool definitions. Waiting until intent count doubles makes the migration twice as painful.

**C5 — Voice: ship the wake word or demote voice, this month.** The 1-hour Azure Custom Keyword task (G4/E3) has been pending since May while voice remains the identity feature. A flagship that needs apologies ("wake word isn't set up yet") teaches you to stop demoing it. *The push:* calendar one afternoon, train `hey-era.table`, flip the flag — or consciously demote voice to secondary and stop letting it shape architecture decisions.

**C6 — Half-built gamification is worse than none.** `hub_user_stats` streaks and `hub_feed` milestone/`budget_alert` types exist in schema while emission looks partial (A5). A streak that's silently wrong *teaches users the app lies*. *The push:* one day to audit — then finish it (emit on the write paths, surface in Hub) or delete the columns. No third option.

**C7 — Adopt a notification budget before adding any new alert type.** Track B wants spending alerts, low-stock alerts, debt alerts, briefings, digests… The household's attention is the scarcest resource in the system, and J5 has no policy layer yet. *The push:* hard cap (e.g., 3 pushes/person/day; everything else batches to digest/feed), quiet hours, and the regret metric (R5.2) — *first*, then new alert types. The bar: **would ERA walk into the room to say this?**

**C8 — No proactive feature ships before the money tests.** Your audit knows it; this makes it a gate, not a wish: anomaly pushes and affordability answers built on untested `balance-utils` and next-due math amplify silent errors into *broadcast* errors. P0 tests (balance directions, recurring next-due, intent fixtures) are the entry ticket to L3+. Estimated cost: days. Cost of ERA confidently pushing a wrong balance: the product's credibility.

**C9 — Open Banking (Track C8) is a mirage in your market — replace the dream.** Plaid-style feeds aren't coming to Lebanese banks on any horizon you control. Energy reserved for that dream should go to the real regional pipeline: **bank-SMS share-target → parse → draft (M2) + receipts OCR (C6) + statement import you already have.** That stack achieves ~90% of open banking's value with zero dependency on the banking sector reforming.

**C10 — The 5,506-line front door taxes everything you're about to build.** Briefing cards, proposal inbox, expense-split, richer widgets — *all* land in `HubPage.tsx`. Hub & ERA Bet 3 already says decompose; the push is sequencing: **decompose as the first step of the briefing work** (extract thread-view, composer, message-list as the seams the new cards need), not as a someday refactor. Refactor with a feature as its vehicle, or it won't happen.

---

## Scoreboard (fill in as you decide)

| # | Challenge | Verdict (accept / reject / modify) | Date | Note |
|---|---|---|---|---|
| C1 | Earn "proactive" or soften it | | | |
| C2 | One-quarter module freeze | | | |
| C3 | Personal-first, in writing | | | |
| C4 | Hybrid routing now | | | |
| C5 | Wake word this month or demote voice | | | |
| C6 | Finish or delete gamification | | | |
| C7 | Notification budget first | | | |
| C8 | Money tests gate L3+ | | | |
| C9 | Drop open-banking dream for SMS stack | | | |
| C10 | Decompose HubPage via the briefing feature | | | |

→ The constructive version of all ten: [FAR 7](<7 - Synthesis — The 90-Day Path.md>).
