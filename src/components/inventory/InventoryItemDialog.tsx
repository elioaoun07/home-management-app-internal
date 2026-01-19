// src/components/inventory/InventoryItemDialog.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateInventoryItem } from "@/features/inventory/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type {
  CreateInventoryItemInput,
  InventoryUnitType,
} from "@/types/inventory";
import {
  COMMON_CONSUMPTION_RATES,
  UNIT_TYPE_EXAMPLES,
  UNIT_TYPE_LABELS,
} from "@/types/inventory";
import {
  AlertCircle,
  Calendar,
  Hash,
  Loader2,
  Package,
  ShoppingCart,
  Store,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";

interface InventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  categoryId?: string;
}

export function InventoryItemDialog({
  open,
  onOpenChange,
  moduleId,
  categoryId,
}: InventoryItemDialogProps) {
  const themeClasses = useThemeClasses();
  const createItem = useCreateInventoryItem();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitType, setUnitType] = useState<InventoryUnitType>("pack");
  const [unitSize, setUnitSize] = useState("");
  const [consumptionRateDays, setConsumptionRateDays] = useState<number>(30);
  const [customConsumption, setCustomConsumption] = useState("");
  const [minimumStock, setMinimumStock] = useState<number>(1);
  const [typicalPurchaseQty, setTypicalPurchaseQty] = useState<number>(1);
  const [preferredStore, setPreferredStore] = useState("");
  const [notes, setNotes] = useState("");
  const [initialQuantity, setInitialQuantity] = useState<number>(1);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setUnitType("pack");
      setUnitSize("");
      setConsumptionRateDays(30);
      setCustomConsumption("");
      setMinimumStock(1);
      setTypicalPurchaseQty(1);
      setPreferredStore("");
      setNotes("");
      setInitialQuantity(1);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (!unitSize.trim()) return;

    // Use custom consumption if entered, otherwise use selected preset
    const finalConsumptionDays = customConsumption
      ? parseInt(customConsumption, 10)
      : consumptionRateDays;

    const input: CreateInventoryItemInput = {
      module_id: moduleId,
      category_id: categoryId,
      name: name.trim(),
      description: description.trim() || undefined,
      unit_type: unitType,
      unit_size: unitSize.trim(),
      consumption_rate_days: finalConsumptionDays,
      minimum_stock: minimumStock,
      typical_purchase_quantity: typicalPurchaseQty,
      preferred_store: preferredStore.trim() || undefined,
      notes: notes.trim() || undefined,
      initial_quantity: initialQuantity,
    };

    await createItem.mutateAsync(input);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-lg max-h-[90vh] overflow-y-auto",
          themeClasses.cardBg,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Package className="w-5 h-5" />
            Add Inventory Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Item Name */}
          <div className="space-y-2">
            <Label className="text-white/80">
              Item Name <span className="text-red-400">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Toilet Paper, Salt, Milk..."
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white placeholder:text-white/40",
              )}
              autoFocus
            />
          </div>

          {/* Unit Type & Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/80">Unit Type</Label>
              <Select
                value={unitType}
                onValueChange={(v) => setUnitType(v as InventoryUnitType)}
              >
                <SelectTrigger
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(UNIT_TYPE_LABELS) as InventoryUnitType[]).map(
                    (type) => (
                      <SelectItem key={type} value={type}>
                        {UNIT_TYPE_LABELS[type]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">
                Unit Size <span className="text-red-400">*</span>
              </Label>
              <Input
                value={unitSize}
                onChange={(e) => setUnitSize(e.target.value)}
                placeholder={UNIT_TYPE_EXAMPLES[unitType][0]}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40",
                )}
              />
              <p className="text-xs text-white/40">
                Examples: {UNIT_TYPE_EXAMPLES[unitType].join(", ")}
              </p>
            </div>
          </div>

          {/* Consumption Rate */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-white/80">
              <Timer className="w-4 h-4" />
              How long does one unit last?
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {COMMON_CONSUMPTION_RATES.slice(0, 6).map((rate) => (
                <button
                  key={rate.days}
                  type="button"
                  onClick={() => {
                    setConsumptionRateDays(rate.days);
                    setCustomConsumption("");
                  }}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm transition-colors",
                    consumptionRateDays === rate.days && !customConsumption
                      ? "bg-primary text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10",
                  )}
                >
                  {rate.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                value={customConsumption}
                onChange={(e) => setCustomConsumption(e.target.value)}
                placeholder="Custom days"
                className={cn(
                  "w-32",
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40",
                )}
              />
              <span className="text-white/60 text-sm">days per unit</span>
            </div>
          </div>

          {/* Initial Quantity & Minimum Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-white/80">
                <Hash className="w-4 h-4" />
                Current Stock
              </Label>
              <Input
                type="number"
                min={0}
                value={initialQuantity}
                onChange={(e) =>
                  setInitialQuantity(parseInt(e.target.value, 10) || 0)
                }
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
              <p className="text-xs text-white/40">How many do you have now?</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-white/80">
                <AlertCircle className="w-4 h-4" />
                Minimum Stock
              </Label>
              <Input
                type="number"
                min={0}
                value={minimumStock}
                onChange={(e) =>
                  setMinimumStock(parseInt(e.target.value, 10) || 0)
                }
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
              <p className="text-xs text-white/40">Alert when below this</p>
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4 pt-2 border-t border-white/10">
            <p className="text-sm text-white/40">Optional details</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-white/80">
                  <ShoppingCart className="w-4 h-4" />
                  Typical Purchase Qty
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={typicalPurchaseQty}
                  onChange={(e) =>
                    setTypicalPurchaseQty(parseInt(e.target.value, 10) || 1)
                  }
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white",
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-white/80">
                  <Store className="w-4 h-4" />
                  Preferred Store
                </Label>
                <Input
                  value={preferredStore}
                  onChange={(e) => setPreferredStore(e.target.value)}
                  placeholder="e.g., Spinneys"
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white placeholder:text-white/40",
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special notes for when shopping..."
                rows={2}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40 resize-none",
                )}
              />
            </div>
          </div>

          {/* Estimated runout preview */}
          {initialQuantity > 0 &&
            (consumptionRateDays || customConsumption) && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white/80">
                    Estimated to last until:{" "}
                    <strong className="text-blue-400">
                      {new Date(
                        Date.now() +
                          initialQuantity *
                            (customConsumption
                              ? parseInt(customConsumption, 10)
                              : consumptionRateDays) *
                            24 *
                            60 *
                            60 *
                            1000,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
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
            disabled={!name.trim() || !unitSize.trim() || createItem.isPending}
          >
            {createItem.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Package className="w-4 h-4 mr-2" />
                Add to Inventory
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
