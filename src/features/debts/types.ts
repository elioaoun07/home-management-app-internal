// src/features/debts/types.ts

export type DebtStatus = "open" | "archived" | "closed";

export interface Debt {
  id: string;
  user_id: string;
  transaction_id: string;
  debtor_name: string;
  original_amount: number;
  returned_amount: number;
  status: DebtStatus;
  notes: string | null;
  archived_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined from transaction
  transaction?: {
    date: string;
    description: string | null;
    account_id: string;
    category_id: string | null;
    is_private: boolean;
    account_name?: string;
    category_name?: string;
  };
}

export interface CreateDebtDTO {
  account_id: string;
  category_id: string;
  subcategory_id?: string;
  amount: number;
  description?: string;
  date?: string;
  is_private?: boolean;
  debtor_name: string;
  notes?: string;
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
