// src/constants/defaultCategories.ts
// Default Accounts + Categories shown for brand-new users (no data yet).
// Icons are derived from category names via getCategoryIcon() - no icon field needed.

export type Category = {
  id: string; // stable slug for UI keys
  name: string;
  color: string;
  slug?: string; // optional explicit slug (id already slug-like)
  position?: number; // UI ordering (mirrors user_categories.position)
  visible?: boolean; // mirrors user_categories.visible
  subcategories?: Array<{
    id: string;
    name: string;
    color: string;
    slug?: string;
    position?: number;
    visible?: boolean;
  }>;
};

export type AccountSeed = {
  id: string; // stable slug for mapping after DB insert
  name: string; // accounts.name
  type: "Income" | "Expense"; // accounts.type
  categories: Category[]; // will become user_categories tied to this account
};

/**
 * DEFAULT_ACCOUNTS is the primary export you’ll likely use.
 * Insert order suggestion:
 * 1) Insert into `accounts` (user_id, name, type, slug=id) RETURNING id, slug
 * 2) Map slug -> uuid and insert categories:
 *    - Top level: parent_id = null, account_id = mapped account uuid
 *    - Subcategories: parent_id = parent category uuid (same account_id)
 */
export const DEFAULT_ACCOUNTS: AccountSeed[] = [
  {
    id: "acc-salary",
    name: "Salary",
    type: "Income",
    categories: [
      {
        id: "cat-income",
        name: "Income",
        color: "#85bb65",
        slug: "income",
        position: 1,
        visible: true,
      },
      {
        id: "cat-bonus",
        name: "Bonus",
        color: "#FFD700",
        slug: "bonus",
        position: 2,
        visible: true,
      },
    ],
  },
  {
    id: "acc-wallet",
    name: "Wallet",
    type: "Expense",
    categories: [
      {
        id: "cat-food-dining",
        name: "Food & Dining",
        color: "#FF7043",
        slug: "food-dining",
        position: 1,
        visible: true,
        subcategories: [
          {
            id: "sub-groceries",
            name: "Groceries",
            color: "#FFB300",
            slug: "groceries",
            position: 1,
            visible: true,
          },
          {
            id: "sub-restaurants",
            name: "Restaurants",
            color: "#FF7043",
            slug: "restaurants",
            position: 2,
            visible: true,
          },
          {
            id: "sub-coffee",
            name: "Coffee",
            color: "#8D6E63",
            slug: "coffee",
            position: 3,
            visible: true,
          },
        ],
      },
      {
        id: "cat-transport",
        name: "Transport",
        color: "#29B6F6",
        slug: "transport",
        position: 2,
        visible: true,
        subcategories: [
          {
            id: "sub-fuel",
            name: "Fuel",
            color: "#FFA726",
            slug: "fuel",
            position: 1,
            visible: true,
          },
          {
            id: "sub-taxi",
            name: "Taxi",
            color: "#FFD600",
            slug: "taxi",
            position: 2,
            visible: true,
          },
          {
            id: "sub-public",
            name: "Public Transit",
            color: "#66BB6A",
            slug: "public-transit",
            position: 3,
            visible: true,
          },
          {
            id: "sub-parking",
            name: "Parking",
            color: "#90A4AE",
            slug: "parking",
            position: 4,
            visible: true,
          },
        ],
      },
      {
        id: "cat-shopping",
        name: "Shopping",
        color: "#AB47BC",
        slug: "shopping",
        position: 3,
        visible: true,
        subcategories: [
          {
            id: "sub-clothes",
            name: "Clothes",
            color: "#EC407A",
            slug: "clothes",
            position: 1,
            visible: true,
          },
          {
            id: "sub-electronics",
            name: "Electronics",
            color: "#42A5F5",
            slug: "electronics",
            position: 2,
            visible: true,
          },
          {
            id: "sub-home",
            name: "Home",
            color: "#8D6E63",
            slug: "home",
            position: 3,
            visible: true,
          },
        ],
      },
      {
        id: "cat-bills",
        name: "Bills & Utilities",
        color: "#FFA726",
        slug: "bills-utilities",
        position: 4,
        visible: true,
        subcategories: [
          {
            id: "sub-electricity",
            name: "Electricity",
            color: "#FFD600",
            slug: "electricity",
            position: 1,
            visible: true,
          },
          {
            id: "sub-water",
            name: "Water",
            color: "#29B6F6",
            slug: "water",
            position: 2,
            visible: true,
          },
          {
            id: "sub-internet",
            name: "Internet",
            color: "#66BB6A",
            slug: "internet",
            position: 3,
            visible: true,
          },
          {
            id: "sub-phone",
            name: "Phone",
            color: "#42A5F5",
            slug: "phone",
            position: 4,
            visible: true,
          },
        ],
      },
      {
        id: "cat-health",
        name: "Health",
        color: "#66BB6A",
        slug: "health",
        position: 5,
        visible: true,
        subcategories: [
          {
            id: "sub-pharmacy",
            name: "Pharmacy",
            color: "#AB47BC",
            slug: "pharmacy",
            position: 1,
            visible: true,
          },
          {
            id: "sub-doctor",
            name: "Doctor",
            color: "#29B6F6",
            slug: "doctor",
            position: 2,
            visible: true,
          },
          {
            id: "sub-fitness",
            name: "Fitness",
            color: "#FFA726",
            slug: "fitness",
            position: 3,
            visible: true,
          },
        ],
      },
      {
        id: "cat-entertainment",
        name: "Entertainment",
        color: "#EC407A",
        slug: "entertainment",
        position: 6,
        visible: true,
        subcategories: [
          {
            id: "sub-movies",
            name: "Movies",
            color: "#AB47BC",
            slug: "movies",
            position: 1,
            visible: true,
          },
          {
            id: "sub-games",
            name: "Games",
            color: "#42A5F5",
            slug: "games",
            position: 2,
            visible: true,
          },
          {
            id: "sub-music",
            name: "Music",
            color: "#66BB6A",
            slug: "music",
            position: 3,
            visible: true,
          },
        ],
      },
      {
        id: "cat-travel",
        name: "Travel",
        color: "#42A5F5",
        slug: "travel",
        position: 7,
        visible: true,
        subcategories: [
          {
            id: "sub-flights",
            name: "Flights",
            color: "#29B6F6",
            slug: "flights",
            position: 1,
            visible: true,
          },
          {
            id: "sub-hotels",
            name: "Hotels",
            color: "#AB47BC",
            slug: "hotels",
            position: 2,
            visible: true,
          },
        ],
      },
      {
        id: "cat-home-rent",
        name: "Home & Rent",
        color: "#8D6E63",
        slug: "home-rent",
        position: 8,
        visible: true,
        subcategories: [
          {
            id: "sub-rent",
            name: "Rent",
            color: "#8D6E63",
            slug: "rent",
            position: 1,
            visible: true,
          },
          {
            id: "sub-maintenance",
            name: "Maintenance",
            color: "#BDBDBD",
            slug: "maintenance",
            position: 2,
            visible: true,
          },
        ],
      },
      {
        id: "cat-education",
        name: "Education",
        color: "#42A5F5",
        slug: "education",
        position: 9,
        visible: true,
        subcategories: [
          {
            id: "sub-tuition",
            name: "Tuition",
            color: "#42A5F5",
            slug: "tuition",
            position: 1,
            visible: true,
          },
          {
            id: "sub-books",
            name: "Books",
            color: "#AB47BC",
            slug: "books",
            position: 2,
            visible: true,
          },
        ],
      },
      {
        id: "cat-gifts-charity",
        name: "Gifts & Charity",
        color: "#EC407A",
        slug: "gifts-charity",
        position: 10,
        visible: true,
        subcategories: [
          {
            id: "sub-gifts",
            name: "Gifts",
            color: "#EC407A",
            slug: "gifts",
            position: 1,
            visible: true,
          },
          {
            id: "sub-donations",
            name: "Donations",
            color: "#66BB6A",
            slug: "donations",
            position: 2,
            visible: true,
          },
        ],
      },
    ],
  },
];

/**
 * DEFAULT_CATEGORIES — convenient export for UIs that only need a default
 * category list (e.g., when a selected account has none in DB yet). We use
 * the Expense "Wallet" account's categories as a sensible default.
 */
export const DEFAULT_CATEGORIES: Category[] =
  DEFAULT_ACCOUNTS.find((a) => a.id === "acc-wallet")?.categories ?? [];
