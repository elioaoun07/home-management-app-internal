// src/types/inventory.ts
// Types for the Home Inventory system

import type { UUID } from "./catalogue";

// =============================================================================
// INVENTORY ITEM METADATA
// =============================================================================

export type InventoryUnitType =
  | "count"
  | "weight"
  | "volume"
  | "pack"
  | "custom";

export interface InventoryItemMetadata {
  barcode?: string;
  unit_type?: InventoryUnitType;
  unit_size?: string; // Human-readable: "6 rolls", "1kg", "2L"
  unit_value?: number; // Numeric value for calculations
  unit_measure?: string; // Unit of measure: "rolls", "kg", "L"
  consumption_rate_days?: number; // Days per unit (how long one unit lasts)
  minimum_stock?: number; // Alert when stock falls below this
  typical_purchase_quantity?: number; // How many you usually buy at once
  preferred_store?: string; // Where you usually buy this
  notes?: string; // Purchase notes
}

// =============================================================================
// INVENTORY STOCK
// =============================================================================

export interface InventoryStock {
  id: UUID;
  user_id: UUID;
  item_id: UUID;
  quantity_on_hand: number;
  last_restocked_at: string;
  last_restocked_quantity: number | null;
  estimated_runout_date: string | null;
  auto_add_to_shopping: boolean;
  shopping_thread_id: UUID | null;
  shopping_message_id: UUID | null;
  last_added_to_shopping_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// INVENTORY RESTOCK HISTORY
// =============================================================================

export interface InventoryRestockHistory {
  id: UUID;
  user_id: UUID;
  stock_id: UUID;
  item_id: UUID;
  quantity_added: number;
  quantity_before: number;
  quantity_after: number;
  source: "manual" | "shopping_checkout" | "bulk_import";
  restocked_at: string;
}

// =============================================================================
// LOW STOCK ITEM (from get_low_stock_items function)
// =============================================================================

export interface LowStockItem {
  item_id: UUID;
  item_name: string;
  barcode: string | null;
  quantity_on_hand: number;
  estimated_runout_date: string;
  days_until_runout: number;
  unit_size: string | null;
  already_in_shopping: boolean;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface CreateInventoryItemInput {
  module_id: UUID;
  category_id?: UUID;
  name: string;
  description?: string;
  barcode?: string;
  unit_type: InventoryUnitType;
  unit_size: string;
  unit_value?: number;
  unit_measure?: string;
  consumption_rate_days: number;
  minimum_stock?: number;
  typical_purchase_quantity?: number;
  preferred_store?: string;
  notes?: string;
  initial_quantity?: number;
}

export interface RestockItemInput {
  item_id: UUID;
  quantity: number;
  source?: "manual" | "shopping_checkout" | "bulk_import";
}

export interface UpdateStockInput {
  stock_id: UUID;
  quantity_on_hand?: number;
  auto_add_to_shopping?: boolean;
  shopping_thread_id?: UUID | null;
}

// =============================================================================
// BARCODE SCANNER RESULT
// =============================================================================

export interface BarcodeScanResult {
  barcode: string;
  format:
    | "EAN_13"
    | "EAN_8"
    | "UPC_A"
    | "UPC_E"
    | "CODE_128"
    | "CODE_39"
    | "QR_CODE"
    | "unknown";
  timestamp: string;
}

// =============================================================================
// UNIT TYPE HELPERS
// =============================================================================

export const UNIT_TYPE_LABELS: Record<InventoryUnitType, string> = {
  count: "Count (pieces)",
  weight: "Weight (kg, g, lb)",
  volume: "Volume (L, ml)",
  pack: "Pack (rolls, bags)",
  custom: "Custom",
};

export const UNIT_TYPE_EXAMPLES: Record<InventoryUnitType, string[]> = {
  count: ["1 loaf", "12 eggs", "1 bottle"],
  weight: ["1kg", "500g", "2lb"],
  volume: ["1L", "500ml", "1 gallon"],
  pack: ["6 rolls", "4-pack", "24 cans"],
  custom: ["custom unit"],
};

export const COMMON_CONSUMPTION_RATES: { label: string; days: number }[] = [
  { label: "Daily", days: 1 },
  { label: "Every 2-3 days", days: 3 },
  { label: "Weekly", days: 7 },
  { label: "Bi-weekly", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Every 1.5 months", days: 45 },
  { label: "Every 2 months", days: 60 },
  { label: "Every 3 months", days: 90 },
  { label: "Every 6 months", days: 180 },
  { label: "Yearly", days: 365 },
];

// =============================================================================
// INVENTORY WITH STOCK (combined view)
// =============================================================================

export interface InventoryItemWithStock {
  id: UUID;
  name: string;
  description: string | null;
  category_id: UUID | null;
  metadata: InventoryItemMetadata;
  stock: InventoryStock | null;
  // Computed
  days_until_runout: number | null;
  stock_status: "ok" | "low" | "critical" | "out";
}
