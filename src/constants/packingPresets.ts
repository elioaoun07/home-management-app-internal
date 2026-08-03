// src/constants/packingPresets.ts
//
// Starter lists so a new trip doesn't open to 8 empty tiles. Categories here
// match the built-in TripPackingList categories where possible; anything else
// falls into "Other".

export interface PackingPresetItem {
  name: string;
  category: string;
  quantity?: number;
}

export interface PackingPreset {
  id: string;
  label: string;
  description: string;
  items: PackingPresetItem[];
}

export const PACKING_PRESETS: PackingPreset[] = [
  {
    id: "abroad",
    label: "Abroad",
    description: "International trip essentials — documents, adapters, currency",
    items: [
      { name: "Passport", category: "Documents" },
      { name: "Visa / entry documents", category: "Documents" },
      { name: "Travel insurance", category: "Documents" },
      { name: "Boarding passes", category: "Documents" },
      { name: "Hotel confirmations", category: "Documents" },
      { name: "Power adapter", category: "Electronics" },
      { name: "Phone charger", category: "Electronics" },
      { name: "Portable battery", category: "Electronics" },
      { name: "Local currency / cards", category: "Money" },
      { name: "Underwear", category: "Clothes", quantity: 7 },
      { name: "Socks", category: "Clothes", quantity: 7 },
      { name: "T-shirts", category: "Clothes", quantity: 5 },
      { name: "Toothbrush & toothpaste", category: "Toiletries" },
      { name: "Medications", category: "Health" },
      { name: "First aid basics", category: "Health" },
    ],
  },
  {
    id: "beach",
    label: "Beach",
    description: "Sun, swim and sand",
    items: [
      { name: "Swimsuits", category: "Clothes", quantity: 2 },
      { name: "Sunscreen", category: "Toiletries" },
      { name: "Sunglasses", category: "Accessories" },
      { name: "Beach towel", category: "Accessories" },
      { name: "Flip flops", category: "Clothes" },
      { name: "Hat", category: "Accessories" },
      { name: "Aloe / after-sun", category: "Health" },
      { name: "Waterproof phone pouch", category: "Electronics" },
    ],
  },
  {
    id: "business",
    label: "Business",
    description: "Work trip — laptop, formalwear, chargers",
    items: [
      { name: "Laptop & charger", category: "Electronics" },
      { name: "Business cards", category: "Documents" },
      { name: "Formal outfits", category: "Clothes", quantity: 3 },
      { name: "Dress shoes", category: "Clothes" },
      { name: "Notebook & pen", category: "Accessories" },
      { name: "Phone charger", category: "Electronics" },
      { name: "Expense receipts folder", category: "Documents" },
    ],
  },
  {
    id: "weekend",
    label: "Weekend",
    description: "Short trip, light packing",
    items: [
      { name: "Change of clothes", category: "Clothes", quantity: 2 },
      { name: "Toothbrush & toothpaste", category: "Toiletries" },
      { name: "Phone charger", category: "Electronics" },
      { name: "Medications", category: "Health" },
      { name: "Cash / cards", category: "Money" },
    ],
  },
];

export function getPackingPreset(id: string): PackingPreset | undefined {
  return PACKING_PRESETS.find((p) => p.id === id);
}
