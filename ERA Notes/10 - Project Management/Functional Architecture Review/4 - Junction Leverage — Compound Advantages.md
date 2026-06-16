---
created: 2026-06-12
type: review
status: living
owner: Elio
tags:
  - pm/far
  - scope/cross-cutting
---

# FAR 4 · Junction Leverage — Compound Advantages

> **FAR:** [_index](<_index.md>) · [1 · North Star](<1 - North Star — The Goal Revisited.md>) · [2 · Strengths](<2 - Where the App Stands Strong.md>) · [3 · Enhancements](<3 - Enhancement Map — Sharpen What Exists.md>) · **4 · Junctions** · [5 · Missed](<5 - Missed & Forgotten — The Blind Spots.md>) · [6 · Market & Challenges](<6 - Market Lens & Challenge Letter.md>) · [7 · Synthesis](<7 - Synthesis — The 90-Day Path.md>)
>
> **The thesis:** your junctions are not connectors — they are **general-purpose engines wearing costumes**. Each entry reframes one junction as the bigger thing it secretly is, because the cheapest way to get new capability is to *promote what's built*, not build anew. Standalones give features; **junctions give compound interest.** IDs `J1–J10`.

---

## J1 — Prerequisites is an **Automation Engine** in disguise ⭐⭐

**Today:** a trigger engine evaluating conditions to flip items dormant→pending — used by exactly one consumer (NFC checklist unlock), with 4 evaluators stubbed (`time_window`, `schedule`, `weather`, `custom_formula`).

**The reframe:** *trigger + condition + action over the household graph* is the literal definition of an automation platform — the household IFTTT. The L4 layer ([FAR 1 §3](<1 - North Star — The Goal Revisited.md>)) does not need a new system; it needs **this one, promoted**:

- Evaluators = the condition vocabulary (`custom_formula` over balances *is* "alert me if checking < $500")
- Triggers = time windows, data changes (new transaction, stock decrement), NFC taps, mode switches (J2)
- Actions = today "unlock item"; add "emit signal" (→ briefing), "create proposal" (→ Action Inbox R3), "send notification" (→ J5 policy)

**Play:** ship `time_window` first (Schedule folder already bets this), then `custom_formula` *as the alert-rules backend*. Don't ever build a separate "rules engine" — you already own one.

## J2 — Trips is a **Modes Engine** in disguise ⭐

**Today:** the most ambitious junction — context-switch with reversible cascades (`trip_side_effects` ledger: pause chores, skip meals, create budget, restore on return).

**The reframe:** "travelling" is just one household state. The same *pause / adapt / restore, with a ledger* semantics serves: **Guest mode** (in-laws staying: chores reassigned, meal plans scaled, guest portal auto-armed), **Sick mode** (routines paused, meds window on, delivery-food budget unlocked), **Crunch week** (low-priority items snoozed, briefings terser), **Power-cut mode** (very Lebanese: generator-hours chores, fridge-inventory caution). 

**Play:** *after* the cascades are verified (Trips Bet 1 — non-negotiable precondition), extract `trip_side_effects` → `mode_side_effects` and let a "mode" own cascade rules. Trips becomes the first mode; every later mode costs a config, not a module.

## J3 — Hub Chat is the **proactive surface**, not just the input box

**Today:** input-first — you type/speak, it acts. The feed (`hub_feed`) already *defines* `budget_alert`, `milestone`, `streak` activity types in its schema, mostly unexploited.

**The reframe:** the Hub is where ERA *speaks first*. The morning brief is a card in a thread; an anomaly ping is an ERA message with action buttons; the Action Inbox badge lives on the Hub. Proactivity delivered **inside the surface you already open** is half as annoying and twice as actionable as a bare push.

**Play:** route L3/L4 outputs through hub threads + feed first, push second (per J5 policy). Precondition: the `HubPage.tsx` decomposition (FABLED [G2](<../Hub & ERA/FABLED/2 - FABLED — Gaps & Missing.md>)) — do it *as part of* landing briefing cards, as Hub & ERA Bet 3 already suggests.

## J4 — Message Actions is the **universal Act rail**

**Today:** message → transaction/reminder/item. **The reframe:** the *confirm-before-commit in a chat bubble* pattern (designed for expense-split E2) is exactly the approval UX of the Action Inbox (R3). One pattern, every consumer: ERA proposals, automation proposals, partner requests, guest requests (Track D 10).

**Play:** when building E2, design the confirmation card as a *generic proposal card* from day one — type, payload preview, accept/edit/reject, provenance (R8).

## J5 — Notifications is a **Delivery Policy engine** waiting for policy

**Today:** capable pipe (push + in-app, snooze/dismiss/actions, health checks, `push_event_logs`) with zero judgment — no quiet hours, no batching, no priority classes, no budget.

**The reframe:** ERA's perceived intelligence will be judged *mostly here*. The same insight delivered at the right moment = magic; at 2am = uninstall. Policy is the moat-feature nobody sees.

**Play:** quiet hours + notification budget (max N/day, digest the rest) + priority classes (interrupt / batch / feed-only) + the engagement loop (R5.2). Existing backlog 7a/7b covers a third of this; the budget and priority classes are new.

## J6 — Household Sharing is **audience targeting**

**Today:** shared data + person-absolute color identity. **The reframe:** a proactive assistant must answer *"who should hear this?"* — chore signals to the assignee, budget alerts to both, "Racha's day" differs from yours. The graph already knows assignment (`assigned_to`, person-absolute identity); no briefing logic uses it yet.

**Play:** make `audience` a required field on signals (R2). Later: roles beyond the pair (kids, helpers) — but that's a [FAR 6 · C3](<6 - Market Lens & Challenge Letter.md>) decision, not a default.

## J7 — Sync & Offline is the **resilience rail for proactivity**

Proposals must queue offline; briefings must cache; a failed push must degrade to feed. You already own the queue, the connectivity truth (`isReallyOnline`), and the engine. **Play:** route Action-Inbox accepts through the existing offline queue from day one — don't let the new layer reinvent fetch.

## J8 — Shopping List is the **first proposal producer**

Inventory low-stock → auto-add (2a) is everyone's named keystone. **The reframe:** make it the *pilot* of the proposal pattern (R3) rather than a bespoke auto-add — first life in the Action Inbox, proving accept/undo/provenance end-to-end on the lowest-stakes domain (groceries, not money).

## J9 — NFC is the **physical trigger layer**

**Today:** slug tags, checklists, history. **The reframe:** a tap is a *context token* — identity + location + moment in one gesture, no GPS needed (PWA can't geofence; NFC sidesteps it). Pantry tag = restock mode; car tag = fuel expense shortcut (existing gap 6); door tag = "arriving home" → triggers (J1) fire.

**Play:** add "emit trigger event" to tap handling — one column and a dispatch — and NFC becomes an input to the automation engine, not just a checklist opener.

## J10 — AI Assistant: from feature to **substrate**

**Today:** faces + hand-routed intents + per-face resolvers/formatters. **The reframe & the challenge:** hand-coded intent routing scales *linearly with your typing* — every new capability = new intent + resolver + formatter (FABLED E-series assumes this forever). The industry's answer is **tool-calling**: expose module operations as typed tools; the model composes them for the long tail ("move my Thursday workout to Friday and log $20 lunch" — two modules, zero new intents).

**Play (hybrid, not rewrite):** keep the deterministic router for the hot ~20 intents (fast, cheap, predictable, testable) and add a tool-calling fallback for unmatched utterances, behind the same confirm-pattern (J4). Your Zod schemas (Hard Rule 12) are 80% of the tool definitions already. Details in [FAR 6 · C4](<6 - Market Lens & Challenge Letter.md>).

---

## Junction utilization scorecard

| Junction | Built | Leveraged today | The unlock | Rides |
|---|---|---|---|---|
| Prerequisites | 60% (4 stubs) | **~10%** — one consumer | Automation engine (L4) | J1 ⭐ |
| Trips | 85% (unverified) | ~40% — travel only | Modes engine | J2 ⭐ |
| Hub Chat | 90% | ~50% — input only | Proactive surface | J3 |
| Message Actions | 80% | ~60% | Universal approval rail | J4 |
| Notifications | 75% | ~40% — no policy | Delivery policy + learning | J5 |
| Household | 90% | ~70% — no audience logic | Per-person proactivity | J6 |
| Sync & Offline | 90% | ~80% | Carry the new layer | J7 |
| Shopping List | 85% | ~60% | Proposal pilot | J8 |
| NFC | 80% | ~30% — checklists | Physical triggers | J9 |
| AI Assistant | 70% | ~50% — reactive only | Substrate (hybrid routing) | J10 |

> **The compound play:** J1 × J5 × J4 = *automations that propose politely*. J2 × J6 = *a household that adapts per person*. J3 × J10 = *an assistant that speaks first in its own home*. No single standalone module buys any of this.

→ Sequencing in [FAR 7](<7 - Synthesis — The 90-Day Path.md>).
