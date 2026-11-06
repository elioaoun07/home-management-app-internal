# ERA product workflow research

Verified: **2026-11-06**, Asia/Beirut. Analyzed HEAD: **`9cd4166691edd9367ea1bd9a604e0bec13ffe870`**.

This is a standalone research package for ERA as a personal and household application. It covers capture, planning and calendars, money, meals, coordination, retrieval, AI, and recovery. PM/Delivery is one capability area, not the product definition. No implementation or delivery commitment is implied.

## Read this package

| File | Purpose |
| --- | --- |
| [PRODUCT-PATTERNS.md](PRODUCT-PATTERNS.md) | Seven external products, documented journeys, ten candidate patterns, and evidence limits. |
| [ERA-FIT-ANALYSIS.md](ERA-FIT-ANALYSIS.md) | Current implementation versus documented intent; classification of every candidate pattern. |
| [SOLUTION-CONCEPTS.md](SOLUTION-CONCEPTS.md) | Five proposed concepts, alternatives, dependencies, failure behavior, acceptance scenarios, and rejected directions. |
| [SOURCES.md](SOURCES.md) | First-party URLs, verification dates, access limitations, and repository evidence by path and symbol. |

## Evidence language

- **CURRENT IMPLEMENTATION** means inspected source behavior in this working copy. It does not establish deployed availability, correct live RLS, enabled flags, scheduler liveness, or successful device use.
- **DOCUMENTED INTENT** means a repository design statement or module document. It is not proof that a workflow is implemented.
- **PROPOSED DESIGN** means a research recommendation in this package. New data fields, UI labels, thresholds, and acceptance scenarios are proposals.
- **UNKNOWN** means evidence was unavailable, incomplete, or outside the bounded inspection. Unknown is not the same as missing.

Fit labels are **already present**, **partly present**, **missing**, and **unclear**. “Missing” is scoped to a named workflow or inspected boundary, not a claim that no similar code exists anywhere in ERA.

External evidence is vendor documentation, not hands-on verification. Seven products were researched: Todoist, Sunsama, Reclaim, YNAB, Paprika, Cozi, and Notion. Help manuals supplied the workflow evidence. No accounts, purchases, or integrations were used. YNAB's help pages were readable through search extraction but returned no body on direct open; its conclusions carry lower confidence. Marketing claims about speed, accuracy, productivity, or reliability were not treated as measurements.

## Most useful findings

1. **Preserve and extend ERA's capture work.** Contextual account/category/list recall already exists in `captureMemory.ts`, with editable interpretation in `captureAssist.ts`. “Add natural language input” would duplicate existing work. See [P01](ERA-FIT-ANALYSIS.md#p01--editable-capture-and-contextual-defaults).
2. **Make interruption recovery visible.** Chat history, artifact reversal, form handoff, and a gated execution journal exist, but they do not establish one dependable resume journey across all captures. [C1](SOLUTION-CONCEPTS.md#c1--resume-an-interrupted-request) is the first candidate to investigate.
3. **Propose a smaller day before building a scheduler.** Existing occurrence expansion and day-plan editing provide the foundations. Incoming external calendar awareness is not supplied by the one-way Google backup. [C2](SOLUTION-CONCEPTS.md#c2--reset-the-rest-of-today) keeps that boundary visible.
4. **Expose tradeoffs and reuse facts.** Budget estimates already have deterministic fallback; meal coverage already understands leftovers and person assignment. The useful extensions are specific budget decisions ([C3](SOLUTION-CONCEPTS.md#c3--review-a-budget-tradeoff)) and a reviewed meal-to-shopping journey ([C4](SOLUTION-CONCEPTS.md#c4--fill-meal-gaps-and-review-the-shopping-delta)).
5. **Show why ERA remembers an answer.** Adaptive context already records evidence coverage; simple household recall discards source identity in its result. [C5](SOLUTION-CONCEPTS.md#c5--answer-with-the-source-and-its-age) starts with existing ERA records rather than an external connector estate.

These are product judgments, not measured user outcomes. Proposed priority: investigate C1, then validate C2/C4 with the household, then C5 and C3. C3's write portion has a higher correctness/dependency cost; its read-only version can be evaluated earlier.

## Inspection and consistency boundary

Repository inspection followed the Feature Map, module overviews, Design Doctrine, and representative source paths: composer/AI orchestration, day planning and occurrence expansion, Google backup, budgeting and fallback, recipe/shopping transfer, inventory reads, household access, memories/adaptive context, notifications, offline handling, artifacts, and the PM entry route. This was not an exhaustive audit of every module or every caller. See the [repository register](SOURCES.md#repository-evidence-register).

HEAD was read from `.git/HEAD` and `.git/refs/heads/main`. General Git/search commands encountered execution-helper startup failures; working-tree cleanliness and exact correspondence of every inspected file to HEAD are **UNKNOWN**. The analyzed material is the working copy observed during this session, anchored to that commit. No environment secrets were read.

The bounded final review passed: exactly five deliverables; seven products; ten pattern assessments; five concepts with every requested design field; valid internal file/heading links; 66 readable repository link targets; and key symbols/limits checked in 12 source files. Evidence labels and pattern-to-concept coverage were also reviewed. This is a documentation consistency result, not functional acceptance of the concepts.

Application tests, a development server, live models, notifications, and database/integration operations were not run. The documentation-only scope makes application typecheck, mobile UI testing, Atlas updates, migrations, and PM lifecycle edits inapplicable; existing documents are deliberately untouched.

## Unresolved inputs

- Which interruption is most painful: unfinished typing, an unanswered question, a precision form, or a partly executed multi-action request?
- Does the household need outside-calendar busy time, or are ERA's own commitments enough for a first planning aid?
- How reliable is maintained pantry stock, and are recipe quantities consistently structured?
- Which budget categories are protected, and what ownership/currency rules should a tradeoff use?
- Which facts should be shared household memories versus private conversational evidence?
- What notification schedule feels useful to each person? Existing settings do not prove every producer enforces a common policy.
- Are the durable execution flag, required owner-run migrations, cron schedules, and relevant source permissions active in the deployed application?

These inputs gate implementation choices, not completion of this research. No ongoing study queue, competitor monitor, or maintenance process was created.
