---
created: 2026-09-10
updated: 2026-09-10
type: decision-register
status: active
owner: Elio
---

# Owner decisions

Only unresolved choices live here. Checklists own the associated work; selecting an option here does not implement it or certify a deployment. Existing constraints remain binding until a dated decision explicitly changes them. Evidence questions (SQL applied, alarm observed, test passed) stay with their task rather than becoming policy debates.

## Open choices

| ID | Choice to resolve | Current constraint and owning work | Provenance |
|---|---|---|---|
| DEC-01 | Choose the briefing hour or a narrowly defined scheduled-digest exception; settle minimum partner-policy sequencing before activation. | The plan promises 07:15 but quiet hours end at 08:00. Keep quiet hours and each recipient's choice; HUB-39/42/51 and NOTIF-19 cannot claim activation until resolved. DST uses IANA local dates, never a fixed UTC offset. | ASTRA C01/C03; Top Layer D5/D6 |
| DEC-02 | Define persistent person colors when display theme is frost/calm or changes. | Preserve person-absolute identity; do not infer a different person's identity from the viewer's current theme. HUB-51. | ASTRA C10 |
| DEC-03 | Confirm low-stock threshold meaning and when an automatic shopping addition is allowed. | KIT-1 retains the requested bridge, but repeated observations, retries and partner actions need one atomic identity. No activation from the study alone. | ASTRA K03; Kitchen D1 |
| DEC-04 | Choose Trip reversal behavior when a user independently changes an affected item after activation; settle lifecycle-proof versus panel-first sequencing. | TRIP-1/2/3 prove the lifecycle; TRIP-4 cannot claim trustworthy side effects from a panel alone. Current lifecycle contract must be verified; no reversal policy is selected here and no production experiment is authorized. | ASTRA T02/T03 |
| DEC-05 | Accept an extra navigation tap for notification Done, or retain a shortcut with full occurrence semantics. | NOTIF completion work must use Schedule's identity/Undo contract; neither a bare parent update nor an unapproved shortcut removal is accepted. | ASTRA N02 |
| DEC-06 | Retain or amend the module-specific ban on cron logs. | Global rules permit server diagnostics, but the stricter Notifications decision still exists. NOTIF-5.4 records the decision; HUB-38 does not waive it. | ASTRA N03 |
| DEC-07 | Limit mandatory Undo to mutation-confirming toasts, or retain the literal all-toasts rule. | R45 remains a held wording decision; this refactor does not amend the product's Hard Rule 1. | ASTRA C16; R45 |
| DEC-08 | Permit bounded signed-URL batches for large wardrobes instead of exactly one request per screen. | OUT-19's one-request acceptance remains until changed. Atomic outfit composition is independent. | ASTRA O02 |
| DEC-09 | Choose archive/restore versus permanent deletion for garments, with the corresponding real Undo contract. | Preserve personal ownership, free on-device background removal and the no-v1-offline-write decisions. No service migration is approved. | ASTRA O04/O05 |
| DEC-10 | Make the time-window evaluator required, or keep it conditional on a real feature need. | SCH-4.4 says optional while the old campaign D2 requires it. It stays Later/held; a documentation refactor cannot claim the evaluator works. | ASTRA S03 |
| DEC-11 | Clarify “approval for some transactions that requires both comments”: two household approvals, two comments, or another condition; which transactions qualify? | Budget holds a requirements decision with the original wording. No bilateral financial workflow is invented. | Inbox, undated |
| DEC-12 | Define what changing a populated account's type/currency means for historical transactions and balances. | Preserve historical meaning until a reviewed migration/conversion contract exists. Money summaries must use canonical account semantics. | Unknown Unknowns UU-X3; ASTRA B08 |
| DEC-13 | Decide whether shared history belongs to a stable household container or the current partner-link epoch. | Current visibility rules stay binding; a new identity model requires explicit lifecycle/privacy decisions. | Unknown Unknowns UU-X4 |
| DEC-14 | Supply the actual V2 resource amounts before any paid run: unit, estimated-spend threshold, dispatch/repair limits, wall-time/stop limit, strictness, and the FAST default acceptance criteria. | Direction adopted 2026-09-11 ([Delivery decisions](<Delivery/Delivery — Master Book.md#vision--decisions>)): per-run executor/model/effort from qualified profiles; plan approval covers implementation, checks and limited repair; ask again only for consequential change, a blocking question or final application. Amounts are owner-supplied, never invented; unknown cost never becomes zero. DLV-96/97 still gate dispatch. | Sep 9 execution-policy gap; former open DLV-95; [Command Center §4](<Plans/Command Center.md#4-delivery-design-to-build-toward>) |
| DEC-17 | Define ingredient↔stock identity/unit mapping and the reversible consumption event before automatic deduction. | KIT-2 needs a reviewed mapping/quantity contract. Estimated cooking durations are not measured behavior; stock observations are not guaranteed truth. | ASTRA K04; Proactive PE01 |

| DEC-18 | Keep or remove household_members after checking actual deployed use. | HUB-62 requires the owner’s current schema/application witness; table existence is not authority to drop it. | Top Layer E-00/D14 |
| DEC-19 | Define available versus projected balance for pending income drafts. | BUD-75 retains the stored100 / pendingincome2000 / displayed−1900 example as a contract question. | ASTRA B08 |
| DEC-20 | Define currency/FX contracts for debt, split and NFC consumers. | BUD-76 prevents implicit mixed-currency arithmetic or unsupported recommendations. | Budget ASTRA consumer audit |
| DEC-21 | Change or retain V1’s three-gate interaction model for the real-product experiment. | DLV-89 stays held; existing INSTANT exception is narrower and remains valid. | Command Center ASTRA C04 |
| DEC-22 | Choose the sacrifice order if the Top Layer calendar gates are missed. | Original §4 and §5.8 disagree; dates are historical targets, not permission to silently drop a retained item. | Sep2 accepted plan |
| DEC-23 | Admit a bounded correction of existing floating-panel debt under the ERA style freeze. | HUB-68 preserves both constraints until scope is chosen; future new panels already follow Hard Rule15. | ASTRA C11 |

## Reconciled facts and authority

- **Owner constraint 2026-09-13 (DEC-14 / Delivery):** no API keys and no additional costs; use existing Claude and ChatGPT subscriptions through their native SDKs. The proposed USD 2 trial allowance is withdrawn, not awaiting approval. Time/turn/concurrency limits remain separate operational choices; SDK API-equivalent estimates are not invoices. DLV-110 owns subscription authentication and no-paid-fallback enforcement; DLV-96/97 still gate launch. Do not solicit a paid allowance to resolve DEC-14 for this trial.
- **One queue owner:** NOTIF-19 owns E-19 delivery policy; HUB-53 and NOTIF-5.7 are aliases. BUD-2 owns merchant matching in the Hub action; HUB-10 is a dependency alias. Original scope survives in the owning book.
- **Plan authority:** the accepted Top Layer specification keeps its substantive constraints and historical target dates; campaign queues own current status and execution order. Superseded Awakening/Top View/FAR schedules do not add missed-date tasks.
- **Resolved 2026-09-11:** DEC-15 (phone use is a core milestone) and DEC-16 (eventual owner-triggered protected Apply) moved to the [Delivery reconciliation history](<Delivery/Delivery — Master Book.md#backlog-reconciliation>) on adoption of [Command Center](<Plans/Command Center.md>).
- **Delivery generations:** accepted V2 design and separately authorized September construction do not repeal V1's operating freeze. The current open uses of DLV-94/95 become DLV-96/97; the original historical IDs stay unchanged.
- **Evidence boundaries:** a source-present bell needs device acceptance, not another implementation. A missing migration file does not prove production SQL is unapplied. Shipped code with owner verification outstanding keeps a separate open verification item.
- **Disproved allegations:** Unknown Unknowns UU-X6 did not reproduce the claimed queue-overwrite or PM auth-bypass flaws; those allegations are not newly admitted bugs. UU-X1–X5 retain their narrower findings and evidence limits.
- **Governance:** research commissions create evidence, not new campaigns or automatic execution capacity. FABLE/FABLED/ASTRA generations are historical sources; current conventions and campaign books govern new work. Graphify output is navigation only and cannot certify source identity.

The complete earlier contradiction tables, including reconciled factual deltas, are preserved in [ASTRA Contradiction Register](<_Archive/Studies/ASTRA/ASTRA — Contradiction Register.md>). New decisions should add a dated accepted choice to the owning book, update the linked tasks/specification, then move the resolved row to that book's reconciliation history with its DEC ID intact.
