---
created: 2026-11-11
updated: 2026-11-11
type: archive
status: superseded
owner: Elio
---

# Outfits — shipped work

> Written by `pnpm pm:ship`. Full receipts and acceptance criteria of completed Outfits items, plus Master Book state-log entries older than the newest 3. The [Master Book](<../../Outfits/Outfits — Master Book.md>) keeps one dated line per item in its Shipped Log. Nothing under `_Archive/` is read by a PM tool.

## Shipped items

### OUT-1

- ✅ 2026-07-18 — **OUT-1** `outfits` standalone module scaffolded across all six index surfaces via `scripts/new-module.mjs` [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-2

- ✅ 2026-07-18 — **OUT-2** Migration A: `wardrobe_items` + `wardrobe_profiles` with flat `user_id = auth.uid()` RLS, paired `schema.sql` [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-3

- ✅ 2026-07-18 — **OUT-3** `wardrobeImage.ts` — a WebP/alpha-preserving compressor (the JPEG receipt compressor flattens alpha and must never be reused here) [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-4

- ✅ 2026-07-18 — **OUT-4** `backgroundRemoval.ts` — lazily-imported `@imgly/background-removal`, webp-alpha output re-compressed to 800 px [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-5

- ✅ 2026-07-18 — **OUT-5** garment + profile CRUD routes, image upload (2 MB cap, private `wardrobe` bucket, paths-in-DB, rollback) and a batch signed-URLs endpoint (≤100 paths, owner-only) [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-6

- ✅ 2026-07-18 — **OUT-6** wardrobe UI: feature dir (queryKeys/hooks/`useSignedUrls` with 50-min cache), `WardrobeGrid` + filters, 3-step `AddGarmentSheet`, `GarmentDetailSheet`, `SizingProfileSheet` [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-9

- ✅ 2026-07-18 — **OUT-9** Migration B: `outfits` + `outfit_items` junction (denormalized `user_id`, `UNIQUE(outfit_id, slot)`), paired `schema.sql` [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-10

- ✅ 2026-07-18 — **OUT-10** outfits CRUD with `outfit_items(*)` embed + `OutfitBuilder` (stacked `SlotSwiper` rows, overlays) + `SaveOutfitSheet` + `OutfitsGallery` [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-11

- ✅ 2026-07-18 — **OUT-11** garment archive/delete shows a "used in N outfits" warning via the junction reverse lookup [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#outfits--photograph-a-garment-and-save-an-outfit>); historical result unchanged.

### OUT-18

- ✅ 2026-07-19 — **OUT-18** standalone installable PWA: own manifest (`/manifests/outfits.webmanifest`, id `/outfits-app`, scope `/outfits`), generated icons, layout metadata, wired into `scripts/generate-icons.cjs`. The same pass added Healthcare + ERA manifests/icons/layouts. *(These three plus PM cannot install on-device until the root `manifest.json` `scope: "/"` collision is resolved.)*

## State log
