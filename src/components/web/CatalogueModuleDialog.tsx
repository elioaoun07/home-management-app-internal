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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateModule,
  useDeleteModule,
  useUpdateModule,
} from "@/features/catalogue/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { CatalogueModule, CatalogueModuleType } from "@/types/catalogue";
import { MODULE_COLORS, MODULE_TYPE_LABELS } from "@/types/catalogue";
import {
  BookOpen,
  CheckSquare,
  ChefHat,
  Dumbbell,
  FileText,
  Film,
  FolderOpen,
  GraduationCap,
  Heart,
  HeartPulse,
  Loader2,
  Package,
  Plane,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingModule: CatalogueModule | null;
}

const MODULE_TYPE_OPTIONS: CatalogueModuleType[] = [
  "budget",
  "recipe",
  "tasks",
  "healthcare",
  "trips",
  "fitness",
  "learning",
  "contacts",
  "documents",
  "movies",
  "inventory",
  "custom",
];

const ICON_OPTIONS = [
  { value: "wallet", label: "Wallet", icon: Wallet },
  { value: "check-square", label: "Tasks", icon: CheckSquare },
  { value: "chef-hat", label: "Chef Hat", icon: ChefHat },
  { value: "heart-pulse", label: "Health", icon: HeartPulse },
  { value: "plane", label: "Travel", icon: Plane },
  { value: "dumbbell", label: "Fitness", icon: Dumbbell },
  { value: "graduation-cap", label: "Learning", icon: GraduationCap },
  { value: "users", label: "Contacts", icon: Users },
  { value: "file-text", label: "Documents", icon: FileText },
  { value: "film", label: "Movies", icon: Film },
  { value: "package", label: "Inventory", icon: Package },
  { value: "folder", label: "Folder", icon: FolderOpen },
  { value: "heart", label: "Heart", icon: Heart },
  { value: "book", label: "Book", icon: BookOpen },
];

const COLOR_OPTIONS = [
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ef4444", label: "Red" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#64748b", label: "Slate" },
  { value: "#a855f7", label: "Purple" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
];

export default function CatalogueModuleDialog({
  open,
  onOpenChange,
  editingModule,
}: Props) {
  const themeClasses = useThemeClasses();
  const createModule = useCreateModule();
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();

  // Form state
  const [moduleType, setModuleType] = useState<CatalogueModuleType>("custom");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("folder");
  const [color, setColor] = useState("#3b82f6");

  const isLoading =
    createModule.isPending || updateModule.isPending || deleteModule.isPending;
  const isEditing = !!editingModule;

  // Reset form when opening/closing or editing different module
  useEffect(() => {
    if (open) {
      if (editingModule) {
        setModuleType(editingModule.type);
        setName(editingModule.name);
        setDescription(editingModule.description || "");
        setIcon(editingModule.icon);
        setColor(editingModule.color);
      } else {
        setModuleType("custom");
        setName("");
        setDescription("");
        setIcon("folder");
        setColor("#3b82f6");
      }
    }
  }, [open, editingModule]);

  // Auto-fill name and colors when type changes (for new modules)
  const handleTypeChange = (type: CatalogueModuleType) => {
    setModuleType(type);
    if (!isEditing) {
      setName(MODULE_TYPE_LABELS[type]);
      const colors = MODULE_COLORS[type];
      if (colors) {
        setColor(colors.color);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const data = {
      type: moduleType,
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      color,
      gradient_from: color,
      gradient_to: color,
    };

    if (isEditing) {
      updateModule.mutate(
        { id: editingModule.id, ...data },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    } else {
      createModule.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const handleDelete = () => {
    if (!editingModule) return;
    deleteModule.mutate(editingModule.id, {
      onSuccess: () => onOpenChange(false),
    });
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
            {isEditing ? "Edit Module" : "Add New Module"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Module Type */}
          <div className="space-y-2">
            <Label className="text-white/70">Module Type</Label>
            <Select
              value={moduleType}
              onValueChange={(v) => handleTypeChange(v as CatalogueModuleType)}
              disabled={isEditing && editingModule?.is_system}
            >
              <SelectTrigger
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={cn(themeClasses.modalBg, themeClasses.border)}
              >
                {MODULE_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type} className="text-white">
                    {MODULE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white/70">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Module"
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
              placeholder="What is this module for?"
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white min-h-[60px]",
              )}
            />
          </div>

          {/* Icon Selection */}
          <div className="space-y-2">
            <Label className="text-white/70">Icon</Label>
            <div className="grid grid-cols-6 gap-2">
              {ICON_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIcon(opt.value)}
                    className={cn(
                      "p-2 rounded-lg border transition-all",
                      icon === opt.value
                        ? "border-primary bg-primary/20"
                        : "border-white/10 hover:border-white/30",
                    )}
                    title={opt.label}
                  >
                    <IconComp className="w-5 h-5 text-white mx-auto" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label className="text-white/70">Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all mx-auto",
                    color === opt.value
                      ? "border-white scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: opt.value }}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-white/70">Preview</Label>
            <div
              className={cn(
                "p-4 rounded-xl flex items-center gap-3",
                themeClasses.surfaceBg,
              )}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: color }}
              >
                {(() => {
                  const IconComp =
                    ICON_OPTIONS.find((i) => i.value === icon)?.icon ||
                    FolderOpen;
                  return <IconComp className="w-6 h-6 text-white" />;
                })()}
              </div>
              <div>
                <div className="font-medium text-white">
                  {name || "Module Name"}
                </div>
                <div className="text-sm text-white/50">
                  {description || "Module description"}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-2 pt-4 border-t border-white/10">
            {isEditing && !editingModule?.is_system && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isLoading}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                {deleteModule.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
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
                {(createModule.isPending || updateModule.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {isEditing ? "Save Changes" : "Create Module"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
