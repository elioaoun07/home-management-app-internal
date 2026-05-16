"use client";

import { useRecipes } from "@/features/recipes/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { RecipeListItem } from "@/types/recipe";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChefHat, Clock, GripVertical, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";

// ─── Draggable card ────────────────────────────────────────────────────────────

function DraggableRecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: recipe.id, data: { recipe } });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="neo-card p-2.5 rounded-xl cursor-grab active:cursor-grabbing mb-2 hover:scale-[1.02] transition-transform select-none"
    >
      <div className="flex items-center gap-2">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-5 h-5 text-amber-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate leading-tight">
            {recipe.name}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
            {recipe.category && (
              <span className="truncate max-w-[80px]">{recipe.category}</span>
            )}
            {recipe.prep_time_minutes && (
              <span className="flex items-center gap-0.5 flex-shrink-0">
                <Clock className="w-2.5 h-2.5" />
                {recipe.prep_time_minutes}m
              </span>
            )}
            {recipe.is_favorite && (
              <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
            )}
          </div>
        </div>
        <GripVertical className="w-4 h-4 text-white/20 flex-shrink-0" />
      </div>
    </div>
  );
}

// ─── Drag overlay ghost ────────────────────────────────────────────────────────

export function RecipeDragOverlay({ recipe }: { recipe: RecipeListItem }) {
  return (
    <div className="neo-card p-2.5 rounded-xl w-52 rotate-2 shadow-2xl opacity-90 pointer-events-none">
      <div className="flex items-center gap-2">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt=""
            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-4 h-4 text-amber-400" />
          </div>
        )}
        <span className="text-sm font-medium truncate">{recipe.name}</span>
      </div>
    </div>
  );
}

// ─── Category filter pills ─────────────────────────────────────────────────────

const QUICK_CATEGORIES = ["Breakfast", "Main Course", "Soup", "Salad", "Dessert"];

// ─── Main panel ────────────────────────────────────────────────────────────────

export default function RecipeSidePanel() {
  const themeClasses = useThemeClasses();
  const { theme } = useTheme();
  const isFrost = theme === "frost" || theme === "calm";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const { data: recipes = [], isLoading } = useRecipes();

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (favoritesOnly && !r.is_favorite) return false;
      if (categoryFilter && r.category !== categoryFilter) return false;
      return true;
    });
  }, [recipes, search, favoritesOnly, categoryFilter]);

  return (
    <div
      className={cn(
        "w-64 flex-shrink-0 border-r flex flex-col h-full overflow-hidden",
        isFrost ? "bg-gray-50 border-gray-200" : `${themeClasses.surfaceBg} border-white/10`,
      )}
    >
      {/* Header + search */}
      <div
        className={cn(
          "p-3 border-b flex-shrink-0",
          isFrost ? "border-gray-200" : "border-white/10",
        )}
      >
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wider mb-2",
            isFrost ? "text-gray-500" : "text-white/50",
          )}
        >
          Recipes — drag to calendar
        </p>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border focus:outline-none",
              isFrost
                ? "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400"
                : "bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-amber-400/50",
            )}
          />
        </div>
        <button
          onClick={() => setFavoritesOnly((f) => !f)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors",
            favoritesOnly
              ? "bg-amber-500/20 text-amber-400"
              : isFrost
                ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                : "bg-white/5 text-white/50 hover:bg-white/10",
          )}
        >
          <Star className="w-3 h-3" />
          Favorites only
        </button>
      </div>

      {/* Category pills */}
      <div
        className={cn(
          "px-3 py-2 flex gap-1.5 flex-wrap border-b flex-shrink-0",
          isFrost ? "border-gray-200" : "border-white/10",
        )}
      >
        {QUICK_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[11px] transition-colors",
              categoryFilter === cat
                ? "bg-amber-500/30 text-amber-300"
                : isFrost
                  ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  : "bg-white/5 text-white/40 hover:bg-white/10",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Recipe list */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-14 rounded-xl animate-pulse",
                  isFrost ? "bg-gray-200" : "bg-white/5",
                )}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className={cn(
              "text-center text-sm py-8",
              isFrost ? "text-gray-400" : "text-white/30",
            )}
          >
            No recipes found.
            <br />
            <span className="text-xs opacity-70">
              Add recipes in the Recipes tab.
            </span>
          </div>
        ) : (
          filtered.map((recipe) => (
            <DraggableRecipeCard key={recipe.id} recipe={recipe} />
          ))
        )}
      </div>
    </div>
  );
}
