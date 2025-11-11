"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AccountBalanceProps {
  accountId: string | undefined;
  accountName?: string;
}

interface Balance {
  account_id: string;
  balance: number;
  updated_at: string;
}

export default function AccountBalance({ accountId, accountName }: AccountBalanceProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Fetch balance
  const { data: balance, isLoading, error } = useQuery<Balance>({
    queryKey: ["account-balance", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const res = await fetch(`/api/accounts/${accountId}/balance`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch balance' }));
        throw new Error(errorData.error || "Failed to fetch balance");
      }
      return res.json();
    },
    enabled: !!accountId,
    retry: 1,
  });

  // Update balance mutation
  const updateBalanceMutation = useMutation({
    mutationFn: async (newBalance: number) => {
      if (!accountId) throw new Error("No account selected");
      const res = await fetch(`/api/accounts/${accountId}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: newBalance }),
      });
      if (!res.ok) throw new Error("Failed to update balance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-balance", accountId] });
      toast.success("Balance updated successfully");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update balance");
    },
  });

  const handleEdit = () => {
    setEditValue(String(balance?.balance || 0));
    setIsEditing(true);
  };

  const handleSave = () => {
    const newBalance = parseFloat(editValue);
    if (isNaN(newBalance)) {
      toast.error("Please enter a valid number");
      return;
    }
    updateBalanceMutation.mutate(newBalance);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  if (!accountId) {
    return null;
  }

  if (error) {
    return (
      <Card className="p-4 mb-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Label className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Account Balance - Setup Required
            </Label>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              Database table not found. Please run the migration script to enable balance tracking.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-4 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-24 mb-2"></div>
          <div className="h-8 bg-muted rounded w-32"></div>
        </div>
      </Card>
    );
  }

  const currentBalance = balance?.balance || 0;

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Label className="text-sm text-muted-foreground">
            {accountName || "Account"} Balance
          </Label>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-10 w-32"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleSave}
                disabled={updateBalanceMutation.isPending}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleCancel}
                disabled={updateBalanceMutation.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tabular-nums">
                ${currentBalance.toFixed(2)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleEdit}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {!isEditing && balance?.updated_at && (
          <div className="text-xs text-muted-foreground">
            Updated: {new Date(balance.updated_at).toLocaleDateString()}
          </div>
        )}
      </div>
      {!isEditing && currentBalance !== 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          This is your reconciliation balance. Transactions will be deducted from this amount.
        </p>
      )}
    </Card>
  );
}
