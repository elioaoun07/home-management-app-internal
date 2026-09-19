---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# ASTRA — 10x Portfolio

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>). Cutoff `3106164`; written last after Phase5 reconciliation. [Register](<ASTRA — Contradiction Register.md>) holds unresolved decisions; [Coverage](<ASTRA — Coverage & Orphans.md>) holds queue ownership and admission.

Ranked by correctness, trust, capture speed, coherence, then foresight. **M = one 2–4h session.** Chains exclude prerequisites/owner waits. Capacity: two packets/week; no additional slots granted.

| Rank | Change | User impact | Engineering leverage | Evidence confidence | Effort | Existing packet / NEW |
|---|---|---|---|---|---|---|
| 1 | Durable ERA capture with one replay identity | Captured spends/reminders survive restart and replay once | Repair the existing queue and endpoint contracts | High: [A3–A7/A17](<../Top Layer/Top Layer — ASTRA Architecture.md>); DB/device proof pending | 4 M + prerequisites | DOCKS → E-09a–d / HUB-46 |
| 2 | Atomic shared balance delta and history | Concurrent writes retain every money effect | One helper protects multiple money paths | High: [Budget F1](<Budget/Budget — ASTRA Book.md>); live DB unverified | M + owner DB gate | NEW BUD-63 |
| 3 | Atomic draft confirmation | Confirm once: status and money commit together | Reuse rank2; separate capture from confirmation | High: Budget F2; DB proof pending | M after rank2 | NEW BUD-64 |
| 4 | Refuse unsupported recurrence before writing | Recurrence cannot silently become a one-time task | Guard initial and pending confirmation | High: [Schedule F3](<Schedule/Schedule — ASTRA Book.md>) | S | DOCKS → E-09; SCH-7 |
| 5 | Atomic import-create effects | Failed imports leave no orphan money effects | Reuse rank2; other branches stay separate | High: Budget F3; DB proof pending | M after rank2 | NEW BUD-65 |
| 6 | One canonical day-occurrence adapter | Views agree on pauses, moves and placements | Delete divergent logic; reuse existing engine | High: Schedule F1/F2 | M; consumer follow-ons separate | EXTENDS → SCH-4.3b / ASTRA-SCH-1 |
| 7 | One explicit action-outcome gate | Failed actions cannot reinforce themselves | Learning/focus/activity share one result contract | High: A1/A2/A8 | M after CI | DOCKS → E-11a / HUB-47 |
| 8 | Canonical money facts with completeness | Unavailable/mixed totals stop masquerading as actuals | Answers/signals share period, scope and currency | High: Budget F5 / A13 | 2 M; domain prerequisites separate | BUD-66 + E-04a / HUB-41 |
| 9 | Zero executed tests can never pass validation | “Tested” means a test actually ran | One gate protects all product packets | High: [Delivery F5](<Delivery/Delivery — ASTRA Book.md>) | S; existing prerequisite | EXTENDS → DLV-90 / ASTRA-DLV-4 |
| 10 | First briefing with local eligibility and observed delivery | Useful facts reach both people on time | One identity connects scheduling, retry and delivery | High source evidence: A12/C01–C07; delivery unverified | 2 M + 2 S after rank8, ledger and owner gates | DOCKS → E-02a/E-03a/E-05a–b |

## ASTRA 10× Findings

**If only 3 things ship this quarter, which 3?** Recoverable capture; atomic money commitments; a dependable household briefing. These span multiple sheets. Preserve prerequisites and sacrifice optional expansion before compressing their proof.

**What should ERA stop investing in?** Additional assistant doors, model consumers and Delivery machinery before foundations pass. Retire the floating assistant after report parity; legacy PM assets after cutover proof and freeze eligibility. Skip duplicate filters, reads and heartbeats.

**What single architectural change unlocks the most future capability?** An explicit action lifecycle: proposed, durably captured, committed, failed, reversed. Stable identity lets replay, learning, activity and later automation share proven effects at the existing boundary.

**What single reliability problem most threatens trust in ERA?** False success after a partial or nondurable write: lost capture, split money effects, or reinforced failing templates. Better feedback cannot repair it.

**What would most noticeably change the owner's daily experience?** Say it once, see the real result, then receive a useful briefing from those same facts. Frontier personalization stays held until that history is reliable.
