/**
 * Shared balance delta calculation — used by BOTH server routes and client optimistic updates.
 *
 * Determines how much to add/subtract from account_balances.balance
 * when a transaction is created or deleted.
 */

export type AccountType = "expense" | "income" | "saving";

/**
 * Returns the delta to apply to the stored balance.
 *
 * - Expense account + create  →  −amount (money leaves the account)
 * - Income/Saving account + create  →  +amount (money enters the account)
 * - Debt return + create  →  +amount (someone repaying you, always adds money)
 * - Delete = negate the create delta
 */
export function getBalanceDelta(
  amount: number,
  accountType: AccountType,
  isDebtReturn: boolean,
  operation: "create" | "delete",
): number {
  let delta: number;

  if (isDebtReturn) {
    // Debt returns always ADD money back regardless of account type
    delta = amount;
  } else if (accountType === "expense") {
    // Expense transactions DECREASE balance
    delta = -amount;
  } else {
    // Income/Saving transactions INCREASE balance
    delta = amount;
  }

  // Deleting reverses the original effect
  if (operation === "delete") {
    delta = -delta;
  }

  return delta;
}

/**
 * For transfers: returns the delta for each side.
 * Transfers always decrease the source and increase the destination.
 *
 * `toAmount` supports cross-currency conversion transfers (e.g. USD wallet ->
 * EUR trip cash): when provided, the destination leg uses it instead of the
 * source `net` so each account's balance stays in its own currency. Omitted
 * (undefined/null) preserves the original same-currency symmetric behavior.
 */
export function getTransferDeltas(
  amount: number,
  returnedAmount: number = 0,
  transferType: "self" | "household" = "self",
  toAmount?: number | null,
): { fromDelta: number; toDelta: number } {
  const net = transferType === "household" ? amount - returnedAmount : amount;
  return {
    fromDelta: -net, // Source account loses money
    toDelta: toAmount ?? net, // Destination account gains money (converted, if applicable)
  };
}

/**
 * Converts a native-currency amount to its frozen USD equivalent using the
 * rate stamped on the transaction at insert time (or the account's current
 * rate, for balances). A null/undefined rate means USD or a pre-migration
 * row — treated as 1 so nothing changes for existing data.
 */
export function toUsd(amount: number, exchangeRate?: number | null): number {
  return amount * (exchangeRate ?? 1);
}
