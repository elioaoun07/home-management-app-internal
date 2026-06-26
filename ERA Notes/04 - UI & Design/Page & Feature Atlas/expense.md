---
slug: expense
title: Expense
category: main-tab
route: /expense
type: page
parent: null
children: []
status: active
tags: []
---

# Expense

> Mobile-first precision form for entering expenses, checking balances, and
> launching transfer or quick-entry flows.

## Files

- **Page**: `src/app/expense/page.tsx`
- **Main component**: `src/app/expense/ExpenseClientWrapper.tsx`
- **Sub-components**:
  - `src/components/expense/MobileExpenseForm.tsx`
  - `src/components/expense/NfcWalletTransferPrompt.tsx`

## Hooks

- `useMyAccounts()` resolves user-owned accounts for form/account shortcuts.
- `useCreateTransfer()` powers the Salary -> Wallet URL/NFC transfer prompt.

## API routes

- `/api/accounts`
- `/api/transfers`

## DB tables

- `accounts`
- `account_balances`
- `transfers`
- `transactions`

## How to get here

- Direct URL: `/expense`
- Direct wallet refill shortcut: `/expense?transfer=salary-wallet`
- Optional shortcut params: `from`, `to`, `amount`

## What it links to

- Transfer activity/history through the transfers feature.
- Login redirects preserve `/expense` shortcut query params.

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Transactions/`
- `ERA Notes/02 - Standalone Modules/Accounts & Balance/Account Transfers.md`

## Screenshots

- `expense-mobile.png`
- `expense-desktop.png`

## Notes

- `/expense?transfer=salary-wallet` opens the mobile expense form with a small
  Salary -> Wallet transfer prompt. Account IDs are resolved from the signed-in
  user's own account names instead of being encoded in the URL.
