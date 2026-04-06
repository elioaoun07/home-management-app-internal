// Budget Allocation Types

export type BudgetAssignment = "user" | "partner" | "both";

/** Ownership filter matching the dashboard toggle */
export type BudgetOwnershipFilter = "mine" | "all" | "partner";

/** Week review labels: w0 = initial allocation, w1-w4 = weekly reviews */
export type BudgetWeek = "w0" | "w1" | "w2" | "w3" | "w4";

export interface BudgetAllocation {
  id: string;
  user_id: string;
  assigned_to: BudgetAssignment;
  category_id: string;
  subcategory_id: string | null;
  account_id: string;
  monthly_budget: number;
  budget_month: string | null; // 'YYYY-MM' or null for default
  created_at: string;
  updated_at: string;

  // Joined data
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  subcategory_name?: string;
  subcategory_icon?: string;
  account_name?: string;
}

/** Merged category view — categories merged by name across all expense accounts */
export interface BudgetCategoryView {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  category_color: string;
  account_id: string;
  account_name: string;

  // Aggregated budgets
  total_budget: number;
  user_budget: number;
  partner_budget: number;
  shared_budget: number;

  // Spending
  total_spent: number;
  user_spent: number;
  partner_spent: number;

  // Subcategory breakdown (optional)
  subcategories?: BudgetSubcategoryView[];

  // Allocation details
  allocations: BudgetAllocation[];

  /** Source category IDs when merged across accounts */
  merged_category_ids?: string[];
  /** Source account IDs when merged across accounts */
  merged_account_ids?: string[];
}

export interface BudgetSubcategoryView {
  subcategory_id: string;
  subcategory_name: string;
  subcategory_icon: string | null;

  total_budget: number;
  user_budget: number;
  partner_budget: number;
  shared_budget: number;

  total_spent: number;
  user_spent: number;
  partner_spent: number;

  /** Percentage of parent category budget (0-100) */
  percentage: number;

  allocations: BudgetAllocation[];

  /** Source subcategory IDs when merged across accounts */
  merged_subcategory_ids?: string[];
}

export interface CreateBudgetAllocationInput {
  category_id: string;
  subcategory_id?: string | null;
  account_id: string;
  assigned_to: BudgetAssignment;
  monthly_budget: number;
  budget_month?: string | null;
}

export interface UpdateBudgetAllocationInput {
  assigned_to?: BudgetAssignment;
  monthly_budget?: number;
  budget_month?: string | null;
}

/** Income balance for a single account */
export interface IncomeAccountBalance {
  account_id: string;
  account_name: string;
  user_id: string;
  balance: number;
}

export interface BudgetSummary {
  total_budget: number;
  total_spent: number;
  total_remaining: number;
  user_budget: number;
  user_spent: number;
  partner_budget: number;
  partner_spent: number;
  shared_budget: number;
  /** Income balance = total available budget from income accounts */
  income_balance: number;
  user_income_balance: number;
  partner_income_balance: number;
  income_accounts: IncomeAccountBalance[];
  /** How much of income is still unallocated */
  unallocated: number;
  categories: BudgetCategoryView[];
}

// Assignment display helpers
export const ASSIGNMENT_LABELS: Record<BudgetAssignment, string> = {
  user: "Me",
  partner: "Partner",
  both: "Shared",
};

export const ASSIGNMENT_COLORS: Record<BudgetAssignment, string> = {
  user: "#38bdf8", // cyan
  partner: "#f472b6", // pink
  both: "#a78bfa", // violet
};

export const BUDGET_WEEK_LABELS: Record<BudgetWeek, string> = {
  w0: "Initial",
  w1: "Week 1",
  w2: "Week 2",
  w3: "Week 3",
  w4: "Week 4",
};
