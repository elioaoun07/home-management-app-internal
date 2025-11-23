"use client";

import DraftTransactionsDialog from "@/components/expense/DraftTransactionsDialog";
import { MicIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function DraftTransactionsBadge() {
  const [count, setCount] = useState(0);
  const [showDialog, setShowDialog] = useState(false);

  const fetchCount = async () => {
    try {
      const res = await fetch("/api/drafts");
      const data = await res.json();
      if (res.ok) {
        setCount(data.drafts?.length || 0);
      }
    } catch (error) {
      console.error("Failed to fetch draft count:", error);
    }
  };

  useEffect(() => {
    fetchCount();
    // Only fetch on mount, not polling
  }, []);

  // Don't show if no drafts
  if (count === 0) return null;

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        size="sm"
        variant="default"
        className="fixed bottom-20 right-4 z-40 bg-gradient-to-br from-rose-500/80 via-pink-500/75 to-rose-600/80 hover:from-rose-400/85 hover:via-pink-400/80 hover:to-rose-500/85 border border-rose-400/40 shadow-[0_0_20px_rgba(244,63,94,0.3),0_0_40px_rgba(236,72,153,0.15)] hover:shadow-[0_0_25px_rgba(244,63,94,0.4),0_0_50px_rgba(236,72,153,0.2)] transition-all duration-300 active:scale-95"
        title="Review voice entry drafts"
      >
        <MicIcon className="w-4 h-4 mr-2 drop-shadow-[0_0_8px_rgba(251,207,232,0.7)] animate-pulse" />
        <span className="font-semibold drop-shadow-[0_0_6px_rgba(251,207,232,0.5)]">
          {count} Draft{count !== 1 ? "s" : ""}
        </span>
      </Button>

      <DraftTransactionsDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) fetchCount(); // Refresh count when closing
        }}
      />
    </>
  );
}
