---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit cacf59d (2026-11-04)"
---

# ERA Open Business Decisions

[README](README.md) · [Business Rules](BUSINESS-RULES.md) · [Scenario Catalogue](SCENARIO-CATALOGUE.md) · **Open Decisions**

Business questions the code cannot answer, because current behaviour, documents and reasonable expectations disagree, or because nothing defines the rule. Each one is the owner's call. Options are listed with their effect on people; "Current" is what happens today, not a recommendation. Where an earlier research file already asked the same question, its ID is given so it is answered once.

## Summary

| ID | Question | Scenarios | Also asked in |
|---|---|---|---|
| Q-01 | If the balance cannot be updated, should the spend fail too? | S03 | — |
| Q-02 | What may the partner see of a private account and a private transaction? | S05 | — |
| Q-03 | Does LBP change reduce what was "spent"? | S07 | — |
| Q-04 | Which billing period is correct for start days 29–31? | S01 | 08-shared-data rule 2.1 |
| Q-05 | Should recurring payments ever post themselves? | S03 | — |
| Q-06 | What happens when more is returned than a debt is worth? | S04 | — |
| Q-07 | Which day does a record belong to when no day was sent? | S02 | 08 D-4 |
| Q-08 | In whose time zone do daily nudges fire? | S02 | 08 D-3 |
| Q-09 | Do recurring reminders keep their local time across daylight saving; what happens to missed ones? | S09, S10 | — |
| Q-10 | Is deleting a schedule item always recoverable? | S08 | 01 D-1, 08 D-1 |
| Q-11 | What should a household trip do to routines, and what does returning undo? | S08 | 01 D-5 |
| Q-12 | Keep, build or remove the prerequisite types that never fire? | — | — |
| Q-13 | What happens to offline changes after a long time without signal? | S11 | 01 D-4 |
| Q-14 | Are the AI limits the intended household budget? | — | — |
| Q-15 | Do medication doses follow home time or the traveller? | S09 | — |
| Q-16 | Is an occurrence identified by when it was planned or when it was done? | S08 | 08 D-2 |
| Q-17 | Who is told when something is handed to the partner or a link is stale? | S12 | 08 D-6 |

---

### Q-01 If the balance cannot be updated, should the spend fail too?

- **Current:** the spend is saved and the balance silently stays (BR-02).
- **Options:** (a) fail the whole request and save nothing; (b) save and mark the account "needs reconciling" on screen; (c) keep today's behaviour.
- **Effect:** (a) is simplest to trust but needs one database transaction (BUD-63); (b) is visible but leaves a known-wrong balance.
- **Acceptance once decided:** a forced balance failure produces the chosen outcome, observable on the balance card.

### Q-02 What may the partner see of a private account and a private transaction?

- **Current:** every transaction on every account is visible; private rows keep their amount in totals but hide description and category; private accounts are listed as transfer destinations (BR-04).
- **Options:** (a) today's "masked but counted"; (b) private rows invisible and excluded from the partner's totals; (c) private *accounts* excluded entirely, private *rows* masked; (d) per-account choice.
- **Effect:** (b)/(c) make shared totals differ between the two phones; (a) lets amounts reveal surprises (S05).
- **Acceptance:** the owner fills the visibility table in S05; both phones match it.

### Q-03 Does LBP change reduce what was "spent"?

- **Current:** balances and all totals use the full USD paid; "actual value" is shown only in the form (BR-06).
- **Options:** (a) count the actual value in spending totals while the cash balance moves by the USD paid; (b) record the change as a separate LBP income on an LBP account; (c) keep today's behaviour and remove the "actual value" hint.
- **Acceptance:** S07 figures agree across category totals, envelopes and ERA.

### Q-04 Which billing period is correct for start days 29–31?

- **Current:** two implementations clamp to the month's last day; the dashboard's does not (BR-07, S01).
- **Options:** (a) clamp (31 → 30 Nov, 28 Feb); (b) start the next day (31 → 1 Dec); (c) restrict the setting to 1–28.
- **Acceptance:** S01 table filled with one period for every surface.

### Q-05 Should recurring payments ever post themselves?

- **Current:** never; the Feature Map says a cron does (BR-10).
- **Options:** (a) manual only, fix the document; (b) auto-post as drafts for review (Design Doctrine "proposals over actions"); (c) auto-post selected payments.
- **Effect:** (c) conflicts with Doctrine Corollary A unless review stays.
- **Acceptance:** a due payment on its day produces exactly the chosen artifact, once.

### Q-06 What happens when more is returned than a debt is worth?

- **Current:** the full amount is posted; the debt records only the original (BR-11, S04). A debt without a transaction posts nothing.
- **Options:** (a) refuse above the remainder; (b) post only the remainder; (c) post all and record the surplus as a separate income.
- **Also decide:** where a standalone debt's return should land, if anywhere.

### Q-07 Which day does a record belong to when no day was sent?

- **Current:** the server's UTC day (BR-14, S02).
- **Options:** (a) refuse without a day; (b) use a stored zone for that person; (c) use the request's time zone header.
- **Acceptance:** S02 table, all dated 1 Nov.

### Q-08 In whose time zone do daily nudges fire?

- **Current:** the preference row's zone, default UTC, never written by the app (BR-14); the screen says "local timezone".
- **Options:** (a) save the device zone with preferences; (b) a per-person home zone; (c) follow the phone's current zone while travelling.

### Q-09 Do recurring reminders keep their local time across daylight saving; what happens to missed ones?

- **Current:** pushes keep the UTC instant after firing (one hour off screens after a change); one-time alerts older than 12 h and recurring alerts older than 1 h are dropped silently (BR-18, S09, S10).
- **Options:** for DST, (a) keep local wall-clock time like the screens; (b) keep the instant everywhere. For missed alerts, (a) send late with a "missed" label; (b) one summary; (c) drop but record.
- **Also decide:** what evidence shows the scheduler is running (Design Doctrine "how do I know it ran").

### Q-10 Is deleting a schedule item always recoverable?

- **Current:** depends on the screen and the network (BR-20).
- **Options:** (a) always Recycle Bin; (b) always permanent with Undo; (c) per screen, documented.

### Q-11 What should a household trip do to routines, and what does returning undo?

- **Current:** nothing (feature off); the disabled version skips one chore occurrence and reactivates every alert on return (BR-22, S08).
- **Decide:** whether chores pause for the whole trip; whether solo trips hand items to the partner; what is restored on return (only what the trip changed); whether meal plans are skipped.

### Q-12 Keep, build or remove the prerequisite types that never fire?

- **Current:** "time window" and "schedule" are offered but never pass; "item completed" is never triggered (BR-23).
- **Options:** (a) hide them; (b) build "item completed" only; (c) build all. The Schedule Master Book parks time window under DEC-10.

### Q-13 What happens to offline changes after a long time without signal?

- **Current:** deleted after 24 h; shopping ticks not queued (BR-30, S11).
- **Options:** (a) keep and send any age; (b) hold for review after N hours; (c) today's behaviour, with a visible warning. Also: which actions must work offline (ticks, notification actions).

### Q-14 Are the AI limits the intended household budget?

- **Current:** 15 automatic hand-offs a day each, 5 model calls a minute each, 10 a minute in total, 1,000,000 tokens a month (BR-32); limits are enforced by counting `ai_messages`, not by a reserved budget (AI Assistant Overview).
- **Decide:** the monthly money ceiling, what ERA says when it is reached, and whether manual "Ask AI" taps share the automatic cap.

### Q-15 Do medication doses follow home time or the traveller?

- **Current:** home zone stored at creation for the checklist; pushes follow UTC (S09).
- **Options:** (a) home zone always; (b) traveller's current zone; (c) ask when the zone changes.

### Q-16 Is an occurrence identified by when it was planned or when it was done?

- **Current:** planned in Schedule, actual in Chores (BR-19).
- **Recommendation already made** in [08-shared-data CROSS-MODULE-CONTRACTS §2.2](../08-shared-data/CROSS-MODULE-CONTRACTS.md#22-recurrence-and-occurrence-identity): planned, with the actual time stored separately. Needs the owner's yes.

### Q-17 Who is told when something is handed to the partner or a link is stale?

- **Current:** only due-time pushes to the responsible person, or to everyone on any active link (BR-17).
- **Decide:** hand-over notifications; behaviour when an old invite row is still active.

## Acceptance gaps that only the owner can close

1. A device walkthrough of S09 across a real daylight-saving change (next: 28 Mar 2027 in Beirut).
2. Evidence that the cron scheduler runs (S10).
3. A refreshed `migrations/db-state.json`, without which none of the visibility rules (Q-02) can be confirmed against RLS.
4. Owner acceptance of each decided rule, recorded in the owning Master Book, since current acceptance records cover features, not rules.
