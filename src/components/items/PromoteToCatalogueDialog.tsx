// src/components/items/PromoteToCatalogueDialog.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCatalogueCategories,
  useCatalogueModules,
} from "@/features/catalogue";
import { useItemCategories } from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type {
  CataloguePriority,
  FlexiblePeriod,
  LocationContext,
  RecurrencePattern,
} from "@/types/catalogue";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/types/catalogue";
import type { ItemWithDetails } from "@/types/items";
import {
  AlertCircle,
  BookMarked,
  CalendarClock,
  CheckSquare,
  Clock,
  EyeOff,
  Folder,
  Globe,
  Home,
  Link2,
  Loader2,
  MapPin,
  Plus,
  Repeat,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface PromoteToCatalogueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemWithDetails | null;
  onSuccess?: () => void;
}

const PRIORITY_OPTIONS: CataloguePriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
  "critical",
];

const ITEM_TYPE_OPTIONS = [
  {
    value: "event",
    label: "Event",
    icon: CalendarClock,
    description: "A scheduled event with duration",
    borderClass: "border-pink-500",
    bgClass: "bg-pink-500/20",
    textClass: "text-pink-400",
  },
  {
    value: "reminder",
    label: "Reminder",
    icon: AlertCircle,
    description: "Get notified at a specific time",
    borderClass: "border-cyan-500",
    bgClass: "bg-cyan-500/20",
    textClass: "text-cyan-400",
  },
  {
    value: "task",
    label: "Task",
    icon: CheckSquare,
    description: "A to-do item with optional due date",
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
];

const FLEXIBLE_PERIOD_OPTIONS: { value: FlexiblePeriod; label: string }[] = [
  { value: "weekly", label: "Once a Week" },
  { value: "biweekly", label: "Once Every 2 Weeks" },
  { value: "monthly", label: "Once a Month" },
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

export function PromoteToCatalogueDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: PromoteToCatalogueDialogProps) {
  const { data: modules = [] } = useCatalogueModules();
  const { data: itemCategories = [] } = useItemCategories();

  // Basic fields
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [keepLinked, setKeepLinked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Task-specific fields
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
  const [subtasksText, setSubtasksText] = useState("");
  const [priority, setPriority] = useState<CataloguePriority>("normal");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Flexible routine
  const [isFlexibleRoutine, setIsFlexibleRoutine] = useState(false);
  const [flexiblePeriod, setFlexiblePeriod] = useState<FlexiblePeriod | null>(
    null,
  );

  // Categories and visibility
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  // Get categories for selected module
  const { data: moduleCats = [] } = useCatalogueCategories(
    selectedModuleId || undefined,
  );

  // Find tasks module as default
  const tasksModule = useMemo(
    () => modules.find((m) => m.type === "tasks"),
    [modules],
  );

  // Initialize form when item changes or dialog opens
  useEffect(() => {
    if (item && open) {
      setTemplateName(item.title);
      setTemplateDescription(item.description || "");
      setSelectedModuleId(tasksModule?.id || "");
      setSelectedCategoryId("");
      setItemType(item.type as "reminder" | "event" | "task");
      setPriority((item.priority as CataloguePriority) || "normal");

      // Extract time from event/reminder
      if (item.type === "event" && item.event_details?.start_at) {
        const date = new Date(item.event_details.start_at);
        setPreferredTime(
          `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
        );
        // Calculate duration
        if (item.event_details.end_at) {
          const end = new Date(item.event_details.end_at);
          const mins = Math.round(
            (end.getTime() - date.getTime()) / (1000 * 60),
          );
          setDurationMinutes(mins > 0 ? mins.toString() : "");
        }
        // Location
        if (item.event_details.location_text) {
          setLocationUrl(item.event_details.location_text);
        }
      } else if (item.type === "reminder" && item.reminder_details?.due_at) {
        const date = new Date(item.reminder_details.due_at);
        setPreferredTime(
          `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
        );
      } else if (item.type === "task" && item.reminder_details?.due_at) {
        const date = new Date(item.reminder_details.due_at);
        setPreferredTime(
          `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
        );
      }

      // Extract recurrence
      if (item.recurrence_rule?.rrule) {
        const rrule = item.recurrence_rule.rrule;
        if (rrule.includes("FREQ=DAILY")) {
          setRecurrencePattern("daily");
        } else if (rrule.includes("FREQ=WEEKLY")) {
          if (rrule.includes("INTERVAL=2")) {
            setRecurrencePattern("biweekly");
          } else {
            setRecurrencePattern("weekly");
          }
          // Extract days
          const byDayMatch = rrule.match(/BYDAY=([^;]+)/);
          if (byDayMatch) {
            const dayMap: Record<string, number> = {
              SU: 0,
              MO: 1,
              TU: 2,
              WE: 3,
              TH: 4,
              FR: 5,
              SA: 6,
            };
            const days = byDayMatch[1].split(",").map((d) => dayMap[d] ?? -1);
            setRecurrenceDays(days.filter((d) => d >= 0));
          }
        } else if (rrule.includes("FREQ=MONTHLY")) {
          if (rrule.includes("INTERVAL=3")) {
            setRecurrencePattern("quarterly");
          } else {
            setRecurrencePattern("monthly");
          }
        } else if (rrule.includes("FREQ=YEARLY")) {
          setRecurrencePattern("yearly");
        }
      } else {
        setRecurrencePattern(null);
        setRecurrenceDays([]);
      }

      // Subtasks
      if (item.subtasks && item.subtasks.length > 0) {
        setSubtasksText(item.subtasks.map((s) => `- ${s.title}`).join("\n"));
      } else {
        setSubtasksText("");
      }

      // Reset other fields
      setLocationContext(null);
      setTags([]);
      setTagInput("");
      setIsFlexibleRoutine(false);
      setFlexiblePeriod(null);
      setSelectedCategoryIds([]);
      setIsPublic(false);
      setKeepLinked(true);
    }
  }, [item, open, tasksModule?.id]);

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

  const handleSubmit = async () => {
    if (!item) return;
    if (!selectedModuleId) {
      toast.error("Please select a module");
      return;
    }
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/items/${item.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: selectedModuleId,
          category_id: selectedCategoryId || null,
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          keep_linked: keepLinked,
          // Task-specific fields
          item_type: itemType,
          location_context: locationContext,
          location_url: locationUrl.trim() || null,
          preferred_time: preferredTime || null,
          preferred_duration_minutes: durationMinutes
            ? parseInt(durationMinutes, 10)
            : null,
          recurrence_pattern: recurrencePattern,
          recurrence_days_of_week:
            recurrenceDays.length > 0 && !isFlexibleRoutine
              ? recurrenceDays
              : [],
          subtasks_text: subtasksText.trim() || null,
          priority,
          tags: tags.length > 0 ? tags : [],
          is_flexible_routine: isFlexibleRoutine,
          flexible_period: isFlexibleRoutine ? flexiblePeriod : null,
          item_category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : [],
          is_public: isPublic,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to promote item");
      }

      toast.success("Promoted to Catalogue!", {
        description: keepLinked
          ? "Item is now linked to the new template"
          : "Template created (item remains standalone)",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to promote item:", error);
      toast.error("Failed to promote item", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900/95 border-white/10 backdrop-blur-xl max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-white flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-pink-400" />
            Promote to Catalogue
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Create a reusable template from{" "}
            <span className="text-white/80">&quot;{item.title}&quot;</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 -mx-6 px-6 overflow-y-auto overscroll-contain touch-pan-y">
          <div className="space-y-6 py-4 pr-2">
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

            {/* Template Name */}
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-white/80 text-sm font-medium"
              >
                Template Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-white/80 text-sm font-medium"
              >
                Description
              </Label>
              <Textarea
                id="description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Add a description..."
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
              />
            </div>

            {/* Module & Category Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Module Selection */}
              <div className="space-y-2">
                <Label className="text-white/80 text-sm font-medium">
                  Module <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={selectedModuleId}
                  onValueChange={(v) => {
                    setSelectedModuleId(v);
                    setSelectedCategoryId("");
                  }}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {modules.map((module) => (
                      <SelectItem
                        key={module.id}
                        value={module.id}
                        className="text-white hover:bg-white/10"
                      >
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-cyan-400" />
                          {module.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Module Category Selection */}
              <div className="space-y-2">
                <Label className="text-white/80 text-sm font-medium">
                  Folder
                </Label>
                <Select
                  value={selectedCategoryId || "__none__"}
                  onValueChange={(v) =>
                    setSelectedCategoryId(v === "__none__" ? "" : v)
                  }
                  disabled={!selectedModuleId || moduleCats.length === 0}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem
                      value="__none__"
                      className="text-white/60 hover:bg-white/10"
                    >
                      No folder
                    </SelectItem>
                    {moduleCats.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        className="text-white hover:bg-white/10"
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location Context */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                Where to do this?
              </Label>
              <div className="flex gap-2">
                {LOCATION_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = locationContext === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setLocationContext(isSelected ? null : opt.value)
                      }
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border transition-all",
                        isSelected
                          ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location URL (for outside) */}
            {locationContext === "outside" && (
              <div className="space-y-2">
                <Label className="text-white/80 text-sm font-medium">
                  Location / Address
                </Label>
                <Input
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  placeholder="Google Maps link or address..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
            )}

            {/* Time & Duration Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Preferred Time
                </Label>
                <Input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              {itemType === "event" && (
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm font-medium">
                    Duration (minutes)
                  </Label>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="60"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm font-medium">
                Priority
              </Label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all capitalize",
                      priority === p
                        ? `${PRIORITY_COLORS[p]} border-current`
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                    )}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Flexible Routine Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-white font-medium text-sm">
                    Flexible Routine
                  </p>
                  <p className="text-white/50 text-xs">
                    Complete anytime within a period
                  </p>
                </div>
              </div>
              <Switch
                checked={isFlexibleRoutine}
                onCheckedChange={setIsFlexibleRoutine}
              />
            </div>

            {isFlexibleRoutine && (
              <div className="space-y-2">
                <Label className="text-white/80 text-sm font-medium">
                  Flexible Period
                </Label>
                <Select
                  value={flexiblePeriod || ""}
                  onValueChange={(v) =>
                    setFlexiblePeriod(v as FlexiblePeriod | null)
                  }
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {FLEXIBLE_PERIOD_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-white hover:bg-white/10"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Recurrence (if not flexible) */}
            {!isFlexibleRoutine && (
              <>
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-purple-400" />
                    Recurrence Pattern
                  </Label>
                  <Select
                    value={recurrencePattern || "__none__"}
                    onValueChange={(v) =>
                      setRecurrencePattern(
                        v === "__none__" ? null : (v as RecurrencePattern),
                      )
                    }
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="No recurrence" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10">
                      <SelectItem
                        value="__none__"
                        className="text-white/60 hover:bg-white/10"
                      >
                        No recurrence
                      </SelectItem>
                      {RECURRENCE_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-white hover:bg-white/10"
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Days of Week */}
                {(recurrencePattern === "weekly" ||
                  recurrencePattern === "biweekly") && (
                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm font-medium">
                      Days of Week
                    </Label>
                    <div className="flex gap-1">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                            recurrenceDays.includes(day.value)
                              ? "bg-purple-500/30 text-purple-300 border border-purple-500"
                              : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10",
                          )}
                        >
                          {day.short}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subtasks */}
            {itemType === "task" && (
              <div className="space-y-2">
                <Label className="text-white/80 text-sm font-medium">
                  Subtasks (one per line)
                </Label>
                <Textarea
                  value={subtasksText}
                  onChange={(e) => setSubtasksText(e.target.value)}
                  placeholder="- First subtask&#10;- Second subtask&#10;- Third subtask"
                  rows={3}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none font-mono text-sm"
                />
              </div>
            )}

            {/* Item Categories (Personal, Work, etc.) */}
            {itemCategories.length > 0 && (
              <div className="space-y-2">
                <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4 text-cyan-400" />
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
                          "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                          isSelected
                            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500"
                            : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10",
                        )}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm font-medium">Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a tag..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTag}
                  className="shrink-0 border-white/10 text-white hover:bg-white/10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-white/80 text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-white/40 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <Users className="h-5 w-5 text-green-400" />
                ) : (
                  <EyeOff className="h-5 w-5 text-white/40" />
                )}
                <div>
                  <p className="text-white font-medium text-sm">
                    {isPublic ? "Visible to Household" : "Private"}
                  </p>
                  <p className="text-white/50 text-xs">
                    {isPublic
                      ? "Your partner can see this template"
                      : "Only you can see this template"}
                  </p>
                </div>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            {/* Keep Linked Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-white font-medium text-sm">Keep linked</p>
                  <p className="text-white/50 text-xs">
                    This item will sync with the template
                  </p>
                </div>
              </div>
              <Switch checked={keepLinked} onCheckedChange={setKeepLinked} />
            </div>

            {/* Info Box */}
            <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-pink-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-white/80">
                    {keepLinked
                      ? "Future edits to this item can optionally update the template."
                      : "The template will be created independently."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t border-white/10">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedModuleId || !templateName.trim()}
            className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white hover:opacity-90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <BookMarked className="h-4 w-4 mr-2" />
                Create Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
