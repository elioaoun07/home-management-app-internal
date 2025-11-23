"use client";

import { PencilIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/features/categories/useCategoriesQuery";
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
              return (
                <Button
                  key={cat.id}
                  variant={active ? "default" : "outline"}
                  type="button"
                  className={`justify-start gap-2 h-14 text-left transition-all hover:scale-105 ${
                    active
                      ? "shadow-[0_0_0_2px_rgba(6,182,212,0.8)_inset,0_0_25px_rgba(6,182,212,0.4)] bg-[#06b6d4]/20"
                      : "hover:shadow-[0_0_0_2px_rgba(6,182,212,0.4)_inset] shadow-[0_0_0_1px_rgba(6,182,212,0.2)_inset]"
                  }`}
                  onClick={() => onCategorySelect?.(cat.id)}
                  style={{
                    backgroundColor: active
                      ? (cat.color ?? undefined)
                      : undefined,
                    borderColor: cat.color ?? undefined,
                  }}
                >
                  {cat.icon && <span className="text-xl">{cat.icon}</span>}
                  <span className="font-medium">{cat.name}</span>
                </Button>
              );
            })}

        <Button
          variant="outline"
          type="button"
          className="justify-start h-14 shadow-[0_0_0_2px_rgba(6,182,212,0.4)_inset] hover:shadow-[0_0_0_2px_rgba(6,182,212,0.8)_inset,0_0_20px_rgba(6,182,212,0.3)] hover:bg-[#06b6d4]/10 transition-all hover:scale-105"
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
