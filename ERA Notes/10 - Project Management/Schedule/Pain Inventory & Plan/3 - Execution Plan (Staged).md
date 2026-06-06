---
created: 2026-05-30
status: active
owner: Elio
type: action-plan
tags:
  - pm/action
  - scope/module
  - module/schedule
---

# Schedule · 3 — Execution Plan (Staged)

> **Command Center:** [_index](<_index.md>) · [1 · Pain Inventory](<1 - Pain Inventory (Every Painful Thing).md>) · [2 · Target Design](<2 - Target Design & Decisions.md>) · [3 · Execution Plan](<3 - Execution Plan (Staged).md>) · [4 · Type Taxonomy & Form](<4 - Type Taxonomy & Mobile Form Refactor.md>)
>
> **What this file is:** the **step-by-step guide** I run from. A living queue (Now / Next / Later), **not** a fixed Mon–Fri grid. Re-order as priorities move; promote an item to "Now" when I pick it up.

---

## 📌 The call

**The pain is mapped ([file 1](<1 - Pain Inventory (Every Painful Thing).md>)). The directions are set ([file 2](<2 - Target Design & Decisions.md>)). Now pick this week's slice.**

**Recommended (not forced) first slice: Household co-edit + reassign.** It's the highest-severity pain (two 🔴s), the most **bounded** (a few route files + one picker reuse, no RLS redesign — there's no RLS to redesign), and there's a **proven pattern to copy** (Trips reassignment RPCs). It also gives the fastest felt relief: the "RLS errors" stop the day the auth check is aligned.

If energy says otherwise, the capture decision (Cluster 3) is the higher *habit* lever — but it's fuzzier and needs the A-vs-B call first.

---

## 🎯 Candidate work *(every pain from [file 1](<1 - Pain Inventory (Every Painful Thing).md>), as work items)*

| # | Work item | From | Sev | Effort | Bounded? | Foundational? |
|---|---|---|---|---|---|---|
| ~~W1~~ ✅ | ~~Align PATCH/DELETE auth with household-aware check~~ | C1 | 🔴 | S | ✅ yes | — |
| ~~W2~~ ✅ | ~~"Pass to partner" / "take it back" reassign actions~~ | C1 | 🔴 | M | ✅ yes | — |
| ~~W3~~ ✅ | ~~"Assigned out" / "assigned to me" buckets in `/reminders`~~ | C1 | 🟠 | S–M | ✅ yes | — |
| ~~W4~~ ✅ | ~~Confirm RLS-off + `get_schedule_bundle` returns partner items~~ | C1/C4 | 🟠 | S | ✅ yes | ✅ unblocks W1–W3 |
| ~~W5~~ ✅ | ~~Re-export live schema (RPC + RLS) into `schema.sql`~~ | C4 | 🟠 | S | ✅ yes | ✅ stops repo lying |
| W6 | Decide capture path (A Hub / B form / both) → build it | C3 | 🟠 | M | partly | — |
| ~~W7~~ ✅ | ~~Focus → per-item mode; retire `/focus`; fold into Week view~~ | C2 | 🟠 | M–H | partly | — |
| W8 | Reassignment history / audit | C1 | 🟡 | M | ✅ yes | — |
| W9 | Surface consolidation (`/reminders` role; clarify each job) | C2 | 🟠 | M | partly | — |
| — | Recurrence/placement tests, prerequisites, `useItems` split | C4 | — | — | — | see parent [file 3](<../3 - Current — Action Plan.md>) |

> Foundational test/prerequisite work is **owned by the parent** [Schedule · 3 — Current Action Plan](<../3 - Current — Action Plan.md>) — don't fork it here. This campaign is the overhaul layered on top.

---

## 🗓️ Sequenced plan

### Now — Household co-edit + reassign *(the recommended first slice)*

**This is the step-by-step guide. Each step ends with a check.**

- [x] **Step 1 — Verify the ground truth (W4).** *(DONE 2026-06-06)* RPC body captured: returns `user_id = me OR (partner's AND is_public = true)`. W1 alone was enough — RLS policies already grant household co-edit. See Pain Inventory Cluster 1 myth correction.
- [x] **Step 2 — Align write auth (W1).** *(DONE 2026-05-31)* `canMutateItem()` helper in [src/app/api/items/[id]/route.ts](<../../../../src/app/api/items/[id]/route.ts>) — creator OR responsible OR active partner. Partner can edit/delete shared items; strangers still get 403.
- [x] **Step 3 — Reassign both ways (W2).** *(DONE 2026-06-06)* Added `onReassign` prop to [ItemActionsSheet.tsx](<../../../../src/components/items/ItemActionsSheet.tsx>). Component fetches household via `useHouseholdMembers`, shows "Pass to partner" when I'm responsible, "Take it back" when partner is responsible. Wired in `StandaloneRemindersPage` using `useUpdateItem` + Undo toast (no dedicated endpoint — RLS already covers it).
  *Check:* assign → it appears under partner; "take it back" → returns to me; both with Undo toasts. ✅
- [x] **Step 4 — Make handed-off items findable (W3).** *(DONE 2026-06-06)* Added "Assigned to me" and "Assigned out" collapsible sections to [StandaloneRemindersPage.tsx](<../../../../src/components/reminder/StandaloneRemindersPage.tsx>). Each row has one-tap "Return →" / "← Reclaim" buttons calling `handleReassign`. Sections appear only when items exist.
  *Check:* an item assigned out is visible and reclaimable from this view. ✅
- [x] **Step 5 — Stop the repo lying (W5).** *(DONE 2026-06-06)* Table DDL ("Copy as SQL" from Supabase), `get_schedule_bundle` RPC body, and all RLS policies for items + child tables appended to [migrations/schema.sql](<../../../../migrations/schema.sql>).

### Next — pick ONE

- [ ] **Capture path (W6).** Make the A-vs-B call from [file 2's open question](<2 - Target Design & Decisions.md>) (leaning A = Hub quick-capture, possibly A+B). Then build the chosen fast lane. **Highest habit payoff.**
- [x] **Focus → mode (W7).** *(DONE 2026-06-06)* Retired `/focus` page + `FocusPage.tsx` + `FlexibleRoutinesPool.tsx` + `ScheduleRoutineSheet.tsx`. Added `onFocus` prop + Focus button (crosshair icon) to `ItemActionsSheet` → opens `ItemDetailModal` in `StandaloneRemindersPage` and `ItemsListView`. Week view's "Flexible this week" strip already handles routine assignment. Atlas, Feature Index, Routes doc, vault doc all updated.

### Later

- [ ] Reassignment history/audit (W8).
- [ ] Surface consolidation — settle the `/reminders` role; give each surface one job (W9).
- [ ] Carry the recurrence/placement tests + prerequisites from the parent [file 3](<../3 - Current — Action Plan.md>) (foundational; not duplicated here).

---

## ✅ Definition of done — the "Now" slice

- [x] A household partner can **edit and delete** a shared item (no more creator-only 403). *(2026-05-31)*
- [x] I can **pass an item to my partner** and **take it back**, each in one tap, with Undo. *(2026-06-06)*
- [x] Items I've assigned out are **visible and reclaimable** from `/reminders`. *(2026-06-06)*
- [x] `get_schedule_bundle` RPC body + all RLS policies **captured in `migrations/schema.sql`**. *(2026-06-06)*
- [x] [File 1, Cluster 1](<1 - Pain Inventory (Every Painful Thing).md>) updated to mark the resolved pains; the "RLS myth" note kept as the corrected record. *(2026-06-06)*

---

## 🚫 Not now

- ❌ **Stats redesign** — parked; zero current payoff.
- ❌ **Refactor `useItems.ts` "just because"** — only split when a feature next forces you in (parent file 1 rule).
- ❌ **`weather` prerequisite** — lowest value-for-effort of the four evaluators (parent file 3).
- ❌ **Don't redesign the calendar views** — Month/Week/Today are the parts that *work*; touch only the Focus-fold (W7).

---

## ⏭️ Later / backlog

- Reassignment audit trail + "who had it when" timeline.
- Capture path B as a fallback even if A ships first.
- `/reminders` → unified assignments + open-items management view.
- Recurrence + occurrence-action unit tests, placement-rule guard test, `time_window` prerequisite — **see parent** [Schedule · 3](<../3 - Current — Action Plan.md>).
- Natural-language item entry (one line → full item) — pairs naturally with capture path A.
