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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useDrafts } from "@/features/drafts/useDrafts";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export default function DraftsPage() {
  const themeClasses = useThemeClasses();
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
      <div
        className={`min-h-screen ${themeClasses.bgPage} flex items-center justify-center`}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className={`w-8 h-8 border-2 ${themeClasses.spinnerBorder} border-t-transparent rounded-full animate-spin`}
          />
          <p className={`${themeClasses.loadingText} text-sm font-medium`}>
            Loading drafts...
          </p>
        </div>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div
        className={`min-h-screen ${themeClasses.bgPage} flex items-center justify-center p-6`}
      >
        <div className="text-center max-w-sm">
          <div
            className={`w-20 h-20 mx-auto mb-6 ${themeClasses.bgSurface} rounded-full flex items-center justify-center`}
          >
            <MicIcon
              className={`w-10 h-10 ${themeClasses.labelText} ${themeClasses.spinnerGlow}`}
            />
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
    <div className={`min-h-screen ${themeClasses.bgPage} pb-24`}>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div
              className={`w-10 h-10 ${themeClasses.bgSurface} rounded-full flex items-center justify-center`}
            >
              <MicIcon
                className={`w-5 h-5 ${themeClasses.labelText} ${themeClasses.iconGlow}`}
              />
            </div>
            <div
              className={`absolute -top-1 -right-1 w-5 h-5 ${themeClasses.badgeBg} rounded-full flex items-center justify-center`}
            >
              <span
                className={`text-[10px] font-bold ${themeClasses.bgPage.includes("1a0a14") ? "text-[#1a0a14]" : "text-[#0a1628]"}`}
              >
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
                `rounded-2xl p-5 space-y-4 ${themeClasses.surfaceBg} border transition-all`,
                isEditing
                  ? `${themeClasses.borderAccent} shadow-lg ${themeClasses.glow}`
                  : `${themeClasses.border} ${themeClasses.borderHover}`
              )}
            >
              {/* Voice transcript */}
              {draft.voice_transcript && (
                <div
                  className={`flex items-start gap-3 ${themeClasses.bgPage}/70 p-4 rounded-xl border ${themeClasses.border}`}
                >
                  <MicIcon
                    className={`w-4 h-4 mt-0.5 flex-shrink-0 ${themeClasses.text} ${themeClasses.iconGlow}`}
                  />
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
                      <Label
                        className={`text-sm font-medium ${themeClasses.labelText}`}
                      >
                        Amount
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, amount: e.target.value }))
                        }
                        className={`h-11 ${themeClasses.formControlBg} text-white text-base`}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        className={`text-sm font-medium ${themeClasses.labelText}`}
                      >
                        Date
                      </Label>
                      <Input
                        type="date"
                        value={editForm.date}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, date: e.target.value }))
                        }
                        className={`h-11 ${themeClasses.bgPage} ${themeClasses.border} text-white text-base ${themeClasses.focusRing}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      className={`text-sm font-medium ${themeClasses.labelText}`}
                    >
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
                      className={`w-full h-11 rounded-lg border ${themeClasses.bgPage} ${themeClasses.border} px-3 text-base text-white ${themeClasses.focusRing} focus:outline-none`}
                    >
                      {accounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      className={`text-sm font-medium ${themeClasses.labelText}`}
                    >
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
                      className={`w-full h-11 rounded-lg border ${themeClasses.bgPage} ${themeClasses.border} px-3 text-base text-white ${themeClasses.focusRing} focus:outline-none`}
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
                      <Label
                        className={`text-sm font-medium ${themeClasses.labelText}`}
                      >
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
                        className={`w-full h-11 rounded-lg border ${themeClasses.bgPage} ${themeClasses.border} px-3 text-base text-white ${themeClasses.focusRing} focus:outline-none`}
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
                    <Label
                      className={`text-sm font-medium ${themeClasses.labelText}`}
                    >
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
                      className={`h-11 ${themeClasses.bgPage} ${themeClasses.border} text-white text-base ${themeClasses.focusRing}`}
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => confirmDraft(draft.id)}
                      className={`flex-1 h-12 ${themeClasses.isPink ? "bg-pink-500 hover:bg-pink-600 shadow-pink-500/25" : "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/25"} text-white font-medium rounded-xl shadow-lg transition-all`}
                    >
                      <CheckIcon
                        className={`w-5 h-5 mr-2 ${themeClasses.iconGlow}`}
                      />
                      Confirm & Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEditing}
                      className={`h-12 px-6 ${themeClasses.border} ${themeClasses.textMuted} ${themeClasses.bgHover} hover:text-white rounded-xl`}
                    >
                      <XIcon className="w-5 h-5 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
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
                          className={`text-xs ${themeClasses.border} ${themeClasses.text} bg-primary/5`}
                        >
                          {draft.accounts.name}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(draft)}
                          className={`w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 ${themeClasses.text} flex items-center justify-center transition-colors`}
                        >
                          <PencilIcon className="w-4 h-4 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
                        </button>
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                        >
                          <Trash2Icon className="w-4 h-4 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
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
