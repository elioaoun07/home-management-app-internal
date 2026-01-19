// src/components/inventory/InventoryView.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useAddToShopping,
  useInventoryItems,
  useLowStockItems,
  useRestockItem,
} from "@/features/inventory/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { InventoryItemWithStock } from "@/types/inventory";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { InventoryItemDialog } from "./InventoryItemDialog";
import { RestockDialog } from "./RestockDialog";

interface InventoryViewProps {
  moduleId: string;
  categoryId?: string;
  shoppingThreadId?: string; // ID of shopping thread to add items to
}

export function InventoryView({
  moduleId,
  categoryId,
  shoppingThreadId,
}: InventoryViewProps) {
  const themeClasses = useThemeClasses();

  // Data
  const { data: items = [], isLoading, refetch } = useInventoryItems();
  const { data: lowStockItems = [] } = useLowStockItems(7);
  const restockMutation = useRestockItem();
  const addToShoppingMutation = useAddToShopping();

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<InventoryItemWithStock | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "low">("all");

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items;

    if (viewMode === "low") {
      const lowStockIds = new Set(lowStockItems.map((i) => i.item_id));
      result = items.filter((item) => lowStockIds.has(item.id));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.metadata.barcode?.includes(query),
      );
    }

    return result;
  }, [items, lowStockItems, searchQuery, viewMode]);

  // Sort by stock status (critical first)
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const statusOrder = { out: 0, critical: 1, low: 2, ok: 3 };
      return statusOrder[a.stock_status] - statusOrder[b.stock_status];
    });
  }, [filteredItems]);

  // Quick restock (increment by typical purchase quantity)
  const handleQuickRestock = async (item: InventoryItemWithStock) => {
    const qty = item.metadata.typical_purchase_quantity || 1;
    await restockMutation.mutateAsync({
      item_id: item.id,
      quantity: qty,
      source: "manual",
    });
  };

  // Add all low stock items to shopping
  const handleAddAllToShopping = async () => {
    if (!shoppingThreadId) return;
    const itemIds = lowStockItems
      .filter((item) => !item.already_in_shopping)
      .map((item) => item.item_id);

    if (itemIds.length > 0) {
      await addToShoppingMutation.mutateAsync({
        itemIds,
        threadId: shoppingThreadId,
      });
    }
  };

  // Stock status badge
  const getStatusBadge = (status: InventoryItemWithStock["stock_status"]) => {
    const config = {
      ok: { color: "bg-green-500/20 text-green-400", label: "In Stock" },
      low: { color: "bg-yellow-500/20 text-yellow-400", label: "Low" },
      critical: {
        color: "bg-orange-500/20 text-orange-400",
        label: "Critical",
      },
      out: { color: "bg-red-500/20 text-red-400", label: "Out" },
    };
    return config[status];
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            type="text"
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-10",
              themeClasses.inputBg,
              "border-white/10 text-white placeholder:text-white/40",
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10"
            >
              <X className="w-4 h-4 text-white/40" />
            </button>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={cn(
              "px-3 py-2 text-sm transition-colors",
              viewMode === "all"
                ? "bg-primary text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10",
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setViewMode("low")}
            className={cn(
              "px-3 py-2 text-sm transition-colors flex items-center gap-1.5",
              viewMode === "low"
                ? "bg-primary text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10",
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            Low Stock
            {lowStockItems.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                {lowStockItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Actions */}
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </Button>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && viewMode !== "low" && (
        <Card
          className={cn(
            "p-4 border-orange-500/30 bg-orange-500/10",
            themeClasses.border,
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/20">
                <Bell className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="font-medium text-white">
                  {lowStockItems.length} item
                  {lowStockItems.length !== 1 ? "s" : ""} running low
                </p>
                <p className="text-sm text-white/60">
                  {lowStockItems.filter((i) => !i.already_in_shopping).length}{" "}
                  not yet in shopping list
                </p>
              </div>
            </div>
            {shoppingThreadId && (
              <Button
                size="sm"
                onClick={handleAddAllToShopping}
                disabled={
                  addToShoppingMutation.isPending ||
                  lowStockItems.every((i) => i.already_in_shopping)
                }
                className="gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Shopping
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <Card
          className={cn(
            "p-12 text-center",
            themeClasses.cardBg,
            themeClasses.border,
          )}
        >
          <Package className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <h3 className="text-lg font-medium text-white mb-2">
            No inventory items yet
          </h3>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            Start tracking your household essentials by adding items manually.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </Card>
      )}

      {/* Inventory Grid */}
      {!isLoading && sortedItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedItems.map((item) => {
            const statusBadge = getStatusBadge(item.stock_status);
            const daysLeft = item.days_until_runout;

            return (
              <Card
                key={item.id}
                className={cn(
                  "p-4 transition-all hover:shadow-lg",
                  themeClasses.cardBg,
                  themeClasses.border,
                  item.stock_status === "out" && "border-red-500/50",
                  item.stock_status === "critical" && "border-orange-500/50",
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">
                      {item.name}
                    </h3>
                    {item.metadata.unit_size && (
                      <p className="text-sm text-white/60">
                        {item.metadata.unit_size}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      statusBadge.color,
                    )}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                {/* Stock Info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <p className="text-3xl font-bold text-white">
                      {item.stock?.quantity_on_hand ?? 0}
                    </p>
                    <p className="text-xs text-white/40">in stock</p>
                  </div>

                  {daysLeft !== null && (
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-lg font-medium",
                          daysLeft <= 0
                            ? "text-red-400"
                            : daysLeft <= 7
                              ? "text-orange-400"
                              : "text-white/80",
                        )}
                      >
                        {daysLeft <= 0 ? "Now" : `${daysLeft}d`}
                      </p>
                      <p className="text-xs text-white/40">until runout</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => handleQuickRestock(item)}
                    disabled={restockMutation.isPending}
                  >
                    <PackagePlus className="w-4 h-4" />
                    Restock
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(item);
                      setShowRestockDialog(true);
                    }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <InventoryItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        moduleId={moduleId}
        categoryId={categoryId}
      />

      <RestockDialog
        open={showRestockDialog}
        onOpenChange={setShowRestockDialog}
        item={selectedItem}
      />
    </div>
  );
}
