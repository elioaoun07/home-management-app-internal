---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: whole-app
evidence_cutoff: 2026-07-11
---

# Global · Vision & Roadmap

> [FABLED+ root](<../_index.md>) · [Global index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · **2 · Vision & Roadmap** · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

The product should become a **household assurance system**: not an app that merely stores what happened, and not an agent that eagerly acts, but a system that knows what is true, what is uncertain, what was agreed, what would happen next, what actually happened, and what should be learned.

The 10× is multiplicative:

`near-zero capture × trustworthy truth × safe decisions × verified outcomes × household consent`

If any factor approaches zero, feature breadth cannot rescue the experience.

## Six portfolio programs

### P1 · Truth Envelope

Create one reusable envelope for derived/imported/external facts:

- source and source reference;
- observed time versus effective time;
- confidence and freshness;
- actor/owner and visibility;
- correction/supersession link.

Start as TypeScript response metadata on statement import, balance freshness, and Google Calendar sync. Do not begin with an 87-table migration.

### P2 · Capability Passport

Every material AI/junction capability declares evidence, permissions, preconditions, risk, deterministic fallback, timeout, proposal renderer, mutation owner, idempotency key, inverse, and tests. The [AI Assistant pack](<../Features/Junction/ai-assistant/_index.md>) contains the prototype.

This is deeper than a capability registry: the registry finds behavior; the passport proves it is safe.

### P3 · Shadow → Suggest → Assist → Automate-with-Undo

No intelligent rule jumps from idea to interruption or mutation. First run it silently, measure would-have-fired content/timing/effect, compare with actual user behavior, then earn suggestion. Automation is the final stage and remains bounded by explicit inverse and policy.

### P4 · Household Decision Protocol

Visibility is not agreement. Add a reusable protocol for the small set of truly joint decisions: proposer, affected people, evidence, required consent, objection, expiry, final receipt, and supersession. Reuse drafts; do not create a second consent engine.

### P5 · Outcome Memory

Capture why a decision was made and what later happened—lightly, only for decisions worth revisiting. This is not the proposed household event spine or daily log. It is a compact question → evidence → decision → review outcome record used by analytics, purchases, allocations, meals, and recurring obligations.

### P6 · Attention Balance Sheet

Measure what the system returns:

- capture taps/time;
- corrections and Undo;
- decisions shortened;
- duplicate work prevented;
- surprises prevented;
- notifications per useful action;
- partner clarification avoided;
- minutes of maintenance added.

Feature ideas that consume more attention than they return fail even when technically impressive.

## Portfolio roadmap

### Horizon 0 · Truth before capability (0–2 weeks)

- Reconcile `safeFetch` 3/5/8-second truth.
- Resolve Focus ownership and other confirmed mapped-path drift.
- Rerun and repair the flexible-occurrence semantic guard.
- Decide which graph artifacts are product evidence versus disposable cache.
- Establish final green typecheck/tests/docs check; measure lint rather than assuming it.

### Horizon 1 · One proven closed loop (weeks 3–6)

Use the active Statement Import / merchant-mapping work as the first proof:

`statement source → parse confidence → import rehearsal → reviewed batch → idempotent receipt → reconciliation → correction learning`

It is ideal because it touches money, deterministic matching, review, bulk mutation, source provenance, and measurable correction.

### Horizon 2 · Junction assurance (weeks 7–10)

- Typed Message Action plan and source-bound receipt.
- Sync receipt and one conflict workbench.
- Notification shadow-delivery proof for one rule.
- Capability Passports for two ERA intents.

### Horizon 3 · Partnership and pruning (weeks 11–13)

- Trial one Household Decision Protocol.
- Delete/merge one duplicate dashboard or dormant module surface.
- Run one partner-led workflow review.
- Score attention returned and decide what **not** to continue.

## New 10× platform opportunities

### V1 · Household Assurance Ledger

A small, queryable view of unresolved uncertainty: stale balance, unverified import, pending sync, conflicting edit, unacknowledged joint decision, expired proposal. It does not create more alerts; it gives every surface a shared truth vocabulary.

- **Smallest proof:** a read-only page/diagnostic over three existing states.
- **Success:** one real uncertainty is resolved before causing correction.
- **Kill:** keep truth badges inside features if a global ledger adds no decisions.
- **Invariant:** absence from the ledger never implies truth when the source is unavailable.

### V2 · Shadow Household

A test/rehearsal environment built from sanitized fixtures and current rule contracts where a proposed notification, import, plan, trip cascade, or AI action can run without mutation. This is not the cashflow What-If Simulator; it is operational preflight for automation.

- **Smallest proof:** statement import + notification rule in one isolated fixture runner.
- **Success:** a seeded duplicate/false alert is caught before live delivery.
- **Kill:** keep separate focused harnesses if a shared runner adds abstraction without reuse.
- **Invariant:** no production credentials or mutation clients.

### V3 · Household Decision Memory

Portable decision records with question, evidence, participants, confidence, choice, review date, and outcome. They bridge Analytics, Purchases, Budget, Meals, Trips, and Hub without becoming a second chat store.

- **Smallest proof:** three manual decisions revisited after 30 days.
- **Success:** at least one future decision becomes faster or better.
- **Kill:** use ordinary notes if records are not revisited.
- **Invariant:** memory cites facts and preserves uncertainty.

### V4 · Assurance Receipts

One visual grammar for material operations: what changed, source, actor, before/after, related effects, sync state, visibility, and inverse. Transfer, import batch, message action, NFC tap, restore, trip activation, and shared decision can reuse it.

- **Smallest proof:** transfer + statement import receipts share a component contract.
- **Success:** users can explain and reverse effects without opening raw tables.
- **Kill:** keep domain-specific layouts if only data contract is reusable.
- **Invariant:** receipt derives from committed result, never optimistic prediction alone.

### V5 · Household Friction Market

Treat attention as scarce capital. Features “bid” for prompts/interruption using measured expected value and regret; low-value prompts stay silent or become on-demand. This goes beyond delivery policy by comparing across modules and including maintenance cost.

- **Smallest proof:** compare five candidate prompts offline using historical outcomes.
- **Success:** fewer prompts produce equal or more useful actions.
- **Kill:** retain per-module policy if cross-module comparison lacks enough data.
- **Invariant:** urgent safety/financial correctness rules remain hard constraints.

## Business plan

### Customer and wedge

**Primary customer now:** exactly this two-person Lebanese household. The product is successful when both people voluntarily rely on it for daily capture and at least one workflow is partner-owned.

**Adjacent future customer:** couples/households underserved by generic single-user finance or task apps—especially dual-currency, uneven connectivity, shared-but-private data, and high manual coordination.

Do not commercialize before the second-user and restore/reliability gates pass. A seeded demo cannot substitute for another real household using it independently.

### Value proposition

“Record household reality once, with near-zero friction; receive trustworthy foresight and coordinated next actions without surrendering control.”

### Defensible assets

1. Longitudinal cross-domain household data.
2. Two-person identity and privacy architecture.
3. Lebanese dual-currency/offline reality.
4. Physical interfaces: NFC, watch, guest, voice.
5. Proposal/Undo trust grammar.
6. The AI-development operating system itself.

### Staged productization

| Stage | Product | Gate |
|---|---|---|
| **0 · Private OS** | One household; maximize trust and partner utility. | Both users weekly-active; restore/export rehearsed; core loops reliable. |
| **1 · Second-household pilot** | Seeded, invite-only deployment with setup/doctor tooling. | A new household reaches first value without repository-author help. |
| **2 · Premium household service** | Hosted private household tier; optional local/self-host export. | Support load, AI cost, privacy, and onboarding economics measured. |
| **3 · Methodology product** | The documentation/agent operating system as a separate developer product. | Proven outside this repository; no distraction from household OS. |

### Business metrics before revenue

- both-user weekly active ratio;
- partner-owned workflow count;
- capture completion and correction rate;
- prevented-surprise count;
- accepted-proposal versus Undo/regret rate;
- useful actions per notification;
- restore rehearsal success;
- AI cost per accepted useful outcome;
- support/maintenance minutes per active feature;
- attention returned minus attention requested.

### Strategic refusals

- No broad multi-tenant rewrite before a second-household pilot.
- No open banking dependency as the product's foundation.
- No autonomous money/schedule writes without reviewed proposal, preconditions, and inverse.
- No new feature module while a dormant/duplicate surface lacks an ownership decision.
- No engagement mechanics that make household maintenance feel like work performance.
- No vendor-dependent identity feature without a proven hello-world and exit date.

