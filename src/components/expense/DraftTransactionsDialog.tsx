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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type DraftTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  voice_transcript: string | null;
  confidence_score: number | null;
  inserted_at: string;
  account_id: string;
  accounts: { name: string };
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function DraftTransactionsDialog({ open, onOpenChange }: Props) {
  const themeClasses = useThemeClasses();
  const { data: drafts = [], isLoading: loading } = useDrafts();
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

  const startEditing = (draft: DraftTransaction) => {
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
    // Optimistic - UI updates instantly via mutation hook
    confirmDraftMutation.mutate(
      {
        id: draftId,
        ...editForm,
      },
      {
        onSuccess: () => {
          toast.success("Transaction confirmed!");
          cancelEditing();
        },
        onError: () => {
          toast.error("Failed to confirm transaction");
        },
      }
    );
  };

  const deleteDraft = (draftId: string) => {
    // Optimistic - draft disappears instantly, hook handles toast with Undo
    deleteDraftMutation.mutate(draftId, {
      onSuccess: () => {
        if (editingId === draftId) cancelEditing();
      },
      onError: () => {
        toast.error("Failed to delete draft");
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
      <Badge variant={variant} className="text-xs">
        {percentage}% match
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className={cn("flex items-center gap-2", themeClasses.dialogTitle)}
          >
            <MicIcon className={cn("w-5 h-5", themeClasses.glow)} />
            Voice Entry Drafts
          </DialogTitle>
          <DialogDescription>
            Review and confirm voice-recorded transactions. Edit details if the
            voice recognition needs correction.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading drafts...
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-12">
            <MicIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]" />
            <p className="text-muted-foreground">No draft transactions</p>
            <p className="text-sm text-muted-foreground mt-2">
              Use voice entry to create transactions that need review
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => {
              const isEditing = editingId === draft.id;

              return (
                <div
                  key={draft.id}
                  className={cn(
                    "border rounded-lg p-4 space-y-3",
                    isEditing && "border-primary bg-primary/5"
                  )}
                >
                  {/* Voice transcript if available */}
                  {draft.voice_transcript && (
                    <div className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded">
                      <MicIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
                      <div className="flex-1">
                        <p className="italic text-muted-foreground">
                          &ldquo;{draft.voice_transcript}&rdquo;
                        </p>
                      </div>
                      {getConfidenceBadge(draft.confidence_score)}
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-3">
                      {/* Edit Form */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Amount</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                amount: e.target.value,
                              }))
                            }
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={editForm.date}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                date: e.target.value,
                              }))
                            }
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Account</Label>
                        <select
                          value={editForm.account_id}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              account_id: e.target.value,
                            }))
                          }
                          className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                        >
                          {accounts.map((acc: any) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs">Category</Label>
                        <select
                          value={editForm.category_id}
                          onChange={(e) => {
                            setEditForm((f) => ({
                              ...f,
                              category_id: e.target.value,
                              subcategory_id: "", // Reset subcategory when category changes
                            }));
                          }}
                          className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                        >
                          <option value="">Select category...</option>
                          {categories
                            .filter(
                              (cat) => !("parent_id" in cat) || !cat.parent_id
                            )
                            .map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs">
                          Subcategory (optional)
                        </Label>
                        <select
                          value={editForm.subcategory_id}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              subcategory_id: e.target.value,
                            }))
                          }
                          className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                          disabled={!editForm.category_id}
                        >
                          <option value="">None</option>
                          {categories
                            .filter(
                              (cat) =>
                                "parent_id" in cat &&
                                cat.parent_id === editForm.category_id
                            )
                            .map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                          className="h-9"
                          placeholder="Optional notes"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => confirmDraft(draft.id)}
                          className="flex-1"
                        >
                          <CheckIcon className="w-4 h-4 mr-2 drop-shadow-[0_0_6px_rgba(20,184,166,0.5)]" />
                          Confirm & Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                        >
                          <XIcon className="w-4 h-4 mr-2 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* View Mode */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">
                              ${draft.amount.toFixed(2)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {draft.accounts.name}
                            </Badge>
                          </div>
                          <div className="text-sm space-y-0.5">
                            <p className="text-muted-foreground">
                              {draft.category ? (
                                <>
                                  <span className="font-medium">
                                    {draft.category.name}
                                  </span>
                                  {draft.subcategory &&
                                    ` • ${draft.subcategory.name}`}
                                </>
                              ) : (
                                <span className="italic">
                                  No category matched
                                </span>
                              )}
                            </p>
                            {draft.description && (
                              <p className="text-muted-foreground">
                                {draft.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(draft.date), "MMM dd, yyyy")} •{" "}
                              {format(new Date(draft.inserted_at), "h:mm a")}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEditing(draft)}
                            title="Edit draft"
                          >
                            <PencilIcon className="w-4 h-4 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteDraft(draft.id)}
                            title="Delete draft"
                          >
                            <Trash2Icon className="w-4 h-4 text-destructive drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
