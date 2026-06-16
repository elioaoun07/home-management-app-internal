---
created: 2026-05-30
status: living
owner: Elio
type: status
tags:
  - pm/status
  - scope/module
  - module/schedule
---

# Schedule · 1 — Pain Inventory (Every Painful Thing)

> **Command Center:** [_index](<_index.md>) · [1 · Pain Inventory](<1 - Pain Inventory (Every Painful Thing).md>) · [2 · Target Design](<2 - Target Design & Decisions.md>) · [3 · Execution Plan](<3 - Execution Plan (Staged).md>) · [4 · Type Taxonomy & Form](<4 - Type Taxonomy & Mobile Form Refactor.md>) · [5 · My Plan Reconciliation](<5 - My Plan Reconciliation & Harmonized Scope.md>) · [6 · Master Checklist](<6 - Master Build Checklist.md>)
>
> **What this file is:** every painful thing about Schedule, written down so the scope is *visible* — not fixed yet. Each pain is `Pain → Why it hurts → Root cause → Evidence → Severity`. **No solutions here** (that's file 2) and **no sequencing** (that's file 3). This is the terrain.
>
> **Method & confidence:** technical claims are traced to real files/lines from a codebase read on 2026-05-30. Where a claim couldn't be confirmed from code alone (anything that lives only in the live Supabase DB), it's marked **⚠️ confirm in Supabase** rather than asserted.

---

## Severity scale

| Mark | Meaning |
|---|---|
| 🔴 **Blocker** | Stops a core flow or causes a hard error. Fix first. |
| 🟠 **Friction** | Works, but the daily cost is high enough to kill the habit. |
| 🟡 **Annoyance** | Noticeable, livable, fix when convenient. |
| ⚪ **Cosmetic / parked** | Minor, or deliberately out of scope for this campaign. |

---

## Cluster 1 — Household co-ownership & reassignment *(technical)*

> This is the cluster that produces the "RLS errors most of the time" feeling and the "I can't get an item back after I assign it" frustration. **First, the myth-bust** — because it narrows the whole fix.

### 🧨 The "RLS errors" are app-level, not RLS — but RLS *is* enabled (myth corrected 2026-05-31)

> **Correction (verified against live Supabase, 2026-05-31 — see `migrations/_verify_schedule_rls.md`):** the original claim below was **wrong**. RLS *is* enabled on `items` and every child table; the repo's `schema.sql` was stale because the Supabase visualizer export captures tables only, not policies or function bodies. More importantly, the live RLS policies (`items_update`, `items_delete`) **already grant household co-edit** — `user_id = me OR responsible_user_id = me OR (is_public = true AND active partner)`. The DB was never the blocker.
>
> **The real cause of the 403:** the PATCH/DELETE route ([items/[id]/route.ts](<../../../../src/app/api/items/[id]/route.ts>)) ran its *own* creator-only check in app code — **stricter than the RLS policy underneath it** — and rejected the partner before the (already-correct) policy could allow it. Fixed 2026-05-31 by aligning that app-level guard to the policy via a shared `canMutateItem()` helper. ✅
>
> **Residual drift (not yet addressed):** (a) duplicate policy generations coexist per table (old creator-only + new household) — harmless because RLS OR-combines, but a future-cleanup footgun; (b) `get_schedule_bundle` returns `mine OR (partner's AND is_public)` and does **not** surface items where I'm `responsible` but the partner is creator and `is_public=false` — a read/write-policy mismatch that only bites if an item is assigned out while private (the picker prevents this today). Both parked deliberately.

---

**~~Original claim (preserved as the corrected record — do not trust):~~** *There is no row-level security on the Schedule tables at all. A full read of `migrations/schema.sql` shows no `ENABLE ROW LEVEL SECURITY`...* — this was an artifact of the stale `schema.sql`, not the live DB.

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| ✅ **~~Partner can't edit a shared item → 403~~** *(FIXED 2026-05-31)* | The whole point of a household is shared items. If only the creator can edit, the partner is locked out of the item they're responsible for. | `PATCH` allowed only the **creator** in app code — *stricter than the RLS policy*. Now uses `canMutateItem()` (creator OR responsible OR public+partner), matching `items_update`. | [src/app/api/items/[id]/route.ts](<../../../../src/app/api/items/[id]/route.ts>) — `canMutateItem()` guard | 🔴 |
| ✅ **~~Same lock on delete~~** *(FIXED 2026-05-31)* | Partner can't remove a shared item they own responsibility for. | `DELETE` used the same creator-only app guard; now shares `canMutateItem()`, matching `items_delete`. | `src/app/api/items/[id]/route.ts` (delete branch) | 🟠 |
| ✅ **~~Edit and "act" are inconsistent~~** *(FIXED 2026-05-31)* | Confusing and infuriating: a partner *can* tick an item complete or postpone it, but *can't* edit its text/date. Two different rules for the same item. | Edit/delete now use the same household-aware predicate as the action routes (`canMutateItem()` mirrors the complete route's check). | act path: [src/app/api/items/[id]/complete/route.ts:84-104](<../../../../src/app/api/items/[id]/complete/route.ts#L84-L104>); edit/delete now consistent. | 🔴 |
| ✅ **~~Can't take an item back / reclaim responsibility~~** *(FIXED 2026-06-06)* | Once I assign to my partner, I can't reassign it to myself — one-way street. | Added "Pass to partner" and "Take it back" one-tap actions to `ItemActionsSheet` (uses `useHouseholdMembers` to derive which button to show, calls `useUpdateItem` with Undo toast). No dedicated endpoint needed — RLS already permits it. | [src/components/items/ItemActionsSheet.tsx](<../../../../src/components/items/ItemActionsSheet.tsx>) — `onReassign` prop + `PassToPartnerIcon` / `TakeBackIcon` buttons | 🔴 |
| ✅ **~~Handed-off items vanish — no "assigned out / assigned to me" view~~** *(FIXED 2026-06-06)* | After assigning, the item disappears from my view — no list of "things I gave my partner" or "things assigned to me." | Added two collapsible sections to `StandaloneRemindersPage`: **"Assigned to me"** (`responsible=me`, creator=partner) and **"Assigned out"** (creator=me, `responsible=partner`). Each row has a one-tap "Return →" or "← Reclaim" button wired to `handleReassign`. | [src/components/reminder/StandaloneRemindersPage.tsx](<../../../../src/components/reminder/StandaloneRemindersPage.tsx>) — `assignedToMeItems`, `assignedOutItems`, `renderAssignmentItem` | 🟠 |
| **No reassignment history / audit** | Can't see who *had* responsibility and when it changed. Disputes ("I thought you had it") have no record. | No audit table or log on `responsible_user_id` changes. | — (absence) | 🟡 |
| ✅ **~~Read path may already hide partner items~~** *(CONFIRMED 2026-06-06)* | RPC body now captured in `migrations/schema.sql`. Visible items = `user_id = me OR (partner's AND is_public = true)`. Normal flow is safe — the "Pass to partner" action sets `is_public = true`, so assigned items are always visible. **Known edge case (parked):** a private item (`is_public = false`) assigned to me by the partner won't appear in the bundle — but the assignment picker prevents this state today. | | ✅ |

> **Reusable pattern already in the codebase:** the Trips module already reassigns `responsible_user_id` in both directions automatically (`activate_trip()` hands a solo traveler's items to the partner; `complete_trip()` hands them back) — see `migrations/schema.sql`. That's the proven shape to copy for manual "pass / take back." Captured in [2 · Target Design](<2 - Target Design & Decisions.md>).

---

## Cluster 2 — UX heaviness & surface sprawl

> The "too heavy, confusing, not user-friendly" feeling. The core finding: **this is structural, not just a missing habit.** One module is spread across ~7 surfaces with overlapping jobs.

### Surface map (one module, seven doors)

| Surface | Where | Its job today | Overlap / problem |
|---|---|---|---|
| **Mobile Form** | `/expense` (Item input · Journal · Plan Schedule) | Full structured create/edit | Large & field-heavy → capture friction (Cluster 3) |
| **`/reminders` standalone** | `/reminders` (Focus + Insights tabs) | Main mobile view to see & action items | Rarely opened (below) |
| **Today (web)** | `WebTodayView` | Today + overdue + upcoming briefing | Fine as-is, per user |
| **Focus (web)** | `/focus` page | Flexible-routine assignment dashboard | **Dull, redundant, never used** — duplicates Week-view assignment |
| **Calendar — Month (web)** | `WebCalendar` | Monthly grid, add items | Most-visited; keep |
| **Calendar — Week (web)** | `WebWeekView` | Assign flexible items + Chores to days | Most *important*; keep — and absorb Focus's job |
| **Stats (web)** | analytics surface | Schedule stats | **Never used** — parked |

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| **Seven surfaces for one module** | Cognitive load: no single obvious place to *do the thing*. Overlapping jobs mean I hesitate about where to go. | Organic growth — each view added without retiring or merging an old one. | surface map above | 🟠 |
| ✅ **~~Focus page is dead weight~~** *(FIXED 2026-06-06)* | Retired `/focus` page + `FocusPage.tsx` + `FlexibleRoutinesPool.tsx` + `ScheduleRoutineSheet.tsx`. Added "Focus" per-item action to `ItemActionsSheet` → opens `ItemDetailModal`. Week view's "Flexible this week" strip covers routine assignment. | | ✅ |
| ✅ **~~`/reminders` hook rarely opened~~** *(IMPLEMENTED 2026-06-17)* | Merged `/reminders` + Plan My Day into one surface (`WebDayPlanner.tsx` at `/reminders` Focus tab). `StandaloneRemindersPage.tsx` deleted; `/today` redirects. Default view = today's items; "Plan my day" button reveals the planning editor. | | ✅ |
| **Stats unused** | Maintenance surface with zero payoff right now. | Built ahead of need. | analytics surface | ⚪ parked |

> The Focus-page pain is **already decided**: retire the page, make Focus a per-item *mode*. See [2 · Target Design](<2 - Target Design & Decisions.md>).

---

## Cluster 3 — Capture friction *(the "I'm not inputting everything" problem)*

> The habit killer: if logging an item is heavy, I won't do it, and the whole module degrades into a half-empty calendar I don't trust.

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| 🟢 **~~Mobile Form is too heavy for quick capture~~** *(LARGELY ADDRESSED 2026-06-06)* | Logging "remind me to call the plumber" shouldn't need a multi-field form. | **Correction:** the live form is [MobileReminderForm.tsx](<../../../../src/components/reminder/MobileReminderForm.tsx>) (NOT the dead `MobileItemForm.tsx`) — already single-page w/ smart NL input ([smartTextParser.ts](<../../../../src/lib/smartTextParser.ts>)), inferred type, progressive disclosure, voice. **Title-only "someday" save, quick date chips, and At-Home/Place/Map location shipped 2026-06-06.** | [MobileReminderForm.tsx](<../../../../src/components/reminder/MobileReminderForm.tsx>) | 🟢 |
| **Events are easier to log than reminders/tasks** | The asymmetry means my reminders/tasks are under-captured relative to events — exactly the items I most need surfaced. | Events map cleanly to one start time; reminders/tasks invite optional recurrence/alert/subtask decisions that slow entry. | `event_details.start_at` vs. `reminder_details.due_at` + optional recurrence/alerts | 🟡 |
| **No agreed low-friction path** | Without one canonical "fast lane," capture stays inconsistent. | Two viable directions, neither chosen: **(A)** route quick capture through Hub Chat (per CLAUDE.md, the Hub is the top-layer primary interface; forms are precision tools) vs. **(B)** strip the Mobile Form down. | open question — trade-offs in [2 · Target Design](<2 - Target Design & Decisions.md>); decided in [3 · Execution Plan](<3 - Execution Plan (Staged).md>) | 🟠 |

---

## Cluster 4 — Foundational risk *(carried from the standing strategy — linked, not duplicated)*

> These are already documented in the parent [Schedule · 1 — Feature State](<../1 - Feature State — Current Reality.md>). Listed here only so the pain map is complete; **do not re-curate them here** — the parent file is their source of truth.

| Pain | Sev | Source |
|---|---|---|
| Recurrence + occurrence-action math is **untested** (highest-risk logic). | 🟠 | parent file 1, weak-link #1 |
| Universal placement rule enforced by **convention, not a test** — a forgotten skip+inject breaks flexible items across all views. | 🟠 | parent file 1, weak-link #2 |
| Prerequisites half-built — **4 evaluators inert** (`weather`, `time_window`, `schedule`, `custom_formula`). | 🟡 | parent file 1, weak-link #3 |
| `useItems.ts` is **~2,621 LOC** — change-risk hotspot. | 🟡 | parent file 1, weak-link #4 |
| ✅ **~~Schema drift~~** *(FIXED 2026-06-06)* | Table DDL, `get_schedule_bundle` RPC body, and all RLS policies now captured in `migrations/schema.sql`. | | [migrations/schema.sql](<../../../../migrations/schema.sql>) |

---

## 🎯 Top 5 pains, ranked *(the at-a-glance scope)*

1. ✅ ~~**🔴 Partner can't edit shared items (403, creator-only).**~~ *(FIXED 2026-05-31)* Aligned app-level guard via `canMutateItem()`. *(Cluster 1)*
2. ✅ ~~**🔴 Can't take an item back / reassign in both directions.**~~ *(FIXED 2026-06-06)* "Pass to partner" + "Take it back" one-tap actions in `ItemActionsSheet`. *(Cluster 1)*
3. ✅ ~~**🟠 Handed-off items vanish — no assigned-out/assigned-to-me view.**~~ *(FIXED 2026-06-06)* Two collapsible sections added to `/reminders`. *(Cluster 1)*
4. **🟠 Capture is too heavy → I don't log everything.** The habit-killer; needs the A-vs-B decision. *(Cluster 3)*
5. ✅ ~~**🟠 Surface sprawl + dead Focus page.**~~ *(FIXED 2026-06-06)* Retired `/focus` page; added Focus per-item action to `ItemActionsSheet`; Week view handles routine assignment. *(Cluster 2)*
6. ✅ ~~**🟠 Schema drift.**~~ *(FIXED 2026-06-06)* Full schema — tables, `get_schedule_bundle` RPC, and all RLS policies — now in `migrations/schema.sql`. *(Cluster 4)*

→ Where each pain is *heading* → [2 · Target Design & Decisions](<2 - Target Design & Decisions.md>).
→ What to actually do, and in what order → [3 · Execution Plan (Staged)](<3 - Execution Plan (Staged).md>).
