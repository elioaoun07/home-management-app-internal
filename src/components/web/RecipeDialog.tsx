// src/components/web/RecipeDialog.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Recipe, RecipeIngredient, RecipeStep } from "@/types/recipe";
import {
  RECIPE_CATEGORIES,
  RECIPE_CUISINES,
  RECIPE_TAGS,
} from "@/types/recipe";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

interface RecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null; // null for new recipe
  onSave: (data: Partial<Recipe>) => Promise<void>;
  isLoading: boolean;
}

export default function RecipeDialog({
  open,
  onOpenChange,
  recipe,
  onSave,
  isLoading,
}: RecipeDialogProps) {
  const themeClasses = useThemeClasses();
  const isEditing = !!recipe;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [prepTime, setPrepTime] = useState<number | "">("");
  const [cookTime, setCookTime] = useState<number | "">("");
  const [servings, setServings] = useState(4);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([]);

  // Initialize form when recipe changes
  useEffect(() => {
    if (recipe) {
      setName(recipe.name);
      setDescription(recipe.description || "");
      setSourceUrl(recipe.source_url || "");
      setCategory(recipe.category || "");
      setCuisine(recipe.cuisine || "");
      setDifficulty(recipe.difficulty);
      setPrepTime(recipe.prep_time_minutes || "");
      setCookTime(recipe.cook_time_minutes || "");
      setServings(recipe.servings);
      setSelectedTags(recipe.tags);
      setIngredients(recipe.ingredients);
      setSteps(recipe.steps);
    } else {
      // Reset for new recipe
      setName("");
      setDescription("");
      setSourceUrl("");
      setCategory("");
      setCuisine("");
      setDifficulty("medium");
      setPrepTime("");
      setCookTime("");
      setServings(4);
      setSelectedTags([]);
      setIngredients([]);
      setSteps([]);
    }
  }, [recipe, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      source_url: sourceUrl.trim() || null,
      category: category || null,
      cuisine: cuisine || null,
      difficulty,
      prep_time_minutes: prepTime || null,
      cook_time_minutes: cookTime || null,
      servings,
      tags: selectedTags,
      ingredients,
      steps,
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      { name: "", quantity: "", unit: "", notes: "" },
    ]);
  };

  const updateIngredient = (
    index: number,
    updates: Partial<RecipeIngredient>,
  ) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, ...updates } : ing)),
    );
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { step: prev.length + 1, instruction: "", duration_minutes: undefined },
    ]);
  };

  const updateStep = (index: number, updates: Partial<RecipeStep>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    );
  };

  const removeStep = (index: number) => {
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step: i + 1 })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[90vh] overflow-y-auto",
          themeClasses.surfaceBg,
          "border-white/10",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEditing ? "Edit Recipe" : "Add Recipe"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Orange Chicken"
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
                required
              />
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of the dish..."
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Source URL
              </label>
              <Input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
            </div>
          </div>

          {/* Category, Cuisine, Difficulty */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={cn(
                  "w-full rounded-lg px-3 py-2",
                  themeClasses.inputBg,
                  "border border-white/10 text-white",
                )}
              >
                <option value="">Select...</option>
                {RECIPE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Cuisine
              </label>
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className={cn(
                  "w-full rounded-lg px-3 py-2",
                  themeClasses.inputBg,
                  "border border-white/10 text-white",
                )}
              >
                <option value="">Select...</option>
                {RECIPE_CUISINES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as "easy" | "medium" | "hard")
                }
                className={cn(
                  "w-full rounded-lg px-3 py-2",
                  themeClasses.inputBg,
                  "border border-white/10 text-white",
                )}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Time & Servings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Prep Time (min)
              </label>
              <Input
                type="number"
                min={0}
                value={prepTime}
                onChange={(e) =>
                  setPrepTime(e.target.value ? parseInt(e.target.value) : "")
                }
                placeholder="15"
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Cook Time (min)
              </label>
              <Input
                type="number"
                min={0}
                value={cookTime}
                onChange={(e) =>
                  setCookTime(e.target.value ? parseInt(e.target.value) : "")
                }
                placeholder="30"
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">
                Servings
              </label>
              <Input
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(parseInt(e.target.value) || 4)}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-2">
              {RECIPE_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => toggleTag(tag.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-all",
                    selectedTags.includes(tag.value)
                      ? "text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10",
                  )}
                  style={
                    selectedTags.includes(tag.value)
                      ? { backgroundColor: tag.color }
                      : undefined
                  }
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-white/60">Ingredients</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addIngredient}
                className="gap-1 text-primary"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
            <p className="text-xs text-white/40 mb-3">
              Leave empty to let AI generate when you cook this recipe
            </p>
            <div className="space-y-2">
              {ingredients.map((ing, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={ing.quantity}
                    onChange={(e) =>
                      updateIngredient(index, { quantity: e.target.value })
                    }
                    placeholder="500"
                    className={cn(
                      "w-20",
                      themeClasses.inputBg,
                      "border-white/10 text-white",
                    )}
                  />
                  <Input
                    value={ing.unit}
                    onChange={(e) =>
                      updateIngredient(index, { unit: e.target.value })
                    }
                    placeholder="g"
                    className={cn(
                      "w-16",
                      themeClasses.inputBg,
                      "border-white/10 text-white",
                    )}
                  />
                  <Input
                    value={ing.name}
                    onChange={(e) =>
                      updateIngredient(index, { name: e.target.value })
                    }
                    placeholder="Ingredient name"
                    className={cn(
                      "flex-1",
                      themeClasses.inputBg,
                      "border-white/10 text-white",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="p-2 text-white/40 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-white/60">Steps</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addStep}
                className="gap-1 text-primary"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
            <p className="text-xs text-white/40 mb-3">
              Leave empty to let AI generate when you cook this recipe
            </p>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center mt-2">
                    {step.step}
                  </span>
                  <Textarea
                    value={step.instruction}
                    onChange={(e) =>
                      updateStep(index, { instruction: e.target.value })
                    }
                    placeholder="Describe this step..."
                    className={cn(
                      "flex-1",
                      themeClasses.inputBg,
                      "border-white/10 text-white",
                    )}
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="p-2 text-white/40 hover:text-red-400 mt-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Recipe"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
