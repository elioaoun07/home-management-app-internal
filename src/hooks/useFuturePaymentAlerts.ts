"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, isPast, isToday } from "date-fns";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface FuturePayment {
  id: string;
  scheduled_date: string;
  amount: number;
  description: string;
  category?: { name: string } | null;
}

/**
 * Hook that checks for due/overdue future payments on app load
 * and shows a toast notification with a summary.
 */
export function useFuturePaymentAlerts() {
  const hasShownRef = useRef(false);

  const { data: payments } = useQuery<FuturePayment[]>({
    queryKey: ["future-payments-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/future-payments");
      if (!res.ok) return [];
      const data = await res.json();
      return data.payments || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!payments || payments.length === 0 || hasShownRef.current) return;

    const duePayments = payments.filter(
      (p) =>
        isPast(new Date(p.scheduled_date)) ||
        isToday(new Date(p.scheduled_date)),
    );

    if (duePayments.length === 0) return;

    hasShownRef.current = true;

    // Small delay so the page finishes rendering first
    const timer = setTimeout(() => {
      const totalDue = duePayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

      if (duePayments.length === 1) {
        const p = duePayments[0];
        const label = p.description || p.category?.name || "Scheduled payment";
        toast.warning(`📅 "${label}" ($${p.amount.toFixed(2)}) is due!`, {
          description: isToday(new Date(p.scheduled_date))
            ? "Due today"
            : `Was due ${formatDistanceToNow(new Date(p.scheduled_date))} ago`,
          duration: 8000,
          action: {
            label: "View",
            onClick: () => {
              // Dispatch a custom event that AccountBalance can listen to
              window.dispatchEvent(new CustomEvent("open-future-payments"));
            },
          },
        });
      } else {
        toast.warning(
          `📅 ${duePayments.length} future payments are due ($${totalDue.toFixed(2)})`,
          {
            description: "Tap View to review and confirm them",
            duration: 8000,
            action: {
              label: "View",
              onClick: () => {
                window.dispatchEvent(new CustomEvent("open-future-payments"));
              },
            },
          },
        );
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [payments]);
}
