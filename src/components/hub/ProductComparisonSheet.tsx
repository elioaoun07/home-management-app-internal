// ProductComparisonSheet.tsx
// Right sidebar / bottom sheet showing product comparison across stores
"use client";

import {
  findBestDeal,
  formatPrice,
  getStockStatusInfo,
  ShoppingItemLink,
  sortLinksByValue,
  useAddItemLink,
  useDeleteItemLink,
  useItemLinks,
  useRefreshLink,
} from "@/features/hub/itemLinksHooks";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Crown,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Store,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface ProductComparisonSheetProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  itemName: string;
}

export function ProductComparisonSheet({
  isOpen,
  onClose,
  messageId,
  itemName,
}: ProductComparisonSheetProps) {
  const [newUrl, setNewUrl] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [refreshingLinkIds, setRefreshingLinkIds] = useState<Set<string>>(
    new Set()
  );

  const { data: links = [], isLoading, refetch } = useItemLinks(messageId);
  const addLink = useAddItemLink();
  const refreshLink = useRefreshLink();
  const deleteLink = useDeleteItemLink(messageId);

  const sortedLinks = sortLinksByValue(links);
  const bestDeal = findBestDeal(links);

  const handleAddUrl = async () => {
    if (!newUrl.trim()) return;

    try {
      await addLink.mutateAsync({
        message_id: messageId,
        url: newUrl.trim(),
        auto_fetch: true,
      });
      setNewUrl("");
      setIsAddingUrl(false);
      // Refetch after a delay to get scraped data
      setTimeout(() => refetch(), 3000);
    } catch {
      // Error handled by mutation
    }
  };

  const handleRefresh = async (linkId: string) => {
    // Track this specific link as refreshing
    setRefreshingLinkIds((prev) => new Set(prev).add(linkId));
    try {
      await refreshLink.mutateAsync(linkId);
    } catch {
      // Error handled by mutation
    } finally {
      // Remove from refreshing set
      setRefreshingLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }
  };

  const handleRefreshAll = async () => {
    // Add all link IDs to refreshing set immediately for UI feedback
    const allLinkIds = links.map((link) => link.id);
    setRefreshingLinkIds(new Set(allLinkIds));

    // Refresh each link with rate limiting
    for (const link of links) {
      try {
        await refreshLink.mutateAsync(link.id);
      } catch {
        // Error handled by mutation
      } finally {
        // Remove this specific link from refreshing set as it completes
        setRefreshingLinkIds((prev) => {
          const next = new Set(prev);
          next.delete(link.id);
          return next;
        });
      }
      // Rate limit between requests
      await new Promise((r) => setTimeout(r, 1000));
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          "fixed z-50 bg-gradient-to-b from-[#1a1a2e] to-[#16162a]",
          "border-l border-white/10 shadow-2xl",
          // Mobile: bottom sheet
          "md:right-0 md:top-0 md:h-full md:w-[400px]",
          // Desktop: right sidebar
          "bottom-0 left-0 right-0 md:left-auto",
          "h-[85vh] md:h-full",
          "rounded-t-3xl md:rounded-none",
          "overflow-hidden",
          "transition-transform duration-300 ease-out",
          isOpen
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1a1a2e] to-[#1a1a2e]/95 backdrop-blur-sm">
          {/* Mobile drag handle */}
          <div className="flex justify-center py-2 md:hidden">
            <div className="w-12 h-1 rounded-full bg-white/30" />
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">
                {itemName}
              </h2>
              <p className="text-xs text-white/50">
                {links.length} store{links.length !== 1 ? "s" : ""} • Compare
                prices
              </p>
            </div>

            <div className="flex items-center gap-2">
              {links.length > 0 && (
                <button
                  onClick={handleRefreshAll}
                  disabled={refreshingLinkIds.size > 0}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all"
                  title="Refresh all"
                >
                  <RefreshCw
                    className="w-4 h-4"
                    style={
                      refreshingLinkIds.size > 0
                        ? { animation: "spin 1s linear infinite" }
                        : undefined
                    }
                  />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Best Deal Banner */}
          {bestDeal && bestDeal.price && (
            <div className="mx-4 mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-300/80">Best Deal</p>
                  <p className="text-sm font-bold text-amber-300 truncate">
                    {bestDeal.store_name} •{" "}
                    {formatPrice(bestDeal.price, bestDeal.currency)}
                  </p>
                </div>
                <a
                  href={bestDeal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/50">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p>Loading stores...</p>
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/50">
              <Store className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-center">No stores added yet</p>
              <p className="text-sm text-center mt-1">
                Add product links to compare prices
              </p>
            </div>
          ) : (
            sortedLinks.map((link, index) => (
              <StoreCard
                key={link.id}
                link={link}
                isBestDeal={bestDeal?.id === link.id}
                rank={index + 1}
                onRefresh={() => handleRefresh(link.id)}
                onDelete={() => deleteLink.mutate(link.id)}
                isRefreshing={refreshingLinkIds.has(link.id)}
              />
            ))
          )}
        </div>

        {/* Add Link Form */}
        <div className="sticky bottom-0 p-4 border-t border-white/10 bg-[#16162a]">
          {isAddingUrl ? (
            <div className="space-y-3">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Paste product URL..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddUrl();
                  if (e.key === "Escape") setIsAddingUrl(false);
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddUrl}
                  disabled={!newUrl.trim() || addLink.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all disabled:opacity-50"
                >
                  {addLink.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Add Link
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsAddingUrl(false);
                    setNewUrl("");
                  }}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingUrl(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Store Link
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// Helper component to render extra info grid with proper typing
function ExtraInfoGrid({ extraInfo }: { extraInfo: Record<string, unknown> }) {
  const info = extraInfo as {
    brand?: string;
    model?: string;
    warranty?: string;
    shipping?: string;
  };

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {info.brand && (
        <div>
          <span className="text-white/50">Brand: </span>
          <span className="text-white">{info.brand}</span>
        </div>
      )}
      {info.model && (
        <div>
          <span className="text-white/50">Model: </span>
          <span className="text-white">{info.model}</span>
        </div>
      )}
      {info.warranty && (
        <div>
          <span className="text-white/50">Warranty: </span>
          <span className="text-white">{info.warranty}</span>
        </div>
      )}
      {info.shipping && (
        <div className="col-span-2">
          <span className="text-white/50">Shipping: </span>
          <span className="text-white">{info.shipping}</span>
        </div>
      )}
    </div>
  );
}

// Individual Store Card
function StoreCard({
  link,
  isBestDeal,
  rank,
  onRefresh,
  onDelete,
  isRefreshing,
}: {
  link: ShoppingItemLink;
  isBestDeal: boolean;
  rank: number;
  onRefresh: () => void;
  onDelete: () => void;
  isRefreshing: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const stockInfo = getStockStatusInfo(link.stock_status);
  const hasError = !!link.fetch_error;
  const isPending = !link.last_fetched_at && !hasError;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        isBestDeal
          ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-yellow-500/5"
          : "border-white/10 bg-white/5",
        link.stock_status === "out_of_stock" && "opacity-60"
      )}
    >
      {/* Main Row */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* Rank / Store Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold relative",
            isBestDeal
              ? "bg-amber-500/20 text-amber-300"
              : "bg-white/10 text-white/70"
          )}
        >
          {link.image_url ? (
            <>
              <Image
                src={link.image_url}
                alt=""
                width={40}
                height={40}
                className={cn(
                  "rounded-lg object-cover transition-all",
                  (isPending || isRefreshing) && "blur-sm opacity-50"
                )}
                onError={(e) => {
                  // Fallback to rank on error
                  e.currentTarget.style.display = "none";
                }}
              />
              {(isPending || isRefreshing) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw
                    className="w-5 h-5 text-white"
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                </div>
              )}
            </>
          ) : isPending || isRefreshing ? (
            <RefreshCw
              className="w-5 h-5 text-white"
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : (
            `#${rank}`
          )}
        </div>

        {/* Store Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate capitalize">
              {link.store_name || "Unknown Store"}
            </span>
            {isBestDeal && (
              <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
          </div>

          {/* Product Title or Status */}
          <div className="flex items-center gap-2 mt-0.5">
            {isPending ? (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Fetching info...
              </span>
            ) : hasError ? (
              <span className="text-xs text-orange-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Click to view manually
              </span>
            ) : (
              <span className="text-xs text-white/50 truncate">
                {link.product_title || "Click to view details"}
              </span>
            )}
          </div>
        </div>

        {/* Price & Stock */}
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-white">
            {formatPrice(link.price, link.currency)}
          </div>
          <div
            className={cn(
              "text-xs px-2 py-0.5 rounded-full mt-1 inline-block",
              stockInfo.bgColor,
              stockInfo.color
            )}
          >
            {stockInfo.label}
            {link.stock_quantity && ` (${link.stock_quantity})`}
          </div>
        </div>

        {/* Expand Arrow */}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/50 transition-transform",
            showDetails && "rotate-180"
          )}
        />
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-3">
          {/* Extra Info */}
          {link.extra_info &&
            Object.keys(link.extra_info).length > 0 &&
            !link.extra_info.error && (
              <ExtraInfoGrid extraInfo={link.extra_info} />
            )}

          {/* Last Updated */}
          {link.last_fetched_at && (
            <p className="text-xs text-white/40">
              Updated{" "}
              {new Date(link.last_fetched_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Store
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-all"
              title="Refresh info"
            >
              <RefreshCw
                className="w-4 h-4"
                style={
                  isRefreshing
                    ? { animation: "spin 1s linear infinite" }
                    : undefined
                }
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Remove this store link?")) {
                  onDelete();
                }
              }}
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
              title="Remove link"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductComparisonSheet;
