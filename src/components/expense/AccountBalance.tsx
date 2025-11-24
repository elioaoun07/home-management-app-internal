"use client";

import { Edit2Icon, SaveIcon, XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface AccountBalanceProps {
  accountId: string | undefined;
  accountName?: string;
}

interface Balance {
  account_id: string;
  balance: number;
  updated_at: string;
  balance_set_at?: string;
  pending_drafts?: number;
  draft_count?: number;
}

export default function AccountBalance({
  accountId,
  accountName,
}: AccountBalanceProps) {
  const themeClasses = useThemeClasses();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Fetch balance
  const {
    data: balance,
    isLoading,
    error,
  } = useQuery<Balance>({
    queryKey: ["account-balance", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const res = await fetch(`/api/accounts/${accountId}/balance`, {
        cache: "no-store", // Always fetch fresh data
      });
      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ error: "Failed to fetch balance" }));
        throw new Error(errorData.error || "Failed to fetch balance");
      }
      return res.json();
    },
    enabled: !!accountId,
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes - balance updated through mutations
  });

  // Handle errors with useEffect (new React Query pattern)
  useEffect(() => {
    if (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load balance. Please refresh."
      );
    }
  }, [error]);

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
      queryClient.invalidateQueries({
        queryKey: ["account-balance", accountId],
      });
      toast.success("Balance updated successfully");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update balance"
      );
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
      <div className="neo-card bg-[#1a2942] border-yellow-500/20 p-4 mb-4">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Label className="text-sm font-medium text-yellow-400">
              Account Balance - Setup Required
            </Label>
            <p className="text-xs text-yellow-300/70 mt-1">
              Database table not found. Please run the migration script to
              enable balance tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="neo-card bg-[#1a2942] p-4 mb-4">
        <div className="animate-pulse">
          <div className="h-4 bg-[#3b82f6]/20 rounded w-24 mb-2"></div>
          <div className="h-8 bg-[#3b82f6]/20 rounded w-32"></div>
        </div>
      </div>
    );
  }

  const currentBalance = balance?.balance || 0;

  return (
    <div className="neo-card bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] border-[#06b6d4]/30 p-2.5 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Label className="text-[10px] text-[#06b6d4] font-medium uppercase tracking-wider">
            {accountName || "Account"} Balance
          </Label>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1.5">
              <Input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 w-32 text-lg font-bold bg-[#0a1628] border-[#06b6d4]/60 text-white focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 bg-[#14b8a6]/20 hover:bg-[#14b8a6]/30 border border-[#14b8a6]/30"
                onClick={handleSave}
                disabled={updateBalanceMutation.isPending}
              >
                <SaveIcon className="h-4 w-4 text-[#14b8a6] drop-shadow-[0_0_6px_rgba(20,184,166,0.5)]" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                onClick={handleCancel}
                disabled={updateBalanceMutation.isPending}
              >
                <XIcon className="h-4 w-4 text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 mt-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xl font-bold tabular-nums bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(20,184,166,0.4)]`}
                >
                  ${currentBalance.toFixed(2)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 shadow-[0_0_0_1px_rgba(59,130,246,0.4)_inset] rounded-lg active:scale-95 transition-all"
                  onClick={handleEdit}
                >
                  <Edit2Icon className="h-3.5 w-3.5 text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
                </Button>
              </div>
              <span
                className={
                  balance?.pending_drafts && balance.pending_drafts > 0
                    ? "text-xs font-medium text-amber-400/90 drop-shadow-[0_0_6px_rgba(251,191,36,0.3)]"
                    : `text-xs ${themeClasses.textFaint} font-medium`
                }
              >
                {String(balance?.draft_count ?? 0)} pending draft
                {Number(balance?.draft_count ?? 0) !== 1 ? "s" : ""}
                {balance?.pending_drafts && balance.pending_drafts > 0
                  ? ` ($${balance.pending_drafts.toFixed(2)})`
                  : ""}
              </span>
            </div>
          )}
        </div>
        {!isEditing && (balance?.balance_set_at || balance?.updated_at) && (
          <div className="text-[10px] text-[hsl(var(--text-muted-light)/0.5)] text-right">
            {balance?.balance_set_at && (
              <>
                <span className="font-medium">Set on</span>
                <br />
                <span>{new Date(balance.balance_set_at).toLocaleString()}</span>
                {balance?.updated_at && <br />}
              </>
            )}

            {balance?.updated_at && (
              <>
                <span className="font-medium">Updated</span>
                <br />
                <span>{new Date(balance.updated_at).toLocaleString()}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
