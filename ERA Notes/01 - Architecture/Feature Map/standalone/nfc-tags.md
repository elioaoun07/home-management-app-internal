# NFC Tags

**Type:** Standalone
**Route:** `/nfc`, `/nfc/[tag]`
**Vault doc:** `ERA Notes/02 - Standalone Modules/NFC Tags/`

## What it does

Physical NFC tags around the house that, when tapped, open a slug URL. The tag can be assigned an action (open a screen, prefill an entry, flip an item state) via the admin page.

## Files at a glance

- **Page entries**:
  - `src/app/nfc/page.tsx` (admin landing)
  - `src/app/nfc/nfc-admin-client.tsx`
  - `src/app/nfc/[tag]/` (tap target)
- **Components**:
  - `src/components/nfc/PwaRedirectBanner.tsx`
- **Hooks**: `src/features/nfc/hooks.ts`
- **API routes**: `src/app/api/nfc/`
- **DB tables**: `nfc_tags` (confirm in `schema.sql`)

## Common edit scenarios

- **"Add a new NFC action type"** → DB enum/column → API zod → hook → admin UI (`nfc-admin-client.tsx`) → tap handler in `/nfc/[tag]/`.
- **"Change the PWA redirect prompt"** → `PwaRedirectBanner.tsx`.

## Gotchas

- **Slug URLs are a Hard Rule for this module** — unguessable slugs only.
- Tap-from-browser usually wants the PWA — that's what `PwaRedirectBanner.tsx` exists for.
- If a tag is meant to unlock a dormant item, that's the Prerequisites junction ([../junction/prerequisites.md](../junction/prerequisites.md)).

## Connected modules

- **Prerequisites** — NFC tap can satisfy a prerequisite.
- **Guest Portal** — some tags hand off to `/g/[tag]`.
- **Items & Reminders** — tap can mark an item complete.
