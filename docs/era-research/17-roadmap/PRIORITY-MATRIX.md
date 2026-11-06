# Priority matrix

**Status: PROPOSED — recommendations only; nothing committed or scheduled.** Baseline and sources: [README](README.md). Full scopes and acceptance: [ROADMAP](ROADMAP.md).

## Decision method

Prefer trust and correctness, then lower capture cost, then coherent reuse, then foresight and novelty (E1). A high-value hypothesis cannot compensate for unknown authorization or unsafe replay. Do not total ordinal scores into a false precision ranking. Compare a minimum useful slice against a smaller direct-control change and against doing nothing.

Evidence ratings: **A** = directly inspected source supports the concrete problem/foundation; **B** = accessible research with source references, not fully retraced here; **C** = speculative demand/benefit. All user-value estimates remain hypotheses. Multiple packs citing the same code count as one underlying observation.

Effort is **focused engineer-days**, including scoped review, isolated fixtures, documentation and device acceptance where relevant; not elapsed calendar time or a staffing commitment. Ranges assume a developer familiar with ERA, existing tools, and no new provider. They exclude owner waiting time, production rollout and unrelated defects. Discovering missing source contracts can invalidate a range. Ranges are incremental and not additive into a promised release date.

## Value, evidence, reuse and cost

| ID / candidate | PROPOSED decision | Likely user value | Evidence quality | Existing reuse | Relative effort / range | Main uncertainty |
|---|---|---|---|---|---|---|
| F1 — Bounded readiness and documentation gap closure | Necessary gate for C1/R1; initial set | Indirect but protects truthful availability and recovery claims | A for flag/query boundary; B for rollout gaps | Existing overview, runbook, journal and replay tests | Small, 1–3 days | Enabled flag, applied schema, current permissions, actual interruption point |
| Q1 — One draft-confirmation feedback owner | First implementation candidate; initial set | Modest, immediate: one receipt and obvious Undo | A, duplicate call sites E2; frequency unmeasured | Existing hook and drawer | XS, 0.5–2 days | Whether other callers also add feedback; Undo inverse remains a separate concern |
| C1 — Find persisted unfinished work in existing ERA | Conditional initial user-facing increment | Medium–high if users lose the original conversation | A foundation, B design, C demand | History, run cards, owner-scoped query, artifacts | Small–medium, 2–5 days after F1 | Discoverability, volume, archived conversations, retention; new aggregate query may be unnecessary |
| R1 — Safe continuation for reminder + shopping | Next conditional investment, reduced B1 | High trust value when acknowledgements are lost | A journal boundary; B source-receipt design | Existing executor, consent, source adapters, artifacts | Large, 8–20 days after F1; source audit may reset range | Atomic source receipt/effect support, conflict-safe inverses and live deployment |
| D1 — Reset one to three day commitments | Defer; choose against K1 | High for disrupted days, unmeasured | B (B2), C adoption | Occurrence helper, existing move/placement paths | Large, 8–18 days; excludes shared R1 work | Eligibility, stable occurrence identity, DST and concurrency |
| K1 — One dinner through shopping/cooking | Defer; choose against D1 | High if saved recipes are actively used | B (B3), C recipe quality/adoption | Meal coverage, recipe picker, ingredient route, cooked state | Large, 8–18 days; excludes shared R1 work | Ingredient identity, empty selection, slot conflict and cooking side effects |
| M1 — Source-rich household recall | Defer; can outrank D1/K1 on demand | Medium: fewer unverifiable or ambiguous answers | B (comparison C4), C frequency | Existing memories endpoint and resolver | Medium, 3–7 days after storage/access proof | Schema/access readiness, ambiguity, fact age and correction destination |
| A1 — Bounded proactive suggestion pilot | Defer | Potential foresight, offset by interruption cost | B design E8, C benefit | Existing attention/notification surfaces | Medium–large, 5–12 days for one pull-only situation | Dismissal persistence, evidence freshness, privacy and usefulness |
| N1 — Canonical Home / global Capture-Find-Continue shell | Defer broad redesign | Potential navigation benefit, unvalidated | B structural review E7, C usability | Existing ERA, module links and navigation | Large–XL, 10–25 days discovery-dependent | Installed-app/deep-link expectations, raw-capture storage and retrieval scope |
| X1 — New universal agent/memory/workflow engine | Reject for this proposal | No demonstrated incremental household benefit | C need; E1/E6 argue reuse | Low incremental reuse; duplicates responsibilities | XL, 20–60+ days; low-confidence discovery envelope | Scope unbounded, migration and permissions, no validated unique need |
| Z1 — Keep current behavior | Valid default at every gate | Preserves familiar flows and avoids maintenance; leaves known friction | A for no implementation cost, C for tolerable opportunity cost | Complete reuse | Zero build; 0.5–1 day optional owner walkthrough | Whether friction or interruption risk is actually consequential |

## Dependencies, risk, burden and reversibility

| ID | Required dependency / ordering | Security and operational risk | Maintenance burden (user / engineering) | Reversibility and exit |
|---|---|---|---|---|
| F1 | None; inspect only chosen path | Low if evidence is owner-provided/redacted; no agent production writes | None / low, evidence ages | Close discovery once a gate is answered; no new registry or ongoing audit program |
| Q1 | Call-site trace and scoped verification; independent of F1 | Low presentation risk; preserve money mutation and Undo behavior | Lower noise / low | Revert presentation change without data migration |
| C1 | F1 readiness; privacy and archive policy; not R1 | Medium: private run history/snippets or stale links could leak | No clearing chore / low–medium query/UI upkeep | Remove entry/projection; retain runs and source work |
| R1 | F1 plus source-local receipt contracts, permissions and inverse audit | High: duplicate writes, stale consent, source/journal disagreement | Low when correct / medium–high per-adapter conformance | Disable new dispatch/retry; retain receipts and inspect access. Data/schema rollback is not a UI revert |
| D1 | Its own schedule contracts; shared R1 semantics, not C1 screen | High schedule correctness; external calendars incomplete | Optional review / medium–high | Source-checked inverse only; never restore a whole stale day snapshot |
| K1 | Its own meal/list/cooking contracts; shared R1 semantics, not D1 | Medium–high household writes; dietary claims must stay bounded | Optional cooked action / medium | Reverse unchanged owned contributions only; cannot reverse actual shopping/cooking |
| M1 | Storage/access verification; source ID/age support | High privacy sensitivity despite read-only shape | No mandatory fact review / medium | Remove presentation; do not delete facts or rewrite memories |
| A1 | One trustworthy source, freshness, dedupe/dismissal/silence evaluation | Medium pull-only; high if later push is added | Potential attention burden / medium | Disable pilot and preserve dismissal; no need for cron in pull-only scope |
| N1 | Observed navigation pain, deep-link/install map, retained-work contracts | Medium–high cross-module regression and private search exposure | Should reduce taps / high multi-shell upkeep | Flagged navigation rollback, preserve URLs; no data migration in initial prototype |
| X1 | Proven existing architecture cannot serve a specific outcome; absent today | High new authority boundary and migration exposure | Likely higher / very high | Poor after state migration; rejection is cheaper than later consolidation |
| Z1 | No unresolved demonstrated correctness hazard may be dismissed as “no demand” | No added risk; existing risks remain | Existing burden / no new burden | Fully reversible decision when better evidence arrives |

## Why this differs from blueprint order

E6 recommends B1 → B2 → B3. This proposal keeps B1's trust priority but splits **inspection/discovery (C1)** from **source-safe continuation (R1)** and places the source-confirmed, inexpensive Q1 ahead of both as the first implementation. C1 is not delivery of full B1. F1 includes bounded documentation repair rather than creating another planning apparatus. D1 and K1 are independent options, not mandatory successive releases.

A sensitivity check: if interruptions happen before persistence, C1/R1 lose priority and a separately scoped owner-bound unsent-input recovery study becomes relevant; this pack does not smuggle it into C1. If existing history already solves recovery discovery, choose Z1 for C1. If dinner planning dominates actual use, K1 can precede D1 after its own source gates. If recall is frequent and access/storage are established, M1 can precede both. Known money/schedule correctness failures discovered later supersede convenience work, through a separate authorized task.
