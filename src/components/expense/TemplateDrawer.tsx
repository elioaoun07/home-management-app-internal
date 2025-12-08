"use client";

import { PlusIcon, XIcon } from "@/components/icons/FuturisticIcons";
import {
  useCreateReminderTemplate,
  useLaunchReminderTemplate,
  useReminderTemplates,
} from "@/features/items/useReminderTemplates";
import { cn } from "@/lib/utils";
import type {
  CreateReminderTemplateInput,
  ReminderTemplate,
} from "@/types/items";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import LaunchTemplateDialog from "./LaunchTemplateDialog";
import ReminderTemplateDialog from "./ReminderTemplateDialog";
import TemplateDialog from "./TemplateDialog";

export type Template = {
  id: string;
  user_id: string;
  name: string;
  account_id?: string;
  category_id?: string;
  subcategory_id?: string | null;
  amount: string;
  description?: string | null;
  inserted_at: string;
};

export type TemplateMode = "budget" | "task";

interface TemplateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: Template) => void;
}

const STORAGE_KEY = "expense-templates";

export default function TemplateDrawer({
  open,
  onOpenChange,
  onSelect,
}: TemplateDrawerProps) {
  // Budget templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Reminder templates state
  const { data: reminderTemplates = [], isLoading: reminderLoading } =
    useReminderTemplates();
  const createReminderTemplate = useCreateReminderTemplate();
  const launchReminderTemplate = useLaunchReminderTemplate();
  const [selectedReminderIndex, setSelectedReminderIndex] = useState(0);
  const [showReminderCreateDialog, setShowReminderCreateDialog] =
    useState(false);
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [templateToLaunch, setTemplateToLaunch] =
    useState<ReminderTemplate | null>(null);

  // Common state
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [templateMode, setTemplateMode] = useState<TemplateMode>("budget");
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 80;

  // Load budget templates from localStorage or fetch from API
  useEffect(() => {
    const loadTemplates = async () => {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setTemplates(parsed);
          return;
        } catch (e) {
          console.error("Failed to parse cached templates", e);
        }
      }

      setLoading(true);
      try {
        const res = await fetch("/api/transaction-templates", {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) throw new Error("Failed to fetch templates");
        const data = await res.json();
        setTemplates(data || []);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data || []));
      } catch (error) {
        toast.error("Failed to load templates");
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const handleSelect = (template: Template) => {
    onSelect(template);
    onOpenChange(false);
  };

  const handleCreateTemplate = async (tpl: Partial<Template>) => {
    try {
      const res = await fetch("/api/transaction-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tpl),
      });
      if (!res.ok) throw new Error("Failed to create template");
      const newTemplate = await res.json();
      const updated = [...templates, newTemplate];
      setTemplates(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success("Template created!");
      setShowCreateDialog(false);
    } catch (error) {
      toast.error("Failed to create template");
      throw error;
    }
  };

  // Handle reminder template creation
  const handleCreateReminderTemplate = async (
    input: CreateReminderTemplateInput
  ) => {
    await createReminderTemplate.mutateAsync(input);
    toast.success("Task template created!");
  };

  // Handle launching a reminder template
  const handleLaunchTemplate = async (
    templateId: string,
    startAt: string,
    durationMinutes?: number
  ) => {
    await launchReminderTemplate.mutateAsync({
      template_id: templateId,
      start_at: startAt,
      duration_minutes: durationMinutes,
    });
    toast.success("Task created from template!");
    onOpenChange(false);
  };

  // Handle selecting a reminder template (opens launch dialog)
  const handleSelectReminderTemplate = (template: ReminderTemplate) => {
    setTemplateToLaunch(template);
    setShowLaunchDialog(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    const currentTemplates =
      templateMode === "budget" ? templates : reminderTemplates;
    const currentIndex =
      templateMode === "budget" ? selectedIndex : selectedReminderIndex;
    const setIndex =
      templateMode === "budget" ? setSelectedIndex : setSelectedReminderIndex;

    if (distance > minSwipeDistance) {
      setIndex(Math.min(currentTemplates.length - 1, currentIndex + 1));
    } else if (distance < -minSwipeDistance) {
      setIndex(Math.max(0, currentIndex - 1));
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  if (!open) return null;

  const isLoading = templateMode === "budget" ? loading : reminderLoading;
  const currentTemplates =
    templateMode === "budget" ? templates : reminderTemplates;
  const currentIndex =
    templateMode === "budget" ? selectedIndex : selectedReminderIndex;
  const setCurrentIndex =
    templateMode === "budget" ? setSelectedIndex : setSelectedReminderIndex;

  return (
    <>
      {/* Blurred Background Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Carousel Container */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-xl border-t-2 border-[hsl(var(--nav-text-primary)/0.3)] rounded-t-3xl shadow-2xl pb-safe">
          {/* Toggle Header */}
          <div className="flex items-center justify-center gap-2 p-4 border-b border-white/10">
            <button
              onClick={() => setTemplateMode("budget")}
              className={cn(
                "flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-all",
                templateMode === "budget"
                  ? "neo-gradient text-white shadow-lg"
                  : "text-[hsl(var(--nav-text-secondary))] hover:text-[hsl(var(--nav-text-primary))]"
              )}
            >
              💰 Budget
            </button>
            <button
              onClick={() => setTemplateMode("task")}
              className={cn(
                "flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-all",
                templateMode === "task"
                  ? "neo-gradient text-white shadow-lg"
                  : "text-[hsl(var(--nav-text-secondary))] hover:text-[hsl(var(--nav-text-primary))]"
              )}
            >
              ✅ Tasks
            </button>
          </div>

          <div className="relative h-[400px] overflow-hidden">
            {isLoading ? (
              <div className="space-y-3 px-4 pt-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 neo-card animate-pulse rounded-xl"
                  />
                ))}
              </div>
            ) : currentTemplates.length === 0 ? (
              <div className="text-center py-16">
                <div
                  className="inline-flex items-center gap-2 px-6 py-3 neo-card rounded-full neo-glow cursor-pointer active:scale-95 transition-all"
                  onClick={() =>
                    templateMode === "budget"
                      ? setShowCreateDialog(true)
                      : setShowReminderCreateDialog(true)
                  }
                >
                  <PlusIcon className="w-5 h-5 text-[hsl(var(--nav-text-primary))] drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
                  <span className="text-sm font-semibold text-[hsl(var(--nav-text-primary))]">
                    Create Your First{" "}
                    {templateMode === "budget" ? "Budget" : "Task"} Template
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Vertical Wheel Carousel */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div
                    ref={containerRef}
                    className="relative w-full h-full"
                    style={{ perspective: "1000px" }}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {templateMode === "budget"
                        ? // Budget Templates
                          templates.map((template, index) => {
                            const offset = index - selectedIndex;
                            const isSelected = index === selectedIndex;
                            const scale = isSelected ? 1 : 0.8;
                            const opacity = Math.max(
                              0.3,
                              1 - Math.abs(offset) * 0.3
                            );
                            const translateY = offset * itemHeight;
                            const rotateX = offset * -15;

                            return (
                              <button
                                key={template.id}
                                onClick={() => {
                                  if (isSelected) {
                                    handleSelect(template);
                                  } else {
                                    setSelectedIndex(index);
                                  }
                                }}
                                suppressHydrationWarning
                                className="absolute w-[90%] transition-all duration-300 ease-out"
                                style={{
                                  transform: `translateY(${translateY}px) translateZ(${isSelected ? 0 : -50}px) rotateX(${rotateX}deg) scale(${scale})`,
                                  opacity,
                                  zIndex: 100 - Math.abs(offset),
                                }}
                              >
                                <div
                                  className={`p-4 rounded-xl border transition-all shadow-lg ${
                                    isSelected
                                      ? "neo-glow-lg border-2 border-[hsl(var(--nav-text-primary))] bg-gradient-to-br from-[hsl(var(--header-bg))] to-[hsl(var(--header-bg)/0.8)]"
                                      : "neo-card border border-[hsl(var(--header-border)/0.3)] bg-[hsl(var(--header-bg)/0.5)]"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div
                                        className={`font-bold truncate ${
                                          isSelected
                                            ? "text-[hsl(var(--nav-text-primary))] text-lg"
                                            : "text-base"
                                        }`}
                                      >
                                        {template.name}
                                      </div>
                                      {template.description && (
                                        <div className="text-xs text-muted-foreground truncate mt-1">
                                          {template.description}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right ml-3">
                                      <div
                                        className={`font-bold ${
                                          isSelected
                                            ? "text-2xl text-[hsl(var(--nav-text-primary))]"
                                            : "text-lg"
                                        }`}
                                      >
                                        $
                                        {parseFloat(template.amount).toFixed(2)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        : // Reminder/Task Templates
                          reminderTemplates.map((template, index) => {
                            const offset = index - selectedReminderIndex;
                            const isSelected = index === selectedReminderIndex;
                            const scale = isSelected ? 1 : 0.8;
                            const opacity = Math.max(
                              0.3,
                              1 - Math.abs(offset) * 0.3
                            );
                            const translateY = offset * itemHeight;
                            const rotateX = offset * -15;

                            const typeIcon =
                              template.item_type === "event"
                                ? "📅"
                                : template.item_type === "reminder"
                                  ? "⏰"
                                  : "✅";

                            const priorityColor =
                              template.priority === "urgent"
                                ? "text-red-400"
                                : template.priority === "high"
                                  ? "text-orange-400"
                                  : template.priority === "normal"
                                    ? "text-blue-400"
                                    : "text-gray-400";

                            return (
                              <button
                                key={template.id}
                                onClick={() => {
                                  if (isSelected) {
                                    handleSelectReminderTemplate(template);
                                  } else {
                                    setSelectedReminderIndex(index);
                                  }
                                }}
                                suppressHydrationWarning
                                className="absolute w-[90%] transition-all duration-300 ease-out"
                                style={{
                                  transform: `translateY(${translateY}px) translateZ(${isSelected ? 0 : -50}px) rotateX(${rotateX}deg) scale(${scale})`,
                                  opacity,
                                  zIndex: 100 - Math.abs(offset),
                                }}
                              >
                                <div
                                  className={`p-4 rounded-xl border transition-all shadow-lg ${
                                    isSelected
                                      ? "neo-glow-lg border-2 border-[hsl(var(--nav-text-primary))] bg-gradient-to-br from-[hsl(var(--header-bg))] to-[hsl(var(--header-bg)/0.8)]"
                                      : "neo-card border border-[hsl(var(--header-border)/0.3)] bg-[hsl(var(--header-bg)/0.5)]"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">
                                          {typeIcon}
                                        </span>
                                        <div
                                          className={`font-bold truncate ${
                                            isSelected
                                              ? "text-[hsl(var(--nav-text-primary))] text-lg"
                                              : "text-base"
                                          }`}
                                        >
                                          {template.name}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span
                                          className={`text-xs capitalize ${priorityColor}`}
                                        >
                                          {template.priority}
                                        </span>
                                        {template.default_duration_minutes && (
                                          <span className="text-xs text-muted-foreground">
                                            •{" "}
                                            {template.default_duration_minutes}
                                            min
                                          </span>
                                        )}
                                        {template.use_count > 0 && (
                                          <span className="text-xs text-muted-foreground">
                                            • Used {template.use_count}x
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <div className="flex items-center gap-1 ml-2">
                                        <span className="text-xs text-[hsl(var(--nav-text-primary))]">
                                          Tap to launch
                                        </span>
                                        <span className="text-lg">🚀</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                    </div>
                  </div>
                </div>

                {/* Floating Action Buttons */}
                <div className="absolute top-4 right-4 flex gap-2 z-50">
                  <button
                    onClick={() =>
                      templateMode === "budget"
                        ? setShowCreateDialog(true)
                        : setShowReminderCreateDialog(true)
                    }
                    suppressHydrationWarning
                    className="p-3 neo-card rounded-full hover:neo-glow-sm transition-all active:scale-95 shadow-lg"
                    title="Create Template"
                  >
                    <PlusIcon className="w-5 h-5 text-[hsl(var(--nav-text-primary))] drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
                  </button>
                  <button
                    onClick={() => onOpenChange(false)}
                    suppressHydrationWarning
                    className="p-3 neo-card rounded-full hover:neo-glow-sm transition-all active:scale-95 shadow-lg"
                    title="Close"
                  >
                    <XIcon className="w-5 h-5 text-[hsl(var(--nav-text-primary))] drop-shadow-[0_0_6px_rgba(248,113,113,0.4)]" />
                  </button>
                </div>

                {/* Index Indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-50">
                  {currentTemplates.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      suppressHydrationWarning
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentIndex
                          ? "w-6 bg-[hsl(var(--nav-text-primary))] neo-glow-sm"
                          : "w-1.5 bg-[hsl(var(--header-border)/0.3)]"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Budget Template Dialog */}
      <TemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSave={(tpl) => {
          handleCreateTemplate(tpl).catch(() => {});
        }}
      />

      {/* Reminder Template Dialog */}
      <ReminderTemplateDialog
        open={showReminderCreateDialog}
        onOpenChange={setShowReminderCreateDialog}
        onSave={handleCreateReminderTemplate}
      />

      {/* Launch Template Dialog */}
      <LaunchTemplateDialog
        open={showLaunchDialog}
        onOpenChange={setShowLaunchDialog}
        template={templateToLaunch}
        onLaunch={handleLaunchTemplate}
      />
    </>
  );
}
