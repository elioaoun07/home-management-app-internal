"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme } from "@/contexts/ThemeContext";
import {
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  useItemActionsWithToast,
  useUndoOccurrenceAction,
  type PostponeType,
} from "@/features/items/useItemActions";
import {
  useAllSubtaskCompletions,
  useDeleteItem,
  useItems,
} from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ItemType, ItemWithDetails } from "@/types/items";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  Bell,
  Briefcase,
  Cake,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  FastForward,
  Filter,
  Heart,
  Home,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Repeat,
  RotateCcw,
  Target,
  Trash2,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ItemSubtasksList } from "./ItemSubtasks";
import { WebCalendar } from "./WebCalendar";
import { WebEventFormDialog } from "./WebEventFormDialog";
import WebEventsDashboard from "./WebEventsDashboard";
import WebTabletMissionControl from "./WebTabletMissionControl";
import { WebWeekView } from "./WebWeekView";

// Item type filters
const typeFilters = [
  { id: "all", label: "All", icon: CalendarDays },
  { id: "event", label: "Events", icon: Calendar },
  { id: "reminder", label: "Reminders", icon: Bell },
  { id: "task", label: "Tasks", icon: ListTodo },
] as const;

type TypeFilter = (typeof typeFilters)[number]["id"];

// Category filters
const CATEGORIES = [
  { id: "personal", name: "Personal", color: "#8B5CF6", icon: User },
  { id: "home", name: "Home", color: "#1E90FF", icon: Home },
  { id: "family", name: "Family", color: "#FFA500", icon: Users },
  { id: "community", name: "Community", color: "#22C55E", icon: Heart },
  { id: "friends", name: "Friends", color: "#EC4899", icon: Users },
  { id: "work", name: "Work", color: "#FF3B30", icon: Briefcase },
] as const;

// Item type colors for styling
const typeColors: Record<
  ItemType,
  { bg: string; border: string; text: string }
> = {
  reminder: {
    bg: "bg-cyan-500/20",
    border: "border-l-cyan-400",
    text: "text-cyan-300",
  },
  event: {
    bg: "bg-pink-500/20",
    border: "border-l-pink-400",
    text: "text-pink-300",
  },
  task: {
    bg: "bg-purple-500/20",
    border: "border-l-purple-400",
    text: "text-purple-300",
  },
};

export default function WebEvents() {
  const { theme } = useTheme();
  const themeClasses = useThemeClasses();
  const isPink = theme === "pink";
  const deleteItem = useDeleteItem();
  const itemActions = useItemActionsWithToast();

  // State
  const [mainView, setMainView] = useState<
    "calendar" | "dashboard" | "mission-control"
  >("mission-control");
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formInitialDate, setFormInitialDate] = useState<Date | undefined>();
  const [editingItem, setEditingItem] = useState<ItemWithDetails | null>(null);
  const [formDefaultType, setFormDefaultType] = useState<ItemType>("event");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [detailItem, setDetailItem] = useState<ItemWithDetails | null>(null);
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [pendingEditItem, setPendingEditItem] =
    useState<ItemWithDetails | null>(null);
  const [modalPosition, setModalPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [prefillTitle, setPrefillTitle] = useState<string | undefined>();
  const [prefillCategory, setPrefillCategory] = useState<string | undefined>();

  // Item action states
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showPostponeDialog, setShowPostponeDialog] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [customPostponeDate, setCustomPostponeDate] = useState<string>("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [clickedOccurrenceDate, setClickedOccurrenceDate] =
    useState<Date | null>(null);

  // Helper: Check if item is recurring
  const isRecurring = useCallback((item: ItemWithDetails | null) => {
    return !!item?.recurrence_rule?.rrule;
  }, []);

  // Helper: Get occurrence date from item (uses clickedOccurrenceDate for recurring items)
  const getOccurrenceDate = useCallback(
    (item: ItemWithDetails | null): Date => {
      if (!item) return new Date();

      // For recurring items, use the clicked occurrence date if available
      if (item.recurrence_rule?.rrule && clickedOccurrenceDate) {
        return clickedOccurrenceDate;
      }

      const dateStr =
        item.type === "reminder" || item.type === "task"
          ? item.reminder_details?.due_at
          : item.type === "event"
            ? item.event_details?.start_at
            : null;
      return dateStr ? parseISO(dateStr) : new Date();
    },
    [clickedOccurrenceDate]
  );

  // Action handlers
  const handleCompleteAction = useCallback(() => {
    if (!detailItem) return;
    itemActions.handleComplete(
      detailItem,
      getOccurrenceDate(detailItem).toISOString(),
      actionReason || undefined
    );
    setDetailItem(null);
    setClickedOccurrenceDate(null);
    setModalPosition(null);
    setShowActionDialog(false);
    setActionReason("");
  }, [detailItem, itemActions, getOccurrenceDate, actionReason]);

  const handlePostponeAction = useCallback(
    (postponeType: PostponeType, customDate?: string) => {
      if (!detailItem) return;
      itemActions.handlePostpone(
        detailItem,
        getOccurrenceDate(detailItem).toISOString(),
        postponeType,
        actionReason || undefined,
        customDate
      );
      setDetailItem(null);
      setClickedOccurrenceDate(null);
      setModalPosition(null);
      setShowPostponeDialog(false);
      setShowCustomDatePicker(false);
      setCustomPostponeDate("");
      setActionReason("");
    },
    [detailItem, itemActions, getOccurrenceDate, actionReason]
  );

  const handleCancelAction = useCallback(() => {
    if (!detailItem) return;
    itemActions.handleCancel(
      detailItem,
      getOccurrenceDate(detailItem).toISOString(),
      actionReason || undefined
    );
    setDetailItem(null);
    setClickedOccurrenceDate(null);
    setModalPosition(null);
    setShowActionDialog(false);
    setActionReason("");
  }, [detailItem, itemActions, getOccurrenceDate, actionReason]);

  // Fetch all items
  const { data: allItems = [], isLoading } = useItems();

  // Fetch occurrence actions for filtering completed/postponed items
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  // Undo occurrence action mutation
  const undoAction = useUndoOccurrenceAction();

  // Helper: Check if the clicked occurrence is completed and get the action ID
  const getCompletedOccurrenceAction = useCallback(() => {
    if (!detailItem || !clickedOccurrenceDate) return null;

    // Check if this occurrence is completed
    const isCompleted = isOccurrenceCompleted(
      detailItem.id,
      clickedOccurrenceDate,
      occurrenceActions
    );

    if (!isCompleted) return null;

    // Find the action ID for undo
    const targetDateStr = clickedOccurrenceDate.toISOString().split("T")[0];
    const action = occurrenceActions.find(
      (a) =>
        a.item_id === detailItem.id &&
        a.action_type === "completed" &&
        a.occurrence_date.split("T")[0] === targetDateStr
    );

    return action || null;
  }, [detailItem, clickedOccurrenceDate, occurrenceActions]);

  // Undo handler
  const handleUndoAction = useCallback(async () => {
    const action = getCompletedOccurrenceAction();
    if (!action) return;

    try {
      await undoAction.mutateAsync(action.id);
      toast.success("Action undone");
      setDetailItem(null);
      setClickedOccurrenceDate(null);
      setModalPosition(null);
    } catch (error) {
      toast.error("Failed to undo action");
      console.error(error);
    }
  }, [getCompletedOccurrenceAction, undoAction]);

  // Check if current occurrence is completed
  const isCurrentOccurrenceCompleted = !!getCompletedOccurrenceAction();

  // Fetch subtask completions for recurring item subtasks
  const { data: subtaskCompletions = [] } = useAllSubtaskCompletions();

  // Sync detailItem with allItems to get optimistic updates
  useEffect(() => {
    if (detailItem) {
      const updatedItem = allItems.find((item) => item.id === detailItem.id);
      if (
        updatedItem &&
        JSON.stringify(updatedItem) !== JSON.stringify(detailItem)
      ) {
        setDetailItem(updatedItem);
      }
    }
  }, [allItems, detailItem]);

  // Filter items by type and category
  const filteredItems = allItems.filter((item) => {
    // Filter by type
    const typeMatch = typeFilter === "all" || item.type === typeFilter;

    // Filter by category (if any categories are selected)
    const categoryMatch =
      selectedCategories.length === 0 ||
      (item.categories &&
        item.categories.some((cat) => selectedCategories.includes(cat)));

    return typeMatch && categoryMatch;
  });

  // Handle opening the form for a new item
  const handleAddEvent = (date: Date) => {
    setFormInitialDate(date);
    setEditingItem(null);
    setFormDefaultType("event");
    setPrefillTitle(undefined);
    setPrefillCategory(undefined);
    setIsFormOpen(true);
  };

  // Handle birthday click to convert to event
  const handleBirthdayClick = (
    birthday: { name: string; category?: string },
    date: Date
  ) => {
    setFormInitialDate(date);
    setEditingItem(null);
    setFormDefaultType("event");
    setPrefillTitle(birthday.name);
    setPrefillCategory(birthday.category || "family");
    setIsFormOpen(true);
  };

  // Handle clicking on an item to view/edit it
  const handleItemClick = (
    item: ItemWithDetails,
    event: React.MouseEvent,
    occurrenceDate?: Date
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setModalPosition({
      x: rect.right + 10,
      y: rect.top,
    });
    setDetailItem(item);
    // Store the occurrence date for recurring items
    setClickedOccurrenceDate(occurrenceDate || null);
  };

  // Handle editing an item
  const handleEditItem = (item: ItemWithDetails) => {
    // Check if this is a recurring event
    if (item.recurrence_rule) {
      setPendingEditItem(item);
      setShowRecurringDialog(true);
      setDetailItem(null);
    } else {
      setEditingItem(item);
      setFormDefaultType(item.type);
      setIsFormOpen(true);
      setDetailItem(null);
    }
  };

  // Handle recurring edit choice
  const handleRecurringEditChoice = (choice: "this" | "all") => {
    if (!pendingEditItem) return;

    if (choice === "all") {
      setEditingItem(pendingEditItem);
      setFormDefaultType(pendingEditItem.type);
      setIsFormOpen(true);
    } else {
      // TODO: Implement "edit this occurrence" - requires exception system
      alert(
        "Editing single occurrences coming soon! For now, editing the entire series."
      );
      setEditingItem(pendingEditItem);
      setFormDefaultType(pendingEditItem.type);
      setIsFormOpen(true);
    }

    setShowRecurringDialog(false);
    setPendingEditItem(null);
  };

  // Handle delete item
  const handleDeleteItem = async () => {
    if (!detailItem) return;

    const itemToDelete = detailItem;
    const itemId = detailItem.id;
    const itemTitle = detailItem.title;

    try {
      await deleteItem.mutateAsync(itemId);
      setDetailItem(null);
      setModalPosition(null);

      toast.success(`"${itemTitle}" deleted`, {
        action: {
          label: "Undo",
          onClick: async () => {
            // Note: Implement restore functionality when backend supports it
            toast.info("Undo delete coming soon");
          },
        },
      });
    } catch (error) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item");
    }
  };

  // Format recurrence rule for display
  const formatRecurrence = (item: ItemWithDetails): string | null => {
    if (!item.recurrence_rule?.rrule) return null;

    const rrule = item.recurrence_rule.rrule;

    if (rrule.includes("FREQ=DAILY")) return "Daily";
    if (rrule.includes("FREQ=WEEKLY")) {
      const interval = rrule.match(/INTERVAL=(\d+)/)?.[1];
      if (interval === "2") {
        const start =
          item.event_details?.start_at || item.reminder_details?.due_at;
        if (start) {
          const day = format(parseISO(start), "EEEE");
          return `Every 2 weeks on ${day}`;
        }
        return "Every 2 weeks";
      }
      return "Weekly";
    }
    if (rrule.includes("FREQ=MONTHLY")) return "Monthly";
    if (rrule.includes("FREQ=YEARLY")) return "Yearly";

    return "Custom recurrence";
  };

  // Check if location is a URL
  const isUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch {
      return text.startsWith("http://") || text.startsWith("https://");
    }
  };

  // Get location URL (Google Maps link or search)
  const getLocationUrl = (location: string): string => {
    if (isUrl(location)) {
      return location;
    }
    // Only create Google Maps search if location looks like an actual place
    // Avoid opening maps for generic text like "Test"
    if (location.length > 2 && !location.toLowerCase().includes("location:")) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    }
    return "";
  };

  // Handle closing the form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
    setFormInitialDate(undefined);
  };

  // Quick add buttons for different item types
  const QuickAddButtons = () => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setFormDefaultType("event");
          setFormInitialDate(selectedDate || new Date());
          setEditingItem(null);
          setIsFormOpen(true);
        }}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
          "bg-pink-500/20 text-pink-300 border border-pink-500/30",
          "hover:bg-pink-500/30 hover:scale-105 active:scale-95"
        )}
      >
        <Calendar className="w-4 h-4" />
        Event
      </button>
      <button
        type="button"
        onClick={() => {
          setFormDefaultType("reminder");
          setFormInitialDate(selectedDate || new Date());
          setEditingItem(null);
          setIsFormOpen(true);
        }}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
          "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
          "hover:bg-cyan-500/30 hover:scale-105 active:scale-95"
        )}
      >
        <Bell className="w-4 h-4" />
        Reminder
      </button>
      <button
        type="button"
        onClick={() => {
          setFormDefaultType("task");
          setFormInitialDate(selectedDate || new Date());
          setEditingItem(null);
          setIsFormOpen(true);
        }}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
          "bg-purple-500/20 text-purple-300 border border-purple-500/30",
          "hover:bg-purple-500/30 hover:scale-105 active:scale-95"
        )}
      >
        <ListTodo className="w-4 h-4" />
        Task
      </button>
    </div>
  );

  return (
    <div className={cn("min-h-screen pb-20", themeClasses.pageBg)}>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a1628]/95 backdrop-blur-lg border-t border-white/10">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            <button
              type="button"
              onClick={() => setMainView("mission-control")}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                mainView === "mission-control"
                  ? isPink
                    ? "bg-pink-500/20 text-pink-400"
                    : "bg-cyan-500/20 text-cyan-400"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              <Target className="w-5 h-5" />
              <span className="text-xs font-medium">Focus</span>
            </button>
            <button
              type="button"
              onClick={() => setMainView("calendar")}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                mainView === "calendar"
                  ? isPink
                    ? "bg-pink-500/20 text-pink-400"
                    : "bg-cyan-500/20 text-cyan-400"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              <CalendarDays className="w-5 h-5" />
              <span className="text-xs font-medium">Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setMainView("dashboard")}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                mainView === "dashboard"
                  ? isPink
                    ? "bg-pink-500/20 text-pink-400"
                    : "bg-cyan-500/20 text-cyan-400"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-xs font-medium">Stats</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mission Control View (Default for Tablet) */}
      {mainView === "mission-control" && (
        <WebTabletMissionControl
          onItemClick={handleItemClick}
          onAddEvent={handleAddEvent}
        />
      )}

      {/* Dashboard View */}
      {mainView === "dashboard" && <WebEventsDashboard />}

      {/* Calendar View */}
      {mainView === "calendar" && (
        <div className="p-2 lg:p-6">
          <div className="max-w-[1600px] mx-auto">
            {/* Compact toolbar - touch-friendly buttons */}
            <div className="flex items-center justify-between gap-2 mb-1.5 lg:mb-4">
              {/* Left side: View toggle + Type filters */}
              <div className="flex items-center gap-2 lg:gap-2">
                {/* View Toggle */}
                <div className="flex items-center p-0.5 bg-white/5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setView("month")}
                    className={cn(
                      "p-2.5 lg:px-3 lg:py-2 rounded-md transition-all",
                      view === "month"
                        ? "neo-gradient text-white"
                        : "text-white/50 hover:text-white"
                    )}
                    title="Month view"
                  >
                    <CalendarDays className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("week")}
                    className={cn(
                      "p-2.5 lg:px-3 lg:py-2 rounded-md transition-all",
                      view === "week"
                        ? "neo-gradient text-white"
                        : "text-white/50 hover:text-white"
                    )}
                    title="Week view"
                  >
                    <Calendar className="w-5 h-5" />
                  </button>
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-white/10" />

                {/* Type Filter */}
                <div className="flex items-center p-0.5 bg-white/5 rounded-lg">
                  {typeFilters.map((filter) => {
                    const Icon = filter.icon;
                    const isActive = typeFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setTypeFilter(filter.id)}
                        className={cn(
                          "p-2.5 lg:px-3 lg:py-2 rounded-md transition-all",
                          isActive
                            ? "neo-gradient text-white"
                            : "text-white/50 hover:text-white"
                        )}
                        title={filter.label}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-white/10" />

                {/* Birthday Toggle */}
                <button
                  type="button"
                  onClick={() => setShowBirthdays(!showBirthdays)}
                  className={cn(
                    "p-2.5 rounded-lg transition-all",
                    showBirthdays
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-white/40 hover:text-white/60"
                  )}
                  title="Show birthdays"
                >
                  <Cake className="w-5 h-5" />
                </button>

                {/* Category Filter Dropdown */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1 p-2.5 rounded-lg transition-all",
                        selectedCategories.length > 0
                          ? isPink
                            ? "bg-pink-500/20 text-pink-300"
                            : "bg-cyan-500/20 text-cyan-300"
                          : "text-white/40 hover:text-white/60"
                      )}
                      title="Filter by category"
                    >
                      <Filter className="w-5 h-5" />
                      {selectedCategories.length > 0 && (
                        <span className="text-xs font-bold">
                          {selectedCategories.length}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-48 p-2 bg-gray-900/95 backdrop-blur-xl border-white/10"
                    align="start"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-white/70">
                          Categories
                        </span>
                        {selectedCategories.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategories([])}
                            className="text-[10px] text-white/50 hover:text-white"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      {CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        const isSelected = selectedCategories.includes(
                          category.id
                        );
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategories((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== category.id)
                                  : [...prev, category.id]
                              );
                            }}
                            className={cn(
                              "flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs font-medium transition-all",
                              isSelected
                                ? "text-white"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                            )}
                            style={{
                              backgroundColor: isSelected
                                ? category.color
                                : undefined,
                            }}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {category.name}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Right side: Quick add buttons */}
              <QuickAddButtons />
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center h-[600px]">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className={cn(
                      "w-12 h-12 mx-auto mb-4 border-4 rounded-full",
                      isPink
                        ? "border-pink-500/30 border-t-pink-400"
                        : "border-cyan-500/30 border-t-cyan-400"
                    )}
                  />
                  <p className="text-white/60">Loading your events...</p>
                </div>
              </div>
            )}

            {/* Main Calendar View */}
            {!isLoading && view === "month" && (
              <WebCalendar
                items={filteredItems}
                occurrenceActions={occurrenceActions}
                subtaskCompletions={subtaskCompletions}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onItemClick={handleItemClick}
                onAddEvent={handleAddEvent}
                onBirthdayClick={handleBirthdayClick}
                showBirthdays={showBirthdays}
              />
            )}

            {/* Week View */}
            {!isLoading && view === "week" && (
              <WebWeekView
                items={filteredItems}
                occurrenceActions={occurrenceActions}
                subtaskCompletions={subtaskCompletions}
                selectedDate={selectedDate}
                onItemClick={handleItemClick}
                onAddEvent={handleAddEvent}
                onBirthdayClick={handleBirthdayClick}
                showBirthdays={showBirthdays}
              />
            )}

            {/* Item Detail Modal (Floating near item) */}
            {detailItem && modalPosition && (
              <>
                {/* Backdrop with stronger blur */}
                <div
                  className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
                  onClick={() => {
                    setDetailItem(null);
                    setClickedOccurrenceDate(null);
                    setModalPosition(null);
                  }}
                />

                {/* Floating Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="fixed z-[101] w-[420px] rounded-2xl overflow-hidden border-2"
                  style={{
                    left: Math.min(modalPosition.x, window.innerWidth - 440),
                    top: Math.min(modalPosition.y, window.innerHeight - 600),
                    maxHeight: "calc(100vh - 40px)",
                    backgroundColor: "rgba(15, 23, 42, 0.98)",
                    borderColor: isPink
                      ? "rgba(236, 72, 153, 0.5)"
                      : "rgba(34, 211, 238, 0.5)",
                    boxShadow: isPink
                      ? "0 20px 60px rgba(236, 72, 153, 0.3), 0 0 0 1px rgba(236, 72, 153, 0.2)"
                      : "0 20px 60px rgba(34, 211, 238, 0.3), 0 0 0 1px rgba(34, 211, 238, 0.2)",
                  }}
                >
                  {/* Action Bar */}
                  <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-1">
                      {/* Undo button for completed occurrences */}
                      {isCurrentOccurrenceCompleted && (
                        <button
                          type="button"
                          onClick={handleUndoAction}
                          className="p-2 rounded-full hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                          title="Undo completion"
                        >
                          <RotateCcw className="w-4 h-4 text-amber-400" />
                          <span className="text-xs text-amber-400">Undo</span>
                        </button>
                      )}
                      {/* Complete button - only show for non-completed occurrences */}
                      {!isCurrentOccurrenceCompleted &&
                        detailItem.status !== "completed" && (
                          <button
                            type="button"
                            onClick={handleCompleteAction}
                            className="p-2 rounded-full hover:bg-green-500/20 transition-colors"
                            title="Complete"
                          >
                            <Check className="w-4 h-4 text-green-400" />
                          </button>
                        )}
                      {/* Postpone button - only show for non-completed occurrences */}
                      {!isCurrentOccurrenceCompleted &&
                        detailItem.status !== "completed" && (
                          <button
                            type="button"
                            onClick={() => setShowPostponeDialog(true)}
                            className={cn(
                              "p-2 rounded-full hover:bg-amber-500/20 transition-colors",
                              isPink
                                ? "hover:bg-pink-500/20"
                                : "hover:bg-cyan-500/20"
                            )}
                            title="Postpone"
                          >
                            <FastForward className="w-4 h-4 text-amber-400" />
                          </button>
                        )}
                      {/* Cancel occurrence button - only show for non-completed occurrences */}
                      {!isCurrentOccurrenceCompleted &&
                        detailItem.status !== "completed" && (
                          <button
                            type="button"
                            onClick={handleCancelAction}
                            className="p-2 rounded-full hover:bg-red-500/20 transition-colors"
                            title={
                              isRecurring(detailItem)
                                ? "Cancel this occurrence"
                                : "Cancel"
                            }
                          >
                            <XCircle className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      <div className="w-px h-4 bg-white/20 mx-1" />
                      <button
                        type="button"
                        onClick={() => {
                          handleEditItem(detailItem);
                          setDetailItem(null);
                          setModalPosition(null);
                        }}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-white/70" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleDeleteItem();
                          setModalPosition(null);
                        }}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-white/70" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailItem(null);
                        setModalPosition(null);
                      }}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4 text-white/70" />
                    </button>
                  </div>

                  {/* Content */}
                  <div
                    className="p-5 space-y-4 overflow-y-auto"
                    style={{ maxHeight: "calc(100vh - 120px)" }}
                  >
                    {/* Color indicator strip */}
                    <div
                      className={cn(
                        "w-1 h-16 rounded-full absolute left-0 top-16",
                        detailItem.type === "event" && "bg-pink-400",
                        detailItem.type === "reminder" && "bg-cyan-400",
                        detailItem.type === "task" && "bg-purple-400"
                      )}
                    />

                    {/* Title */}
                    <div className="pl-3">
                      <h2
                        className={cn(
                          "text-xl font-medium mb-1",
                          isCurrentOccurrenceCompleted
                            ? "text-green-300 line-through"
                            : "text-white"
                        )}
                      >
                        {detailItem.title}
                      </h2>
                      {(detailItem.status === "completed" ||
                        isCurrentOccurrenceCompleted) && (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Completed</span>
                        </div>
                      )}
                    </div>

                    {/* Date/Time */}
                    <div className="flex items-start gap-3 pl-3">
                      <Clock className="w-5 h-5 text-white/40 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {detailItem.type === "event" &&
                          detailItem.event_details && (
                            <>
                              <div className="text-white text-sm">
                                {format(
                                  parseISO(detailItem.event_details.start_at),
                                  "EEEE, MMMM d"
                                )}
                              </div>
                              {!detailItem.event_details.all_day ? (
                                <div className="text-white/70 text-sm">
                                  {format(
                                    parseISO(detailItem.event_details.start_at),
                                    "h:mm a"
                                  )}{" "}
                                  –{" "}
                                  {format(
                                    parseISO(detailItem.event_details.end_at),
                                    "h:mm a"
                                  )}
                                </div>
                              ) : (
                                <div className="text-white/70 text-sm">
                                  All day
                                </div>
                              )}
                            </>
                          )}
                        {(detailItem.type === "reminder" ||
                          detailItem.type === "task") &&
                          detailItem.reminder_details?.due_at && (
                            <>
                              <div className="text-white text-sm">
                                {format(
                                  parseISO(detailItem.reminder_details.due_at),
                                  "EEEE, MMMM d"
                                )}
                              </div>
                              <div className="text-white/70 text-sm">
                                {format(
                                  parseISO(detailItem.reminder_details.due_at),
                                  "h:mm a"
                                )}
                              </div>
                            </>
                          )}

                        {/* Recurrence */}
                        {formatRecurrence(detailItem) && (
                          <div className="flex items-center gap-1.5 mt-1 text-white/60 text-xs">
                            <Repeat className="w-3.5 h-3.5" />
                            <span>{formatRecurrence(detailItem)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    {detailItem.type === "event" &&
                      detailItem.event_details?.location_text && (
                        <div className="flex items-start gap-3 pl-3">
                          <MapPin className="w-5 h-5 text-white/40 mt-0.5 flex-shrink-0" />
                          {getLocationUrl(
                            detailItem.event_details.location_text
                          ) ? (
                            <a
                              href={getLocationUrl(
                                detailItem.event_details.location_text
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 text-sm underline decoration-cyan-400/30 hover:decoration-cyan-300 transition-colors cursor-pointer"
                            >
                              {detailItem.event_details.location_text}
                            </a>
                          ) : (
                            <div className="text-white/80 text-sm">
                              {detailItem.event_details.location_text}
                            </div>
                          )}
                        </div>
                      )}

                    {/* Alert */}
                    {detailItem.alerts && detailItem.alerts.length > 0 && (
                      <div className="flex items-start gap-3 pl-3">
                        <Bell className="w-5 h-5 text-white/40 mt-0.5 flex-shrink-0" />
                        <div className="text-white/60 text-sm">
                          {detailItem.alerts[0].offset_minutes === 15 &&
                            "15 minutes before"}
                          {detailItem.alerts[0].offset_minutes === 30 &&
                            "30 minutes before"}
                          {detailItem.alerts[0].offset_minutes === 60 &&
                            "1 hour before"}
                          {detailItem.alerts[0].offset_minutes === 1440 &&
                            "1 day before"}
                          {![15, 30, 60, 1440].includes(
                            detailItem.alerts[0].offset_minutes || 0
                          ) &&
                            `${detailItem.alerts[0].offset_minutes} minutes before`}
                        </div>
                      </div>
                    )}

                    {/* Type & Priority */}
                    <div className="flex items-center gap-2 pl-3">
                      <span
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium capitalize",
                          typeColors[detailItem.type].bg,
                          typeColors[detailItem.type].text
                        )}
                      >
                        {detailItem.type}
                      </span>

                      {detailItem.priority !== "normal" && (
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs capitalize",
                            detailItem.priority === "urgent" &&
                              "bg-red-500/20 text-red-300",
                            detailItem.priority === "high" &&
                              "bg-orange-500/20 text-orange-300",
                            detailItem.priority === "low" &&
                              "bg-gray-500/20 text-gray-300"
                          )}
                        >
                          {detailItem.priority}
                        </span>
                      )}
                    </div>

                    {/* Subtasks */}
                    <div className="pl-3 pt-2 border-t border-white/10">
                      <ItemSubtasksList
                        itemId={detailItem.id}
                        subtasks={detailItem.subtasks || []}
                        isRecurring={!!detailItem.recurrence_rule}
                        occurrenceDate={getOccurrenceDate(detailItem)}
                        subtaskCompletions={subtaskCompletions}
                        onAllCompleted={handleCompleteAction}
                      />
                    </div>

                    {/* Description */}
                    {detailItem.description && (
                      <div className="pl-3 pt-2 border-t border-white/10">
                        <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">
                          {detailItem.description}
                        </p>
                      </div>
                    )}

                    {/* Action Note (inline, always visible when not completed) */}
                    {!isCurrentOccurrenceCompleted &&
                      detailItem.status !== "completed" && (
                        <div className="pl-3 pt-2 border-t border-white/10">
                          <label className="block text-xs text-white/40 mb-1">
                            Add a note (optional)
                          </label>
                          <textarea
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                            placeholder="Why are you completing, postponing, or canceling?"
                            className={cn(
                              "w-full p-2 rounded-lg bg-white/5 border border-white/10",
                              "text-white text-sm placeholder:text-white/30 resize-none",
                              "focus:outline-none focus:border-white/20"
                            )}
                            rows={2}
                          />
                        </div>
                      )}
                  </div>
                </motion.div>
              </>
            )}

            {/* Event Form Dialog */}
            <WebEventFormDialog
              isOpen={isFormOpen}
              onClose={handleCloseForm}
              initialDate={formInitialDate}
              editItem={editingItem}
              defaultType={formDefaultType}
              prefillTitle={prefillTitle}
              prefillCategory={prefillCategory}
            />

            {/* Recurring Event Edit Dialog */}
            {showRecurringDialog && pendingEditItem && (
              <Dialog
                open={showRecurringDialog}
                onOpenChange={setShowRecurringDialog}
              >
                <DialogContent
                  className={cn(
                    "sm:max-w-md neo-card border",
                    isPink ? "border-pink-500/30" : "border-cyan-500/30"
                  )}
                >
                  <DialogHeader>
                    <DialogTitle
                      className={cn(
                        "flex items-center gap-2 text-xl",
                        isPink ? "text-pink-300" : "text-cyan-300"
                      )}
                    >
                      <Repeat className="w-5 h-5" />
                      Edit Recurring{" "}
                      {pendingEditItem.type === "event" ? "Event" : "Reminder"}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <p className="text-white/70">
                      This is a recurring {pendingEditItem.type}. What would you
                      like to edit?
                    </p>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => handleRecurringEditChoice("this")}
                        className={cn(
                          "w-full p-4 rounded-xl border text-left transition-all",
                          "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="font-semibold text-white mb-1">
                          This occurrence only
                        </div>
                        <div className="text-sm text-white/60">
                          Changes will only apply to this specific date
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRecurringEditChoice("all")}
                        className={cn(
                          "w-full p-4 rounded-xl border text-left transition-all",
                          "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="font-semibold text-white mb-1">
                          All occurrences
                        </div>
                        <div className="text-sm text-white/60">
                          Changes will apply to all instances of this recurring{" "}
                          {pendingEditItem.type}
                        </div>
                      </button>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowRecurringDialog(false);
                        setPendingEditItem(null);
                      }}
                      className="border-white/20 text-white/70 hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      )}

      {/* Postpone Options Dialog */}
      {showPostponeDialog && detailItem && (
        <Dialog open={showPostponeDialog} onOpenChange={setShowPostponeDialog}>
          <DialogContent
            className={cn(
              "sm:max-w-md neo-card border",
              isPink ? "border-pink-500/30" : "border-cyan-500/30"
            )}
          >
            <DialogHeader>
              <DialogTitle
                className={cn(
                  "flex items-center gap-2 text-xl",
                  isPink ? "text-pink-300" : "text-cyan-300"
                )}
              >
                <FastForward className="w-5 h-5" />
                Postpone "{detailItem.title}"
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-4">
              {isRecurring(detailItem) && (
                <button
                  type="button"
                  onClick={() => handlePostponeAction("next_occurrence")}
                  className={cn(
                    "w-full p-4 rounded-xl border text-left transition-all",
                    "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  <div className="font-semibold text-white mb-1">
                    Skip to next occurrence
                  </div>
                  <div className="text-sm text-white/60">
                    Cancel this time and wait for the next scheduled occurrence
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => handlePostponeAction("tomorrow")}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all",
                  "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                )}
              >
                <div className="font-semibold text-white mb-1">
                  Tomorrow, same time
                </div>
                <div className="text-sm text-white/60">
                  Reschedule to tomorrow at the same time
                </div>
              </button>

              {/* Custom Date Option */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                  className={cn(
                    "w-full p-4 rounded-xl border text-left transition-all",
                    showCustomDatePicker
                      ? isPink
                        ? "border-pink-500/40 bg-pink-500/10"
                        : "border-cyan-500/40 bg-cyan-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  <div className="font-semibold text-white mb-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Pick a specific date
                  </div>
                  <div className="text-sm text-white/60">
                    Choose exactly when to reschedule
                  </div>
                </button>

                {showCustomDatePicker && (
                  <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={customPostponeDate.split("T")[0] || ""}
                        onChange={(e) => {
                          const dateValue = e.target.value;
                          if (dateValue) {
                            // Keep the original time from the occurrence
                            const origDate = getOccurrenceDate(detailItem);
                            const newDate = new Date(dateValue);
                            newDate.setHours(
                              origDate.getHours(),
                              origDate.getMinutes(),
                              0,
                              0
                            );
                            setCustomPostponeDate(newDate.toISOString());
                          }
                        }}
                        min={format(new Date(), "yyyy-MM-dd")}
                        className={cn(
                          "flex-1 p-2 rounded-lg bg-white/5 border border-white/10",
                          "text-white text-sm",
                          "focus:outline-none focus:border-white/30"
                        )}
                      />
                      <input
                        type="time"
                        value={
                          customPostponeDate
                            ? format(new Date(customPostponeDate), "HH:mm")
                            : ""
                        }
                        onChange={(e) => {
                          if (customPostponeDate && e.target.value) {
                            const [hours, minutes] = e.target.value
                              .split(":")
                              .map(Number);
                            const newDate = new Date(customPostponeDate);
                            newDate.setHours(hours, minutes, 0, 0);
                            setCustomPostponeDate(newDate.toISOString());
                          }
                        }}
                        className={cn(
                          "w-24 p-2 rounded-lg bg-white/5 border border-white/10",
                          "text-white text-sm",
                          "focus:outline-none focus:border-white/30"
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        if (customPostponeDate) {
                          handlePostponeAction("custom", customPostponeDate);
                        }
                      }}
                      disabled={!customPostponeDate}
                      className={cn(
                        "w-full",
                        isPink
                          ? "bg-pink-500 hover:bg-pink-600"
                          : "bg-cyan-500 hover:bg-cyan-600"
                      )}
                    >
                      Postpone to{" "}
                      {customPostponeDate
                        ? format(
                            new Date(customPostponeDate),
                            "MMM d 'at' h:mm a"
                          )
                        : "..."}
                    </Button>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled
                className={cn(
                  "w-full p-4 rounded-xl border text-left opacity-50 cursor-not-allowed",
                  "border-white/10 bg-white/5"
                )}
              >
                <div className="font-semibold text-white/60 mb-1">
                  Find next available slot (AI)
                </div>
                <div className="text-sm text-white/40">
                  Coming soon - AI will find the best time for you
                </div>
              </button>

              {/* Reason input */}
              <div className="pt-2">
                <label className="block text-sm text-white/60 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Why are you postponing this?"
                  className={cn(
                    "w-full p-3 rounded-lg bg-white/5 border border-white/10",
                    "text-white placeholder:text-white/30 resize-none",
                    "focus:outline-none focus:border-white/30"
                  )}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPostponeDialog(false);
                  setActionReason("");
                  setCustomPostponeDate("");
                  setShowCustomDatePicker(false);
                }}
                className="border-white/20 text-white/70 hover:bg-white/10"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
