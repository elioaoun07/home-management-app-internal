# Transfers

**Type:** Standalone
**Vault doc:** `ERA Notes/02 - Standalone Modules/Transfers/`

## What it does

Move money between two of your own accounts. One transfer writes one row in `transfers` and moves both account balances server-side (race-safe per account; not yet one DB transaction — BUD-63).

## Files at a glance

- **Component**: `src/components/expense/TransferDialog.tsx`
- **Incoming-transfer sheet**: `src/components/expense/IncomingTransferSheet.tsx` (mounted in `DeferredComponents.tsx`; polls 60s, partner household transfers <48h; Acknowledge (no Cancel; outside-tap/Esc also acknowledges) POSTs `src/app/api/transfers/acknowledgements/route.ts` → table `transfer_acknowledgements`, synced across devices; localStorage `ack-incoming-transfers` is the instant/offline fallback; migration `2026-10-24_transfer-acknowledgements.sql`)
- **Hooks**: `src/features/transfers/hooks.ts`
- **API routes**: `src/app/api/transfers/`
- **DB tables**: `transfers`, mutates `account_balances` for both legs

## Common edit scenarios

- **"Edit transfer dialog"** → `TransferDialog.tsx`.
- **"Change how the two balances update"** → `src/app/api/transfers/route.ts` (legs) and `src/lib/balance.ts` (`adjustAccountBalance`, compare-and-swap).
- **"Transfer appeared twice" / "slow transfer"** → client id + same-id retry in `hooks.ts` (`sendTransferWrite`), replay branch in `route.ts` (`replayTransfer`).

## Gotchas

- Every create carries a client id (idempotency key) — never send a transfer POST without one from new UI code; a timeout retry would duplicate it (BUD-87, 2026-10-28 incident).
- Both legs should update in one DB transaction; they don't yet. The atomic RPC is BUD-63 — ask before adding a parallel one.
- Regression tests: `src/app/api/transfers/route.test.ts`, `src/features/transfers/hooks.test.ts`, `src/lib/balance.test.ts`.

## Connected modules

- **Accounts & Balance** — both sides debited/credited.
- **Activity** — transfers appear in the activity feed via `src/components/activity/TransferListView.tsx`.
