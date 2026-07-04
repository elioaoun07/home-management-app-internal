Done. I built a 7-playbook skill suite in .claude/skills/, registered it in CLAUDE.md, and synced it to the agent mirrors (AGENTS.md, CODEX.md, .github/copilot-instructions.md) — so Claude Code, Codex, and Copilot all discover them.

The suite

┌───────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────┐
│ Skill │ Covers │ Invoke │
├───────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤
│ start-task │ Entry point for any task: restate goal → classify → read docs in the mandated order → verify every assumption with a tool call before editing │ /start-task │
├───────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤
│ fix-bug │ Evidence-first debugging: no edits until root cause is proven with path:line, plus a known-cause table of this app's 12 recurring bug signatures │ /fix-bug │
│ │ (stale cache, false-offline, household visibility, 23505→500, DST shifts, RLS slowdowns…) │ │
├───────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤
│ add-feature │ Feature in an existing module, built in strict slice order: DB → API → types → hooks → UI → wiring, each layer copied from a named canonical file │ /add-feature │
├───────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤
│ api-route │ Full route template verified against accounts/route.ts + the cron variant from purge-recycle-bin/route.ts: client selection, auth gate, Zod, │ /api-route │
│ │ household linking, status-code contract │ │
├───────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤
│ db-migration │ Migration-file-first workflow, schema.sql end state, an RLS decision tree (never EXISTS-subqueries on hot child tables), and the enum-cascade │ /db-migration │
│ │ checklist │ │
├───────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤
│ ui-guardrails │ Theming, person-absolute color identity, opaque floating panels, header offsets, decimal inputs, Undo toasts, mobile-first verification steps │ /ui-guardrails │
├───────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤
│ finish-task │ Definition of done: 9 self-review grep patterns for hard-rule violations, typecheck/lint/test gates, docs/Atlas, the exact PM Command Center │ /finish-task │
│ │ procedure, and an honest-report template │ │
└───────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────┘

What makes these work for lower-tier models

- Contract header on every skill — "follow steps in order, don't skip gates, a correct 'I'm blocked' beats a plausible guess."
- Evidence over assumption — start-task includes an assumption ledger: every claim about the codebase needs a file read this session; docs vs. code conflicts resolve to code.
- Copy, don't compose — every template is quoted from real files I read (trips/hooks.ts toast pattern, accounts route, cron route), not written from memory.
- Explicit STOP conditions — destructive migrations, ambiguous scope, RLS surprises → ask instead of guessing.
- Cross-routing — skills reference each other and your existing ones (cache-invalidation, timezone-handling, new-module), so a weak model always knows the next playbook. Every path ends at finish-task, which pairs with your existing enforcement hooks.

Drift I found while grounding the skills (not changed — your call)

1. CLAUDE.md Hard Rule 6 says safeFetch's default timeout is 3 s, but the code is now 8 s (DEFAULT_TIMEOUT_MS = 8_000 in src/lib/safeFetch.ts:17, with a comment explaining why 3 s was too aggressive). The skills point to the constant rather than hardcoding a value, but the CLAUDE.md text is stale.
2. safeFetch.ts itself contains [OFFLINE]-prefixed console.log calls, which technically violate Hard Rule 22 — pre-existing; the finish-task skill tells agents not to add new ones.

Verified: pnpm docs:check green, pnpm sync:ai synced all three mirrors, all 10 skills listed correctly. Per Hard Rule 25: this session touched only .claude/skills/ and CLAUDE.md — pure tooling, no PM-trackable story.
