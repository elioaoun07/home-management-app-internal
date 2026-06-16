// src/components/hub/BulkConvertReviewSheet.tsx
"use client";

import { CheckIcon, SaveIcon, XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HubMessage } from "@/features/hub/hooks";
import { useCreateMessageAction } from "@/features/hub/messageActions";
import { useCreateReminder, itemsKeys } from "@/features/items/useItems";
import { useAddTransaction } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { parseMessageForTransaction } from "@/lib/nlp/messageTransactionParser";
import { parseSmartText } from "@/lib/smartTextParser";
import { qk } from "@/lib/queryKeys";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { safeFetch } from "@/lib/safeFetch";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { localToISO, yyyyMmDd } from "@/lib/utils/date";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

// Same taxonomy as AddReminderFromMessageModal + smartTextParser's parseCategories
const REMINDER_CATEGORIES = [
  { id: "personal", name: "Personal", color_hex: "#8B5CF6" },
  { id: "home", name: "Home", color_hex: "#1E90FF" },
  { id: "family", name: "Family", color_hex: "#FFA500" },
  { id: "community", name: "Community", color_hex: "#22C55E" },
  { id: "friends", name: "Friends", color_hex: "#EC4899" },
  { id: "work", name: "Work", color_hex: "#FF3B30" },
] as const;

type BudgetRow = {
  messageId: string;
  content: string;
  amount: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  date: string;
  confirmed: boolean;
};

type ReminderRow = {
  messageId: string;
  content: string;
  title: string;
  dueDate: string;
  dueTime: string;
  categoryIds: string[];
  confirmed: boolean;
};

type CreatedRecord =
  | { kind: "transaction"; id: string; messageActionId: string }
  | { kind: "draft"; id: string; messageActionId: string }
  | { kind: "item"; id: string; messageActionId: string };

interface Props {
  messages: HubMessage[];
  purpose: "budget" | "reminder";
  categories: any[];
  accounts: any[];
  defaultAccountId?: string;
  onClose: () => void;
  onComplete: (messageIds: string[]) => void;
}

export default function BulkConvertReviewSheet({
  messages,
  purpose,
  categories,
  accounts,
  defaultAccountId,
  onClose,
  onComplete,
}: Props) {
  const tc = useThemeClasses();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const addTransaction = useAddTransaction();
  const createReminder = useCreateReminder();
  const createAction = useCreateMessageAction();

  const [accountId, setAccountId] = useState(
    defaultAccountId || accounts[0]?.id || "",
  );

  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>(() =>
    purpose === "budget"
      ? messages.map((msg) => {
          const parsed = parseMessageForTransaction(
            msg.content || "",
            categories as any[],
          );
          return {
            messageId: msg.id,
            content: msg.content || "",
            amount: parsed.amount !== null ? String(parsed.amount) : "",
            description: msg.content || "",
            categoryId: parsed.categoryId || "",
            subcategoryId: parsed.subcategoryId || "",
            date: parsed.date || yyyyMmDd(new Date()),
            confirmed: parsed.amount !== null,
          };
        })
      : [],
  );

  const [reminderRows, setReminderRows] = useState<ReminderRow[]>(() =>
    purpose === "reminder"
      ? messages.map((msg) => {
          const parsed = parseSmartText(msg.content || "");
          return {
            messageId: msg.id,
            content: msg.content || "",
            title: parsed.title || msg.content || "Untitled",
            dueDate: parsed.dueDate || parsed.startDate || "",
            dueTime: parsed.dueTime || parsed.startTime || "",
            categoryIds: parsed.categoryIds || [],
            confirmed: true,
          };
        })
      : [],
  );

  const updateBudgetRow = (index: number, patch: Partial<BudgetRow>) => {
    setBudgetRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const updateReminderRow = (index: number, patch: Partial<ReminderRow>) => {
    setReminderRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  // Build category dropdown options (handles both DB-flat and nested shapes)
  const topCategories: Array<{
    id: string;
    name: string;
    sub: Array<{ id: string; name: string }>;
  }> = [];
  if (categories && Array.isArray(categories)) {
    const anyHasParent = (categories as any[]).some((c) =>
      Object.prototype.hasOwnProperty.call(c, "parent_id"),
    );
    if (anyHasParent) {
      const parents = (categories as any[]).filter((c: any) => !c.parent_id);
      for (const p of parents) {
        const subs = (categories as any[]).filter(
          (s: any) => s.parent_id === p.id,
        );
        topCategories.push({
          id: p.id,
          name: p.name,
          sub: subs.map((s: any) => ({ id: s.id, name: s.name })),
        });
      }
    } else {
      for (const c of categories as any[]) {
        topCategories.push({
          id: c.id,
          name: c.name,
          sub: (c.subcategories || []).map((s: any) => ({
            id: s.id,
            name: s.name,
          })),
        });
      }
    }
  }

  const today = yyyyMmDd(new Date());

  const handleSaveAll = async () => {
    if (purpose === "budget" && !accountId) {
      toast.error("Please select an account");
      return;
    }

    setIsSaving(true);
    const processedIds: string[] = [];
    const created: CreatedRecord[] = [];
    let createdCount = 0;
    let draftCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    if (purpose === "budget") {
      for (const row of budgetRows) {
        const amt = parseFloat(row.amount);
        if (isNaN(amt) || amt <= 0) {
          skippedCount++;
          continue;
        }
        const isFuture = row.date > today;
        const isDraft = !row.confirmed || isFuture;

        try {
          if (isDraft) {
            const res = await safeFetch("/api/drafts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: amt,
                description: row.description,
                date: row.date,
                account_id: accountId,
                category_id: row.categoryId || null,
                subcategory_id: row.subcategoryId || null,
                scheduled_date: isFuture ? row.date : undefined,
              }),
            });
            if (!res.ok) throw new Error("Failed to create draft");
            const { draft } = await res.json();
            const action = await createAction.mutateAsync({
              messageId: row.messageId,
              actionType: "transaction",
              transactionId: draft.id,
            });
            created.push({
              kind: "draft",
              id: draft.id,
              messageActionId: action.id,
            });
            draftCount++;
          } else {
            const tx = await addTransaction.mutateAsync({
              amount: amt,
              description: row.description,
              date: row.date,
              account_id: accountId,
              category_id: row.categoryId || null,
              subcategory_id: row.subcategoryId || null,
            });
            const action = await createAction.mutateAsync({
              messageId: row.messageId,
              actionType: "transaction",
              transactionId: tx.id,
            });
            created.push({
              kind: "transaction",
              id: tx.id,
              messageActionId: action.id,
            });
            createdCount++;
          }
          processedIds.push(row.messageId);
        } catch {
          failedCount++;
        }
      }
    } else {
      for (const row of reminderRows) {
        const title = row.title.trim() || row.content.trim() || "Untitled";
        const dueAt = row.dueDate
          ? localToISO(row.dueDate, row.dueTime || "09:00")
          : undefined;
        const isDraft = !row.confirmed;

        try {
          const item = await createReminder.mutateAsync({
            type: "reminder",
            title,
            priority: "normal",
            is_public: false,
            status: isDraft ? "draft" : "pending",
            due_at: dueAt,
            category_ids: row.categoryIds.length
              ? row.categoryIds
              : undefined,
          });
          const action = await createAction.mutateAsync({
            messageId: row.messageId,
            actionType: "reminder",
            metadata: { item_id: item?.id, item_type: "reminder", isDraft },
          });
          if (item?.id) {
            created.push({
              kind: "item",
              id: item.id,
              messageActionId: action.id,
            });
          }
          if (isDraft) draftCount++;
          else createdCount++;
          processedIds.push(row.messageId);
        } catch {
          failedCount++;
        }
      }
    }

    setIsSaving(false);

    if (processedIds.length === 0) {
      toast.error("Nothing to save");
      return;
    }

    // The draft-transaction path posts directly to /api/drafts via safeFetch,
    // bypassing useAddTransaction/useCreateReminder's own onSuccess invalidation —
    // so the drafts badge/drawer and account balance need an explicit refresh here.
    if (purpose === "budget") {
      invalidateAccountData(queryClient, accountId);
      queryClient.invalidateQueries({ queryKey: qk.drafts() });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } else {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    }

    const parts: string[] = [];
    if (createdCount > 0)
      parts.push(
        `${createdCount} ${purpose === "budget" ? "transaction" : "reminder"}${createdCount > 1 ? "s" : ""}`,
      );
    if (draftCount > 0)
      parts.push(`${draftCount} draft${draftCount > 1 ? "s" : ""}`);
    if (skippedCount > 0)
      parts.push(`${skippedCount} skipped (no amount)`);
    if (failedCount > 0) parts.push(`${failedCount} failed`);

    toast.success(parts.join(" · "), {
      icon: ToastIcons.create,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await Promise.all(
              created.map(async (rec) => {
                await safeFetch(
                  `/api/hub/message-actions/${rec.messageActionId}`,
                  { method: "DELETE" },
                );
                if (rec.kind === "transaction") {
                  await safeFetch(`/api/transactions/${rec.id}`, {
                    method: "DELETE",
                  });
                } else if (rec.kind === "draft") {
                  await safeFetch(`/api/drafts/${rec.id}`, {
                    method: "DELETE",
                  });
                } else {
                  await supabaseBrowser().from("items").delete().eq(
                    "id",
                    rec.id,
                  );
                }
              }),
            );
            queryClient.invalidateQueries({ queryKey: ["hub", "messages"] });
            queryClient.invalidateQueries({
              queryKey: ["hub", "message-actions"],
            });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            invalidateAccountData(queryClient, accountId);
            queryClient.invalidateQueries({ queryKey: qk.drafts() });
            queryClient.invalidateQueries({ queryKey: itemsKeys.all });
            toast.success("Undone", { icon: ToastIcons.delete });
          } catch {
            toast.error("Failed to undo some items");
          }
        },
      },
    });

    onComplete(processedIds);
  };

  const isPending =
    isSaving ||
    addTransaction.isPending ||
    createReminder.isPending ||
    createAction.isPending;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={cn(
          tc.bgPage,
          "relative w-full max-w-md mb-[72px] rounded-t-3xl shadow-2xl flex flex-col border-t border-white/10",
        )}
        style={{ maxHeight: "calc(100vh - 120px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between p-4 pb-3 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Review {messages.length} message
              {messages.length > 1 ? "s" : ""}
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              {purpose === "budget"
                ? "Confirm to add as transactions, or leave as drafts"
                : "Confirm to add as schedule items, or leave as drafts"}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${tc.hoverBgSubtle} transition-colors`}
          >
            <XIcon className="w-5 h-5 text-white/70" />
          </button>
        </div>

        <div className="px-4 pb-4 pt-3 space-y-3 flex-1 overflow-y-auto">
          {purpose === "budget" && (
            <div className="px-4 py-3 rounded-xl bg-white/5">
              <p className="text-xs text-white/50 mb-2">
                Account (applies to all rows)
              </p>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-transparent border-none text-white focus:ring-0"
              >
                <option value="">Select account</option>
                {(accounts || []).map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {purpose === "budget"
            ? budgetRows.map((row, index) => {
                const amt = parseFloat(row.amount);
                const hasAmount = !isNaN(amt) && amt > 0;
                const sel = topCategories.find(
                  (tc) => tc.id === row.categoryId,
                );
                return (
                  <div
                    key={row.messageId}
                    className="rounded-xl bg-white/5 p-3 space-y-2 border border-white/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-white/40 italic line-clamp-2 flex-1">
                        “{row.content}”
                      </p>
                      <button
                        onClick={() =>
                          updateBudgetRow(index, {
                            confirmed: !row.confirmed,
                          })
                        }
                        className={cn(
                          "shrink-0 px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all",
                          row.confirmed
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-300",
                        )}
                      >
                        {row.confirmed ? (
                          <CheckIcon className="w-3 h-3" />
                        ) : null}
                        {row.confirmed ? "Confirmed" : "Save as draft"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-white/50 mb-1">Amount</p>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row.amount}
                          onChange={(e) =>
                            updateBudgetRow(index, {
                              amount: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          className="bg-white/5 border-white/10 text-white"
                        />
                        {!hasAmount && (
                          <p className="text-[11px] text-amber-400 mt-1">
                            No amount — will be skipped
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-white/50 mb-1">Date</p>
                        <Input
                          type="date"
                          value={row.date}
                          onChange={(e) =>
                            updateBudgetRow(index, { date: e.target.value })
                          }
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={row.categoryId}
                        onChange={(e) =>
                          updateBudgetRow(index, {
                            categoryId: e.target.value,
                            subcategoryId: "",
                          })
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-2 py-2"
                      >
                        <option value="">Category</option>
                        {topCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {sel && sel.sub.length > 0 ? (
                        <select
                          value={row.subcategoryId}
                          onChange={(e) =>
                            updateBudgetRow(index, {
                              subcategoryId: e.target.value,
                            })
                          }
                          className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-2 py-2"
                        >
                          <option value="">Subcategory</option>
                          {sel.sub.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          type="text"
                          value={row.description}
                          onChange={(e) =>
                            updateBudgetRow(index, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Description"
                          className="bg-white/5 border-white/10 text-white"
                        />
                      )}
                    </div>
                  </div>
                );
              })
            : reminderRows.map((row, index) => (
                <div
                  key={row.messageId}
                  className="rounded-xl bg-white/5 p-3 space-y-2 border border-white/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-white/40 italic line-clamp-2 flex-1">
                      “{row.content}”
                    </p>
                    <button
                      onClick={() =>
                        updateReminderRow(index, {
                          confirmed: !row.confirmed,
                        })
                      }
                      className={cn(
                        "shrink-0 px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all",
                        row.confirmed
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-300",
                      )}
                    >
                      {row.confirmed ? (
                        <CheckIcon className="w-3 h-3" />
                      ) : null}
                      {row.confirmed ? "Confirmed" : "Save as draft"}
                    </button>
                  </div>

                  <Input
                    type="text"
                    value={row.title}
                    onChange={(e) =>
                      updateReminderRow(index, { title: e.target.value })
                    }
                    placeholder="Title"
                    className="bg-white/5 border-white/10 text-white"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) =>
                        updateReminderRow(index, {
                          dueDate: e.target.value,
                        })
                      }
                      className="bg-white/5 border-white/10 text-white"
                    />
                    <Input
                      type="time"
                      value={row.dueTime}
                      onChange={(e) =>
                        updateReminderRow(index, {
                          dueTime: e.target.value,
                        })
                      }
                      disabled={!row.dueDate}
                      className="bg-white/5 border-white/10 text-white disabled:opacity-40"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {REMINDER_CATEGORIES.map((cat) => {
                      const active = row.categoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() =>
                            updateReminderRow(index, {
                              categoryIds: active
                                ? row.categoryIds.filter(
                                    (id) => id !== cat.id,
                                  )
                                : [...row.categoryIds, cat.id],
                            })
                          }
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                            active
                              ? "text-white border"
                              : "bg-white/5 text-white/60 hover:bg-white/10 border border-transparent",
                          )}
                          style={
                            active
                              ? {
                                  backgroundColor: `${cat.color_hex}20`,
                                  borderColor: cat.color_hex,
                                }
                              : undefined
                          }
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
        </div>

        <div className="p-4 pt-2 flex gap-3 border-t border-white/10">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={isPending || messages.length === 0}
            className="flex-1 neo-gradient"
          >
            <SaveIcon className="w-4 h-4 mr-2" />
            {isPending ? "Saving..." : `Save ${messages.length}`}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
