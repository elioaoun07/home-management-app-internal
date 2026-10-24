# Transfers

**Type:** Standalone
**Vault doc:** `ERA Notes/02 - Standalone Modules/Transfers/`

## What it does

Move money between two of your own accounts. One transfer writes one row in `transfers` and updates both account balances atomically (server-side).

## Files at a glance

- **Component**: `src/components/expense/TransferDialog.tsx`
- **Incoming-transfer sheet**: `src/components/expense/IncomingTransferSheet.tsx` (mounted in `DeferredComponents.tsx`; polls 60s, partner household transfers <48h; Acknowledge (no Cancel; outside-tap/Esc also acknowledges) POSTs `src/app/api/transfers/acknowledgements/route.ts` → table `transfer_acknowledgements`, synced across devices; localStorage `ack-incoming-transfers` is the instant/offline fallback; migration `2026-10-24_transfer-acknowledgements.sql`)
- **Hooks**: `src/features/transfers/hooks.ts`
- **API routes**: `src/app/api/transfers/`
- **DB tables**: `transfers`, mutates `account_balances` for both legs

## Common edit scenarios

- **"Edit transfer dialog"** → `TransferDialog.tsx`.
- **"Change how the two balances update"** → `src/app/api/transfers/route.ts` (atomic update logic).

## Gotchas

- Both legs must update atomically. If the API isn't already doing it in one Supabase RPC, ask whether to add one.

## Connected modules

- **Accounts & Balance** — both sides debited/credited.
- **Activity** — transfers appear in the activity feed via `src/components/activity/TransferListView.tsx`.
