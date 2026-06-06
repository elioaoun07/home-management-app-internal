---
created: 2026-05-30
status: living
owner: Elio
type: roadmap
tags:
  - pm/roadmap
  - scope/module
  - module/schedule
---

# Schedule · 2 — Target Design & Decisions

> **Command Center:** [_index](<_index.md>) · [1 · Pain Inventory](<1 - Pain Inventory (Every Painful Thing).md>) · [2 · Target Design](<2 - Target Design & Decisions.md>) · [3 · Execution Plan](<3 - Execution Plan (Staged).md>) · [4 · Type Taxonomy & Form](<4 - Type Taxonomy & Mobile Form Refactor.md>)
>
> **What this file is:** where each pain in [file 1](<1 - Pain Inventory (Every Painful Thing).md>) is *heading* — the target end-state, plus the calls already made. **Decisions live here; sequencing lives in [file 3](<3 - Execution Plan (Staged).md>).**
>
> **Decision legend:** ✅ **Committed** (decided, just needs building) · ❓ **Open** (trade-offs captured, choose in file 3) · 💭 **Direction** (shape agreed, details later).

---

## ✅ Decision 1 — Focus becomes a per-item *mode*, not a page

**Call:** Retire the standalone `/focus` page. "Focus" becomes an **action you invoke on any item** that drops you into a focused view of *that* item. Flexible-routine assignment — the only real job the page did — **consolidates into the Week view**, where it already half-lives.

**Why:** The page is dull, redundant, and unused, and it duplicates the Week view's assignment flow ([file 1, Cluster 2](<1 - Pain Inventory (Every Painful Thing).md>)). A per-item mode matches how I actually think ("focus on *this*"), not "go to the focus place."

**Target shape:**

- Add a **Focus** action on the item surfaces — [ItemDetailModal.tsx](<../../../../src/components/items/ItemDetailModal.tsx>) and [ItemActionsSheet.tsx](<../../../../src/components/items/ItemActionsSheet.tsx>) — that enters a focus view for the selected item.
- Move flexible-routine assignment fully into [WebWeekView.tsx](<../../../../src/components/web/WebWeekView.tsx>) (it already hosts the droppable day slots and the catalogue add-dialog).
- Retire [src/app/focus/page.tsx](<../../../../src/app/focus/page.tsx>) and [FocusPage.tsx](<../../../../src/components/focus/FocusPage.tsx>) (+ `ScheduleRoutineSheet` / `FlexibleRoutinesPool` if they have no other home).

**Cleanup obligations when this is built (don't forget — these are project Hard Rules):**

- **Atlas** (Hard Rule #23): remove/replace the Focus page entry in `ERA Notes/04 - UI & Design/Page & Feature Atlas/`; the `public/atlas/atlas.json` regen hook handles the JSON.
- **Feature Index**: update the **Focus** row in [CLAUDE.md](<../../../../CLAUDE.md>) (auto-syncs to `AGENTS.md` / `CODEX.md` / copilot instructions); `pnpm docs:check` validates it against the Feature Map.
- **Routes/icons**: update `ERA Notes/04 - UI & Design/App Routes and Icons.md`.
- Note: `useFocusInsights` (the AI briefing) is **separate** from the Focus *page* — keep it; it feeds Today/ERA, not the retired page.

---

## ✅ Decision 2 — Household co-ownership model: shared = co-editable, reassign both ways

**Call:** For an item shared across the household, **any active partner can edit and act on it**, and **responsibility (`responsible_user_id`) is reassignable in both directions with a one-tap "take it back."**

**Why:** [File 1, Cluster 1](<1 - Pain Inventory (Every Painful Thing).md>) — the current creator-only edit lock contradicts the action routes (which already allow partner complete/postpone), so the same item has two different permission rules. Unify on the more permissive, household-aware one.

**Target rules:**

| Capability | Today | Target |
|---|---|---|
| Complete / postpone / cancel | Creator OR responsible OR active link ✅ | unchanged |
| **Edit (PATCH)** | Creator only ❌ | Creator OR responsible OR active link |
| **Delete** | Creator only ❌ | Creator OR responsible OR active link |
| **Reassign to partner** | Via edit form only (and edit is locked) | One-tap "pass to partner" |
| **Reclaim ("take it back")** | Not possible | One-tap "take it back" / "make it mine" |
| **See assigned-out / assigned-to-me** | Implicit via mine/partner filter | Explicit buckets |

**Pattern to reuse (don't invent):**

- **Auth shape:** copy the household-link resolution already in [complete/route.ts:84-104](<../../../../src/app/api/items/[id]/complete/route.ts#L84-L104>) into the PATCH/DELETE guard in [src/app/api/items/[id]/route.ts:36](<../../../../src/app/api/items/[id]/route.ts#L36>). Same `household_links` `.or(...)` check the [accounts route](<../../../../src/app/api/accounts/route.ts>) uses (Hard Rule #13).
- **Reassignment:** the Trips RPCs already flip `responsible_user_id` both ways (`activate_trip` → partner, `complete_trip` → back) in `migrations/schema.sql`. Mirror that for manual pass/reclaim. The picker UI already exists: [ResponsibleUserPicker.tsx](<../../../../src/components/items/ResponsibleUserPicker.tsx>).
- **Buckets:** the mine/partner filter on `responsible_user_id` in [StandaloneRemindersPage.tsx](<../../../../src/components/reminder/StandaloneRemindersPage.tsx>) is the seam to add "assigned out (creator = me, responsible = partner)" and "assigned to me (responsible = me, creator = partner)".

> **Read-path caveat:** before trusting any of this, confirm the `get_schedule_bundle` RPC actually *returns* partner items (it's not in the repo — [file 1, Cluster 4](<1 - Pain Inventory (Every Painful Thing).md>)). If reads are creator-scoped, write-auth fixes alone won't make shared items visible. This is step 1 in [file 3](<3 - Execution Plan (Staged).md>).

---

## ✅ Decision 3 — Capture the schema drift back into the repo

**Call:** Re-export the live Supabase schema — including `get_schedule_bundle`, any other Schedule RPCs, and whatever RLS actually exists — back into `migrations/schema.sql` so the repo stops lying about the read path.

**Why:** `schema.sql` is declared the single source of truth (CLAUDE.md, Database section), but the module's authoritative read RPC and the dated migrations CLAUDE.md cites aren't in it. Every read-side change is half-blind until this is fixed. Low effort, unblocks Decision 2's verification.

---

## 💭 Direction — Surface consolidation (proposed end-state)

Not a hard commit yet (sequenced in file 3), but the target each surface should converge toward — **one clear job each**:

| Surface | Target single job |
|---|---|
| **Calendar — Month** | See the shape of the month; tap a day to drill in / add. *(keep)* |
| **Calendar — Week** | The action surface: assign flexible items + Chores to days. **Absorbs Focus.** *(keep + grow)* |
| **Today** | "What's on me today" + overdue + briefing. *(keep)* |
| **Mobile Form** | **Precision** create/edit only — full field control. *(keep, but no longer the quick-capture path — see open question)* |
| **`/reminders` standalone** | ❓ Either becomes the **"assignments + everything still open"** management view (gains the assigned-out/to-me buckets) — giving it a reason to exist — or is folded into Today. Decide in file 3. |
| **Focus page** | ❌ Retired (Decision 1). |
| **Stats** | ⚪ Parked — untouched this campaign. |

---

## ❓ Open question — the low-friction capture path

The habit-killer ([file 1, Cluster 3](<1 - Pain Inventory (Every Painful Thing).md>)). Two directions, **documented, not chosen** — pick in [file 3](<3 - Execution Plan (Staged).md>):

| | **A — Hub Chat quick-capture** | **B — Strip the Mobile Form** |
|---|---|---|
| **Idea** | Route everyday "remind me / add task" through Hub Chat; reserve the Mobile Form for precision. | Keep the form as the capture path but make it lightning-fast (fewer required fields, smart defaults, instant save). |
| **Fits CLAUDE.md?** | **Strongly** — CLAUDE.md says the Hub is the top-layer primary interface and forms are precision tools. This is the documented intent. | Neutral — keeps a known surface. |
| **Pro** | No new surface to learn; conversational = lowest friction; AI can parse one line into a full item. | Familiar; full structure available when wanted; no NLP parsing risk. |
| **Con** | Leans on Hub message-action parsing being reliable; Hub is a Junction (cross-module care). | Form will always be heavier than a chat line; risk of stripping a field someone needs. |
| **Effort** | M (wire item-create into Hub message actions) | S–M (UI rework of `MobileItemForm`) |

> Leaning A (matches documented intent), but it's an explicit choice for file 3 — possibly **both**: A as the default fast lane, B as the precision fallback.

---

→ Turn these into ranked, checkbox steps and pick this week's slice → [3 · Execution Plan (Staged)](<3 - Execution Plan (Staged).md>).
