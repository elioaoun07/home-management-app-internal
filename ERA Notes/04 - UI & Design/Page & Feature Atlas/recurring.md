---
slug: recurring
title: Recurring
category: main-tab
route: /recurring
type: page
parent: null
children: []
status: active
tags: []
---

# Recurring

> TODO: one-sentence description.

## Files

- **Page**: `src/app/recurring/page.tsx`
- **Main component**: _(self-contained in page file)_
- **Sub-components**: TODO

## Tabs

- **Recurring** — active recurring payments split into Cash/Manual and Auto/Online sections, plus Disabled list
- **Future** — one-off scheduled payments (due now / upcoming)
- **Drafts** — saved draft transactions pending confirmation; confirm via log-transaction drawer or delete

## Hooks

- `src/features/accounts/hooks`
- `src/features/categories/useCategoriesQuery`
- `src/features/preferences/useLbpSettings`
- `src/features/recurring/useFuturePayments`
- `src/features/recurring/useRecurringPayments`
- `src/features/drafts/useDrafts` (Draft tab)

## API routes

- `/api/transactions/${transactionId}`

## DB tables

- TODO

## How to get here

- TODO (which button/icon/deep-link navigates here)
- Direct URL: `/recurring`

## What it links to

- TODO

## Related vault doc

- TODO (link to `ERA Notes/02 - Standalone Modules/...` or `03 - Junction Modules/...`)

## Screenshots

- `recurring-mobile.png`
- `recurring-desktop.png`

## Notes

- TODO
