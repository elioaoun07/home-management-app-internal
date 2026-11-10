---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Line counts by `wc -l`; client rule counts by `grep` and `pnpm lint`. No component was rendered or profiled."
---

# UI — the largest files and the client-rule debt

[Fable 2 index](<../_index.md>) · [Verification pyramid](<../01 - Architecture/Verification Pyramid.md>)

## Largest source files

| Lines | File | Module |
|---|---|---|
| 5,972 | `src/components/hub/HubPage.tsx` | Hub Chat |
| 3,438 | `src/components/icons/FuturisticIcons.tsx` | Shared icons (data, not logic) |
| 3,265 | `src/components/expense/MobileExpenseForm.tsx` | Transactions |
| 3,229 | `src/components/hub/ShoppingListView.tsx` | Shopping List |
| 3,083 | `src/app/recurring/page.tsx` | Recurring Payments |
| 2,661 | `src/components/web/WebDashboard.tsx` | Dashboard |
| 2,602 | `src/app/g/[tag]/guest-portal-client.tsx` | Guest Portal |
| 2,564 | `src/components/web/WebTabletMissionControl.tsx` | Dashboard |
| 2,297 | `src/app/statement-import/page.tsx` | Statement Import |
| 2,274 | `src/components/web/ItemSubtasks.tsx` | Items |
| 2,207 | `src/features/items/useItems.ts` | Items |
| 2,155 | `src/components/planner/WebDayPlanner.tsx` | Plan My Day |
| 1,639 | `src/app/api/hub/messages/route.ts` | Hub Chat (largest route) |

The whole of `src/` is 1,235 TypeScript files and about 332,600 lines.

## Why it matters for delivery

- **Agents pay for size on every edit.** A change inside `HubPage.tsx` loads roughly 60,000 tokens of one file. This is the practical ceiling on what a mid-tier or low-tier model can change safely in Hub Chat, the app's declared primary interface.
- **None of the thirteen has a test file beside it.**
- **Existing BUD-9 already says "split the expense and recurring mega-forms into testable units, only when next touched".** That rule is right; the same rule should apply to `HubPage.tsx` and `ShoppingListView.tsx`. No new item: record it as a constraint on any Hub item that edits those files, and route such items to the high tier ([Model Tiers](<../Model Tiers/_Routing.md>)).

## Client-rule debt, measured

| Hard Rule | Signal | Count |
|---|---|---|
| 6: `safeFetch` for mutations | `no-restricted-syntax` lint warnings | 96 call sites, against 355 `safeFetch` calls |
| 22: no `console.*` in client code | `grep` in `src/components`, `features`, `hooks`, `contexts` | 184 calls in 45 files, plus 4 in `page.tsx` files |
| 19: no `type="number"` | `grep` outside `src/components/ui` | 3 |
| 7: never trust `navigator.onLine` | `grep` outside `connectivityManager` | 7 references |
| 1: every toast has Undo | files that call `toast.success` and contain no "Undo" string | 24 files (402 `toast.success` calls overall) |
| Query keys via `qk.*` | inline `queryKey: [` arrays | 290 inline against 574 keyed |
| Type safety | `any` annotations or casts | 467 in `src` (513 lint warnings including tests and scripts) |

Existing owners: R44 and R48 (raw fetch), R47 (console), R45 and DEC-07 (Undo wording). The `navigator.onLine`, `type="number"` and inline query-key counts have no item; they are small enough to ride along with R47 as one mechanical pass for the low tier, and are listed in [CLAUDE_LOW work packets](<../Model Tiers/CLAUDE_LOW/Work Packets.md>) as a proposal, not filed.

## Not examined

Rendering performance, bundle size, accessibility, theming correctness, the Atlas, and mobile layout of the product were not assessed in this pass.
