# External product patterns

Verified **2026-11-06**. ERA anchor: `9cd4166691edd9367ea1bd9a604e0bec13ffe870`. External behavior below is **documented by vendors**, not observed in authenticated use. ERA classifications are in [ERA-FIT-ANALYSIS.md](ERA-FIT-ANALYSIS.md); proposals are in [SOLUTION-CONCEPTS.md](SOLUTION-CONCEPTS.md).

## Method and limits

Products were selected for specific household workflows rather than market rank: capture (Todoist), deliberate planning (Sunsama), adaptive calendars (Reclaim), budget decisions (YNAB), meal-to-grocery reuse (Paprika), family coordination (Cozi), and evidence retrieval (Notion). No product is treated as a complete substitute for ERA.

The unit of comparison is a journey: trigger → input → interpretation/default → review → follow-through → interruption/recovery. Help pages support that intended sequence. They cannot establish latency, parsing accuracy, notification arrival, discoverability, mobile ergonomics, offline durability, or satisfaction. No comparative numerical scores are justified.

**UNKNOWN** below means not established by the cited pages, even if the product might support it. First-party promotional language is excluded from factual performance conclusions. Sources and access qualifications are recorded in [SOURCES.md](SOURCES.md#external-source-register).

## Seven documented workflows

### Todoist — turn a sentence or a spoken list into reviewable tasks

**Documented journey:** Open Quick Add, type a title containing a date and optional project/assignee/reminder details, inspect the interpretation, and add. Actions appear as typing begins. If a word was incorrectly interpreted as a date, tap it to restore literal text. The desktop global shortcut reduces the need to switch applications. [T1: Quick Add](https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz)

A separate voice journey opens Ramble, displays task previews while speaking, accepts spoken corrections/removals, and ends with submission. The current project/label can supply context; otherwise capture goes to Inbox. Wear OS uses Inbox and has a narrower beta field set. [T2: Ramble](https://www.todoist.com/help/todoist/todoist-and-ai/dictate-to-add-tasks-with-ramble-P1Raq7vVF)

**Transferable judgment:** Make interpretation reversible and keep placement defaults visible; support a small reviewed batch without turning every utterance into a dialogue. These are P01/P02.

**UNKNOWN:** The pages do not prove that an unsubmitted preview survives a crash, a date correction updates every derived field correctly, or voice works reliably in the household's language mix. Reminder syntax does not demonstrate notification restraint.

### Sunsama — decide what fits, then deliberately defer the rest

**Documented journey:** Enter daily planning, assemble today's tasks from meetings/backlog/manual input, review a workload timeline, move what can wait, optionally timebox, order the work, and finish the plan. Planned duration is an input to meaningful workload estimates. [S1: Daily Planning](https://help.sunsama.com/docs/getting-started/basics/daily-planning-the-basics/)

Settings allow workload thresholds, automatic planning/shutdown prompts, a destination after planning, and a choice between automatic evening rollover and selecting tasks to carry forward. This makes carrying unfinished work a visible choice rather than merely leaving a growing overdue list. [S2: Account Settings](https://help.sunsama.com/docs/settings/user-settings/)

That setting concerns evening planning. The separate rollover guide describes midnight carryover and an archive for repeatedly deferred tasks; it does not establish a universal manual-only carryover mode. [S3: Task rollover](https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics/)

**Transferable judgment:** A short review can end with fewer commitments and a clear next action. P03 borrows that decision sequence, not a mandatory daily ritual.

**UNKNOWN:** These pages do not prove fewer interruptions or that the complete in-progress planning flow survives device loss. Documented workload thresholds exclude personal-context tasks; ERA should not copy that exclusion for household capacity.

### Reclaim — preview conflict consequences before applying calendar changes

**Documented journey:** Ask the assistant for a scheduling change or enter Preview Mode; inspect the staged calendar with enabled Agents recalculated; review/apply or discard. Separately configured Agents can manage flexible time automatically. Their rules include allowed movement, priority, minimum duration, skip behavior, and defended time. Turning an Agent off preserves its configuration. Assistant staging and autonomous Agent behavior are different workflows. [R1: Reclaim 2.0 FAQ](https://help.reclaim.ai/en/articles/15280604-reclaim-2-0-faq)

Notification controls span Reclaim and its underlying calendars. Sync copies suppress alerts; task/habit defaults differ from break defaults. The documentation warns about duplicate settings and says Outlook meeting-change notifications cannot be disabled. Some digest features are explicitly “coming soon.” [R2: Notifications](https://help.reclaim.ai/en/articles/6179615-manage-notifications-for-reclaim-events)

**Transferable judgment:** P04 is a before/after change preview with understandable constraints. P10 is coordination across alert channels. Neither implies ERA should inherit continuous autonomous rescheduling.

**UNKNOWN:** Documentation does not establish optimal schedules, human-quality explanations for each move, interruption persistence, or uniform notification control across providers.

### YNAB — resolve a shortfall by exposing what gives way

**Documented journey:** Select an overspent category, choose a source category, use the proposed shortfall amount or edit it, and complete the move. Additional categories can cover the remaining amount. The help distinguishes platforms and cash versus credit overspending. Money Moves provides a history for later inspection; reversing a move can require manually moving the money back. [Y1: Moving Money](https://support.ynab.com/moving-money-in-your-plan-ryyCKbBJi), [Y2: Overspending](https://support.ynab.com/en_us/overspending-in-ynab-a-guide-ryWoxEyi?mobile-help=true)

**Transferable judgment:** P05 converts “you are over budget” into a choice with a source, destination, amount, and consequence. The useful element is the explicit tradeoff, not YNAB's credit-card accounting or calendar-month model.

**Evidence qualification:** Direct opens returned no readable body; the workflow was accessible through first-party search extraction. Confidence is lower than for fully opened manuals. This is not hands-on validation.

**UNKNOWN:** The reviewed material does not establish intelligent source-category recommendations, AI reasoning, crash recovery, or restrained notification behavior. A practical recovery path is documented history/manual reversal, not assumed one-tap Undo.

### Paprika — reuse meal ingredients and keep the shopping calculation inspectable

**Documented journey:** Review recipe ingredients before adding groceries; pantry entries start unchecked. Consolidation is optional, and recipe origins can stay visible. Meals can be copied, menus reused, and sync status/time inspected. Scope: **Paprika 3 for Windows**, not the separately linked version 4 beta. [P1: User Guide](https://www.paprikaapp.com/help/windows/)

**Transferable judgment:** P06 reuses recipe facts before asking the user to type groceries; P09 makes sync state legible. Ingredient origin is useful when reviewing totals.

**UNKNOWN:** Sufficient stock, freshness, matching reliability, atomic weekly Undo and unsent-edit durability are unestablished.

### Cozi — coordinate the people affected by a change

**Documented journey:** Choose appointment attendees/reminders. Gold change alerts default to eligible attendees except the editor; recipients are adjustable. Delivery setup is required. Daily/weekly email agendas are individually enabled. [C1: FAQ, notification sections](https://www.cozi.com/faq/)

**Transferable judgment:** P07 asks “who needs this change?” before sending another alert. An agenda is a distinct, opt-in communication channel, not an excuse to push every update.

**Boundary:** Broad shared-account access and delayed read-only calendar subscriptions should not become ERA's privacy or live-availability model.

**UNKNOWN:** Delivery, responsibility acknowledgement, offline behavior and universal suppression remain untested. Overlapping FAQ sections limit confidence.

### Notion — answer within a chosen source scope and let the user inspect evidence

**Documented journey:** Ask from Home's Enterprise Search, optionally add a page/person as context, select or restrict sources, and follow citations into workspace/connected-app evidence. The help warns that some model selections can search only the web. Workspace search also offers recently viewed pages and filters. [N1: Enterprise Search](https://www.notion.com/help/enterprise-search), [N2: Search](https://www.notion.com/help/search)

**Transferable judgment:** P08 makes scope and evidence part of the answer interaction. For ERA, this suggests source identity, age, and permission checks on existing records before external connectors.

**UNKNOWN:** A citation does not certify correctness, completeness, or freshness. The pages do not prove perfect permission enforcement, that an interrupted answer can resume, or that connected content is current. No connector or model was exercised.

## Comparison across the requested workflow qualities

These are documented affordances, not scores. “Unestablished” means the reviewed sources provide insufficient evidence.

| Product | Low-friction input and context reuse | Defaults and follow-through | Notification restraint | Explanation | Recovery from interruption |
| --- | --- | --- | --- | --- | --- |
| Todoist | Sentence capture; spoken previews; current project/label context. | Inbox fallback; review before voice submission. | Reminder entry documented; restraint unestablished. | Inspect/correct parsed details; no quality proof. | Correction/removal in preview; crash persistence unestablished. |
| Sunsama | Import/backlog reuse reduces re-entry. | Workload review, ordering, deferral, chosen destination. | Ritual prompts configurable. | Workload timeline makes overcommitment visible. | Selective carryover; interrupted-editor restoration unestablished. |
| Reclaim | Chat request plus existing calendar. | Conflict rules and staged assistant changes. | Cross-calendar settings; provider limits documented. | Rule vocabulary and preview consequences, not proven per-move rationale. | Discard preview; pause Agent without losing configuration; crash recovery unestablished. |
| YNAB | Start from an existing shortfall. | Shortfall amount prefilled; choose funding source. | Unestablished. | Source/destination and move history expose consequences. | Inspect history/manual reversal; draft restoration unestablished. |
| Paprika | Saved ingredients reused in grocery review. | Pantry uncheck, optional consolidation, reusable menus. | Unestablished. | Recipe origin can stay visible. | Sync result/time and manual sync; unsubmitted edits unestablished. |
| Cozi | One appointment reused for affected people. | Attendees as reminder/change recipients; opt-in agenda. | Exclude editor by default; delivery setup required. | Recipients visible; AI recommendations unestablished. | Shared server data documented; interrupted edits unestablished. |
| Notion | Question plus chosen pages/source scope. | Existing records and recent pages reused. | Unestablished for this journey. | Citations and source controls. | Recent pages aid return; interrupted generation unestablished. |

## Candidate pattern ledger

Every row is evaluated against ERA in the fit analysis. These are **PROPOSED DESIGN** directions only where an ERA gap remains.

| Pattern | Mechanism worth retaining | Inspiration | ERA concept |
| --- | --- | --- | --- |
| P01 | Editable interpretation; contextual defaults without hidden commitment. | Todoist | Preserve current capture; prerequisite to C1. |
| P02 | Review a bounded batch and allow correction before submission. | Todoist | C1; no new generic agent. |
| P03 | Daily triage with deliberate carryover and a clear next action. | Sunsama | C2. |
| P04 | Before/after preview of constrained schedule changes. | Reclaim | C2. |
| P05 | Explain a budget adjustment through explicit consequences. | YNAB | C3. |
| P06 | Recipe-to-list reuse, cautious pantry hints, inspectable consolidation. | Paprika | C4. |
| P07 | Notify only the people affected; separate an agenda from individual changes. | Cozi | Cross-cutting constraint on C2/C4. |
| P08 | Scope retrieval and show source identity/age. | Notion | C5. |
| P09 | Make unfinished work and sync/commit state visible. | Paprika, Sunsama | C1; shared failure rule for all concepts. |
| P10 | Coordinate reminder channels; allow quiet, opt-in follow-through. | Reclaim, Sunsama, Cozi | Shared delivery constraint, not a new notification feed. |

## What not to infer

A vendor's documented sequence is evidence that the workflow is intended/supported, not evidence that it is good for this household. “AI calendar,” “smart capture,” and “enterprise search” are not performance measurements. Reusable menus, continuous optimization, connector breadth, and frequent reminders can all create work. The selected concepts therefore have manual fallbacks, small initial scope, and explicit stop conditions in the [solution document](SOLUTION-CONCEPTS.md).

