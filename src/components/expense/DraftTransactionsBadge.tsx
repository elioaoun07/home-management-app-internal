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
        className="fixed bottom-20 right-4 z-40 shadow-lg neo-glow"
        title="Review voice entry drafts"
      >
        <MicIcon className="w-4 h-4 mr-2 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
        {count} Draft{count !== 1 ? "s" : ""}
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
