// src/components/web/RecipeDetailView.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGenerateRecipe } from "@/features/recipes/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/recipe";
import { RECIPE_TAGS } from "@/types/recipe";
import {
  ArrowLeft,
  Check,
  ChefHat,
  Clock,
  Edit3,
  Heart,
  Loader2,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useState } from "react";

interface RecipeDetailViewProps {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
  isLoading?: boolean;
}

export default function RecipeDetailView({
  recipe,
  onBack,
  onEdit,
  isLoading,
}: RecipeDetailViewProps) {
  const themeClasses = useThemeClasses();
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const generateRecipe = useGenerateRecipe();

  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  const toggleStep = (stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) {
        next.delete(stepNum);
      } else {
        next.add(stepNum);
      }
      return next;
    });
  };

  const hasContent = recipe.ingredients.length > 0 || recipe.steps.length > 0;

  const handleGenerateWithAI = () => {
    generateRecipe.mutate(recipe.id);
  };

  if (isLoading) {
    return (
      <div
        className={`min-h-full ${themeClasses.pageBg} flex items-center justify-center`}
      >
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-full ${themeClasses.pageBg}`}>
      {/* Header */}
      <div
        className={`sticky top-0 z-10 ${themeClasses.headerGradient} backdrop-blur-xl border-b ${themeClasses.border}`}
      >
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className={`p-2 rounded-lg ${themeClasses.bgHover} transition-colors`}
              >
                <ArrowLeft className="w-5 h-5 text-white/70" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  {recipe.name}
                </h1>
                {recipe.cuisine && (
                  <p className="text-sm text-white/60">
                    {recipe.cuisine} Cuisine
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Image / Placeholder */}
            <div className="h-64 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 relative overflow-hidden">
              {recipe.image_url ? (
                <img
                  src={recipe.image_url}
                  alt={recipe.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ChefHat className="w-24 h-24 text-orange-400/40" />
                </div>
              )}
              {recipe.is_favorite && (
                <div className="absolute top-4 right-4 p-2 rounded-full bg-red-500">
                  <Heart className="w-5 h-5 text-white fill-current" />
                </div>
              )}
            </div>

            {/* Description */}
            {recipe.description && (
              <p className="text-white/80">{recipe.description}</p>
            )}

            {/* No Content State */}
            {!hasContent && (
              <Card
                className={cn(
                  "p-8 text-center",
                  themeClasses.surfaceBg,
                  "border-white/10",
                )}
              >
                <Sparkles className="w-12 h-12 text-primary/60 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No ingredients or steps yet
                </h3>
                <p className="text-white/60 mb-6">
                  Let AI generate the full ingredients list and step-by-step
                  instructions, or add them manually.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={handleGenerateWithAI}
                    disabled={generateRecipe.isPending}
                    className="gap-2"
                  >
                    {generateRecipe.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Generate with AI
                  </Button>
                  <Button variant="outline" onClick={onEdit}>
                    Add Manually
                  </Button>
                </div>
              </Card>
            )}

            {/* Ingredients */}
            {recipe.ingredients.length > 0 && (
              <Card
                className={cn("p-6", themeClasses.surfaceBg, "border-white/10")}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-white">
                    Ingredients
                  </h2>
                  <span className="text-sm text-white/60">
                    {recipe.servings} servings
                  </span>
                </div>
                <ul className="space-y-3">
                  {recipe.ingredients.map((ing, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-3 text-white/80"
                    >
                      <div className="w-2 h-2 rounded-full bg-orange-400" />
                      <span>
                        {ing.quantity && (
                          <span className="font-medium">
                            {ing.quantity}
                            {ing.unit && ` ${ing.unit}`}{" "}
                          </span>
                        )}
                        {ing.name}
                        {ing.notes && (
                          <span className="text-white/50"> ({ing.notes})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Steps */}
            {recipe.steps.length > 0 && (
              <Card
                className={cn("p-6", themeClasses.surfaceBg, "border-white/10")}
              >
                <h2 className="text-lg font-medium text-white mb-4">
                  Instructions
                </h2>
                <div className="space-y-4">
                  {recipe.steps.map((step, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-4 p-4 rounded-xl transition-all cursor-pointer",
                        completedSteps.has(step.step)
                          ? "bg-green-500/10"
                          : "bg-white/5 hover:bg-white/10",
                      )}
                      onClick={() => toggleStep(step.step)}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all",
                          completedSteps.has(step.step)
                            ? "bg-green-500 text-white"
                            : "bg-primary/20 text-primary",
                        )}
                      >
                        {completedSteps.has(step.step) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          step.step
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={cn(
                            "text-white/80",
                            completedSteps.has(step.step) &&
                              "line-through opacity-60",
                          )}
                        >
                          {step.instruction}
                        </p>
                        {step.duration_minutes && (
                          <span className="text-sm text-white/50 flex items-center gap-1 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            {step.duration_minutes} min
                          </span>
                        )}
                        {step.tip && (
                          <p className="text-sm text-primary/80 mt-2 italic">
                            💡 {step.tip}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress */}
                {recipe.steps.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Progress</span>
                      <span className="text-white">
                        {completedSteps.size} / {recipe.steps.length} steps
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{
                          width: `${(completedSteps.size / recipe.steps.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Feedback History */}
            {recipe.feedback && recipe.feedback.length > 0 && (
              <Card
                className={cn("p-6", themeClasses.surfaceBg, "border-white/10")}
              >
                <h2 className="text-lg font-medium text-white mb-4">
                  Previous Feedback
                </h2>
                <div className="space-y-3">
                  {recipe.feedback.map((fb, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white/60">{fb.date}</span>
                        {fb.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm text-white">
                              {fb.rating}/5
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-white/80">{fb.notes}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Info Card */}
            <Card
              className={cn("p-4", themeClasses.surfaceBg, "border-white/10")}
            >
              <div className="space-y-3">
                {totalTime > 0 && (
                  <div className="flex items-center gap-3 text-white/80">
                    <Clock className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{totalTime} minutes</p>
                      <p className="text-sm text-white/50">
                        {recipe.prep_time_minutes || 0}m prep +{" "}
                        {recipe.cook_time_minutes || 0}m cook
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-white/80">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{recipe.servings} servings</p>
                  </div>
                </div>

                {recipe.times_cooked > 0 && (
                  <div className="flex items-center gap-3 text-white/80">
                    <ChefHat className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">
                        Cooked {recipe.times_cooked} times
                      </p>
                    </div>
                  </div>
                )}

                {recipe.average_rating && (
                  <div className="flex items-center gap-3 text-white/80">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <div>
                      <p className="font-medium">
                        {recipe.average_rating.toFixed(1)} rating
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Tags */}
            {recipe.tags.length > 0 && (
              <Card
                className={cn("p-4", themeClasses.surfaceBg, "border-white/10")}
              >
                <h3 className="text-sm font-medium text-white/60 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag) => {
                    const tagInfo = RECIPE_TAGS.find((t) => t.value === tag);
                    return (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{
                          backgroundColor: `${tagInfo?.color || "#3b82f6"}20`,
                          color: tagInfo?.color || "#3b82f6",
                        }}
                      >
                        {tagInfo?.label || tag}
                      </span>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Category & Cuisine */}
            {(recipe.category || recipe.cuisine) && (
              <Card
                className={cn("p-4", themeClasses.surfaceBg, "border-white/10")}
              >
                {recipe.category && (
                  <div className="mb-2">
                    <span className="text-sm text-white/60">Category: </span>
                    <span className="text-white">{recipe.category}</span>
                  </div>
                )}
                {recipe.cuisine && (
                  <div>
                    <span className="text-sm text-white/60">Cuisine: </span>
                    <span className="text-white">{recipe.cuisine}</span>
                  </div>
                )}
              </Card>
            )}

            {/* Difficulty */}
            <Card
              className={cn("p-4", themeClasses.surfaceBg, "border-white/10")}
            >
              <span className="text-sm text-white/60">Difficulty: </span>
              <Badge
                variant="secondary"
                className={cn(
                  "ml-2",
                  recipe.difficulty === "easy" &&
                    "bg-green-500/20 text-green-400",
                  recipe.difficulty === "medium" &&
                    "bg-yellow-500/20 text-yellow-400",
                  recipe.difficulty === "hard" && "bg-red-500/20 text-red-400",
                )}
              >
                {recipe.difficulty.charAt(0).toUpperCase() +
                  recipe.difficulty.slice(1)}
              </Badge>
            </Card>

            {/* Source */}
            {recipe.source_url && (
              <Card
                className={cn("p-4", themeClasses.surfaceBg, "border-white/10")}
              >
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  View Original Recipe →
                </a>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
