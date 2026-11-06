# ERA Personal AI development roadmap proposal

**Status: PROPOSED — no stage is committed, approved, or scheduled.** Prepared 2026-11-06 (Asia/Beirut). Analyzed commit: `9cd4166691edd9367ea1bd9a604e0bec13ffe870`, plus the accessible local research inputs listed below.

Recommend a small initial set: consolidate draft-confirmation feedback, establish the evidence needed to expose persisted work honestly, and improve access to that work inside existing ERA history. Source-safe recovery is the next conditional investment. Day reset and dinner workflows remain alternatives for later selection, not an automatic queue.

| Document | Purpose |
|---|---|
| [PRIORITY-MATRIX.md](PRIORITY-MATRIX.md) | Candidate tradeoffs, evidence strength, effort ranges, maintenance, risk and reversibility |
| [DEPENDENCY-MAP.md](DEPENDENCY-MAP.md) | Necessary foundations versus independent increments; conditional gates |
| [ROADMAP.md](ROADMAP.md) | PROPOSED stages, candidate scope and acceptance, reconsideration, owner decisions and consistency review |

This pack is a standalone decision aid. Candidate IDs are local references, not tickets. It changes no operational backlog, PM/Delivery state, policy, existing documentation, source code, Git branch, or external system. Acceptance criteria describe future checks, not checks already passed.

## Available research inventory

Before this output, the checkout contained **12 numbered packs, 62 Markdown files within them**, and the separate `RemainingTASKS.MD`. Prompt #12 is present and materially informs this proposal. Numbers **02, 09, 11, 13, 14 and 15** were absent; 17 is this new output. Absence here says nothing about other checkouts. No missing study was reconstructed or invented.

| Pack | Files | Declared baseline | Provenance at start / reading scope in this review |
|---|---:|---|---|
| [01-atlas](../01-atlas/README.md) | 5 | `53443c0` | Tracked; index, architecture/capability context through cited input packs |
| [03-life-journeys](../03-life-journeys/README.md) | 8 | `9cd4166` | Untracked local input; index and its source register/limitations |
| [04-memory-context](../04-memory-context/README.md) | 5 | `22152c2` | Tracked; index, correction/provenance scope |
| [05-proactive-assistance](../05-proactive-assistance/README.md) | 5 | `0b0588f` | Tracked; index and selected attention-rule passages |
| [06-action-execution](../06-action-execution/README.md) | 5 | `beb8584` | Tracked; index; detailed recovery requirements read through blueprint 01 |
| [07-ai-quality](../07-ai-quality/README.md) | 6 | `91c4285` | Tracked; index; evaluations are specifications, not measured results |
| [08-shared-data](../08-shared-data/README.md) | 5 | `77141d1` | Tracked; index; source ownership and contract scope |
| [10-interaction-design](../10-interaction-design/README.md) | 5 | `9cd4166` | Untracked local input; index and Home/navigation proposals |
| [12-solution-blueprints](../12-solution-blueprints/README.md) | 5 | `9cd4166` | Untracked local input; README, comparison, full B1, B2 requirements/minimum release, B3 current-state/minimum-release/acceptance material |
| [16-product-research](../16-product-research/README.md) | 5 | `9cd4166` | Untracked local input; index and stated findings, not fresh vendor research |
| [18-ai-handoff](../18-ai-handoff/README.md) | 4 | `1c586d0` | Tracked; index and authority boundaries |
| [19-business-rules](../19-business-rules/README.md) | 4 | `cacf59d` | Tracked; index and scenario/decision scope |

`RemainingTASKS.MD` was inventoried only. It is not implementation evidence or authority to schedule work. Reading scope is deliberately bounded; this is not a fresh audit of every file in all 12 packs. Untracked inputs are accessible evidence but are **not contained in the analyzed commit**. Their recommendations are not independent user validation merely because several packs repeat them.

## Evidence register

References E1–E9 below are shared by the other three files. Source locations were read in this session. Research proposals remain secondary evidence even where they cite source.

| ID | Evidence | What it establishes and what it does not |
|---|---|---|
| E1 | [Design Doctrine](<../../../ERA Notes/01 - Architecture/Design Doctrine.md>), §§1–6; [Feature Map](<../../../ERA Notes/01 - Architecture/Feature Map/_index.md>) | Capture cost, trust, coherence, reuse and restraint are documented design priorities; no adoption metrics |
| E2 | [DraftsDrawer.tsx:100](../../../src/components/expense/DraftsDrawer.tsx#L100), [useDrafts.ts:302](../../../src/features/drafts/useDrafts.ts#L302), [Drafts overview](<../../../ERA Notes/02 - Standalone Modules/Drafts/Overview.md>) | Drawer and hook both emit confirmation success; hook owns Undo. Transaction and Schedule drafts are distinct concepts. Undo here deletes the created transaction; this read does not prove restoration of the original draft |
| E3 | [state.ts:14](../../../src/features/era/execution/state.ts#L14), [state.ts:82](../../../src/features/era/execution/state.ts#L82), [useEraRuns.ts:7](../../../src/features/era/execution/useEraRuns.ts#L7), [runs route:15](../../../src/app/api/era/runs/route.ts#L15) | Durable execution is flagged; query/API require a conversation; API filters owner, returns up to 100 unfinished plus one latest terminal run. A cross-conversation projection would be new work |
| E4 | [EraRunCards.tsx:41](../../../src/components/era/EraRunCards.tsx#L41), [client.ts:138](../../../src/features/era/execution/client.ts#L138) | Existing progress/source links and controls; completed receipts feed resume. Source effect and journal acknowledgement are separate; journal fencing alone is not effect idempotency |
| E5 | [AI Assistant overview](<../../../ERA Notes/03 - Junction Modules/AI Assistant/Overview.md>), “P0 action trust” and “Final review and hardening”; [assistant Feature Map](<../../../ERA Notes/01 - Architecture/Feature Map/junction/ai-assistant.md>) | Documented rollout/permission/device gates and bounded capabilities; not proof those gates are met today |
| E6 | [Blueprint comparison](../12-solution-blueprints/CANDIDATE-COMPARISON.md), [B1](../12-solution-blueprints/BLUEPRINT-01.md), [B2](../12-solution-blueprints/BLUEPRINT-02.md), [B3](../12-solution-blueprints/BLUEPRINT-03.md) | Recovery, day reset, dinner scope and source-contract risks; reference specifications rather than approved features |
| E7 | [Home/navigation](../10-interaction-design/HOME-AND-NAVIGATION.md), “Consolidate, simplify, or remove” | Direct-control alternatives, duplicate-feedback finding, proposed Home consolidation; visual friction remains a hypothesis |
| E8 | [Attention rules](../05-proactive-assistance/ATTENTION-RULES.md), §§2–11; [AI quality index](../07-ai-quality/README.md) | Proposed silence, dismissal, privacy and evaluation requirements; thresholds are not adopted policy |
| E9 | [Journey index](../03-life-journeys/README.md), “What materially changes the proposals”; [Product research index](../16-product-research/README.md), “Most useful findings” | Broader opportunities and limits: disabled trip cascade, separate purchase/cooking facts, contextual capture already exists; inherited findings, not fresh runtime certification |

## Method and limits

`git rev-parse HEAD` established the commit. Initial `git status --short` showed no tracked modifications and the four untracked packs above plus `RemainingTASKS.MD`. `rg --files docs/era-research` and per-directory counts established the inventory. `git diff --stat 53443c0..HEAD -- src migrations` returned no changes, supporting reuse of earlier source findings within those paths; it does not validate every old prose claim or deployment.

The current repository was sampled through its mandated routing: start-task, Feature Map, Design Doctrine, assistant and Drafts maps/overviews, then relevant source. ERA is a junction; Drafts is standalone. Later source changes require each affected module's own playbooks and contract review. No campaign was worked or promoted into a new queue.

No production database, flags, scheduler, account, device, app render, paid API or external product was inspected. RLS/deployment readiness remains unknown; historical schema/snapshot descriptions in research are not current permission evidence. No user-frequency, savings, adoption or performance figures are invented. Effort ranges are planning judgments with explicit assumptions. No provider/model choice is needed for this proposal.

Final scope/link checks and semantic consistency findings are recorded in [ROADMAP.md](ROADMAP.md). Code tests, UI tests, migrations, PM archival and generated-document sync are inapplicable to these four new documents and were not run.
