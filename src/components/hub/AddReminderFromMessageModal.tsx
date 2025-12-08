// src/components/hub/AddReminderFromMessageModal.tsx
"use client";

import { SaveIcon, XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateMessageAction } from "@/features/hub/messageActions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

interface Props {
  messageId: string;
  initialTitle: string;
  initialDescription?: string;
  onClose: () => void;
  onSuccess: (messageId: string) => void;
}

type ItemType = "reminder" | "event" | "note";
type ItemPriority = "low" | "normal" | "high" | "urgent";

export default function AddReminderFromMessageModal({
  messageId,
  initialTitle,
  initialDescription,
  onClose,
  onSuccess,
}: Props) {
  const themeClasses = useThemeClasses();
  const [isClosing, setIsClosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createActionMutation = useCreateMessageAction();

  // Form state
  const [formData, setFormData] = useState({
    title: initialTitle,
    description: initialDescription || "",
    type: "reminder" as ItemType,
    priority: "normal" as ItemPriority,
    due_at: "",
    estimate_minutes: "",
  });

  // Animated close handler
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  }, [onClose]);

  // Handle save
  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create item in Reminder App via API
      const response = await fetch("/api/hub/create-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          type: formData.type,
          priority: formData.priority,
          due_at: formData.due_at
            ? new Date(formData.due_at).toISOString()
            : null,
          estimate_minutes: formData.estimate_minutes
            ? parseInt(formData.estimate_minutes, 10)
            : null,
          messageId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create reminder");
      }

      // Create message action to track this
      try {
        await createActionMutation.mutateAsync({
          messageId,
          actionType: "reminder",
          metadata: {
            reminder_app_item_id: data.item?.id,
            item_type: formData.type,
            title: formData.title,
          },
        });
      } catch (actionErr) {
        console.error("Failed to track action:", actionErr);
        // Don't fail - reminder was created
      }

      toast.success(data.message || "Reminder created!");

      // Close modal and notify success
      setIsClosing(true);
      setTimeout(() => {
        onSuccess(messageId);
        onClose();
      }, 200);
    } catch (error) {
      console.error("Failed to create reminder:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create reminder"
      );
      setIsSubmitting(false);
    }
  };

  // Lock body scroll
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (typeof document === "undefined") return null;

  const typeOptions: { value: ItemType; label: string; icon: string }[] = [
    { value: "reminder", label: "Reminder", icon: "⏰" },
    { value: "event", label: "Event", icon: "📅" },
    { value: "note", label: "Note", icon: "📝" },
  ];

  const priorityOptions: {
    value: ItemPriority;
    label: string;
    color: string;
  }[] = [
    { value: "low", label: "Low", color: "text-gray-400" },
    { value: "normal", label: "Normal", color: "text-blue-400" },
    { value: "high", label: "High", color: "text-amber-400" },
    { value: "urgent", label: "Urgent", color: "text-red-400" },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center overflow-hidden"
      onClick={handleClose}
      style={{
        animation: isClosing
          ? "modalBackdropFadeOut 0.25s ease-in forwards"
          : "modalBackdropFadeIn 0.2s ease-out forwards",
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bottom-[72px] md:bottom-0 bg-black/60 backdrop-blur-sm"
        style={{
          animation: isClosing
            ? "modalBackdropFadeOut 0.25s ease-in forwards"
            : "modalBackdropFadeIn 0.2s ease-out forwards",
        }}
      />

      {/* Modal Panel */}
      <div
        className={`relative w-full max-w-md mb-[72px] md:mb-0 ${themeClasses.modalBg} rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col neo-glow`}
        style={{
          maxHeight: "calc(100vh - 120px)",
          animation: isClosing
            ? "modalSlideDown 0.25s cubic-bezier(0.4, 0, 1, 1) forwards"
            : "modalSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3">
          <h2 className="text-lg font-semibold text-white">
            Add to Reminder App
          </h2>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg ${themeClasses.hoverBgSubtle} transition-colors`}
          >
            <XIcon className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 space-y-3 flex-1 overflow-y-auto">
          {/* Item Type Selector */}
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/50 mb-2">Type</p>
            <div className="flex gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormData({ ...formData, type: opt.value })}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    formData.type === opt.value
                      ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span className="text-sm">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/50 mb-1">Title</p>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="What needs to be done?"
              className="bg-transparent border-none text-white p-0 focus:ring-0 text-lg font-medium"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/50 mb-1">Description</p>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Add more details..."
              rows={2}
              className="w-full bg-transparent border-none text-white p-0 focus:ring-0 focus:outline-none resize-none text-sm"
            />
          </div>

          {/* Priority */}
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/50 mb-2">Priority</p>
            <div className="flex gap-2">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setFormData({ ...formData, priority: opt.value })
                  }
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                    formData.priority === opt.value
                      ? `bg-white/10 ${opt.color} ring-1 ring-white/20`
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date (for reminders) */}
          {formData.type === "reminder" && (
            <div className="px-4 py-3 rounded-xl bg-white/5">
              <p className="text-xs text-white/50 mb-1">Due Date (optional)</p>
              <Input
                type="datetime-local"
                value={formData.due_at}
                onChange={(e) =>
                  setFormData({ ...formData, due_at: e.target.value })
                }
                className="bg-transparent border-none text-white p-0 focus:ring-0"
              />
            </div>
          )}

          {/* Estimate (for reminders) */}
          {formData.type === "reminder" && (
            <div className="px-4 py-3 rounded-xl bg-white/5">
              <p className="text-xs text-white/50 mb-1">
                Time Estimate (minutes, optional)
              </p>
              <Input
                type="number"
                min="0"
                value={formData.estimate_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, estimate_minutes: e.target.value })
                }
                placeholder="e.g., 30"
                className="bg-transparent border-none text-white p-0 focus:ring-0"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-2 flex gap-3 border-t border-white/5">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !formData.title.trim()}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            <SaveIcon className="w-4 h-4 mr-2" />
            {isSubmitting ? "Creating..." : "Add Reminder"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
