// src/lib/notifications/sendSplitBillNotification.ts
// Helper to send a push notification when a split bill is requested
import { getSuggestedSplitAmount } from "@/lib/utils/splitBill";
import { safeFetch } from "@/lib/safeFetch";

interface SplitBillNotificationParams {
  transactionId: string;
  collaboratorId: string;
  amount: number;
  totalBillAmount?: number;
  categoryName?: string;
  description?: string;
}

/**
 * Send a push notification to the collaborator when a split bill is requested.
 * This function should be called client-side after creating a transaction with split_requested=true.
 *
 * Note: The in-app notification is created server-side in transaction.service.ts.
 * This function only sends the push notification via the API.
 */
export async function sendSplitBillNotification({
  transactionId,
  collaboratorId,
  amount,
  totalBillAmount,
  categoryName,
  description,
}: SplitBillNotificationParams): Promise<boolean> {
  try {
    const suggestedAmount = getSuggestedSplitAmount(totalBillAmount, amount);
    const response = await safeFetch("/api/notifications/in-app", {
      timeoutMs: 60_000,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Target the collaborator (partner)
        target_user_id: collaboratorId,
        title: "Split Bill Request",
        message:
          suggestedAmount != null
            ? `Your share: $${suggestedAmount.toFixed(2)} · Total: $${totalBillAmount!.toFixed(2)}`
            : `You've been asked to add your portion to a $${amount} ${categoryName || "expense"}`,
        icon: "split",
        notification_type: "transaction_pending",
        severity: "action",
        source: "transaction",
        priority: "high",
        action_type: "log_transaction",
        action_url: "/expense?action=split-bill",
        transaction_id: transactionId,
        action_data: {
          transaction_id: transactionId,
          owner_amount: amount,
          owner_description: description || "",
          category_name: categoryName || "",
          ...(suggestedAmount != null && { suggested_amount: suggestedAmount }),
          ...(totalBillAmount != null && {
            total_bill_amount: totalBillAmount,
          }),
        },
        group_key: `split_bill_${transactionId}`,
        send_push: true,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
