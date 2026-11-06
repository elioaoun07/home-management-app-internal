# Read first: ERA research after independent review

This is a **review overlay**, not an approved product plan. Read [findings](REVIEW-FINDINGS.md) before implementing a research proposal. The [inventory](README.md) identifies exactly what was visible at commit **`9cd4166691edd9367ea1bd9a604e0bec13ffe870`** plus local untracked packs on **2026-11-06**. Nothing from unseen sessions or branches was reviewed.

## Which reference answers my question?

| Question | Start here | Check before relying on it |
|---|---|---|
| What are the rules and where do I start a task? | [CLAUDE.md](../../../CLAUDE.md), then [start-task](../../../.claude/skills/start-task/SKILL.md) | Generated mirrors are not separate policies. Follow the current user task scope. |
| Where is the source for a user-visible behavior? | [Feature Map](<../../../ERA Notes/01 - Architecture/Feature Map/_index.md>), then the matching module map and Overview | The flat map routes files; the deeper module doc explains intent. Verify behavior in current source. |
| How should an ambiguous design tradeoff be decided? | [Design Doctrine](<../../../ERA Notes/01 - Architecture/Design Doctrine.md>) | Research recommendations do not override standing constraints. |
| What exists, and what is partial? | [01 CAPABILITY-MAP](../01-atlas/CAPABILITY-MAP.md) and [ARCHITECTURE](../01-atlas/ARCHITECTURE.md) | “Implemented” is source evidence, not deployment/usage proof. Limits have drift noted in F10. |
| Which modules, consumers or data could a change affect? | [01 CHANGE-IMPACT-GUIDE](../01-atlas/CHANGE-IMPACT-GUIDE.md), [08 ENTITY-MAP](../08-shared-data/ENTITY-MAP.md), [SOURCE-OF-TRUTH-MATRIX](../08-shared-data/SOURCE-OF-TRUTH-MATRIX.md) | Refresh source callers; use [F09](REVIEW-FINDINGS.md#f09--shared-data-stages-have-hidden-sql-and-acceptance-dependencies) before following the proposed rollout. |
| What may a partner see or edit? | [19 Q02 and S05](../19-business-rules/OPEN-DECISIONS.md), source route/service, [Database RLS Posture](<../../../ERA Notes/01 - Architecture/Database RLS Posture.md>) | F04 corrects category/amount prose. Start visibility bugs with `migrations/db-state.json`; the visible snapshot is from August 4, not live evidence for November. |
| What does ERA remember, correct or forget? | [04 CURRENT-CONTEXT-MAP](../04-memory-context/CURRENT-CONTEXT-MAP.md), then [MEMORY-DESIGN](../04-memory-context/MEMORY-DESIGN.md) | Proposed extension is not shipped. F06–F08 qualify deletion, time and identity contracts. |
| Can an uncertain action be retried or undone? | [06 ACTION-INVENTORY](../06-action-execution/ACTION-INVENTORY.md), then [12 shared contracts](../12-solution-blueprints/README.md) and the actual source operation | Apply F01–F03. Content matches, empty reads and a transfer row are insufficient effect proof. Journal availability must be evidenced. |
| How should proactive assistance behave? | [05 ATTENTION-RULES](../05-proactive-assistance/ATTENTION-RULES.md) and [EVALUATION-SCENARIOS](../05-proactive-assistance/EVALUATION-SCENARIOS.md) | D07 remains open; F07 corrects freshness and F12 rejects inferred medication continuation. Prefer one bounded in-app pilot. |
| How do I evaluate AI behavior and estimate usage? | [07 AI-TASK-MATRIX](../07-ai-quality/AI-TASK-MATRIX.md), [USAGE-CONTROLS](../07-ai-quality/USAGE-CONTROLS.md), [TRACE-SPEC](../07-ai-quality/TRACE-SPEC.md) | Fix rubric inconsistencies F11; routing is not source correctness (F04/F05). Workloads are hypothetical. Refresh provider prices for a future decision. Replay-only rules still apply. |
| What is the proposed everyday interaction? | [10 INTERACTION-PRINCIPLES](../10-interaction-design/INTERACTION-PRINCIPLES.md), [flows](../10-interaction-design/CAPTURE-AND-RETRIEVAL-FLOWS.md), [acceptance](../10-interaction-design/ACCEPTANCE-SCENARIOS.md) | Capture/Find/Continue are proposals; raw notes, unsent drafts and run receipts have different lifecycles. No visual acceptance has been performed here. |
| Which cross-module journey or larger blueprint is relevant? | [03 README](../03-life-journeys/README.md), [SHARED-DEPENDENCIES](../03-life-journeys/SHARED-DEPENDENCIES.md), [12 comparison](../12-solution-blueprints/CANDIDATE-COMPARISON.md) | Reuse the source operation; qualify pack IDs. Missing receipts/permissions are prerequisites, not UX details. |
| What can ERA learn from other products? | [16 SOURCES](../16-product-research/SOURCES.md), [PRODUCT-PATTERNS](../16-product-research/PRODUCT-PATTERNS.md), [ERA-FIT-ANALYSIS](../16-product-research/ERA-FIT-ANALYSIS.md) | Vendor docs were checked selectively, not products tested. F13 identifies Paprika version drift. Inspiration does not demonstrate household benefit. |
| What is the best next implementation candidate? | [17 ROADMAP](../17-roadmap/ROADMAP.md), Q1, then the bounded brief below | Recommendation only. C1/R1 remain conditional and are not included in Q1. |
| What is approved, planned or finished? | [PM index](<../../../ERA Notes/10 - Project Management/_index.md>), the owning campaign's Master Book and its evidence cutoff | Research status and reviewer preference do not approve work. This synthesis creates no competing queue. |
| How do I hand off work? | [18 NAVIGATION-GUIDE](../18-ai-handoff/NAVIGATION-GUIDE.md) and [HANDOFF-TEMPLATE](../18-ai-handoff/HANDOFF-TEMPLATE.md) | Include current commit, actual changes and unavailable evidence. Older reference packs need this overlay for later local research. |

## Best-supported next implementation brief

**Candidate: `17-roadmap/Q1` — one owner for draft-confirmation feedback. Not started or approved by this review.**

**Problem and evidence:** [`DraftsDrawer.confirmDraft`](../../../src/components/expense/DraftsDrawer.tsx), lines 101–129, adds success and error callbacks with toasts. [`useConfirmDraft`](../../../src/features/drafts/useDrafts.ts), lines 302–343, already owns success/Undo and failure feedback. A successful drawer confirmation therefore has two source-level feedback emitters. This is concrete evidence of duplication without inventing how often the household encounters it.

**Module and boundary:** Drafts is a standalone module. Keep any future change confined to feedback ownership and the drawer's existing edit/close behavior. Trace the four current caller surfaces: [DraftsDrawer](../../../src/components/expense/DraftsDrawer.tsx), [DraftTransactionsDialog](../../../src/components/expense/DraftTransactionsDialog.tsx), [drafts page](../../../src/app/expense/drafts/page.tsx), and [recurring page](../../../src/app/recurring/page.tsx). Do not remove hook feedback needed by those other callers. Follow the Drafts Feature Map/Overview and applicable UI/cache playbooks before editing.

**Proposed acceptance, using isolated fixtures:**

1. Successful drawer confirmation produces exactly one success receipt with the existing Undo action.
2. Failed confirmation produces no success and one coherent error; retry/edit state is preserved appropriately.
3. Other callers retain their expected feedback; the drawer still resets editing and closes only under its existing last-draft condition.
4. A rendered 390 px mobile and keyboard check confirms the receipt and controls remain reachable. A source read alone does not pass this check.
5. No domain mutation, balance logic, new store, migration, provider call, Home redesign or recovery framework is added to this slice.

**Known limitation:** the existing hook's Undo deletes the confirmed transaction; it does not promise restoration of the original draft. At lines 315–319 the handler also ignores the DELETE response's `ok` value before announcing removal. A future author should record that separate correctness issue and test/re-scope explicitly, rather than certify financial Undo from a feedback-only change. Q1 preserves the affordance; it does not certify all inverse semantics.

**Stop/reconsider boundary:** if the duplicate emitters have already been removed at the implementation commit, retire Q1 without inventing replacement work. If the chosen acceptance requires changing the inverse or money behavior, it is a different scope requiring the relevant money/source analysis. Read the current campaign evidence before opening or updating any implementation item.

## For a larger recovery proposal

Start from the roadmap's **F1 evidence check → conditional C1 inspection → conditional R1 recovery**, not from a universal Continue shell. First establish which states actually persist, the relevant rollout flags/schema and source outcomes. Resolve F01–F03 before permitting retries or stale inverses. New raw capture, meal/shopping batches, day reset and memory changes remain separate alternatives with their own prerequisites.

Do not use this review as permission to enable a flag, run SQL, call a paid model, send notifications, change policy or launch implementation.
