// src/features/outfits/types.ts
// Mirrors migrations/schema.sql: wardrobe_profiles, wardrobe_items, outfits, outfit_items.

export const SLOTS = [
  "headwear",
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "accessory",
] as const;
export type Slot = (typeof SLOTS)[number];

/** The stacked body slots of the paper doll, top to bottom. */
export const DOLL_SLOTS = ["headwear", "top", "bottom", "shoes"] as const;
export type DollSlot = (typeof DOLL_SLOTS)[number];

/** Overlay slots rendered above the doll column, picked via chips. */
export const OVERLAY_SLOTS = ["outerwear", "accessory"] as const;
export type OverlaySlot = (typeof OVERLAY_SLOTS)[number];

export const SEASONS = ["spring", "summer", "fall", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const FORMALITIES = [
  "casual",
  "smart-casual",
  "business",
  "formal",
  "athletic",
] as const;
export type Formality = (typeof FORMALITIES)[number];

export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  slot: Slot;
  subcategory: string | null;
  colors: string[];
  brand: string | null;
  size: string | null;
  season: Season[];
  formality: Formality | null;
  style_tags: string[];
  image_path: string | null;
  cutout_path: string | null;
  fit_note: string | null;
  times_worn: number;
  last_worn_at: string | null;
  ai_tagged: boolean;
  ai_confidence: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWardrobeItemDTO {
  name: string;
  slot: Slot;
  subcategory?: string | null;
  colors?: string[];
  brand?: string | null;
  size?: string | null;
  season?: Season[];
  formality?: Formality | null;
  style_tags?: string[];
  fit_note?: string | null;
  ai_tagged?: boolean;
  ai_confidence?: number | null;
}

export type UpdateWardrobeItemDTO = Partial<CreateWardrobeItemDTO> & {
  archived?: boolean;
};

export interface WardrobeProfile {
  user_id: string;
  height_cm: number | null;
  weight_kg: number | null;
  sizes: Record<string, string>;
  notes: string | null;
  updated_at: string;
}

export interface SaveWardrobeProfileDTO {
  height_cm?: number | null;
  weight_kg?: number | null;
  sizes?: Record<string, string>;
  notes?: string | null;
}

export interface OutfitItem {
  id: string;
  user_id: string;
  outfit_id: string;
  item_id: string;
  slot: Slot;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string;
  occasion_hint: string | null;
  notes: string | null;
  times_worn: number;
  last_worn_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  outfit_items: OutfitItem[];
}

export interface OutfitSlotSelection {
  slot: Slot;
  item_id: string;
}

export interface CreateOutfitDTO {
  name: string;
  occasion_hint?: string | null;
  notes?: string | null;
  items: OutfitSlotSelection[];
}

export interface UpdateOutfitDTO {
  name?: string;
  occasion_hint?: string | null;
  notes?: string | null;
  archived?: boolean;
  items?: OutfitSlotSelection[];
}

/** Local builder state: which garment occupies each slot (null = empty). */
export type SlotMap = Record<Slot, string | null>;

export const EMPTY_SLOT_MAP: SlotMap = {
  headwear: null,
  top: null,
  bottom: null,
  shoes: null,
  outerwear: null,
  accessory: null,
};

export function slotMapToItems(map: SlotMap): OutfitSlotSelection[] {
  return (Object.entries(map) as [Slot, string | null][])
    .filter((entry): entry is [Slot, string] => entry[1] !== null)
    .map(([slot, item_id]) => ({ slot, item_id }));
}

export function outfitToSlotMap(outfit: Outfit): SlotMap {
  const map = { ...EMPTY_SLOT_MAP };
  for (const oi of outfit.outfit_items) map[oi.slot] = oi.item_id;
  return map;
}
