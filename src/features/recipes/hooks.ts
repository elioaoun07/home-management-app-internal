// src/features/recipes/hooks.ts
"use client";

import type {
  AIRecipeOptimization,
  AIServingScale,
  AISubstitution,
  CookingLog,
  CookingLogInsert,
  MealPlan,
  MealPlanInsert,
  MealPlanUpdate,
  MealPlanWithRecipe,
  Recipe,
  RecipeFilters,
  RecipeIngredient,
  RecipeInsert,
  RecipeListItem,
  RecipeUpdate,
  RecipeVersion,
  RecipeVersionInsert,
} from "@/types/recipe";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// =============================================================================
// QUERY KEYS
// =============================================================================

export const recipeKeys = {
  all: ["recipes"] as const,
  lists: () => [...recipeKeys.all, "list"] as const,
  list: (filters?: RecipeFilters) => [...recipeKeys.lists(), filters] as const,
  details: () => [...recipeKeys.all, "detail"] as const,
  detail: (id: string) => [...recipeKeys.details(), id] as const,
  favorites: () => [...recipeKeys.all, "favorites"] as const,
  versions: (recipeId: string) =>
    [...recipeKeys.all, "versions", recipeId] as const,
  cookingLogs: (recipeId: string) =>
    [...recipeKeys.all, "cooking-logs", recipeId] as const,
};

export const mealPlanKeys = {
  all: ["meal-plans"] as const,
  byWeek: (startDate: string) =>
    [...mealPlanKeys.all, "week", startDate] as const,
  byDate: (date: string) => [...mealPlanKeys.all, "date", date] as const,
  byDateRange: (start: string, end: string) =>
    [...mealPlanKeys.all, "range", start, end] as const,
};

// =============================================================================
// API FUNCTIONS - RECIPES
// =============================================================================

async function fetchRecipes(
  filters?: RecipeFilters,
): Promise<RecipeListItem[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.cuisine) params.set("cuisine", filters.cuisine);
  if (filters?.tags?.length) params.set("tags", filters.tags.join(","));
  if (filters?.difficulty) params.set("difficulty", filters.difficulty);
  if (filters?.favoritesOnly) params.set("favorites", "true");
  if (filters?.maxPrepTime)
    params.set("maxPrepTime", filters.maxPrepTime.toString());
  if (filters?.maxCookTime)
    params.set("maxCookTime", filters.maxCookTime.toString());

  const url = `/api/recipes${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchRecipe(id: string): Promise<Recipe> {
  const res = await fetch(`/api/recipes/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createRecipe(input: RecipeInsert): Promise<Recipe> {
  const res = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create recipe");
  }
  return res.json();
}

async function updateRecipe(id: string, input: RecipeUpdate): Promise<Recipe> {
  const res = await fetch(`/api/recipes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to update recipe");
  }
  return res.json();
}

async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to delete recipe");
  }
}

async function toggleFavorite(
  id: string,
  isFavorite: boolean,
): Promise<Recipe> {
  return updateRecipe(id, { is_favorite: isFavorite });
}

async function generateRecipeWithAI(id: string): Promise<Recipe> {
  const res = await fetch(`/api/recipes/${id}/generate`, {
    method: "POST",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to generate recipe");
  }
  return res.json();
}

// =============================================================================
// API FUNCTIONS - MEAL PLANS
// =============================================================================

async function fetchMealPlansByDateRange(
  startDate: string,
  endDate: string,
): Promise<MealPlanWithRecipe[]> {
  const res = await fetch(`/api/meal-plans?start=${startDate}&end=${endDate}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchMealPlansByDate(
  date: string,
): Promise<MealPlanWithRecipe[]> {
  const res = await fetch(`/api/meal-plans?date=${date}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createMealPlan(input: MealPlanInsert): Promise<MealPlan> {
  const res = await fetch("/api/meal-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create meal plan");
  }
  return res.json();
}

async function updateMealPlan(
  id: string,
  input: MealPlanUpdate,
): Promise<MealPlan> {
  const res = await fetch(`/api/meal-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to update meal plan");
  }
  return res.json();
}

async function deleteMealPlan(id: string): Promise<void> {
  const res = await fetch(`/api/meal-plans/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to delete meal plan");
  }
}

// Add recipe ingredients to shopping list
async function addIngredientsToShopping(input: {
  mealPlanId: string;
  ingredientIndices: number[]; // Which ingredients to add
  threadId: string;
}): Promise<{ added: number; messageIds: string[] }> {
  const res = await fetch("/api/meal-plans/add-to-shopping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to add ingredients to shopping");
  }
  return res.json();
}

// =============================================================================
// RECIPE HOOKS
// =============================================================================

export function useRecipes(filters?: RecipeFilters) {
  return useQuery({
    queryKey: recipeKeys.list(filters),
    queryFn: () => fetchRecipes(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRecipe(id: string | null) {
  return useQuery({
    queryKey: recipeKeys.detail(id || ""),
    queryFn: () => fetchRecipe(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      toast.success("Recipe created!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: RecipeUpdate & { id: string }) =>
      updateRecipe(id, data),
    onSuccess: (recipe) => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
      toast.success("Recipe updated!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      toast.success("Recipe deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      toggleFavorite(id, isFavorite),
    onSuccess: (recipe) => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =============================================================================
// MEAL PLAN HOOKS
// =============================================================================

export function useMealPlansForWeek(startDate: string) {
  // Calculate end date (7 days later)
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const end = endDate.toISOString().split("T")[0];

  return useQuery({
    queryKey: mealPlanKeys.byWeek(startDate),
    queryFn: () => fetchMealPlansByDateRange(startDate, end),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useMealPlansForDate(date: string) {
  return useQuery({
    queryKey: mealPlanKeys.byDate(date),
    queryFn: () => fetchMealPlansByDate(date),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMealPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealPlanKeys.all });
      toast.success("Meal planned!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: MealPlanUpdate & { id: string }) =>
      updateMealPlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealPlanKeys.all });
      toast.success("Meal plan updated!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMealPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealPlanKeys.all });
      toast.success("Meal removed from plan");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddIngredientsToShopping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addIngredientsToShopping,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: mealPlanKeys.all });
      queryClient.invalidateQueries({ queryKey: ["hub"] });
      toast.success(`${data.added} ingredients added to shopping list`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useGenerateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateRecipeWithAI,
    // IMPORTANT: Disable retries for AI calls to prevent rate limit cascades
    retry: false,
    onSuccess: (recipe) => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
      toast.success("Recipe generated with AI!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =============================================================================
// AI COLLABORATION API FUNCTIONS
// =============================================================================

async function optimizeRecipe(
  id: string,
  userInput?: Partial<Recipe>,
): Promise<AIRecipeOptimization & { tokensUsed: number | null }> {
  const res = await fetch(`/api/recipes/${id}/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userInput }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to optimize recipe");
  }
  return res.json();
}

async function scaleRecipe(
  id: string,
  targetServings: number,
  currentServings?: number,
  ingredients?: RecipeIngredient[],
): Promise<AIServingScale & { tokensUsed: number | null }> {
  const res = await fetch(`/api/recipes/${id}/scale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetServings, currentServings, ingredients }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to scale recipe");
  }
  return res.json();
}

async function substituteIngredient(
  recipeId: string,
  ingredient: string,
  question?: string,
  recipeName?: string,
  allIngredients?: string[],
): Promise<AISubstitution & { answer?: string; tokensUsed: number | null }> {
  const res = await fetch(`/api/recipes/${recipeId}/substitute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredient, question, recipeName, allIngredients }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to get substitution");
  }
  return res.json();
}

// =============================================================================
// RECIPE VERSION API FUNCTIONS
// =============================================================================

async function fetchRecipeVersions(recipeId: string): Promise<RecipeVersion[]> {
  const res = await fetch(`/api/recipes/${recipeId}/versions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createRecipeVersion(
  recipeId: string,
  data: Omit<RecipeVersionInsert, "recipe_id" | "user_id">,
): Promise<RecipeVersion> {
  const res = await fetch(`/api/recipes/${recipeId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create version");
  }
  return res.json();
}

// =============================================================================
// COOKING LOG API FUNCTIONS
// =============================================================================

async function fetchCookingLogs(recipeId: string): Promise<CookingLog[]> {
  const res = await fetch(`/api/recipes/${recipeId}/cooking-log`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createCookingLog(
  recipeId: string,
  data: Omit<CookingLogInsert, "recipe_id" | "user_id" | "cooked_at">,
): Promise<CookingLog> {
  const res = await fetch(`/api/recipes/${recipeId}/cooking-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to save cooking log");
  }
  return res.json();
}

// =============================================================================
// AI COLLABORATION HOOKS
// =============================================================================

export function useOptimizeRecipe() {
  return useMutation({
    mutationFn: ({
      id,
      userInput,
    }: {
      id: string;
      userInput?: Partial<Recipe>;
    }) => optimizeRecipe(id, userInput),
    retry: false,
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useScaleRecipe() {
  return useMutation({
    mutationFn: ({
      id,
      targetServings,
      currentServings,
      ingredients,
    }: {
      id: string;
      targetServings: number;
      currentServings?: number;
      ingredients?: RecipeIngredient[];
    }) => scaleRecipe(id, targetServings, currentServings, ingredients),
    retry: false,
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useSubstituteIngredient() {
  return useMutation({
    mutationFn: ({
      recipeId,
      ingredient,
      question,
      recipeName,
      allIngredients,
    }: {
      recipeId: string;
      ingredient: string;
      question?: string;
      recipeName?: string;
      allIngredients?: string[];
    }) =>
      substituteIngredient(
        recipeId,
        ingredient,
        question,
        recipeName,
        allIngredients,
      ),
    retry: false,
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =============================================================================
// RECIPE VERSION HOOKS
// =============================================================================

export function useRecipeVersions(recipeId: string | null) {
  return useQuery({
    queryKey: recipeKeys.versions(recipeId || ""),
    queryFn: () => fetchRecipeVersions(recipeId!),
    enabled: !!recipeId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRecipeVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      ...data
    }: Omit<RecipeVersionInsert, "recipe_id" | "user_id"> & {
      recipeId: string;
    }) => createRecipeVersion(recipeId, data),
    onSuccess: (version) => {
      queryClient.invalidateQueries({
        queryKey: recipeKeys.versions(version.recipe_id),
      });
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      toast.success(`Version "${version.version_label}" saved!`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =============================================================================
// COOKING LOG HOOKS
// =============================================================================

export function useCookingLogs(recipeId: string | null) {
  return useQuery({
    queryKey: recipeKeys.cookingLogs(recipeId || ""),
    queryFn: () => fetchCookingLogs(recipeId!),
    enabled: !!recipeId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCookingLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      ...data
    }: Omit<CookingLogInsert, "recipe_id" | "user_id" | "cooked_at"> & {
      recipeId: string;
    }) => createCookingLog(recipeId, data),
    onSuccess: (_log, variables) => {
      queryClient.invalidateQueries({
        queryKey: recipeKeys.cookingLogs(variables.recipeId),
      });
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      toast.success("Cooking feedback saved!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =============================================================================
// URL EXTRACTION
// =============================================================================

interface ExtractedRecipeData {
  name: string;
  description?: string;
  category?: string;
  cuisine?: string;
  difficulty?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings?: number;
  tags?: string[];
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
    notes?: string;
  }>;
  steps: Array<{
    step: number;
    instruction: string;
    duration_minutes?: number;
    tip?: string;
  }>;
}

interface ExtractFromUrlResponse {
  recipe: ExtractedRecipeData;
  source: "youtube" | "website";
  tokensUsed: number | null;
}

async function extractRecipeFromUrl(
  url: string,
): Promise<ExtractFromUrlResponse> {
  const res = await fetch("/api/recipes/extract-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to extract recipe from URL");
  }
  return res.json();
}

export function useExtractRecipeFromUrl() {
  return useMutation({
    mutationFn: extractRecipeFromUrl,
    retry: false, // Never retry AI calls
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
