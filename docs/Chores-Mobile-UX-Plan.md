# Chores mobile UX — small action plan

Draft for Claude Code · 2026-10-24 · Review only; implementation not started.

**Goal:** quick, one-handed assignment and clear everyday actions. Preserve the room widgets, **Rooms / Chores** assignment grouping, and grouped agenda completion.

## What the review found

Inspected the running `/chores` page at a requested 390 × 844 viewport: home, room tiles, room contents, task grouping and an assigned chore's detail sheet. Browser mouse input timed out; keyboard activation worked. No chores were saved, completed or unassigned; touch behaviour and write latency remain unverified.

- **Keep the existing quick path:** Assign → room → `+ day` → Save. It already needs only four activations with the default owner/date. Keep all-day as the default and time optional. (`src/components/chores/ChoreAssignPanel.tsx:216`)
- **Finding and assigning could be clearer:** mobile has no search; a room's bulk day picker has only an accessibility label, and individual assignee changes rely on swipe. (`ChoreAssignPanel.tsx:167`, `:359`; mobile entry: `src/components/chores/ChoresView.tsx:1094`)
- **Keep single Unassign:** open row → Unassign is already two activations, with no confirmation. Repeating that for many test records is naturally tedious. (`src/components/chores/ChoreSheet.tsx:91`)
- **Investigate perceived delay separately:** template unassign performs sequential item/alert writes before cache refresh, with no optimistic update in that branch. This is a source finding, not a measured bottleneck. (`src/features/chores/useChoreActions.ts:513`)

## Implementation steps

Use aliases from [Model Registry](../ERA%20Notes/Model-Registry.md); resolve the installed model before starting. Run these steps sequentially.

| Step | Model / effort | Work and acceptance |
| --- | --- | --- |
| 1. Make assignment obvious | `CLAUDE_MID` / **medium** | In `ChoreAssignPanel.tsx`, preserve the widgets and both grouping modes. Remember the last mode per device. Add a compact search matching chore and room names; keep hidden drafts selected. Label the bulk controls **Assign all** with their eligible count; make scope explicit when search is active. Add a visible person selector inside an expanded individual row; keep swipe as a shortcut. The usual four-activation path must stay four. |
| 2. Make mobile navigation steadier | `CLAUDE_MID` / **medium** | In `ChoresView.tsx` and `ChoreAssignPanel.tsx`, keep Rooms / Chores reachable inside a room, give the assignment sheet a stable mobile height, and retain its sticky Save count above the safe area/keyboard. Give the agenda's icon-only grouping toggle a short visible label. Reduce excess spacing before shrinking widgets; use ≥44 px action targets. Keep Done directly on assigned rows and all existing detail actions. |
| 3. Check Unassign responsiveness | `CLAUDE_MID` / **high** | Use isolated fixtures with 5 and 50 assignments and delayed/failing responses. Separate request delay from rendering and repeated taps. Keep the two-activation flow if normal use is responsive. If delay is confirmed, add targeted pending/optimistic feedback with rollback and working Undo through the existing mutation architecture. Preserve the distinct flexible-slot, template-instance and ordinary one-off semantics, including alert state. Do not add bulk unassign just to clear test data. |
| 4. Verify and finish | `CLAUDE_MID` / **medium** | Check 360/390 px widths, two themes, both groupings, long names, search, person selection, Save/Discard, week changes, and large fixture lists. Test failure/Undo for any mutation change; verify unaffected drafts and rooms remain intact. Run typecheck, changed-file lint and relevant tests; update existing Schedule PM/docs under the project finish-task protocol. |

**Boundaries:** start-task and applicable UI/cache/recurrence playbooks apply. Preserve current uncommitted SCH-26 work. No new scheduling engine, mandatory fields, explanatory banners or production writes. Use mocked/isolated data for write tests: localhost is connected to production. Bulk unassign is a separate follow-up only if everyday use demonstrates a need. This draft does not replace the Schedule Master Book or create another backlog.
