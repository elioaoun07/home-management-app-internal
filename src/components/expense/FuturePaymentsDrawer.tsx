"use client";

import { Trash2Icon, XIcon } from "@/components/icons/FuturisticIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  differenceInDays,
  format,
  formatDistanceToNow,
  isPast,
  isToday,
  isTomorrow,
} from "date-fns";
import { toast } from "sonner";

interface FuturePaymentsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
}

interface FuturePayment {
  id: string;
  date: string;
  scheduled_date: string;
  amount: number;
  description: string;
  category_id: string | null;
  account_id: string;
  accounts?: { name: string };
  category?: { name: string } | null;
}

export default function FuturePaymentsDrawer({
  open,
  onOpenChange,
  accountId,
}: FuturePaymentsDrawerProps) {
  const themeClasses = useThemeClasses();
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery<FuturePayment[]>({
    queryKey: ["future-payments", accountId],
    queryFn: async () => {
      const url = accountId
        ? `/api/future-payments?account_id=${accountId}`
        : "/api/future-payments";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch future payments");
      const data = await res.json();
      return data.payments || [];
    },
    enabled: open,
  });

  // Confirm a future payment (convert draft to real transaction)
  const confirmMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/future-payments/${paymentId}/confirm`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to confirm payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["future-payments"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Payment confirmed!");
    },
    onError: () => {
      toast.error("Failed to confirm payment");
    },
  });

  // Delete future payment
  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/drafts/${paymentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete payment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["future-payments"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      toast.success("Future payment deleted");
    },
    onError: () => {
      toast.error("Failed to delete payment");
    },
  });

  // Separate due and upcoming
  const duePayments = payments.filter(
    (p) =>
      isPast(new Date(p.scheduled_date)) || isToday(new Date(p.scheduled_date)),
  );
  const upcomingPayments = payments.filter(
    (p) =>
      !isPast(new Date(p.scheduled_date)) &&
      !isToday(new Date(p.scheduled_date)),
  );

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
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Future Payments
            </DrawerTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <XIcon className="w-5 h-5 text-white/50" />
            </button>
          </div>
          {/* Summary bar */}
          {payments.length > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-white/50">{duePayments.length} due</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-white/50">
                  {upcomingPayments.length} upcoming
                </span>
              </div>
              <div className="ml-auto text-xs text-white/30">
                Total: ${payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}
              </div>
            </div>
          )}
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-4 max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-10">
              <svg
                className="w-12 h-12 mx-auto text-white/10 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
                <path d="M9 16l2 2 4-4" />
              </svg>
              <p className="text-white/40 text-sm font-medium">
                No future payments
              </p>
              <p className="text-white/25 text-xs mt-1">
                Schedule one from the expense form using the Later button
              </p>
            </div>
          ) : (
            <>
              {/* Due Now Section */}
              {duePayments.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    Due Now
                  </h3>
                  <div className="space-y-2">
                    {duePayments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        isDue
                        onConfirm={() => confirmMutation.mutate(payment.id)}
                        onDelete={() => deleteMutation.mutate(payment.id)}
                        isConfirming={confirmMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Section */}
              {upcomingPayments.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Upcoming
                  </h3>
                  <div className="space-y-2">
                    {upcomingPayments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        isDue={false}
                        onConfirm={() => confirmMutation.mutate(payment.id)}
                        onDelete={() => deleteMutation.mutate(payment.id)}
                        isConfirming={confirmMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function PaymentCard({
  payment,
  isDue,
  onConfirm,
  onDelete,
  isConfirming,
}: {
  payment: FuturePayment;
  isDue: boolean;
  onConfirm: () => void;
  onDelete: () => void;
  isConfirming: boolean;
}) {
  const scheduledDate = new Date(payment.scheduled_date);
  const daysAway = differenceInDays(scheduledDate, new Date());

  // Smart relative label
  const getTimeLabel = () => {
    if (isToday(scheduledDate)) return "Today";
    if (isTomorrow(scheduledDate)) return "Tomorrow";
    if (isPast(scheduledDate))
      return `${formatDistanceToNow(scheduledDate)} overdue`;
    if (daysAway <= 7) return `in ${daysAway} day${daysAway !== 1 ? "s" : ""}`;
    return `in ${formatDistanceToNow(scheduledDate)}`;
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border overflow-hidden transition-all",
        isDue
          ? "bg-gradient-to-r from-red-500/8 to-red-500/3 border-red-400/25"
          : "bg-gradient-to-r from-blue-500/8 to-blue-500/3 border-blue-400/15",
      )}
    >
      {/* Colored left accent */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          isDue
            ? "bg-gradient-to-b from-red-400 to-red-500 animate-pulse"
            : "bg-gradient-to-b from-blue-400 to-blue-500",
        )}
      />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left: details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-base">
                ${payment.amount.toFixed(2)}
              </span>
              {isDue && (
                <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-[10px] px-1.5 py-0 h-4 font-semibold">
                  {isPast(scheduledDate) && !isToday(scheduledDate)
                    ? "OVERDUE"
                    : "DUE"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-white/60 truncate mt-0.5">
              {payment.description || "No description"}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/35">
              {payment.category && (
                <>
                  <span className="text-white/50">{payment.category.name}</span>
                  <span>•</span>
                </>
              )}
              <span>{payment.accounts?.name}</span>
              <span>•</span>
              <span>{format(scheduledDate, "MMM d, yyyy")}</span>
            </div>
          </div>

          {/* Right: time label */}
          <div className="text-right shrink-0">
            <p
              className={cn(
                "text-xs font-semibold",
                isDue ? "text-red-400" : "text-blue-400",
              )}
            >
              {getTimeLabel()}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-2.5">
          <Button
            onClick={onConfirm}
            size="sm"
            disabled={isConfirming}
            className={cn(
              "flex-1 h-8 text-xs font-semibold rounded-lg transition-all",
              isDue
                ? "bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-400/20"
                : "bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-400/20",
            )}
          >
            {isConfirming ? (
              <svg
                className="w-3.5 h-3.5 animate-spin mr-1"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isConfirming ? "Confirming..." : "Confirm"}
          </Button>
          <Button
            onClick={onDelete}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-red-400/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
          >
            <Trash2Icon className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
