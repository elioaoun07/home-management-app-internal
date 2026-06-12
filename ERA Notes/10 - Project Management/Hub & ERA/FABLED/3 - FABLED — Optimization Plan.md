---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/hub-era
---

# Hub & ERA · FABLED 3 — Optimization Plan

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Hardening/perf/code-health moves for what already works. The module's own rule applies: don't decompose "just because" — pair structural work with a feature so the refactor buys something.

---

## O1 — Test the intent system first (highest value-per-hour in the app)

The face architecture makes this *cheap*:

1. **Routing table tests:** a fixture list of ~40 real utterances → expected `(face, intent)` through `resolveIntent.ts`. Every future intent addition extends the fixture. This single file kills the "confidently wrong" failure mode at its root.
2. **Resolver tests:** resolvers are data-fetch + shape; mock the query layer, pin the shapes.
3. **Formatter snapshots:** formatters are pure → snapshot tests are nearly free and catch reply regressions.
4. **Fail-safe behavior:** add + test a confidence threshold in `resolveIntent.ts` — below it, ERA asks a clarifying question instead of acting. *(This is the action-plan "Now" item made concrete.)*

## O2 — Decompose `HubPage.tsx` along its existing seams (with the briefing feature)

202 KB. The seams are already visible in how it's *used* (alerts page mounts it view-restricted):

1. **Extract per-view components first** — MessagesView, AlertsFeedView, ShoppingModeShell (ShoppingListView/NotesListView are already separate; the *switching shell* isn't).
2. **Extract the ERA invocation layer** — the conversation-engine callbacks (`conversationEngine.ts` documents that its native-action callbacks are "implemented in HubPage") into a `useEraActions` hook. This is the piece in-chat briefings (file 4 · E1) will extend — do it *as* that feature's substrate.
3. **Leave thread-state plumbing for last** — highest coupling, lowest payoff.

Rule of thumb: no extraction without either a test or a feature riding on it.

## O3 — Split the two mega-routes when next touched

- `api/hub/messages/route.ts` (42 KB): factor side-effects (notifications, link maintenance, system messages) into `src/lib/hub/` functions; the route keeps auth + zod + dispatch.
- `api/ai-chat/route.ts` (30 KB): extract **context assembly** (the transactions/items/household injection) into a `src/lib/ai/context.ts` with its own unit tests — this is also what proactive briefings (file 4) need to reuse, so it pays twice.

## O4 — Voice resilience pass

1. **Degradation states:** token-mint failure, SDK load failure, worklet load failure, mid-stream STT drop → each gets a defined UI state (orb state + text fallback) instead of silence. Test with the network tab offline-throttled.
2. **Delete dead code:** `sttCapture.ts`, `vadGate.ts` (zero importers).
3. **Write the runbook:** env vars, token route, worklet file, AudioContext unlock, wake-model upgrade path → into the Hub Chat vault doc (`Voice Conversation.md`), reconciled with the May overhaul (the memory file is currently more accurate than the vault).

## O5 — Widget freshness audit (30 min)

For each `use*Summary` widget: what query key, what TTL, what invalidates it. Anything quoting money or today's schedule should ride the short caches (`BALANCE=5min`, `TRANSACTIONS=2min`), not the hour caches. Document the answer in the AI Assistant vault doc.

## O6 — Resolve the dual conversation stores

Decide: `api/era/*` vs `api/ai-chat/conversations` — one is canonical, the other is a shim or gets merged. Document in the vault doc either way. (Investigation first; likely an afternoon.)

---

### Sequencing

```
O1.1 routing fixtures (start here — same week as any ERA touch)
  → O1.4 confidence fail-safe → O4.1 degradation states
  → O2.2 ERA-actions extraction (as substrate for in-chat briefings)
  → O3.2 context assembly extraction (as substrate for proactive briefings)
O4.2/O4.3 (deletion + runbook) any idle 30 min · O5 quick audit · O6 when convenient
```
