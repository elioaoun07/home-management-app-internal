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

> **FREEZE (owner decision, 2026-08-06).** No new Delivery architecture work unless a real product session demonstrated the need for it. The queue below is deliberately short: it is only what must be true *before* the first genuine product run, plus the run itself. Everything else from the 2026-08-06 plan — `HANDOFF_READY` and the six-outcome split, the UI/Playwright validation rung, forecast auto-calibration with confidence bands, Codex pricing, lane collapse, the item→session index, parallelism — is **parked until after two real completions**, because each would otherwise be designed against no evidence. The prompt for all of it is in the Master Book's Vision & Decisions.
>
> **Context:** 14 sessions, 36 preflights, $11.14 spent, **1 completion** — and that completion was DLV-28, a markdown line in Delivery's own campaign index. Every item ever launched was `[TEST]`-prefixed or Delivery editing its own paperwork; **no product code has ever shipped through the pipeline.** Meanwhile the CLI shipped 46 commits over the same window, and Delivery machinery was 45,438 of the 79,979 lines added. The pipeline has never been tested on work worth governing — that, not any single bug, is what the queue below exists to fix.

**Session cost architecture** — DLV-85 shipped 2026-08-06 (swept to the Master Book). It changed the true cache ratio, which invalidates the forecast that was already wrong.

- [ ] **DLV-86** Re-derive `PHASE_BASELINE_TOKENS` in `recommendation.mjs` from measured post-DLV-85 sessions instead of the current `{cacheCreation: 10_000, cachedRead: 350_000}` guess — a **35 : 1** read/write ratio against a measured **1 : 1.5**, on the term that is 77–87% of a real bill. Until this lands every budget envelope is a guess against a model known to be false and the budget gate keeps firing spuriously — the repo's own "a guard that always fires teaches you to wave it through" doctrine, violated by its own forecaster. Include an effort term: raising effort `low`→`max` changes real spend several-fold and moves the forecast by exactly zero _(blocker - M)_
- [ ] **DLV-87** No unpriced or unknown cost may silently disable a cap: `costUsd: null`/`NaN`/absent must never compare its way past an envelope (the `NaN > cap` class from DLV-43, via a different door), and a provider with no pricing table must **refuse to launch** rather than run uncapped. Note the consequence and accept it: `config.json` has `codex: {models: []}` and Codex never reports cost, so Codex becomes unlaunchable until someone prices it — that is the correct outcome, not a regression _(blocker - S)_
- [ ] **DLV-88** Distinguish the three things currently conflated as one number: **actual API cost**, **estimated API-equivalent cost**, and **subscription usage**. The driver carries no `ANTHROPIC_API_KEY` and inherits Claude Code's own auth, so if that is a subscription then every dollar in the ledger is notional and the genuinely scarce resource is the rate-limit window — which is what "limit hitting" has been all along. Confirm which auth is in use, then label the ledger honestly and add a token-window/cache-creation/turn-count limit alongside the dollar cap _(blocker - M)_

**Governance calibration for the first real run** — deletion, not construction. 36 preflights produced 14 launches; the flight check is stopping the owner from starting, not stopping the agent from misbehaving.

- [ ] **DLV-89** Temporarily reduce launch ceremony to **one** confirmation and **one** final acceptance for the next real test: gates whose forecasts aren't yet trustworthy warn instead of blocking, typed acknowledgments come out, and a dirty tree becomes a warning plus an automatic snapshot rather than a refusal. Pause only for a genuine blocker or a decision that actually needs the owner. Time-boxed to the DLV-91 experiment and recorded as an amendment — the "always three gates" non-negotiable is **not** being repealed, its *interaction cost* is being measured _(friction - M)_
- [ ] **DLV-90** Treat `No test files found, exiting with code 0` as **NOT_TESTED**, never as PASSED. vitest exits 0 when a filter matches nothing, so "no test covers this file" is currently indistinguishable from "the tests pass" — and INSTANT's safety argument leans on "validation passed first time" _(friction - S)_
- [ ] **DLV-91** Safe session-lock handling: store lock ownership plus a heartbeat, expire abandoned leases, check whether the owning process still exists, and allow an audited manual force-release. `s-20260725-181118-xdl9` sat ACCEPTED-not-shipped for 4 days holding the global build lock; a crashed first real run must not block Delivery for days _(friction - M)_

**The experiment this queue exists for** — do not start it until DLV-86…DLV-88 are in.

- [ ] **DLV-92** Run **one genuine medium product item** end to end: 3–8 files, clear acceptance criteria, ~1–3 hours by hand, **not** payments/auth/security/migrations/RLS, **not** visual (so the missing UI rung doesn't block it), **not** `[TEST]`, and **not** Delivery modifying Delivery. Define success in writing *before* launching. Run it mainly away from the keyboard, but **semi-attended on this first one** — glance every ~20 min, because a silent 3-hour failure would cost the only real data point there is; run #2 goes truly unattended. Record: estimated manual CLI time · actual elapsed · owner attention time · unattended execution time · useful files changed · validation confidence · would-you-use-Delivery-again. Classify the outcome as **delivered independently / delivered with supervision / useful handoff / no value**, with *unattended useful work* as the primary metric. The record is a markdown template filled in by hand — not a subsystem _(blocker - M)_
- [ ] **DLV-93** After DLV-92, allow at most **one** reliability fix, **one** workflow simplification and **one** validation fix, then run a **second** genuine product item before any further architecture work. Only after two real completions do the parked items above become eligible, and parallelism stays gated until sessions reliably start, stop, release locks, preserve context and write finish packages _(friction - S)_

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

- [ ] **DLV-52** Empty the lint debt ledger — burn `eslint.config.mjs`'s two grandfathered file lists down to nothing, deleting each path as its file is fixed (the list may only shrink; adding to it is a regression). **No longer blocks the baseline** — DLV-83 made `pnpm lint` exit 0 and repaired the 48 mechanical sites, so this is now real type work on its own schedule rather than a tax on every session. Remaining: `no-explicit-any` 538 across 126 files (203 callback params, 197 miscellaneous `as any`, 66 typed declarations, 25 `any[]`, 20 `Record<string, any>`) — each needs the correct type from its own call site, and the highest-value targets are the money paths (`transaction.service.ts`, `useDashboardTransactions.ts`, `MobileExpenseForm.tsx`), which fall under `money-rules`. Do it module by module, not as one sweep _(friction - L)_
- [ ] **DLV-84** Burn down `react-hooks/exhaustive-deps` (50 across 25 files) — deliberately excluded from DLV-83 because each fix **changes runtime behaviour**: these sit in `SyncContext`, `HubPage` and `MobileExpenseForm`, where a wrong dependency is an infinite render loop in the offline sync engine or a money form. Needs per-site judgment plus real in-app verification on mobile, one file at a time, never a batch — a green typecheck proves nothing here _(friction - L)_
- [ ] **DLV-71** Conversation search and highlighting in the desktop session detail — deferred from the design debates as polish-tier, unblocked now that the dependability path has shipped _(parked - M)_

## Definition of Done

- **D1** A fake-driver test exists for every governance behaviour (the failure-scenario suite green on `pnpm test`).
- **D2** No owner non-negotiable violated: no git writes, no `bypassPermissions`, 3 gates in every lane, `agent-registry.mjs` the single source of truth.
- **D3** A real session (S-item, FAST lane) runs launch → ACCEPTED with the budget envelope visible, the AC matrix green, a finish package written and the PM trace auto-appended.
- **D4** The next runaway-overrun class is impossible by construction: cap-hit pauses gracefully, scope mismatch trips decomposition, spend-limit errors never retry.
- **D5** From the phone alone, the owner can see what a running session is asking, answer it, and read the conversation, artifacts and cost that led there.
