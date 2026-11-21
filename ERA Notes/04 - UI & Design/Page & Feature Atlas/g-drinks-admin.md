---
slug: g-drinks-admin
title: G Drinks Admin
category: standalone-page
route: /g/drinks-admin
type: page
parent: null
children: []
status: active
tags: []
---

# G Drinks Admin

> Host-only list of every guest's drink order and allergies for the host's portal; signed-out visitors see a Sign in link, other accounts see "No access".

## Files

- **Page**: `src/app/g/drinks-admin/page.tsx`
- **Main component**: _(self-contained in page file)_
- **Sub-components**: TODO

## Hooks

- TODO

## API routes

- `GET /api/guest-portal/admin/orders` (auth required; polled every 10 s)

## DB tables

- `guest_portal_tags`, `guest_drinks`, `guest_allergies`

## How to get here

- TODO (which button/icon/deep-link navigates here)
- Direct URL: `/g/drinks-admin`

## What it links to

- TODO

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Guest Portal/Overview.md`

## Screenshots

- `g-drinks-admin-mobile.png`
- `g-drinks-admin-desktop.png`

## Notes

- TODO
