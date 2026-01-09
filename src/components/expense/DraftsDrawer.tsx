"use client";

import {
  CheckIcon,
  MicIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useConfirmDraft,
  useDeleteDraft,
  useDrafts,
} from "@/features/drafts/useDrafts";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

interface DraftsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DraftsDrawer({
  open,
  onOpenChange,
}: DraftsDrawerProps) {
  const themeClasses = useThemeClasses();
  const { data: draftsData = [], isLoading } = useDrafts();
  const deleteDraftMutation = useDeleteDraft();
  const confirmDraftMutation = useConfirmDraft();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    category_id: "",
    subcategory_id: "",
    description: "",
    date: "",
    account_id: "",
  });
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories(editForm.account_id);

  // Ensure drafts is always an array
  const drafts = Array.isArray(draftsData) ? draftsData : [];

  // Get parent categories (no parent_id)
  const parentCategories = categories.filter((c: any) => !c.parent_id);

  // Get subcategories for selected category
  const subcategories = editForm.category_id
    ? categories.filter((c: any) => c.parent_id === editForm.category_id)
    : [];

  const startEditing = (draft: (typeof drafts)[0]) => {
    setEditingId(draft.id);
    setEditForm({
      amount: draft.amount.toString(),
      category_id: draft.category_id || "",
      subcategory_id: draft.subcategory_id || "",
      description: draft.description || "",
      date: draft.date,
      account_id: draft.account_id,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({
      amount: "",
      category_id: "",
      subcategory_id: "",
      description: "",
      date: "",
      account_id: "",
    });
  };

  const confirmDraft = (draftId: string) => {
    if (!editForm.amount || !editForm.category_id) {
      toast.error("Please fill in amount and category");
      return;
    }

    // Optimistic - UI updates instantly
    confirmDraftMutation.mutate(
      {
        id: draftId,
        ...editForm,
      },
      {
        onSuccess: () => {
          toast.success("Transaction confirmed!");
          cancelEditing();
          // Close drawer if no more drafts
          if (drafts.length === 1) {
            onOpenChange(false);
          }
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to confirm transaction"
          );
        },
      }
    );
  };

  const deleteDraft = (draftId: string) => {
    // Optimistic - draft disappears instantly, hook handles toast with Undo
    deleteDraftMutation.mutate(draftId, {
      onSuccess: () => {
        if (editingId === draftId) cancelEditing();
        // Close drawer if no more drafts
        if (drafts.length === 1) {
          onOpenChange(false);
        }
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete draft"
        );
      },
    });
  };

  const getConfidenceBadge = (score: number | null) => {
    if (!score) return null;
    const percentage = Math.round(score * 100);
    const variant =
      percentage >= 80
        ? "default"
        : percentage >= 50
          ? "secondary"
          : "destructive";
    return (
      <Badge variant={variant} className="text-xs px-2 py-0.5">
        {percentage}% match
      </Badge>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("max-h-[85vh]", themeClasses.cardBg)}>
        <DrawerHeader className="border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 ${themeClasses.bgSurface} rounded-full flex items-center justify-center`}
            >
              <MicIcon className={`w-5 h-5 ${themeClasses.textHighlight}`} />
            </div>
            <div>
              <DrawerTitle className="text-white text-lg">
                Draft Transactions
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
              <MicIcon
                className={`w-12 h-12 mx-auto mb-3 ${themeClasses.textMuted}`}
              />
              <p className="text-white font-medium">No draft transactions</p>
              <p className="text-sm text-[#64748b]">
                Voice entries will appear here
              </p>
            </div>
          ) : (
            drafts.map((draft) => {
              const isEditing = editingId === draft.id;

              return (
                <div
                  key={draft.id}
                  className={cn(
                    "neo-card p-4 space-y-3",
                    themeClasses.cardBg,
                    themeClasses.border,
                    isEditing && "ring-2 ring-[hsl(var(--accent-primary))]"
                  )}
                >
                  {/* Header with amount and actions */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xl font-bold ${themeClasses.textHighlight}`}
                        >
                          ${Number(draft.amount).toFixed(2)}
                        </span>
                        {getConfidenceBadge(draft.confidence_score)}
                      </div>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        {draft.accounts?.name} •{" "}
                        {format(new Date(draft.date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {!isEditing ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-[#64748b] hover:text-white"
                            onClick={() => startEditing(draft)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => deleteDraft(draft.id)}
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#64748b] hover:text-white"
                          onClick={cancelEditing}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Voice transcript */}
                  {draft.voice_transcript && (
                    <div className={`text-sm ${themeClasses.textMuted} italic`}>
                      "{draft.voice_transcript}"
                    </div>
                  )}

                  {/* Category display or edit form */}
                  {isEditing ? (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      {/* Amount */}
                      <div>
                        <Label className="text-xs text-[#64748b]">Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(e) =>
                            setEditForm({ ...editForm, amount: e.target.value })
                          }
                          className={cn(
                            "h-9",
                            themeClasses.inputBg,
                            themeClasses.border
                          )}
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <Label className="text-xs text-[#64748b]">
                          Category
                        </Label>
                        <Select
                          value={editForm.category_id}
                          onValueChange={(v) =>
                            setEditForm({
                              ...editForm,
                              category_id: v,
                              subcategory_id: "",
                            })
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              "h-9",
                              themeClasses.inputBg,
                              themeClasses.border
                            )}
                          >
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {parentCategories.map((cat: any) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Subcategory */}
                      {subcategories.length > 0 && (
                        <div>
                          <Label className="text-xs text-[#64748b]">
                            Subcategory
                          </Label>
                          <Select
                            value={editForm.subcategory_id}
                            onValueChange={(v) =>
                              setEditForm({ ...editForm, subcategory_id: v })
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                "h-9",
                                themeClasses.inputBg,
                                themeClasses.border
                              )}
                            >
                              <SelectValue placeholder="Select subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              {subcategories.map((sub: any) => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Description */}
                      <div>
                        <Label className="text-xs text-[#64748b]">
                          Description
                        </Label>
                        <Input
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              description: e.target.value,
                            })
                          }
                          placeholder="Optional description"
                          className={cn(
                            "h-9",
                            themeClasses.inputBg,
                            themeClasses.border
                          )}
                        />
                      </div>

                      {/* Confirm button */}
                      <Button
                        onClick={() => confirmDraft(draft.id)}
                        disabled={
                          confirmDraftMutation.isPending ||
                          !editForm.amount ||
                          !editForm.category_id
                        }
                        className="w-full neo-gradient text-white"
                      >
                        {confirmDraftMutation.isPending ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <CheckIcon className="w-4 h-4 mr-2" />
                            Confirm Transaction
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        {draft.category ? (
                          <Badge variant="secondary" className="text-xs">
                            {draft.category.name}
                            {draft.subcategory &&
                              ` > ${draft.subcategory.name}`}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-amber-400 border-amber-400/30"
                          >
                            No category
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => startEditing(draft)}
                        className="neo-gradient text-white text-xs h-7"
                      >
                        <CheckIcon className="w-3 h-3 mr-1" />
                        Confirm
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
