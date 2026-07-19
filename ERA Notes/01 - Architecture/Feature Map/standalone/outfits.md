# Outfits

**Type:** Standalone
**Route:** `/outfits`

## What it does

Wardrobe catalog, paper-doll outfit builder, weekly outfit planner and wear log. Digitize garments (photo → on-device background-removal cutout → tags), compose outfits by swiping garments in body slots, plan the week, never repeat an outfit across events. Personal per user — deliberately NOT household-shared (locked decision D4 in the vault doc).

## Files at a glance

- **Page entry**: `src/app/outfits/page.tsx`
- **Main component**: `src/components/outfits/OutfitsPage.tsx` (segmented control Wardrobe | Outfits)
- **Catalog UI**: `src/components/outfits/WardrobeGrid.tsx`, `AddGarmentSheet.tsx`, `GarmentDetailSheet.tsx`, `SizingProfileSheet.tsx`
- **Builder UI**: `src/components/outfits/OutfitBuilder.tsx`, `SlotSwiper.tsx`, `SaveOutfitSheet.tsx`, `OutfitsGallery.tsx`
- **Hooks**: `src/features/outfits/hooks.ts` · **Signed-URL cache**: `src/features/outfits/useSignedUrls.ts`
- **Query keys**: `src/features/outfits/queryKeys.ts` · **Types**: `src/features/outfits/types.ts`
- **Image pipeline libs**: `src/lib/wardrobeImage.ts` (WebP+alpha compression), `src/lib/backgroundRemoval.ts` (lazy @imgly wrapper)
- **Motion presets**: `src/lib/motion.ts` (shared, app-wide — Outfits is the first consumer)
- **API routes**: `src/app/api/outfits/route.ts` (+ `[id]/`, `items/`, `items/[id]/`, `items/[id]/images/`, `signed-urls/`, `profile/`)
- **DB tables**: `wardrobe_profiles`, `wardrobe_items`, `outfits`, `outfit_items` (Phase 4 adds `outfit_plans`)
- **Storage**: private bucket `wardrobe`, paths `${userId}/${itemId}/{original|cutout}.webp`

## Common edit scenarios

- **"Change the garment grid / filters"** → `src/components/outfits/WardrobeGrid.tsx`.
- **"Change the add-garment flow / cutout step"** → `src/components/outfits/AddGarmentSheet.tsx` + `src/lib/backgroundRemoval.ts`.
- **"Change the paper doll / swiper feel"** → `src/components/outfits/OutfitBuilder.tsx`, `SlotSwiper.tsx`, presets in `src/lib/motion.ts`.
- **"Add a field to garments"** → migration + `migrations/schema.sql` (`wardrobe_items`) + `types.ts` + Zod in `items/route.ts` + the tag form in `AddGarmentSheet.tsx`.
- **"Images not loading"** → `src/features/outfits/useSignedUrls.ts` (batch cache) + `src/app/api/outfits/signed-urls/route.ts`.

## Connected modules

- None by design — personal per user, no `household_links` anywhere (locked D4). Cross-cutting only: Sync & Offline is explicitly NOT used for writes (locked D6).
