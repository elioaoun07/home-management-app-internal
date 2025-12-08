"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";

/**
 * SemiDonutFAB - A floating action button that expands into a semi-donut menu
 * When tapped, it reveals 2 options: Expense or Reminder
 * Theme-aware: adapts to blue and pink themes
 */

// Selection type for FAB menu
export type FABSelection = "expense" | "reminder";

// Icons for each create option
const ExpenseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ReminderIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Menu item configuration - Only 2 options: Expense and Reminder
interface MenuItem {
  id: FABSelection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorBlue: string;
  colorPink: string;
  bgBlue: string;
  bgPink: string;
}

const menuItems: MenuItem[] = [
  {
    id: "expense",
    label: "Expense",
    icon: ExpenseIcon,
    colorBlue: "text-green-400",
    colorPink: "text-green-400",
    bgBlue: "from-green-500/20 to-emerald-500/20",
    bgPink: "from-green-500/20 to-emerald-500/20",
  },
  {
    id: "reminder",
    label: "Reminder",
    icon: ReminderIcon,
    colorBlue: "text-cyan-400",
    colorPink: "text-pink-400",
    bgBlue: "from-cyan-500/20 to-blue-500/20",
    bgPink: "from-pink-500/20 to-rose-500/20",
  },
];

interface SemiDonutFABProps {
  className?: string;
  onSelect?: (mode: FABSelection) => void;
  onLongPress?: () => void;
}

export default function SemiDonutFAB({
  className,
  onSelect,
  onLongPress,
}: SemiDonutFABProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [isOpen, setIsOpen] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const handleLongPressStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      onLongPress?.();
    }, 500);
  }, [onLongPress]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleSelect = useCallback(
    (mode: FABSelection) => {
      setIsOpen(false);
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
      // Small delay for animation
      setTimeout(() => {
        onSelect?.(mode);
      }, 150);
    },
    [onSelect]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Calculate positions for diagonal donut layout
  // Items are arranged at 45° and 135° angles (0° = right, 180° = left)
  const getItemPosition = (index: number, total: number) => {
    // Angles for diagonal positioning
    const angles = [135, 45]; // degrees - 135° is top-left, 45° is top-right
    const angle = angles[index];
    const radians = (angle * Math.PI) / 180;

    // Radius for the donut
    const radius = 85;

    return {
      x: Math.cos(radians) * radius,
      y: -Math.sin(radians) * radius, // Negative because we want items above
    };
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* FAB Container */}
      <div className={cn("relative z-50", className)}>
        {/* Menu Items */}
        <AnimatePresence>
          {isOpen &&
            menuItems.map((item, index) => {
              const position = getItemPosition(index, menuItems.length);
              const Icon = item.icon;
              const textColor = isPink ? item.colorPink : item.colorBlue;
              const bgGradient = isPink ? item.bgPink : item.bgBlue;

              return (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={{
                    opacity: 0,
                    scale: 0.85,
                    x: 0,
                    y: 0,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: position.x,
                    y: position.y,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.85,
                    x: 0,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.12,
                    ease: [0.23, 1, 0.32, 1],
                    delay: index * 0.01,
                  }}
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "absolute flex flex-col items-center justify-center",
                    "w-16 h-16 rounded-2xl",
                    "bg-gradient-to-br backdrop-blur-md",
                    "border border-white/20",
                    "shadow-2xl",
                    "active:scale-95 transition-transform",
                    bgGradient
                  )}
                  style={{
                    // Center the button on the FAB
                    left: "50%",
                    bottom: "50%",
                    marginLeft: "-32px", // Half of width
                    marginBottom: "-32px", // Half of height
                  }}
                >
                  <Icon className={cn("w-6 h-6", textColor)} />
                  <span
                    className={cn("text-[10px] font-medium mt-0.5", textColor)}
                  >
                    {item.label}
                  </span>
                </motion.button>
              );
            })}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          type="button"
          onClick={handleToggle}
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
          animate={{
            rotate: isOpen ? 45 : 0,
            scale: isOpen ? 0.9 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 20,
          }}
          className={cn(
            "relative flex items-center justify-center",
            "w-14 h-14 rounded-full",
            "neo-gradient text-white",
            "shadow-2xl",
            "active:scale-95 transition-transform",
            isOpen && "neo-glow"
          )}
          style={{
            boxShadow: isOpen
              ? isPink
                ? "0 0 40px rgba(236, 72, 153, 0.5), 0 8px 30px rgba(0, 0, 0, 0.4)"
                : "0 0 40px rgba(6, 182, 212, 0.5), 0 8px 30px rgba(0, 0, 0, 0.4)"
              : "0 8px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ opacity: 0, rotate: -45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 45 }}
                transition={{ duration: 0.15 }}
              >
                <CloseIcon className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="plus"
                initial={{ opacity: 0, rotate: 45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -45 }}
                transition={{ duration: 0.15 }}
              >
                <PlusIcon className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
}
