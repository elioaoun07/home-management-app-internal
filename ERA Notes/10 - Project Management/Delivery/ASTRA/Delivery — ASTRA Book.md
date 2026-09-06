---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Delivery — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>). Evidence cutoff: `3106164` (2026-09-02); local session artifacts reviewed 2026-09-06. Deltas [Delivery — Master Book](<../Delivery — Master Book.md>) at `updated: 2026-08-01`, despite later August entries. This is an enhancement study, not a replacement roadmap or permission to lift the Delivery freeze.
>
> Execution sheets: [ASTRA Packets](<Delivery — ASTRA Packets.md>). Shared cost/context evidence and receipt semantics live in [Command Center — ASTRA Orchestration](<../../Command Center/Command Center — ASTRA Orchestration.md>). Cross-surface completion truth is owned by [Command Center — ASTRA Architecture](<../../Command Center/Command Center — ASTRA Architecture.md>) and its CC-3 packet; do not implement that work twice.

## 1 · Book delta

Verification used the book and checklist first, then `git log --since=2026-08-01 --format="%h %ad %s" --date=short -- scripts/delivery scripts/pm/bridge.mjs src/features/pm-live src/components/pm-live`, targeted source reads, and synthetic calls to existing pure functions. The source delta contains `3359188` (2026-08-01), `49c1ddf` (2026-08-06), and `ea7be33` (2026-08-22). No driver, bridge, server, DB operation or product mutation ran.

| Book / brief claim | Repository correction | Consequence / resolution |
|---|---|---|
| Book frontmatter `updated: 2026-08-01` | Its Shipped Log records DLV-85 on Aug6 and DLV-95 on Aug22; the Delivery session log also records DLV-94 on Aug22. | Frontmatter is not a complete freshness boundary. Phase 5 should reconcile the stamp with evidence, preserving dated history. |
| DEEP budget is $5 | `scripts/delivery/config.mjs:229` defaults to $4. DLV-95's Aug22 Shipped Log entry records this reduction. | Use $4 as the source default; a launch can still carry a different explicitly authorized envelope. No external pricing assertion follows. |
| `PHASE_BASELINE_TOKENS` at `recommendation.mjs:55` drives today's headline | `STATIC_USAGE_BY_TIER` is the legacy whole-session estimate. Active headline uses `forecastByPhase` and `STATIC_PHASE_USAGE_ECONOMY` (`recommendation.mjs:78`, `:190`, `:620`). | DLV-86 must fix the active units and sample eligibility. Changing the old 350K/10K pair alone does not fix the forecast. |
| DLV-95 makes usage recording unconditional | Parsing is now after accumulation (`run-session.mjs:4115`, `:4240`), but a successful retry discards earlier failed-attempt totals (`:1772–1793`, `:1832–1863`); REVIEW and UAT share a tick before persistence (`:4214`, `:4716`). | Keep DLV-95's actual repair; do not infer conservation or crash-safe paid-turn boundaries from it. |
| INSTANT matches the approved edit exactly and only marks supported criteria met | Verification checks containment (`instant.mjs:256`, `:259`); `:324–328` marks every AC met when verification passes. `acceptance.mjs:165–166` accepts a changed or existing file as evidence. | Narrow the claim or strengthen the check; this is a trust defect, not another review preference. |
| “No runner-heartbeat watchdog” | Independent five-second heartbeat plus PID/freshness probe already exist (`run-session.mjs:4722–4754`, `:4833`, `:4864`). Missing turn stubs/progress watchdog and state-derived lock expiry are different gaps. | DLV-68/91 reuse existing liveness. Do not create another heartbeat. |
| Every pause/exit has a truthful finish package | Finish writes are best effort and can emit `finish.package.failed` (`run-session.mjs:910–947`). Completed build steps can reappear in remaining work (`finish-package.mjs:83–85`). A local ACCEPTED state and older BLOCKED finish package coexist; see Orchestration's artifact register. | “Artifact exists” does not prove current completion. CC-3 owns consistency; do not rewrite history during this study. |
| First genuine product run has never occurred | Later HUB-1 artifacts show a product attempt and an ACCEPTED state. The inspected 16-state census has one SHIPPED DLV-28 and one ACCEPTED HUB-1; two real product completions are not established. | The Aug6 “never attempted product work” context is historical. Keep the freeze until the required completion evidence exists. |
| DLV-77's missing migration means the live CHECK still rejects approval | The file is missing; bridge INSTANT gate enforcement exists at `scripts/pm/bridge.mjs:785–827`. Neither fact proves the current DB CHECK. | **UNVERIFIED:** owner-supplied current CHECK definition and authorized migration ledger settle it. No DB call was made. |
| DLV-89's experiment is DLV-91 | DLV-91 is lock handling; DLV-92 is the genuine product experiment (`Delivery/4 - Checklist.md:34–38`). | Correct the cross-reference in Phase 5. One confirmation cannot silently remove the three recorded gate decisions or typed risk approval. |

Historical measurements in the book remain historical. A spent-dollar number is not established cash billing when the authentication basis is unknown; DLV-88's distinction remains necessary.

## 2 · Re-scored maturity

**No numerical maturity table exists in the Master Book.** The table below is a **NEW provisional assessment** using its existing M1–M4 milestone names, not a fabricated before/after comparison. Scale: 0 absent; 2 prototype; 4 implemented with reproduced trust gaps; 6 mechanically checked core with operational gaps; 8 demonstrated on repeated real product work; 10 sustained and independently reconstructable. No weighted overall score is asserted.

| Existing milestone dimension | Provisional /10 | Evidence for score | What specifically moves it +1 |
|---|---:|---|---|
| M1 — Governed Start | 5 | Three gates and typed risk checks exist (`state-machine.mjs:28–34`, `:111–119`; `server-routes.mjs:1480–1540`). Cost receipt/boundary gaps can mislead the owner who authorizes the envelope. | Fake-SDK and fake-runner evidence proves cumulative-to-delta cost conversion, all retry spend conserved, and cap crossing during REVIEW prevents UAT. |
| M2 — Right-Sized Delivery | 4 | Distinct lane shapes and scoped INSTANT verification exist; containment and zero-test success overstate confidence (`instant.mjs:209–271`; `run-session.mjs:2306–2374`). | A surplus same-file edit escalates, and zero selected/executed tests never count as passing validation. |
| M3 — Truthful Finish | 4 | Rich finish/acceptance artifacts exist; arbitrary ACs can become met and stale finish state can coexist with current state (`acceptance.mjs:145–166`; `instant.mjs:324–328`; CC-3 evidence). | One criterion-specific proof obligation survives from approved spec to UAT; unsupported ACs remain unmet, and CC-3 exposes stale/incomplete artifacts. |
| M4 — Operability & Proof | 5 | Transcript, decisions, heartbeat and recovery support reconstruction; lock ownership is still state-derived (`server-routes.mjs:83`, `:464–475`). | DLV-91 proves abandoned ownership cannot strand the next session, then DLV-92 records a real product result with owner-attention time and complete artifacts. |

## 3 · Findings, ranked by the Design Doctrine

The order follows Design Doctrine §5: correctness of money/schedule facts → trust → capture speed → coherence → foresight → polish. Delivery spend is an operational cost concern; its false acceptance claims additionally endanger future product money/schedule changes.

### F1 · The cost receipt mixes cumulative, incremental and estimated quantities

**Evidence:** Claude copies `total_cost_usd` into usage (`drivers/claude.mjs:575–596`), streaming returns it unchanged (`:1319`), and the runner adds it as a turn charge (`run-session.mjs:1833–1863`, `:1059–1064`). The Orchestration artifact register reconstructs Aug6 segment 002: cumulative values 0.5935551, 1.2815424, 1.5841152, 1.7604186; incremental differences 0.5935551, 0.6879873, 0.3025728, 0.1763034 match the corresponding token-price estimates.

**Consequence:** Reuse changes the meaning of a reported field. Adding successive cumulative values overstates spend; other paths lose spend. Either direction damages envelope trust. **Priority 1/2.** EXTENDS → DLV-87/DLV-88; ASTRA-DLV-1/2. Authentication/billing basis remains **UNVERIFIED** until the owner supplies the active provider authentication mode; never infer subscription cash charges from SDK telemetry.

### F2 · Failed-attempt spend and the next paid call cross different boundaries

**Evidence:** `bankFailedAttempt` maintains a local bank (`run-session.mjs:1772–1793`), but success returns only the final attempt (`:1853–1863`). REVIEW accumulation at `:4115` precedes another paid call at `:4214`; budget enforcement is at `:4620`, persistence at `:4716`.

**Consequence:** A successful retry can look cheaper than its attempts; crossing a cap in REVIEW does not itself stop UAT. An interruption during UAT can discard the earlier unpersisted REVIEW charge. **Priority 1/2.** EXTENDS → DLV-87; ASTRA-DLV-2. The fix is a paid-attempt receipt and checkpoint in the current runner, not a second accounting subsystem.

### F3 · The acceptance matrix resolves citations, not the claims behind them

**Evidence:** `acceptance.mjs:165–166` accepts changed/existing file paths. `instant.mjs:324–328` assigns every AC the same successful declaration evidence. A read-only synthetic call to existing functions produced `AC1=met/diff, AC2=met/diff, downgraded=[]` for “exactly one offline transaction after reconnection” and “briefing arrives on both physical phones,” with only a synthetic changed filename. No browser, transaction, device or test participated.

**Consequence:** The strongest-looking completion artifact can tell the owner something the runner did not establish. **Priority 1/2.** EXTENDS → DLV-93 validation slot; ASTRA-DLV-5, conditional. File provenance remains useful, but must not satisfy runtime or device-proof criteria.

### F4 · INSTANT checks that the approved edit appears, not that it is the whole edit

**Evidence:** `instant.mjs:189`, `:256`, `:259` perform whitespace-normalized containment. A synthetic four-line diff containing both the declared replacement and an unrelated boolean replacement in the same file returned `{ok:true,failures:[],changedLines:4}`.

**Consequence:** A small unintended change can bypass model review while the record says the approved edit matched exactly. **Priority 2.** EXTENDS → DLV-93 validation slot; ASTRA-DLV-5. No new review agent is required to reject surplus diff lines.

### F5 · Missing review meaning can pass, while zero tests definitely pass today

**Evidence:** REVIEWING only handles `verdict === "BLOCK"` (`run-session.mjs:4172`); other/missing verdicts fall through. Dropped arrays emit diagnostics but do not block (`:4125–4135`). Targeted test command explicitly passes `--passWithNoTests` (`:2307`) and accepts exit zero (`:2362`).

**Consequence:** “No valid verdict,” “no tests ran,” and “passed” can converge on the same next state. **Priority 2.** EXTENDS → DLV-90 and DLV-93; ASTRA-DLV-4/6. ASTRA-DLV-6 is an alternative to ASTRA-DLV-5 within the single post-experiment validation-fix allowance, not an automatically additive commitment.

### F6 · Throughput is treated as resident context, then rotation discards the context it assembled

**Evidence:** `usage.mjs:137–141` sums input/read/write; the runner feeds aggregate result usage to it (`run-session.mjs:1752`, `:626–629`). Thresholds can trigger rotations (`context-policy.mjs:65–76`). Orchestration's deduplicated Aug6 inspection found 37 requests totaling 2,020,276 input-side tokens, with maximum/latest request context 131,439. Rotation writes `renderedMd` and clears the driver reference (`run-session.mjs:499–563`); explicit handoff, unlike rotation, inserts the rendered package into the next prompt (`:681–687`).

**Consequence:** A long tool loop can create false context pressure; resetting then omitting the already-built digest forces re-exploration. **Priority 3/4.** EXTENDS → DLV-69; ASTRA-DLV-3/7 remain held by the execution freeze unless an authorized product-run finding permits them. Unknown request context must stay unknown, not be guessed from throughput.

### F7 · The active forecast's measured branch mixes a phase total with a per-traversal unit

**Evidence:** History takes ACCEPTED/SHIPPED `usage.perPhase` totals (`server-routes.mjs:401–428`). `estPhaseUsage` takes their median (`recommendation.mjs:115–128`), then `:190–194` multiplies by expected traversals. A three-sample synthetic history of BUILDING totals 300 yields 900 for an M item with three expected steps. The local inspected history has no tier with three eligible samples, so today's measured branch is not proven active.

**Consequence:** Once history is large enough, more measured data can produce a worse estimate by multiplying an already-total phase. **Priority 2/5.** EXTENDS → DLV-86; ASTRA-DLV-8 follows receipt repairs. No confidence-band platform or external pricing update is part of this fix.

### F8 · Recovery and ownership are recorded, but their semantics remain incomplete

**Evidence:** `finish-package.mjs:83–85` lists all plan steps when `build:null` outside SHIPPED; `run-session.mjs:3785` sets that value after build completion. A pure REVIEWING fixture returned a completed S1 as remaining. Build locks include ACCEPTED and stopped review states without checking liveness (`server-routes.mjs:83`, `:464–475`). Finish writes catch failure (`run-session.mjs:910–947`).

**Consequence:** A successor can repeat completed work, and an abandoned session can prevent another launch. **Priority 2/3.** EXTENDS → DLV-91/DLV-68 and CC-3; retained as held findings, not more immediate architecture packets.

## 4 · Enhancement catalog

These are refinements to existing work, not eight extra allocations. Sizes are upper bounds for one 2–4h session; split at S6 if implementation exceeds the boundary. No L work is authorized. Each sheet states the product item it unblocks.

| Rank | Study ID | User-visible outcome | Size | Severity | Mapping and dependency |
|---:|---|---|:---:|---|---|
| 1 | ASTRA-DLV-1 | Reused SDK sessions record each charge once in the correct unit. | M | blocker | EXTENDS → DLV-87/DLV-88; before 2/8 |
| 2 | ASTRA-DLV-2 | A paid retry is counted and an exhausted review cannot start UAT. | M | blocker | EXTENDS → DLV-87; after 1 |
| 3 | ASTRA-DLV-4 | A targeted validation with zero tests is visibly untested. | S | friction | EXTENDS → DLV-90; existing prerequisite queue |
| 4 | ASTRA-DLV-5 | INSTANT cannot accept surplus edits or unsupported acceptance claims. | M | friction | EXTENDS → DLV-93 validation slot; after 4 and DLV-92; competes with 6 |
| 5 | ASTRA-DLV-6 | An unreadable review parks with its spend preserved. | S | friction | EXTENDS → DLV-93 validation slot; after 2 and DLV-92; alternative to 5 |
| 6 | ASTRA-DLV-3 | Context status reflects one request's footprint instead of accumulated traffic. | M | friction | EXTENDS → DLV-69; held pending freeze eligibility |
| 7 | ASTRA-DLV-7 | A rotated session receives the existing digest exactly once. | M | friction | EXTENDS → DLV-69; after 3 and freeze eligibility |
| 8 | ASTRA-DLV-8 | Forecasts do not multiply historical phase totals twice. | M | friction | EXTENDS → DLV-86; after 1/2; clean samples only |

At six M and two S, the complete catalog costs up to seven sessions, about 3.5 weeks at the plan's two-session weekly capacity. **It is not an immediate seven-session tooling wave.** DLV-92/93 require real product work between allowed remedies; 5 and 6 compete; 3/7 remain held. Keep product work first and use direct governed execution if the owner chooses it; do not make all study findings launch prerequisites.

## 5 · What ERA needs from Delivery

Delivery is a development system, not household domain data. It must not inject session costs, errors or internal paths into the household briefing merely because a relay exists.

| Existing Top Layer dependency | What Delivery contributes | What is missing |
|---|---|---|
| HUB-37 / E-01 correctness gates | Test selection and honest executed-test evidence for the ERA regression suite | ASTRA-DLV-4; real CI evidence remains E-01's job |
| HUB-47 / E-11 outcome correctness | Review/acceptance proof that failure does not become success | ASTRA-DLV-5 or 6 after the freeze gate, plus paid-turn conservation |
| HUB-46 / E-09 durable capture | Reliable completion evidence for offline replay, atomicity and reconciliation tests | Domain proof belongs to the Top Layer packets; a file citation cannot certify it |
| E-04 signal composition | No household signal producer is required from Delivery | None: keep `src/lib/briefing/signals.ts` domain-focused |
| ERA capability registry | No Delivery write capability is proposed | Grants remain inside the existing Delivery gates; conversational convenience is not authorization |

**NEW, parked frontier:** existing packet, turn, validation and acceptance artifacts could replay the *evidence chain* of a completed product task without calling any model. Reconsider only after two genuine completions, and only if a bounded prototype reconstructs both runs with zero semantic inference and reduces owner review time by at least 30%. This is an evaluation experiment, not an agent or an ERA capability.

## 6 · Do not do

- **Do not enlarge the orchestration system before two genuine completions.** The Aug6 freeze in the checklist is explicit; parallelism, lane collapse, confidence-band calibration and the parked six-outcome design stay parked.
- **Do not reinterpret DLV-89 as permission to skip gates.** Existing state-machine and server checks are the contract. A new scoped amendment must be recorded before any conflicting behavior.
- **Do not calibrate from damaged receipts.** DLV-86 requires clean receipt provenance, cumulative/delta cost units, conserved returned attempts and explicit traversal counts; ambiguous or duplicate historical rows stay ineligible. Context semantics are separate held DLV-69 work, not a prerequisite for ASTRA-DLV-8. Retain originals; no in-place rewrite of historical session accounting is authorized here.
- **Do not add another digest, lock or heartbeat engine.** The digest and heartbeat already exist; consumption and ownership are the missing connections.
- **Do not add a reviewer to compensate for a missing boolean/schema check.** Reject surplus edits and invalid verdicts in the existing deterministic boundary.
- **Do not blanket-convert the lint debt.** DLV-52/84 remain module-sized work with domain tests; adding a ledger entry is not repair.
- **Do not claim provider billing, current pricing, DB CHECKs or physical phone behavior from local source.** Each requires its named external/owner evidence; none was accessed here.
- **Do not execute suggested git recovery commands.** Artifact generation is not authorization for git writes.

## 7 · Coverage note

Delivery owns `scripts/delivery/`, its desktop feature under `scripts/pm/src/features/delivery/`, and Delivery command/session behavior through `scripts/pm/bridge.mjs`, `src/features/pm-live/` and `src/components/pm-live/` (Master Book Identity & North Star). These are project tooling surfaces rather than new Standalone product modules.

PM corpus parsing, board navigation, offline bundle freshness and PM UI consistency belong to [PM Tooling — ASTRA Book](<../../PM Tooling/ASTRA/PM Tooling — ASTRA Book.md>). Shared relay/desktop/phone contracts live in Command Center. Household Sharing and Sync & Offline are not silently transferred to Delivery because the phone uses the same deployment.

Study verification was source inspection plus synthetic pure-function execution. Implementation gates in the companion sheets are **NOT RUN**. Existing PM lint has the already-recorded missing DLV-77 migration-link error; no checklist or Master Book changed here. Phase 5 owns defect injection, numbering, the final contradiction register and lint reconciliation.

## ASTRA 10× Findings

**High-confidence leverage moves (3):**

1. **EXTENDS → DLV-87/DLV-88:** normalize one paid-attempt receipt before budgets, history and UI read it. Cumulative cost reuse and retry loss currently pull totals in opposite directions (F1/F2); one correct boundary improves all three consumers.
2. **EXTENDS → DLV-90/DLV-93:** make proof criterion-specific. Existing diffs/tests already contain useful evidence; F3–F5 show the damage comes from accepting weaker evidence as stronger proof.
3. **EXTENDS → DLV-69, held:** correct context units and consume the digest already assembled. F6 removes unnecessary re-exploration without adding an AI call.

**Simplification / deletion (1):** **EXTENDS → DLV-69:** remove aggregate-throughput-as-occupancy from rotation decisions. Preserve throughput for cost analysis; it cannot describe one request's resident context (`usage.mjs:137`; `context-policy.mjs:65–76`).

**Frontier (1):** **NEW, parked:** replay the artifact evidence chain for two completed product tasks with zero model calls; require the §5 accuracy and 30% owner-time threshold before any new packet.

**Uncomfortable finding (1):** The runner can rigorously prove a file changed and then label unrelated offline/device criteria met. Its “runner confirms” slogan currently exceeds what its acceptance algorithm confirms (`acceptance.mjs:165–166`; `instant.mjs:324–328`). More elaborate governance cannot compensate for that category error.
