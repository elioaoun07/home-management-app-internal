// src/components/inventory/RestockDialog.tsx
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
import { useRestockHistory, useRestockItem } from "@/features/inventory/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { InventoryItemWithStock } from "@/types/inventory";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDown,
  History,
  Loader2,
  Minus,
  Package,
  PackagePlus,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";

interface RestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItemWithStock | null;
}

export function RestockDialog({
  open,
  onOpenChange,
  item,
}: RestockDialogProps) {
  const themeClasses = useThemeClasses();
  const restockMutation = useRestockItem();
  const { data: history = [] } = useRestockHistory(item?.id);

  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<"add" | "set">("add");

  // Reset when item changes
  useEffect(() => {
    if (item) {
      setQuantity(item.metadata.typical_purchase_quantity || 1);
      setMode("add");
    }
  }, [item]);

  if (!item) return null;

  const currentStock = item.stock?.quantity_on_hand ?? 0;
  const newStock = mode === "add" ? currentStock + quantity : quantity;

  const handleSubmit = async () => {
    if (mode === "add") {
      await restockMutation.mutateAsync({
        item_id: item.id,
        quantity: quantity,
        source: "manual",
      });
    } else {
      // Set mode: calculate difference
      const diff = quantity - currentStock;
      if (diff > 0) {
        await restockMutation.mutateAsync({
          item_id: item.id,
          quantity: diff,
          source: "manual",
        });
      }
      // TODO: Handle decrement if needed
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-md", themeClasses.cardBg, themeClasses.border)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <PackagePlus className="w-5 h-5" />
            Restock {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Current Stock Display */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
            <div>
              <p className="text-sm text-white/60">Current Stock</p>
              <p className="text-2xl font-bold text-white">{currentStock}</p>
              {item.metadata.unit_size && (
                <p className="text-sm text-white/40">
                  {item.metadata.unit_size}
                </p>
              )}
            </div>
            {item.days_until_runout !== null && (
              <div className="text-right">
                <p className="text-sm text-white/60">Runs out in</p>
                <p
                  className={cn(
                    "text-xl font-medium",
                    item.days_until_runout <= 0
                      ? "text-red-400"
                      : item.days_until_runout <= 7
                        ? "text-orange-400"
                        : "text-green-400",
                  )}
                >
                  {item.days_until_runout <= 0
                    ? "Now"
                    : `${item.days_until_runout} days`}
                </p>
              </div>
            )}
          </div>

          {/* Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              type="button"
              onClick={() => setMode("add")}
              className={cn(
                "flex-1 px-4 py-2 text-sm transition-colors flex items-center justify-center gap-2",
                mode === "add"
                  ? "bg-primary text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              <Plus className="w-4 h-4" />
              Add to Stock
            </button>
            <button
              type="button"
              onClick={() => setMode("set")}
              className={cn(
                "flex-1 px-4 py-2 text-sm transition-colors flex items-center justify-center gap-2",
                mode === "set"
                  ? "bg-primary text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              <Package className="w-4 h-4" />
              Set Stock
            </button>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label className="text-white/80">
              {mode === "add" ? "Quantity to Add" : "New Stock Level"}
            </Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(0, quantity - 1))}
                disabled={quantity <= 0}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                className={cn(
                  "text-center text-xl font-bold w-24",
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick buttons */}
            <div className="flex gap-2 pt-2">
              {[1, 2, 3, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuantity(n)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-sm transition-colors",
                    quantity === n
                      ? "bg-primary text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <span className="text-white/80">New Stock Level</span>
            <div className="flex items-center gap-2">
              <span className="text-white/60">{currentStock}</span>
              <ArrowDown className="w-4 h-4 text-green-400 rotate-180" />
              <span className="text-xl font-bold text-green-400">
                {newStock}
              </span>
            </div>
          </div>

          {/* Recent History */}
          {history.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-white/60">
                <History className="w-4 h-4" />
                Recent Restocks
              </Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {history.slice(0, 3).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-sm p-2 rounded bg-white/5"
                  >
                    <span className="text-white/60">
                      {formatDistanceToNow(new Date(entry.restocked_at), {
                        addSuffix: true,
                      })}
                    </span>
                    <span className="text-green-400 font-medium">
                      +{entry.quantity_added}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={quantity <= 0 || restockMutation.isPending}
          >
            {restockMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <PackagePlus className="w-4 h-4 mr-2" />
                {mode === "add" ? "Add Stock" : "Update Stock"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
