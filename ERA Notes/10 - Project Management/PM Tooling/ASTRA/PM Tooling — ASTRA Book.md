---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# PM Tooling — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>). Evidence cutoff: repository commit `3106164`; local inspection and in-memory reproductions: 2026-09-06. Deltas [PM Tooling — Master Book](<../PM Tooling — Master Book.md>), `updated: 2026-08-03`. This is a study, not another execution roadmap. Queue remains [4 — Checklist](<../4 - Checklist.md>); Phase 3 does not change it.

## Book delta

The scanner and reusable desktop bundle are assets. Their guarantees stop short of mutation identity and cache compatibility. Those are the consequential gaps; another dashboard redesign does not address them.

Executed read-only:

```text
git log --since=2026-08-03 --format="%h %ad %s" --date=short -- scripts/pm scripts/pm-server.mjs src/components/pm-live src/app/pm src/app/api/pm tests/pm-ui
3106164 2026-09-02 ERA Top Layer plan and Codex Quick Top Layer
88e4f46 2026-08-04 Trips
bf81612 2026-08-03 cancelled archived
```

| Claim in the book or brief | Repository delta | Consequence / disposition |
|---|---|---|
| Four surfaces share one Preact bundle | Desktop, portable HTML and hosted `/pm` use `buildHtml`; `/pm/live` has its own React/Next app. `scripts/pm/ui.mjs:18`; `scripts/build-pm-dashboard.mjs:51`; `src/components/pm-live/PmLiveApp.tsx`; `src/features/pm-live/usePmLive.ts:28`. | Share contracts and fixtures; do not propose forcing both UI runtimes into one bundle. |
| The checkbox scanner provides constructional safety | It provides same-snapshot ordinal parity. Toggle checks only ordinal/state; archive checks ordinal and, for Ship, done state. `scripts/pm/mutations.mjs:24`; `scripts/pm/archive.mjs:237`; reproduction F1 below. | An inserted same-state row defeats stale-request protection. Extend the existing expected-line guard used by Move. |
| Postpone is text-keyed and resets on edited text | `scripts/pm/shared/tasks.mjs:58` uses `file::cbidx`; `scripts/pm/src/app/store.js:44,148` consumes it. | Reordering transfers postponement to another item. View identity must follow the item; ordinal stays a location hint. |
| Desktop lacks the phone's filtering | Desktop search/chips/group/sort and URL state already exist: `scripts/pm/src/features/tasks/BoardToolbar.jsx:12`; `boardState.js:96`. Phone secondary controls deliberately live in a sheet: `src/components/pm-live/board/BoardToolbar.tsx:1`. | Do not commission another toolbar. Verify equivalent filters rather than identical arrangement. |
| About 7,150 JS lines, 10 feature directories, 7 PM UI tests | Accepted Phase 1 count: 10,602 JS/JSX/MJS lines under `scripts/pm/`, including 4,534 legacy-client lines; `pm-server.mjs` adds 611. `rg --files scripts/pm/src/features tests/pm-ui` identifies 13 feature directories and 11 test files. | State the counting scope. Legacy removal is a material reduction without a framework migration. |
| A cached board has no freshness indication | Local worker already adds `x-pm-offline`/`x-pm-cached-at`; the app displays snapshot state and blocks mutations: `scripts/pm/assets/sw.js:39,53`; `scripts/pm/src/app/store.js:77,99,132`. | The missing protection is shell/data compatibility, not the entire offline-state feature. |
| R37's target is a static-twin freshness test | `tests/pm-ui/ordinal-parity.test.ts:38` tests scanner parity. `static-twin.test.ts:8` tests embedded data and font independence. Neither proves worker/build revision compatibility. | Refine R37 against the actual static test and the source of each cached response. |
| Session-history retention is wholly absent | Relay has a seven-day terminal-row policy (`scripts/pm/bridge.mjs:79,1046`), snapshot size capping (`:535`) and browser cache limits (`src/features/pm-live/cache.ts:13,16`). | R38 concerns local history/artifact conventions; do not invent a second relay retention mechanism. Missing DELETE/full-read reconciliation belongs to Command Center. |
| IDs are never reused | Open CI `R49` (`../4 - Checklist.md:20`) collides with shipped archive automation `R49` (`../PM Tooling — Master Book.md:98`). Open SSE `R7` (`checklist:31`) collides with shipped vault consolidation `R7` (`book:95`). `scripts/pm/lint.mjs:126` checks duplicates within the current checklist. | Carry to Phase 5 ID reconciliation; do not treat either number as free. CI is canonically E-01/HUB-37 in this study. |
| The book's schema quotation establishes five live RLS policies | This is forbidden evidence under the session contract. The accepted DB snapshot is stale. | Live RLS is **UNVERIFIED**. Fresh owner-supplied `db-state.json` or Hard Rule 27's two untruncated queries is required; no policy rewrite is authorized by that prose. |
| CRLF frontmatter can fail | Confirmed by in-memory reproduction: `parseFrontmatter` returned `{}` for CRLF frontmatter; `lintChecklist` returned E1 missing status and updated date. `scripts/pm/shared/frontmatter.mjs:14`. | Continue LF for this study. R36 typing is not permission to change parser semantics incidentally. |

Further cross-surface evidence and the mobile contract live in [Command Center Architecture](<../../Command Center/Command Center — ASTRA Architecture.md>) and [Experience](<../../Command Center/Command Center — ASTRA Experience.md>). Their packet sheets own command acknowledgments and owner-scoped cache replacement. This book owns desktop mutation identity, parser maintenance and legacy removal.

## Re-scored maturity

**Provisional 5.8/10: 35/60**, using the book's six dimensions. This is an inspection score, not a claim of completed browser or phone UAT. Historical execution coupling is retained until a real product run supplies new evidence.

| Dimension | Book | ASTRA | Evidence and the specific +1 threshold |
|---|---:|---:|---|
| Structure & uniformity | 8 | 8 | Shared scanner and corpus conventions remain. +1: reconcile historical ID collisions and demonstrate study subfolders do not create duplicate tasks. `shared/md-scan.mjs:1`; `lint.mjs:126`; Book delta above. |
| Enforcement | 7 | 6 | Same-state stale toggles and unguarded restore defeat intended-item safety. +1: R-1 rejects stale toggle/archive/Undo before any file write. `mutations.mjs:24`; `archive.mjs:384`. |
| Freshness | 6 | 4 | Local stale-state detection exists; build/data compatibility and mobile snapshot replacement are missing. +1: R-2 compatibility fixtures and Command Center owner-cache/full-read fixtures pass. `assets/sw.js:8`; `src/features/pm-live/store.ts:73`. |
| Execution coupling | 4 | 4 | Historical score retained; no new end-to-end product evidence was produced here. +1: DLV-92/93 record real product completions and owner attention, not a PM-only change. [Delivery checklist](<../../Delivery/4 - Checklist.md>) lines 38–39. |
| Tooling | 8 | 7 | Functional SPA, two UI runtimes, legacy rollback surface and limited static-twin assertions. +1: existing desktop/390px/fake-driver cutover gates pass, then R6 deletes legacy assets. `ui.mjs:66`; `static-twin.test.ts:8`. |
| Handoff readiness | 6 | 6 | Parsing fixtures exist; JS body checking is not globally enabled (`tsconfig.json:5`). +1: focused checked-JSDoc core and a deliberate type-error probe fail/pass as specified in R-4. |

## Findings

### F1 — A stale desktop action can change another task

**Doctrine priority 2: trust surface.** The owner can complete or discard the wrong work item while the UI reports a normal success. `store.js:103` submits `{file, cbidx, expectState}`. `mutations.mjs:24` only compares state. Ship/Discard selects the ordinal from fresh disk contents (`archive.mjs:247`). Move already compares `expectedLine` (`mutations.mjs:162`), so this needs one existing pattern extended, not a second parser.

Executed in-memory using the imported helpers, with no fixture files written:

```text
Before: open R-1 Original, open R-2 Second.
After external insertion: open R-9 Inserted, open R-1 Original, open R-2 Second.
toggleCheckbox(after, 0, "open") => { ok: true, state: "done" }
Result: R-9 is checked; R-1 remains open.
taskKey(file, before[0]) === taskKey(file, after[0]) === "PM Tooling/4 - Checklist.md::0"
```

Undo has a related asymmetry: desktop `restoreSnapshots` writes supplied pre-images without checking that current content still matches the operation's result (`archive.mjs:384`; `pm-server.mjs:309`). Bridge Undo already refuses a later laptop edit using `afterHash` (`bridge.mjs:619`). Preserve that invariant on desktop, validating every affected file before restoring any. **EXTENDS → R7**; [ASTRA-R-1](<PM Tooling — ASTRA Packets.md#astra-r-1>).

### F2 — A live process, fresh source and compatible UI are three different facts

**Doctrine priority 2: trust surface; priority 4: coherence.** The local worker caches shell and data separately under fixed `pm-offline-v1` (`assets/sw.js:8–9`). Existing offline headers are useful but do not establish compatibility. Hosted `/pm` embeds `generatedAt` (`build-pm-dashboard.mjs:34`) and uses the main app's navigation cache (`public/sw.js:307`); desktop `loadData()` treats static mode as `_offline:false` (`scripts/pm/src/app/api.js:25`).

A cache-key bump alone cannot prove which source snapshot the owner sees. Derive a content revision from the build inputs and a separate source revision from the embedded/current Markdown payload. Compare local shell/data compatibility and preserve read-only static semantics. Keep hosted runtime changes outside R-2; [Command Center Experience](<../../Command Center/Command Center — ASTRA Experience.md>) specifies the shared meaning. **EXTENDS → R37**.

### F3 — Warning-level grandfathering permits fresh violations in an old file

**Doctrine priority 2: trust surface.** `eslint.config.mjs:39` sets `no-explicit-any` to error, but `:226` overrides entire listed files to warn. That includes newly introduced occurrences in those files; the “never add to the ledger” comment cannot enforce that distinction. Historical 588/538 counts are not a fresh measurement and are not reused as current totals here.

Adopt a diagnostic regression comparator over existing ESLint output; do not pretend a new prose rule or unchanged file list prevents new debt. Fixing one violation must not buy permission to add a different one. **EXTENDS → DLV-52**; reusable enforcement for **R44 / H-02** after its detector exists. No wholesale debt burn-down in this study.

### F4 — Legacy retirement is a larger simplification than a framework change

**Doctrine priority 4: coherence.** `scripts/pm/ui.mjs:66` reads the three old assets; `pm-server.mjs:77,446` still exposes both escape hatches. The Master Book already sets the desktop/390px/fake-driver cutover gate. Execute that gate, then delete. Do not replace one speculative migration with another. **EXTENDS → R6**.

### F5 — Type annotations without checked JS do not close the maintenance gap

**Doctrine priority 4: coherence.** The five `shared/*.mjs` modules serve multiple consumers. `tsconfig.json` has `allowJs`, but does not enable `checkJs`; annotations alone are not a body-checking gate. An isolated config for these pure modules lets TypeScript catch contract drift without pulling the whole Preact SPA into the application's React JSX configuration. **EXTENDS → R36**. The existing ordinal/parsing tests remain necessary; types do not establish stale-target safety.

## Enhancement catalog

Sizes mean at most one 2–4 hour session; S is at most half a session. These five sheets refine existing work and do not add five automatic calendar slots. DLV-92/93's freeze remains binding: tooling work must identify a concrete blocker or wait; no architecture expansion before two real product completions.

| Rank / study ID | User-visible outcome | Size / severity | Reconciliation and dependency chain |
|---|---|---|---|
| 1 · ASTRA-R-1 | A stale action cannot complete, discard or restore over another item/edit. | M / blocker | **EXTENDS → R7**; Phase 5 resolves R7 collision → baseline proof → mutation identity fixtures. Supports correct HUB-37/E-01 selection and PM trace. |
| 2 · ASTRA-R-5 | A newly introduced warning fails validation even inside a grandfathered file. | M / friction | **EXTENDS → DLV-52**; consume R44/H-02 diagnostics later → E-01 CI available → ratchet. Protects HUB-46/E-09 and HUB-47/E-11 code edits. |
| 3 · ASTRA-R-2 | The desktop distinguishes a compatible source snapshot from a mismatched cached bundle. | M / friction | **EXTENDS → R37**; baseline → local build/source fixture → desktop/offline UAT. Supports verifying HUB-37/E-01 and HUB-47/E-11 against the intended source. |
| 4 · ASTRA-R-3 | The owner and successor agents encounter one maintained desktop implementation. | M / friction | **EXTENDS → R6**; complete locked UAT → remove assets and escape hatches. Supports HUB-37/E-01 delivery and verification controls. |
| 5 · ASTRA-R-4 | Shared parser changes fail a focused type gate before corrupting the board. | M / annoyance | **EXTENDS → R36**; E-01 CI → isolated checkJs → unchanged parser fixtures. Protects product task identity/provenance in HUB-37/E-01 and subsequent packets. |

See [ASTRA Packets](<PM Tooling — ASTRA Packets.md>) for exact allowlists and gates. Any change exceeding a session splits under S6; it does not grow to L. Parent checklist ticks require the complete parent outcome, not one refinement.

## What ERA needs from this module

PM is an engineering control surface, not household facts. **No PM-only signal or capability is added to `src/lib/briefing/signals.ts` by this study.** E-04's canonical inputs remain the owner's money and schedule domains; [Top Layer Architecture](<../../Top Layer/Top Layer — ASTRA Architecture.md>) owns that contract.

ERA's implementation needs reliable delivery evidence from PM: exact item identity, repository/build revision, validation result with nonzero test coverage, and recoverable owner decisions. Those are engineering artifacts, not content to push into the household briefing. [Command Center Orchestration](<../../Command Center/Command Center — ASTRA Orchestration.md>) owns the agent-facing interpretation; [Delivery ASTRA Book](<../../Delivery/ASTRA/Delivery — ASTRA Book.md>) owns runner gates. Reuse existing artifacts if a future owner request needs a PM query; do not add a second assistant or background reasoning loop.

## Do not do

- Do not merge React `/pm/live` into Preact just to satisfy an inaccurate “one bundle” sentence. Contracts and equivalent fixtures buy coherence with less churn.
- Do not rebuild desktop filtering already shipped under R32/R50. Verify behavior and retain the phone's intentionally compact sheet.
- Do not change Markdown lanes, campaign prefixes, parser grammar or archive policy in an implementation rider. Phase 5 owns the sanctioned study amendment and ID reconciliation.
- Do not reopen all historical lint debt, rewrite the whole SPA in TypeScript, or add a new test framework for these pure contracts.
- Do not treat a real-phone scrolling defect as reproduced here. R42/DLV-72 requires owner device evidence before a navigation fix.
- Do not infer applied migrations or live policy behavior from missing files, comments, schema quotations or booked completion.
- Do not run `pnpm pm` merely to inspect this study: `pm-server.mjs:598` performs the monthly sweep at boot, and the bridge option has external effects. Future UAT uses an explicitly isolated fixture and the existing fake driver.

## Coverage note

This campaign owns the PM corpus lens: scanning, linting, Markdown mutation identity, static/server Preact surfaces, source previews and legacy cutover. The Feature Map index has no dedicated PM tooling entry; the Master Book's Source and Successor Briefing are the router used here. `/pm/live` crosses into Delivery and is covered jointly by the Command Center docs, not treated as a new campaign. Household Sharing, Sync & Offline and other product Feature Index modules are not silently assigned to PM; their product studies remain Phase 4 work.

Validation in this subtask: source inspection, git delta, two in-memory helper reproductions. No browser session, build, test runner, application mutation or DB call was run. Existing accepted `pnpm pm:lint` baseline remains one missing Delivery migration-path error and one empty Native Next-lane warning; no checklist changed here. **UNVERIFIED:** actual installed-worker behavior, phone pane scrolling and live relay state; settle with the isolated desktop/cache fixture and owner-run R42/DLV-72 UAT, not a prose claim.

## ASTRA 10× Findings

- **Leverage 1 — EXTENDS → R7:** Make item identity the precondition for every desktop mutation and Undo. F1's executed fixture shows why parser parity alone is insufficient; the Move/bridge guards already provide the implementation pattern.
- **Leverage 2 — EXTENDS → R37:** Derive build/source compatibility once and expose it through the existing cached payloads. `assets/sw.js:8`, `ui.mjs:18` and `build-pm-dashboard.mjs:34` already contain the necessary assembly seams.
- **Leverage 3 — EXTENDS → DLV-52; supports R44/H-02:** Enforce diagnostic identity against a reviewed baseline, so old warning-level files cannot accumulate new violations. `eslint.config.mjs:226` proves the gap.
- **Simplification / deletion — EXTENDS → R6:** Retire the 4,534-line legacy client and its companion assets after the already-locked UAT. Delete a parallel implementation before commissioning a new one.
- **Frontier — NEW, parked:** Assemble a deterministic resumption proof from existing selected-item identity, source revision, validation receipts and command receipts. Reopen only after DLV-92/93's two real product completions if the trial reduces repeated owner actions or uncertain outcomes. No new runtime, module or executable packet is authorized here.
- **Uncomfortable finding:** A grammar-clean, test-covered PM tool can silently act on the wrong item and then overwrite a later edit on Undo. F1 establishes the behavior; “constructional safety” must name the boundary it actually proves.
