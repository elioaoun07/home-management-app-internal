"use client";

import BlurredAmount from "@/components/ui/BlurredAmount";
import { useDeleteTransfer, useTransfers } from "@/features/transfers/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import SwipeableItem from "./SwipeableItem";
import TransferDetailModal from "./TransferDetailModal";

type Props = {
  startDate: string;
  endDate: string;
  currentUserId?: string;
};

export default function TransferListView({
  startDate,
  endDate,
  currentUserId,
}: Props) {
  const themeClasses = useThemeClasses();
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(
    null,
  );

  const { data: transfers = [], isLoading } = useTransfers({
    start: startDate,
    end: endDate,
  });

  const deleteMutation = useDeleteTransfer();

  const selectedTransfer = useMemo(() => {
    if (!selectedTransferId) return null;
    return transfers.find((t) => t.id === selectedTransferId) || null;
  }, [selectedTransferId, transfers]);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Transfer deleted", {
          icon: ToastIcons.delete,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
              // Undo not yet supported for transfers — toast confirms action
            },
          },
        });
      },
    });
  };

  const handleEdit = (id: string) => {
    setSelectedTransferId(id);
  };

  const handleClick = (id: string) => {
    setSelectedTransferId(id);
  };

  if (isLoading && transfers.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[68px] neo-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <RefreshCw className="w-12 h-12 text-slate-400/40 mb-3 mx-auto" />
        <p className={`text-sm font-medium ${themeClasses.text}`}>
          No transfers
        </p>
        <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
          No transfers found for this period
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {transfers.map((transfer) => {
          const isOwner = transfer.is_owner;
          const isHousehold = transfer.transfer_type === "household";

          return (
            <SwipeableItem
              key={transfer.id}
              itemId={transfer.id}
              isOwner={isOwner}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onClick={handleClick}
            >
              <div
                className={cn("neo-card rounded-xl p-3")}
                style={{
                  borderLeft: `4px solid ${
                    isHousehold ? "#a855f7" : "#06b6d4"
                  }`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: From → To */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-semibold truncate ${themeClasses.text}`}
                      >
                        {transfer.from_account_name}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400/60 flex-shrink-0" />
                      <span
                        className={`text-sm font-semibold truncate ${themeClasses.text}`}
                      >
                        {transfer.to_account_name}
                      </span>
                    </div>
                    {transfer.description && (
                      <p
                        className={`text-xs truncate ${themeClasses.textMuted} mt-0.5`}
                      >
                        {transfer.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400/60">
                      <span>
                        {format(new Date(transfer.date + "T00:00:00"), "MMM d")}
                      </span>
                      <span>·</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                          isHousehold
                            ? "bg-purple-500/20 text-purple-300"
                            : "bg-cyan-500/20 text-cyan-300",
                        )}
                      >
                        {isHousehold ? "Household" : "Self"}
                      </span>
                      {transfer.fee_amount > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-400">
                            Fee ${transfer.fee_amount.toFixed(0)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount */}
                  <div className="text-right">
                    <BlurredAmount blurIntensity="sm">
                      <p className="text-lg font-bold bg-gradient-to-br from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                        ${transfer.amount.toFixed(2)}
                      </p>
                    </BlurredAmount>
                  </div>
                </div>
              </div>
            </SwipeableItem>
          );
        })}
      </div>

      {/* Transfer Detail Modal */}
      {selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransferId(null)}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
