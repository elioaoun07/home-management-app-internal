/**
 * Mobile Dashboard Component
 * Optimized for quick glance and easy navigation with compact list view
 */
"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, Calendar, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Transaction {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  user_name?: string;
}

interface Props {
  transactions: Transaction[];
  totalSpent: number;
  period: { start: string; end: string };
}

export default function MobileDashboard({
  transactions,
  totalSpent,
  period,
}: Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewTransaction, setViewTransaction] = useState<Transaction | null>(
    null
  );
  const queryClient = useQueryClient();

  // Group transactions by date
  const groupedByDate = transactions.reduce(
    (acc, tx) => {
      const date = tx.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(tx);
      return acc;
    },
    {} as Record<string, Transaction[]>
  );

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transaction");
      }

      toast.success("Transaction deleted");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete transaction");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] pb-32">
      {/* Compact Header Stats */}
      <div className="bg-[#1a2942] border-b border-[#3b82f6]/20 px-4 pt-safe pb-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground">Total Spending</p>
            <h1 className="text-3xl font-bold">${totalSpent.toFixed(2)}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {transactions.length} transactions
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(period.start).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              -{" "}
              {new Date(period.end).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction List - Grouped by Date */}
      <div className="px-3 py-3 space-y-3">
        {dates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No transactions yet</p>
            <p className="text-xs mt-1">Tap + to add your first expense</p>
          </div>
        ) : (
          dates.map((date) => (
            <div key={date} className="space-y-2">
              {/* Date Header */}
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-xs font-semibold text-[hsl(var(--nav-text-primary))] uppercase tracking-wider">
                  {formatDate(date)}
                </h3>
                <div className="flex-1 h-px bg-[hsl(var(--header-border)/0.2)]" />
                <span className="text-xs font-bold text-[hsl(var(--nav-text-primary))]">
                  $
                  {groupedByDate[date]
                    .reduce((sum, tx) => sum + tx.amount, 0)
                    .toFixed(2)}
                </span>
              </div>

              {/* Transactions */}
              {groupedByDate[date].map((tx) => (
                <Card
                  key={tx.id}
                  onClick={() => setViewTransaction(tx)}
                  className="neo-card p-3 cursor-pointer active:scale-[0.98] transition-all hover:neo-glow-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <ArrowDownCircle className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-sm truncate">
                          {tx.category || "Uncategorized"}
                        </span>
                        {tx.subcategory && (
                          <span className="text-xs text-muted-foreground truncate">
                            • {tx.subcategory}
                          </span>
                        )}
                      </div>
                      {tx.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-base">
                        ${tx.amount.toFixed(2)}
                      </div>
                      {tx.user_name && (
                        <div className="text-[10px] text-muted-foreground">
                          {tx.user_name}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ))
        )}
      </div>

      {/* View/Edit Transaction Dialog */}
      <Dialog
        open={!!viewTransaction}
        onOpenChange={(open) => !open && setViewTransaction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              View or delete this transaction
            </DialogDescription>
          </DialogHeader>
          {viewTransaction && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <p className="text-2xl font-bold">
                  ${viewTransaction.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Category</p>
                <p className="text-base">
                  {viewTransaction.category || "Uncategorized"}
                </p>
                {viewTransaction.subcategory && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {viewTransaction.subcategory}
                  </p>
                )}
              </div>
              {viewTransaction.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-base">{viewTransaction.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date</p>
                <p className="text-base">
                  {new Date(viewTransaction.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              {viewTransaction.user_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Added by</p>
                  <p className="text-base">{viewTransaction.user_name}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setViewTransaction(null)}
              suppressHydrationWarning
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (viewTransaction) {
                  setDeleteId(viewTransaction.id);
                  setViewTransaction(null);
                }
              }}
              suppressHydrationWarning
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              suppressHydrationWarning
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              suppressHydrationWarning
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
