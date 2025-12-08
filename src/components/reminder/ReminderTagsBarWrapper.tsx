"use client";

import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import ReminderTagsBar from "./ReminderTagsBar";

// Hardcoded categories - same as in MobileReminderForm
const CATEGORIES = [
  { id: "personal", name: "Personal", color_hex: "#8B5CF6" },
  { id: "home", name: "Home", color_hex: "#1E90FF" },
  { id: "family", name: "Family", color_hex: "#FFA500" },
  { id: "community", name: "Community", color_hex: "#22C55E" },
  { id: "friends", name: "Friends", color_hex: "#EC4899" },
  { id: "work", name: "Work", color_hex: "#FF3B30" },
] as const;

interface ReminderTagsBarWrapperProps {
  step: string;
  setStep: Dispatch<SetStateAction<any>>;
  title: string;
  detectedItemType: "reminder" | "event";
  selectedCategoryIds: string[];
  priority: string;
  dueDate: string;
  dueTime: string;
  startDate: string;
  startTime: string;
  date: Date;
  setDate: Dispatch<SetStateAction<Date>>;
  isEditMode?: boolean;
  onExitEditMode?: () => void;
}

export default function ReminderTagsBarWrapper({
  step,
  setStep,
  title,
  detectedItemType,
  selectedCategoryIds,
  priority,
  dueDate,
  dueTime,
  startDate,
  startTime,
  date,
  setDate,
  isEditMode = false,
  onExitEditMode,
}: ReminderTagsBarWrapperProps) {
  const selectedCategories = CATEGORIES.filter((cat) =>
    selectedCategoryIds.includes(cat.id)
  );

  const handleExitEditMode = useCallback(() => {
    if (onExitEditMode) {
      onExitEditMode();
    }
  }, [onExitEditMode]);

  return (
    <>
      <ReminderTagsBar
        title={title}
        detectedItemType={detectedItemType}
        selectedCategories={selectedCategories}
        priority={priority}
        dueDate={dueDate}
        dueTime={dueTime}
        startDate={startDate}
        startTime={startTime}
        date={date}
        onTitleClick={() => setStep("title")}
        onCategoriesClick={() => setStep("details")}
        onDateChange={setDate}
        onTypeClick={() =>
          setStep(detectedItemType === "reminder" ? "due-date" : "date")
        }
        onDateClick={() =>
          setStep(detectedItemType === "reminder" ? "due-date" : "date")
        }
        onPriorityClick={() => setStep("details")}
      />

      {/* Floating Done Button - rendered at layout level to be in front of tags bar */}
      <AnimatePresence>
        {isEditMode && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={handleExitEditMode}
            style={{
              bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_CONTENT_BOTTOM_OFFSET + 16}px)`,
            }}
            className="fixed right-4 z-[999] w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Check className="w-7 h-7" strokeWidth={3} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
