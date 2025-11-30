"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { AlertTriangle, Minus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type WidgetItem = {
  id: string;
  name: string;
  color?: string;
  icon?: ReactNode;
  isAddButton?: boolean;
};

type DeleteConfirmState = {
  item: WidgetItem;
  step: "first" | "second";
} | null;

type EditableWidgetGridProps = {
  items: WidgetItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onReorder: (newOrder: string[]) => void;
  onDelete: (id: string) => Promise<void>;
  onAdd?: () => void;
  renderItem: (
    item: WidgetItem,
    isSelected: boolean,
    isEditMode: boolean
  ) => ReactNode;
  itemType: "account" | "category" | "subcategory";
  columns?: 1 | 2;
  disabled?: boolean;
};

// Long press hook
function useLongPress(
  callback: () => void,
  { threshold = 500 }: { threshold?: number } = {}
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const start = useCallback(() => {
    isLongPress.current = false;
    timeoutRef.current = setTimeout(() => {
      isLongPress.current = true;
      callback();
    }, threshold);
  }, [callback, threshold]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    isLongPress,
  };
}

// Individual draggable item
function DraggableItem({
  item,
  isSelected,
  isEditMode,
  onSelect,
  onDeleteClick,
  renderItem,
  columns,
}: {
  item: WidgetItem;
  isSelected: boolean;
  isEditMode: boolean;
  onSelect: (id: string) => void;
  onDeleteClick: (item: WidgetItem) => void;
  renderItem: (
    item: WidgetItem,
    isSelected: boolean,
    isEditMode: boolean
  ) => ReactNode;
  columns: 1 | 2;
}) {
  const controls = useDragControls();
  const themeClasses = useThemeClasses();

  if (item.isAddButton) {
    return (
      <div className="relative">{renderItem(item, false, isEditMode)}</div>
    );
  }

  return (
    <Reorder.Item
      value={item}
      id={item.id}
      dragListener={isEditMode}
      dragControls={controls}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: 1,
        rotate: isEditMode ? [0, -1, 1, -1, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        rotate: {
          repeat: isEditMode ? Infinity : 0,
          duration: 0.3,
          ease: "easeInOut",
        },
        default: { duration: 0.2 },
      }}
      whileDrag={{
        scale: 1.05,
        zIndex: 50,
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      }}
      className={cn("relative touch-none", columns === 1 ? "w-full" : "")}
      style={{ position: "relative" }}
    >
      {/* Delete button */}
      {isEditMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(item);
          }}
          className={cn(
            "absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center",
            "bg-red-500 text-white shadow-lg",
            "transform transition-transform hover:scale-110 active:scale-95",
            "animate-in fade-in zoom-in duration-200"
          )}
        >
          <Minus className="w-4 h-4" strokeWidth={3} />
        </button>
      )}

      {/* Item content */}
      <div
        onClick={() => !isEditMode && onSelect(item.id)}
        className={cn(
          "cursor-pointer",
          isEditMode && "cursor-grab active:cursor-grabbing"
        )}
      >
        {renderItem(item, isSelected, isEditMode)}
      </div>
    </Reorder.Item>
  );
}

export default function EditableWidgetGrid({
  items,
  selectedId,
  onSelect,
  onReorder,
  onDelete,
  onAdd,
  renderItem,
  itemType,
  columns = 2,
  disabled = false,
}: EditableWidgetGridProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [orderedItems, setOrderedItems] = useState(items);
  const containerRef = useRef<HTMLDivElement>(null);
  const themeClasses = useThemeClasses();

  // Sync ordered items when items prop changes
  useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  // Exit edit mode when clicking outside
  useEffect(() => {
    if (!isEditMode) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsEditMode(false);
      }
    };

    // Small delay to prevent immediate exit
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isEditMode]);

  // Long press to enter edit mode
  const longPressHandlers = useLongPress(() => {
    if (!disabled) {
      setIsEditMode(true);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  });

  const handleReorder = (newOrder: WidgetItem[]) => {
    setOrderedItems(newOrder);
    onReorder(newOrder.filter((i) => !i.isAddButton).map((i) => i.id));
  };

  const handleDeleteClick = (item: WidgetItem) => {
    setDeleteConfirm({ item, step: "first" });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.step === "first") {
      setDeleteConfirm({ ...deleteConfirm, step: "second" });
    } else {
      setIsDeleting(true);
      try {
        await onDelete(deleteConfirm.item.id);
        setDeleteConfirm(null);
        // If we deleted all items, exit edit mode
        if (orderedItems.filter((i) => !i.isAddButton).length <= 1) {
          setIsEditMode(false);
        }
      } catch (error) {
        console.error("Delete failed:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const itemTypeLabels = {
    account: { singular: "Account", plural: "Accounts" },
    category: { singular: "Category", plural: "Categories" },
    subcategory: { singular: "Subcategory", plural: "Subcategories" },
  };

  const label = itemTypeLabels[itemType];

  // Add "Add" button to items if onAdd is provided
  const itemsWithAddButton = onAdd
    ? [
        ...orderedItems.filter((i) => !i.isAddButton),
        { id: "__add__", name: "Add", isAddButton: true },
      ]
    : orderedItems;

  return (
    <>
      <div ref={containerRef} {...longPressHandlers}>
        {/* Edit mode indicator */}
        {isEditMode && (
          <div className="flex items-center justify-between mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-xs text-cyan-400 font-medium">
              Drag to reorder • Tap{" "}
              <span className="inline-flex items-center justify-center w-4 h-4 bg-red-500 rounded-full">
                <Minus className="w-3 h-3 text-white" />
              </span>{" "}
              to delete
            </span>
            <button
              onClick={() => setIsEditMode(false)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
              Done
            </button>
          </div>
        )}

        {/* Grid */}
        <Reorder.Group
          axis={columns === 1 ? "y" : "y"}
          values={orderedItems}
          onReorder={handleReorder}
          className={cn(
            columns === 2 ? "grid grid-cols-2 gap-2" : "space-y-2",
            "select-none"
          )}
          layoutScroll
          style={{ overflowY: "visible", overflowX: "hidden" }}
        >
          <AnimatePresence mode="popLayout">
            {itemsWithAddButton.map((item) => (
              <DraggableItem
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                isEditMode={isEditMode}
                onSelect={onSelect}
                onDeleteClick={handleDeleteClick}
                renderItem={renderItem}
                columns={columns}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {/* Hint text when not in edit mode */}
        {!isEditMode &&
          orderedItems.filter((i) => !i.isAddButton).length > 0 && (
            <p className="text-[10px] text-slate-600 text-center mt-2">
              Hold to edit {label.plural.toLowerCase()}
            </p>
          )}
      </div>

      {/* Delete Confirmation Drawer */}
      <Drawer
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DrawerContent className="bg-bg-dark border-t border-slate-800">
          <DrawerHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <DrawerTitle
              className={cn(
                "text-lg font-semibold",
                deleteConfirm?.step === "second"
                  ? "text-red-400"
                  : themeClasses.text
              )}
            >
              {deleteConfirm?.step === "first"
                ? `Delete ${label.singular}?`
                : "Are you absolutely sure?"}
            </DrawerTitle>
            <DrawerDescription className="text-slate-400 text-sm">
              {deleteConfirm?.step === "first" ? (
                <>
                  You're about to delete{" "}
                  <span
                    className="font-semibold"
                    style={{ color: deleteConfirm?.item.color || "#22d3ee" }}
                  >
                    {deleteConfirm?.item.name}
                  </span>
                  . This action cannot be undone.
                </>
              ) : (
                <>
                  This will permanently remove{" "}
                  <span
                    className="font-semibold"
                    style={{ color: deleteConfirm?.item.color || "#22d3ee" }}
                  >
                    {deleteConfirm?.item.name}
                  </span>{" "}
                  and all associated data.
                  {itemType === "category" && (
                    <span className="block mt-1 text-amber-400">
                      All subcategories will also be deleted.
                    </span>
                  )}
                </>
              )}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerFooter className="pt-2 pb-6">
            <Button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className={cn(
                "w-full h-12 text-base font-semibold border-0 shadow-lg transition-all",
                deleteConfirm?.step === "first"
                  ? "bg-red-500/80 hover:bg-red-500 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white animate-pulse"
              )}
            >
              {isDeleting
                ? "Deleting..."
                : deleteConfirm?.step === "first"
                  ? "Yes, Delete"
                  : "Delete Forever"}
            </Button>
            <DrawerClose asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-11 bg-transparent",
                  themeClasses.border,
                  themeClasses.text
                )}
              >
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
