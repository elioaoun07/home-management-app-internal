// src/lib/queryConfig.ts
/**
 * Centralized query configuration for optimal caching and performance.
 *
 * PERFORMANCE STRATEGY:
 * 1. User preferences: Load from localStorage first, sync in background
 * 2. Account balance: Cache aggressively, only invalidate on user mutations
 * 3. Transactions: Moderate staleTime with smart refetch
 * 4. Static data (accounts, categories): Long cache, rarely changes
 */

// Cache duration constants (in milliseconds)
export const CACHE_TIMES = {
  // Data that rarely changes - cache for 24 hours
  PERMANENT: 1000 * 60 * 60 * 24,

  // User preferences - 1 hour (rarely changes during session)
  PREFERENCES: 1000 * 60 * 60,

  // Account balance - 5 minutes (only invalidated on mutations)
  BALANCE: 1000 * 60 * 5,

  // Accounts & categories - 1 hour (user rarely adds new ones)
  ACCOUNTS: 1000 * 60 * 60,
  CATEGORIES: 1000 * 60 * 60,

  // Transactions - 2 minutes (may change more often)
  TRANSACTIONS: 1000 * 60 * 2,

  // Recurring payments - 30 minutes
  RECURRING: 1000 * 60 * 30,

  // Drafts - 1 minute (may be added frequently)
  DRAFTS: 1000 * 60,

  // Onboarding - 24 hours (never changes)
  ONBOARDING: 1000 * 60 * 60 * 24,
} as const;

// Query key factory with consistent naming
export const queryKeys = {
  // Account balance - critical for instant UI
  accountBalance: (accountId?: string) =>
    ["account-balance", accountId] as const,

  // Transactions with date range
  transactions: (startDate?: string, endDate?: string) =>
    ["transactions", "dashboard", startDate, endDate] as const,

  // Today's transactions for watch view
  todayTransactions: (accountId?: string, date?: string) =>
    ["transactions-today", accountId, date] as const,

  // User preferences
  userPreferences: () => ["user-preferences"] as const,

  // Recurring payments
  recurringPayments: () => ["recurring-payments"] as const,
} as const;

// localStorage keys for offline-first data
export const LOCAL_STORAGE_KEYS = {
  USER_PREFERENCES: "user_preferences",
  BALANCE_CACHE: "balance_cache",
  THEME: "hm-theme",
  VIEW_MODE: "hm-view-mode",
} as const;

/**
 * Read cached balance from localStorage
 */
export function getCachedBalance(accountId: string): {
  balance: number;
  updatedAt: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(
      `${LOCAL_STORAGE_KEYS.BALANCE_CACHE}_${accountId}`
    );
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Cache balance to localStorage
 */
export function setCachedBalance(accountId: string, balance: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEYS.BALANCE_CACHE}_${accountId}`,
      JSON.stringify({
        balance,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get cached user preferences from localStorage (instant load)
 */
export function getCachedPreferences(): {
  date_start?: string;
  theme?: string;
  section_order?: string[];
} | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_PREFERENCES);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Cache user preferences to localStorage
 */
export function setCachedPreferences(prefs: {
  date_start?: string;
  theme?: string;
  section_order?: string[];
}): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getCachedPreferences() || {};
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.USER_PREFERENCES,
      JSON.stringify({ ...existing, ...prefs })
    );
  } catch {
    // Ignore storage errors
  }
}
