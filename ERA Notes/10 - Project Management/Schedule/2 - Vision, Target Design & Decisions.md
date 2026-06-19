---
created: 2026-05-30
updated: 2026-06-19
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/schedule
---

# Schedule · 2 — Vision, Target Design & Decisions

> **Command Center:** [_index](<_index.md>) · [1 · Feature State & Pains](<1 - Feature State & Pain Inventory.md>) · [2 · Vision & Decisions](<2 - Vision, Target Design & Decisions.md>) · [3 · Type & Capture Design](<3 - Type Taxonomy & Capture Design.md>) · [4 · Recurrence & Occurrence Actions](<4 - Recurrence & Occurrence Actions.md>) · [5 · Execution & Checklist](<5 - Execution Plan & Build Checklist.md>)
>
> **What this file is:** two layers that belong together — **(A) the ambitious vision** (where the module *could* go: internal enhancements + cross-module bridges, with a prioritization matrix and the recommended bets) and **(B) the target design & decisions** (where each pain in [file 1](<1 - Feature State & Pain Inventory.md>) is *heading*, plus the calls already locked). This file is allowed to dream; [file 1](<1 - Feature State & Pain Inventory.md>) is the sober reality, and [file 5](<5 - Execution Plan & Build Checklist.md>) holds the sequencing. Ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).
>
> **Decision legend:** ✅ **Committed** (decided, just needs building / built) · ❓ **Open** (trade-offs captured, choose in [file 5](<5 - Execution Plan & Build Checklist.md>)) · 💭 **Direction** (shape agreed, details later).

---

# Part A — Future Vision & Roadmap

## The strategic thesis

Schedule is the household's **time graph** — every dated obligation (reminders, events, recurring chores, flexible routines, payment due-dates) lives here. Today it is a strong *reactive* surface: you put things in, it shows them back on a calendar. Its untapped value is twofold:

1. **It is the spine ERA should read from.** The proactive assistant's briefings are only as smart as the time graph behind them. Enriching Schedule directly upgrades ERA.
2. **It already touches money, chores, and trips** — but mostly one-directionally. The biggest wins are tightening those connections so a due-date in Schedule and a payment in Budget are the *same fact*.

**The vision in one line:** *Turn Schedule from a calendar you read into a time graph that acts — surfacing the right item, at the right time, with the right context, before you go looking.*

---

## Track A — Internal enhancements (within the module)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| **Finish Prerequisites evaluators** | NFC→item works; `time_window` / `schedule` / `custom_formula` / `weather` are stubs | `time_window` ("show meds 7–9am"), `schedule` ("after gym → log meal"), `custom_formula` — *conditional automation*, rare and powerful | M (per evaluator; `time_window` is S) |
| **Recurrence editor UX** | RRULE built via `CustomRecurrencePicker`; edits of a single occurrence vs the series are subtle | Clear "this / this-and-future / all" choice on every edit & delete, matching calendar-app expectations | M |
| **Bulk occurrence operations** | One-at-a-time complete/postpone/skip | Multi-select across the list/calendar → bulk complete / postpone / reschedule | M |
| **Smarter overdue handling** | Flexible overdue look-back ≤3 periods; fixed items just sit overdue | Roll-forward suggestions ("you missed Tue's workout — slot it Thu?"), and a single overdue triage view | M |
| **Natural-language item entry** | Quick form has smart text parsing | Full NL: "every other Thursday at 7", "remind me 2 days before rent" — parsed into rrule + alert in one line | M |
| **Test the placement rule** | Enforced by convention across 6+ views | One guard test so flexible items can never silently land on the activation day | S |
| **Plan My Day (disrupted-day planner)** | *(IMPLEMENTED 2026-06-16)* `/today` triage page — one-time/recurring/flexible items landing on a day, push off, both-direction prepone for flexible items, ad-hoc tasks, checkpoints, persisted via `day_plans`. *(FIXED 2026-06-16 same day)* save-gated draft model (edit form + Save vs. read-only preview card + Edit/Delete) replaced the original auto-save-per-keystroke header. | Hourly timeline canvas (drag items into time slots) + mood/energy "rest vs productivity" optimizer reading `day_plans.intent` | M (timeline) / M–H (optimizer) |

---

## Track B — Bridges out of Schedule (cross-module)

These connect Schedule to the rest of the household graph. Each ladders up to a track in the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

- **Schedule → Focus / ERA briefing enrichment.** The Focus briefing pulls Schedule items but could pull *the whole week's shape* — recurring due, overdue routines, household-assigned items by person. *(global Track B · briefing enrichment)*
- **Schedule ↔ Budget (due-dated payments).** A recurring payment's due-date and a Schedule reminder are often the same intent — unify them so confirming a payment closes the reminder and vice versa. *(global Track A · Recurring→Budget; Track C · Cashflow Forecast)*
- **Schedule ↔ Notifications (smart timing).** Alerts fire at fixed offsets today. Smart timing + quiet hours (no 2am pings) + a weekly digest instead of daily noise. *(global Track B · weekly digest 7a/7b)*
- **Trips → Schedule cascade.** Trip activation/completion already fires schedule side-effects; make the cascade legible and verifiable from the Schedule side (which items a trip created/closed). *(global Trips row)*
- **Debt → Schedule.** Auto-create a reminder on a debt's collection date. *(global Track A · Debt→Reminder 2e)*

---

## Prioritization matrix

```
  IMPACT
   ▲
H  │  Briefing enrichment (B)        Schedule↔Budget unify (B)
   │  time_window prereq (A)         Natural-language entry (A)
   │  Placement-rule test (A)        Cashflow tie-in (B/global C1)
   ├──────────────────────────────────────────────────────────
M  │  Smart alert timing (B)         Recurrence edit UX (A)
   │  Debt→Schedule (B)              Bulk occurrence ops (A)
   │  Smarter overdue (A)            schedule/custom_formula prereq (A)
   ├──────────────────────────────────────────────────────────
L  │  (—)                            weather prereq (A)
   │                                 Trips cascade visibility (B)
   └──────────────────────────────────────────────────────────►
        LOW EFFORT             MED EFFORT             HIGH EFFORT
```

---

## 🎯 The bets (my recommendation)

If you point the next stretch at Schedule:

1. **Bet 1 — Lock the foundation: placement-rule test + recurrence/occurrence unit tests.** Low effort, kills the highest-risk gaps from [file 1](<1 - Feature State & Pain Inventory.md>). Do this before any enhancement that touches views. *(The recurrence half is now concrete and urgent — see [file 4](<4 - Recurrence & Occurrence Actions.md>).)*
2. **Bet 2 — Ship `time_window` prerequisite.** Smallest of the four stubs, highest demo value (meds/morning windows), and it proves out the conditional-automation engine.
3. **Bet 3 — Schedule → briefing enrichment.** The biggest *felt* upgrade: it makes ERA visibly smarter by reading the full time graph. Ladders straight into the global moat (Track B).

> Resist starting bridges before the foundation tests exist — the recurrence math is exactly where a silent bridge bug would hide.

---

# Part B — Target Design & Decisions

> Where each pain is *heading* — the target end-state, plus the calls already made. **Decisions live here; sequencing lives in [file 5](<5 - Execution Plan & Build Checklist.md>).**

## ✅ Decision 1 — Focus becomes a per-item *mode*, not a page *(IMPLEMENTED 2026-06-06)*

**Call:** Retire the standalone `/focus` page. "Focus" becomes an **action you invoke on any item** that drops you into a focused view of *that* item. Flexible-routine assignment — the only real job the page did — **consolidates into the Week view**, where it already half-lives.

**Why:** The page is dull, redundant, and unused, and it duplicates the Week view's assignment flow ([file 1, Cluster 2](<1 - Feature State & Pain Inventory.md>)). A per-item mode matches how I actually think ("focus on *this*"), not "go to the focus place."

**Target shape (built):**

- Add a **Focus** action on the item surfaces — [ItemDetailModal.tsx](<../../../src/components/items/ItemDetailModal.tsx>) and [ItemActionsSheet.tsx](<../../../src/components/items/ItemActionsSheet.tsx>) — that enters a focus view for the selected item.
- Move flexible-routine assignment fully into [WebWeekView.tsx](<../../../src/components/web/WebWeekView.tsx>) (it already hosts the droppable day slots and the catalogue add-dialog).
- Retire [src/app/focus/page.tsx](<../../../src/app/focus/page.tsx>) and [FocusPage.tsx](<../../../src/components/focus/FocusPage.tsx>) (+ `ScheduleRoutineSheet` / `FlexibleRoutinesPool`).

**Cleanup obligations honored when this shipped (project Hard Rules):**

- **Atlas** (Hard Rule #23): remove/replace the Focus page entry in `ERA Notes/04 - UI & Design/Page & Feature Atlas/`; the `public/atlas/atlas.json` regen hook handles the JSON.
- **Feature Index**: update the **Focus** row in [CLAUDE.md](<../../../CLAUDE.md>) (auto-syncs to `AGENTS.md` / `CODEX.md` / copilot instructions); `pnpm docs:check` validates it against the Feature Map.
- **Routes/icons**: update `ERA Notes/04 - UI & Design/App Routes and Icons.md`.
- Note: `useFocusInsights` (the AI briefing) is **separate** from the Focus *page* — keep it; it feeds Today/ERA, not the retired page.

---

## ✅ Decision 2 — Household co-ownership model: shared = co-editable, reassign both ways *(IMPLEMENTED 2026-06-06)*

**Call:** For an item shared across the household, **any active partner can edit and act on it**, and **responsibility (`responsible_user_id`) is reassignable in both directions with a one-tap "take it back."**

**Why:** [File 1, Cluster 1](<1 - Feature State & Pain Inventory.md>) — the old creator-only edit lock contradicted the action routes (which already allow partner complete/postpone), so the same item had two different permission rules. Unified on the more permissive, household-aware one.

**Target rules (built):**

| Capability | Before | Now |
|---|---|---|
| Complete / postpone / cancel | Creator OR responsible OR active link ✅ | unchanged ✅ |
| **Edit (PATCH)** | ~~Creator only~~ → `canMutateItem()` ✅ | Creator OR responsible OR active link ✅ |
| **Delete** | ~~Creator only~~ → `canMutateItem()` ✅ | Creator OR responsible OR active link ✅ |
| **Reassign to partner** | ~~Via edit form only~~ → one-tap in `ItemActionsSheet` ✅ | One-tap "pass to partner" ✅ |
| **Reclaim ("take it back")** | ~~Not possible~~ → one-tap in `ItemActionsSheet` ✅ | One-tap "take it back" / "make it mine" ✅ |
| **See assigned-out / assigned-to-me** | ~~Implicit~~ → explicit buckets in `/reminders` ✅ | Explicit buckets ✅ |

**Pattern reused (don't reinvent):**

- **Auth shape:** the household-link resolution already in [complete/route.ts:84-104](<../../../src/app/api/items/[id]/complete/route.ts#L84-L104>) is copied into the PATCH/DELETE guard in [src/app/api/items/[id]/route.ts:36](<../../../src/app/api/items/[id]/route.ts#L36>). Same `household_links` `.or(...)` check the [accounts route](<../../../src/app/api/accounts/route.ts>) uses (Hard Rule #13).
- **Reassignment:** the Trips RPCs already flip `responsible_user_id` both ways (`activate_trip` → partner, `complete_trip` → back) in `migrations/schema.sql`. Mirrored for manual pass/reclaim. The picker UI already exists: [ResponsibleUserPicker.tsx](<../../../src/components/items/ResponsibleUserPicker.tsx>).
- **Buckets:** the mine/partner filter on `responsible_user_id` in [StandaloneRemindersPage.tsx](<../../../src/components/reminder/StandaloneRemindersPage.tsx>) was the seam for "assigned out (creator = me, responsible = partner)" and "assigned to me (responsible = me, creator = partner)".

> **Read-path caveat:** *(RESOLVED 2026-06-06)* `get_schedule_bundle` returns `user_id = me OR (partner's AND is_public = true)`. The "Pass to partner" action sets `is_public = true`, so assigned items are always visible to both parties. RPC body captured in `migrations/schema.sql`. Known edge case (parked): a private item assigned to me while `is_public = false` won't surface — assignment picker prevents this state today.

---

## ✅ Decision 3 — Capture the schema drift back into the repo *(IMPLEMENTED 2026-06-06)*

**Call:** Re-export the live Supabase schema — including `get_schedule_bundle`, any other Schedule RPCs, and whatever RLS actually exists — back into `migrations/schema.sql` so the repo stops lying about the read path.

**Why:** `schema.sql` is declared the single source of truth (CLAUDE.md, Database section), but the module's authoritative read RPC and the dated migrations CLAUDE.md cites weren't in it. Every read-side change was half-blind until this was fixed. Low effort, unblocked Decision 2's verification. **Done:** table DDL, `get_schedule_bundle` RPC body, and all RLS policies for items + child tables appended to `migrations/schema.sql`.

---

## 💭 Direction — Surface consolidation (proposed end-state)

Not a hard commit yet (sequenced in [file 5](<5 - Execution Plan & Build Checklist.md>)), but the target each surface should converge toward — **one clear job each**:

| Surface | Target single job |
|---|---|
| **Calendar — Month** | See the shape of the month; tap a day to drill in / add. *(keep)* |
| **Calendar — Week** | The action surface: assign flexible items + Chores to days. **Absorbs Focus.** *(keep + grow)* |
| **Today** | "What's on me today" + overdue + briefing. *(keep)* |
| **Mobile Form** | **Precision** create/edit only — full field control. *(keep, but no longer the quick-capture path — see open question)* |
| **`/reminders` standalone** | ❓ Either becomes the **"assignments + everything still open"** management view (gains the assigned-out/to-me buckets) — giving it a reason to exist — or is folded into Today. *(Largely resolved 2026-06-17: merged with Plan My Day into `WebDayPlanner`; the precise residual role is [file 5 W9/5.1](<5 - Execution Plan & Build Checklist.md>).)* |
| **Focus page** | ❌ Retired (Decision 1). |
| **Stats** | ⚪ Parked — untouched this campaign. |

---

## ❓→✅ Open question (now decided) — the low-friction capture path

The habit-killer ([file 1, Cluster 3](<1 - Feature State & Pain Inventory.md>)). Two directions were documented; **the 2026-06-06 decision was *both lanes*** (see [file 3 §0](<3 - Type Taxonomy & Capture Design.md>)). The original trade-off table is kept for the record:

| | **A — Hub Chat quick-capture** | **B — Strip the Mobile Form** |
|---|---|---|
| **Idea** | Route everyday "remind me / add task" through Hub Chat; reserve the Mobile Form for precision. | Keep the form as the capture path but make it lightning-fast (fewer required fields, smart defaults, instant save). |
| **Fits CLAUDE.md?** | **Strongly** — CLAUDE.md says the Hub is the top-layer primary interface and forms are precision tools. This is the documented intent. | Neutral — keeps a known surface. |
| **Pro** | No new surface to learn; conversational = lowest friction; AI can parse one line into a full item. | Familiar; full structure available when wanted; no NLP parsing risk. |
| **Con** | Leans on Hub message-action parsing being reliable; Hub is a Junction (cross-module care). | Form will always be heavier than a chat line; risk of stripping a field someone needs. |
| **Effort** | M (wire item-create into Hub message actions) | S–M (UI rework) |

> **Decision (2026-06-06): both** — B (the form) as the precision tool with a quick-capture NL box on it (rule-based parser), **and** A (Hub Chat) as the conversational fast lane (Gemini). Detail + engine split in [file 3](<3 - Type Taxonomy & Capture Design.md>).

---

→ The crisp type model + form blueprint these decisions rest on → [3 · Type Taxonomy & Capture Design](<3 - Type Taxonomy & Capture Design.md>).
→ Turn these into ranked, checkbox steps and pick this week's slice → [5 · Execution Plan & Build Checklist](<5 - Execution Plan & Build Checklist.md>).
