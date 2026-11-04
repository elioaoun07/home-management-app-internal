---
created: 2026-11-04
updated: 2026-11-04
type: index
status: draft
owner: Elio
evidence_cutoff: "commit 0b0588f (application source identical to 22152c2)"
---

# ERA Proactive Assistance (05)

A design for ERA speaking first across the household's modules: twelve situations, four levels (notice, notify, prepare, execute), attention rules for duplicates, staleness, resolution, dismissal, repeats, quiet hours, priorities and changed circumstances, and an evaluation set in which a third of the cases expect silence. Read from source, `migrations/schema.sql` and vault/PM docs. No cron, schedule, notification, automation, schema, data, PM file or instruction was created or changed.

## Files

| File | Use it to |
|---|---|
| [PROACTIVE-ASSISTANCE.md](PROACTIVE-ASSISTANCE.md) | See today's notification and cron machinery and its gaps, the binding decisions, the four levels and their ceilings, surfaces, a suggestion's lifecycle and terminal states, the foundations F-1–F-11, the recommended waves (W1 pull-only first) and owner decisions PD-1–PD-9. |
| [TRIGGER-CATALOGUE.md](TRIGGER-CATALOGUE.md) | Look up the twelve situations P-01–P-12 (money, schedule, fitness, kitchen, health, trips, catalogue), each with trigger, evidence, timing, benefit, controls, silence conditions, completion, a positive example and a do-nothing counterexample; plus ideas deliberately rejected. |
| [ATTENTION-RULES.md](ATTENTION-RULES.md) | Apply the gates and rules AR-1–AR-16 and the per-situation attention parameters (class, window, follow-ups, reconsideration, material change). |
| [EVALUATION-SCENARIOS.md](EVALUATION-SCENARIOS.md) | Test an implementation offline with a pure evaluator, a simulated Beirut clock and a dry-run sink: scenarios EV-01–EV-52 (plus EV-45a/b), pass metrics and fixture rules. |

**Reading order.** Proactive Assistance → Trigger Catalogue → Attention Rules → Evaluation Scenarios.

## Labels

CURRENT IMPLEMENTATION (read in code), DOCUMENTED INTENT (vault/PM), PROPOSED DESIGN (this folder), UNKNOWN (needs the live database, scheduler, devices or owner). ⛁ = depends on a migration newer than the 2026-08-04 RLS snapshot. Scenario data is fictional.

## Related

- [04-memory-context](../04-memory-context/README.md): circumstances, kept preferences, coverage and the `CE-n` correction/expiry rules this folder relies on.
- [19-business-rules](../19-business-rules/README.md): BR-17/BR-18 alert rules and scenario S10 (scheduler outage).
- [01-atlas](../01-atlas/README.md), [08-shared-data](../08-shared-data/README.md) (no stored time zone).
- PM owners: Hub & ERA HUB-23, HUB-38, HUB-39, HUB-41, HUB-42, HUB-43, HUB-54, HUB-56; Notifications NOTIF-19, NOTIF-21, NOTIF-5.6; decisions DEC-01, DEC-03, DEC-04, DEC-17; Top Layer D1, D3, D5/D6, D9, D18.
- Historical baseline: `ERA Notes/10 - Project Management/_Archive/Studies/Proactive ERA/` (frozen 2026-09-06; cited, not reopened).

## Limits

- Whether any cron runs in production, and when, is UNKNOWN (no scheduler in the repo, no liveness ledger).
- No usage or notification-habit data exists in the repo; push thresholds are defaults for the owner to tune, not measurements.
- External sources (MDN, Apple HIG, Android developers) were located by web search on 2026-11-04; their pages were not opened in this session.
- Nothing was executed: no tests, app, cron, push or model.
