---
created: 2026-07-24
updated: 2026-07-30
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
