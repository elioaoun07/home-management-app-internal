---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# PM Tooling — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), especially §5.0 and D7. Evidence cutoff `3106164`; local inspection 2026-09-06; deltas [PM Tooling Master Book](<../../../../PM Tooling/PM Tooling — Master Book.md>) `updated: 2026-08-03`. Companion findings: [ASTRA Book](<PM Tooling — ASTRA Book.md>). These are refinements, not a replacement queue or authorization to implement during Phase 3.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-R-1 | EXTENDS → R51 (formerly open R7) | R51 | Identity repair of existing Next item; conditional reliability slot |
| ASTRA-R-2 | EXTENDS → R37 | R37 | HELD by freeze; no new cache platform |
| ASTRA-R-3 | EXTENDS → R6 | R6 | HELD; candidate ONE simplification slot after existing UAT |
| ASTRA-R-4 | EXTENDS → R36 | R36 | HELD by freeze; isolated five-module check only |
| ASTRA-R-5 | EXTENDS → DLV-52; DOCKS → H-02 | DLV-52 | HELD; competes with DLV-5/6 for ONE validation slot |

## Plan reconciliation and capacity

| Study sheet | Docking | Existing scope refined | Concrete product work supported |
|---|---|---|---|
| ASTRA-R-1 | **EXTENDS → R51** | Intended-item and Undo drift checks; stable postponed-item identity | HUB-37 / E-01 selection and trustworthy completion trace; later product tasks inherit the same guard. |
| ASTRA-R-2 | **EXTENDS → R37** | Local shell/data compatibility and static source provenance, beyond existing offline headers | Verify HUB-37 / E-01 and HUB-47 / E-11 against the intended source revision. |
| ASTRA-R-3 | **EXTENDS → R6** | Existing UAT gate followed by actual legacy deletion | One maintained set of desktop launch/verification controls for HUB-37 / E-01. |
| ASTRA-R-4 | **EXTENDS → R36** | Focused checked JSDoc rather than annotations without enforcement | Preserve parser/task identity while queuing and tracing HUB-37 / E-01 and HUB-46 / E-09. |
| ASTRA-R-5 | **EXTENDS → DLV-52**; reusable by **R44 / H-02** | Enforce no new warning diagnostics; existing debt remains separate | Protect HUB-46 / E-09 and HUB-47 / E-11 edits from fresh type escapes. |

Five M sheets consume up to five sessions if all selected; they are not five extra automatic roadmap slots. At approximately two packets per week, admit only a demonstrated blocker before DLV-92. DLV-93 permits at most one reliability fix, one simplification and one validation fix before the second real product run. No parallelism or new architecture is justified by this list. E-01/HUB-37 is the canonical CI reference: **R49 is already reused**. **R7 is also reused across history**. Phase 5 reconciled the open R7 alias as R51 and absorbed open R49 CI into HUB-37 before any parent tick; these study IDs are not new campaign IDs.

The [Command Center packet set](<../../Command Center/Command Center — ASTRA Packets.md>) owns ASTRA-CC-1 command reconciliation, ASTRA-CC-2 owner-cache/full-snapshot replacement and ASTRA-CC-3 completion artifact consistency. [Delivery Packets](<../Delivery/Delivery — ASTRA Packets.md>) owns runner budgets, lanes and context. Do not implement those through a PM rider.

## Execution contract

All implementation gates below are **NOT RUN in this document-only study**. No new runtime dependency is authorized. `[NEW]` marks a future file, not an existing artifact. Every Files list implicitly includes only its named campaign's two existing PM files for implementation-time trace; it excludes this study's other documents unless named. Phase 5 landing above records the canonical queue. Every implementation sheet also runs `pnpm lint` → exit 0 and records the tested commit and exact test-file count; these shared gates supplement each sheet's named checks.

**Individual dispatch:** copy this complete Execution contract, including shared gates, forbidden paths, the fixture prerequisite and S1–S12, with any one sheet handed to an executor. A sheet detached from those blocks is incomplete.

**Isolated browser-fixture prerequisite:** `scripts/pm-server.mjs:59–68` derives ROOT and PM_DIR from its own location; it has no root-override CLI option. Browser UAT therefore requires a reviewed temporary **source copy**, not a worktree or git checkout. Prepare an untracked fixture root under `.delivery/pm-ui-fixtures/<unique-id>/`: copy only `scripts/pm-server.mjs`, its `scripts/pm/` and `scripts/delivery/` source/assets, and dependency-resolution metadata needed for the installed packages. Create synthetic Markdown, synthetic delivery configuration and fresh synthetic session files inside that copy. Never copy the real PM corpus, `.git`, `.env*`, credentials, user configuration or historical `.delivery/sessions/`. Resolve installed dependencies without installing another package. Run the copied server from the fixture root with `node scripts/pm-server.mjs --no-open --no-bridge --host=127.0.0.1 --port=14317`, after confirming that port is free and that all computed PM/session/write paths resolve inside the fixture root. `--no-bridge` is mandatory even if the parent environment enables the bridge. The child environment excludes provider/DB credentials and integration settings; no provider or DB connection is permitted.

For a fake-driver walkthrough, the fixture must already have a reviewed **fixture-only** `createDeliveryContext` injection using the existing `spawnRunner`/validation/git-read seams (`tests/delivery/server-routes.test.ts:85`; `scripts/delivery/server-routes.mjs:2019`), dispatching only `runSession` with the registered fake driver and a deterministic script. Current launch routes accept Claude/Codex identities, so do not invent an `agent: fake` UI option or assume a nonexistent fake-mode CLI flag. Record the small fixture injection separately from the copied application sources; the production gate handlers and UI remain the code under test. Prove a complete fake lifecycle and zero external calls before using the fixture for cutover evidence. If this fixture is not already available, fixture setup is an explicit prerequisite with its own estimate; it must not be hidden inside an M cutover packet. The monthly boot sweep may then affect only synthetic files. No fixture is created during this study.

Every sheet carries this complete STOP set by reference. On any condition, stop and write a five-line handoff rather than expanding the allowlist:

| STOP | Condition |
|---|---|
| S1 | A file outside the packet allowlist needs editing. |
| S2 | A DB write is required; hand owner the manual runbook under Hard Rule 26. |
| S3 | Test count decreases, or required typecheck/lint/test is red. |
| S4 | `HubPage.tsx` grows or gains a new import of its internals. |
| S5 | A new dependency must be installed. |
| S6 | The packet cannot finish in one 2–4 hour session; split before continuing. |
| S7 | A visibility/permission symptom appears: Hard Rule 27's fresh owner snapshot or two untruncated queries before route investigation. |
| S8 | Money/schedule behavior is ambiguous; ask one focused question, do not choose a default. |
| S9 | An AI proposal would write domain state without confirmation. |
| S10 | A second engine, queue, toast system, parser or aggregate for an existing concept is introduced. |
| S11 | Work touches D2's entirely excluded scope. |
| S12 | A UI change moves or restyles an existing `/era` element. |

For all sheets: forbidden `src/components/ui/**`, `src/components/hub/HubPage.tsx`, any `migrations/schema.sql` edit without a paired migration, git writes, live DB calls and application-domain changes outside the allowlist. No sheet needs a migration. Existing red PM lint is a prerequisite to resolve through Phase 5, not permission to suppress a linter failure or recreate a missing migration from imagination.

## ASTRA-R-1

**ASTRA-R-1 · Intended-item mutation and guarded Undo · M · E · existing R51 verification refinement (formerly open R7)**

**Outcome:** A stale desktop action leaves the intended item and later edits intact, and postponement follows the item through a reorder.

**Prereqs:** Phase 5 repaired the R7 collision as R51 and pm:lint exits 0; baseline checks recorded; DLV-92/93 permits this work only as a demonstrated trust blocker. Migrations required APPLIED: none.

**Skills:** `start-task → fix-bug → finish-task`.

**Files:** `scripts/pm/src/app/store.js`; `scripts/pm/shared/tasks.mjs`; `scripts/pm/mutations.mjs`; `scripts/pm/archive.mjs`; `scripts/pm-server.mjs`; `tests/pm-ui/ordinal-parity.test.ts`; `tests/pm-ui/archive.test.ts`; `tests/pm-ui/task-move.test.ts`; `tests/pm-ui/shared-parsing.test.ts`; `ERA Notes/10 - Project Management/PM Tooling/4 - Checklist.md`; `ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md`. Global forbidden paths above apply.

**Implementation boundary:** The historical failure is F1 in the Book: another open row appears at the stale ordinal and is checked successfully. Reuse Move's expected-line precondition for toggle, Ship and Discard; missing identity on a mutating request fails closed. Preserve checkbox ordinals for lookup but compare the exact expected item before writing. A duplicate request must not toggle twice. Return per-file expected-after identity with Undo and validate every affected file before restoring any; changed content refuses instead of overwriting. Follow bridge Undo's existing invariant, not its separate journal implementation. Replace ordinal-based postponed keys with file plus parsed ID/body identity; do not transfer old ordinal-only saved entries to guessed items. Preserve query, parsing and lane semantics. If the mutation/Undo contract cannot fit one session, split before editing under S6; do not silently omit guarded Undo.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No; this edits PM Markdown only.

**Gate:** `pnpm vitest run tests/pm-ui/ordinal-parity.test.ts tests/pm-ui/archive.test.ts tests/pm-ui/task-move.test.ts tests/pm-ui/shared-parsing.test.ts` → all pass, nonzero tests, no skips added. New cases: prepend/reorder two same-state items; stale Ship/Discard; double toggle; changed first and last file in a multi-file Undo; unchanged Undo restores; reorder preserves intended postponement without transferring it. `pnpm typecheck` and `pnpm pm:lint` → exit 0. Desktop fixture: external insertion before clicked row produces refusal/refresh with zero wrong-row changes. Screenshot plus before/after fixture contents recorded; no production corpus used as the mutation fixture.

**PM:** Tick the R51 line only after original SSE/UI-rebuild/drift UAT and this refinement all pass. Shipped Log sentence: `- ✅ YYYY-MM-DD — **R51** desktop task mutations reject stale identity and Undo refuses later edits; postponement survives reorder (fixture and UAT evidence).` If original SSE UAT remains open, append a partial implementation record and leave its checkbox open.

**NOT done:** Migration written ≠ applied; test file ≠ test in CI include; matching parser ordinals ≠ matching item identity; passing one-file Undo ≠ safe multi-file Undo; “works locally” ≠ evidence pasted.

**STOP:** S1–S12 above apply in full.

## ASTRA-R-2

**ASTRA-R-2 · Local build and source compatibility · M · E · existing R37 refinement**

**Outcome:** The desktop identifies its source snapshot and refuses writes when cached shell and data are incompatible.

**Prereqs:** Recorded baseline; compatible with DLV-92/93 work limit; existing static/desktop source formats read first; reviewed source-copy browser fixture from the Execution contract already available. R-1 protects item drift independently. Migrations required APPLIED: none.

**Skills:** `start-task → fix-bug → ui-guardrails → finish-task`.

**Files:** `scripts/pm/build.mjs`; `scripts/pm/ui.mjs`; `scripts/build-pm-dashboard.mjs`; `scripts/pm-server.mjs`; `scripts/pm/assets/sw.js`; `scripts/pm/src/app/api.js`; `scripts/pm/src/app/store.js`; `scripts/pm/src/app/App.jsx`; `tests/pm-ui/static-twin.test.ts`; `tests/pm-ui/build-smoke.test.ts`; `ERA Notes/10 - Project Management/PM Tooling/4 - Checklist.md`; `ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md`. Also forbidden for this sheet: `public/sw.js`, `src/features/pm-live/**`, `src/components/pm-live/**`; hosted SW/runtime behavior belongs to the cross-surface owner.

**Implementation boundary:** Keep existing network-first/offline-header behavior. Produce deterministic bundle identity from emitted content and separate source identity from sorted source payload contents; retain generated/cached timestamps as timestamps. A format version describes compatibility, not freshness. Carry identity in local shell and `/api/data` plus portable/static embedded payload. If local shell/data format is incompatible, fetch current data once; if unresolved, retain read-only snapshot and disable writes. Existing server/static capabilities remain unchanged. Reuse current status affordances without explanatory prose or a layout rewrite. Static HTML remains fully offline/read-only; expose its source/build provenance without asserting current deployed freshness. Do not rebuild tracked dashboard artifacts merely to make this packet's test pass: use `buildBundle()`/`buildHtml()` fixtures in memory.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No.

**Gate:** `pnpm vitest run tests/pm-ui/static-twin.test.ts tests/pm-ui/build-smoke.test.ts` → all pass, nonzero tests. Same bundle inputs yield same identity; changed JS/CSS changes identity; changed Markdown changes source identity; timestamp alone does not change content identity; mixed format fails writable-mode eligibility; compatible stale payload remains read-only when offline. `pnpm typecheck` and `pnpm pm:lint` → exit 0. Desktop/390px source-copy fixture screenshot: live, compatible offline snapshot, and incompatible shell/data are distinguishable; write control is disabled in the last two. Launch only the copied server under the Execution contract, with `--no-bridge`; include resolved fixture/write paths with UAT evidence.

**PM:** Tick R37 only when its full cache-compatibility claim is proven; do not claim hosted `public/sw.js` behavior tested by these local fixtures. Shipped Log: `- ✅ YYYY-MM-DD — **R37** local PM shell/data carry build and source identity and incompatible snapshots cannot mutate (static fixtures and desktop offline UAT).` Record hosted follow-up separately if required by the reconciled parent scope.

**NOT done:** Migration written ≠ applied; test file ≠ CI include; changed cache constant ≠ compatibility proof; fresh heartbeat ≠ fresh source; “works locally” ≠ evidence pasted.

**STOP:** S1–S12 above apply in full.

## ASTRA-R-3

**ASTRA-R-3 · Complete legacy desktop cutover · M · E · existing R6**

**Outcome:** One maintained desktop UI serves the owner and every successor agent.

**Prereqs:** The Execution contract's reviewed source-copy fixture and fake-driver injection already exist and have passed their own zero-external-call lifecycle check. Fixture setup is not part of this M packet. R6's locked cutover proof then runs desktop and 390px visual UAT plus the fake-driver walkthrough in that copy with `--no-bridge`. DLV-92/93 freeze permits deletion only in its allowed simplification slot or afterward. Migrations required APPLIED: none.

**Skills:** `start-task → ui-guardrails → finish-task`.

**Files:** `scripts/pm/client.js` (delete); `scripts/pm/styles.css` (delete); `scripts/pm/body.html` (delete); `scripts/pm/ui.mjs`; `scripts/pm-server.mjs`; `tests/pm-ui/build-smoke.test.ts`; `tests/pm-ui/static-twin.test.ts`; `ERA Notes/10 - Project Management/PM Tooling/4 - Checklist.md`; `ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md`. Global forbidden paths apply. No active Preact styling rewrite.

**Implementation boundary:** Capture parity evidence before deletion. Remove `buildHtmlLegacy`, its imports and both query/CLI selectors. Requests with obsolete `ui=old` resolve to the maintained UI without restoring the old bundle. Keep canonical parsing, read-only static behavior and existing registry-driven controls. A missing current-UI feature found during UAT is a separate bounded fix; do not retain undocumented zombie code as permanent rollback.

**DB change?** No.

**AI call added?** No; use existing fake driver only for the walkthrough.

**Money/schedule math?** No.

**Gate:** `pnpm vitest run tests/pm-ui/build-smoke.test.ts tests/pm-ui/static-twin.test.ts tests/pm-ui/ordinal-parity.test.ts` → all pass, nonzero tests. `rg -n "buildHtmlLegacy|ui=old" scripts/pm/ui.mjs scripts/pm-server.mjs` → no matches, exit 1 expected. `Get-Item -LiteralPath scripts/pm/client.js,scripts/pm/styles.css,scripts/pm/body.html -ErrorAction SilentlyContinue` → no output. UAT evidence at desktop and 390px: Overview, Work Queue filters/reload, document checkboxes, Search, Inbox, fake-driver launch/three gate decisions/final acceptance; static twin offers no mutations. `pnpm typecheck` and `pnpm pm:lint` → exit 0.

**PM:** Tick R6 only after the entire cutover proof and deletion. Shipped Log: `- ✅ YYYY-MM-DD — **R6** removed legacy desktop assets and escape hatches after desktop/390px parity and fake-driver gate UAT (evidence paths).`

**NOT done:** Migration written ≠ applied; test file ≠ CI include; removed imports ≠ deleted fallback surface; screenshot ≠ fake-driver gate walkthrough; “works locally” ≠ evidence pasted.

**STOP:** S1–S12 above apply in full.

## ASTRA-R-4

**ASTRA-R-4 · Check the shared JavaScript parser contracts · M · E · existing R36**

**Outcome:** A wrong parser contract fails validation before it changes the owner's board.

**Prereqs:** E-01/HUB-37 CI is present, or this validation command is queued as its explicit rider; baseline parsing fixtures captured; DLV-92/93 freeze satisfied. Migrations required APPLIED: none.

**Skills:** `start-task → finish-task`.

**Files:** `scripts/pm/shared/frontmatter.mjs`; `scripts/pm/shared/links.mjs`; `scripts/pm/shared/md-scan.mjs`; `scripts/pm/shared/tasks.mjs`; `scripts/pm/shared/text.mjs`; `scripts/pm/tsconfig.shared.json` [NEW]; `package.json`; `.github/workflows/ci.yml` (created by E-01, not created independently here); `tests/pm-ui/shared-parsing.test.ts`; `tests/pm-ui/ordinal-parity.test.ts`; `ERA Notes/10 - Project Management/PM Tooling/4 - Checklist.md`; `ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md`. Also forbidden: root `tsconfig.json`, global Preact/React JSX configuration and any parser grammar rewrite.

**Implementation boundary:** Add JSDoc to actual shared inputs/outputs and a dedicated `allowJs: true`, `checkJs: true`, `noEmit: true`, `incremental: false` configuration including only the five pure modules. Reuse installed TypeScript; no dependencies. Add an explicitly named script to CI. Demonstrate a deliberate wrong result/property type is rejected, then remove the deliberate error. Preserve current LF parser behavior, metadata stripping, absolute line positions, code fences and checkbox ordinals; CRLF normalization is a separate behavior change if desired. If the five modules cannot be typed in a session, split by dependency order rather than widen to the whole application.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No.

**Gate:** `pnpm exec tsc --project scripts/pm/tsconfig.shared.json` → exit 0 with no emission; deliberate fixture/probe type error must have exited nonzero before removal, with diagnostic recorded. `pnpm vitest run tests/pm-ui/shared-parsing.test.ts tests/pm-ui/ordinal-parity.test.ts` → all pass, nonzero tests, same corpus behavior. `pnpm typecheck` and `pnpm pm:lint` → exit 0. CI log includes the dedicated command on the tested commit; merely having a config file is insufficient.

**PM:** Tick R36 only when all five modules are checked and CI runs that check. Shipped Log: `- ✅ YYYY-MM-DD — **R36** added enforced JSDoc contracts for the five shared PM parser modules without changing their grammar (type-error probe, parity tests and CI evidence).`

**NOT done:** Migration written ≠ applied; annotations ≠ checked JS; test file ≠ CI include; `allowJs` ≠ `checkJs`; “works locally” ≠ evidence pasted.

**STOP:** S1–S12 above apply in full.

## ASTRA-R-5

**ASTRA-R-5 · Reject new diagnostics inside grandfathered files · M · E · DLV-52 enforcement refinement**

**Outcome:** Fresh type escapes fail validation even when their file already contains accepted warning debt.

**Prereqs:** E-01/HUB-37 CI exists; current ESLint diagnostics measured from this checkout, not historical 588/538 totals; DLV-93's validation slot or later eligibility. R44/H-02 detector development remains separate. Migrations required APPLIED: none.

**Skills:** `start-task → finish-task`.

**Files:** `scripts/check-lint-ratchet.mjs` [NEW]; `tests/lint-ratchet.test.ts` [NEW]; `docs/lint-debt-baseline.json` [NEW]; `package.json`; `.github/workflows/ci.yml`; `ERA Notes/10 - Project Management/Delivery/4 - Checklist.md`; `ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md`. Read `eslint.config.mjs` as the existing rule/file policy; no widening of its grandfathered lists. No application-source edits and no new lint rule detector in this sheet.

**Implementation boundary:** Use installed ESLint's structured output for `@typescript-eslint/no-explicit-any`. Snapshot reviewed existing diagnostic identities by normalized repo path, rule and normalized source/AST context with multiplicity; line shifts alone must not create debt. Fail on a new diagnostic identity or increased multiplicity, including replacing one old violation with a different new one in the same file. The baseline is an explicit, shrinking allowlist, never regenerated automatically to pass CI. After initial reviewed seeding, compare changes to the baseline against the CI base revision through a read-only git read; changing both source and baseline must not bypass the check. Missing base evidence fails visibly rather than silently reseeding. Unknown/unparseable diagnostics fail visibly; a larger total budget is not a substitute. Keep the comparator reusable for R44/H-02's raw-mutation-fetch detector when that separate packet lands. Do not claim detection of computed/aliased fetch that the future detector has not proven.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No; this guards future domain edits without modifying them.

**Gate:** `pnpm vitest run tests/lint-ratchet.test.ts` → all pass, nonzero tests. Fixtures: untouched old violation allowed; added occurrence in a listed file rejected; line-only shift allowed; one removal plus different addition rejected; duplicate identical occurrence rejected; baseline expansion rejected; malformed diagnostic input rejected. `node scripts/check-lint-ratchet.mjs` → exit 0 against reviewed current baseline, exit nonzero for each prohibited fixture. `pnpm lint`, `pnpm typecheck` and `pnpm pm:lint` → exit 0. CI log runs comparator; report measured baseline counts with rule/file scope, without relabeling historical totals as fresh.

**PM:** DLV-52 remains open until its actual debt burn-down completes; R44 remains open until its separate detector lands. Append partial Shipped Log: `- ✅ YYYY-MM-DD — **DLV-52** enforcement slice: CI rejects newly introduced no-explicit-any diagnostics inside grandfathered files; existing debt remains (ratchet fixtures and baseline evidence).` No new child was allocated. This held slice competes for the single validation slot; do not tick the burn-down parent or allocate an extra commitment.

**NOT done:** Migration written ≠ applied; test file ≠ CI include; same warning count ≠ same debt; unchanged grandfathered file list ≠ no fresh violations; historical counts ≠ a new measurement; “works locally” ≠ evidence pasted.

**STOP:** S1–S12 above apply in full.

## Validation boundary

This study wrote Markdown only. All commands under Gate describe future implementation verification and were not executed here. Source inspection and in-memory helper calls established the findings. Existing PM lint baseline: one missing Delivery migration-path error and one empty Native Next-lane warning; Phase 5 must reconcile the source link before implementation gates claim green. No migration was run or reported APPLIED. No checklist line was changed or ticked.

## ASTRA 10× Findings

- **Leverage 1 — EXTENDS → R51:** R-1 converts the existing expected-line pattern into a mutation/Undo precondition; it fixes an executed wrong-item reproduction without another scanner.
- **Leverage 2 — EXTENDS → R37:** R-2 treats source and bundle identity as data already available at assembly time, making stale snapshots inspectable without a new monitoring service.
- **Leverage 3 — EXTENDS → DLV-52; supports R44/H-02:** R-5 makes “only shrink” enforceable within old files instead of relying on comments beside whole-file warning overrides.
- **Simplification / deletion — EXTENDS → R6:** R-3 removes a parallel desktop implementation after the existing cutover gates; no replacement framework is proposed.
- **Frontier — NEW, parked:** The Book's deterministic resumption proof has no executable packet until DLV-92/93 supplies two real product completions and a measurable repeated-action problem.
- **Uncomfortable finding:** Five worthwhile tooling sheets could still displace two weeks of household product work. The freeze and named product outcomes are acceptance constraints, not introductory prose; choose only the observed blocker and return to the product run.
