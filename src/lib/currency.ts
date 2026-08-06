// Symbol + quick-entry denominations for the currencies selectable in
// AccountCurrencyDialog. Display-only — never used for money math (accounts
// keep native-currency balances; USD conversion happens separately via
// toUsd() in balance-utils.ts).

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  LBP: "LBP",
  AED: "AED",
  TRY: "₺",
};

export function getCurrencySymbol(currency?: string | null): string {
  const code = currency || "USD";
  return CURRENCY_SYMBOLS[code] ?? code;
}

// Real banknote denominations in common circulation for each currency, used
// as the expense-form quick-amount chips. LBP notes are large (post-2023
// devaluation) — unrelated to the separate "LBP change" thousands-tracking
// feature (see LBP Change Feature.md), which is about USD purchases with LBP
// change, not an account's own currency.
export const CURRENCY_DENOMINATIONS: Record<string, string[]> = {
  USD: ["5", "10", "20", "50", "100"],
  EUR: ["5", "10", "20", "50", "100"],
  GBP: ["5", "10", "20", "50"],
  LBP: ["20000", "50000", "100000", "200000", "500000"],
  AED: ["5", "10", "20", "50", "100"],
  TRY: ["5", "10", "20", "50", "100"],
};

export function getQuickAmounts(currency?: string | null): string[] {
  const code = currency || "USD";
  return CURRENCY_DENOMINATIONS[code] ?? CURRENCY_DENOMINATIONS.USD;
}
