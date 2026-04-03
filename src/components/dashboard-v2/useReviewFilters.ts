import { create } from "zustand";

export type ReviewFilterDimension =
  | "categories"
  | "accounts"
  | "classification"
  | "ownership"
  | "minAmount"
  | "maxAmount"
  | "weekdays"
  | "descriptionSearch"
  | "dateSubRange";

export type Classification = "need" | "want" | "saving";
export type Ownership = "all" | "mine" | "partner";

export interface ReviewFilters {
  categories: string[];
  accounts: string[];
  classification: Classification[];
  ownership: Ownership;
  minAmount: number;
  maxAmount: number;
  weekdays: number[]; // 0=Sun ... 6=Sat
  descriptionSearch: string;
  dateSubRange: { start: string; end: string } | null;
}

interface ReviewFilterState extends ReviewFilters {
  /** Which widget last triggered a filter (for highlight) */
  filterSource: string | null;

  // Actions
  toggleCategory: (cat: string) => void;
  setCategories: (cats: string[]) => void;
  toggleAccount: (acc: string) => void;
  setAccounts: (accs: string[]) => void;
  toggleClassification: (cls: Classification) => void;
  setClassification: (cls: Classification[]) => void;
  setOwnership: (own: Ownership) => void;
  setMinAmount: (amt: number) => void;
  setMaxAmount: (amt: number) => void;
  toggleWeekday: (day: number) => void;
  setWeekdays: (days: number[]) => void;
  setDescriptionSearch: (search: string) => void;
  setDateSubRange: (range: { start: string; end: string } | null) => void;
  setFilterSource: (source: string | null) => void;
  clearDimension: (dim: ReviewFilterDimension) => void;
  clearAll: () => void;
  hasActiveFilters: () => boolean;
}

const initialFilters: ReviewFilters = {
  categories: [],
  accounts: [],
  classification: [],
  ownership: "all",
  minAmount: 0,
  maxAmount: 0,
  weekdays: [],
  descriptionSearch: "",
  dateSubRange: null,
};

export const useReviewFilters = create<ReviewFilterState>((set, get) => ({
  ...initialFilters,
  filterSource: null,

  toggleCategory: (cat) =>
    set((s) => ({
      categories: s.categories.includes(cat)
        ? s.categories.filter((c) => c !== cat)
        : [...s.categories, cat],
    })),
  setCategories: (cats) => set({ categories: cats }),

  toggleAccount: (acc) =>
    set((s) => ({
      accounts: s.accounts.includes(acc)
        ? s.accounts.filter((a) => a !== acc)
        : [...s.accounts, acc],
    })),
  setAccounts: (accs) => set({ accounts: accs }),

  toggleClassification: (cls) =>
    set((s) => ({
      classification: s.classification.includes(cls)
        ? s.classification.filter((c) => c !== cls)
        : [...s.classification, cls],
    })),
  setClassification: (cls) => set({ classification: cls }),

  setOwnership: (own) => set({ ownership: own }),
  setMinAmount: (amt) => set({ minAmount: amt }),
  setMaxAmount: (amt) => set({ maxAmount: amt }),

  toggleWeekday: (day) =>
    set((s) => ({
      weekdays: s.weekdays.includes(day)
        ? s.weekdays.filter((d) => d !== day)
        : [...s.weekdays, day],
    })),
  setWeekdays: (days) => set({ weekdays: days }),

  setDescriptionSearch: (search) => set({ descriptionSearch: search }),
  setDateSubRange: (range) => set({ dateSubRange: range }),
  setFilterSource: (source) => set({ filterSource: source }),

  clearDimension: (dim) => {
    switch (dim) {
      case "categories":
        set({ categories: [] });
        break;
      case "accounts":
        set({ accounts: [] });
        break;
      case "classification":
        set({ classification: [] });
        break;
      case "ownership":
        set({ ownership: "all" });
        break;
      case "minAmount":
        set({ minAmount: 0 });
        break;
      case "maxAmount":
        set({ maxAmount: 0 });
        break;
      case "weekdays":
        set({ weekdays: [] });
        break;
      case "descriptionSearch":
        set({ descriptionSearch: "" });
        break;
      case "dateSubRange":
        set({ dateSubRange: null });
        break;
    }
  },

  clearAll: () => set({ ...initialFilters, filterSource: null }),

  hasActiveFilters: () => {
    const s = get();
    return (
      s.categories.length > 0 ||
      s.accounts.length > 0 ||
      s.classification.length > 0 ||
      s.ownership !== "all" ||
      s.minAmount > 0 ||
      s.maxAmount > 0 ||
      s.weekdays.length > 0 ||
      s.descriptionSearch.length > 0 ||
      s.dateSubRange !== null
    );
  },
}));

/**
 * Apply review filters to a transaction array (client-side filtering).
 * Takes the raw unfiltered transactions and returns only those matching
 * all active filter dimensions.
 */
export function applyReviewFilters<
  T extends {
    amount: number;
    date: string;
    category?: string | null;
    account_name?: string;
    description?: string | null;
    is_owner?: boolean;
    is_collaborator?: boolean;
    split_completed_at?: string | null;
    category_classification?: string | null;
  },
>(transactions: T[], filters: ReviewFilters): T[] {
  let txs = transactions;

  if (filters.categories.length > 0) {
    txs = txs.filter((t) => filters.categories.includes(t.category ?? ""));
  }

  if (filters.accounts.length > 0) {
    txs = txs.filter((t) => filters.accounts.includes(t.account_name ?? ""));
  }

  if (filters.classification.length > 0) {
    txs = txs.filter((t) =>
      filters.classification.includes(
        (t.category_classification as Classification) ?? ("" as Classification),
      ),
    );
  }

  if (filters.ownership !== "all") {
    if (filters.ownership === "mine") {
      txs = txs.filter(
        (t) => t.is_owner === true || t.is_collaborator === true,
      );
    } else {
      txs = txs.filter(
        (t) =>
          t.is_owner === false ||
          (t.is_owner === true && !!t.split_completed_at),
      );
    }
  }

  if (filters.minAmount > 0) {
    txs = txs.filter((t) => Math.abs(t.amount) >= filters.minAmount);
  }

  if (filters.maxAmount > 0) {
    txs = txs.filter((t) => Math.abs(t.amount) <= filters.maxAmount);
  }

  if (filters.weekdays.length > 0) {
    txs = txs.filter((t) => {
      const day = new Date(t.date).getDay();
      return filters.weekdays.includes(day);
    });
  }

  if (filters.descriptionSearch.length > 0) {
    const search = filters.descriptionSearch.toLowerCase();
    txs = txs.filter((t) =>
      (t.description ?? "").toLowerCase().includes(search),
    );
  }

  if (filters.dateSubRange) {
    txs = txs.filter(
      (t) =>
        t.date >= filters.dateSubRange!.start &&
        t.date <= filters.dateSubRange!.end,
    );
  }

  return txs;
}
