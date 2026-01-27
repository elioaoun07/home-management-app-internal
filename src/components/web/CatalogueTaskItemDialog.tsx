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
import { useCreateItem, useUpdateItem } from "@/features/catalogue/hooks";
import { useItemCategories } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type {
  CatalogueItem,
  CataloguePriority,
  LocationContext,
  RecurrencePattern,
} from "@/types/catalogue";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/types/catalogue";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckSquare,
  Clock,
  EyeOff,
  FolderOpen,
  Globe,
  Home,
  ListTodo,
  Loader2,
  MapPin,
  Plus,
  Repeat,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  categoryId?: string;
  editingItem: CatalogueItem | null;
  onSuccess?: (item: CatalogueItem) => void;
}

const PRIORITY_OPTIONS: CataloguePriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
  "critical",
];

// Colors matching the app's color scheme:
// - Event: pink/magenta (bg-pink-400, border-pink-500)
// - Reminder: cyan/light blue (bg-cyan-400, border-cyan-500)
// - Task: purple (bg-purple-400, border-purple-500)
const ITEM_TYPE_OPTIONS = [
  {
    value: "event",
    label: "Event",
    icon: CalendarClock,
    description: "A scheduled event with duration",
    color: "pink",
    borderClass: "border-pink-500",
    bgClass: "bg-pink-500/20",
    textClass: "text-pink-400",
  },
  {
    value: "reminder",
    label: "Reminder",
    icon: AlertCircle,
    description: "Get notified at a specific time",
    color: "cyan",
    borderClass: "border-cyan-500",
    bgClass: "bg-cyan-500/20",
    textClass: "text-cyan-400",
  },
  {
    value: "task",
    label: "Task",
    icon: CheckSquare,
    description: "A to-do item with optional due date",
    color: "purple",
    borderClass: "border-purple-500",
    bgClass: "bg-purple-500/20",
    textClass: "text-purple-400",
  },
] as const;

const LOCATION_OPTIONS: {
  value: LocationContext;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "home", label: "At Home", icon: Home },
  { value: "outside", label: "Outside Home", icon: MapPin },
  { value: "anywhere", label: "Anywhere", icon: Globe },
];

const RECURRENCE_OPTIONS: { value: RecurrencePattern; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Every 3 Months" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom..." },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun", short: "S" },
  { value: 1, label: "Mon", short: "M" },
  { value: 2, label: "Tue", short: "T" },
  { value: 3, label: "Wed", short: "W" },
  { value: 4, label: "Thu", short: "T" },
  { value: 5, label: "Fri", short: "F" },
  { value: 6, label: "Sat", short: "S" },
];

export default function CatalogueTaskItemDialog({
  open,
  onOpenChange,
  moduleId,
  categoryId,
  editingItem,
  onSuccess,
}: Props) {
  const themeClasses = useThemeClasses();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const { data: itemCategories = [] } = useItemCategories();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<"reminder" | "event" | "task">(
    "task",
  );
  const [locationContext, setLocationContext] =
    useState<LocationContext | null>(null);
  const [locationUrl, setLocationUrl] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [recurrencePattern, setRecurrencePattern] =
    useState<RecurrencePattern | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [customRrule, setCustomRrule] = useState("");
  const [subtasksText, setSubtasksText] = useState("");
  const [priority, setPriority] = useState<CataloguePriority>("normal");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  // New fields: categories and visibility
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  const isLoading = createItem.isPending || updateItem.isPending;
  const isEditing = !!editingItem;

  // Reset form when opening/closing or editing different item
  useEffect(() => {
    if (open) {
      if (editingItem) {
        setName(editingItem.name);
        setDescription(editingItem.description || "");
        setItemType(editingItem.item_type || "task");
        setLocationContext(editingItem.location_context || null);
        setLocationUrl(editingItem.location_url || "");
        setPreferredTime(editingItem.preferred_time || "");
        setDurationMinutes(
          editingItem.preferred_duration_minutes?.toString() || "",
        );
        setRecurrencePattern(editingItem.recurrence_pattern || null);
        setRecurrenceDays(editingItem.recurrence_days_of_week || []);
        setCustomRrule(editingItem.recurrence_custom_rrule || "");
        setSubtasksText(editingItem.subtasks_text || "");
        setPriority(editingItem.priority);
        setTags(editingItem.tags || []);
        setSelectedCategoryIds(editingItem.item_category_ids || []);
        setIsPublic(editingItem.is_public || false);
      } else {
        // Reset to defaults
        setName("");
        setDescription("");
        setItemType("task");
        setLocationContext(null);
        setLocationUrl("");
        setPreferredTime("");
        setDurationMinutes("");
        setRecurrencePattern(null);
        setRecurrenceDays([]);
        setCustomRrule("");
        setSubtasksText("");
        setPriority("normal");
        setTags([]);
        setTagInput("");
        setSelectedCategoryIds([]);
        setIsPublic(false);
      }
    }
  }, [open, editingItem]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const toggleDay = (day: number) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter((d) => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  const toggleCategory = (categoryId: string) => {
    if (selectedCategoryIds.includes(categoryId)) {
      setSelectedCategoryIds(
        selectedCategoryIds.filter((id) => id !== categoryId),
      );
    } else {
      setSelectedCategoryIds([...selectedCategoryIds, categoryId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const itemData = {
        module_id: moduleId,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        item_type: itemType,
        location_context: locationContext || undefined,
        location_url: locationUrl.trim() || undefined,
        preferred_time: preferredTime || undefined,
        preferred_duration_minutes: durationMinutes
          ? parseInt(durationMinutes, 10)
          : undefined,
        recurrence_pattern: recurrencePattern || undefined,
        recurrence_days_of_week:
          recurrenceDays.length > 0 ? recurrenceDays : undefined,
        recurrence_custom_rrule:
          recurrencePattern === "custom" ? customRrule : undefined,
        subtasks_text: subtasksText.trim() || undefined,
        priority,
        tags: tags.length > 0 ? tags : undefined,
        item_category_ids:
          selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        is_public: isPublic,
      };

      let result: CatalogueItem;
      if (isEditing && editingItem) {
        result = await updateItem.mutateAsync({
          id: editingItem.id,
          ...itemData,
        });
      } else {
        result = await createItem.mutateAsync(itemData);
      }

      onOpenChange(false);
      onSuccess?.(result);
    } catch (error) {
      console.error("Failed to save task item:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[90vh] overflow-y-auto",
          themeClasses.surfaceBg,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-purple-400" />
            {isEditing ? "Edit Task Template" : "Create Task Template"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Item Type Selection */}
          <div className="space-y-2">
            <Label className="text-white/80 text-sm font-medium">
              Type <span className="text-red-400">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {ITEM_TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = itemType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setItemType(opt.value)}
                    className={cn(
                      "p-3 rounded-xl border transition-all text-left",
                      isSelected
                        ? `${opt.borderClass} ${opt.bgClass}`
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className={cn(
                          "w-4 h-4",
                          isSelected ? opt.textClass : "text-white/60",
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isSelected ? "text-white" : "text-white/80",
                        )}
                      >
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-xs text-white/50">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white/80 text-sm font-medium">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Water plants, Visit parents, Go to church..."
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white placeholder:text-white/40",
              )}
              autoFocus
            />
          </div>

          {/* Location Context */}
          <div className="space-y-2">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Where to do this?
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {LOCATION_OPTIONS.map((loc) => {
                const Icon = loc.icon;
                const isSelected = locationContext === loc.value;
                return (
                  <button
                    key={loc.value}
                    type="button"
                    onClick={() =>
                      setLocationContext(isSelected ? null : loc.value)
                    }
                    className={cn(
                      "p-3 rounded-xl border transition-all flex items-center gap-2",
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isSelected ? "text-cyan-400" : "text-white/60",
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        isSelected ? "text-white" : "text-white/80",
                      )}
                    >
                      {loc.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {locationContext === "outside" && (
              <Input
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                placeholder="Google Maps URL (optional)"
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40 mt-2",
                )}
              />
            )}
          </div>

          {/* Preferred Time & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="preferredTime"
                className="text-white/80 text-sm font-medium flex items-center gap-2"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                Preferred Time
              </Label>
              <Input
                id="preferredTime"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="duration"
                className="text-white/80 text-sm font-medium"
              >
                Duration (minutes)
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="30"
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40",
                )}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-3">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Repeat className="w-4 h-4 text-emerald-400" />
              Recurrence
            </Label>
            <Select
              value={recurrencePattern || "none"}
              onValueChange={(v) =>
                setRecurrencePattern(
                  v === "none" ? null : (v as RecurrencePattern),
                )
              }
            >
              <SelectTrigger
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              >
                <SelectValue placeholder="Select frequency..." />
              </SelectTrigger>
              <SelectContent
                className={cn(themeClasses.surfaceBg, themeClasses.border)}
              >
                <SelectItem value="none" className="text-white/60">
                  No recurrence
                </SelectItem>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-white"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Days of Week (for weekly/biweekly recurrence) */}
            {(recurrencePattern === "weekly" ||
              recurrencePattern === "biweekly") && (
              <div className="space-y-2">
                <Label className="text-white/60 text-xs">
                  {recurrencePattern === "biweekly"
                    ? "Repeat every other:"
                    : "Repeat on these days:"}
                </Label>
                <div className="flex gap-1">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = recurrenceDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          "w-9 h-9 rounded-full text-sm font-medium transition-all",
                          isSelected
                            ? "bg-emerald-500 text-white"
                            : "bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
                {recurrencePattern === "biweekly" &&
                  recurrenceDays.length > 0 && (
                    <p className="text-xs text-white/40">
                      Every other{" "}
                      {DAYS_OF_WEEK.filter((d) =>
                        recurrenceDays.includes(d.value),
                      )
                        .map((d) => d.label)
                        .join(", ")}
                    </p>
                  )}
              </div>
            )}

            {/* Custom RRULE */}
            {recurrencePattern === "custom" && (
              <div className="space-y-2">
                <Label className="text-white/60 text-xs">
                  Custom RRULE (iCal format):
                </Label>
                <Input
                  value={customRrule}
                  onChange={(e) => setCustomRrule(e.target.value)}
                  placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white placeholder:text-white/40 font-mono text-sm",
                  )}
                />
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label
              htmlFor="subtasks"
              className="text-white/80 text-sm font-medium flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4 text-blue-400" />
              Subtasks
            </Label>
            <p className="text-xs text-white/50 -mt-1">
              Add subtasks as bullet points. Each line becomes a subtask when
              added to calendar.
            </p>
            <Textarea
              id="subtasks"
              value={subtasksText}
              onChange={(e) => setSubtasksText(e.target.value)}
              placeholder="- Wipe counters&#10;- Clean stove&#10;- Mop floor&#10;- Empty trash"
              rows={4}
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white placeholder:text-white/40 font-mono",
              )}
            />
          </div>

          {/* Description / Notes */}
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-white/80 text-sm font-medium"
            >
              Additional Notes
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional context or instructions..."
              rows={3}
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white placeholder:text-white/40",
              )}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="text-white/80 text-sm font-medium">
              Priority
            </Label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                      isSelected
                        ? "border-transparent"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                    )}
                    style={
                      isSelected
                        ? {
                            backgroundColor: PRIORITY_COLORS[p] + "33",
                            color: PRIORITY_COLORS[p],
                          }
                        : undefined
                    }
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Tag className="w-4 h-4 text-pink-400" />
              Tags
            </Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag..."
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40 flex-1",
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                className="border-white/10"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-pink-500/20 text-pink-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-pink-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Categories (multi-select) */}
          <div className="space-y-2">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-orange-400" />
              Categories
            </Label>
            <div className="flex flex-wrap gap-2">
              {itemCategories.map((cat) => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5",
                      isSelected
                        ? "border-white/30 text-white"
                        : "border-white/10 text-white/60 hover:border-white/20 hover:text-white/80",
                    )}
                    style={{
                      backgroundColor: isSelected
                        ? `${cat.color_hex || "#888"}30`
                        : "transparent",
                      borderColor: isSelected
                        ? cat.color_hex || "#888"
                        : undefined,
                    }}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cat.color_hex || "#888" }}
                    />
                    {cat.name}
                  </button>
                );
              })}
            </div>
            {selectedCategoryIds.length > 0 && (
              <p className="text-xs text-white/40">
                {selectedCategoryIds.length} categor
                {selectedCategoryIds.length !== 1 ? "ies" : "y"} selected
              </p>
            )}
          </div>

          {/* Visibility (Public/Private) */}
          <div className="space-y-2">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              {isPublic ? (
                <Users className="w-4 h-4 text-emerald-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-slate-400" />
              )}
              Visibility
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  "p-3 rounded-xl border transition-all flex items-center gap-2",
                  !isPublic
                    ? "border-slate-500 bg-slate-500/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                <EyeOff
                  className={cn(
                    "w-4 h-4",
                    !isPublic ? "text-slate-400" : "text-white/60",
                  )}
                />
                <div className="text-left">
                  <span
                    className={cn(
                      "text-sm font-medium block",
                      !isPublic ? "text-white" : "text-white/80",
                    )}
                  >
                    Private
                  </span>
                  <span className="text-xs text-white/50">
                    Only visible to you
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  "p-3 rounded-xl border transition-all flex items-center gap-2",
                  isPublic
                    ? "border-emerald-500 bg-emerald-500/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                <Users
                  className={cn(
                    "w-4 h-4",
                    isPublic ? "text-emerald-400" : "text-white/60",
                  )}
                />
                <div className="text-left">
                  <span
                    className={cn(
                      "text-sm font-medium block",
                      isPublic ? "text-white" : "text-white/80",
                    )}
                  >
                    Household
                  </span>
                  <span className="text-xs text-white/50">
                    Shared with family
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="text-white/70 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Task"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
