---
name: triage-inbox
description: "Triage the PM Idea Inbox (ERA Notes/10 - Project Management/0 - Inbox.md): elaborate each raw entry, ask clarifying questions (bugs especially), file it as a canonical checklist item in the right campaign's 4 - Checklist.md, add a Feature State pain bullet for bugs, create/augment docs only when warranted, then move the entry to Processed with a pointer. Use when the owner says '/triage-inbox', 'triage the inbox', 'process my ideas'. NOT for implementing the work (route to start-task) and NOT for adding a single already-formed item (edit the checklist directly per _Conventions)."
---

# /triage-inbox — File Raw Ideas Into the PM Machine

> **Contract:** every entry under `## New` in `0 - Inbox.md` ends the session either **filed** (checklist item, plus Feature State bullet and/or doc where the rules below say so) and moved to `## Processed` with a `→` pointer, **deferred** with its open question recorded in place, or **explicitly skipped by the owner**. This skill NEVER writes application code and NEVER deletes an inbox entry without leaving a pointer. `pnpm pm:lint` must be green before you leave.

## Step 0 — Ground

Read, in order (all relative to `ERA Notes/10 - Project Management/`):

1. `0 - Inbox.md` — the `## New` section is your work queue. Empty → report "inbox empty" and stop.
2. `_Conventions.md` — item grammar (§1), lanes (§2), Feature State stamps (§3), campaign prefixes (§5), inbox grammar (§7).
3. `_index.md` — the campaign table, for routing.

## Step 1 — Classify each entry

Work entries top-to-bottom. For each, pick exactly one branch:

```
Is the outcome already unambiguous and verifiable as written?
("remove AI Chatbot button from Outfits page")
├─ YES → A. CHECKLIST-READY — skip to Step 3.
└─ NO
   ├─ Is it a BUG report? → B. ask the bug questions (Step 2),
   │    then file checklist item + Feature State pain bullet (Hard Rule 25).
   ├─ Is it an IDEA/feature thought? → C. ask the idea questions (Step 2),
   │    then file checklist item and/or augment a doc.
   └─ Does it need an OWNER DECISION (strategy, scope, conflicts with
        roadmap/vision)? → D. AskUserQuestion; if still unresolved, leave it
        under ## New with an indented sub-bullet: `  - ⏸ waiting: <question>`.
```

**Campaign routing:** match the entry to a campaign via the `_Conventions.md` §5 prefix table (Budget→BUD, Schedule→SCH, Kitchen→KIT, Trips→TRIP, Hub & ERA→HUB, Notifications & Alerts→NOTIF, Healthcare→HLTH, Outfits→OUT, Delivery Workspace→DW, PM Dashboard Refactor→R). **STOP and ask** if the entry could plausibly belong to two campaigns — never guess between them.

## Step 2 — Clarify (AskUserQuestion, batched per entry)

Ask only what you cannot infer; batch the questions for one entry into one call.

- **Bug template:** where exactly (page/flow)? what did you see (symptom, error, wrong value)? expected behavior? reproducible — always or sometimes? data involved (which accounts/amounts/partner/household)?
- **Idea template:** what problem does it solve? smallest useful version? does it belong in an existing doc/campaign vision?
- **Always confirm** severity (blocker/friction/annoyance/parked) and effort (S/M/L) if not obvious — never invent a severity for a bug you don't understand.

## Step 3 — File the outcome

1. **Next free ID:** grep `**<PREFIX>-` across the **entire campaign folder** — `4 - Checklist.md` open items, `1 - Feature State.md` swept stamps, `2 - Vision & Roadmap.md` — IDs are never reused (`_Conventions.md` §1). Take max+1.
2. **Checklist line** in exact grammar, under the right lane — **blocker → `## Now`, everything else → `## Next`** unless the owner says Later:
   `- [ ] **OUT-7** Remove AI Chatbot button from Outfits page → `src/app/outfits/…` _(annoyance - S)_`
   The `→ target` is optional — include it only when you verified the path exists (Glob it).
3. **Bugs also get** a pain bullet in `<Campaign>/1 - Feature State.md`'s relevant pain cluster, with the emoji severity lead at line start (🔴/🟠/🟡/⚪ — the dashboard Rollups reads those), root cause if known, and evidence.
4. **Docs:** augment the existing vault/campaign doc (Feature Index in `CLAUDE.md` names it) — creating a **NEW** doc is a STOP condition: ask the owner first, and follow `ERA Notes/Templates/Feature Doc.md` if approved.

## Step 4 — Mark processed

Move the line out of `## New`. Append it under `## Processed` as a **plain bullet** (no checkbox — keeps the Task table clean):

```
- 2026-07-22 — bug transferring to partner account → **BUD-15** in [Budget/4](<Budget/4 - Checklist.md>) + Feature State 🟠 (triaged 2026-07-22)
```

Keep the owner's original wording before the `→`. If `## Processed` exceeds ~20 bullets, **offer** to sweep (delete the oldest) — never silent-delete; git is the archive.

## Step 5 — Verify & report

1. Run `pnpm pm:lint` — must pass (the inbox itself is lint-exempt; the checklists you edited are not).
2. Report a summary table: entry → classification (A–D) → questions asked → where it landed (file + ID) or why deferred.
3. If the owner then says "now do it" for an item: **stop triaging** — that is a separate task routed through `start-task` (→ `fix-bug` / `add-feature`), with its own PM close-out via `finish-task`.

## Checklist before leaving

- [ ] Every `## New` entry filed, deferred with a `⏸ waiting:` sub-bullet, or explicitly skipped by the owner
- [ ] Every new ID verified free by grepping the whole campaign folder (never reused)
- [ ] Bugs have BOTH a checklist item and a Feature State pain bullet
- [ ] Processed bullets keep the original wording + `→` pointer + triage date
- [ ] No new doc created without owner approval; no application code written
- [ ] `pnpm pm:lint` green
