---
slug: feature-transfers
title: Feature - Transfers
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
---

# Feature - Transfers

> Standalone feature module. Hosts hooks/types/utilities. Not directly routable.

## Files

- **Module dir**: `src/features/transfers/`

## Hooks

- `src/features/transfers/hooks.ts`
  - `useTransfers()`
  - `useCreateTransfer()`
  - `useUpdateTransfer()`
  - `useDeleteTransfer()`

## API routes

- `GET /api/transfers`
- `POST /api/transfers`
- `PATCH /api/transfers/[id]`
- `DELETE /api/transfers/[id]`

## DB tables

- `transfers`
- `accounts`
- `account_balances`

## How to get here

- Expense balance card transfer button.
- Direct wallet refill shortcut: `/expense?transfer=salary-wallet`.

## What it links to

- `/expense`
- `src/components/expense/TransferDialog.tsx`
- `src/components/expense/NfcWalletTransferPrompt.tsx`

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Transfers/`

## Screenshots

- n/a

## Notes

- 2026-06-25: Salary -> Wallet shortcut resolves account names for the current
  signed-in user and reuses `useCreateTransfer()`; the URL does not contain
  account UUIDs.
