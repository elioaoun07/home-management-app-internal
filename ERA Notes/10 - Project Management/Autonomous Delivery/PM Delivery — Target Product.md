---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# PM Delivery — Target Product

## 1. The owner's job

**Delegate a meaningful software change once, return when a real decision or useful result is ready, and recover without reconstructing the session personally.** That is the smallest useful mission. Project documentation and agent monitoring support it; they are not the product outcome.

Repository evidence of the owner's workflow is unusually concrete: the BUD-14 quick-amount change spent $0.5317 before building; a mobile tap accidentally completed and hid work; an accepted session held the build slot for four days; the phone redesign was prompted by excessive clutter and text. These are recorded incidents, not observations of today's installed app. See [Diagnosis](<PM Delivery — Current System Diagnosis.md>) and the Delivery/PM Tooling Master Books.

The owner wants to delegate capture-to-fix, investigation of unclear defects, bounded feature work, testing and documentation. They should retain decisions about product intent when alternatives materially differ, broader scope/resources than authorized, consequential release actions, and observations unavailable to software. File location, routine repair attempts and regeneration of already-approved artifacts should not consume owner decisions.

## 2. What the product removes

The owner currently needs to select modes/models, interpret preflight, inspect multiple phase artifacts, notice questions, recover limits, judge whether checks proved the request, and distinguish acceptance from actual shipping. Some of this is necessary; much is compensation for weak machine records.

V2 removes repeated transcription of the same intent, approvals of identical artifacts, manual context reconstruction, guessing whether a phone command succeeded, and watching a heartbeat to infer progress. It keeps useful evidence, explicit decisions and a short recoverable history. It does not import sprint machinery, velocity targets or team ceremony for a solo owner.

## 3. Desktop information architecture

Four destinations are sufficient:

| Destination | Primary content | Main action |
|---|---|---|
| Work | Now/Next/Later product work; search, campaign, risk and dependency filters | Open or start work |
| Running | Active work, last meaningful progress, resource bounds, waits | Inspect, pause or resume |
| Decisions | Only unresolved decisions the owner can resolve | Read evidence and decide |
| Results | Verified candidates, required UAT, partial handoffs, integration/shipping receipts | Inspect and accept/integrate where authorized |

Campaign documents, prior studies and learned facts remain searchable detail, not extra dashboards. Activity is the event trail within a work item, with a global filtered view when useful. The current board, search and routing are reusable; four new destinations do not require four new implementations.

Illustrative desktop arrangement:

```text
Work  Running  Decisions  Results                    Search   Capture

Now                         Selected work
  Offline retry receipt     Desired outcome + FAST / DEEP DIVE
  Quick amount preset       Latest meaningful event / next obligation
  Schedule consistency      Candidate and evidence / decisions / history
```

An active card answers: what work, what changed since the last useful update, what happens next, and whether it needs the owner. Raw tool calls remain one click away. There is no fabricated percent-complete gauge.

## 4. Phone information architecture

Home shows urgent decisions and ready results first, then active work. Three primary destinations—Home, Work, Results—with a persistent Capture affordance are enough. Sessions open directly from notifications. A short result fits the screen; evidence opens on demand. Large diffs or device-dependent checks state what is still needed instead of shrinking desktop UI onto the phone.

```text
Needs you
  Schedule rule — choose date meaning           Open

Ready
  Quick amount preset — checks complete         Review

Running
  Offline retry receipt — regression reproduced

Home              Work              Results       +
```

These are information sketches, not approved production strings. Real UI follows Hard Rule 28: short labels, verbs and facts, no rationale paragraphs. Desktop affords dense exploration; mobile affords status, decisions, bounded review and control.

The phone can approve the same proposition as desktop when it displays sufficient current evidence and the grant permits it. Device size is not itself a security model. An unavailable artifact, stale revision, large unreadable change or required typed risk decision can make a particular decision ineligible. This is a V2 recommendation, not expansion of V1's INSTANT-only phone approval policy.

## 5. Two experiences, automatic internal strategy

**FAST:** select or describe a bounded change, inspect one compact contract if needed, start, receive a checked candidate. Known templates can supply scope and checks. The owner need not choose agent roles, phase counts or a model. An unexpected dependency becomes a specific scope decision or an automatic DEEP DIVE escalation within the already-authorized resources.

**DEEP DIVE:** describe the uncertain problem and investigation allowance. The system records competing explanations and gathers discriminating evidence, then presents a design decision only when owner values are needed. It implements accepted scope in useful increments and preserves understanding across interruption. Depth is useful investigation, not mandatory document volume.

Every capture immediately returns a stable work identity and appears as untriaged Work. Offline capture shows its local pending receipt until the authority acknowledges the same ID. Triage can wait; finding the captured item cannot depend on triage. This directly addresses the current seven-Inbox-rows/zero-relayed-rows reproduction in Diagnosis D14.

Mode selection affects effort and exploration. It does not grant permission or weaken evidence. [FAST](<PM Delivery — FAST.md>) and [DEEP DIVE](<PM Delivery — DEEP DIVE.md>) contain complete journeys, including failures and final outcomes.

## 6. Decisions must buy something

| Decision | Owner sees | What the answer changes |
|---|---|---|
| Intent unresolved | Two meaningful outcomes and relevant evidence | Contract revision |
| Scope/resource exception | New dependency/risk and proposed bound | Grant, never retroactive authority |
| Required observation | Exact build and a short action to perform | Attributed observation, not generic approval |
| Candidate acceptance | Change, checks, missing evidence and known limits | Acceptance receipt for this revision |
| Integration/release | Exact candidate and destination | Only the named consequential effect |

Do not ask the owner to approve a retry that software can safely reconcile. Do not ask twice because a request timed out. One informed action may accept and authorize integration of the same exact candidate when both consequences are clear; separate receipts do not require separate gates. Do not bundle acceptance of a specification with a hidden budget increase. Changed requirements invalidate affected decisions visibly.

## 7. Truthful degraded experience

`Working` requires a current attempt, while `Connected` only describes transport. `Checked` names the evidence scope. `Accepted`, `Integrated`, and `Shipped` are distinct receipts. Unknown completion is shown as unresolved, never silently converted to failure or success.

The phone distinguishes laptop availability, projection age and command receipt. Cached results remain readable with their original timestamp. Account changes never reveal the prior owner's cache. An offline Stop request does not claim the process has stopped. A result cannot turn green solely because the latest summary sounds positive.

Notification-worthy events are a consequential question, failed evidence that cannot recover within allowance, resource exception, unresolved external effect, or completed result. Tool-call notifications and periodic model-generated reassurance are unnecessary.

## 8. Product success and limits

Track owner active minutes, decisions requiring new information, unattended useful work, time to verified candidate, time to safe recovery, escaped defects and cost provenance. Compare similar tasks; do not turn the selected 16-session history into a reliable rate estimate.

Proposed pilot goals, not measured claims: a known FAST task reaches a candidate with one launch interaction and no intermediate owner decision; a DEEP DIVE can be resumed by a fresh model without re-asking recorded decisions; a dropped mobile acknowledgment creates no duplicate effect; every closed result explains exactly what is and is not established. Release remains explicitly owner controlled.

The product may conclude with a useful partial result. It may not hide missing evidence to preserve an autonomy statistic.
