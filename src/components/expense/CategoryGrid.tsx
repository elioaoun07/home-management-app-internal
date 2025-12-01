"use client";

import { PencilIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { useState } from "react";
import AddCategoryDialog from "./AddCategoryDialog";
import CategoryManagerDialog from "./CategoryManagerDialog";

type Props = {
  accountId?: string;
  selectedCategoryId?: string;
  onCategorySelect?: (categoryId: string) => void;
};

export default function CategoryGrid({
  accountId,
  selectedCategoryId,
  onCategorySelect,
}: Props) {
  const themeClasses = useThemeClasses();
  const {
    data: categories = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useCategories(accountId);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  if (!accountId) {
    return (
      <div className="space-y-3">
        <Label>Category</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            type="button"
            className="justify-start opacity-50"
            disabled
          >
            Select an account first
          </Button>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <Label>Category</Label>
        <div className="text-sm text-red-500">
          Error loading categories:{" "}
          {error instanceof Error ? error.message : "Unknown"}
          <button
            type="button"
            className="underline ml-2"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Support both DB categories (with parent_id) and default categories (with subcategories)
  const roots = Array.isArray(categories)
    ? categories.filter((c) => !("parent_id" in c) || !c.parent_id)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Category</Label>
        {accountId && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            onClick={() => setManageOpen(true)}
            aria-label="Manage categories"
            title="Manage categories"
          >
            <PencilIcon className="h-4 w-4 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
            <span>Manage</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Button
                key={i}
                variant="outline"
                type="button"
                className="justify-start h-14 opacity-50 animate-pulse"
                disabled
              >
                Loading...
              </Button>
            ))
          : roots.map((cat) => {
              const active = selectedCategoryId === cat.id;
              const categoryColor = cat.color || "#38bdf8";
              return (
                <Button
                  key={cat.id}
                  variant="outline"
                  type="button"
                  className={`justify-start gap-2 h-14 text-left transition-all hover:scale-105 relative overflow-hidden`}
                  onClick={() => onCategorySelect?.(cat.id)}
                  style={{
                    backgroundColor: active
                      ? `${categoryColor}25`
                      : "transparent",
                    borderColor: categoryColor,
                    color: active ? categoryColor : "inherit",
                    boxShadow: active
                      ? `inset 0 0 0 2px ${categoryColor}, 0 0 20px ${categoryColor}40`
                      : `inset 0 0 0 1px ${categoryColor}40`,
                    backgroundImage: "none",
                  }}
                >
                  {/* Color indicator bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: categoryColor }}
                  />
                  {(() => {
                    const Icon = getCategoryIcon(cat.name);
                    return (
                      <span style={{ color: categoryColor }}>
                        <Icon className="w-5 h-5 ml-1" />
                      </span>
                    );
                  })()}
                  <span
                    className="font-medium"
                    style={{ color: active ? categoryColor : undefined }}
                  >
                    {cat.name}
                  </span>
                </Button>
              );
            })}

        <Button
          variant="outline"
          type="button"
          className={`justify-start h-14 transition-all hover:scale-105 ${themeClasses.buttonOutline}`}
          onClick={() => setAddDialogOpen(true)}
        >
          <span className="text-xl mr-2">+</span>
          <span className="font-medium">Add Category</span>
        </Button>
        <AddCategoryDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          accountId={accountId}
          onSuccess={() => {
            setAddDialogOpen(false);
            refetch();
          }}
        />
        <CategoryManagerDialog
          open={manageOpen}
          onOpenChange={(o) => {
            setManageOpen(o);
          }}
          accountId={accountId}
          onChange={() => {
            refetch();
          }}
        />
      </div>
    </div>
  );
}
