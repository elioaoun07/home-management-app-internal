---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Command Center — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Source cutoff `3106164`; local session artifacts inspected read-only on 2026-09-06. Deltas [Delivery Master Book](<../Delivery/Delivery — Master Book.md>) `updated: 2026-08-01` and [PM Tooling Master Book](<../PM Tooling/PM Tooling — Master Book.md>) `updated: 2026-08-03`; Delivery contains later August entries.
>
> Evidence: [Architecture](<Command Center — ASTRA Architecture.md>), [Experience](<Command Center — ASTRA Experience.md>), [Orchestration](<Command Center — ASTRA Orchestration.md>). All implementation gates below are **NOT RUN**. No application code, DB calls, queue injection or parent-document edits are authorized by this Phase 3 study.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-CC-1 | EXTENDS → DLV-72 | DLV-72 | HELD; after CC-2 and owner selects ONE reliability slot |
| ASTRA-CC-2 | EXTENDS → DLV-72/R37 | DLV-72 | HELD; independent candidate for ONE reliability slot |
| ASTRA-CC-3 | EXTENDS → DLV-93 | DLV-93 | HELD; candidate ONE reliability slot, product run still required |

## 1 · Reconciliation and admission

| Study packet | Classification | Existing seam refined | Product work unblocked | Admission |
|---|---|---|---|---|
| ASTRA-CC-1 | EXTENDS → DLV-72 | Phone command receipt observation | Bounded HUB-47/E-11 product session, controlled without repeating successful actions | After CC-2; conditional DLV-93 reliability selection |
| ASTRA-CC-2 | EXTENDS → DLV-72 / R37 | Verified-owner cache and complete snapshot reconciliation | Correct HUB-37/E-01 or HUB-47/E-11 session appears after reconnect/account change | Conditional DLV-93 reliability selection; no CC-1 prerequisite |
| ASTRA-CC-3 | EXTENDS → DLV-93 | Current finish evidence on existing surfaces and salvage | Trustworthy HUB-47/E-11 acceptance and resumption review | Conditional single reliability selection; no new terminal state |

These are three M refinements, not three automatic slots before product work. CC-1 depends on CC-2; they cannot both be squeezed into DLV-93's one reliability allowance. If CC-2 is not already complete, select CC-2 and defer CC-1 to a later permitted slot. CC-3 competes for the same allowance. The owner selects from demonstrated product-run needs; this study does not declare all necessary before DLV-92.

Keep the August 6 Delivery freeze, the three human gate decisions, the existing INSTANT exception, typed risk acknowledgments and owner-marked SHIPPED. The local August 22 HUB-1 ACCEPTED record is evidence of a product attempt, not proof of two completed product experiments. DLV-92's pilot must be nonvisual, 3–8 files, outside payment/auth/security/migration/RLS work, and fit its operating constraints. The bounded template-success portion of HUB-47/E-11 is a candidate only after discovery verifies that exact scope.

Other work is already packeted: [Delivery Packets](<../Delivery/ASTRA/Delivery — ASTRA Packets.md>) owns cost, validation, review, context and forecast; [PM Tooling Packets](<../PM Tooling/ASTRA/PM Tooling — ASTRA Packets.md>) owns desktop item/Undo identity, build compatibility, legacy retirement, checked JSDoc and diagnostic enforcement. Do not duplicate those implementations here.

**Held existing work:** DLV-68/91 retains durable attempt reservation, unfinished-attempt recovery, progress detection and ownership release. A durable bridge-side command receipt before claimed-command replay is a held DLV-93 refinement. None of the three sheets below fixes a bridge crash by resetting claimed commands to pending.

## 2 · Shared execution contract — copy with each dispatched sheet

**PM allowlist P:** `ERA Notes/10 - Project Management/Delivery/4 - Checklist.md`; `ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md`. Touch only the named parent and its implementation evidence during future execution. No canonical ASTRA prefix or new DLV integer is allocated here; Phase 5 owns registration and injection. A child implementation never closes an incomplete parent.

**Forbidden F:** `src/components/ui/**`; `src/components/hub/HubPage.tsx`; `migrations/schema.sql` without a paired migration; all paths outside the sheet's exact list plus P. Also forbidden: git writes, worktrees, `bypassPermissions`, provider calls during validation, live DB operations, historical session rewrites, new dependencies, new queue/state machine/command authority, and `/era` layout changes. Future fixture tests must isolate file writes from the real PM corpus and run with mocked Supabase and fake drivers.

**Common gate G:** named tests execute with nonzero selected cases and exit 0; `pnpm typecheck`, `pnpm lint`, `pnpm pm:lint` each exit 0; no required test count decreases. Record exact output, tested source revision and fixture provenance. The current missing DLV-77 migration link is an existing PM lint blocker for separately authorized Phase-5 resolution; do not invent SQL to silence it. `tests/**/*.test.ts` is in the current Vitest include; `*.test.tsx` is not. The new tests below use the existing Node environment and mocked/injected seams, not an unapproved browser-test dependency.

**Common NOT done N:** migration written ≠ **APPLIED**; test file ≠ test in CI include; source assertion ≠ installed-phone proof; emitted diagnostic ≠ enforced refusal; “works locally” ≠ evidence pasted; child shipped ≠ parent done.

| STOP | Condition; any one requires a five-line handoff |
|---|---|
| S1 | An edit outside the exact allowlist is needed. |
| S2 | A DB write is required; hand the owner a manual runbook under Hard Rule 26. |
| S3 | Tests decrease, a required check is red, or a named regression executes no cases. |
| S4 | HubPage grows or imports of its internals are added. |
| S5 | A new dependency is required. |
| S6 | The bounded outcome will not finish in one 2–4h session; split before widening work. |
| S7 | A visibility/permission symptom appears; obtain fresh owner DB-state evidence or Hard Rule 27's two untruncated queries before diagnosing routes. |
| S8 | Money/schedule semantics are ambiguous; ask one focused question, never assume. |
| S9 | An AI proposal would write domain state without confirmation. |
| S10 | A second engine, queue, parser, toast system, regex or aggregate for an existing concept is introduced. |
| S11 | Work enters D2's entirely excluded scope. |
| S12 | Existing `/era` elements are moved or restyled. |

Read the current feature routing and relevant Master Book before execution. For relay verification, code may be exercised with mocks. Only the owner can supply current DB facts or execute live command/device tests. The stale August 4 snapshot and source comments do not establish current constraints, policies or authorization.

## ASTRA-CC-1 · Reconcile the same phone command after acknowledgment loss · M · E · conditional DLV-93 reliability slot

**Outcome:** The phone retains an uncertain action and resolves its original command instead of encouraging another submission.

**Prereqs:** ASTRA-CC-2 completed in an already permitted slot; owner selects this demonstrated DLV-93 reliability need. Owner provides fresh table/constraint/policy evidence confirming the existing `pm_commands.id` accepts an explicit client UUID and the authenticated owner can query that row. Migrations required **APPLIED:** none if that existing contract is confirmed; otherwise STOP and commission a separate manual migration packet. No claim about live RLS follows from this sheet.

**Skills:** `start-task → fix-bug → ui-guardrails → finish-task`; read Sync and Offline/Common Patterns for the existing receipt/cache boundary. This command protocol is separate from household-domain offline mutations.

**Files:** `src/features/pm-live/usePmLive.ts`; `src/features/pm-live/types.ts`; `src/features/pm-live/store.ts`; `src/features/pm-live/cache.ts`; `src/features/pm-live/commandReceipt.ts` **[NEW, pure coordination helper if needed]**; `src/components/pm-live/CaptureSheet.tsx`; `src/components/pm-live/LaunchSheet.tsx`; `src/components/pm-live/session/SessionDetailView.tsx`; `src/components/pm-live/session/panes.tsx`; `src/components/pm-live/shell/UndoStrip.tsx`; `src/components/pm-live/views/DeliveryView.tsx`; `tests/pm-live-command.test.ts` **[NEW]**; plus P. F applies. The six UI consumers receive only the typed uncertain-result/pending-state adaptation; no layout or flow redesign. Bridge, migrations and domain offline queue files are outside this sheet.

**Implementation boundary:** The current hook inserts before registering its waiter and treats elapsed time as failure (`usePmLive.ts:147–161`). Allocate an ID once per authorized action, register observation before insert, and submit that ID. Realtime and authenticated same-ID status reads feed one idempotent settlement function. Requery after insert/reconnect and on timeout; distinguish confirmed terminal failure from transport uncertainty. An insert response lost after server commit is uncertain, not a reason to mint a new ID. A 0-row read after an uncertain insert is not proof of no effect when visibility is unverified.

Keep an unresolved receipt pointer in CC-2's owner-bound cache: command ID, owner and minimum action correlation, not a replayable queue or copied raw command payload. Persist and verify that pointer before insert; if storage fails, do not submit an action whose identity cannot survive reload. Snapshot trimming and its size guard must preserve unresolved pointers instead of deleting the entire envelope. Mount/reconnect queries existing IDs; it never inserts from cache. User/auth changes cancel prior-owner observers. Subsequent taps for the same unresolved action reconcile its ID, not another insert; unrelated work remains available. Preserve input and existing pending presentation while uncertain. A confirmed result settles once and refreshes existing read state. Unknown status must not fall through callers' current generic failure branches or falsely close capture/advance launch. This is one hook/result contract with mechanical consumer changes; S6 applies if wider UI work appears.

The bridge's claimed-after-crash case remains unknown unless existing status changes or owner reconciliation supplies evidence. This packet claims acknowledgment recovery, **not** server exactly-once execution or safe replay of an interrupted side effect. It does not widen mobile gate eligibility.

**DB change?** No planned change. Existing authenticated command insert/read contract only; all automated verification mocked. Never execute live inserts or status queries during agent validation.

**AI call added?** No.

**Money/schedule math?** No. No household writes or budget formulas change.

**Gate:** `pnpm exec vitest run tests/pm-live-command.test.ts --reporter=verbose` → exit 0, nonzero cases. Required fixtures: terminal UPDATE before insert returns; missing UPDATE followed by successful query; insert committed but response lost; timeout while claimed; repeated tap while unresolved; reconnect/reload same-owner pointer; account change during in-flight read; duplicate terminal delivery; pointer persistence failure before insert; snapshot quota trimming with an unresolved receipt. Assert exactly one insert for each successfully persisted authorized action, zero inserts when receipt persistence fails, all recovery reads use the original ID/owner, no cache-driven insert, no settled result applied to another owner, and no false failure/success for unknown. Assert the shared pending/result projection consumed by all six callers. Then G. Owner's 390×844/installed-phone fixture capture records input retained during uncertainty and the same command receipt resolving; no explanatory UI copy required.

**PM:** Leave DLV-72 open until its original phone/live criteria also pass. Partial Shipped Log sentence: `- ✅ YYYY-MM-DD — **DLV-72** (ASTRA-CC-1 partial) Phone commands reconcile one identity across acknowledgment loss; uncertain actions never auto-resubmit (mocked ordering tests and owner device receipt: <evidence>).` Record DLV-93's selected reliability slot without closing its required second product run.

**NOT done:** N applies. Timeout handling ≠ bridge crash recovery; client UUID ≠ authority; same-ID query ≠ proof of current policies; one passing happy path ≠ no duplicate action after lost acknowledgment.

**STOP:** S1–S12, P/F/G/N above apply in full. Product item unblocked: bounded HUB-47/E-11 review/control.

## ASTRA-CC-2 · Bind cached snapshots to the verified owner and replace full reads · M · E · conditional DLV-93 reliability slot

**Outcome:** The phone shows only the verified owner's snapshot and removes rows absent from a successful complete refresh.

**Prereqs:** Owner selects this evidenced reliability scope under DLV-93; record current cache/store fixtures before editing. Independent of CC-1. Migrations required **APPLIED:** none. Actual owner visibility/policy questions remain owner-verified; this sheet fixes demonstrable client-state behavior with synthetic owners.

**Skills:** `start-task → fix-bug → finish-task`; read Common Patterns and Sync and Offline. No new query cache, persistence engine or authentication mechanism.

**Files:** `src/features/pm-live/cache.ts`; `src/features/pm-live/store.ts`; `src/features/pm-live/usePmLive.ts`; `src/features/pm-live/types.ts`; `tests/pm-live-cache.test.ts` **[NEW]**; `tests/pm-live-store.test.ts` **[NEW]**; plus P. F applies. No visual component changes, bridge or schema changes.

**Implementation boundary:** The current unscoped cache hydrates before `getUser()`; `setUserId` leaves previous snapshots intact; complete reads discard errors and merge rows (`usePmLive.ts:35–50`, `store.ts:73–107`). Add owner and payload-format identity to the existing cache envelope. Hydrate only after the current authenticated owner is verified; discard legacy/unscoped or incompatible entries rather than guessing ownership. When identity cannot be verified, do not expose private cached payload; retain existing navigation shell. Auth change/sign-out resets private store data, cancels prior-owner reads and prevents delayed cache writes from restoring it. Do not turn this into a new offline-auth system.

Separate authoritative full replacement from incremental row updates. Only a successful complete read replaces all recognized snapshot keys and the session map; a successful empty read clears them. Failed reads retain stale same-owner data and a machine-readable failure/loading state, never `rows || []` treated as success. Synchronize subscription and initial/reconnect refresh so a delayed old response cannot replace a newer owner's or newer generation's rows. Carry the existing publisher's `updated_at` row revision (`bridge.mjs:947–954`) through full reads and deltas, subject to the verified existing column contract. Buffer deltas while a full read is in flight, compare revisions before replay, and reject an older UPDATE against a newer full-read row. Missing/ambiguous ordering, including a delayed DELETE with insufficient revision information, remains stale and requests bounded reconciliation; do not blindly replay it over newer data. Bound the transient buffer; reconnect starts a new complete reconciliation. It is not a durable queue or a new DB sequence.

Preserve existing snapshot/event limits and selector granularity. Cache timestamps measure cache age, not live authorization or bridge progress. No owner inference from embedded names, theme, household or last-known global state.

**DB change?** No. No change to RLS or policies is proposed or inferred. Mocked client responses suffice for implementation tests.

**AI call added?** No.

**Money/schedule math?** No; PM projection only.

**Gate:** `pnpm exec vitest run tests/pm-live-cache.test.ts tests/pm-live-store.test.ts --reporter=verbose` → exit 0, both files execute nonzero cases. Required fixtures: legacy cache; owner A cache then owner B; unverifiable auth; sign-out during delayed read/cache timer; same-owner stale cache with failed refresh; authoritative empty read; missed DELETE then complete refresh; older buffered UPDATE after a newer full-read row; ambiguous delayed DELETE/recreation; unknown row kind; oversized cache. Assert private data never appears under an unverified/different owner, stale reads cannot restore deleted/new-owner data, full success replaces absence, failed read retains stale same-owner state, older deltas cannot overwrite newer rows, ambiguous ordering requests bounded reconciliation, and event/size bounds persist. Then G. Owner's two-account device fixture verifies cache isolation and reconnect removal; device proof remains separate from mocked checks.

**PM:** Leave DLV-72 open until all original relay/device criteria pass. Partial Shipped Log sentence: `- ✅ YYYY-MM-DD — **DLV-72** (ASTRA-CC-2 partial) Phone cache is owner-bound; successful complete reads replace snapshots and failed reads preserve explicit staleness (auth-switch/reconnect fixtures: <evidence>).` Reference R37's provenance goal without ticking desktop/static work. Record the single DLV-93 reliability selection; no blanket completion.

**NOT done:** N applies. Cache ownership ≠ live RLS verification; fresh heartbeat ≠ fresh task snapshot; merging successful rows ≠ removing absent rows; cached identity ≠ current authentication.

**STOP:** S1–S12, P/F/G/N above apply in full. Product items unblocked: accurate HUB-37/E-01 and HUB-47/E-11 session review.

## ASTRA-CC-3 · Refresh and verify finish evidence across existing surfaces · M · E · conditional DLV-93 reliability slot

**Outcome:** Desktop, phone and salvage agree whether a session's finish package describes its current outcome.

**Prereqs:** Owner selects the reproduced HUB-1 finish inconsistency as DLV-93's reliability need. Read the local state/finish metadata and current acceptance writer; tests use redacted synthetic equivalents. Independent of CC-1/2 and held DLV-68 attempt reservation. No requirement to complete all Delivery validation packets first: this sheet verifies coherence, not semantic correctness of every acceptance claim. Migrations required **APPLIED:** none.

**Skills:** `start-task → fix-bug → ui-guardrails → finish-task`.

**Files:** `scripts/delivery/run-session.mjs`; `scripts/delivery/finish-package.mjs`; `scripts/delivery/server-routes.mjs`; `scripts/pm/bridge.mjs`; `scripts/pm/src/features/delivery/SessionDetail.jsx`; `src/features/pm-live/types.ts`; `src/components/pm-live/session/panes.tsx`; `tests/delivery/finish-package.test.ts`; `tests/delivery/run-session.test.ts`; `tests/delivery/server-routes-salvage.test.ts`; `tests/pm-bridge.test.ts`; plus P. F applies. No new route, state, action, artifact browser, transcript format or journal.

**Implementation boundary:** `consumeUatDecision()` returns ACCEPTED without writing finish files (`run-session.mjs:4341–4360`); the SHIPPED path already writes them (`:4373–4383`). On acceptance generate the existing package from the resulting state. Preserve existing terminal/failure writers. Fix the producer's related semantics: `finish-package.mjs:83–85` interprets cleared completed `build` state as all steps remaining; `:115` interprets any non-SHIPPED reason as incomplete exit. ACCEPTED remains accepted/awaiting owner shipment, not an unfinished build or owner SHIPPED. Determine completed work from existing progress/acceptance facts; unknown historical progress stays unknown.

Include a stable fingerprint of the semantic inputs summarized by the package and content hashes/generation for its component files. Do not fingerprint `state.updatedAt`: `persistState()` refreshes it during routine persistence (`:214`). Exclude poll/heartbeat bookkeeping. Write the commit manifest last; the current manifest-first order can expose mixed generations (`finish-package.mjs:299`, runner writer `:922`). Derive current/stale/missing/unverifiable integrity from existing files without changing them on GET. Historical packages without matching provenance stay unverifiable; never regenerate the owner's history during a read.

Compute the result once at `getSession()` (`server-routes.mjs:644–659`). Bridge `buildSessionSnapshot()` already calls that API (`bridge.mjs:972–986`): forward the same small result rather than reimplementing verification in `buildSessionExtras`. Use desktop's existing Artifacts area (`SessionDetail.jsx:55`) and phone `ArtifactsPane` (`panes.tsx:242`); no new screen. Before salvage or continuation consumes remaining-work files (`server-routes.mjs:1036,1161`), require the same integrity evidence; stale material cannot silently become the successor work contract. Preserve the original terminal/owner-governance distinctions.

This is one producer/read-contract change with two small presentation adapters. S6 stops broader crash-recovery architecture. A valid fingerprint proves agreement with inputs, not that a changed filename proves a phone outcome; ASTRA-DLV-5/6 owns that different problem.

**DB change?** No. Existing relay payload gets optional derived metadata; no new row kind, command or policy. Agent verification uses mocked bridge calls only.

**AI call added?** No; no model-generated summary.

**Money/schedule math?** No. Spend is passed through with existing provenance; this sheet does not recompute cost or edit money/schedule state.

**Gate:** `pnpm exec vitest run tests/delivery/finish-package.test.ts tests/delivery/run-session.test.ts tests/delivery/server-routes-salvage.test.ts tests/pm-bridge.test.ts --reporter=verbose` → exit 0; all four files execute cases. Fixtures: crash→resume→accept; accept→owner ship; completed build with cleared transient state; partial component write; routine updatedAt-only change; changed decision/validation input; missing provenance; historical ACCEPTED/BLOCKED mismatch. Assert current state is preserved, semantic change invalidates stale package, timestamps alone do not, commit manifest never certifies mixed contents, both surfaces receive identical integrity metadata, GET leaves files untouched, and stale remaining work cannot authorize continuation. Then G. Fixture desktop and 390×844 phone captures use the same session and show agreement without new explanatory prose.

**PM:** Leave DLV-93 unchecked until its required product experiment and permitted-fix sequence complete. Partial Shipped Log sentence: `- ✅ YYYY-MM-DD — **DLV-93** (ASTRA-CC-3 reliability partial) Acceptance refreshes finish evidence; desktop, phone and salvage share generation verification and reject stale continuation inputs (fake-runner and fixture evidence: <evidence>).` No owner SHIPPED decision is synthesized.

**NOT done:** N applies. Current fingerprint ≠ truthful criterion semantics; acceptance ≠ SHIPPED; file presence ≠ matching generation; integrity checks ≠ unfinished-attempt accounting/recovery; historical mismatch exposed ≠ historical record repaired.

**STOP:** S1–S12, P/F/G/N above apply in full. Product item unblocked: bounded HUB-47/E-11 outcome and continuation review.

## 3 · Review handoff

A successor receives one sheet plus the shared P/F/G/N/STOP block, its evidence links, actual admitted parent and the current verified source revision. It does not receive blanket authorization for the entire catalog. All eight Phase 3 documents leave application implementation, owner DB work, device proof, Phase-5 ID reconciliation and checklist injection outstanding.

**UNVERIFIED:** live relay constraints/policies, billing basis, installed phone behavior and two real product completions. Respectively settle with owner-supplied current DB-state/CHECK/policy output, provider account-settings classification, the specified device captures, and the two DLV-92/93 outcome records with owner completion evidence.

## ASTRA 10× Findings

- **Leverage 1 — EXTENDS → DLV-72:** one owner-bound command receipt resolves lost acknowledgments without another queue. CC-1 removes repeat-action uncertainty for HUB-47/E-11.
- **Leverage 2 — EXTENDS → DLV-72/R37:** split full replacement from deltas and bind cache to verified identity. CC-2 repairs reconnect truth without merging the React and Preact apps.
- **Leverage 3 — EXTENDS → DLV-93:** reuse one finish-integrity result at desktop, relay and salvage. CC-3 removes conflicting completion stories at their shared source.
- **Simplification — EXTENDS → R6:** execute the existing UAT-then-delete packet in PM Tooling instead of adding another desktop surface or compatibility layer.
- **Frontier — NEW, parked:** derive the next still-valid owner decision from existing receipts after two completed product experiments; adopt only if measured repeated actions fall without removing gate decisions or widening authority.
- **Uncomfortable — EXTENDS → DLV-93:** these three sheets compete for one reliability slot. Treating every valid tooling finding as immediate work would reproduce the tooling-over-product failure the experiment exists to stop.
