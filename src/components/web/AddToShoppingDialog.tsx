// src/components/web/AddToShoppingDialog.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HubChatThread, useHubThreads } from "@/features/hub/hooks";
import {
  useAddIngredientsToShopping,
  useRecipe,
} from "@/features/recipes/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { MealPlanWithRecipe, RecipeIngredient } from "@/types/recipe";
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Loader2,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

interface AddToShoppingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealPlan: MealPlanWithRecipe;
}

export default function AddToShoppingDialog({
  open,
  onOpenChange,
  mealPlan,
}: AddToShoppingDialogProps) {
  const themeClasses = useThemeClasses();

  // Fetch full recipe details (with ingredients)
  const { data: recipe, isLoading: recipeLoading } = useRecipe(
    mealPlan.recipe_id,
  );

  // Get shopping thread
  const { data: hubData } = useHubThreads();
  const shoppingThread = useMemo(
    () =>
      hubData?.threads?.find((t: HubChatThread) => t.purpose === "shopping"),
    [hubData],
  );

  // Mutation
  const addToShopping = useAddIngredientsToShopping();

  // State for selected ingredients
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [selectAll, setSelectAll] = useState(false);

  // Initialize selection when recipe loads
  useMemo(() => {
    if (recipe?.ingredients.length) {
      setSelectedIndices(new Set(recipe.ingredients.map((_, i) => i)));
      setSelectAll(true);
    }
  }, [recipe?.ingredients.length]);

  const ingredients = recipe?.ingredients || [];
  const hasIngredients = ingredients.length > 0;
  const alreadyAdded = mealPlan.status === "shopping_added";

  const toggleIngredient = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(ingredients.map((_, i) => i)));
    }
    setSelectAll(!selectAll);
  };

  const handleAddToShopping = async () => {
    if (!shoppingThread || selectedIndices.size === 0) return;

    await addToShopping.mutateAsync({
      mealPlanId: mealPlan.id,
      ingredientIndices: Array.from(selectedIndices),
      threadId: shoppingThread.id,
    });

    onOpenChange(false);
  };

  const formatIngredient = (ing: RecipeIngredient) => {
    const parts = [];
    if (ing.quantity) {
      parts.push(ing.quantity);
      if (ing.unit) parts.push(ing.unit);
    }
    parts.push(ing.name);
    return parts.join(" ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-lg max-h-[80vh] overflow-hidden flex flex-col",
          themeClasses.surfaceBg,
          "border-white/10",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-400" />
            Add to Shopping List
          </DialogTitle>
        </DialogHeader>

        {/* Recipe Info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <p className="font-medium text-white">{mealPlan.recipe.name}</p>
            <p className="text-sm text-white/60">
              {new Date(mealPlan.planned_date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Already Added State */}
        {alreadyAdded && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <p className="text-green-400 font-medium">
                Already in Shopping List
              </p>
              <p className="text-sm text-green-400/70">
                Ingredients were added on{" "}
                {new Date(mealPlan.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {recipeLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {/* No Ingredients State */}
        {!recipeLoading && !hasIngredients && (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-primary/40 mx-auto mb-3" />
            <h3 className="text-white font-medium mb-2">No ingredients yet</h3>
            <p className="text-white/60 text-sm mb-4">
              This recipe doesn&apos;t have ingredients. Edit the recipe to add
              them manually, or let AI generate them when you cook.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}

        {/* No Shopping Thread */}
        {!shoppingThread && hasIngredients && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium">
                No Shopping List Found
              </p>
              <p className="text-sm text-yellow-400/70">
                Create a shopping thread in your Hub to add ingredients
              </p>
            </div>
          </div>
        )}

        {/* Ingredients List */}
        {!recipeLoading && hasIngredients && !alreadyAdded && (
          <>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-white/60">
                {selectedIndices.size} of {ingredients.length} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-primary"
              >
                {selectAll ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[40vh]">
              {ingredients.map((ing, index) => (
                <label
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                    selectedIndices.has(index)
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-white/5 border border-white/10 hover:bg-white/10",
                  )}
                >
                  <Checkbox
                    checked={selectedIndices.has(index)}
                    onCheckedChange={() => toggleIngredient(index)}
                    className="shrink-0"
                  />
                  <span className="text-white flex-1">
                    {formatIngredient(ing)}
                  </span>
                  {ing.notes && (
                    <span className="text-sm text-white/50">({ing.notes})</span>
                  )}
                  {ing.optional && (
                    <span className="text-xs text-white/40 px-2 py-0.5 rounded bg-white/10">
                      optional
                    </span>
                  )}
                </label>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={addToShopping.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddToShopping}
                disabled={
                  selectedIndices.size === 0 ||
                  !shoppingThread ||
                  addToShopping.isPending
                }
                className="gap-2"
              >
                {addToShopping.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <ShoppingCart className="w-4 h-4" />
                Add {selectedIndices.size} Items
              </Button>
            </div>
          </>
        )}

        {/* Close button for already added state */}
        {alreadyAdded && (
          <div className="flex justify-end pt-4 border-t border-white/10">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
