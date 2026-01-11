// src/lib/notifications/sendSplitBillNotification.ts
// Helper to send a push notification when a split bill is requested

interface SplitBillNotificationParams {
  transactionId: string;
  collaboratorId: string;
  amount: number;
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
  categoryName,
  description,
}: SplitBillNotificationParams): Promise<boolean> {
  try {
    const response = await fetch("/api/notifications/in-app", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Target the collaborator (partner)
        target_user_id: collaboratorId,
        title: "Split Bill Request",
        message: `You've been asked to add your portion to a $${amount} ${categoryName || "expense"}`,
        icon: "split",
        notification_type: "transaction_pending",
        severity: "action",
        source: "transaction",
        priority: "high",
        action_type: "log_transaction",
        action_url: "/dashboard",
        transaction_id: transactionId,
        action_data: {
          transaction_id: transactionId,
          owner_amount: amount,
          owner_description: description || "",
          category_name: categoryName || "",
        },
        group_key: `split_bill_${transactionId}`,
        send_push: true,
      }),
    });

    if (!response.ok) {
      console.error(
        "[sendSplitBillNotification] API returned error:",
        response.status
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "[sendSplitBillNotification] Failed to send notification:",
      error
    );
    return false;
  }
}
