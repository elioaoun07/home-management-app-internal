"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCategory,
  useUpdateCategory,
} from "@/features/catalogue/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { CatalogueCategory, CreateCategoryInput } from "@/types/catalogue";
import {
  BookOpen,
  Briefcase,
  Car,
  Check,
  FolderOpen,
  GraduationCap,
  Heart,
  Home,
  Loader2,
  Music,
  Palette,
  Plane,
  ShoppingBag,
  Star,
  Tag,
  Users,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  editingCategory: CatalogueCategory | null;
}

// Icon options for categories
const ICON_OPTIONS = [
  { name: "tag", icon: Tag },
  { name: "folder", icon: FolderOpen },
  { name: "star", icon: Star },
  { name: "heart", icon: Heart },
  { name: "home", icon: Home },
  { name: "briefcase", icon: Briefcase },
  { name: "shopping", icon: ShoppingBag },
  { name: "utensils", icon: Utensils },
  { name: "car", icon: Car },
  { name: "plane", icon: Plane },
  { name: "music", icon: Music },
  { name: "book", icon: BookOpen },
  { name: "graduation", icon: GraduationCap },
  { name: "users", icon: Users },
  { name: "palette", icon: Palette },
];

// Color options
const COLOR_OPTIONS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#64748b", // slate
];

export default function CatalogueCategoryDialog({
  open,
  onOpenChange,
  moduleId,
  editingCategory,
}: Props) {
  const themeClasses = useThemeClasses();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("tag");
  const [color, setColor] = useState("#6366f1");
  const [isPublic, setIsPublic] = useState(true);

  const isLoading = createCategory.isPending || updateCategory.isPending;
  const isEditing = !!editingCategory;

  // Reset form when opening/closing or editing different category
  useEffect(() => {
    if (open) {
      if (editingCategory) {
        setName(editingCategory.name);
        setDescription(editingCategory.description || "");
        setIcon(editingCategory.icon || "tag");
        setColor(editingCategory.color || "#6366f1");
        setIsPublic(editingCategory.is_public ?? true);
      } else {
        setName("");
        setDescription("");
        setIcon("tag");
        setColor("#6366f1");
        setIsPublic(true);
      }
    }
  }, [open, editingCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    if (isEditing) {
      updateCategory.mutate(
        {
          id: editingCategory.id,
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          color,
          is_public: isPublic,
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    } else {
      const data: CreateCategoryInput = {
        module_id: moduleId,
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
        is_public: isPublic,
      };
      createCategory.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md max-h-[90vh] overflow-y-auto",
          themeClasses.modalBg,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEditing ? "Edit Category" : "Add New Category"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white/70">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name..."
              className={cn(themeClasses.inputBg, "border-white/10 text-white")}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white/70">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white min-h-[60px]",
              )}
            />
          </div>

          {/* Icon Selection */}
          <div className="space-y-2">
            <Label className="text-white/70">Icon</Label>
            <div className="grid grid-cols-5 gap-2">
              {ICON_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = icon === opt.name;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setIcon(opt.name)}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center transition-all",
                      isSelected
                        ? "ring-2 ring-primary bg-primary/20"
                        : "bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <IconComponent
                      className={cn(
                        "w-5 h-5",
                        isSelected ? "text-primary" : "text-white/60",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label className="text-white/70">Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => {
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-transform",
                      isSelected &&
                        "scale-110 ring-2 ring-white ring-offset-2 ring-offset-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="space-y-2">
            <Label className="text-white/70">Visibility</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                  isPublic
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                    : "bg-white/5 text-white/50 hover:bg-white/10",
                )}
              >
                <Users className="w-4 h-4" />
                Public
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                  !isPublic
                    ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
                    : "bg-white/5 text-white/50 hover:bg-white/10",
                )}
              >
                <Tag className="w-4 h-4" />
                Private
              </button>
            </div>
            <p className="text-xs text-white/40">
              {isPublic
                ? "Visible to household members"
                : "Only visible to you"}
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-white/70">Preview</Label>
            <div
              className={cn(
                "p-4 rounded-lg flex items-center gap-3",
                themeClasses.surfaceBg,
              )}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: color + "30" }}
              >
                {(() => {
                  const IconComponent =
                    ICON_OPTIONS.find((o) => o.name === icon)?.icon || Tag;
                  return (
                    <IconComponent className="w-5 h-5" style={{ color }} />
                  );
                })()}
              </div>
              <div>
                <div className="font-medium text-white">
                  {name || "Category Name"}
                </div>
                {description && (
                  <div className="text-sm text-white/50">{description}</div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/70"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="bg-gradient-to-r from-primary to-primary/80 text-white"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
