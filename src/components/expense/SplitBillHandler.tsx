"use client";

import SplitBillModal from "@/components/expense/SplitBillModal";
import { useSplitBillModal } from "@/contexts/SplitBillContext";
import {
  useCompleteSplitBill,
  usePendingSplits,
} from "@/features/transactions/useSplitBill";
import { ToastIcons } from "@/lib/toastIcons";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * SplitBillHandler - Global component that listens for pending split bills
 * and shows the modal when there are pending requests.
 * Should be placed in the root layout.
 */
export default function SplitBillHandler() {
  const { data, isLoading } = usePendingSplits();
  const completeSplit = useCompleteSplitBill();
  const { currentSplit, openSplitBillModal, closeSplitBillModal } =
    useSplitBillModal();
  const [hasShownToast, setHasShownToast] = useState(false);

  // Show toast when there are pending splits
  useEffect(() => {
    if (
      !isLoading &&
      data?.pending_splits &&
      data.pending_splits.length > 0 &&
      !hasShownToast
    ) {
      const firstSplit = data.pending_splits[0];
      toast(`Split bill request for $${firstSplit.owner_amount.toFixed(2)}`, {
        icon: "🔀",
        description: `${firstSplit.category_name} - Tap to add your portion`,
        duration: 10000,
        action: {
          label: "Add Amount",
          onClick: () => openSplitBillModal(firstSplit),
        },
      });
      setHasShownToast(true);
    }
  }, [data, isLoading, hasShownToast, openSplitBillModal]);

  const handleComplete = async (
    amount: number,
    description: string,
    accountId: string
  ) => {
    if (!currentSplit) return;

    try {
      const result = await completeSplit.mutateAsync({
        transaction_id: currentSplit.transaction_id,
        amount,
        description,
        account_id: accountId,
      });

      toast.success("Split bill completed!", {
        icon: ToastIcons.create,
        description: `Total: $${result.total_amount.toFixed(2)}`,
      });
    } catch (error) {
      toast.error("Failed to complete split bill", {
        icon: ToastIcons.error,
      });
      throw error;
    }
  };

  if (!currentSplit) return null;

  return (
    <SplitBillModal
      open={!!currentSplit}
      onClose={closeSplitBillModal}
      splitData={currentSplit}
      onComplete={handleComplete}
    />
  );
}
