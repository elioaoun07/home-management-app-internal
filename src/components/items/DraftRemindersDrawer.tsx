"use client";

import {
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  Trash2Icon,
} from "@/components/icons/FuturisticIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  useCreateReminder,
  useDeleteItem,
  useDraftItems,
  useUpdateItem,
} from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import { format, parseISO } from "date-fns";
import { useRef } from "react";
import { toast } from "sonner";

// Same taxonomy as AddReminderFromMessageModal / BulkConvertReviewSheet
const CATEGORY_NAMES: Record<string, string> = {
  personal: "Personal",
  home: "Home",
  family: "Family",
  community: "Community",
  friends: "Friends",
  work: "Work",
};

interface DraftRemindersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DraftRemindersDrawer({
  open,
  onOpenChange,
}: DraftRemindersDrawerProps) {
  const themeClasses = useThemeClasses();
  const { data: draftsData = [], isLoading } = useDraftItems();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const createReminder = useCreateReminder();
  const deletedItemRef = useRef<ItemWithDetails | null>(null);

  const drafts = Array.isArray(draftsData) ? draftsData : [];

  const confirmDraft = (draft: ItemWithDetails) => {
    updateItem.mutate(
      { id: draft.id, status: "pending" },
      {
        onSuccess: () => {
          toast.success("Reminder confirmed!", {
            icon: ToastIcons.success,
            duration: 4000,
            action: {
              label: "Undo",
              onClick: () => {
                updateItem.mutate({ id: draft.id, status: "draft" });
              },
            },
          });
          if (drafts.length === 1) onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to confirm reminder", {
            icon: ToastIcons.error,
          });
        },
      },
    );
  };

  const deleteDraft = (draft: ItemWithDetails) => {
    deletedItemRef.current = { ...draft };
    deleteItem.mutate(draft.id, {
      onSuccess: () => {
        toast.success("Draft deleted", {
          icon: ToastIcons.delete,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              const itemToRestore = deletedItemRef.current;
              if (!itemToRestore) return;
              try {
                await createReminder.mutateAsync({
                  type: "reminder",
                  title: itemToRestore.title,
                  description: itemToRestore.description,
                  priority: itemToRestore.priority,
                  status: "draft",
                  is_public: itemToRestore.is_public,
                  responsible_user_id: itemToRestore.responsible_user_id,
                  due_at: itemToRestore.reminder_details?.due_at,
                  category_ids: itemToRestore.categories,
                });
                toast.success("Draft restored");
                deletedItemRef.current = null;
              } catch {
                toast.error("Failed to restore draft");
              }
            },
          },
        });
        if (drafts.length === 1) onOpenChange(false);
      },
      onError: () => {
        toast.error("Failed to delete draft", { icon: ToastIcons.error });
      },
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("max-h-[85vh]", themeClasses.cardBg)}>
        <DrawerHeader className="border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 ${themeClasses.bgSurface} rounded-full flex items-center justify-center`}
            >
              <FileTextIcon
                className={`w-5 h-5 ${themeClasses.textHighlight}`}
              />
            </div>
            <div>
              <DrawerTitle className="text-white text-lg">
                Draft Reminders
              </DrawerTitle>
              <p className="text-xs text-[#64748b]">
                {drafts.length} pending • Review and confirm
              </p>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-3 max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className={`w-6 h-6 border-2 ${themeClasses.spinnerBorder} border-t-transparent rounded-full animate-spin`}
              />
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-8">
              <FileTextIcon
                className={`w-12 h-12 mx-auto mb-3 ${themeClasses.textMuted}`}
              />
              <p className="text-white font-medium">No draft reminders</p>
              <p className="text-sm text-[#64748b]">
                Unconfirmed bulk-converted messages appear here
              </p>
            </div>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                className={cn(
                  "neo-card p-4 space-y-3",
                  themeClasses.cardBg,
                  themeClasses.border,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {draft.title}
                    </p>
                    {draft.reminder_details?.due_at && (
                      <p className="text-xs text-[#64748b] mt-0.5 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {format(
                          parseISO(draft.reminder_details.due_at),
                          "MMM d, yyyy 'at' h:mm a",
                        )}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                    onClick={() => deleteDraft(draft)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>

                {draft.categories && draft.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.categories.map((catId) => (
                      <Badge
                        key={catId}
                        variant="secondary"
                        className="text-xs"
                      >
                        {CATEGORY_NAMES[catId] || catId}
                      </Badge>
                    ))}
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={() => confirmDraft(draft)}
                  disabled={updateItem.isPending}
                  className="w-full neo-gradient text-white text-xs h-8"
                >
                  <CheckIcon className="w-3.5 h-3.5 mr-1.5" />
                  Confirm Reminder
                </Button>
              </div>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
