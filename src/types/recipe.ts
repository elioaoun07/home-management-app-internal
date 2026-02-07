// src/types/recipe.ts

export type UUID = string;

// =============================================================================
// RECIPE TYPES
// =============================================================================

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
  optional?: boolean;
}

export interface RecipeStep {
  step: number;
  instruction: string;
  duration_minutes?: number;
  tip?: string;
}

export interface RecipeFeedback {
  date: string;
  notes: string;
  rating?: number; // 1-5
}

export type RecipeDifficulty = "easy" | "medium" | "hard";

export type RecipeTag =
  | "lent-friendly"
  | "gluten-free"
  | "high-protein"
  | "vegetarian"
  | "vegan"
  | "dairy-free"
  | "low-carb"
  | "quick"
  | "kid-friendly"
  | "spicy"
  | "comfort-food"
  | "healthy"
  | string; // Allow custom tags

export type RecipeCategory =
  | "Main Course"
  | "Side Dish"
  | "Soup"
  | "Salad"
  | "Dessert"
  | "Breakfast"
  | "Snack"
  | "Appetizer"
  | "Drink"
  | string; // Allow custom categories

export type RecipeCuisine =
  | "Lebanese"
  | "Chinese"
  | "Italian"
  | "Mexican"
  | "Indian"
  | "French"
  | "Japanese"
  | "American"
  | "Mediterranean"
  | "Thai"
  | string; // Allow custom cuisines

export interface Recipe {
  id: UUID;
  user_id: UUID;
  household_id: UUID | null;

  // Basic info
  name: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;

  // Recipe content
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];

  // Metadata
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number;
  difficulty: RecipeDifficulty;

  // Tags & Categories
  category: RecipeCategory | null;
  cuisine: RecipeCuisine | null;
  tags: RecipeTag[];

  // AI-related
  ai_generated: boolean;
  ai_generation_prompt: string | null;
  last_ai_update: string | null;

  // Feedback
  feedback: RecipeFeedback[];

  // Stats
  times_cooked: number;
  last_cooked_at: string | null;
  average_rating: number | null;

  // Status
  is_favorite: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// Recipe without content (for list views)
export type RecipeListItem = Pick<
  Recipe,
  | "id"
  | "name"
  | "description"
  | "image_url"
  | "category"
  | "cuisine"
  | "tags"
  | "prep_time_minutes"
  | "cook_time_minutes"
  | "difficulty"
  | "is_favorite"
  | "times_cooked"
  | "average_rating"
>;

// For creating/updating recipes
export type RecipeInsert = Omit<
  Recipe,
  | "id"
  | "created_at"
  | "updated_at"
  | "times_cooked"
  | "last_cooked_at"
  | "average_rating"
>;

export type RecipeUpdate = Partial<RecipeInsert>;

// =============================================================================
// MEAL PLAN TYPES
// =============================================================================

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealPlanStatus =
  | "planned"
  | "shopping_added"
  | "cooked"
  | "skipped";

export interface MealPlan {
  id: UUID;
  user_id: UUID;
  household_id: UUID;

  recipe_id: UUID;
  planned_date: string; // YYYY-MM-DD
  meal_type: MealType;

  status: MealPlanStatus;
  cooked_at: string | null;
  notes: string | null;

  shopping_thread_id: UUID | null;
  shopping_message_ids: UUID[];

  created_at: string;
  updated_at: string;
}

// Meal plan with recipe details (for display)
export interface MealPlanWithRecipe extends MealPlan {
  recipe: RecipeListItem;
}

// For creating meal plans
export type MealPlanInsert = Pick<
  MealPlan,
  "recipe_id" | "planned_date" | "meal_type"
> & {
  notes?: string | null;
};

export type MealPlanUpdate = Partial<
  Pick<MealPlan, "planned_date" | "meal_type" | "status" | "notes">
>;

// =============================================================================
// FILTER & DISPLAY TYPES
// =============================================================================

export interface RecipeFilters {
  search?: string;
  category?: RecipeCategory;
  cuisine?: RecipeCuisine;
  tags?: RecipeTag[];
  difficulty?: RecipeDifficulty;
  favoritesOnly?: boolean;
  maxPrepTime?: number;
  maxCookTime?: number;
}

// Weekly planner view data
export interface WeekDay {
  date: string; // YYYY-MM-DD
  dayName: string; // e.g., "Monday"
  isToday: boolean;
  mealPlan: MealPlanWithRecipe | null;
}

// Predefined tags with display info
export const RECIPE_TAGS: { value: RecipeTag; label: string; color: string }[] =
  [
    { value: "lent-friendly", label: "Lent Friendly", color: "#8b5cf6" },
    { value: "gluten-free", label: "Gluten Free", color: "#f59e0b" },
    { value: "high-protein", label: "High Protein", color: "#ef4444" },
    { value: "vegetarian", label: "Vegetarian", color: "#22c55e" },
    { value: "vegan", label: "Vegan", color: "#10b981" },
    { value: "dairy-free", label: "Dairy Free", color: "#06b6d4" },
    { value: "low-carb", label: "Low Carb", color: "#eab308" },
    { value: "quick", label: "Quick (<30min)", color: "#3b82f6" },
    { value: "kid-friendly", label: "Kid Friendly", color: "#ec4899" },
    { value: "spicy", label: "Spicy", color: "#f97316" },
    { value: "comfort-food", label: "Comfort Food", color: "#a855f7" },
    { value: "healthy", label: "Healthy", color: "#84cc16" },
  ];

export const RECIPE_CATEGORIES: RecipeCategory[] = [
  "Main Course",
  "Side Dish",
  "Soup",
  "Salad",
  "Dessert",
  "Breakfast",
  "Snack",
  "Appetizer",
  "Drink",
];

export const RECIPE_CUISINES: RecipeCuisine[] = [
  "Lebanese",
  "Chinese",
  "Italian",
  "Mexican",
  "Indian",
  "French",
  "Japanese",
  "American",
  "Mediterranean",
  "Thai",
];
