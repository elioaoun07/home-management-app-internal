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
 */
export function getTransferDeltas(
  amount: number,
  returnedAmount: number = 0,
  transferType: "self" | "household" = "self",
): { fromDelta: number; toDelta: number } {
  const net = transferType === "household" ? amount - returnedAmount : amount;
  return {
    fromDelta: -net, // Source account loses money
    toDelta: net, // Destination account gains money
  };
}
