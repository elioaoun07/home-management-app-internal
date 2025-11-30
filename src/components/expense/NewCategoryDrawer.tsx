"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCategory } from "@/features/categories/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { qk } from "@/lib/queryKeys";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Color palette for categories
const COLOR_PALETTE = [
  "#FF7043", // Deep Orange
  "#FF5252", // Red
  "#E91E63", // Pink
  "#9C27B0", // Purple
  "#673AB7", // Deep Purple
  "#3F51B5", // Indigo
  "#2196F3", // Blue
  "#03A9F4", // Light Blue
  "#00BCD4", // Cyan
  "#009688", // Teal
  "#4CAF50", // Green
  "#8BC34A", // Light Green
  "#CDDC39", // Lime
  "#FFEB3B", // Yellow
  "#FFC107", // Amber
  "#FF9800", // Orange
  "#795548", // Brown
  "#607D8B", // Blue Grey
  "#9E9E9E", // Grey
  "#22d3ee", // Theme cyan
];

type SubcategoryInput = {
  id: string;
  name: string;
  color: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onCategoryCreated?: (categoryId: string) => void;
};

export default function NewCategoryDrawer({
  open,
  onOpenChange,
  accountId,
  onCategoryCreated,
}: Props) {
  const themeClasses = useThemeClasses();
  const queryClient = useQueryClient();
  const createCategoryMutation = useCreateCategory(accountId);

  const [name, setName] = useState("");
  const [color, setColor] = useState("#22d3ee");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Subcategories
  const [subcategories, setSubcategories] = useState<SubcategoryInput[]>([]);
  const [showSubcategoryForm, setShowSubcategoryForm] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubColor, setNewSubColor] = useState("#38bdf8");

  const resetForm = () => {
    setName("");
    setColor("#22d3ee");
    setShowColorPicker(false);
    setSubcategories([]);
    setShowSubcategoryForm(false);
    setNewSubName("");
    setNewSubColor("#38bdf8");
  };

  const handleAddSubcategory = () => {
    if (!newSubName.trim()) {
      toast.error("Please enter a subcategory name", {
        icon: ToastIcons.error,
      });
      return;
    }

    const newSub: SubcategoryInput = {
      id: `temp-${Date.now()}`,
      name: newSubName.trim(),
      color: newSubColor,
    };

    setSubcategories([...subcategories, newSub]);
    setNewSubName("");
    setNewSubColor("#38bdf8");
    setShowSubcategoryForm(false);
  };

  const handleRemoveSubcategory = (id: string) => {
    setSubcategories(subcategories.filter((s) => s.id !== id));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a category name", { icon: ToastIcons.error });
      return;
    }

    try {
      // Create the main category first
      const category = await createCategoryMutation.mutateAsync({
        name: name.trim(),
        icon: null, // Icons are determined by name via getCategoryIcon
        color,
        parent_id: null,
      });

      // Create subcategories if any
      if (subcategories.length > 0 && category?.id) {
        for (let i = 0; i < subcategories.length; i++) {
          const sub = subcategories[i];
          try {
            await fetch("/api/user-categories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: sub.name,
                icon: null,
                color: sub.color,
                account_id: accountId,
                parent_id: category.id,
                position: i + 1,
              }),
            });
          } catch (e) {
            console.error("Failed to create subcategory:", e);
          }
        }

        // Force refetch the categories cache to get the new subcategories
        await queryClient.refetchQueries({
          queryKey: qk.categories(accountId),
        });
      }

      toast.success("Category created!", {
        icon: ToastIcons.create,
        description: `${name}${subcategories.length > 0 ? ` with ${subcategories.length} subcategories` : ""}`,
      });

      resetForm();
      onOpenChange(false);
      onCategoryCreated?.(category.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to create category", {
        icon: ToastIcons.error,
      });
    }
  };

  // Get the icon component based on current name
  const IconComponent = getCategoryIcon(name);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-bg-dark border-t border-slate-800 max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle
            className={`text-lg font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
          >
            Create New Category
          </DrawerTitle>
          <DrawerDescription className="text-slate-400 text-sm">
            Add a category to organize your expenses
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Preview */}
          <div className="flex items-center justify-center py-3">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{
                borderColor: color,
                backgroundColor: `${color}20`,
              }}
            >
              <div
                style={{
                  color: color,
                  filter: `drop-shadow(0 0 8px ${color}80)`,
                }}
              >
                <IconComponent className="w-7 h-7" />
              </div>
              <span className="text-white font-semibold">
                {name || "Category Name"}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center -mt-2">
            Icon is automatically assigned based on category name
          </p>

          {/* Category Name */}
          <div className="space-y-2">
            <Label className={`text-sm font-medium ${themeClasses.text}`}>
              Category Name <span className="text-red-400">*</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g., Food & Dining, Transport, Shopping..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(
                "h-12 bg-bg-card-custom text-white placeholder:text-slate-500",
                themeClasses.border,
                themeClasses.focusBorder,
                "focus:ring-2",
                themeClasses.focusRing
              )}
              autoFocus
            />
            <p className="text-xs text-slate-500">
              Try: Food, Transport, Shopping, Bills, Health, Entertainment,
              Education, Gift, Home, Coffee
            </p>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label className={`text-sm font-medium ${themeClasses.text}`}>
              Color
            </Label>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={cn(
                "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover}`
              )}
            >
              <div
                className="w-6 h-6 rounded-full border-2 border-white/20"
                style={{ backgroundColor: color }}
              />
              <span className="text-slate-400">Tap to change color</span>
              <span className="text-slate-500 ml-auto text-sm">{color}</span>
            </button>

            {showColorPicker && (
              <div className="grid grid-cols-5 gap-2 mt-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      setShowColorPicker(false);
                    }}
                    className={cn(
                      "w-10 h-10 rounded-full transition-all active:scale-95",
                      color === c
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                        : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Subcategories Section */}
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <Label className={`text-sm font-medium ${themeClasses.text}`}>
                Subcategories{" "}
                <span className="text-slate-500 font-normal">(optional)</span>
              </Label>
              {!showSubcategoryForm && (
                <button
                  onClick={() => setShowSubcategoryForm(true)}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
            </div>

            {/* Existing subcategories */}
            {subcategories.length > 0 && (
              <div className="space-y-2">
                {subcategories.map((sub) => {
                  const SubIcon = getCategoryIcon(sub.name);
                  return (
                    <div
                      key={sub.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border",
                        `${themeClasses.border} bg-bg-card-custom`
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div style={{ color: sub.color }}>
                          <SubIcon className="w-4 h-4" />
                        </div>
                        <span className="text-white text-sm">{sub.name}</span>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveSubcategory(sub.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add subcategory form */}
            {showSubcategoryForm && (
              <div className="space-y-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    New Subcategory
                  </span>
                  <button
                    onClick={() => setShowSubcategoryForm(false)}
                    className="p-1 rounded hover:bg-slate-700"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <Input
                  type="text"
                  placeholder="Subcategory name (e.g., Groceries, Coffee...)"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className={cn(
                    "h-10 bg-bg-card-custom text-white placeholder:text-slate-500",
                    themeClasses.border
                  )}
                />

                {/* Color mini-picker */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400">Color:</span>
                  <div className="flex gap-1">
                    {[
                      "#38bdf8",
                      "#4ade80",
                      "#fbbf24",
                      "#f87171",
                      "#a78bfa",
                      "#fb923c",
                      "#22d3ee",
                    ].map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewSubColor(c)}
                        className={cn(
                          "w-6 h-6 rounded-full transition-all",
                          newSubColor === c
                            ? "ring-2 ring-white ring-offset-1 ring-offset-slate-800"
                            : "hover:scale-110"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleAddSubcategory}
                  disabled={!newSubName.trim()}
                  className="w-full neo-gradient text-white border-0"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Subcategory
                </Button>
              </div>
            )}
          </div>
        </div>

        <DrawerFooter className="pt-2 pb-6">
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createCategoryMutation.isPending}
            className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createCategoryMutation.isPending
              ? "Creating..."
              : "Create Category"}
          </Button>
          <DrawerClose asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full h-11 bg-transparent",
                themeClasses.border,
                themeClasses.text
              )}
            >
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
