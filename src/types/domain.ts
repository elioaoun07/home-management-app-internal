// src/types/domain.ts
export type UUID = string;

/** Accounts */
export type AccountType = "expense" | "income";

export type Account = {
  id: UUID;
  user_id: UUID;
  name: string;
  type: AccountType;
  is_default?: boolean;
  inserted_at: string; // ISO
  country_code?: string | null; // ISO 3166-1 alpha-2 for trip tracking
  location_name?: string | null; // City/region name for trip tracking
};

/** User (DB) categories are flat; subcats use parent_id */
export interface Category {
  id: UUID;
  user_id: UUID;
  account_id?: UUID | null;
  name: string;
  parent_id?: UUID | null;
  color?: string | null;
  position?: number | null;
  visible?: boolean | null;
}

/** Default (built-in) categories used as fallback; nested shape */
export interface DefaultSubcategory {
  id: UUID;
  name: string;
  color?: string;
}

export interface DefaultCategory {
  id: UUID;
  name: string;
  color?: string;
  subcategories?: DefaultSubcategory[];
}

/** Union used by UI hooks (DB-flat OR default-nested) */
export type CategoryLike = Category | DefaultCategory;

/** Type guard: DB category vs default */
export function isDbCategory(c: CategoryLike): c is Category {
  return "parent_id" in c;
}
