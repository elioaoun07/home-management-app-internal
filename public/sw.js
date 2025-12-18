// Service Worker for Push Notifications
// Handles push events and displays notifications with alarm-like behavior

const SW_VERSION = "1.0.1";

// ============================================
// INSTALL & ACTIVATE
// ============================================

self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker v" + SW_VERSION);
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker v" + SW_VERSION);
  event.waitUntil(clients.claim());
});

// ============================================
// ALARM SOUND - Notify clients to play sound
// ============================================

async function notifyClientsToPlaySound(data) {
  const allClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  console.log(
    "[SW] Notifying",
    allClients.length,
    "clients to play alarm sound"
  );

  for (const client of allClients) {
    client.postMessage({
      type: "PLAY_ALARM_SOUND",
      data: data,
    });
  }

  // If no clients are open, we can't play sound directly
  // The notification vibration will have to suffice
  if (allClients.length === 0) {
    console.log("[SW] No clients open - relying on system notification sound");
  }
}

// ============================================
// PUSH NOTIFICATION HANDLING
// ============================================

self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event);

  let data = {
    title: "Reminder",
    body: "You have a reminder",
    icon: "/appicon-192.png",
    badge: "/appicon-192.png",
    tag: "reminder-" + Date.now(),
    data: {},
  };

  // Parse push data
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      console.error("[SW] Error parsing push data:", e);
      data.body = event.data.text();
    }
  }

  // Determine notification type and set appropriate actions
  const isTransactionReminder = data.data?.type === "transaction_reminder";

  // Create notification options based on type
  const options = {
    body: data.body,
    icon: data.icon || "/appicon-192.png",
    badge: data.badge || "/appicon-192.png",
    tag: data.tag,
    data: data.data,
    requireInteraction: true,
    renotify: true,
    silent: false,
    timestamp: Date.now(),
  };

  if (isTransactionReminder) {
    // Transaction reminder - Yes/Not Yet actions
    options.vibrate = [200, 100, 200]; // Gentle vibration
    options.actions = [
      {
        action: "confirm_transactions",
        title: "✓ Yes, all done!",
        icon: "/appicon-192.png",
      },
      {
        action: "add_expense",
        title: "➕ Not yet",
        icon: "/appicon-192.png",
      },
    ];
  } else {
    // Regular reminder - Snooze/Dismiss actions
    options.vibrate = [500, 200, 500, 200, 500, 200, 500, 200, 500];
    options.actions = [
      {
        action: "snooze",
        title: "⏰ Snooze 5min",
        icon: "/appicon-192.png",
      },
      {
        action: "dismiss",
        title: "✓ Dismiss",
        icon: "/appicon-192.png",
      },
    ];
    options.timestamp = data.data?.due_at
      ? new Date(data.data.due_at).getTime()
      : Date.now();
  }

  // Show the notification (and play sound for regular reminders)
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      isTransactionReminder
        ? Promise.resolve()
        : notifyClientsToPlaySound(data),
    ])
  );
});

// ============================================
// NOTIFICATION CLICK HANDLING
// ============================================

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action, event.notification);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  if (action === "snooze") {
    // Snooze for 5 minutes - send to server to reschedule
    event.waitUntil(handleSnooze(data));
  } else if (action === "dismiss") {
    // Mark as dismissed - send to server
    event.waitUntil(handleDismiss(data));
  } else if (action === "confirm_transactions") {
    // User confirmed they added all transactions
    event.waitUntil(handleConfirmTransactions(data));
  } else if (action === "add_expense") {
    // User needs to add expenses - open add expense form
    event.waitUntil(openAddExpense(data));
  } else {
    // Default click - open the app based on notification type
    if (data.type === "transaction_reminder") {
      // Open Hub Alerts view
      event.waitUntil(openApp({ ...data, url: "/hub?view=alerts" }));
    } else {
      event.waitUntil(openApp(data));
    }
  }
});

// Handle notification close without interaction
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event.notification);
  // Could track dismissed notifications here
});

// ============================================
// ACTION HANDLERS
// ============================================

async function handleSnooze(data) {
  console.log("[SW] Snoozing notification:", data);

  // Try to send snooze request to server
  try {
    if (data.item_id && data.alert_id) {
      const response = await fetch("/api/notifications/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: data.item_id,
          alert_id: data.alert_id,
          snooze_minutes: 5,
        }),
      });

      if (!response.ok) {
        console.error("[SW] Failed to snooze:", await response.text());
      }
    }
  } catch (error) {
    console.error("[SW] Error snoozing:", error);
  }

  // Show a confirmation notification
  await self.registration.showNotification("Snoozed", {
    body: "Reminder snoozed for 5 minutes",
    icon: "/appicon-192.png",
    tag: "snooze-confirm",
    requireInteraction: false,
    silent: true,
  });
}

async function handleDismiss(data) {
  console.log("[SW] Dismissing notification:", data);

  // Try to mark as dismissed on server
  try {
    if (data.notification_log_id) {
      await fetch("/api/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_log_id: data.notification_log_id,
        }),
      });
    }
  } catch (error) {
    console.error("[SW] Error dismissing:", error);
  }
}

// Handle "Yes, all done!" action for transaction reminders
async function handleConfirmTransactions(data) {
  console.log("[SW] Confirming transactions:", data);

  try {
    const response = await fetch("/api/notifications/transaction-reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm",
        alert_id: data.alert_id,
      }),
    });

    if (response.ok) {
      // Show a celebratory confirmation
      await self.registration.showNotification("Great job! 🎉", {
        body: "Your finances are up to date!",
        icon: "/appicon-192.png",
        tag: "transaction-confirm",
        requireInteraction: false,
        silent: true,
      });
    }
  } catch (error) {
    console.error("[SW] Error confirming transactions:", error);
  }
}

// Handle "Not yet" action - open add expense form
async function openAddExpense(data) {
  console.log("[SW] Opening add expense:", data);

  const url = "/dashboard?action=add-expense";

  // Try to focus existing window or open new one
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  // Check if app is already open
  for (const client of clients) {
    if (client.url.includes(self.location.origin)) {
      await client.focus();
      client.postMessage({
        type: "NAVIGATE",
        url: url,
      });
      return;
    }
  }

  // Open new window to add expense
  await self.clients.openWindow(url);
}

async function openApp(data) {
  console.log("[SW] Opening app:", data);

  // Determine URL to open
  let url = "/";

  // Check for custom URL (e.g., from transaction reminder)
  if (data.url) {
    url = data.url;
  } else if (data.item_id) {
    url = `/dashboard?item=${data.item_id}`;
  }

  // Try to focus existing window or open new one
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  // Check if app is already open
  for (const client of clients) {
    if (client.url.includes(self.location.origin)) {
      await client.focus();
      // Navigate if we have a specific URL
      if (url !== "/") {
        client.postMessage({
          type: "NAVIGATE",
          url: url,
        });
      }
      return;
    }
  }

  // Open new window
  await self.clients.openWindow(url);
}

// ============================================
// PERIODIC SYNC (for background checking)
// ============================================

// This would be used for periodic background sync if supported
self.addEventListener("periodicsync", (event) => {
  console.log("[SW] Periodic sync:", event.tag);

  if (event.tag === "check-reminders") {
    event.waitUntil(checkPendingReminders());
  }
});

async function checkPendingReminders() {
  console.log("[SW] Checking pending reminders...");
  // This would ping the server to check for any due reminders
  // For now, we rely on push notifications from the server
}

// ============================================
// MESSAGE HANDLING
// ============================================

self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data);

  const { type, payload } = event.data || {};

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "GET_VERSION":
      event.ports[0]?.postMessage({ version: SW_VERSION });
      break;
    case "TEST_NOTIFICATION":
      // For testing notifications locally
      self.registration.showNotification(
        payload?.title || "Test Notification",
        {
          body: payload?.body || "This is a test notification",
          icon: "/appicon-192.png",
          badge: "/appicon-192.png",
          requireInteraction: true,
          vibrate: [500, 200, 500, 200, 500],
          actions: [
            { action: "snooze", title: "⏰ Snooze 5min" },
            { action: "dismiss", title: "✓ Dismiss" },
          ],
        }
      );
      break;
  }
});

console.log("[SW] Service worker loaded v" + SW_VERSION);
