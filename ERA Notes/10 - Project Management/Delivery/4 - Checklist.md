---
created: 2026-07-24
updated: 2026-08-01
type: checklist
status: active
owner: Elio
tags: [pm/checklist, tooling/delivery]
---

# Delivery — Checklist

> **Campaign:** [Delivery — Master Book](<Delivery — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> Grammar per [_Conventions](<../_Conventions.md>) (prefix `DLV`; `DW` retired, IDs never reused). Shipped items live in the Master Book's Shipped Log — M1–M4 are complete apart from the remnants below. Design debates, cost anatomy and the session postmortems are in the Master Book and `../_Archive/`.

---

## Now

**Mobile session drill-down** — shipped 2026-07-30 (DLV-63…DLV-67, swept to the Master Book). One verification is left, and it needs a real gated session.

- [ ] **DLV-72** Live-verify the session drill-down end to end: a question-gated session shows its text on the phone, an advisory ledger answer lands in `ledger.json`, the four panes swipe, a gate push opens that session directly, and the published `session:<id>` row stays under the size cap for a long session _(friction - S)_

**INSTANT lane** — shipped 2026-08-01 (DLV-73…DLV-76, swept to the Master Book). Two things are left, and both need the owner.

> **DLV-78 was attempted 2026-08-01 and failed** (`s-20260801-094951-jx8o`): the edit landed correctly, but INSTANT verified the whole dirty working tree instead of its own diff, escalated, and blew the budget. Fixed as DLV-80/81/82 — see the Master Book. **DLV-78 still needs a clean live re-run**, and it is now also the natural place to exercise the two 🟡 items the failure exposed (REVIEWING's 8-turn ceiling; the targeted-test rung passing on zero test files).

- [ ] **DLV-77** Run `migrations/2026-08-01_pm-commands-instant-gates.sql` in the Supabase SQL Editor, then verify `pg_get_constraintdef` lists `approve` and `accept`. Until this lands, the phone's INSTANT gate buttons fail at the DB CHECK — every other surface works _(blocker - S)_
- [ ] **DLV-78** Live-verify INSTANT on the real BUD-14 item against a scratch branch: Flight-Check offers INSTANT and shows the located file **before** launch; `state.usage.total` at `UAT_READY` is ≤ $0.20 with `turnCounter === 2`; `events.ndjson` has `instant.verified` and no REVIEWING/UAT_PREP turn record; all three gate decisions exist from two owner actions; then repeat with the path stripped from the item text, and with an item that secretly touches two files to confirm `instant.escalated` fires _(friction - S)_
- [ ] **DLV-79** Re-tune INSTANT's envelope from measurement once three sessions complete — `$0.25 / 250K / 8 internal turns` is a launch-time estimate, and `estPhaseUsage` switches to measured medians at three samples _(annoyance - S)_


## Next

**Remnants of partially-shipped items** — each was deliberately scoped down at the time; these are the parts explicitly left open.

- [ ] **DLV-68** (rest of DLV-17) Write a transcript stub the instant a turn id is allocated, and add a runner-heartbeat watchdog for stalled sessions — gap *detection* at session end already ships _(friction - M)_
- [ ] **DLV-69** (rest of DLV-30) Seed a rotated session with the rendered context digest from `buildContextPackage`, so a fresh provider session inherits a summary of prior exploration rather than relying on artifact-by-path alone _(friction - M)_
- [ ] **DLV-70** (rest of DLV-40) Surface the raw-SDK transcript pointer in the desktop session detail — the `state.driver.rawTranscript` field with its hash and existence check is written but rendered nowhere _(annoyance - S)_

## Later

- [ ] **DLV-52** Repo lint baseline back to zero — `no-explicit-any` (586, spread over ~200 files: 203 callback params, 197 miscellaneous `as any`, 66 typed declarations, 35 `catch (e: any)`, 25 `any[]`, 20 `Record<string, any>`, 13 error-property casts) and `react-hooks/exhaustive-deps` (50). Each `any` needs the correct type from its own call site; the deps sit in `SyncContext`, `HubPage` and `MobileExpenseForm`, where a wrong dependency produces an infinite render loop in the offline sync engine or a money form. Per-site judgment plus real in-app verification — not one batch → `eslint.config.mjs` _(friction - L)_
- [ ] **DLV-71** Conversation search and highlighting in the desktop session detail — deferred from the design debates as polish-tier, unblocked now that the dependability path has shipped _(parked - M)_

## Definition of Done

- **D1** A fake-driver test exists for every governance behaviour (the failure-scenario suite green on `pnpm test`).
- **D2** No owner non-negotiable violated: no git writes, no `bypassPermissions`, 3 gates in every lane, `agent-registry.mjs` the single source of truth.
- **D3** A real session (S-item, FAST lane) runs launch → ACCEPTED with the budget envelope visible, the AC matrix green, a finish package written and the PM trace auto-appended.
- **D4** The next runaway-overrun class is impossible by construction: cap-hit pauses gracefully, scope mismatch trips decomposition, spend-limit errors never retry.
- **D5** From the phone alone, the owner can see what a running session is asking, answer it, and read the conversation, artifacts and cost that led there.
