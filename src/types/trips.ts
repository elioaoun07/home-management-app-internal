// src/types/trips.ts

export type TripStatus = "draft" | "upcoming" | "active" | "completed" | "archived";
export type TripScope = "solo" | "household";
export type TripPlaceType = "hotel" | "activity" | "restaurant" | "attraction" | "transport" | "note" | "other";
export type TripPlacePriority = "mandatory" | "flexible" | "wishlist";
export type TripSideEffectType = "chore_skip" | "event_skip" | "recurrence_pause" | "meal_skip" | "item_reassign";

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  destination_country_code: string | null;
  destination_name: string | null;
  currency: string;
  scope: TripScope;
  status: TripStatus;
  start_date: string | null;
  end_date: string | null;
  account_id: string | null;
  is_template: boolean;
  notes: string | null;
  activated_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripPlace {
  id: string;
  user_id: string;
  trip_id: string;
  name: string;
  place_type: TripPlaceType | null;
  url: string | null;
  description: string | null;
  cost: number | null;
  currency: string | null;
  priority: TripPlacePriority;
  scheduled_date: string | null;
  scheduled_time: string | null;
  is_booked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TripPackingItem {
  id: string;
  user_id: string;
  trip_id: string;
  name: string;
  category: string | null;
  quantity: number;
  packed_quantity: number;
  is_packed: boolean;
  position: number;
  inventory_item_id: string | null;
  catalogue_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripSideEffect {
  id: string;
  user_id: string;
  trip_id: string;
  effect_type: TripSideEffectType;
  target_table: string;
  target_id: string | null;
  previous_value: Record<string, unknown> | null;
  created_at: string;
}

// Input types
export interface CreateTripInput {
  name: string;
  destination_country_code?: string | null;
  destination_name?: string | null;
  currency?: string;
  scope: TripScope;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  is_template?: boolean;
}

export interface UpdateTripInput {
  name?: string;
  destination_country_code?: string | null;
  destination_name?: string | null;
  currency?: string;
  scope?: TripScope;
  status?: TripStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  is_template?: boolean;
}

export interface CreateTripPlaceInput {
  name: string;
  place_type?: TripPlaceType | null;
  url?: string | null;
  description?: string | null;
  cost?: number | null;
  currency?: string | null;
  priority?: TripPlacePriority;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  is_booked?: boolean;
  position?: number;
}

export interface UpdateTripPlaceInput extends Partial<CreateTripPlaceInput> {}

export interface CreateTripPackingItemInput {
  name: string;
  category?: string | null;
  quantity?: number;
  position?: number;
  inventory_item_id?: string | null;
  catalogue_item_id?: string | null;
}

export interface UpdateTripPackingItemInput {
  name?: string;
  category?: string | null;
  quantity?: number;
  packed_quantity?: number;
  is_packed?: boolean;
  position?: number;
  inventory_item_id?: string | null;
  catalogue_item_id?: string | null;
}

export interface ActivateTripResult {
  scope: TripScope;
  skipped_chores: number;
  skipped_events: number;
  paused_recurring: number;
  skipped_meals: number;
  reassigned_items: number;
}

// Display metadata
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

export const TRIP_STATUS_COLORS: Record<TripStatus, string> = {
  draft: "text-white/40",
  upcoming: "text-cyan-400",
  active: "text-emerald-400",
  completed: "text-white/60",
  archived: "text-white/30",
};

export const PLACE_TYPE_LABELS: Record<TripPlaceType, string> = {
  hotel: "Hotel",
  activity: "Activity",
  restaurant: "Restaurant",
  attraction: "Attraction",
  transport: "Transport",
  note: "Note",
  other: "Other",
};

export const PLACE_PRIORITY_LABELS: Record<TripPlacePriority, string> = {
  mandatory: "Mandatory",
  flexible: "Flexible",
  wishlist: "Wishlist",
};

export const PLACE_PRIORITY_COLORS: Record<TripPlacePriority, string> = {
  mandatory: "text-pink-400",
  flexible: "text-cyan-400",
  wishlist: "text-white/50",
};
