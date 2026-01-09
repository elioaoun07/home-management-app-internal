"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppMode } from "@/contexts/AppModeContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useCreateEvent,
  useCreateReminder,
  useCreateTask,
} from "@/features/items/useItems";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { checkAndNotifyAssignment } from "@/lib/notifications/sendAssignmentNotification";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type {
  CreateAlertInput,
  CreateEventInput,
  CreateRecurrenceInput,
  CreateReminderInput,
  CreateTaskInput,
  ItemPriority,
} from "@/types/items";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ResponsibleUserPicker } from "./ResponsibleUserPicker";

/**
 * MobileItemForm - A mobile-friendly form for creating reminders, events, and notes
 * Opens as a drawer from the bottom, following the same UX pattern as the expense form
 */

// Icons
const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const LocationIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const RepeatIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

// Priority configuration
const priorityConfig: Record<
  ItemPriority,
  { label: string; color: string; bgColor: string }
> = {
  low: { label: "Low", color: "text-gray-400", bgColor: "bg-gray-500/20" },
  normal: {
    label: "Normal",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
  },
  urgent: { label: "Urgent", color: "text-red-400", bgColor: "bg-red-500/20" },
};

// Form steps for guided entry
type FormStep = "title" | "datetime" | "details" | "priority" | "confirm";

interface MobileItemFormProps {
  className?: string;
}

export default function MobileItemForm({ className }: MobileItemFormProps) {
  const { createMode, closeCreateForm } = useAppMode();
  const { theme } = useTheme();
  const themeClasses = useThemeClasses();
  const isPink = theme === "pink";
  const queryClient = useQueryClient();

  // Household members for responsible user picker
  const { data: householdData } = useHouseholdMembers();

  // Form state
  const [step, setStep] = useState<FormStep>("title");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ItemPriority>("normal");

  // Visibility and responsibility state
  const [isPublic, setIsPublic] = useState(true);
  const [responsibleUserId, setResponsibleUserId] = useState<
    string | undefined
  >(undefined);

  // Reminder-specific state
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");

  // Event-specific state
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");

  // Alert state
  const [enableAlert, setEnableAlert] = useState(true);
  const [alertMinutes, setAlertMinutes] = useState(15);

  // Recurrence state
  const [recurrenceRule, setRecurrenceRule] = useState("");

  // Mutations
  const createReminder = useCreateReminder();
  const createEvent = useCreateEvent();
  const createTask = useCreateTask();

  const isOpen =
    createMode === "reminder" ||
    createMode === "event" ||
    createMode === "task";
  const isReminder = createMode === "reminder";
  const isEvent = createMode === "event";
  const isTask = createMode === "task";

  // Set default responsible user when household data is available
  useEffect(() => {
    if (householdData?.currentUserId && !responsibleUserId) {
      setResponsibleUserId(householdData.currentUserId);
    }
  }, [householdData?.currentUserId, responsibleUserId]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setStep("title");
      setTitle("");
      setDescription("");
      setPriority("normal");
      setIsPublic(true);
      setResponsibleUserId(householdData?.currentUserId ?? undefined);
      setDueDate(format(new Date(), "yyyy-MM-dd"));
      setDueTime("12:00");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndDate(format(new Date(), "yyyy-MM-dd"));
      setEndTime("10:00");
      setAllDay(false);
      setLocation("");
      setEnableAlert(true);
      setAlertMinutes(15);
      setRecurrenceRule("");
    }
  }, [isOpen]);

  // Get form title based on mode
  const getFormTitle = () => {
    switch (createMode) {
      case "reminder":
        return "New Reminder";
      case "event":
        return "New Event";
      case "task":
        return "New Task";
      default:
        return "New Item";
    }
  };

  // Get steps based on mode
  const getSteps = (): FormStep[] => {
    if (isTask) return ["title", "datetime", "details", "priority", "confirm"];
    if (isReminder)
      return ["title", "datetime", "details", "priority", "confirm"];
    if (isEvent) return ["title", "datetime", "details", "priority", "confirm"];
    return ["title", "confirm"];
  };

  const steps = getSteps();
  const currentStepIndex = steps.indexOf(step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const goNext = useCallback(() => {
    const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1);
    setStep(steps[nextIndex]);
  }, [currentStepIndex, steps]);

  const goPrev = useCallback(() => {
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setStep(steps[prevIndex]);
  }, [currentStepIndex, steps]);

  // Submit handler
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      setStep("title");
      return;
    }

    try {
      if (isReminder) {
        const alerts: CreateAlertInput[] = [];
        if (enableAlert && dueDate && dueTime) {
          alerts.push({
            kind: "relative",
            offset_minutes: alertMinutes,
            relative_to: "due",
            channel: "push",
          });
        }

        // Build recurrence rule if set
        let recurrence_rule: CreateRecurrenceInput | undefined;
        if (recurrenceRule && dueDate && dueTime) {
          recurrence_rule = {
            rrule: recurrenceRule,
            start_anchor: `${dueDate}T${dueTime}:00`,
          };
        }

        const input: CreateReminderInput = {
          type: "reminder",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          due_at: dueDate && dueTime ? `${dueDate}T${dueTime}:00` : undefined,
          alerts: alerts.length > 0 ? alerts : undefined,
          recurrence_rule,
          is_public: isPublic,
          responsible_user_id: responsibleUserId,
        };

        const item = await createReminder.mutateAsync(input);

        // Send notification if assigned to someone else
        if (
          responsibleUserId &&
          householdData?.currentUserId &&
          responsibleUserId !== householdData.currentUserId
        ) {
          await checkAndNotifyAssignment({
            itemId: item.id,
            itemTitle: title.trim(),
            itemType: "reminder",
            newResponsibleUserId: responsibleUserId,
            currentUserId: householdData.currentUserId,
            currentUserName: "Me",
          });
        }

        toast.success("Reminder created!", {
          icon: ToastIcons.create,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await fetch(`/api/items/${item.id}`, { method: "DELETE" });
                queryClient.invalidateQueries({ queryKey: ["items"] });
                toast.success("Reminder removed");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
      } else if (isEvent) {
        const alerts: CreateAlertInput[] = [];
        if (enableAlert) {
          alerts.push({
            kind: "relative",
            offset_minutes: alertMinutes,
            relative_to: "start",
            channel: "push",
          });
        }

        // Build recurrence rule if set
        let recurrence_rule: CreateRecurrenceInput | undefined;
        if (recurrenceRule) {
          const startAnchor = allDay
            ? `${startDate}T00:00:00`
            : `${startDate}T${startTime}:00`;
          recurrence_rule = {
            rrule: recurrenceRule,
            start_anchor: startAnchor,
          };
        }

        const input: CreateEventInput = {
          type: "event",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          start_at: allDay
            ? `${startDate}T00:00:00`
            : `${startDate}T${startTime}:00`,
          end_at: allDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`,
          all_day: allDay,
          location_text: location.trim() || undefined,
          alerts: alerts.length > 0 ? alerts : undefined,
          recurrence_rule,
          is_public: isPublic,
          responsible_user_id: responsibleUserId,
        };

        const item = await createEvent.mutateAsync(input);

        // Send notification if assigned to someone else
        if (
          responsibleUserId &&
          householdData?.currentUserId &&
          responsibleUserId !== householdData.currentUserId
        ) {
          await checkAndNotifyAssignment({
            itemId: item.id,
            itemTitle: title.trim(),
            itemType: "event",
            newResponsibleUserId: responsibleUserId,
            currentUserId: householdData.currentUserId,
            currentUserName: "Me",
          });
        }

        toast.success("Event created!", {
          icon: ToastIcons.create,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await fetch(`/api/items/${item.id}`, { method: "DELETE" });
                queryClient.invalidateQueries({ queryKey: ["items"] });
                toast.success("Event removed");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
      } else if (isTask) {
        const input: CreateTaskInput = {
          type: "task",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          due_at: `${dueDate}T${dueTime}:00`,
          estimate_minutes: undefined,
          is_public: isPublic,
          responsible_user_id: responsibleUserId,
        };

        const item = await createTask.mutateAsync(input);

        // Send notification if assigned to someone else
        if (
          responsibleUserId &&
          householdData?.currentUserId &&
          responsibleUserId !== householdData.currentUserId
        ) {
          await checkAndNotifyAssignment({
            itemId: item.id,
            itemTitle: title.trim(),
            itemType: "task",
            newResponsibleUserId: responsibleUserId,
            currentUserId: householdData.currentUserId,
            currentUserName: "Me",
          });
        }

        toast.success("Task created!", {
          icon: ToastIcons.create,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await fetch(`/api/items/${item.id}`, { method: "DELETE" });
                queryClient.invalidateQueries({ queryKey: ["items"] });
                toast.success("Task removed");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
      }

      closeCreateForm();
    } catch (error) {
      console.error("Failed to create item:", error);
      toast.error("Failed to create item", { icon: ToastIcons.error });
    }
  };

  const isPending =
    createReminder.isPending || createEvent.isPending || createTask.isPending;

  // Check if current step is valid
  const isStepValid = () => {
    switch (step) {
      case "title":
        return title.trim().length > 0;
      case "datetime":
        if (isReminder) return true; // Due date is optional
        if (isEvent) return startDate && endDate;
        return true;
      case "details":
        return true; // Optional
      case "priority":
        return true;
      case "confirm":
        return true;
      default:
        return true;
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && closeCreateForm()}>
      <DrawerContent
        className={cn(
          "neo-card border-t",
          isPink ? "border-pink-400/30" : "border-cyan-400/30",
          "max-h-[90vh]"
        )}
      >
        <DrawerHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle
              className={cn(
                "text-lg font-bold",
                isPink ? "text-pink-400" : "text-cyan-400"
              )}
            >
              {getFormTitle()}
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <CloseIcon className="w-5 h-5 text-white/60" />
              </button>
            </DrawerClose>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-1 mt-3">
            {steps.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= currentStepIndex
                    ? isPink
                      ? "bg-pink-400"
                      : "bg-cyan-400"
                    : "bg-white/20"
                )}
              />
            ))}
          </div>
        </DrawerHeader>

        <div className="p-4 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Title Step */}
            {step === "title" && (
              <motion.div
                key="title"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <Label
                    className={cn(
                      "text-sm font-medium",
                      isPink ? "text-pink-300" : "text-cyan-300"
                    )}
                  >
                    {isReminder
                      ? "What do you need to remember?"
                      : isEvent
                        ? "What's the event?"
                        : "Note title"}
                  </Label>
                  <Input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      isReminder
                        ? "e.g., Pay electricity bill"
                        : isEvent
                          ? "e.g., Team meeting"
                          : "e.g., Shopping list"
                    }
                    className={cn(
                      "mt-2 h-12 text-lg",
                      themeClasses.inputBg,
                      themeClasses.inputBorder,
                      "text-white placeholder:text-white/40"
                    )}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isStepValid()) goNext();
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* DateTime Step */}
            {step === "datetime" && (
              <motion.div
                key="datetime"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {isReminder && (
                  <>
                    <Label
                      className={cn(
                        "text-sm font-medium",
                        isPink ? "text-pink-300" : "text-cyan-300"
                      )}
                    >
                      When is it due?
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarIcon className="w-4 h-4 text-white/60" />
                          <span className="text-xs text-white/60">Date</span>
                        </div>
                        <Input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className={cn(
                            themeClasses.inputBg,
                            themeClasses.inputBorder,
                            "text-white"
                          )}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ClockIcon className="w-4 h-4 text-white/60" />
                          <span className="text-xs text-white/60">Time</span>
                        </div>
                        <Input
                          type="time"
                          value={dueTime}
                          onChange={(e) => setDueTime(e.target.value)}
                          className={cn(
                            themeClasses.inputBg,
                            themeClasses.inputBorder,
                            "text-white"
                          )}
                        />
                      </div>
                    </div>
                  </>
                )}

                {isEvent && (
                  <>
                    {/* All day toggle */}
                    <div className="flex items-center justify-between">
                      <Label
                        className={cn(
                          "text-sm font-medium",
                          isPink ? "text-pink-300" : "text-cyan-300"
                        )}
                      >
                        All day event
                      </Label>
                      <button
                        type="button"
                        onClick={() => setAllDay(!allDay)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          allDay
                            ? isPink
                              ? "bg-pink-500"
                              : "bg-cyan-500"
                            : "bg-white/20"
                        )}
                      >
                        <motion.div
                          className="absolute top-1 w-4 h-4 rounded-full bg-white"
                          animate={{
                            left: allDay ? "calc(100% - 20px)" : "4px",
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                          }}
                        />
                      </button>
                    </div>

                    {/* Start */}
                    <div className="space-y-2">
                      <Label className="text-xs text-white/60">Starts</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            if (!endDate || e.target.value > endDate) {
                              setEndDate(e.target.value);
                            }
                          }}
                          className={cn(
                            themeClasses.inputBg,
                            themeClasses.inputBorder,
                            "text-white"
                          )}
                        />
                        {!allDay && (
                          <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className={cn(
                              themeClasses.inputBg,
                              themeClasses.inputBorder,
                              "text-white"
                            )}
                          />
                        )}
                      </div>
                    </div>

                    {/* End */}
                    <div className="space-y-2">
                      <Label className="text-xs text-white/60">Ends</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="date"
                          value={endDate}
                          min={startDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={cn(
                            themeClasses.inputBg,
                            themeClasses.inputBorder,
                            "text-white"
                          )}
                        />
                        {!allDay && (
                          <Input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className={cn(
                              themeClasses.inputBg,
                              themeClasses.inputBorder,
                              "text-white"
                            )}
                          />
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <LocationIcon className="w-4 h-4 text-white/60" />
                        <Label className="text-xs text-white/60">
                          Location (optional)
                        </Label>
                      </div>
                      <Input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g., Conference Room A"
                        className={cn(
                          themeClasses.inputBg,
                          themeClasses.inputBorder,
                          "text-white placeholder:text-white/40"
                        )}
                      />
                    </div>
                  </>
                )}

                {/* Recurrence - for both events and reminders */}
                {(isEvent || isReminder) && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <RepeatIcon className="w-4 h-4 text-white/60" />
                      <Label className="text-sm font-medium text-white/80">
                        Repeat
                      </Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Never", value: "" },
                        { label: "Daily", value: "FREQ=DAILY" },
                        {
                          label: "Weekdays",
                          value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
                        },
                        { label: "Weekly", value: "FREQ=WEEKLY" },
                        { label: "Bi-weekly", value: "FREQ=WEEKLY;INTERVAL=2" },
                        { label: "Monthly", value: "FREQ=MONTHLY" },
                        {
                          label: "Quarterly",
                          value: "FREQ=MONTHLY;INTERVAL=3",
                        },
                        { label: "Yearly", value: "FREQ=YEARLY" },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setRecurrenceRule(preset.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs transition-all",
                            recurrenceRule === preset.value
                              ? isPink
                                ? "bg-pink-500/30 text-pink-300 border border-pink-400/50"
                                : "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50"
                              : "bg-white/10 text-white/60 border border-transparent"
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alert setting */}
                {(isReminder || isEvent) && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BellIcon className="w-4 h-4 text-white/60" />
                        <Label className="text-sm text-white/80">
                          Remind me
                        </Label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnableAlert(!enableAlert)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          enableAlert
                            ? isPink
                              ? "bg-pink-500"
                              : "bg-cyan-500"
                            : "bg-white/20"
                        )}
                      >
                        <motion.div
                          className="absolute top-1 w-4 h-4 rounded-full bg-white"
                          animate={{
                            left: enableAlert ? "calc(100% - 20px)" : "4px",
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                          }}
                        />
                      </button>
                    </div>

                    {enableAlert && (
                      <div className="flex gap-2">
                        {[5, 15, 30, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setAlertMinutes(mins)}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                              alertMinutes === mins
                                ? isPink
                                  ? "bg-pink-500/30 text-pink-300"
                                  : "bg-cyan-500/30 text-cyan-300"
                                : "bg-white/10 text-white/60 hover:bg-white/20"
                            )}
                          >
                            {mins < 60 ? `${mins}m` : "1h"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Details Step */}
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <Label
                    className={cn(
                      "text-sm font-medium",
                      isPink ? "text-pink-300" : "text-cyan-300"
                    )}
                  >
                    Notes (optional)
                  </Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add any additional details..."
                    rows={4}
                    className={cn(
                      "mt-2 resize-none",
                      themeClasses.inputBg,
                      themeClasses.inputBorder,
                      "text-white placeholder:text-white/40"
                    )}
                  />
                </div>

                {/* Visibility Toggle */}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-white/60"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <Label className="text-sm text-white/80">
                        Share with household
                      </Label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPublic(!isPublic);
                        // Reset responsible user to self when making private
                        if (isPublic && householdData?.currentUserId) {
                          setResponsibleUserId(householdData.currentUserId);
                        }
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        isPublic
                          ? isPink
                            ? "bg-pink-500"
                            : "bg-cyan-500"
                          : "bg-white/20"
                      )}
                    >
                      <motion.div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white"
                        animate={{
                          left: isPublic ? "calc(100% - 20px)" : "4px",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-white/40 mt-1 ml-6">
                    {isPublic
                      ? "Visible to your household partner"
                      : "Only you can see this item"}
                  </p>
                </div>

                {/* Responsible User Picker */}
                {householdData?.hasPartner && (
                  <div className="pt-2 border-t border-white/10">
                    <Label className="text-sm text-white/80 mb-2 block">
                      Responsible
                    </Label>
                    <ResponsibleUserPicker
                      value={responsibleUserId}
                      onChange={setResponsibleUserId}
                      isPublic={isPublic}
                      disabled={!isPublic}
                    />
                    {isPublic &&
                      responsibleUserId &&
                      responsibleUserId !== householdData.currentUserId && (
                        <p className="text-xs text-pink-300/70 mt-2">
                          ✨{" "}
                          {
                            householdData.members.find(
                              (m) => m.id === responsibleUserId
                            )?.displayName
                          }{" "}
                          will be notified
                        </p>
                      )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Priority Step */}
            {step === "priority" && (
              <motion.div
                key="priority"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <Label
                  className={cn(
                    "text-sm font-medium",
                    isPink ? "text-pink-300" : "text-cyan-300"
                  )}
                >
                  Priority
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(priorityConfig) as ItemPriority[]).map((p) => {
                    const config = priorityConfig[p];
                    const isSelected = priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={cn(
                          "p-3 rounded-xl text-left transition-all",
                          "border",
                          isSelected
                            ? cn(config.bgColor, "border-current", config.color)
                            : "border-white/10 hover:border-white/30"
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isSelected ? config.color : "text-white/80"
                          )}
                        >
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Confirm Step */}
            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div
                  className={cn(
                    "p-4 rounded-xl",
                    isPink ? "bg-pink-500/10" : "bg-cyan-500/10"
                  )}
                >
                  <h3 className="text-lg font-semibold text-white mb-3">
                    {title}
                  </h3>

                  {description && (
                    <p className="text-sm text-white/70 mb-3">{description}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    {isReminder && dueDate && (
                      <div className="flex items-center gap-2 text-white/60">
                        <CalendarIcon className="w-4 h-4" />
                        <span>
                          Due:{" "}
                          {format(new Date(`${dueDate}T${dueTime}`), "PPp")}
                        </span>
                      </div>
                    )}

                    {isEvent && (
                      <>
                        <div className="flex items-center gap-2 text-white/60">
                          <CalendarIcon className="w-4 h-4" />
                          <span>
                            {allDay
                              ? `${format(new Date(startDate), "PP")} - ${format(new Date(endDate), "PP")}`
                              : `${format(new Date(`${startDate}T${startTime}`), "PPp")} - ${format(new Date(`${endDate}T${endTime}`), "PPp")}`}
                          </span>
                        </div>
                        {location && (
                          <div className="flex items-center gap-2 text-white/60">
                            <LocationIcon className="w-4 h-4" />
                            <span>{location}</span>
                          </div>
                        )}
                      </>
                    )}

                    <div
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs",
                        priorityConfig[priority].bgColor,
                        priorityConfig[priority].color
                      )}
                    >
                      {priorityConfig[priority].label} priority
                    </div>

                    {recurrenceRule && (
                      <div className="flex items-center gap-2 text-white/60">
                        <RepeatIcon className="w-4 h-4" />
                        <span>
                          Repeats{" "}
                          {recurrenceRule.includes("DAILY")
                            ? "daily"
                            : recurrenceRule.includes("BYDAY=MO,TU,WE,TH,FR")
                              ? "weekdays"
                              : recurrenceRule.includes("INTERVAL=2") &&
                                  recurrenceRule.includes("WEEKLY")
                                ? "bi-weekly"
                                : recurrenceRule.includes("INTERVAL=3") &&
                                    recurrenceRule.includes("MONTHLY")
                                  ? "quarterly"
                                  : recurrenceRule.includes("WEEKLY")
                                    ? "weekly"
                                    : recurrenceRule.includes("MONTHLY")
                                      ? "monthly"
                                      : recurrenceRule.includes("YEARLY")
                                        ? "yearly"
                                        : "custom"}
                        </span>
                      </div>
                    )}

                    {/* Responsible User */}
                    {responsibleUserId && householdData && (
                      <div className="flex items-center gap-2 text-white/60">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>
                          Responsible:{" "}
                          <span
                            className={
                              responsibleUserId === householdData.currentUserId
                                ? "text-cyan-300"
                                : "text-pink-300"
                            }
                          >
                            {householdData.members.find(
                              (m) => m.id === responsibleUserId
                            )?.displayName || "Me"}
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Visibility */}
                    <div className="flex items-center gap-2 text-white/60">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        {isPublic ? (
                          <>
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </>
                        ) : (
                          <>
                            <rect
                              width="18"
                              height="11"
                              x="3"
                              y="11"
                              rx="2"
                              ry="2"
                            />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </>
                        )}
                      </svg>
                      <span>
                        {isPublic ? "Shared with household" : "Private"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DrawerFooter className="border-t border-white/10 pt-4">
          <div className="flex gap-3">
            {!isFirstStep && (
              <Button
                type="button"
                variant="outline"
                onClick={goPrev}
                disabled={isPending}
                className={cn(
                  "flex-1",
                  themeClasses.border,
                  "text-white hover:bg-white/10"
                )}
              >
                Back
              </Button>
            )}

            {isLastStep ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !title.trim()}
                className="flex-1 neo-gradient text-white"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <motion.div
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    Create{" "}
                    {isReminder ? "Reminder" : isEvent ? "Event" : "Task"}
                  </span>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={goNext}
                disabled={!isStepValid()}
                className="flex-1 neo-gradient text-white"
              >
                Continue
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
