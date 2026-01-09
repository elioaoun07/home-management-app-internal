"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteItem, useUpdateItem } from "@/features/catalogue/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { CatalogueItem, CatalogueModuleType } from "@/types/catalogue";
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/types/catalogue";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Film,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Pin,
  Star,
  Tag,
  Trash2,
  User,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CatalogueItem | null;
  moduleType: CatalogueModuleType;
  onEdit: (item: CatalogueItem) => void;
}

// Module-specific metadata field display config
const MODULE_DISPLAY_FIELDS: Record<
  CatalogueModuleType,
  Array<{
    key: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    format?: "currency" | "date" | "url" | "phone" | "email";
  }>
> = {
  contacts: [
    { key: "phone", label: "Phone", icon: Phone, format: "phone" },
    { key: "email", label: "Email", icon: Mail, format: "email" },
    { key: "address", label: "Address", icon: MapPin },
    { key: "birthday", label: "Birthday", icon: Calendar, format: "date" },
    { key: "relationship", label: "Relationship", icon: User },
    { key: "company", label: "Company" },
  ],
  budget: [
    {
      key: "target_amount",
      label: "Target Price",
      icon: DollarSign,
      format: "currency",
    },
    { key: "where_to_buy", label: "Where to Buy" },
    { key: "url", label: "Product Link", format: "url" },
  ],
  tasks: [
    { key: "due_date", label: "Due Date", icon: Calendar, format: "date" },
  ],
  healthcare: [
    { key: "specialty", label: "Specialty" },
    { key: "phone", label: "Phone", icon: Phone, format: "phone" },
    { key: "address", label: "Location", icon: MapPin },
    {
      key: "next_appointment",
      label: "Next Appointment",
      icon: Calendar,
      format: "date",
    },
  ],
  trips: [
    { key: "country", label: "Country" },
    {
      key: "estimated_cost",
      label: "Estimated Budget",
      icon: DollarSign,
      format: "currency",
    },
    { key: "best_season", label: "Best Time to Visit" },
    { key: "start_date", label: "Trip Start", icon: Calendar, format: "date" },
    { key: "end_date", label: "Trip End", icon: Calendar, format: "date" },
    { key: "activities", label: "Things to Do" },
  ],
  fitness: [
    { key: "sets", label: "Sets" },
    { key: "reps", label: "Reps" },
    { key: "weight", label: "Weight" },
    { key: "duration_mins", label: "Duration (mins)", icon: Clock },
    { key: "muscle_groups", label: "Muscle Groups" },
  ],
  learning: [
    { key: "skill_level", label: "Current Level" },
    { key: "target_level", label: "Target Level" },
    { key: "resource_url", label: "Resource", format: "url" },
  ],
  recipe: [
    { key: "servings", label: "Servings" },
    { key: "prep_time", label: "Prep Time (mins)", icon: Clock },
    { key: "cook_time", label: "Cook Time (mins)", icon: Clock },
    { key: "difficulty", label: "Difficulty" },
    { key: "cuisine", label: "Cuisine" },
    { key: "ingredients", label: "Ingredients" },
    { key: "instructions", label: "Instructions" },
  ],
  documents: [
    { key: "document_type", label: "Type" },
    { key: "document_number", label: "Number" },
    { key: "issue_date", label: "Issue Date", icon: Calendar, format: "date" },
    {
      key: "expiry_date",
      label: "Expiry Date",
      icon: Calendar,
      format: "date",
    },
    { key: "issuing_authority", label: "Issuing Authority" },
    { key: "location", label: "Storage Location" },
  ],
  movies: [
    { key: "media_type", label: "Type", icon: Film },
    { key: "genre", label: "Genre" },
    { key: "year", label: "Year" },
    { key: "director", label: "Director" },
    { key: "rating", label: "Your Rating", icon: Star },
    { key: "platform", label: "Where to Watch" },
    { key: "watch_date", label: "Watch Date", icon: Calendar, format: "date" },
  ],
  custom: [],
};

export default function CatalogueItemDetailDialog({
  open,
  onOpenChange,
  item,
  moduleType,
  onEdit,
}: Props) {
  const themeClasses = useThemeClasses();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  if (!item) return null;

  const metadata = item.metadata_json || {};
  const displayFields = MODULE_DISPLAY_FIELDS[moduleType] || [];

  // Progress calculation
  const hasProgress = item.progress_target && item.progress_target > 0;
  const progressPercent = hasProgress
    ? Math.min(
        100,
        ((item.progress_current ?? 0) / item.progress_target!) * 100
      )
    : 0;

  const formatValue = (value: unknown, format?: string): React.ReactNode => {
    if (value === null || value === undefined || value === "") return null;
    const strValue = String(value);

    switch (format) {
      case "currency":
        return `$${Number(value).toLocaleString()}`;
      case "date":
        try {
          return new Date(strValue).toLocaleDateString();
        } catch {
          return strValue;
        }
      case "url":
        return (
          <a
            href={strValue}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            View Link <ExternalLink className="w-3 h-3" />
          </a>
        );
      case "phone":
        return (
          <a href={`tel:${strValue}`} className="text-primary hover:underline">
            {strValue}
          </a>
        );
      case "email":
        return (
          <a
            href={`mailto:${strValue}`}
            className="text-primary hover:underline"
          >
            {strValue}
          </a>
        );
      default:
        return strValue;
    }
  };

  const handleTogglePin = () => {
    updateItem.mutate({ id: item.id, is_pinned: !item.is_pinned });
  };

  const handleToggleFavorite = () => {
    updateItem.mutate({ id: item.id, is_favorite: !item.is_favorite });
  };

  const handleToggleComplete = () => {
    updateItem.mutate({
      id: item.id,
      status: item.status === "completed" ? "active" : "completed",
    });
  };

  const handleDelete = () => {
    deleteItem.mutate(item.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-lg max-h-[90vh] overflow-y-auto",
          themeClasses.modalBg,
          themeClasses.border
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-white flex items-center gap-2 flex-1">
              {item.is_pinned && <Pin className="w-4 h-4 text-amber-400" />}
              {item.is_favorite && (
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              )}
              <span
                className={
                  item.status === "completed"
                    ? "line-through text-white/60"
                    : ""
                }
              >
                {item.name}
              </span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Status & Priority badges */}
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: STATUS_COLORS[item.status] + "20",
                color: STATUS_COLORS[item.status],
              }}
            >
              {STATUS_LABELS[item.status]}
            </span>
            <span
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: PRIORITY_COLORS[item.priority] + "20",
                color: PRIORITY_COLORS[item.priority],
              }}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
            {item.frequency && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-white/70">
                {item.frequency}
              </span>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <h4 className="text-sm font-medium text-white/50 mb-1">
                Description
              </h4>
              <p className="text-white">{item.description}</p>
            </div>
          )}

          {/* Progress */}
          {hasProgress && (
            <div>
              <h4 className="text-sm font-medium text-white/50 mb-2">
                Progress
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">
                    {item.progress_current ?? 0} / {item.progress_target}{" "}
                    {item.progress_unit || ""}
                  </span>
                  <span className="text-white/60">
                    {progressPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Module-specific fields */}
          {displayFields.length > 0 && (
            <div className="space-y-3">
              {displayFields.map((field) => {
                const value = metadata[field.key];
                const formattedValue = formatValue(value, field.format);
                if (!formattedValue) return null;

                const Icon = field.icon;
                return (
                  <div key={field.key} className="flex items-start gap-3">
                    {Icon && (
                      <Icon className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/40">{field.label}</div>
                      <div className="text-white break-words">
                        {formattedValue}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div>
              <h4 className="text-sm font-medium text-white/50 mb-1">Notes</h4>
              <p className="text-white whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/50 mb-2 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-sm rounded-full bg-white/10 text-white/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sub-items */}
          {item.sub_items && item.sub_items.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/50 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sub-items (
                {item.sub_items.filter((s) => s.is_completed).length}/
                {item.sub_items.length})
              </h4>
              <div className="space-y-1">
                {item.sub_items.map((subItem) => (
                  <div
                    key={subItem.id}
                    className={cn(
                      "flex items-center gap-2 text-sm py-1",
                      subItem.is_completed && "text-white/50 line-through"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        subItem.is_completed
                          ? "bg-primary border-primary"
                          : "border-white/30"
                      )}
                    >
                      {subItem.is_completed && (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span>{subItem.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTogglePin}
              className={cn(
                "border-white/10",
                item.is_pinned && "text-amber-400 border-amber-400/30"
              )}
            >
              <Pin className="w-4 h-4 mr-1" />
              {item.is_pinned ? "Unpin" : "Pin"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleFavorite}
              className={cn(
                "border-white/10",
                item.is_favorite && "text-amber-400 border-amber-400/30"
              )}
            >
              <Star
                className={cn(
                  "w-4 h-4 mr-1",
                  item.is_favorite && "fill-amber-400"
                )}
              />
              {item.is_favorite ? "Unfavorite" : "Favorite"}
            </Button>
            {moduleType === "tasks" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleComplete}
                className={cn(
                  "border-white/10",
                  item.status === "completed" &&
                    "text-green-400 border-green-400/30"
                )}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                {item.status === "completed" ? "Reopen" : "Complete"}
              </Button>
            )}
          </div>

          {/* Main Actions */}
          <div className="flex justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              {deleteItem.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              Delete
            </Button>
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onEdit(item);
              }}
              className="bg-gradient-to-r from-primary to-primary/80 text-white"
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
