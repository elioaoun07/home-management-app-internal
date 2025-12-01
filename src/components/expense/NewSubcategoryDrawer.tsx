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
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { qk } from "@/lib/queryKeys";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

// Color palette for subcategories
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  parentCategoryId: string;
  parentCategoryName: string;
  parentCategoryColor: string;
  onSubcategoryCreated?: (subcategoryId: string) => void;
};

export default function NewSubcategoryDrawer({
  open,
  onOpenChange,
  accountId,
  parentCategoryId,
  parentCategoryName,
  parentCategoryColor,
  onSubcategoryCreated,
}: Props) {
  const themeClasses = useThemeClasses();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [color, setColor] = useState(parentCategoryColor || "#38bdf8");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setName("");
    setColor(parentCategoryColor || "#38bdf8");
    setShowColorPicker(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a subcategory name", {
        icon: ToastIcons.error,
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/user-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          icon: null,
          color,
          account_id: accountId,
          parent_id: parentCategoryId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create subcategory");
      }

      const subcategory = await response.json();

      // Refetch categories to get the new subcategory
      await queryClient.refetchQueries({
        queryKey: qk.categories(accountId),
      });

      toast.success("Subcategory created!", {
        icon: ToastIcons.create,
        description: `Added "${name}" to ${parentCategoryName}`,
      });

      resetForm();
      onOpenChange(false);
      onSubcategoryCreated?.(subcategory.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to create subcategory", {
        icon: ToastIcons.error,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Get the icon component based on current name
  const IconComponent = getCategoryIcon(name);
  const ParentIcon = getCategoryIcon(parentCategoryName);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-bg-dark border-t border-slate-800 max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle
            className={`text-lg font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
          >
            Add Subcategory
          </DrawerTitle>
          <DrawerDescription className="text-slate-400 text-sm flex items-center gap-2">
            Adding to{" "}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${parentCategoryColor}20`,
                color: parentCategoryColor,
              }}
            >
              <ParentIcon className="w-3 h-3" />
              {parentCategoryName}
            </span>
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
                {name || "Subcategory Name"}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center -mt-2">
            Icon is automatically assigned based on name
          </p>

          {/* Subcategory Name */}
          <div className="space-y-2">
            <Label className={`text-sm font-medium ${themeClasses.text}`}>
              Subcategory Name <span className="text-red-400">*</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g., Groceries, Coffee, Uber..."
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
              Try: Groceries, Restaurant, Coffee, Uber, Netflix, Gym, Medicine,
              Books
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
        </div>

        <DrawerFooter className="pt-2 pb-6">
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Add Subcategory"}
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
