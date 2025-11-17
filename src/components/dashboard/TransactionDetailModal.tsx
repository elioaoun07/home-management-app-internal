"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Trash2, X } from "lucide-react";
import { useState } from "react";
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
};

type Props = {
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export default function TransactionDetailModal({
  transaction,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [formData, setFormData] = useState({
    date: transaction.date,
    amount: transaction.amount.toString(),
    description: transaction.description || "",
  });
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

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0f1d2e] border border-[#3b82f6]/30 rounded-t-2xl md:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 md:slide-in-from-bottom-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3b82f6]/20">
          <h2 className="text-lg font-semibold text-white">
            Transaction Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#3b82f6]/10 transition-colors"
          >
            <X className="w-5 h-5 text-[#38bdf8]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Category Info */}
          <Card className="neo-card p-4 border-[#06b6d4]/30">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{transaction.category_icon}</span>
              <div>
                <p className="text-lg font-semibold text-white">
                  {transaction.category}
                </p>
                {transaction.subcategory && (
                  <p className="text-sm text-[#38bdf8]/70">
                    {transaction.subcategory}
                  </p>
                )}
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
              className="bg-[#1a2942] border-[#3b82f6]/30 text-white text-lg font-bold h-12"
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
              className="bg-[#1a2942] border-[#3b82f6]/30 text-white"
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
              className="w-full px-3 py-2 rounded-lg bg-[#1a2942] border border-[#3b82f6]/30 text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#06b6d4]/40"
              placeholder="Add a note..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3b82f6]/20 flex gap-3">
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
      </div>
    </div>
  );
}
