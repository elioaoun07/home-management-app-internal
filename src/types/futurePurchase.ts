// src/types/futurePurchase.ts
export type UUID = string;

/**
 * Urgency levels for future purchases
 * 1 = Low (nice to have)
 * 2 = Medium-Low
 * 3 = Medium (want it)
 * 4 = High (need it soon)
 * 5 = Critical (must have)
 */
export type UrgencyLevel = 1 | 2 | 3 | 4 | 5;

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  1: "Low",
  2: "Medium-Low",
  3: "Medium",
  4: "High",
  5: "Critical",
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  1: "#10b981", // emerald
  2: "#22d3ee", // cyan
  3: "#f59e0b", // amber
  4: "#f97316", // orange
  5: "#ef4444", // red
};

export type FuturePurchaseStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "paused";

export interface FuturePurchaseAllocation {
  month: string; // Format: "2024-01"
  amount: number;
  allocated_at: string; // ISO timestamp
}

export interface FuturePurchase {
  id: UUID;
  user_id: UUID;
  name: string;
  description: string | null;
  target_amount: number;
  current_saved: number;
  urgency: UrgencyLevel;
  target_date: string; // ISO date string
  recommended_monthly_savings: number;
  icon: string;
  color: string;
  status: FuturePurchaseStatus;
  allocations: FuturePurchaseAllocation[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateFuturePurchaseInput {
  name: string;
  description?: string;
  target_amount: number;
  urgency: UrgencyLevel;
  target_date: string;
  icon?: string;
  color?: string;
}

export interface UpdateFuturePurchaseInput {
  id: UUID;
  name?: string;
  description?: string;
  target_amount?: number;
  urgency?: UrgencyLevel;
  target_date?: string;
  icon?: string;
  color?: string;
  status?: FuturePurchaseStatus;
  current_saved?: number;
}

export interface AllocateSavingsInput {
  id: UUID;
  amount: number;
  month?: string; // Defaults to current month
}

/**
 * Analysis result for savings recommendation
 */
export interface SavingsAnalysis {
  // Monthly savings recommendation
  recommendedMonthlySavings: number;

  // Months until target date
  monthsRemaining: number;

  // Amount still needed
  amountRemaining: number;

  // Progress percentage (0-100)
  progressPercent: number;

  // Is the goal achievable based on spending patterns?
  isAchievable: boolean;

  // Confidence level (0-100)
  confidenceLevel: number;

  // Average monthly surplus from spending analysis
  averageMonthlySurplus: number;

  // Suggested adjustments if goal is not achievable
  suggestions: string[];

  // Projected completion date based on current savings rate
  projectedCompletionDate: string | null;

  // Risk level: low, medium, high
  riskLevel: "low" | "medium" | "high";
}

/**
 * Spending pattern data for analysis
 */
export interface SpendingPattern {
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  averageMonthlySurplus: number;
  monthlyVariance: number; // How much spending varies month to month
  trend: "increasing" | "stable" | "decreasing";
  monthlyData: Array<{
    month: string;
    income: number;
    expense: number;
    surplus: number;
  }>;
}

/**
 * Icons available for future purchases
 */
export const PURCHASE_ICONS = [
  { id: "monitor", label: "Monitor", icon: "Monitor" },
  { id: "laptop", label: "Laptop", icon: "Laptop" },
  { id: "smartphone", label: "Phone", icon: "Smartphone" },
  { id: "headphones", label: "Headphones", icon: "Headphones" },
  { id: "camera", label: "Camera", icon: "Camera" },
  { id: "car", label: "Car", icon: "Car" },
  { id: "home", label: "Home", icon: "Home" },
  { id: "plane", label: "Travel", icon: "Plane" },
  { id: "gift", label: "Gift", icon: "Gift" },
  { id: "gamepad", label: "Gaming", icon: "Gamepad2" },
  { id: "watch", label: "Watch", icon: "Watch" },
  { id: "shirt", label: "Clothing", icon: "Shirt" },
  { id: "sofa", label: "Furniture", icon: "Sofa" },
  { id: "dumbbell", label: "Fitness", icon: "Dumbbell" },
  { id: "book", label: "Education", icon: "BookOpen" },
  { id: "heart", label: "Health", icon: "Heart" },
  { id: "package", label: "Other", icon: "Package" },
] as const;

export const PURCHASE_COLORS = [
  "#38bdf8", // sky
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#22c55e", // green
  "#84cc16", // lime
  "#eab308", // yellow
  "#f59e0b", // amber
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
  "#a855f7", // purple
  "#8b5cf6", // violet
  "#6366f1", // indigo
  "#3b82f6", // blue
] as const;
