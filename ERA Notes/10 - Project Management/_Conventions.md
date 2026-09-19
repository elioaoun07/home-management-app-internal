---
created: 2026-07-15
updated: 2026-09-12
type: reference
status: living
owner: Elio
---

# PM Knowledge System — Conventions

The campaign checklists together are **one implementation backlog**. Work contains actionable changes, investigations and automated verification. Manual owner acceptance belongs in a UAT document, never in the Deliver queue.

## 1. Checklist item

Only `<Campaign>/4 - Checklist.md` owns pending work:

```md
- [ ] **BUD-67** Verify the transfer migration and owner acceptance → [Scope](<Budget — Master Book.md#bud-67>) _(blocker - S)_
```

- One verifiable outcome, one owning campaign, one lifetime ID. Use a short title; keep detailed acceptance, evidence, dependencies and provenance in the Master Book's matching ID section.
- Allocate above the highest number used in the campaign's checklist, book, archived history and recorded aliases. Never reuse a completed, cancelled or merged ID. `R51`, without a hyphen, is the PM Tooling exception.
- Use top-level checkboxes only. Supporting bullets are plain text. No task checkboxes in plans, research, Master Books or navigation. Inbox `New` captures are the sole exception.
- End with exactly `_(severity - effort)_`. Severity: `blocker` (prevents safe progress), `friction` (daily drag), `annoyance` (minor), `parked` (intentionally deferred). Effort: `S` (small bounded change), `M` (one coherent implementation slice), `L` (split before dispatch). No ranges. Re-estimate against current scope before dispatch; accepted execution sheets may impose a tighter timebox.
- A large parent can own several bounded execution sheets. Record their sequence and acceptance under that parent; completion of one sheet never completes the parent. Split independently valuable outcomes into distinct IDs when useful.
- `HELD — <decision ID or prerequisite>` means recorded work with no dispatch eligibility. Severity is not permission, priority is not a calendar promise, and age is not evidence of completion.

## 2. Lanes

Exactly these H2 headings, once each and in order:

```md
## Now
## Next
## Later
```

**Now:** the next executable slice. **Next:** committed follow-on work, in dependency order. **Later:** deferred improvements, conditional work and unresolved design choices. Keep Now short (normally up to three outcomes per campaign); list any necessary exception in its header. Do not promote a blocked dependent because it is severe.

Use bold paragraphs for grouping within lanes; deeper headings reset the parser's lane. Empty lanes are valid; a lint W2 warning is not a reason to invent work. Campaign-wide acceptance belongs in the book as plain bullets, not duplicate `D1` tasks. Legacy `## Definition of Done` is parser-supported but no longer used for new checklists.

### 2.1 Completion, merge and cancellation

| Disposition | Record |
|---|---|
| Completed | Tick, verify, then sweep to the book's `## Shipped Log`; remove the checklist line. |
| Merged/renamed | Remove the duplicate checkbox immediately. In the book's `## Backlog reconciliation`, record old ID → surviving ID, date and preserved scope. This is not shipped work. |
| Already completed elsewhere | Link the original shipped evidence and remove the stale checkbox. Do not claim a new implementation or fabricate today's completion date. |
| Cancelled | Record original ID, outcome, date and reason in `_Archive/Cancelled Log.md`; remove the checkbox. |
| Owner acceptance only | Remove the Delivery checkbox; retain its ID and scope in the book with `**Execution:** owner`, and link the pending UAT row. This is neither completed implementation nor cancellation. |
| Uncertain | Keep a bounded executable investigation when code evidence is needed; put owner-only evidence requests in UAT. Never guess completion. |

`pnpm pm:archive --dry-run` previews completed-item sweeps; `pnpm pm:archive` applies them; `--undo` restores the last sweep. The dashboard Ship/Discard actions use the same engine. On the first `pnpm pm` boot of a month, completed lines are swept automatically. Dates come from git when available, otherwise today. Review before a sweep: `[x]` means the recorded implementation scope is complete and verified. Owner UAT, deployment and manual SQL application have separate statuses; pending acceptance does not reopen completed implementation. Split remaining engineering into a precise follow-up before completing a broad item. The CLI's file restoration is not a substitute for checking later edits before Undo.

## 3. Master Books and sources of truth

| Information | Canonical home |
|---|---|
| Pending scope, priority, ownership and task identity | Campaign `4 - Checklist.md` |
| Purpose, dated state, active pains, decisions, acceptance, handoff, shipped evidence | Campaign `<Campaign> — Master Book.md` |
| Cross-campaign unresolved owner choices | `_Decisions.md`, with affected task IDs |
| Accepted multi-campaign design and sequencing constraints | `Plans/`; each packet maps to a campaign ID |
| Unadopted options, hypotheses and experiment admission | `Research/Options.md`; original evidence linked from `_Archive/` |
| Raw thoughts | `0 - Inbox.md` › New |
| PM rules and reusable forms | This file and `_Templates/` |
| Product architecture, source routing and domain invariants | Feature Map and existing module vault docs outside PM |
| Historical studies, superseded plans, cancelled work, refactor provenance | `_Archive/` |
| Runtime/job state | The relevant runtime store; Markdown records intent and accepted outcomes, not invented runtime truth |

Each campaign root has exactly two files: its book and checklist. Do not recreate ASTRA/FABLED generations, per-module roadmaps, independent action plans or status reports. Optional substantial research/specification belongs under the shared `Research/` or `Plans/` area only when it answers a distinct question the book cannot contain economically.

Keep these parser contracts exact:

```md
## Shipped Log
- ✅ 2026-09-10 — **R52** Outcome (evidence)

## Pain Inventory
- 🟠 **R53 — Observable problem.** Cause if known; dated evidence. No duplicate execution checkbox.

## Acceptance Criteria Index
### R53
- **Acceptance:** Observable pass condition, including the failure case.

## Delivery session log
```

**Lifecycle declarations:** `**Execution:** delivery` (default) or `owner`; `**Implementation:** done` for completed implementation; `**UAT:** pending` or an evidenced result. Owner checks never enter Work or dispatch. Completed implementation is swept to the Shipped Log and appears under Work > Done; this records local implementation, not deployment. `pm:check-docs` rejects owner-only rows and open rows marked implemented.

Optional declared lines in a Master Book `### <ID>` section are read by tooling, never guessed: `**Kind:**` (feature, bug, maintenance, investigation or verification), `**Depends on:**` prerequisite IDs, and `**Touches:**` the repo-relative paths an item expects to change (`none` when it changes no file). Without a `Touches` line an item's scope is unknown, and Delivery V2 will not let it write beside another reserved change (DLV-106).

State claims need an evidence date/cutoff and a distinction between source-present, fixture-verified, owner-applied and device-verified. `updated:` is the document maintenance date, never a new runtime certification. Maturity scores are optional historical measurements, not mandatory decoration. Do not copy source file inventories from the Feature Map.

Keep open-item acceptance in the active index. Completed criteria can remain with shipped evidence or in history. Mark implemented decisions `*(IMPLEMENTED YYYY-MM-DD)*` only when evidence supports it. A pending owner migration or device check belongs in the UAT/runbook with an expected result and actual status, not an open Delivery item. Automated verification that an executor can perform remains actionable work.

## 4. Cross-campaign work

Choose the campaign that owns the outcome. Consumers link to that ID; they do not duplicate its checkbox. When producer and consumer can be accepted separately, create distinct outcomes and write `Depends on: <campaign/ID>` in their acceptance sections. Name both the campaign and ID in cross-links.

Examples: Notifications owns shared delivery policy (NOTIF-19); Hub consumes it. Budget owns trip reconciliation matching/reporting; Trips owns its entry point. Schedule owns occurrence identity; ERA consumes its read/capture contract. PM Tooling owns documentation and PM surfaces; Delivery owns execution control. A new campaign is justified by durable ownership, not a new screen, an audit author or a research commission.

## 5. Campaign ID prefixes

| Campaign | Prefix | Scope |
|---|---|---|
| Budget | BUD | Accounts, transactions, transfers, recurring payments, debt, allocations, analytics, imports, money restore |
| Schedule | SCH | Items, reminders, Plan My Day, chores, Focus, prerequisites and physical arrival/departure workflows |
| Kitchen | KIT | Recipes, meals, inventory, shopping and shared Catalogue workflows |
| Trips | TRIP | Travel lifecycle, planning, packing and trip-facing integrations |
| Hub & ERA | HUB | Chat, assistant, voice, ERA top layer, guest entry, shared household/offline coordination |
| Notifications & Alerts | NOTIF | Delivery policy, notification surfaces and calendar delivery/device verification |
| Healthcare | HLTH | Health records, medications, privacy and medical catalogue/reminder integrations |
| Outfits | OUT | Wardrobe, composition, outfit planning and wear |
| PM Tooling | R | PM documents, governance, scanner/dashboard and documentation tooling |
| Delivery | DLV | V1/V2 execution, evidence, qualification and result control |
| Native App | NAT | Phone shells, native push, platform integration and watch surface follow-ons |

`DW` is retired (Delivery Workspace); its shipped IDs remain reserved. The eleven campaign folders and prefixes must match `CAMPAIGNS` in `scripts/pm/lint.mjs`. Folder renames require updating every consumer and reference in the same change. Research labels such as E-05, S1.4, ASTRA-KIT-3, UU-X1 and BET-1 are source-local labels, not globally unique task IDs.

## 6. Verification and maintenance

- Run `pnpm pm:lint` for task grammar and `pnpm pm:check-docs` for structure, active links, duplicate identities and task acceptance.
- Rebuild the local read-only view with `pnpm pm:dashboard` after structural PM changes. Hosted `/pm` is refreshed by its normal build; a local rebuild does not deploy it.
- `_Archive/` and dot-folders are not scanned. The product Outcomes view explicitly reads only `_Archive/Cancelled Log.md` as read-only history; it never enters the scanned file list, search, backlog or dispatch. Template metadata is hidden by the normal view. Plans/research contain no task checkboxes and are never independent execution queues.
- Before closing a work session, reconcile the touched campaign: shipped work, pending owner verification, open pains and links. Once a week, review Now, new Inbox captures, held decisions and old small tasks; check evidence before changing status.
- A PM/tooling-only session names the product or operational outcome it unblocks. After two consecutive ordinary meta-only sessions, take a product session before more discretionary meta-work. Explicit owner commissions, including this knowledge-system refactor, are scoped exceptions; do not reinterpret them as permission to implement backlog features.
- Keep useful delivery session summaries in the book. At campaign review, move closed session narratives older than 90 days to dated archive material if they obscure current state; retain shipped evidence, decisions, unresolved incidents and pointers. Do not alter live runtime retention from a documentation policy.
- Editing `CLAUDE.md` requires `pnpm sync:ai`. Generated mirrors are not independently authored.

## 7. Idea Inbox

```md
## New
- [ ] YYYY-MM-DD — Original capture

## Processed
- YYYY-MM-DD — Original capture → **HUB-59**, or decision **DEC-01** (triaged YYYY-MM-DD)
```

Preserve the owner's wording. Search the active backlog, shipped history and aliases before allocating an ID. File a clear outcome into the owning checklist; add bug evidence to the book. For ambiguous intent, record the question in `_Decisions.md` and a linked held outcome if it is legitimate future work. Do not invent a product requirement. Move the capture to Processed with its destination; never retain both a raw checkbox and its canonical duplicate. New captures are not yet prioritized execution work.

Processed entries may be moved, without deleting their wording or destination, to a dated archive receipt when they exceed 20 entries. Do not create a second active inbox. `/triage-inbox` follows these conventions; owner clarification is needed only where the answer changes the intended outcome.

## 8. Studies, plans and archive lifecycle

Create a supporting document only for a named decision or a substantial accepted specification. Use `_Templates/Supporting Document.md`; name by subject (`Plans/Delivery V2.md`), not the author/model, audit wave, or dramatic project title. Include owner, evidence cutoff, canonical IDs, scope/non-goals and a retirement condition. A commissioning request authorizes research, not every feature proposed by it.

Research ends with one explicit disposition per meaningful finding: incorporated into an existing ID, new accepted outcome, held decision, unadopted option, disproved, or superseded. Preserve the original source/label and the destination. Unadopted ideas stay discoverable in `Research/Options.md`; no speculative implementation gets a Now slot merely by appearing in a study.

When a study or plan has been incorporated, move its evidence to `_Archive/Studies/<subject>/` or its superseded plan to `_Archive/Plans/`. Update incoming and internal links. Canonical books and current plans carry the surviving constraints; archived prose cannot overrule them. Do not declare an old plan 'completed' just because its dates elapsed. Delete only empty scaffolding or byte-identical redundant output with traceable retention; preserve substantive history.

The 2026-09-10 consolidation receipt and manifest in `_Archive/2026-09-10 PM Refactor/` record predecessor paths, item dispositions and evidence. Future routine work needs ordinary book/Inbox provenance, not another global refactor report. Graphs and dashboards are derived navigation aids; confirm source identity and content before treating an edge or rendered status as evidence.
