// Budget Allocation Types

export type BudgetAssignment = "user" | "partner" | "both";

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

  allocations: BudgetAllocation[];
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

export interface BudgetSummary {
  total_budget: number;
  total_spent: number;
  total_remaining: number;
  user_budget: number;
  user_spent: number;
  partner_budget: number;
  partner_spent: number;
  shared_budget: number;
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
