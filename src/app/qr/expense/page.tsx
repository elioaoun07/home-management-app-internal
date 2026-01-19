// src/app/qr/expense/page.tsx
// QR Code Quick Expense - Shows confirmation dialog like quick templates
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
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useAddTransaction } from "@/features/transactions/useDashboardTransactions";
import { ToastIcons } from "@/lib/toastIcons";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function QRExpensePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addTransactionMutation = useAddTransaction();

  // Get params from URL
  const accountName = searchParams.get("account") || "";
  const categoryName = searchParams.get("category") || "";
  const subcategoryName = searchParams.get("subcategory") || "";
  const prefillDescription = searchParams.get("description") || "";
  const prefillAmount = searchParams.get("amount") || "";

  // Form state
  const [amount, setAmount] = useState(prefillAmount);
  const [description, setDescription] = useState(prefillDescription);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [resolved, setResolved] = useState(false);

  // Resolved IDs
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>(
    undefined,
  );

  // Fetch accounts
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();

  // Resolve account ID from name
  useEffect(() => {
    if (accounts.length === 0) return;
    if (accountName) {
      const acc = accounts.find(
        (a: any) => a.name.toLowerCase() === accountName.toLowerCase(),
      );
      if (acc) setAccountId(acc.id);
    }
    // Fallback to default account
    if (!accountId && !accountName) {
      const defaultAcc = accounts.find((a: any) => a.is_default);
      if (defaultAcc) setAccountId(defaultAcc.id);
    }
  }, [accounts, accountName, accountId]);

  // Fetch categories for the resolved account
  const { data: categories = [], isLoading: categoriesLoading } =
    useCategories(accountId);

  // Resolve category and subcategory IDs from names
  useEffect(() => {
    if (categories.length === 0 || !categoryName) return;

    // Find parent category
    const cat = (categories as any[]).find(
      (c) =>
        c.name?.toLowerCase() === categoryName.toLowerCase() && !c.parent_id,
    );

    if (cat) {
      setCategoryId(cat.id);

      // Find subcategory
      if (subcategoryName) {
        // Check nested subcategories
        if (cat.subcategories) {
          const sub = cat.subcategories.find(
            (s: any) => s.name?.toLowerCase() === subcategoryName.toLowerCase(),
          );
          if (sub) setSubcategoryId(sub.id);
        } else {
          // Flat structure
          const sub = (categories as any[]).find(
            (c) =>
              c.parent_id === cat.id &&
              c.name?.toLowerCase() === subcategoryName.toLowerCase(),
          );
          if (sub) setSubcategoryId(sub.id);
        }
      }
      setResolved(true);
    }
  }, [categories, categoryName, subcategoryName]);

  // Build display title
  const displayTitle = [categoryName, subcategoryName]
    .filter(Boolean)
    .join(" → ");

  const isLoading = accountsLoading || categoriesLoading || !resolved;
  const isReady = accountId && categoryId && !isLoading;

  const handleClose = () => {
    setDialogOpen(false);
    router.push("/dashboard");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !categoryId || !amount) return;

    const date = new Date().toISOString().split("T")[0];

    // Close dialog immediately
    setDialogOpen(false);

    // Add transaction
    addTransactionMutation.mutate(
      {
        account_id: accountId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        amount: parseFloat(amount),
        description: description || undefined,
        date: date,
      },
      {
        onSuccess: () => {
          router.push("/dashboard");
        },
        onError: (err) => {
          console.error("QR expense failed", err);
          toast.error("Failed to add expense", { icon: ToastIcons.error });
          router.push("/dashboard");
        },
      },
    );
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isLoading
              ? "Loading..."
              : `Confirm Transaction: ${displayTitle || "Expense"}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Resolving account and category...
          </div>
        ) : !isReady ? (
          <div className="py-8 text-center text-red-500">
            Could not find matching account or category.
            <div className="mt-4">
              <Button onClick={handleClose}>Go to Dashboard</Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label>Amount *</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                type="number"
                min="0"
                step="0.01"
                autoFocus
                disabled={addTransactionMutation.isPending}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={addTransactionMutation.isPending}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={addTransactionMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addTransactionMutation.isPending || !amount}
              >
                {addTransactionMutation.isPending
                  ? "Saving..."
                  : "Add Transaction"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
