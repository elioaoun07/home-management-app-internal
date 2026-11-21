---
created: 2026-03-23
type: overview
module: guest-portal
module-type: standalone
tags:
  - type/overview
  - module/guest-portal
---

# Guest Portal

> **Source:** `src/app/g/[tag]/`, `src/components/guest/`
> **Type:** Standalone

## Docs in This Module

_No dedicated docs yet — add feature documentation here._

## Key Concepts

- Generic reusable slugs (`/g/kitchen-1`), never hardcode purpose-specific URLs
- Behavior stored server-side

## Gotchas

- **Public routes are single-guest only.** `/api/guest-portal/{drinks,allergies}` `GET` answer `?session_id=` and nothing else; the tag id is handed to every guest by the session route, so it must never unlock a bulk read. They ignore `all` (HUB-118, 2026-11-21).
- **The host's all-guests view is `GET /api/guest-portal/admin/orders[?tag_id=]`.** `getUser()` → 401; tag owner or active household partner → 200, anyone else → 403, unknown tag → 404. Rows are read with `supabaseAdmin()` only after that check, because the `guest_*` tables are service-role-only. With no `tag_id` it resolves the caller's own active tags, preferring slug `home`. `/g/drinks-admin` is its only client and links to `/login?redirect=/g/drinks-admin` when signed out.
- **Allergies are health data about people outside the household.** Any new bulk read of `guest_*` follows the same shape (session identity → ownership check → service-role read) and gets a three-role route test (`admin/orders/route.test.ts`).
- **Database layer:** the 2026-08-04 snapshot shows RLS off on `guest_drinks`. `migrations/2026-11-21_guest-drinks-enable-rls.sql` closes it; owner-run, not yet confirmed applied.
