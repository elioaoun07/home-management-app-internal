"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Edit,
  GripVertical,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type CategoryItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  position: number;
  visible: boolean;
  account_id: string;
  subcategories?: CategoryItem[];
};

type EditingCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type NewCategory = {
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
};

export function CategoryManagement() {
  const themeClasses = useThemeClasses();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const { data: categoriesData = [] } = useCategories(selectedAccountId);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<EditingCategory | null>(null);
  const [newCategory, setNewCategory] = useState<NewCategory | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with first account
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Transform flat categories into hierarchical structure
  useEffect(() => {
    if (Array.isArray(categoriesData)) {
      const hierarchical = buildHierarchy(categoriesData);
      setCategories(hierarchical);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(categoriesData)]);

  function buildHierarchy(flat: any[]): CategoryItem[] {
    const parentCategories = flat
      .filter((c) => !c.parent_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    return parentCategories.map((parent) => {
      const subcategories = flat
        .filter((c) => c.parent_id === parent.id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      return {
        ...parent,
        subcategories: subcategories.length > 0 ? subcategories : undefined,
      };
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    setCategories((items) => {
      const activeItem = findCategoryById(items, active.id as string);
      const overItem = findCategoryById(items, over.id as string);

      if (!activeItem || !overItem) return items;

      // Only allow reordering within same parent level
      if (activeItem.parent_id !== overItem.parent_id) {
        toast.error("Cannot move categories between different levels");
        return items;
      }

      const isParentLevel = !activeItem.parent_id;

      if (isParentLevel) {
        const oldIndex = items.findIndex((c) => c.id === active.id);
        const newIndex = items.findIndex((c) => c.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        return reordered;
      } else {
        // Reordering subcategories
        const parentId = activeItem.parent_id;
        const parent = items.find((c) => c.id === parentId);
        if (!parent?.subcategories) return items;

        const oldIndex = parent.subcategories.findIndex(
          (c) => c.id === active.id
        );
        const newIndex = parent.subcategories.findIndex(
          (c) => c.id === over.id
        );
        const reorderedSubs = arrayMove(
          parent.subcategories,
          oldIndex,
          newIndex
        );

        const newItems = items.map((c) =>
          c.id === parentId ? { ...c, subcategories: reorderedSubs } : c
        );
        setHasChanges(true);
        return newItems;
      }
    });

    setActiveId(null);
  }

  function findCategoryById(
    items: CategoryItem[],
    id: string
  ): CategoryItem | null {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.subcategories) {
        const found = item.subcategories.find((sub) => sub.id === id);
        if (found) return found;
      }
    }
    return null;
  }

  function toggleExpanded(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  async function handleSaveOrder() {
    setIsSaving(true);
    try {
      // Flatten categories with updated positions
      const updates: Array<{ id: string; position: number }> = [];

      categories.forEach((cat, idx) => {
        updates.push({ id: cat.id, position: idx });
        if (cat.subcategories) {
          cat.subcategories.forEach((sub, subIdx) => {
            updates.push({ id: sub.id, position: subIdx });
          });
        }
      });

      const response = await fetch("/api/categories/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "reorder",
          data: {
            account_id: selectedAccountId,
            categories: updates,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to save order");

      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setHasChanges(false);
      toast.success("Category order saved!");
    } catch (error) {
      console.error("Save order error:", error);
      toast.error("Failed to save order");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateCategory(updates: Partial<EditingCategory>) {
    if (!editingCategory) return;

    try {
      const response = await fetch("/api/categories/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "update",
          data: {
            id: editingCategory.id,
            ...updates,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to update category");

      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingCategory(null);
      toast.success("Category updated!");
    } catch (error) {
      console.error("Update category error:", error);
      toast.error("Failed to update category");
    }
  }

  async function handleCreateCategory() {
    if (!newCategory || !newCategory.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      const response = await fetch("/api/categories/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "create",
          data: {
            ...newCategory,
            account_id: selectedAccountId,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to create category");

      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCategory(null);
      toast.success("Category created!");
    } catch (error) {
      console.error("Create category error:", error);
      toast.error("Failed to create category");
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const response = await fetch("/api/categories/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "delete",
          data: { id: categoryId, hard_delete: false },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete category");
      }

      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted!");
    } catch (error: any) {
      console.error("Delete category error:", error);
      toast.error(error.message || "Failed to delete category");
    }
  }

  const activeCategory = activeId
    ? findCategoryById(categories, activeId)
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h3 className={`text-lg font-semibold ${themeClasses.text} mb-1`}>
          Category Management
        </h3>
        <p className={`text-sm ${themeClasses.textMuted}`}>
          Customize your categories, reorder them, and change colors
        </p>
      </div>

      {/* Account Selector */}
      <div>
        <label
          className={`text-sm font-medium ${themeClasses.textFaint} mb-2 block`}
        >
          Select Account
        </label>
        <Select
          value={selectedAccountId}
          onValueChange={(value) => {
            setSelectedAccountId(value);
            setHasChanges(false);
          }}
        >
          <SelectTrigger className={`py-2 rounded-xl ${themeClasses.bgActive}`}>
            <SelectValue placeholder="Select an account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Actions Bar */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() =>
            setNewCategory({
              name: "",
              icon: "📁",
              color: "#38bdf8",
              parent_id: null,
            })
          }
          className={`bg-gradient-to-r ${themeClasses.activeItemGradient} text-white ${themeClasses.glow}`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
        {hasChanges && (
          <Button
            onClick={handleSaveOrder}
            disabled={isSaving}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Order"}
          </Button>
        )}
      </div>

      {/* New Category Form */}
      {newCategory && (
        <Card
          className={`p-4 bg-gradient-to-br ${themeClasses.cardGradient} ${themeClasses.border}`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={`font-semibold ${themeClasses.text}`}>
                New Category
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewCategory(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Category name"
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
                className={`bg-[hsl(var(--card))] ${themeClasses.border}`}
              />
              <Input
                placeholder="Icon (emoji)"
                value={newCategory.icon}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, icon: e.target.value })
                }
                className={`bg-[hsl(var(--card))] ${themeClasses.border}`}
                maxLength={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-sm ${themeClasses.textFaint}`}>
                Color:
              </label>
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, color: e.target.value })
                }
                className={`h-10 w-20 rounded cursor-pointer border ${themeClasses.border}`}
              />
              <div
                className={`h-10 flex-1 rounded border ${themeClasses.border}`}
                style={{ backgroundColor: newCategory.color }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateCategory}
                className={`flex-1 ${themeClasses.bgActive} ${themeClasses.textActive} ${themeClasses.bgHover}`}
              >
                Create
              </Button>
              <Button
                variant="outline"
                onClick={() => setNewCategory(null)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Categories List */}
      <ScrollArea className="h-[500px] pr-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggleExpand={() => toggleExpanded(category.id)}
                  onEdit={(cat) =>
                    setEditingCategory({
                      id: cat.id,
                      name: cat.name,
                      icon: cat.icon,
                      color: cat.color,
                    })
                  }
                  onDelete={handleDeleteCategory}
                  onAddSubcategory={(parentId) =>
                    setNewCategory({
                      name: "",
                      icon: "📄",
                      color: category.color,
                      parent_id: parentId,
                    })
                  }
                  editingCategory={editingCategory}
                  onUpdateCategory={handleUpdateCategory}
                  onCancelEdit={() => setEditingCategory(null)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeCategory ? (
              <div
                className={`${themeClasses.bgSurface} border-2 ${themeClasses.borderActive} rounded-xl p-3 shadow-lg`}
              >
                <span className="mr-2">{activeCategory.icon}</span>
                <span className="font-medium">{activeCategory.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  );
}

function CategoryCard({
  category,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSubcategory,
  editingCategory,
  onUpdateCategory,
  onCancelEdit,
}: {
  category: CategoryItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (cat: CategoryItem) => void;
  onDelete: (id: string) => void;
  onAddSubcategory: (parentId: string) => void;
  editingCategory: EditingCategory | null;
  onUpdateCategory: (updates: Partial<EditingCategory>) => void;
  onCancelEdit: () => void;
}) {
  const themeClasses = useThemeClasses();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isEditing = editingCategory?.id === category.id;

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`p-3 bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--card)/0.8)] border-[hsl(var(--header-border)/0.3)] ${themeClasses.borderHover} transition-all`}
      >
        {isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={editingCategory.name}
                onChange={(e) => onUpdateCategory({ name: e.target.value })}
                placeholder="Category name"
                className="bg-[hsl(var(--card))]"
                autoFocus
              />
              <Input
                value={editingCategory.icon}
                onChange={(e) => onUpdateCategory({ icon: e.target.value })}
                placeholder="Icon"
                maxLength={2}
                className="bg-[hsl(var(--card))]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-xs ${themeClasses.textFaint}`}>
                Color:
              </label>
              <input
                type="color"
                value={editingCategory.color}
                onChange={(e) => onUpdateCategory({ color: e.target.value })}
                className="h-8 w-16 rounded cursor-pointer"
              />
              <div
                className="h-8 flex-1 rounded"
                style={{ backgroundColor: editingCategory.color }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => onUpdateCategory({})}
                size="sm"
                className={`flex-1 ${themeClasses.bgActive} ${themeClasses.textActive} ${themeClasses.bgHover}`}
              >
                Save
              </Button>
              <Button
                onClick={onCancelEdit}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div
                {...attributes}
                {...listeners}
                className={`cursor-grab active:cursor-grabbing ${themeClasses.textFaint} ${themeClasses.textHover}`}
              >
                <GripVertical className="w-5 h-5" />
              </div>
              {category.subcategories && category.subcategories.length > 0 && (
                <button
                  onClick={onToggleExpand}
                  className={`${themeClasses.textFaint} ${themeClasses.textHover}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="text-xl mr-2">{category.icon}</span>
              <span
                className="font-medium flex-1"
                style={{ color: category.color }}
              >
                {category.name}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(category)}
                  className={`h-8 w-8 p-0 ${themeClasses.bgHover}`}
                >
                  <Edit className={`w-4 h-4 ${themeClasses.text}`} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAddSubcategory(category.id)}
                  className="h-8 w-8 p-0 hover:bg-green-500/20"
                >
                  <Plus className="w-4 h-4 text-green-400" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(category.id)}
                  className="h-8 w-8 p-0 hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            </div>

            {/* Subcategories */}
            {isExpanded && category.subcategories && (
              <div className="ml-10 mt-3 space-y-2">
                <SortableContext
                  items={category.subcategories.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {category.subcategories.map((sub) => (
                    <SubcategoryCard
                      key={sub.id}
                      subcategory={sub}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      editingCategory={editingCategory}
                      onUpdateCategory={onUpdateCategory}
                      onCancelEdit={onCancelEdit}
                    />
                  ))}
                </SortableContext>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function SubcategoryCard({
  subcategory,
  onEdit,
  onDelete,
  editingCategory,
  onUpdateCategory,
  onCancelEdit,
}: {
  subcategory: CategoryItem;
  onEdit: (cat: CategoryItem) => void;
  onDelete: (id: string) => void;
  editingCategory: EditingCategory | null;
  onUpdateCategory: (updates: Partial<EditingCategory>) => void;
  onCancelEdit: () => void;
}) {
  const themeClasses = useThemeClasses();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subcategory.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isEditing = editingCategory?.id === subcategory.id;

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`p-2 bg-[hsl(var(--card)/0.5)] border-[hsl(var(--header-border)/0.2)] ${themeClasses.borderHover} transition-all`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={editingCategory.name}
                onChange={(e) => onUpdateCategory({ name: e.target.value })}
                placeholder="Subcategory name"
                className="bg-[hsl(var(--card))] text-sm"
                autoFocus
              />
              <Input
                value={editingCategory.icon}
                onChange={(e) => onUpdateCategory({ icon: e.target.value })}
                placeholder="Icon"
                maxLength={2}
                className="bg-[hsl(var(--card))] text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editingCategory.color}
                onChange={(e) => onUpdateCategory({ color: e.target.value })}
                className="h-6 w-12 rounded cursor-pointer"
              />
              <div
                className="h-6 flex-1 rounded"
                style={{ backgroundColor: editingCategory.color }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => onUpdateCategory({})}
                size="sm"
                className={`flex-1 ${themeClasses.bgActive} ${themeClasses.textActive} ${themeClasses.bgHover} text-xs`}
              >
                Save
              </Button>
              <Button
                onClick={onCancelEdit}
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              {...attributes}
              {...listeners}
              className={`cursor-grab active:cursor-grabbing ${themeClasses.textFaint} ${themeClasses.textHover}`}
            >
              <GripVertical className="w-4 h-4" />
            </div>
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: subcategory.color }}
            />
            <span className="text-sm mr-1">{subcategory.icon}</span>
            <span
              className="text-sm flex-1"
              style={{ color: subcategory.color }}
            >
              {subcategory.name}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(subcategory)}
                className={`h-6 w-6 p-0 ${themeClasses.bgHover}`}
              >
                <Edit className={`w-3 h-3 ${themeClasses.text}`} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(subcategory.id)}
                className="h-6 w-6 p-0 hover:bg-red-500/20"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
