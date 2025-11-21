"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  account_name?: string;
  category_icon?: string;
  user_theme?: string;
  user_id?: string;
  is_owner?: boolean;
};

type Props = {
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  currentUserId?: string;
};

export default function TransactionDetailModal({
  transaction,
  onClose,
  onSave,
  onDelete,
  currentUserId,
}: Props) {
  // Check if current user owns this transaction
  const isOwner =
    transaction.is_owner ??
    (!currentUserId ||
      !transaction.user_id ||
      transaction.user_id === currentUserId);

  const [formData, setFormData] = useState({
    date: transaction.date,
    amount: transaction.amount.toString(),
    description: transaction.description || "",
    account_id: transaction.account_id,
    category_id: "",
    subcategory_id: "",
  });
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(
    transaction.account_id
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formData.date,
          amount: parseFloat(formData.amount),
          description: formData.description,
          account_id: formData.account_id,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      toast.success("Transaction updated");
      onSave();
      onClose();
    } catch (error) {
      toast.error("Failed to update transaction");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this transaction?")) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Transaction deleted");
      onDelete();
      onClose();
    } catch (error) {
      toast.error("Failed to delete transaction");
    } finally {
      setDeleting(false);
    }
  };

  // Load accounts and categories
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories(selectedAccount ?? undefined);

  // Build category lists (support DB-flat and default nested shapes)
  const topCategories: Array<{
    id: string;
    name: string;
    sub: Array<{ id: string; name: string }>;
  }> = [];
  if (categories && Array.isArray(categories)) {
    const anyHasParent = (categories as any[]).some((c) =>
      Object.prototype.hasOwnProperty.call(c, "parent_id")
    );
    if (anyHasParent) {
      // DB-flat shape: group by parent_id
      const byId: Record<string, any> = {};
      for (const c of categories as any[]) byId[c.id] = c;
      const parents = (categories as any[]).filter((c) => !c.parent_id);
      for (const p of parents) {
        const subs = (categories as any[]).filter((s) => s.parent_id === p.id);
        topCategories.push({
          id: p.id,
          name: p.name,
          sub: subs.map((s) => ({ id: s.id, name: s.name })),
        });
      }
    } else {
      // Default nested shape
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

  // When categories/account load, try to map the current transaction names to ids
  // Use effect to pre-select category/subcategory when possible
  useEffect(() => {
    if (!categories) return;
    if (transaction.category) {
      const found = (categories as any[]).find(
        (c) => c.name === transaction.category || c.id === transaction.category
      );
      if (found) {
        setFormData((prev) => ({ ...prev, category_id: found.id }));
        if (transaction.subcategory) {
          // try nested
          const subFound = (found.subcategories || []).find(
            (s: any) =>
              s.name === transaction.subcategory ||
              s.id === transaction.subcategory
          );
          if (subFound)
            setFormData((prev) => ({ ...prev, subcategory_id: subFound.id }));
          else {
            // try flat children
            const child = (categories as any[]).find(
              (c) =>
                c.parent_id === found.id &&
                (c.name === transaction.subcategory ||
                  c.id === transaction.subcategory)
            );
            if (child)
              setFormData((prev) => ({ ...prev, subcategory_id: child.id }));
          }
        }
      }
    }
    // map account id
    if (transaction.account_id) {
      setFormData((prev) => ({ ...prev, account_id: transaction.account_id }));
      setSelectedAccount(transaction.account_id);
    }
  }, [categories, transaction]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md md:max-w-lg bg-[#0f1d2e] border border-[#3b82f6]/30 rounded-t-2xl md:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 md:slide-in-from-bottom-0 flex flex-col"
        style={{
          // Reserve space for the bottom navigation bar so it serves as the modal delimiter.
          // 72px is a reasonable default for the mobile nav height; adjust if your nav is taller.
          maxHeight: "calc(100vh - 72px)",
          marginBottom: "72px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3b82f6]/20">
          <h2 className="text-lg font-semibold text-white">
            {isOwner ? "Transaction Details" : "View Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#3b82f6]/10 transition-colors"
          >
            <X className="w-5 h-5 text-[#38bdf8]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Account / Category Selectors */}
          <Card className="neo-card p-3 border-[#06b6d4]/30">
            <div className="flex items-start gap-3">
              <div className="text-3xl mt-1">
                {transaction.category_icon || "💰"}
              </div>
              <div className="flex-1">
                <div className="space-y-2">
                  <div>
                    <Label className="text-[#06b6d4] text-xs">Account</Label>
                    <select
                      value={formData.account_id}
                      onChange={(e) => {
                        const acc = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          account_id: acc,
                          category_id: "",
                          subcategory_id: "",
                        }));
                        setSelectedAccount(acc);
                      }}
                      disabled={!isOwner}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-[#1a2942] border border-[#3b82f6]/20 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select account</option>
                      {(accounts || []).map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[#06b6d4] text-xs">Category</Label>
                      <select
                        value={formData.category_id}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            category_id: e.target.value,
                            subcategory_id: "",
                          }))
                        }
                        disabled={!isOwner}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#1a2942] border border-[#3b82f6]/20 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">None</option>
                        {topCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-[#06b6d4] text-xs">
                        Subcategory
                      </Label>
                      <select
                        value={formData.subcategory_id}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subcategory_id: e.target.value,
                          }))
                        }
                        disabled={!isOwner}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-[#1a2942] border border-[#3b82f6]/20 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">None</option>
                        {(() => {
                          const sel = topCategories.find(
                            (tc) => tc.id === formData.category_id
                          );
                          return (sel?.sub || []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-[#06b6d4] text-sm">Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              disabled={!isOwner}
              className="bg-[#1a2942] border-[#3b82f6]/30 text-white text-lg font-bold h-12 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-[#06b6d4] text-sm">Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              disabled={!isOwner}
              className="bg-[#1a2942] border-[#3b82f6]/30 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label className="text-[#06b6d4] text-sm">Account</Label>
            <div className="px-3 py-2 rounded-lg bg-[#1a2942]/50 border border-[#3b82f6]/20 text-white">
              {transaction.account_name}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-[#06b6d4] text-sm">Description</Label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              disabled={!isOwner}
              className="w-full px-3 py-2 rounded-lg bg-[#1a2942] border border-[#3b82f6]/30 text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#06b6d4]/40 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Add a note..."
            />
          </div>
        </div>

        {/* Footer (sticky on mobile) */}
        {isOwner ? (
          <div className="p-4 border-t border-[#3b82f6]/20 flex gap-3 bg-[#0f1d2e] sticky bottom-0">
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 neo-gradient"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <div className="p-4 border-t border-[#3b82f6]/20 bg-[#0f1d2e] sticky bottom-0">
            <p className="text-center text-[#38bdf8]/60 text-sm">
              Read-only: This is your partner's transaction
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
