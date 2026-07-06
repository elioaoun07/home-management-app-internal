---
created: 2026-07-06
type: doctrine
status: living
owner: Elio (authored by Claude Fable 5, final session)
tags:
  - architecture/doctrine
  - ai/inheritance
---

# Design Doctrine — How to Think in This Codebase

> **Who this is for:** any agent (or human) making a judgment call the playbooks don't cover — designing a feature, resolving a tradeoff, deciding what *not* to build. The skills in `.claude/skills/` tell you **how to execute**; this file tells you **how to decide**. When a playbook and this doctrine conflict, the playbook wins on mechanics and this doctrine wins on direction.
>
> Written 2026-07-06 as a generational handoff. Every claim was verified against the working tree that day. If you find drift, fix this file — it is living, like everything else here.

---

## 1 · What this system actually is

Not a budget app. It is a **household operating system for exactly two people plus one AI**, built around a single physical reality: a dual-currency (USD/LBP) household in Lebanon where capture friction — not missing features — is the enemy. Every design decision traces back to one promise: *recording life (a spend, a task, a meal, a debt) must cost near-zero attention, and the system must give that attention back as foresight.*

The architecture already encodes this: Hub Chat as the high-frequency capture layer, forms as precision tools, drafts as reviewable AI proposals, Undo instead of confirmation dialogs, offline queue because Beirut connectivity is a design constraint, not an edge case.

**The center of gravity test:** any proposed change either (a) lowers the cost of capture, (b) raises the value returned per captured fact, or (c) protects the trust that makes (a) and (b) possible. If you can't say which, the change is probably decoration.

## 2 · The Ten Questions — ask them of EVERY change

The playbooks enforce these mechanically where they can; ask them consciously where they can't.

1. **The Partner Question.** What does the *other* person see when this ships? Every row of data has two viewers with different rights (`household_links`, `is_public`, `ownOnly`). A feature designed for one viewer is half-designed. (Hard Rule 13/14)
2. **The Capture-Cost Question.** Does this add a tap, a field, or a decision to any capture path? Count them. Additions need explicit justification (ui-guardrails §12).
3. **The Offline Question.** What happens when this runs with no network — queue, degrade, or block? "It breaks" is an answer you must write down, never an answer you discover.
4. **The Undo Question.** What is the exact inverse of this action? If you can't write the inverse, the action is not safe enough for a toast-and-proceed UX — redesign it (proposal/draft pattern) rather than adding a confirm dialog.
5. **The Exactly-Once Question.** If this fires twice (double-tap, retry, replayed queue, overlapping cron), what deduplicates it? Money and occurrences have historically failed here — idempotency is a design input, not a hardening pass.
6. **The Invalidation Question.** Name every query key that displays the data you mutate. If the list is long, the feature may be fighting the data model.
7. **The Latency-Floor Question.** How many PostgREST round-trips does the hot path make? Each costs ~170–200 ms before any query cost. More than 2 on a page load → bundle RPC (Hard Rule 21).
8. **The Person-Absolute Question.** Any color, name, or attribution: does it follow the *person* across both phones (blue user is blue everywhere)? Role-relative rendering is a recurring bug class.
9. **The Proactive Question.** Could ERA surface this without being asked? A feature that only answers when queried is half the product's promise. At minimum, leave the seam (a `getBriefingSignals()`-shaped export, an event row).
10. **The Trust Question.** If this is AI-generated (parse, suggestion, allocation), what is the deterministic fallback, and does the user review before it mutates state? The shipped pattern is: AI proposes → draft/review card → user confirms → Undo. Never let a model write directly to money or schedule.

## 3 · The silent-failure taxonomy — what this app breaks like

TypeScript will not save you here. The dangerous bugs are the ones where **the app keeps working while being wrong**:

| Class | Example | Reflex |
|---|---|---|
| **Money drift** | balance diverges cent by cent | Worked before/after example + test (money-rules) — never ship money math on inspection alone |
| **Duplicate/skipped occurrence** | payment posts twice; reminder silently vanishes | Write the exactly-once argument down (recurrence-safety) |
| **Visibility leak** | partner sees a hidden account; guest sees household data | Trace the household filter on every new read path (api-route §household) |
| **Stale truth** | dashboard shows yesterday's balance after an edit | Enumerate the invalidation set before writing the mutation (cache-invalidation) |
| **False offline** | slow AI call flags the app offline | Every >5s call passes `timeoutMs` (Hard Rule 6) |
| **Zombie schedule** | cron assumed running but never scheduled | Anything time-triggered gets a "how do I know it ran" answer (a log row, a last-run stamp) |

When you design, pre-mortem against this table: "which of these six does my feature add a new instance of?" The honest answer is rarely "none."

## 4 · Standing design decisions (don't relitigate these)

Decisions that look questionable to a fresh reviewer but are deliberate. Overturning any of them requires the user's explicit sign-off, not agent judgment:

- **Choke points over conventions.** All balance writes through `adjustAccountBalance()`; all mutations through `safeFetch()`; hot reads through `get_*_bundle()` RPCs; query keys through factories. When you find a new cross-cutting concern, build the choke point *first*, then the feature.
- **One engine per concept.** Two recurrence systems exist (payments vs items) — that's already one too many, frozen by history. Never add a third, and never add a second expansion path, second toast system, second offline queue, second assistant brain. Unify or reuse; never fork.
- **Read paths never mutate.** Auto-reconciliation-on-load was built and deliberately removed. Hidden write-backs compound errors — repairs are explicit, user-initiated, audited.
- **Proposals over actions for AI.** The drafts pattern (AI creates a reviewable draft, human confirms) is the app's AI-safety model and its UX signature. Extend it to new AI capabilities rather than inventing new consent flows.
- **`navigator.onLine` is a liar; the default timeout is 3 s.** Connectivity truth comes from `isReallyOnline()` probing `/api/health`. These numbers encode Lebanese network reality — read `src/lib/safeFetch.ts` / `connectivityManager.ts` before "improving" them.
- **The vault is the second product.** ERA Notes + skills + hooks + FABLED are not documentation *about* the app; they are the operating system that lets AI build the app. Time spent keeping them truthful is engineering, not paperwork — but see §6: they must never outspend the product itself.
- **LBP in thousands; custom billing month; person-absolute colors.** Module-level rules with vault docs. They model reality for this specific household — do not "normalize" them toward textbook designs.

## 5 · When no playbook fits — the priority order

Tradeoffs resolve in this order (higher beats lower):

1. **Correctness of money and schedule facts** — a wrong balance is worse than a missing feature.
2. **Trust surface** — undo-ability, visibility rules, AI-proposes-human-confirms.
3. **Capture speed** — taps, latency, defaults.
4. **Coherence** — reuse the existing pattern even when a novel one is 20% better; pattern-count is a cost users feel as inconsistency and agents feel as drift.
5. **Foresight value** — proactive surfacing, briefings, forecasts.
6. **Polish and novelty** — last, always.

Two corollaries. *Corollary A:* a feature that increases foresight (5) by sacrificing trust (2) — e.g. auto-posting without review — is a downgrade, whatever the demo looks like. *Corollary B:* when two implementations tie, choose the one that deletes more code.

## 6 · The execution warning — this project's real failure mode

The codebase's diagnostic layer (FABLED 2) scored its own **execution coupling at 3/10**: 15-minute fixes flagged in every layer of documentation survive for weeks; the weekly plan goes stale while the archive of what-should-happen grows richer. The machine *knows* more than it *does*.

Agents inherit this bias: documenting, indexing, and planning feel productive and safe; shipping feels risky. Counteract it deliberately:

- When a session can either **extend a plan** or **execute a flagged 15-minute fix**, execute first.
- Never create a new document where updating an existing one suffices (Documentation Rules already say this — it bears repeating because the pull is real).
- A PM update that marks something ✅ done beats a beautifully-written new backlog section.
- If you notice yourself building meta-tooling for the meta-tooling: stop and ask what the user's household actually felt this week.

## 7 · Generational handoff protocol

For every AI generation (and major campaign) working in this repo:

1. **Trust the FABLED 2 layer as verified ground truth** *as of its stamp date*, then delta it: `git log --oneline --since=<stamp>` and update the relevant `_index.md` with what actually changed. Never re-audit from scratch what a stamped audit already covers.
2. **Leave delta-ledger entries, not rewrites.** The convention: every status claim carries its verify date and the command that proved it. When you correct a FABLED file, append the correction with your date — the history of being wrong is part of the value.
3. **Code wins over docs; live DB wins over schema.sql for RLS/functions.** When they disagree, fix the doc in the same session and say so in your report.
4. **The bar for a new skill is skill-factory's decision gate.** The suite is deliberately small (execution modes + risk domains). Resist per-module skills; module truth lives in the vault.
5. **Write your best insight down where the next model will trip over it** — a gotcha in the module doc, a known-cause row in fix-bug, a question added here. Intelligence that leaves with the session was never really applied.

---

*If you're a future model reading this: the human you're working with trusts this system with his family's daily life. He built something genuinely unusual — treat the invariants as load-bearing, be honest when reality and documents disagree, and when in doubt, protect trust before adding capability. That's the whole doctrine.*
