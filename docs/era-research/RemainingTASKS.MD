# ERA Personal AI — Future Documentation Prompts

**Scope:** Remaining work from **Session 3 (ERA Product Evolution)** and **Session 4 (Synthesis and Roadmap)**.  
**Prepared:** 4 November 2026  
**Goal:** Produce reusable Markdown research, product specifications, and future solution designs; **no application implementation**.

> **Yes, you can run these prompt by prompt.** Each fenced prompt below is self-contained. Start a **new Claude Code Cloud or Codex task for each prompt**, select ERA's repository, choose the recommended model/effort in the tool's controls, and paste the single block. No separate shared-instructions message is needed.

## What is already done

You completed the earlier two sessions:

- **Session 1 — ERA Foundations:** #1 Capability Atlas, #8 Shared Data, #19 Business Rules, #18 AI Handoff.
- **Session 2 — ERA Intelligence:** #4 Memory, #5 Proactive Assistance, #6 Actions and Recovery, #7 AI Quality.

**You did not miss a mandatory step.** Sessions 3 and 4 are optional future work, not prerequisites for using ERA today. Their outputs will be more useful if the documents from Sessions 1 and 2 have been merged or otherwise made visible in the repo snapshot used for the new tasks.

## Model / effort recommendations

These are **starting recommendations, not hard requirements**. Select whatever models your account currently offers; availability and naming may change. Effort is selected in the Claude/Codex interface, **not** by writing the model name into the prompt.

| Order | Prompt | Claude Code | Codex | Prerequisites |
|---|---|---|---|---|
| 1 | **#16 External product research → ERA ideas** | **Fable 5.1 · High** | **GPT-6.1 Sol · High** | ERA repo; public web sources if available |
| 2 | **#3 Cross-module life journeys** | **Fable 5.1 · High** | **GPT-6 Astra · High** | ERA repo; #1 and #8 helpful |
| 3 | **#10 Capture/navigation/mobile UX** | **Fable 5.1 · High** | **GPT-6.1 Sol · High** | ERA repo; screenshots optional |
| 4 | **#11 Personal planning and follow-through** | **Fable 5.1 · High** | **GPT-6.1 Sol · High** | ERA repo; #3 helpful |
| 5 | **#12 Three solution blueprints** | **Fable 5.1 · High** | **GPT-6 Astra · High** | Earlier research packs recommended |
| 6 | **#17 Prioritized roadmap** | **Opus 5.5 · High** | **GPT-6 Astra · Medium** | Available research packs recommended |
| 7 | **#20 Independent synthesis/review** | **Fable 5.1 · High** | **GPT-6 Astra · High** | Generated packs must be available to the reviewer |

**Budget alternative:** If allowance is tighter next time, try **Claude Opus 5.5 · Medium** or **Codex GPT-6.1 Sol · Medium** for an initial draft of #10, #11, or #17. Reserve higher-effort models for reconciling difficult evidence and dependencies. The recommended choices here favor completeness over minimum usage. Avoid UltraFast or unusually expensive settings unless you specifically want them.

## Execution rules

1. **Run one prompt per task/session.** Do not paste several numbered prompts at once. Each task writes to its own unique folder.
2. **Before running a dependent task, verify that earlier output files are in that task's checkout.** Cloud branches may be isolated. If files exist only in another unmerged PR/branch, the task cannot safely rely on them.
3. **Read-only analysis of code is fine; writing is restricted to new `.md` files.** No code edits, migrations, dependencies, live service calls, deployments, or real tasks/reminders.
4. **Do not automatically merge or force-push.** Save the generated files on a branch/PR, review them, and merge or otherwise make them available when you decide.
5. Every task should separate **observed/implemented**, **documented intention**, **proposed design**, and **unknown**. A proposal is never an owner-approved requirement.
6. If the task lacks web access or upstream documents, complete what is supported and list the exact omissions rather than guessing.

---

# Session 3 — ERA Product Evolution

## [ ] Prompt #16 — Product research translated into ERA designs

**Claude:** Fable 5.1 / High  
**Codex:** GPT-6.1 Sol / High  
**Output:** `docs/era-research/16-product-research/`

**Paste this complete prompt into a new task:**

```text
You are analyzing ERA, my full personal AI application. This is a standalone documentation-only task. First inspect the current repository broadly enough to understand ERA's capabilities, especially personal planning, calendars, budgeting, meal planning, household coordination, knowledge retrieval, and relevant AI features. Treat PM/Delivery as parts of ERA rather than the whole product.

Research six to eight relevant external products across these categories. Use accessible current first-party sources and record URLs and verification dates. Compare actual, documented user workflows rather than headline features: low-friction input, context reuse, good defaults, follow-through, notification restraint, explanation of recommendations, and recovery from interruption. Do not equate vendor marketing with verified hands-on behavior.

For each promising pattern, compare it with ERA's current implementation and design intentions using repository paths/symbols. Classify: already present, partly present, missing, or unclear. Select five promising concepts and write ERA-specific solution concepts with the problem solved, example journey, minimum required data, proposed UX, AI responsibilities, alternatives, dependencies, failure behavior, and acceptance scenarios. Include rejected ideas and reasons, especially those creating ongoing maintenance.

Write only these new Markdown deliverables:
- docs/era-research/16-product-research/README.md
- docs/era-research/16-product-research/PRODUCT-PATTERNS.md
- docs/era-research/16-product-research/ERA-FIT-ANALYSIS.md
- docs/era-research/16-product-research/SOLUTION-CONCEPTS.md
- docs/era-research/16-product-research/SOURCES.md

State the analyzed commit. Separate CURRENT IMPLEMENTATION, DOCUMENTED INTENT, PROPOSED DESIGN, and UNKNOWN; cite source files for current-state claims. Do not modify application code, existing docs, configs, dependencies, CLAUDE.md/AGENTS.md, skills, or policies. No purchases, account sign-ups, live integrations, deployment, or merging. If public web research is unavailable, clearly say so and provide a sourced-from-repository ERA gap analysis instead of inventing external research. Finish with a bounded consistency check, files created, most useful findings, and unresolved inputs.
```

## [ ] Prompt #3 — Cross-module life journeys

**Claude:** Fable 5.1 / High  
**Codex:** GPT-6 Astra / High  
**Output:** `docs/era-research/03-life-journeys/`

```text
You are analyzing ERA, my full personal AI application. This is a standalone documentation-only task. Inspect its modules, relationships, data sources, and user-facing workflows across the repository. If available in this checkout, consult docs/era-research/01-atlas/ and docs/era-research/08-shared-data/; if absent, inspect the source code directly and do not pretend those packs were available.

Identify the five most valuable plausible journeys that connect ERA modules to complete a real-life outcome, rather than displaying five disconnected screens. Candidate scenarios include a busy week, meals/groceries constrained by a budget, a trip, an upcoming renewal, and translating a goal into commitments. Select based on actual ERA evidence rather than assuming every capability exists.

For each journey document: user goal and trigger; current behavior; proposed end-to-end interaction; which modules participate; source of truth; what the user inputs once; handoff events; AI versus deterministic decisions; permissions/confirmations; exceptions; user-visible completion criteria; and an example with fictional data. Explicitly explain stale, missing, contradictory, or revoked data; duplicate actions; date/time zone issues; and how interrupted work resumes.

Rank opportunities by likely user benefit, reuse of existing work, uncertainty, and maintenance cost. Show where a shared contract is necessary and where a simple module-to-module link is enough. Distinguish a proposed design from a current feature.

Create only new Markdown files in docs/era-research/03-life-journeys/: README.md, CROSS-MODULE-OPPORTUNITIES.md, SHARED-DEPENDENCIES.md, and JOURNEY-01.md through JOURNEY-05.md. Include compact Mermaid diagrams where useful and source references for implementation claims. Record the analyzed commit. Do not change code, existing documentation, policies, configs, dependencies, services, or data. Perform one consistency pass; close with deliverables and unresolved owner decisions.
```

## [ ] Prompt #10 — Capture, navigation, and mobile experience

**Claude:** Fable 5.1 / High  
**Codex:** GPT-6.1 Sol / High  
**Output:** `docs/era-research/10-interaction-design/`

```text
You are reviewing ERA Personal AI's usability. This is a standalone, documentation-only product design task. Inspect the repository's user-interface structure, navigation, state handling, forms, draft flows, and mobile behavior. Review screenshots only if genuinely available; do not claim to have visually inspected pages you cannot render.

Design six complete, low-friction flows:
1. Capture an unstructured thought.
2. Record something quickly without classifying it prematurely.
3. Find and reopen an old item.
4. Understand what actually needs attention.
5. Resume interrupted work.
6. Act on or dismiss an AI recommendation.

For each flow explain what ERA does today (evidence-backed), the friction or uncertainty, a proposed interaction, essential versus optional inputs, screen responsibilities, examples of concise UI copy, error and empty states, undo/correction behavior, and concrete acceptance scenarios. Compare desktop, mobile, keyboard-first, and short-interruption use where relevant.

Look for duplicate controls, noisy headers, unnecessary form fields, repetitive navigation, hidden unfinished work, and places where an AI conversation makes a simple action harder. Propose simplifying or removing features as well as adding them. Avoid designing dashboards that require daily maintenance or creating a generic wishlist.

Create only docs/era-research/10-interaction-design/README.md, INTERACTION-PRINCIPLES.md, CAPTURE-AND-RETRIEVAL-FLOWS.md, HOME-AND-NAVIGATION.md, and ACCEPTANCE-SCENARIOS.md. Separate implemented behavior, documented intent, proposals, and unknowns. Cite repository evidence, record the analyzed commit, and flag anything requiring visual or user validation. Do not implement UI/code changes or edit existing files. Finish with a consistency review and prioritized recommendations.
```

## [ ] Prompt #11 — Personal planning and goal follow-through

**Claude:** Fable 5.1 / High  
**Codex:** GPT-6.1 Sol / High  
**Output:** `docs/era-research/11-personal-planning/`

```text
Design a future personal planning and follow-through experience for ERA. This is a standalone, documentation-only task. Inspect the relevant real repository modules and existing design documents. If docs/era-research/03-life-journeys/ exists, use it; if not, proceed directly from repository evidence. Do not assume ERA currently has goals, routines, calendar sync, or AI scheduling unless the code or docs support that conclusion.

Define how goals, tasks, calendar commitments, recurring routines, contextual constraints, and interruptions should relate. Distinguish fixed commitments, hard deadlines, flexible work, optional ideas, and background reference information. Propose how ERA decides what to suggest, what to defer, and how to explain its recommendation without demanding continual manual estimates.

Work through three complete examples with explicitly fictional data: (A) an ordinary week, (B) an overloaded week, and (C) a disrupted day. In each example show the input state, alternatives, recommendations, what happens when a suggestion is ignored, and how the plan is recalculated. Differentiate RECOMMENDED from ACTUALLY SCHEDULED; never imply a real task or calendar event was created.

Cover competing priorities, stale calendar data, timezone/recurrence changes, missed commitments, approvals for external actions, uncertain available capacity, and minimal notification noise. Give acceptance criteria for a first useful release and specify dependencies and tradeoffs.

Produce only docs/era-research/11-personal-planning/README.md, PLANNING-DESIGN.md, PRIORITIZATION-RULES.md, WORKED-WEEKS.md, and ACCEPTANCE-SCENARIOS.md. State the analyzed commit, cite repo evidence for current behavior, label proposals and assumptions, do not implement or schedule anything, and finish with a bounded review of contradictions and open decisions.
```

---

# Session 4 — Solution Blueprints, Roadmap, and Review

> **Recommended order:** #12 → #17 → #20. Before each task, make sure the useful outputs from Sessions 1–3 are in that task's checkout. A brand-new cloud task may not see files sitting only on a different unmerged branch.

## [ ] Prompt #12 — Three complete future solution blueprints

**Claude:** Fable 5.1 / High  
**Codex:** GPT-6 Astra / High  
**Output:** `docs/era-research/12-solution-blueprints/`

```text
You are a solution architect preparing future options for ERA Personal AI, not implementing changes. This is a standalone documentation-only task. Inspect the current repository and any accessible docs/era-research/ packs, especially the capability atlas, cross-module journeys, memory/context, proactive assistance, interaction design, and product research. Explicitly inventory the packs that are available; do not rely on inaccessible branches or claimed documents.

Identify five worthwhile candidate improvements that could deliver complete personal-life outcomes with less user effort. Compare them using evidence of existing foundations, expected benefit, implementation uncertainty, recurring maintenance, UX complexity, safety, and reversibility. Do not invent usage analytics or claim the user has approved a feature.

Select the strongest three concepts and produce a detailed solution blueprint for each, including:
- Problem statement and concrete fictional user journey.
- Current implementation versus proposed behavior, with source references.
- Goals, non-goals, functional and nonfunctional requirements.
- Minimum useful release and follow-up increments.
- UI/interaction flow, data entities/contracts, AI versus deterministic logic.
- Integrations, authentication/permissions, approvals, logging, and user control.
- Edge cases: missing or stale data, duplicates, interruption, partial success, provider outage, correction/undo.
- Alternatives considered, tradeoffs, architecture/dependency diagram, and implementation boundaries.
- Testable acceptance scenarios, open owner decisions, and reasons not to build the proposal.

Write only new Markdown files in docs/era-research/12-solution-blueprints/: README.md, CANDIDATE-COMPARISON.md, BLUEPRINT-01.md, BLUEPRINT-02.md, and BLUEPRINT-03.md. Make these usable as inputs for later implementation planning but do not write code, create tickets, alter existing docs/policies, or mark proposals approved. Record analyzed commit and input packs; validate internal consistency once; finish with files created and unresolved decisions.
```

## [ ] Prompt #17 — Prioritized roadmap with simplification decisions

**Claude:** Opus 5.5 / High  
**Codex:** GPT-6 Astra / Medium  
**Output:** `docs/era-research/17-roadmap/`

```text
Prepare a development roadmap proposal for ERA Personal AI. This is a standalone documentation-only task. Read the current repository and inventory the docs/era-research/ packs available in this checkout. The solution blueprints from prompt #12 are especially helpful if present. If they are absent, work only from accessible evidence rather than inventing them.

Evaluate potential work using likely user value, quality of supporting evidence, reuse of existing components, dependency order, estimated effort range, uncertainty, security/operational risk, maintenance burden, and reversibility. Consider not only new features but also finishing incomplete workflows, eliminating noisy UI, consolidating duplicate responsibilities, documentation gaps, and doing nothing.

Propose a small, cohesive initial set of improvements. Explain why alternatives should wait or be rejected. Separate necessary foundations from independent user-facing increments. For each candidate, define user benefit, existing foundation, scope, dependencies, relative effort, main uncertainties, acceptance criteria, and conditions for reconsidering the decision.

Produce only docs/era-research/17-roadmap/README.md, PRIORITY-MATRIX.md, DEPENDENCY-MAP.md, and ROADMAP.md. Clearly label every stage as PROPOSED, not committed or scheduled. Do not change ERA's operational backlog, PM/Delivery state, code, existing docs, policies, Git branches, or external systems. Cite repository and input-document evidence; state the analyzed commit and available sources. Finish with a consistency review, owner decisions, and the strongest first implementation candidate.
```

## [ ] Prompt #20 — Independent synthesis and evidence review

**Claude:** Fable 5.1 / High  
**Codex:** GPT-6 Astra / High  
**Output:** `docs/era-research/20-synthesis/`

```text
Act as an independent skeptical reviewer of the ERA Personal AI research and proposed design documentation. This is a standalone, documentation-only review task. Read the current source repository and inventory EVERY docs/era-research/ pack actually visible in this checkout, including packs from prior sessions when available. Do not claim to have read files from another session or unmerged branch.

Verify material claims about ERA against source paths and symbols. Verify changing external claims against cited primary sources where accessible. Review proposed flows, examples, assumptions, data definitions, dependency chains, business rules, and acceptance criteria for contradictions or missing prerequisites.

Look for unsupported certainty, invented personal facts or usage metrics, recommendations that conflict with existing constraints, duplicate scope, unnecessary complexity, insecure action paths, vague acceptance conditions, broken links, and documents that contradict each other. Distinguish CONFIRMED ERROR, UNVERIFIED CLAIM, OPEN DECISION, and EDITORIAL IMPROVEMENT. Provide the exact file, evidence, impact, severity, and proposed correction for each consequential finding.

Create only these new Markdown files:
- docs/era-research/20-synthesis/README.md
- docs/era-research/20-synthesis/REVIEW-FINDINGS.md
- docs/era-research/20-synthesis/DECISION-REGISTER.md
- docs/era-research/20-synthesis/READ-FIRST.md

READ-FIRST.md should direct a future developer or AI assistant to the right existing reference for common ERA questions and identify the best-supported next implementation brief. Do not silently rewrite reviewed files, change policies or code, launch work, or claim proposals are approved. Record the analyzed commit, reviewed file inventory, unavailable inputs, and one complete bounded review pass.
```

---

## Finish and preserve each task

After each task, check the completed file list and diff. Only the intended Markdown files should be added. Keep the branch or PR, and merge it when ready so subsequent tasks can read the outputs. Avoid force-pushing unrelated branches or overriding other work.

## Optional work not included here

The original 20-prompt collection also contains **#2 Product Purpose**, **#9 Integrations**, **#13 Privacy**, **#14 Recovery**, and **#15 Architecture Evolution**. Those were not part of the agreed Session 3 or Session 4 sequences, so they are intentionally **not** included in this file. The [original full prompt pack](https://chatgpt.com/space/page_2df13a7aae9c81919130411a90baeb9c) remains available if you decide to use them.

## References for future model verification

- Claude model lineup: https://platform.claude.com/docs/en/models/overview
- Claude effort levels: https://platform.claude.com/docs/en/build-with-claude/effort
- OpenAI GPT-6 model guide: https://developers.openai.com/api/docs/guides/latest-model
- Codex and Work usage/model selection: https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex

*Model and effort recommendations are snapshots, not permanent facts. Reassess them if the model lineup or your usage limits change.*
