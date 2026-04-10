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
import {
  useCreateRecipeVersion,
  useExtractRecipeFromUrl,
  useOptimizeRecipe,
} from "@/features/recipes/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type {
  AIFieldChange,
  Recipe,
  RecipeDifficulty,
  RecipeIngredient,
  RecipeStep,
} from "@/types/recipe";
import {
  RECIPE_CATEGORIES,
  RECIPE_CUISINES,
  RECIPE_TAGS,
} from "@/types/recipe";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
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
  const extractFromUrl = useExtractRecipeFromUrl();
  const optimizeRecipe = useOptimizeRecipe();
  const createVersion = useCreateRecipeVersion();
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<{
    recipe: Partial<Recipe>;
    reasoning: string;
    changes: AIFieldChange[];
    tokensUsed: number | null;
  } | null>(null);
  const [showChanges, setShowChanges] = useState(false);

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
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => {
                    setSourceUrl(e.target.value);
                    setExtractionStatus(null);
                  }}
                  placeholder="https://... (recipe page or YouTube video)"
                  className={cn(
                    "flex-1",
                    themeClasses.inputBg,
                    "border-white/10 text-white",
                  )}
                  disabled={extractFromUrl.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!sourceUrl.trim() || extractFromUrl.isPending}
                  onClick={async () => {
                    if (!sourceUrl.trim()) return;
                    setExtractionStatus("Extracting recipe...");
                    try {
                      const result = await extractFromUrl.mutateAsync(
                        sourceUrl.trim(),
                      );
                      const r = result.recipe;
                      // Auto-fill all fields from extracted data
                      if (r.name) setName(r.name);
                      if (r.description) setDescription(r.description);
                      if (r.category) setCategory(r.category);
                      if (r.cuisine) setCuisine(r.cuisine);
                      if (r.difficulty)
                        setDifficulty(
                          r.difficulty as "easy" | "medium" | "hard",
                        );
                      if (r.prep_time_minutes) setPrepTime(r.prep_time_minutes);
                      if (r.cook_time_minutes) setCookTime(r.cook_time_minutes);
                      if (r.servings) setServings(r.servings);
                      if (r.tags?.length) setSelectedTags(r.tags);
                      if (r.ingredients?.length) setIngredients(r.ingredients);
                      if (r.steps?.length) setSteps(r.steps);
                      setExtractionStatus(
                        `Extracted from ${result.source === "youtube" ? "YouTube" : "website"}` +
                          (result.tokensUsed
                            ? ` (${result.tokensUsed} tokens)`
                            : ""),
                      );
                    } catch {
                      setExtractionStatus(null);
                    }
                  }}
                  className={cn(
                    "gap-1.5 whitespace-nowrap",
                    "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
                  )}
                >
                  {extractFromUrl.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {extractFromUrl.isPending
                    ? "Extracting..."
                    : "Extract with AI"}
                </Button>
              </div>
              {extractionStatus && (
                <p className="text-xs text-emerald-400/80 mt-1.5">
                  {extractionStatus}
                </p>
              )}
              {extractFromUrl.isError && (
                <p className="text-xs text-red-400/80 mt-1.5">
                  {extractFromUrl.error?.message || "Extraction failed"}
                </p>
              )}
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
                type="text"
                inputMode="numeric"
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
                type="text"
                inputMode="numeric"
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
                type="text"
                inputMode="numeric"
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
                    value={ing.quantity ?? ""}
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
                    value={ing.unit ?? ""}
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
                    value={ing.name ?? ""}
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
                    value={step.instruction ?? ""}
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

          {/* AI Optimization Preview */}
          {aiPreview && (
            <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="font-medium text-white text-sm">
                  AI Suggestions
                </h3>
                {aiPreview.tokensUsed && (
                  <span className="text-xs text-white/30 ml-auto">
                    {aiPreview.tokensUsed} tokens
                  </span>
                )}
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                {aiPreview.reasoning}
              </p>
              {aiPreview.changes.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowChanges(!showChanges)}
                    className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white/80"
                  >
                    {showChanges ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {aiPreview.changes.length} changes
                  </button>
                  {showChanges && (
                    <div className="space-y-1 mt-2">
                      {aiPreview.changes.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-1.5 rounded text-xs bg-white/5"
                        >
                          <ArrowRight className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-white/50">{c.field}: </span>
                            {c.from != null && (
                              <>
                                <span className="text-red-400/60 line-through">
                                  {String(c.from)}
                                </span>
                                <span className="text-white/30 mx-1">→</span>
                              </>
                            )}
                            <span className="text-emerald-400">
                              {String(c.to)}
                            </span>
                            <p className="text-white/40 mt-0.5">{c.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const r = aiPreview.recipe;
                    if (r.name) setName(r.name);
                    if (r.description) setDescription(r.description);
                    if (r.category) setCategory(r.category);
                    if (r.cuisine) setCuisine(r.cuisine);
                    if (r.difficulty)
                      setDifficulty(r.difficulty as "easy" | "medium" | "hard");
                    if (r.prep_time_minutes != null)
                      setPrepTime(r.prep_time_minutes);
                    if (r.cook_time_minutes != null)
                      setCookTime(r.cook_time_minutes);
                    if (r.servings) setServings(r.servings);
                    if (r.tags) setSelectedTags(r.tags as string[]);
                    if (r.ingredients) setIngredients(r.ingredients);
                    if (r.steps) setSteps(r.steps);
                    setAiPreview(null);
                  }}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  Apply Changes
                </Button>
                {isEditing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const r = aiPreview.recipe;
                      createVersion.mutate({
                        recipeId: recipe!.id,
                        version_label: "AI Optimized",
                        source: "ai_optimize",
                        is_active: false,
                        ingredients: (r.ingredients ||
                          []) as RecipeIngredient[],
                        steps: (r.steps || []) as RecipeStep[],
                        prep_time_minutes:
                          (r.prep_time_minutes as number) ?? null,
                        cook_time_minutes:
                          (r.cook_time_minutes as number) ?? null,
                        servings: r.servings ?? 4,
                        difficulty: ((r.difficulty as string) ||
                          "medium") as RecipeDifficulty,
                        category: (r.category as string) ?? null,
                        cuisine: (r.cuisine as string) ?? null,
                        tags: (r.tags || []) as string[],
                        description: (r.description as string) ?? null,
                        ai_reasoning: aiPreview.reasoning,
                        tokens_used: aiPreview.tokensUsed ?? null,
                        ai_prompt: null,
                      });
                      setAiPreview(null);
                    }}
                    className="gap-1.5 border-white/20 text-white/70"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    Save as Version
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAiPreview(null)}
                  className="text-white/40 ml-auto"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

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
            {/* AI Optimize button */}
            <Button
              type="button"
              variant="outline"
              disabled={!name.trim() || optimizeRecipe.isPending}
              onClick={async () => {
                // Build current form state as userInput
                const userInput = {
                  name: name.trim(),
                  description: description.trim() || undefined,
                  category: category || undefined,
                  cuisine: cuisine || undefined,
                  difficulty,
                  prep_time_minutes: prepTime || null,
                  cook_time_minutes: cookTime || null,
                  servings,
                  tags: selectedTags,
                  ingredients,
                  steps,
                };
                try {
                  const result = await optimizeRecipe.mutateAsync({
                    id: recipe?.id || "new",
                    userInput,
                  });
                  setAiPreview({
                    recipe: result.recipe,
                    reasoning: result.reasoning,
                    changes: result.changes,
                    tokensUsed: result.tokensUsed,
                  });
                } catch {
                  // handled by hook
                }
              }}
              className={cn(
                "gap-1.5",
                "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
              )}
            >
              {optimizeRecipe.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {optimizeRecipe.isPending ? "Optimizing..." : "Optimize with AI"}
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
