"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useDrafts } from "@/features/drafts/useDrafts";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Mic, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function DraftsPage() {
  const { data: drafts = [], isLoading: loading } = useDrafts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    category_id: "",
    subcategory_id: "",
    description: "",
    date: "",
    account_id: "",
  });
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories(editForm.account_id);

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

  const confirmDraft = async (draftId: string) => {
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Transaction confirmed!");
        cancelEditing();
        // Invalidate all related queries
        queryClient.invalidateQueries({ queryKey: qk.drafts() });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      } else {
        toast.error(data.error || "Failed to confirm");
      }
    } catch (error) {
      toast.error("Failed to confirm transaction");
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Draft deleted");
        if (editingId === draftId) cancelEditing();
        // Invalidate drafts query
        queryClient.invalidateQueries({ queryKey: qk.drafts() });
        queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch (error) {
      toast.error("Failed to delete draft");
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#06b6d4] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#06b6d4] text-sm font-medium">
            Loading drafts...
          </p>
        </div>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 bg-[#06b6d4]/10 rounded-full flex items-center justify-center">
            <Mic className="w-10 h-10 text-[#06b6d4]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            No Draft Transactions
          </h2>
          <p className="text-[#94a3b8] leading-relaxed">
            Use the microphone button when adding expenses to create voice
            entries. They'll appear here for review and confirmation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] pb-24">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="w-10 h-10 bg-[#06b6d4]/20 rounded-full flex items-center justify-center">
              <Mic className="w-5 h-5 text-[#06b6d4]" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#06b6d4] rounded-full flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#0a1628]">
                {drafts.length}
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Draft Transactions</h1>
            <p className="text-xs text-[#64748b]">
              Review and confirm voice entries
            </p>
          </div>
        </div>

        {/* Draft Cards */}
        {drafts.map((draft) => {
          const isEditing = editingId === draft.id;

          return (
            <div
              key={draft.id}
              className={cn(
                "rounded-2xl p-5 space-y-4 bg-[#1a2942] border transition-all",
                isEditing
                  ? "border-[#06b6d4] shadow-lg shadow-[#06b6d4]/20"
                  : "border-[#1a2942] hover:border-[#2a3952]"
              )}
            >
              {/* Voice transcript */}
              {draft.voice_transcript && (
                <div className="flex items-start gap-3 bg-[#0a1628]/70 p-4 rounded-xl border border-[#1e3a4f]">
                  <Mic className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#06b6d4]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm italic text-[#94a3b8] leading-relaxed">
                      &ldquo;{draft.voice_transcript}&rdquo;
                    </p>
                  </div>
                  {getConfidenceBadge(draft.confidence_score)}
                </div>
              )}

              {isEditing ? (
                <div className="space-y-4">
                  {/* Edit Form */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#06b6d4]">
                        Amount
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, amount: e.target.value }))
                        }
                        className="h-11 bg-[#0a1628] border-[#06b6d4]/30 text-white text-base focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#06b6d4]">
                        Date
                      </Label>
                      <Input
                        type="date"
                        value={editForm.date}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, date: e.target.value }))
                        }
                        className="h-11 bg-[#0a1628] border-[#06b6d4]/30 text-white text-base focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#06b6d4]">
                      Account
                    </Label>
                    <select
                      value={editForm.account_id}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          account_id: e.target.value,
                        }))
                      }
                      className="w-full h-11 rounded-lg border bg-[#0a1628] border-[#06b6d4]/30 px-3 text-base text-white focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20 focus:outline-none"
                    >
                      {accounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#06b6d4]">
                      Category
                    </Label>
                    <select
                      value={editForm.category_id}
                      onChange={(e) => {
                        setEditForm((f) => ({
                          ...f,
                          category_id: e.target.value,
                          subcategory_id: "",
                        }));
                      }}
                      className="w-full h-11 rounded-lg border bg-[#0a1628] border-[#06b6d4]/30 px-3 text-base text-white focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20 focus:outline-none"
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

                  {editForm.category_id && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#06b6d4]">
                        Subcategory
                      </Label>
                      <select
                        value={editForm.subcategory_id}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            subcategory_id: e.target.value,
                          }))
                        }
                        className="w-full h-11 rounded-lg border bg-[#0a1628] border-[#06b6d4]/30 px-3 text-base text-white focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20 focus:outline-none"
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
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#06b6d4]">
                      Description
                    </Label>
                    <Input
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      className="h-11 bg-[#0a1628] border-[#06b6d4]/30 text-white text-base focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20"
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => confirmDraft(draft.id)}
                      className="flex-1 h-12 bg-[#06b6d4] hover:bg-[#0891b2] text-white font-medium rounded-xl shadow-lg shadow-[#06b6d4]/25 transition-all"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      Confirm & Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEditing}
                      className="h-12 px-6 border-[#3b82f6]/30 text-[#94a3b8] hover:bg-[#1a2942] hover:text-white rounded-xl"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* View Mode */}
                  <div className="space-y-4">
                    {/* Amount and Actions Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="text-3xl font-bold text-white tracking-tight">
                          ${draft.amount.toFixed(2)}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs border-[#06b6d4]/40 text-[#06b6d4] bg-[#06b6d4]/5"
                        >
                          {draft.accounts.name}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(draft)}
                          className="w-10 h-10 rounded-full bg-[#06b6d4]/10 hover:bg-[#06b6d4]/20 text-[#06b6d4] flex items-center justify-center transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      <div className="text-sm">
                        {draft.category ? (
                          <p className="text-white font-medium">
                            {draft.category.name}
                            {draft.subcategory && (
                              <span className="text-[#94a3b8] font-normal">
                                {" "}
                                • {draft.subcategory.name}
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-[#64748b] italic">
                            No category matched
                          </p>
                        )}
                      </div>

                      {draft.description && (
                        <p className="text-sm text-[#94a3b8] leading-relaxed">
                          {draft.description}
                        </p>
                      )}

                      <p className="text-xs text-[#64748b]">
                        {format(new Date(draft.date), "MMM dd, yyyy")} •{" "}
                        {format(new Date(draft.inserted_at), "h:mm a")}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
