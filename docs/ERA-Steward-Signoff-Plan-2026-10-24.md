# ERA Steward: R44 assessment and final sign-off plan

**24 October 2026 · Analysis and proposed work; no controls implemented by this review.**

> **Current decision — 25 October 2026:** backend controls and the local adapter are verified. Full Dot orchestration sign-off is **pending**: the earlier plan assumed local MCP registration and per-Dot tool removal without proving either. The [corrected connection procedure](ERA-Steward-Runbook.md#steward-tools-connection-status-corrected-2026-10-25) uses the documented private-plugin/Secure MCP Tunnel route. It must pass an actual Dot read before acceptance. General local-computer access can be revoked; no hard ban on every cloud delegation is established. Custom rules are not equivalent to such a ban.

## Decision

**R44 is a good start and credible evidence for adopting Steward with your existing plan-approval and Apply gates. I would not sign off the current unrestricted supervision path.** Close the three phases below, then adopt it without another broad pilot campaign.

Your concern is valid: asking a coding agent to execute a simple command introduces AI consumption. Your explicitly commissioned setup repairs are legitimate separate work; routine local-access handoffs, status prompts and continuation nudges should disappear.

My additional release objection is verification: R44's new tests were first executed after Apply and failed. Future candidates must encounter that check before Apply.

## What R44 establishes

| Evidence | Assessment |
| --- | --- |
| Same fresh run reached Applied; exact plan/Apply gates and frozen receipts were preserved | The delivery path worked under supervision. |
| Final repaired checkout: 1,395 passing tests, zero failures; typecheck, scoped lint and PM build passed | Strong evidence for this outcome, not every future delivery. |
| Five authored tests failed after Apply; local repair differs from frozen C1 | Candidate verification omitted a relevant executable test suite. |
| Status updates lagged; phone acceptance remains unrecorded | Reporting and final owner acceptance are unfinished. |

Evidence: [R44 acceptance report](R44-Delivery-Acceptance-2026-10-24.md#owner-apply-and-final-integrated-validation---2026-10-24), especially lines 153–201. These are recorded results; this review did not rerun the delivery.

### The cost issue, precisely

The supplied summary records **366,633 tokens across two measured runs**, including **322,267 for the fresh run**. Those totals exclude external supervision, repairs and Dot orchestration. The 25 local Codex dispatch attempts—24 accepted, comprising 11 new turns and 13 follow-ups—are **not 25 inference calls**. Their model, usage, cache consumption and dollar cost are unknown.

The problems are **avoidable AI execution** and **incomplete accounting**. A cheaper model or one persistent conversation does not remove inference. The [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk) starts/continues prompted threads; [App Server command execution](https://learn.chatgpt.com/docs/app-server#command-execution) supports commands without creating a thread. The distinction is **whether inference starts**. Availability through Steward's actual connector still needs verification.

## Phase 1 — Remove routine AI delegation and expose the full accounting boundary

**Required before sign-off. Reuse the existing PM service; do not build another orchestrator.**

- Expose only typed operations for routine Steward use: **Start delivery, Read request, Read run, Wait for changes**. These wrap the existing authenticated transport and retain its command UUID, authorization, admission and duplicate protections. Persist before Start; uncertain responses recover the same receipt. Owner plan approval and Apply remain separate.
- Restrict the **actual Steward tool configuration**: no generic Codex/Claude task delegation or arbitrary shell execution in this workflow. Enforce the allowed operations server-side as well. A prompt saying “do not call Codex” is insufficient. Repo changes cannot prevent a separate external chat from invoking another available tool.
- Execute status checks and fixed local checks directly in trusted code. Use existing events or bounded polling; render short status templates with IDs and evidence timestamps. A stale connection retains the last known result and never triggers Start or AI repair.
- Keep reporting alive independently of the chat turn. Use PM as the authoritative destination. If the chat platform lacks deterministic event delivery, return the run link and use PM updates; do not add an AI polling loop to simulate notifications.
- Genuine failures produce one blocker and stop. An owner-requested Claude/Codex repair gets a separate support receipt linked to the delivery/request, with explicit scope, model tier, effort and allowance. Default automatic support jobs: **zero**. No model fallback, retry or allowance increase without the corresponding authority.
- Report **Delivery / Support / Chat overhead** separately, plus accounting coverage. Per AI job retain purpose, requested settings, observed settings when available, job/thread/turn IDs, input/cached-input/output counts, stop reason and cost provenance. Preserve cumulative-counter normalization. Cached input stays inside input; missing cost is **unknown**, never $0. Do not invent internal call counts or recover unavailable historical R44 usage.

**Completion evidence:** routine control creates zero coding-agent turns outside admitted Delivery jobs; generic delegation is refused; authorized support is visibly separate. Dot's initial interpretation and any later chat still use AI. If no restricted direct tool route is available, use PM controls until that integration exists.

**Budget boundary:** the recorded 600,000-token allowance is advisory. Focused already limits work to one planning job, one implementation job and zero repairs. Keep those limits. Threshold stopping can overshoot before usage arrives; a hard cap is unsupported. Retain supervised operation. Stronger unattended/runtime guarantees belong to **DLV-114**, not this sign-off or a mandatory paid experiment today.

Source basis: [Steward runbook](ERA-Steward-Runbook.md), lines 34–61, already prohibits terminal commands and diagnosis. [steward-requests.mjs](../scripts/delivery-v2/steward-requests.mjs), lines 27–78 and 122–183, provides receipt claims and passive projections; its Steward label is not external-agent authentication. [budget.mjs](../scripts/delivery-v2/budget.mjs), lines 35–167, defines the enforcement limits; [codex.mjs](../scripts/delivery-v2/adapters/codex.mjs), lines 140–191 and 372–391, distinguishes counters and observed settings.

## Phase 2 — Close the candidate-test gap

**Required before sign-off; one narrow verification change.**

- Include relevant new/changed tests in the approved verification contract. Execute them against the frozen candidate in the existing isolated checker, using trusted, pinned commands.
- Missing, failing, timed-out or skipped mandatory tests must prevent **Candidate verified** and Apply eligibility. Keep the independent protected oracle and typecheck. Candidate-authored tests cannot replace them or select arbitrary host commands.
- Bind the test receipt to candidate and check-definition hashes. If integration changes the tested inputs, rerun the affected checks before Applied. Do not require an unrelated full application suite for every small delivery.
- Preserve original C1 and its receipts. Keep the successful local fixture repair explicitly separate and obtain owner review of that existing diff.

**Completion evidence:** the repaired suite executes against the candidate and passes. An intentionally failing/timed-out fixture proves verification and Apply are blocked. Do not require the historical timeout to recur: ESLint startup timing depends on the environment.

## Phase 3 — One closure check, then finish

Use one offline integration suite with fake provider events to prove:

1. Success, repeated status reads, lost Start response and reconnect retain one command/run identity and cause zero supervision-model calls.
2. A stale connection, duplicate event or unexpected failure causes no new Start, repair or hidden fallback.
3. A generic agent/shell request is denied; an explicitly authorized support job is linked and counted. Unknown usage remains visible, and job/admission limits block further dispatch.
4. A failing mandatory candidate test blocks verification/Apply; passing evidence is bound to the exact candidate. Owner approval gates remain intact.

Then verify the **real Steward integration**, once, against the existing R44 run: inspect its restricted tool permissions and perform read-only status/reconnect checks. Confirm no coding-agent turn was dispatched. Offline mocks alone cannot prove the external tool configuration changed. Open/reload that same Applied run on the physical phone and record the result; review the existing fixture repair. **No new R44 Start or paid end-to-end run is needed.**

Record one acceptance result in the existing Delivery UAT record. If a check fails, correct that defect and repeat only the affected check.

## Stop scope

Historical missing evidence links, R48's 96 warnings, another Docker inventory, cache optimization, model comparisons and a new monitoring dashboard are **not prerequisites**, unless they prevent a check above. Refresh stale runbook status wording during implementation; preserve its history.

The closure statement should be: **“ERA Steward is accepted for routine delivery initiation and deterministic monitoring, with owner plan approval and Apply, explicit support escalation, and disclosed budget limits.”**

**Tracking:** Delivery owns the proposed closure; DLV-138/139/140 supply request/transport context and DLV-114 owns stronger runtime limits. This is supporting analysis, not a second backlog. Evidence: October 24 summary and final acceptance report, plus current source changes since the Master Book's October 19 cutoff. This review changed documentation only.

**Document checks:** PM lint, feature-index consistency, report-local links and whitespace passed; archive had nothing to sweep. `pm:check-docs` still reports the 15 historical missing evidence links. No application tests or live runs were performed for this documentation-only review.

## Implementation status — 2026-10-24

Implemented as [DLV-144](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-144>); setup in the [runbook](ERA-Steward-Runbook.md#typed-tools-support-accounting-and-candidate-tests--dlv-144), results and owner scenarios in [Delivery UAT](Delivery-UAT.md#era-steward-sign-off--2026-10-24). Nothing below was run against a provider, Docker or the live store.

| Plan point | Status |
| --- | --- |
| Phase 1 · four typed operations over the existing transport, Start persisted first, same receipt on an uncertain reply | **Done** — `steward-tools.mjs`, `steward-mcp.mjs` |
| Phase 1 · restrict the actual tool configuration; enforce server-side | **PM credential restrictions done. Dot integration pending.** Connect and test the private plugin, verify local access revocation, and disclose the remaining cloud-delegation limitation (M1). Server controls do not remove unrelated Dot tools |
| Phase 1 · status and fixed checks in trusted code, templates, stale = last known | **Done** |
| Phase 1 · reporting independent of the chat turn | PM request cards remain the destination; `wait-for-changes` is bounded polling with no model. Push into the chat is **not** established and no AI polling loop was added |
| Phase 1 · one blocker then stop; support is a separate, owner-authorized receipt; zero automatic jobs | **Done** — `support-ledger.mjs`, `pnpm pm:support`; one job per authorization |
| Phase 1 · Delivery / Support / Chat overhead apart, coverage, unknown stays unknown | **Done** — report, `read-run`, run-page Support card. Chat is owner-entered only |
| Phase 1 · budget boundary | Unchanged: advisory allowance, Focused 1 plan / 1 implementation / 0 repairs. Hard cap stays DLV-114 |
| Phase 2 · relevant new/changed tests in the verification contract, run in the isolated checker with pinned commands; missing/failing/timed-out/skipped block Verified and Apply; bound to candidate and definition; re-run on the integrated tree | **Done** — `candidate-tests.mjs`, `journey.mjs`. UAT now records policy revision 11 installed and the checker witness passed; owner Check readiness remains (M3) |
| Phase 2 · keep C1 and its receipts; owner reviews the fixture repair | C1 untouched. **Owner step:** M5 |
| Phase 3 · one offline suite proving the four statements | **Done** — `tests/delivery-v2/steward-closure.test.ts` |
| Phase 3 · real Steward integration read-only check, physical phone, UAT record | Record **done**; the check and the phone pass are **owner steps** (M2, M4) |
| Stop scope | Untouched. Stale runbook status wording refreshed; its history kept |

## Review corrections and sign-off — 2026-10-24

The four review areas are fixed: server-enforced prevention of additional Steward attempts, default test discovery covering `src/`, strict file/test evidence, honest usage/cost coverage and the Applied status label. Steward can no longer assert owner retry consent. An owner starts any new attempt through the normal PM controls.

Verified: **241 tests passed in one invocation across 13 files**; typecheck, scoped lint, PM build, PM lint and Feature Index passed. The installed protected checker also executed one passing synthetic test and rejected one deliberately failing control with no network or provider usage. A rerun exposed a further startup timeout in the R44 fixture; its loader now shares one real ESLint API instance at the repository root. The same cases/assertions and deadlines passed alone and in the final aggregate. Frozen C1 is unchanged; the local diff and current hash are recorded in UAT.

**Backend engineering acceptance: supported by the evidence above. Full Dot integration/sign-off: pending.** The remaining actions are:

1. Complete the documented private-plugin connection in the runbook and prove the real Dot read with general local-computer access revoked. Do not replace that proof with local Codex registration or a prompt refusal. All-cloud-delegation prevention is not established.
2. Owner restarts the existing bridge once and checks readiness. UAT records restricted pairing and policy revision 11 already completed; neither needs repeating. The installed checker witness passed.
3. Complete the real Dot read/reconnect and physical-phone checks in UAT M1/M2/M4, then record the precise accepted scope. M2 must never call Start. M5 has an agent code-review PASS available for that decision.

No live Start, provider job, bridge restart, installed-policy change, production write, commit or deployment was performed by this correction. Browser automation failed during Windows sandbox initialization; the Support card remains render-tested. Historical missing evidence links remain separate documentation debt.
