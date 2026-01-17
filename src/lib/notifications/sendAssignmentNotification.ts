// src/lib/notifications/sendAssignmentNotification.ts
// Helper to send a notification when an item is assigned to a different user

interface AssignmentNotificationParams {
  itemId: string;
  itemTitle: string;
  itemType: "reminder" | "event" | "task";
  assignedToUserId: string;
  assignedByUserId: string;
  assignedByName?: string;
}

/**
 * Send an in-app notification to the assigned user when a task/item is assigned to them.
 * This function should be called client-side after creating/updating an item with a different responsible_user_id.
 */
export async function sendAssignmentNotification({
  itemId,
  itemTitle,
  itemType,
  assignedToUserId,
  assignedByUserId,
  assignedByName,
}: AssignmentNotificationParams): Promise<boolean> {
  // Don't send notification if assigning to self
  if (assignedToUserId === assignedByUserId) {
    return false;
  }

  try {
    const response = await fetch("/api/notifications/in-app", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // We need to use a server-side endpoint to create notifications for other users
        target_user_id: assignedToUserId,
        title: `New ${itemType} assigned to you`,
        message: `${assignedByName || "Someone"} assigned you: "${itemTitle}"`,
        icon:
          itemType === "event"
            ? "calendar"
            : itemType === "task"
              ? "check-square"
              : "bell",
        notification_type: "item_reminder",
        severity: "info",
        source: "item",
        priority: "normal",
        action_type: "view_details",
        action_url: null, // Items are viewed via tab navigation, not direct URL
        item_id: itemId,
        group_key: `assignment_${itemId}`,
        send_push: true,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error(
      "[sendAssignmentNotification] Failed to send notification:",
      error,
    );
    return false;
  }
}

/**
 * Check if the responsible user has changed and send notification if needed.
 * To be called after updating an item.
 */
export async function checkAndNotifyAssignment({
  itemId,
  itemTitle,
  itemType,
  newResponsibleUserId,
  previousResponsibleUserId,
  currentUserId,
  currentUserName,
}: {
  itemId: string;
  itemTitle: string;
  itemType: "reminder" | "event" | "task";
  newResponsibleUserId: string;
  previousResponsibleUserId?: string;
  currentUserId: string;
  currentUserName?: string;
}): Promise<void> {
  // Only notify if:
  // 1. Responsible user is different from current user (assigning to someone else)
  // 2. AND either it's a new assignment OR the responsible user changed
  const isNewAssignment = !previousResponsibleUserId;
  const hasChanged = previousResponsibleUserId !== newResponsibleUserId;
  const isAssigningToOther = newResponsibleUserId !== currentUserId;

  if (isAssigningToOther && (isNewAssignment || hasChanged)) {
    await sendAssignmentNotification({
      itemId,
      itemTitle,
      itemType,
      assignedToUserId: newResponsibleUserId,
      assignedByUserId: currentUserId,
      assignedByName: currentUserName,
    });
  }
}
