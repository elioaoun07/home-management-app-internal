"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  useCategories,
  type UICategory,
} from "@/features/categories/useCategoriesQuery";
import { useRef, useState } from "react";

type Props = {
  accountId?: string;
  parentCategoryId?: string; // selected top-level category
  selectedSubcategoryId?: string;
  onSubcategorySelect?: (subcategoryId: string) => void;
};

export default function SubcategoryGrid({
  accountId,
  parentCategoryId,
  selectedSubcategoryId,
  onSubcategorySelect,
}: Props) {
  // reuse the same categories query (already filtered by account)
  const {
    data: categories = [] as UICategory[],
    isLoading,
    refetch,
  } = useCategories(accountId);

  // Only subcategories of the selected parent
  // Support both DB categories (with parent_id) and default categories (with subcategories)
  let subs: any[] = [];
  if (parentCategoryId && categories.length) {
    if ("parent_id" in (categories[0] as any)) {
      subs = (categories as any[]).filter(
        (c: any) => c.parent_id === parentCategoryId
      );
    } else {
      // Find the parent and use its subcategories (default nested categories)
      const parent = (categories as any[]).find(
        (c: any) => c.id === parentCategoryId
      );
      subs = (
        parent && Array.isArray(parent.subcategories)
          ? parent.subcategories
          : []
      ) as any[];
    }
  }
  // Only add 'Other' if both account and parent category are selected
  if (accountId && parentCategoryId) {
    subs = [...subs, { id: "other", name: "Other", icon: "", color: "" }];
  }

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [otherActive, setOtherActive] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherLoading, setOtherLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!accountId) {
    return (
      <div className="space-y-3">
        <Label>Subcategory</Label>
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

  if (!parentCategoryId) {
    return (
      <div className="space-y-3">
        <Label>Subcategory</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            type="button"
            className="justify-start opacity-50"
            disabled
          >
            Select a category first
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Subcategory</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Button
                key={i}
                variant="outline"
                type="button"
                className="justify-start opacity-50"
                disabled
              >
                Loading...
              </Button>
            ))
          : subs.map((cat, idx) => {
              const isOther = cat.id === "other";
              const active = selectedSubcategoryId === cat.id;
              if (isOther) {
                if (active && otherActive) {
                  return (
                    <form
                      key={`other-rename-${parentCategoryId || "root"}-${idx}`}
                      className="col-span-2 sm:col-span-1 flex gap-2 w-full"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!otherName.trim()) return;
                        setOtherLoading(true);
                        try {
                          const res = await fetch("/api/user-categories", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: otherName,
                              account_id: accountId,
                              parent_id: parentCategoryId,
                            }),
                          });
                          if (!res.ok)
                            throw new Error("Failed to create subcategory");
                          const newCat = await res.json();
                          setOtherActive(false);
                          setOtherName("");
                          await refetch();
                          onSubcategorySelect?.(newCat.id);
                        } catch (err) {
                          // Optionally show error
                        } finally {
                          setOtherLoading(false);
                        }
                      }}
                    >
                      <input
                        ref={inputRef}
                        className="border rounded px-2 py-1 flex-1"
                        value={otherName}
                        onChange={(e) => setOtherName(e.target.value)}
                        placeholder="Rename 'Other'..."
                        disabled={otherLoading}
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={otherLoading || !otherName.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOtherActive(false);
                          setOtherName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </form>
                  );
                }
                return (
                  <Button
                    key={`other-${parentCategoryId || "root"}-${idx}`}
                    variant={active ? "default" : "outline"}
                    type="button"
                    className="justify-start gap-2"
                    onClick={() => {
                      if (!active) {
                        onSubcategorySelect?.("other");
                        setOtherActive(false);
                      } else if (!otherActive) {
                        setOtherActive(true);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }
                    }}
                  >
                    <span>Other</span>
                  </Button>
                );
              }
              return (
                <Button
                  key={cat.id}
                  variant={active ? "default" : "outline"}
                  type="button"
                  className={`justify-start gap-2 transition-all duration-150 hover:scale-105 ${
                    active
                      ? "ring-2 ring-primary/50 shadow-md"
                      : "hover:shadow-sm"
                  }`}
                  onClick={() => onSubcategorySelect?.(cat.id)}
                  style={{
                    backgroundColor: active
                      ? (cat.color ?? undefined)
                      : undefined,
                    borderColor: cat.color ?? undefined,
                  }}
                >
                  {cat.icon && <span className="text-lg">{cat.icon}</span>}
                  <span>{cat.name}</span>
                </Button>
              );
            })}
      </div>
    </div>
  );
}
