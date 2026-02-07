// src/components/web/WebRecipes.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useCreateRecipe,
  useDeleteRecipe,
  useRecipe,
  useRecipes,
  useToggleFavorite,
  useUpdateRecipe,
} from "@/features/recipes/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Recipe, RecipeFilters, RecipeListItem } from "@/types/recipe";
import {
  RECIPE_CATEGORIES,
  RECIPE_CUISINES,
  RECIPE_TAGS,
} from "@/types/recipe";
import {
  ChefHat,
  Clock,
  Filter,
  Heart,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import RecipeDetailView from "./RecipeDetailView";
import RecipeDialog from "./RecipeDialog";

export default function WebRecipes() {
  const themeClasses = useThemeClasses();

  // View state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Filters
  const [filters, setFilters] = useState<RecipeFilters>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const activeFilters = useMemo(
    () => ({ ...filters, search: searchQuery || undefined }),
    [filters, searchQuery],
  );
  const { data: recipes = [], isLoading } = useRecipes(activeFilters);
  const { data: selectedRecipe, isLoading: recipeLoading } =
    useRecipe(selectedRecipeId);

  // Mutations
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const toggleFavorite = useToggleFavorite();

  // Handlers
  const handleSelectRecipe = (recipe: RecipeListItem) => {
    setSelectedRecipeId(recipe.id);
  };

  const handleBack = () => {
    setSelectedRecipeId(null);
  };

  const handleToggleFavorite = (
    recipe: RecipeListItem,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    toggleFavorite.mutate({ id: recipe.id, isFavorite: !recipe.is_favorite });
  };

  const handleDelete = (recipe: RecipeListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${recipe.name}"?`)) {
      deleteRecipe.mutate(recipe.id);
    }
  };

  const handleAddRecipe = () => {
    setEditingRecipe(null);
    setShowAddDialog(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowAddDialog(true);
  };

  const handleSaveRecipe = async (data: Partial<Recipe>) => {
    if (editingRecipe) {
      await updateRecipe.mutateAsync({ id: editingRecipe.id, ...data });
    } else {
      await createRecipe.mutateAsync(data as Recipe);
    }
    setShowAddDialog(false);
    setEditingRecipe(null);
  };

  const clearFilter = (key: keyof RecipeFilters) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // If viewing a specific recipe, show detail view
  if (selectedRecipeId && selectedRecipe) {
    return (
      <RecipeDetailView
        recipe={selectedRecipe}
        onBack={handleBack}
        onEdit={() => handleEditRecipe(selectedRecipe)}
        isLoading={recipeLoading}
      />
    );
  }

  return (
    <div className={`min-h-full ${themeClasses.pageBg}`}>
      {/* Header */}
      <div
        className={`sticky top-0 z-10 ${themeClasses.headerGradient} backdrop-blur-xl border-b ${themeClasses.border}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/20">
                <ChefHat className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Recipes</h1>
                <p className="text-sm text-white/60">
                  {recipes.length} recipes
                </p>
              </div>
            </div>
            <Button onClick={handleAddRecipe} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Recipe
            </Button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                type="text"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "pl-10",
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40",
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && "bg-primary/20 border-primary")}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Category */}
                <div>
                  <label className="text-sm text-white/60 mb-2 block">
                    Category
                  </label>
                  <select
                    value={filters.category || ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        category: e.target.value || undefined,
                      }))
                    }
                    className={cn(
                      "w-full rounded-lg px-3 py-2",
                      themeClasses.inputBg,
                      "border border-white/10 text-white",
                    )}
                  >
                    <option value="">All categories</option>
                    {RECIPE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cuisine */}
                <div>
                  <label className="text-sm text-white/60 mb-2 block">
                    Cuisine
                  </label>
                  <select
                    value={filters.cuisine || ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        cuisine: e.target.value || undefined,
                      }))
                    }
                    className={cn(
                      "w-full rounded-lg px-3 py-2",
                      themeClasses.inputBg,
                      "border border-white/10 text-white",
                    )}
                  >
                    <option value="">All cuisines</option>
                    {RECIPE_CUISINES.map((cuisine) => (
                      <option key={cuisine} value={cuisine}>
                        {cuisine}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="text-sm text-white/60 mb-2 block">
                    Difficulty
                  </label>
                  <select
                    value={filters.difficulty || ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        difficulty: e.target.value as
                          | "easy"
                          | "medium"
                          | "hard"
                          | undefined,
                      }))
                    }
                    className={cn(
                      "w-full rounded-lg px-3 py-2",
                      themeClasses.inputBg,
                      "border border-white/10 text-white",
                    )}
                  >
                    <option value="">Any difficulty</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-4">
                <label className="text-sm text-white/60 mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {RECIPE_TAGS.map((tag) => (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => {
                        const currentTags = filters.tags || [];
                        const newTags = currentTags.includes(tag.value)
                          ? currentTags.filter((t) => t !== tag.value)
                          : [...currentTags, tag.value];
                        setFilters((prev) => ({
                          ...prev,
                          tags: newTags.length > 0 ? newTags : undefined,
                        }));
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm transition-all",
                        filters.tags?.includes(tag.value)
                          ? "text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10",
                      )}
                      style={
                        filters.tags?.includes(tag.value)
                          ? { backgroundColor: tag.color }
                          : undefined
                      }
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Favorites Only */}
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="favorites-only"
                  checked={filters.favoritesOnly || false}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      favoritesOnly: e.target.checked || undefined,
                    }))
                  }
                  className="rounded"
                />
                <label
                  htmlFor="favorites-only"
                  className="text-sm text-white/80"
                >
                  Favorites only
                </label>
              </div>
            </div>
          )}

          {/* Active Filters */}
          {(filters.category ||
            filters.cuisine ||
            filters.difficulty ||
            filters.tags?.length) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {filters.category && (
                <Badge variant="secondary" className="gap-1">
                  {filters.category}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => clearFilter("category")}
                  />
                </Badge>
              )}
              {filters.cuisine && (
                <Badge variant="secondary" className="gap-1">
                  {filters.cuisine}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => clearFilter("cuisine")}
                  />
                </Badge>
              )}
              {filters.difficulty && (
                <Badge variant="secondary" className="gap-1">
                  {filters.difficulty}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => clearFilter("difficulty")}
                  />
                </Badge>
              )}
              {filters.tags?.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {RECIPE_TAGS.find((t) => t.value === tag)?.label || tag}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        tags: prev.tags?.filter((t) => t !== tag),
                      }))
                    }
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recipe Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={`h-48 ${themeClasses.surfaceBg} rounded-2xl animate-pulse`}
              />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-16">
            <ChefHat className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white/80 mb-2">
              No recipes yet
            </h3>
            <p className="text-white/60 mb-6">
              Add your first recipe to start planning meals
            </p>
            <Button onClick={handleAddRecipe} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Recipe
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => handleSelectRecipe(recipe)}
                onToggleFavorite={(e) => handleToggleFavorite(recipe, e)}
                onDelete={(e) => handleDelete(recipe, e)}
                themeClasses={themeClasses}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Recipe Dialog */}
      {showAddDialog && (
        <RecipeDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          recipe={editingRecipe}
          onSave={handleSaveRecipe}
          isLoading={createRecipe.isPending || updateRecipe.isPending}
        />
      )}
    </div>
  );
}

// Recipe Card Component
interface RecipeCardProps {
  recipe: RecipeListItem;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
}

function RecipeCard({
  recipe,
  onClick,
  onToggleFavorite,
  onDelete,
  themeClasses,
}: RecipeCardProps) {
  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02]",
        themeClasses.surfaceBg,
        "border-white/10 hover:border-white/20",
      )}
      onClick={onClick}
    >
      {/* Image or Placeholder */}
      <div className="h-32 bg-gradient-to-br from-orange-500/20 to-amber-500/20 relative">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="w-12 h-12 text-orange-400/40" />
          </div>
        )}

        {/* Favorite Button */}
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            "absolute top-2 right-2 p-2 rounded-full transition-all",
            recipe.is_favorite
              ? "bg-red-500 text-white"
              : "bg-black/40 text-white/60 hover:text-white opacity-0 group-hover:opacity-100",
          )}
        >
          <Heart
            className={cn("w-4 h-4", recipe.is_favorite && "fill-current")}
          />
        </button>

        {/* Delete Button */}
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 left-2 p-2 rounded-full bg-black/40 text-white/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-white truncate">{recipe.name}</h3>

        {/* Meta Info */}
        <div className="flex items-center gap-3 mt-2 text-sm text-white/60">
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {totalTime}m
            </span>
          )}
          {recipe.times_cooked > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {recipe.times_cooked}x
            </span>
          )}
          {recipe.average_rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              {recipe.average_rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {recipe.tags.slice(0, 3).map((tag) => {
              const tagInfo = RECIPE_TAGS.find((t) => t.value === tag);
              return (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: `${tagInfo?.color || "#3b82f6"}20`,
                    color: tagInfo?.color || "#3b82f6",
                  }}
                >
                  {tagInfo?.label || tag}
                </span>
              );
            })}
            {recipe.tags.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60">
                +{recipe.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
