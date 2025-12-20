export type OwnershipFilter = "all" | "mine" | "partner" | "both";

export interface TransactionForDisplay {
  amount: number;
  description: string | null;
  is_owner?: boolean;
  is_collaborator?: boolean;
  split_requested?: boolean;
  split_completed_at?: string | null;
  collaborator_amount?: number | null;
  collaborator_description?: string | null;
  [key: string]: any;
}

/**
 * Calculates the display amount for a transaction based on the ownership filter.
 *
 * Logic:
 * - If not a completed split bill: returns original amount.
 * - If "both" (or "all"): returns TOTAL amount (owner + collaborator).
 * - If "mine":
 *   - If I am owner: returns owner's portion (original amount).
 *   - If I am collaborator: returns collaborator's portion.
 * - If "partner":
 *   - If I am owner: returns collaborator's portion (partner's share).
 *   - If I am collaborator: returns owner's portion (partner's share).
 */
export function getTransactionDisplayAmount(
  t: TransactionForDisplay,
  filter: OwnershipFilter
): number {
  const isSplitCompleted = !!(
    t.split_requested &&
    t.split_completed_at &&
    t.collaborator_amount !== undefined &&
    t.collaborator_amount !== null
  );

  if (!isSplitCompleted) {
    return t.amount;
  }

  if (filter === "all" || filter === "both") {
    // Show total for "both" filter
    return t.amount + (t.collaborator_amount || 0);
  } else if (filter === "mine") {
    // Show user's portion
    // If owner: My Share (amount)
    // If collaborator: My Share (collaborator_amount)
    if (t.is_owner) return t.amount;
    if (t.is_collaborator) return t.collaborator_amount || 0;
    return 0;
  } else {
    // "partner" filter
    // If owner: Partner's Share (collaborator_amount)
    // If collaborator: Partner's Share (amount - which is the owner's share)
    if (t.is_owner) return t.collaborator_amount || 0;
    if (t.is_collaborator) return t.amount;
    return t.amount;
  }
}

/**
 * Gets the display description for a transaction based on the ownership filter.
 */
export function getTransactionDisplayDescription(
  t: TransactionForDisplay,
  filter: OwnershipFilter
): string | null {
  const isSplitCompleted = !!(t.split_requested && t.split_completed_at);

  if (!isSplitCompleted) {
    return t.description;
  }

  if (filter === "all" || filter === "both") {
    // Show both descriptions if different
    const ownerDesc = t.description || "";
    const collabDesc = t.collaborator_description || "";
    if (ownerDesc && collabDesc && ownerDesc !== collabDesc) {
      return `${ownerDesc} | ${collabDesc}`;
    }
    return ownerDesc || collabDesc || null;
  } else if (filter === "mine") {
    // Show my description
    return (t.is_owner ? t.description : t.collaborator_description) || null;
  } else {
    // "partner" filter
    return (t.is_owner ? t.collaborator_description : t.description) || null;
  }
}
