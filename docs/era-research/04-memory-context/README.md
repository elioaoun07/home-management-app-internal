---
created: 2026-11-04
updated: 2026-11-04
type: index
status: draft
owner: Elio
evidence_cutoff: "commit 22152c2 (2026-11-04 22:38 +0200)"
---

# ERA Memory & Context (04)

How ERA remembers, personalises and assembles model context today, and a design for doing it with provenance, expiry, correction and forgetting, inside ERA's existing decisions (no fourth store, no new memory engine, no vector database). Read from source, `migrations/schema.sql`, `migrations/db-state.json` and vault docs at commit `22152c2`. No code, schema, migration, data, PM file or instruction was changed.

## Files

| File | Use it to |
|---|---|
| [CURRENT-CONTEXT-MAP.md](CURRENT-CONTEXT-MAP.md) | See every place ERA's context comes from today: the Ask AI packet step by step, face contexts, focus memory, lexicon, Brain notes, settings, copies of personal content, the prompt-injection surface, and the gaps G1–G11. |
| [MEMORY-DESIGN.md](MEMORY-DESIGN.md) | Read the binding constraints, the seven kinds of information and where each belongs, the memory record and confidence ladder, the retrieval comparison with external sources, three designs (A recommended), the cross-cutting components K1–K5, the staged adoption and the owner decisions OD-1–OD-11. |
| [CONTEXT-ASSEMBLY.md](CONTEXT-ASSEMBLY.md) | Follow the proposed assembly pipeline and five worked requests (Schedule, Budget, Kitchen/Healthcare, Brain forget, Trips/Recurring) covering changed preferences, contradictions, stale data, unavailable access, forgetting and injected instructions, with checks CA-1–CA-20. |
| [CORRECTION-AND-EXPIRY-RULES.md](CORRECTION-AND-EXPIRY-RULES.md) | Look up rules CE-1–CE-26 (precedence, dates and zones, expiry, staleness, correction, forget, duplicates, interruptions, household scope) and acceptance scenarios AS-1–AS-16. |

**Reading order.** Map → Design → Rules → Assembly. To review a single decision, start at MEMORY-DESIGN §11.

## Labels

CURRENT IMPLEMENTATION (read in code), DOCUMENTED INTENT (stated in docs), PROPOSED DESIGN (this folder), UNKNOWN (needs the live database, a device, usage data or the owner). ⛁ marks objects created by migrations newer than the 2026-08-04 RLS snapshot, whose application is unknown. All scenario people, records, amounts and dates are fictional.

## Related

- [01-atlas](../01-atlas/README.md) (findings "F-…"), [08-shared-data](../08-shared-data/README.md) (time zones, billing periods, sources of truth), [19-business-rules](../19-business-rules/README.md).
- Vault: `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md` (HUB-106 adaptive context, HUB-108 review), `ERA Learns Your World — Proposal.md`, `ERA Notes/10 - Project Management/Plans/ERA Top Layer.md` (D4, D17, §5, §6).
- PM items this work informs, not changes: HUB-41, HUB-44, HUB-45, HUB-47, HUB-64, HUB-69, HUB-70, HUB-71, HUB-40/D17.

## Limits

- External sources were located through web search on 2026-11-04; direct reads of `www.postgresql.org`, `supabase.com` and `genai.owasp.org` failed because those hosts are outside this session's allowed network domains. Claims from them are marked as search summaries (MEMORY-DESIGN §6).
- `migrations/db-state.json` is 92 days old, so RLS and table-existence claims for `era_lexicon`, `household_memories` and other ⛁ objects are UNKNOWN.
- Nothing was executed: no tests, typecheck, app, model or database. Usage, habits, languages and real data volume are not inferred.
