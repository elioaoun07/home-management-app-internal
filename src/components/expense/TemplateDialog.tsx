"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import AccountSelect from "./AccountSelect";
import CategoryGrid from "./CategoryGrid";
import SubcategoryGrid from "./SubcategoryGrid";
import { Template } from "./TemplateQuickEntryButton";

export default function TemplateDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<Template>;
  onSave: (tpl: Partial<Template>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [accountId, setAccountId] = useState(initial?.account_id || "");
  const [categoryId, setCategoryId] = useState(initial?.category_id || "");
  const [subcategoryId, setSubcategoryId] = useState(
    initial?.subcategory_id || ""
  );
  const [amount, setAmount] = useState(initial?.amount || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [saving, setSaving] = useState(false);

  // Sync local state when opening or when the provided initial template changes
  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setAccountId(initial?.account_id || "");
    setCategoryId(initial?.category_id || "");
    setSubcategoryId(initial?.subcategory_id || "");
    setAmount(initial?.amount || "");
    setDescription(initial?.description || "");
  }, [open, initial]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount || isNaN(Number(amount))) {
      toast.error("Please provide a valid name and amount");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...initial,
        name: name.trim(),
        account_id: accountId || undefined,
        category_id: categoryId || undefined,
        subcategory_id: subcategoryId || undefined,
        amount: amount,
        description: description || null,
      });
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || "Failed to save template";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {initial?.id ? "Edit Template" : "New Template"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSave}
          className="space-y-4 overflow-y-auto flex-1 px-1"
        >
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <AccountSelect value={accountId} onChange={setAccountId} />
          </div>
          <div>
            <CategoryGrid
              accountId={accountId}
              selectedCategoryId={categoryId}
              onCategorySelect={setCategoryId}
            />
          </div>
          <div>
            <SubcategoryGrid
              accountId={accountId}
              parentCategoryId={categoryId}
              selectedSubcategoryId={subcategoryId}
              onSubcategorySelect={setSubcategoryId}
            />
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              type="number"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            {onDelete && initial?.id && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={saving}
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name || !amount}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
