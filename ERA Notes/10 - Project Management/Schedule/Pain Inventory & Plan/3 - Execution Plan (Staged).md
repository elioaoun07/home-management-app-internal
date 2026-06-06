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
| W1 | Align PATCH/DELETE auth with household-aware check | C1 | 🔴 | S | ✅ yes | — |
| W2 | "Pass to partner" / "take it back" reassign actions | C1 | 🔴 | M | ✅ yes | — |
| W3 | "Assigned out" / "assigned to me" buckets in `/reminders` | C1 | 🟠 | S–M | ✅ yes | — |
| W4 | Confirm RLS-off + `get_schedule_bundle` returns partner items | C1/C4 | 🟠 | S | ✅ yes | ✅ unblocks W1–W3 |
| W5 | Re-export live schema (RPC + RLS) into `schema.sql` | C4 | 🟠 | S | ✅ yes | ✅ stops repo lying |
| W6 | Decide capture path (A Hub / B form / both) → build it | C3 | 🟠 | M | partly | — |
| W7 | Focus → per-item mode; retire `/focus`; fold into Week view | C2 | 🟠 | M–H | partly | — |
| W8 | Reassignment history / audit | C1 | 🟡 | M | ✅ yes | — |
| W9 | Surface consolidation (`/reminders` role; clarify each job) | C2 | 🟠 | M | partly | — |
| — | Recurrence/placement tests, prerequisites, `useItems` split | C4 | — | — | — | see parent [file 3](<../3 - Current — Action Plan.md>) |

> Foundational test/prerequisite work is **owned by the parent** [Schedule · 3 — Current Action Plan](<../3 - Current — Action Plan.md>) — don't fork it here. This campaign is the overhaul layered on top.

---

## 🗓️ Sequenced plan

### Now — Household co-edit + reassign *(the recommended first slice)*

**This is the step-by-step guide. Each step ends with a check.**

- [ ] **Step 1 — Verify the ground truth (W4).** In Supabase: (a) confirm no RLS is enabled on `items` + child tables (matches the repo read); (b) open `get_schedule_bundle` and confirm whether it returns items where the *partner* is creator/responsible, or only the caller's. **This decides whether W1 alone is enough or whether the RPC also needs widening.**
  *Check:* you can state, in one sentence, what the RPC returns for a shared item.
- [ ] **Step 2 — Align write auth (W1).** In [src/app/api/items/[id]/route.ts](<../../../../src/app/api/items/[id]/route.ts>), replace the creator-only guard at line 36 (and the delete branch) with the household-aware check copied from [complete/route.ts:84-104](<../../../../src/app/api/items/[id]/complete/route.ts#L84-L104>): allow if **creator OR responsible OR active `household_links` partner**. Use `supabaseAdmin()` for the link lookup as the action route does.
  *Check:* partner can edit a shared item; a true stranger still gets 403. Toast has Undo (Hard Rule #1).
- [ ] **Step 3 — Reassign both ways (W2).** Add "Pass to partner" and "Take it back / Make it mine" quick actions on [ItemActionsSheet.tsx](<../../../../src/components/items/ItemActionsSheet.tsx>) (and/or detail). Reuse [ResponsibleUserPicker.tsx](<../../../../src/components/items/ResponsibleUserPicker.tsx>). **Decision inside the step:** reuse `useUpdateItem` (simplest, now that W1 unlocks edit) vs. a dedicated `/api/items/[id]/reassign` endpoint (cleaner for notifications + future audit). Mirror the Trips `responsible_user_id` flip pattern. Fire the existing assignment notification.
  *Check:* assign → it appears under partner; "take it back" → returns to me; both with Undo toasts.
- [ ] **Step 4 — Make handed-off items findable (W3).** In [StandaloneRemindersPage.tsx](<../../../../src/components/reminder/StandaloneRemindersPage.tsx>), add buckets/filters: **"Assigned to me"** (`responsible = me`, creator = partner) and **"Assigned out"** (creator = me, `responsible = partner`), using the existing `responsible_user_id` filter seam.
  *Check:* an item I assigned out is visible to me again and reclaimable from this view.
- [ ] **Step 5 — Stop the repo lying (W5).** Export the live schema (incl. `get_schedule_bundle`, any RLS touched/confirmed in Step 1) back into [migrations/schema.sql](<../../../../migrations/schema.sql>).
  *Check:* `get_schedule_bundle` body is in the repo and matches Supabase.

### Next — pick ONE

- [ ] **Capture path (W6).** Make the A-vs-B call from [file 2's open question](<2 - Target Design & Decisions.md>) (leaning A = Hub quick-capture, possibly A+B). Then build the chosen fast lane. **Highest habit payoff.**
- [ ] **Focus → mode (W7).** Build the per-item Focus action, fold flexible assignment into the Week view, retire `/focus`, and do the Atlas + Feature-Index + Routes cleanup ([file 2, Decision 1](<2 - Target Design & Decisions.md>)).

### Later

- [ ] Reassignment history/audit (W8).
- [ ] Surface consolidation — settle the `/reminders` role; give each surface one job (W9).
- [ ] Carry the recurrence/placement tests + prerequisites from the parent [file 3](<../3 - Current — Action Plan.md>) (foundational; not duplicated here).

---

## ✅ Definition of done — the "Now" slice

- [ ] A household partner can **edit and delete** a shared item (no more creator-only 403).
- [ ] I can **pass an item to my partner** and **take it back**, each in one tap, with Undo.
- [ ] Items I've assigned out are **visible and reclaimable** from `/reminders`.
- [ ] `get_schedule_bundle` (and any real RLS) is **captured in `migrations/schema.sql`**.
- [ ] [File 1, Cluster 1](<1 - Pain Inventory (Every Painful Thing).md>) updated to mark the resolved pains; the "RLS myth" note kept as the corrected record.

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
