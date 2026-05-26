# Guest Portal

**Type:** Standalone
**Route:** `/g/[tag]`, `/g/drinks-admin`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Guest Portal/`

## What it does

A public surface (no login) at `/g/[tag]` that a guest tap-opens (often via NFC). It renders a tag-specific page — e.g. drinks ordering, the deception-box scene — and is the only place where unauthenticated routes are allowed in this app.

## Files at a glance

- **Page entries**:
  - `src/app/g/[tag]/`
  - `src/app/g/drinks-admin/`
- **Components**:
  - `src/components/guest/DeceptionBoxScene.tsx`
  - `src/components/layouts/GuestHeader.tsx`
- **API routes**: under `src/app/api/guest-portal/`
- **DB tables**: tag-specific (check `schema.sql`)

## Common edit scenarios

- **"Add a new guest page for a slug"** → create a new folder under `src/app/g/[tag]/` (or extend the dynamic route handler) and a matching component in `src/components/guest/`.

## Gotchas

- **Slug URLs are a Hard Rule for this module** (see vault doc): the slug is the public ID and must be unguessable.
- The fixed/sticky-header rule (Hard Rule #16) applies — the root layout's `ConditionalHeader` must hide on `/g/*`.
- No auth — never assume a user context.

## Connected modules

- **NFC Tags** — a tap-redirect target.
- **Layout & nav** ([../cross-cutting/layout-and-nav.md](../cross-cutting/layout-and-nav.md)) — `ConditionalHeader` / `MobileNav` skip this route.
