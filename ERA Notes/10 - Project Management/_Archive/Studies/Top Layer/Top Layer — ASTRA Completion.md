---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# Top Layer — ASTRA Completion

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff: `3106164` (2026-09-02). Deltas [Hub & ERA — Master Book](<../../../Hub & ERA/Hub & ERA — Master Book.md>) at `updated: 2026-09-02`. This defines future product acceptance, not a claim that the product or its gates have passed.
>
> [Architecture](<Top Layer — ASTRA Architecture.md>) owns evidence A1–A17 and contradictions C01–C16. [Experience](<Top Layer — ASTRA Experience.md>) owns surface behavior. [Packets](<Top Layer — ASTRA Packets.md>) owns execution scope.

## 1 · Meaning of complete

**DOCKS → E-01–E-23 and G0–G3.** Complete means the active plan's required behavior passes its gates with artifacts from the tested commit, environment, user and device. It does not mean every study recommendation shipped. The rows below refine weak proofs in that plan; they do not close module/native gates or change milestone dates.

Every future row starts **NOT RUN**, which counts as **FAIL** for acceptance. A code fixture passing cannot substitute for an owner phone observation. No production DB calls or mutations are authorized to an agent: the owner supplies live SQL output and performs phone scenarios. Agents use mocks/local synthetic fixtures, not the production-connected dev app to seed money or schedule data.

“Exactly once” is tested separately for a logical row and a visible push. Database uniqueness alone cannot prove exactly-once external delivery (Architecture §5). An inconclusive test is FAIL, not a pass with a footnote.

## 2 · Baseline evidence, not future acceptance

| Check | Read-only command / artifact | Observed at study cutoff |
|---|---|---|
| Revision | `git log -1 --format="%h %ad %s" --date=short` | `3106164 2026-09-02 ERA Top Layer plan and Codex Quick Top Layer` |
| Initial working tree | `git status --short` | Only pre-existing untracked `docs/ASTRA-SESSION-BRIEF.md`; no tracked modifications |
| Source tests | `rg --files src -g '*.test.ts' -g '*.test.tsx'` | 43 TS files; zero TSX |
| Other tests | `rg --files tests` with test-file filtering | 61 test files |
| CI | `rg --files .github/workflows` | Only `check-docs-sync.yml` |
| Source dimensions | LF count of `HubPage.tsx` / `EraShell.tsx` | 6,275 / 550 |
| DB snapshot | Embedded `generated_at` in `migrations/db-state.json` | 2026-08-04; stale, not a current authorization proof |
| DB checker semantics | `node scripts/check-db-state.mjs` | Prints historical failures but exits 0 in default warning mode; exit 0 alone is not a clean RLS gate |
| PM lint | `pnpm pm:lint` | Exit 1; pre-existing E5 missing migration link in Delivery checklist, plus one Native empty-lane warning |

The Phase-2 study does not run application tests against new code because no application code is changed. Future test names below are **specified deliverables**, not files reported to exist.

PM lint output rechecked during Phase 2 (2026-09-06); no checklist was changed:

```text
> home-manager@0.1.0 pm:lint C:\Users\aoune\WebApp\budget-app
> node scripts/pm/lint.mjs

✓ Budget/4 - Checklist.md (BUD)
✓ Schedule/4 - Checklist.md (SCH)
✓ Kitchen/4 - Checklist.md (KIT)
✓ Trips/4 - Checklist.md (TRIP)
✓ Hub & ERA/4 - Checklist.md (HUB)
✓ Notifications & Alerts/4 - Checklist.md (NOTIF)
✓ PM Tooling/4 - Checklist.md (R)
✗ Delivery/4 - Checklist.md (DLV) — 1 error(s), 0 warning(s)
    Delivery/4 - Checklist.md:49 [E5] missing code path: `migrations/2026-08-01_pm-commands-instant-gates.sql`
✓ Outfits/4 - Checklist.md (OUT)
✓ Healthcare/4 - Checklist.md (HLTH)
! Native App/4 - Checklist.md (NAT) — 0 error(s), 1 warning(s)
    Native App/4 - Checklist.md:0 [W2] "## Next" lane has no open items

1 error(s), 1 warning(s).
ELIFECYCLE Command failed with exit code 1.
```

## 3 · Binary product gates

Run commands from the repository root. `pnpm exec vitest ... --passWithNoTests=false` requires the named file to exist and contain the specified cases. All command rows require exit 0 and the listed assertions; “No test files found” is FAIL. Capture stdout and the tested commit in the future Delivery session evidence.

### G0 · Ground truth and honest capture — Sep 14

| ID / plan mapping | One command or artifact | PASS | State |
|---|---|---|---|
| G0.1 · E-01 | `gh run view <run-id> --json headSha,conclusion,jobs` | Tested SHA matches candidate; typecheck, lint and tests each success | NOT RUN |
| G0.2 · E-01 | `pnpm exec vitest run tests/era-outcomes.test.ts --passWithNoTests=false` | Offline refusal, timeout, abort, storage failure and successful capture remain distinct; no false success | NOT RUN |
| G0.3 · E-02 | Owner artifact: authenticated `GET /api/health?jobs=1` response | Six expected jobs; cadence-aware last-success age and failures visible; no secrets or household payload | NOT RUN |
| G0.4 · E-02 | `pnpm exec vitest run tests/era-cron-health.test.ts --passWithNoTests=false` | Public GET/HEAD retain connectivity behavior; jobs detail rejects unauthenticated requests; stale and running-too-long jobs fail liveness | NOT RUN |
| G0.5 · E-00/E-02 | Owner artifact: fresh DB snapshot plus Applied ledger rows | Exact required migrations owner-stamped; timestamp and policies/functions match current state | NOT RUN |
| G0.6 · M-00 | `pnpm typecheck` | Removed declarations leave no unresolved production references; exit 0 | NOT RUN |
| G0.7 · E-01 | Owner 390×844 screenshot after airplane-mode expense sentence | No completed/draft-success indication; input recoverable and existing form door available | NOT RUN |

### G1 · Trustworthy capture and first delivery — Oct 12

| ID / plan mapping | One command or artifact | PASS | State |
|---|---|---|---|
| G1.1 · E-11 | `pnpm exec vitest run tests/era-outcomes.test.ts --passWithNoTests=false` | Failed/unknown/pending template counts unchanged; one completed success increments once; AI proposal rejection writes nothing | NOT RUN |
| G1.2 · E-09 | `pnpm exec vitest run tests/era-offline-storage.test.ts --passWithNoTests=false` | IDB commit precedes durable acknowledgment; abort/quota/memory fallback never claim durability; failed payload retained | NOT RUN |
| G1.3 · E-09 | `pnpm exec vitest run tests/era-draft-replay.test.ts --passWithNoTests=false` | Lost-response + retry returns one row/ID; altered payload is 409; other owner cannot retrieve/replay it; no balance change on draft create | NOT RUN |
| G1.4 · E-09 | `pnpm exec vitest run tests/era-item-create.test.ts --passWithNoTests=false` | Atomic-call contract tested; child failure exposes no success; retry preserves one item; required ownership checks cannot be omitted | NOT RUN |
| G1.5 · E-09 | Owner artifact: controlled scratch-DB rollback result | Forced child failure leaves zero parent/detail/alert/prerequisite rows; successful retry yields one complete graph | NOT RUN |
| G1.6 · E-09 | `pnpm exec vitest run tests/era-enqueue.test.ts --passWithNoTests=false` | Request ID survives retry; owner mismatch prevents POST; nested draft ID replaces temp ID; cancellation/replay race creates at most one row | NOT RUN |
| G1.7 · E-09 | Owner two-frame phone evidence: offline capture → close/reopen → reconnect | One pending identity survives restart; exactly one server draft and no temp duplicate; stored balance unchanged | NOT RUN |
| G1.8 · E-09 | Owner screenshot after Undo of replayed draft | Draft removed using real ID; stored balance unchanged | NOT RUN |
| G1.9 · E-04 | `pnpm exec vitest run src/lib/briefing/signals.test.ts --passWithNoTests=false` | Three builders; provenance/scope/as-of; unavailable is not zero; custom month, currency and recurrence fixtures pass | NOT RUN |
| G1.10 · E-03/E-05 | `pnpm exec vitest run tests/era-briefing-clock.test.ts --passWithNoTests=false` | Beirut seasonal offsets, repeated/skipped DST local times, duplicate ticks, hour changes and day-6 partner eligibility pass | NOT RUN |
| G1.11 · E-05 | `pnpm exec vitest run tests/era-briefing-delivery.test.ts --passWithNoTests=false` | Same-day concurrent fires share identity; no-subscription/configuration is not success; failed send retry and crash-after-send remain explicit | NOT RUN |
| G1.12 · E-05 | Owner two-phone notification evidence with local timestamp and briefing ID | Each eligible phone displays one briefing at its approved local hour, within one five-minute polling interval; each second fire adds zero visible duplicates | NOT RUN |
| G1.13 · E-05/E-16 | Owner delivery evidence: five owner mornings followed by partner's first eligible morning | Five distinct consecutive owner local dates observed; partner starts day 6 at her configured eligible hour | NOT RUN |
| G1.14 · E-06 | Owner screenshot of Activity vitals after first observed morning | Stored/transport status and cron liveness are distinguishable; seven-day metric has explicit eligible-day denominator | NOT RUN |
| G1.15 · E-07 | `pnpm exec vitest run tests/era-ai-usage.test.ts --passWithNoTests=false` | Provider usage/model preserved, fallback accounted, estimates marked, allowance-read failure not interpreted as zero usage | NOT RUN |
| G1.16 · E-07 | Owner before/after gauge screenshot for one Ask AI | Usage changes for `era-ask`; actual/estimated basis and fallback model match recorded call evidence | NOT RUN |
| G1.17 · E-08 | `pnpm exec vitest run tests/era-reactive-reads.test.ts --passWithNoTests=false` | Account/household scope, no mixed-currency total, meal range and bounded Chef/Brain context pass | NOT RUN |
| G1.18 · E-09 | `pnpm exec vitest run tests/era-reactive-writes.test.ts --passWithNoTests=false` | Income creates draft with correct account/type/sign; event starts/ends correctly; recurrence text does not enter a second engine | NOT RUN |

C01's hour conflict and C03's partner sequencing must be resolved before G1.12/G1.13 can pass. A test at a silently substituted hour is FAIL.

### G2 · One assistant, preserved interface — Nov 9

| ID / plan mapping | One command or artifact | PASS | State |
|---|---|---|---|
| G2.1 · E-11 | `pnpm exec vitest run tests/era-activity.test.ts --passWithNoTests=false` | Registry write coverage, false-empty rejection, one-shot face deep link and missing/deleted entity fallback pass | NOT RUN |
| G2.2 · E-05/E-11 | Owner scratch-DB artifact: insert two ERA messages more than six hours apart | Conversation timestamp follows latest message; valid faces accepted; invalid face rejected; no duplicate trigger behavior | NOT RUN |
| G2.3 · E-10 | Owner 390×844 screenshot: prior-day push opened after sign-in | Same briefing ID/date opens in ERA; no replacement with today's content; nonrecipient cannot read it | NOT RUN |
| G2.4 · E-10/E-15 | Owner 390×844 screenshot after offline reload | Bounded stored briefing/topview facts paint with age; unavailable facts do not become zero | NOT RUN |
| G2.5 · E-14 | Owner network artifact after dashboard load | One topview request replaces the four summary fetch paths; displayed facts match fixture and household scope | NOT RUN |
| G2.6 · E-10 | `pnpm exec vitest run tests/era-analysis-parity.test.ts --passWithNoTests=false` | New and saved report paths use existing generator/renderer; ownership enforced; no floating loader remains | NOT RUN |
| G2.7 · E-13 | `pnpm exec vitest run tests/era-host-policy.test.ts --passWithNoTests=false` | ERA host persists once; Hub host posts one system reply with no ERA conversation insert; one domain action | NOT RUN |
| G2.8 · E-13 | `node -e "const s=require('fs').readFileSync('src/components/hub/HubPage.tsx','utf8');const n=s.split(String.fromCharCode(10)).length-1;console.log(n);process.exit(n<6275?0:1)"` | LF count < 6,275 | NOT RUN |
| G2.9 · E-13 | Owner phone screenshot after Hub reminder at 09:00 | One saved reminder at 09:00 and one household system reply | NOT RUN |
| G2.10 · E-16 | Owner paired screenshot of same reminder on both phones under approved identity mapping | Same person keeps same color across viewers; scope correct | NOT RUN |
| G2.11 · E-10/E-15 | Before/after screenshot pair, 390×844 and 1440×900 | Existing orb/nav/widgets/layout unchanged; new controls visible with keyboard/header/safe area | NOT RUN |
| G2.12 · E-17 | Owner 390×844 four-frame screenshot: forced token, SDK, worklet and midstream failures | Each frame shows usable text entry and its successful typed reply; no false action success | NOT RUN |

### G3 · Proposals and bounded learning — Dec 7; L4 target Dec 31

| ID / plan mapping | One command or artifact | PASS | State |
|---|---|---|---|
| G3.1 · E-19 | `pnpm exec vitest run src/lib/notifications/deliveryPolicy.test.ts --passWithNoTests=false` | Quiet interval, per-user three-push cap, overflow digest, recipient timezone and chosen C01 resolution pass | NOT RUN |
| G3.2 · E-20 | Owner phone screenshot after one briefing action | Owning draft/review surface opens; no direct AI money write; action ID ties back to original signal | NOT RUN |
| G3.3 · E-21/E-22 | `pnpm exec vitest run src/lib/briefing/signals.test.ts --passWithNoTests=false` | Anomaly/module signals appear only with verified inputs and provenance; repeat event produces no duplicate logical signal | NOT RUN |
| G3.4 · E-23 | `pnpm exec vitest run src/lib/briefing/signals.test.ts --passWithNoTests=false` | Explicit negative feedback changes rank as specified; missing feedback is neutral; safety severity ordering retained | NOT RUN |

## 4 · Owner-only evidence requests

**UNVERIFIED: current RLS/policies, timestamp trigger, SECURITY DEFINER bodies and applied migrations.** The owner runs `migrations/db-state.sql`, supplies its complete output as a fresh snapshot, and stamps the Applied ledger. Missing migration files must be recovered/reconciled before stamping; a filename mentioned in a checklist is not executable SQL. The study does not infer whether any migration was applied.

For a visibility symptom, the owner supplies both queries below, untruncated. Expand the table set to every actual read-path table before use; do not diagnose visibility by reading routes first (Hard Rule 27).

```sql
select relname, relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and relname in (
    'era_conversations','era_messages','era_actions','era_templates',
    'notifications','notification_preferences','push_subscriptions',
    'transactions','accounts','items','reminder_details','event_details',
    'item_alerts','item_prerequisites','household_links'
  );

select tablename, policyname, permissive, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'era_conversations','era_messages','era_actions','era_templates',
    'notifications','notification_preferences','push_subscriptions',
    'transactions','accounts','items','reminder_details','event_details',
    'item_alerts','item_prerequisites','household_links'
  );
```

**UNVERIFIED: live intent-face CHECK.** Owner query:

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.era_messages'::regclass and contype = 'c';
```

**UNVERIFIED: external scheduler state and device delivery.** Owner supplies `cron.job`/job-run output without secrets, authenticated health liveness and phone evidence from G1.12/G1.13. Repository absence of `vercel.json` proves no such file; it proves nothing about external scheduling.

**UNVERIFIED: persistent person/color identity.** Owner identifies the persisted profile field or supplies the stable two-person mapping; G2.10 checks it. Do not create a schema field from the theme inference alone.

**UNVERIFIED: current deployment serves this revision.** Owner supplies the deployed commit/build identity and route observation. CI alone cannot establish the running server's revision (C12).

## 5 · Metric definitions that prevent false passes

**DOCKS → E-06/E-07.**

| Metric | Numerator / denominator or evidence | Invalid substitute |
|---|---|---|
| SFR₇ transport | Distinct eligible local dates with accepted transport / eligible local dates in last seven | Number of successful cron executions |
| Observed delivery | Phone observations or implemented device acknowledgments, identified by recipient/date/notification | Notification insert or `!allFailed` |
| Briefing precision | Positive explicit verdicts / all explicit verdicts in 14 days; no votes = unavailable | Treating silence as approval or displaying zero as a measured score |
| Cron liveness | Last successful finish + expected cadence + running-too-long state, per job | Six rows of any age |
| Capture success | Authoritative ID, or durable queue receipt explicitly still pending | Conversation bubble, HTTP request start or memory-only queue ID |
| AI allowance | Recorded provider usage with feature/model attribution; explicitly marked estimates where unavailable | Truncated prompt-text estimate presented as actual spend |

No metric requires a new analytics module. Use existing notification, feedback and AI telemetry stores; verify missing schema through the owner workflow before implementation.

## 6 · Explicit exclusions from “complete”

The plan's separate module repair, export/security and native gates remain mandatory in their own campaigns; passing this Top Layer table does not close them. This study does not require a new standalone module, new assistant store, new queue feature key, replacement recurrence or balance engine, UI redesign, or automatic AI money/schedule writes.

Offline confirmation, transfers, debt settlement and recurrence edits are excluded from the first safe queue rollout until their owning operations have equivalent atomicity/idempotency proof. Broader focus entities remain gated on authorized capability contracts. The parked evaluation-corpus frontier is not a completion dependency. D2's excluded scope remains outside all gates.

Phase 5 owns checklist injection, Master Book defect entries, conventions/index amendments, the final Contradiction Register and ecosystem portfolio. Their absence during Phase 2 is deliberate; no campaign queue is changed here.

## ASTRA 10× Findings

- **Leverage 1 — DOCKS → E-05/E-06:** replace “cron green means spoken” with recipient/local-date/device proof. This measures the owner's actual morning outcome [Architecture A12; G1.10–G1.14].
- **Leverage 2 — DOCKS → E-09:** the lost-response/retry and restart fixtures expose failures an ordinary successful online demo cannot reveal [A5–A7/A17; G1.2–G1.8].
- **Leverage 3 — DOCKS → E-01/E-11:** require a nonempty test selection, the tested SHA and outcome assertions. A new test file outside CI's include is not coverage [A14; §3].
- **Simplification — DOCKS → E-06/E-07:** use the existing action/notification/AI stores for evidence instead of building another dashboard database (§5).
- **Frontier — None found with sufficient evidence:** a new measurement product would add work before these existing boundaries are proven.
- **Uncomfortable — DOCKS → G0/G1:** the baseline DB checker can exit zero with printed failures, and the planned briefing gate accepts a successful cron as a successful morning. Both can produce green status without the property their names promise (§2; G1.12).
