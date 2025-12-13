// Service Worker for Push Notifications
// Handles push events and displays notifications with alarm-like behavior

const SW_VERSION = "1.0.0";

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

  // Create alarm-like notification options
  const options = {
    body: data.body,
    icon: data.icon || "/appicon-192.png",
    badge: data.badge || "/appicon-192.png",
    tag: data.tag,
    data: data.data,
    // Make notification persistent and attention-grabbing
    requireInteraction: true, // Don't auto-dismiss - user must interact
    renotify: true, // Always notify even if same tag
    silent: false, // Make sound
    // Vibration pattern for alarm-like effect (works on Android)
    // Pattern: vibrate 500ms, pause 200ms, vibrate 500ms, pause 200ms, vibrate 500ms
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500],
    // Actions for quick response
    actions: [
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
    ],
    // Timestamp for when the reminder was due
    timestamp: data.data?.due_at
      ? new Date(data.data.due_at).getTime()
      : Date.now(),
  };

  // Show the notification
  event.waitUntil(self.registration.showNotification(data.title, options));
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
  } else {
    // Default click - open the app to the item
    event.waitUntil(openApp(data));
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

async function openApp(data) {
  console.log("[SW] Opening app:", data);

  // Determine URL to open
  let url = "/";
  if (data.item_id) {
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
      // Navigate to the item if needed
      if (data.item_id) {
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
