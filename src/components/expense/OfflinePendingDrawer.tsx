"use client";

import { XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSyncSafe } from "@/contexts/SyncContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { OfflineOperation } from "@/lib/offlineQueue";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  MessageCircle,
  CheckSquare,
  Pin,
  RefreshCw,
  Trash2,
  Wallet,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

interface OfflinePendingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OfflinePendingDrawer({
  open,
  onOpenChange,
}: OfflinePendingDrawerProps) {
  const themeClasses = useThemeClasses();
  const sync = useSyncSafe();
  const pendingOps = sync?.offlinePendingOps ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleDelete = useCallback(
    async (op: OfflineOperation) => {
      if (!sync?.removeOfflineOperation) return;

      // If this is a transaction create, restore the cached balance
      if (
        op.feature === "transaction" &&
        op.operation === "create" &&
        op.body?.account_id
      ) {
        try {
          const { getCachedBalance, setCachedBalance } = await import(
            "@/lib/queryConfig"
          );
          const cached = getCachedBalance(op.body.account_id as string);
          if (cached && typeof op.body.amount === "number") {
            // Restore balance (add back the amount that was subtracted optimistically)
            setCachedBalance(
              op.body.account_id as string,
              cached.balance + op.body.amount,
            );
          }
        } catch {
          /* ignore */
        }
      }

      await sync.removeOfflineOperation(op.id);
      toast.success("Pending transaction removed", {
        icon: <Trash2 className="w-4 h-4 text-amber-400" />,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            // Re-queue the operation
            if (sync.queueOperation) {
              await sync.queueOperation({
                feature: op.feature,
                operation: op.operation,
                endpoint: op.endpoint,
                method: op.method,
                body: op.body,
                tempId: op.tempId,
                metadata: op.metadata,
              });
              toast.success("Transaction restored");
            }
          },
        },
      });
    },
    [sync],
  );

  const handleStartEdit = useCallback((op: OfflineOperation) => {
    setEditingId(op.id);
    setEditAmount(String(op.body?.amount ?? ""));
    setEditDescription(String(op.body?.description ?? ""));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditAmount("");
    setEditDescription("");
  }, []);

  const handleSaveEdit = useCallback(
    async (op: OfflineOperation) => {
      if (!sync?.updateOfflineOperation) return;

      const newAmount = parseFloat(editAmount);
      if (isNaN(newAmount) || newAmount <= 0) {
        toast.error("Enter a valid amount");
        return;
      }

      const oldAmount =
        typeof op.body?.amount === "number" ? op.body.amount : 0;
      const amountDiff = newAmount - oldAmount;

      await sync.updateOfflineOperation(op.id, {
        body: {
          amount: newAmount,
          description: editDescription || undefined,
        },
        metadata: {
          label: `Add ${editDescription || "transaction"} $${newAmount}`,
        },
      });

      // Update cached balance to reflect the edit
      if (
        op.feature === "transaction" &&
        op.operation === "create" &&
        op.body?.account_id &&
        amountDiff !== 0
      ) {
        try {
          const { getCachedBalance, setCachedBalance } = await import(
            "@/lib/queryConfig"
          );
          const cached = getCachedBalance(op.body.account_id as string);
          if (cached) {
            setCachedBalance(
              op.body.account_id as string,
              cached.balance - amountDiff,
            );
          }
        } catch {
          /* ignore */
        }
      }

      setEditingId(null);
      toast.success("Pending transaction updated", { icon: "Edit" });
    },
    [sync, editAmount, editDescription],
  );

  const handleClearAll = useCallback(async () => {
    if (!sync?.clearOfflineQueue) return;

    // Restore all cached balances before clearing
    for (const op of pendingOps) {
      if (
        op.feature === "transaction" &&
        op.operation === "create" &&
        op.body?.account_id
      ) {
        try {
          const { getCachedBalance, setCachedBalance } = await import(
            "@/lib/queryConfig"
          );
          const cached = getCachedBalance(op.body.account_id as string);
          if (cached && typeof op.body.amount === "number") {
            setCachedBalance(
              op.body.account_id as string,
              cached.balance + op.body.amount,
            );
          }
        } catch {
          /* ignore */
        }
      }
    }

    await sync.clearOfflineQueue();
    onOpenChange(false);
  }, [sync, pendingOps, onOpenChange]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "max-h-[85vh] border-t",
          themeClasses.modalBg,
          themeClasses.border,
        )}
      >
        <DrawerHeader className="border-b border-white/5 pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-white flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-400" />
              Pending Offline
            </DrawerTitle>
            <div className="flex items-center gap-1">
              {pendingOps.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-2 py-1 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XIcon className="w-5 h-5 text-white/50" />
              </button>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-1">
            {pendingOps.length === 0
              ? "No pending changes. All synced!"
              : `${pendingOps.length} change${pendingOps.length !== 1 ? "s" : ""} will sync when you're back online.`}
          </p>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-3">
          {pendingOps.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
              <p className="text-white/40 text-sm">No pending operations</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {pendingOps.map((op) => (
                <motion.div
                  key={op.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, height: 0 }}
                  className={cn(
                    "p-3 rounded-xl border transition-all",
                    "bg-amber-500/5 border-amber-400/15",
                  )}
                >
                  {editingId === op.id ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-white/50 mb-1 block">
                          Amount
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className={cn(
                            "h-9 text-white",
                            themeClasses.inputBg,
                            themeClasses.border,
                          )}
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-white/50 mb-1 block">
                          Description
                        </Label>
                        <Input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Optional description"
                          className={cn(
                            "h-9 text-white",
                            themeClasses.inputBg,
                            themeClasses.border,
                          )}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSaveEdit(op)}
                          size="sm"
                          className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-400/20"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          size="sm"
                          variant="ghost"
                          className="text-white/40 hover:text-white/60"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getFeatureIcon(op.feature)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {op.metadata?.label ||
                            `${op.operation} ${op.feature}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-white/25" />
                          <span className="text-[11px] text-white/30">
                            {formatTimeAgo(new Date(op.createdAt))}
                          </span>
                          {typeof op.body?.amount === "number" && (
                            <span className="text-xs text-amber-400/80 font-medium">
                              ${(op.body.amount as number).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {typeof op.body?.description === "string" &&
                          op.body.description && (
                            <p className="text-xs text-white/30 mt-0.5 truncate">
                              {op.body.description}
                            </p>
                          )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {/* Only show edit for transaction creates */}
                        {op.feature === "transaction" &&
                          op.operation === "create" && (
                            <button
                              onClick={() => handleStartEdit(op)}
                              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-white/40 hover:text-cyan-400" />
                            </button>
                          )}
                        <button
                          onClick={() => handleDelete(op)}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function getFeatureIcon(feature: string): ReactNode {
  switch (feature) {
    case "transaction":
      return <Wallet className="w-4 h-4 text-emerald-400" />;
    case "item":
      return <ClipboardList className="w-4 h-4 text-gray-400" />;
    case "hub-message":
      return <MessageCircle className="w-4 h-4 text-blue-400" />;
    case "subtask":
      return <CheckSquare className="w-4 h-4 text-emerald-400" />;
    case "recurring":
      return <RefreshCw className="w-4 h-4 text-blue-400" />;
    default:
      return <Pin className="w-4 h-4 text-blue-400" />;
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString();
}
