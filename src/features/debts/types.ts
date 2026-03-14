// src/features/debts/types.ts

export type DebtStatus = "open" | "archived" | "closed";

export interface Debt {
  id: string;
  user_id: string;
  transaction_id: string | null;
  debtor_name: string;
  original_amount: number;
  returned_amount: number;
  status: DebtStatus;
  notes: string | null;
  archived_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined from transaction (null for standalone debts)
  transaction?: {
    date: string;
    description: string | null;
    account_id: string;
    category_id: string | null;
    is_private: boolean;
    account_name?: string;
    category_name?: string;
  } | null;
}

export interface CreateDebtDTO {
  account_id: string;
  category_id: string;
  subcategory_id?: string;
  amount: number;
  /** How much the friend owes — defaults to full amount if not provided */
  debt_amount?: number;
  description?: string;
  date?: string;
  is_private?: boolean;
  debtor_name: string;
  notes?: string;
}

/** Standalone debt — no transaction, just "someone owes me X" */
export interface CreateStandaloneDebtDTO {
  debtor_name: string;
  amount: number;
  notes?: string;
  date?: string;
}

export interface SettleDebtDTO {
  amount_returned: number;
}

export interface DebtWithTransaction extends Debt {
  transaction: {
    date: string;
    description: string | null;
    account_id: string;
    account_name: string;
    category_id: string | null;
    category_name?: string;
    is_private: boolean;
  };
}
