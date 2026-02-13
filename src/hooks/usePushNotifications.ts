// src/hooks/usePushNotifications.ts
// Hook for managing Web Push notifications subscription
// Handles PWA lifecycle: subscription persistence, auto-restore, and DB sync with retry

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The VAPID public key - must match the server's public key
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// LocalStorage key to track subscription state
const PUSH_ENABLED_KEY = "push_notifications_enabled";

// Retry config for DB operations (auth may not be ready on PWA restart)
const MAX_DB_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1500;

export type PushPermissionState =
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

export interface PushNotificationState {
  isSupported: boolean;
  permission: PushPermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscription: PushSubscription | null;
}

// Helper to check if user previously enabled notifications
function getPushEnabledFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PUSH_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

// Helper to save push enabled state
function setPushEnabledInStorage(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem(PUSH_ENABLED_KEY, "true");
    } else {
      localStorage.removeItem(PUSH_ENABLED_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function usePushNotifications() {
  // Initialize isSubscribed from localStorage so the UI doesn't flash "Enable"
  // on every PWA restart while async checks are running
  const wasEnabled = getPushEnabledFromStorage();

  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: wasEnabled,
    isLoading: true,
    error: null,
    subscription: null,
  });

  // Track if we've already tried to auto-restore subscription
  const hasAttemptedRestore = useRef(false);
  // Track retry timers so we can clean up
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track how many background restore attempts we've made
  const backgroundRetryCount = useRef(0);

  // Initialize on mount + retry on visibility change (PWA coming back to foreground)
  useEffect(() => {
    initializePushState();

    // When PWA comes back to foreground, re-check subscription
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Only retry if we think we should be subscribed but don't have a subscription object
        const shouldBeSubscribed = getPushEnabledFromStorage();
        if (shouldBeSubscribed) {
          // Reset restore flag so we can try again
          hasAttemptedRestore.current = false;
          backgroundRetryCount.current = 0;
          initializePushState();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main initialization - separates local checks from DB operations
  const initializePushState = useCallback(async () => {
    // Check browser support
    if (typeof window === "undefined") {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isSubscribed: false,
      }));
      return;
    }

    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!isSupported) {
      setState({
        isSupported: false,
        permission: "unsupported",
        isSubscribed: false,
        isLoading: false,
        error: null,
        subscription: null,
      });
      return;
    }

    const permission = Notification.permission as PushPermissionState;

    // If permission was revoked, clear everything
    if (permission === "denied") {
      setPushEnabledInStorage(false);
      setState({
        isSupported: true,
        permission: "denied",
        isSubscribed: false,
        isLoading: false,
        error: null,
        subscription: null,
      });
      return;
    }

    const wasEnabledBefore = getPushEnabledFromStorage();

    // Step 1: Ensure service worker is registered
    let registration: ServiceWorkerRegistration | null = null;
    try {
      registration = await getOrRegisterServiceWorker();
    } catch (swError) {
      console.error("[Push] Service worker setup error:", swError);
    }

    // Step 2: Check for existing local push subscription
    let subscription: PushSubscription | null = null;

    if (registration) {
      try {
        subscription = await registration.pushManager.getSubscription();
      } catch (error) {
        console.error("[Push] Error getting subscription:", error);
      }
    }

    if (subscription) {
      // Local subscription exists -> we're subscribed
      console.log(
        "[Push] Local subscription found:",
        subscription.endpoint.substring(0, 50) + "...",
      );
      setPushEnabledInStorage(true);
      setState({
        isSupported: true,
        permission,
        isSubscribed: true,
        isLoading: false,
        error: null,
        subscription,
      });
      // Ensure this subscription is saved in DB (fire-and-forget with retry)
      saveSubscriptionWithRetry(subscription);
      return;
    }

    // Step 3: No local subscription - try to restore if previously enabled
    if (
      permission === "granted" &&
      wasEnabledBefore &&
      !hasAttemptedRestore.current
    ) {
      hasAttemptedRestore.current = true;
      console.log(
        "[Push] No local subscription but was enabled before, auto-restoring...",
      );

      try {
        // Wait for SW to be fully active before subscribing
        const activeRegistration = await waitForActiveServiceWorker();
        const restored = await createLocalPushSubscription(
          activeRegistration || registration,
        );
        if (restored) {
          console.log("[Push] Successfully re-established local subscription");
          setPushEnabledInStorage(true);
          setState({
            isSupported: true,
            permission,
            isSubscribed: true,
            isLoading: false,
            error: null,
            subscription: restored,
          });
          // Save to DB with retry (auth might not be ready yet)
          saveSubscriptionWithRetry(restored);
          return;
        }
      } catch (error) {
        console.error("[Push] Auto-restore failed:", error);
      }

      // Auto-restore failed - keep showing as subscribed since the user
      // explicitly enabled notifications. Schedule background retry.
      console.log(
        "[Push] Could not restore subscription yet, will retry in background",
      );
      setState({
        isSupported: true,
        permission,
        isSubscribed: true, // Keep showing as subscribed
        isLoading: false,
        error: null,
        subscription: null,
      });
      // Schedule background retry
      scheduleBackgroundRestore(registration);
      return;
    }

    // Step 4: Not subscribed (user never enabled or permission not granted)
    setState({
      isSupported: true,
      permission,
      isSubscribed: false,
      isLoading: false,
      error: null,
      subscription: null,
    });
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: "Push notifications are not supported in this browser",
      }));
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({
        ...prev,
        permission: permission as PushPermissionState,
        error:
          permission === "denied" ? "Notification permission was denied" : null,
      }));
      return permission === "granted";
    } catch (error) {
      console.error("[Push] Error requesting permission:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to request notification permission",
      }));
      return false;
    }
  }, [state.isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // First, ensure we have permission
      if (Notification.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return false;
        }
      }

      // Get or register service worker
      const registration = await getOrRegisterServiceWorker();
      if (!registration) {
        throw new Error("Failed to register service worker");
      }

      // Check if VAPID key is configured
      if (!VAPID_PUBLIC_KEY) {
        throw new Error("VAPID public key not configured");
      }

      // Check for existing subscription first - reuse if possible
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      console.log("[Push] Subscription ready:", subscription.endpoint);

      // Save subscription to database (direct call, not retry - user is actively waiting)
      await saveSubscriptionToApi(subscription);

      // Save to localStorage
      setPushEnabledInStorage(true);

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        subscription,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error("[Push] Subscription failed:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to subscribe",
      }));
      return false;
    }
  }, [requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from database
        await removeSubscription(subscription.endpoint);
      }

      // Clear localStorage flag - this is the ONLY place we clear it
      // (besides permission denied)
      setPushEnabledInStorage(false);

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        subscription: null,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error("[Push] Unsubscribe failed:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to unsubscribe",
      }));
      return false;
    }
  }, []);

  // Send a test notification
  const sendTestNotification = useCallback(async (): Promise<void> => {
    if (!state.isSubscribed) {
      throw new Error("Not subscribed to push notifications");
    }

    // Before sending test, ensure current subscription is in DB
    if (state.subscription) {
      try {
        await saveSubscriptionToApi(state.subscription);
      } catch {
        // Continue anyway - DB might already have it
      }
    }

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Failed to send test notification (${response.status})`,
        );
      }
    } catch (error) {
      console.error("[Push] Test notification failed:", error);
      throw error;
    }
  }, [state.isSubscribed, state.subscription]);

  // Manual refresh - re-checks subscription state and syncs with DB
  const refreshSubscription = useCallback(async (): Promise<void> => {
    hasAttemptedRestore.current = false;
    await initializePushState();
  }, [initializePushState]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    refreshSubscription,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get or register the service worker (quick check, doesn't wait for activation)
async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    let registration = await navigator.serviceWorker.getRegistration("/");

    if (!registration) {
      console.log("[Push] Registering service worker...");
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
    }

    return registration;
  } catch (error) {
    console.error("[Push] Service worker setup failed:", error);
    return null;
  }
}

// Wait for the service worker to be fully activated (needed before pushManager.subscribe)
async function waitForActiveServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    // navigator.serviceWorker.ready resolves when a SW is active
    // Use a generous timeout for cold PWA starts on slow devices
    const result = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ]);

    if (!result) {
      console.warn("[Push] Timed out waiting for service worker to activate");
      return null;
    }

    return result;
  } catch (error) {
    console.error("[Push] Error waiting for active service worker:", error);
    return null;
  }
}

// Create a new push subscription locally (PushManager only, no DB)
async function createLocalPushSubscription(
  existingRegistration: ServiceWorkerRegistration | null,
): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.error("[Push] VAPID key not configured");
    return null;
  }

  try {
    const registration =
      existingRegistration || (await getOrRegisterServiceWorker());
    if (!registration) return null;

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    console.log(
      "[Push] Local subscription created:",
      subscription.endpoint.substring(0, 50) + "...",
    );
    return subscription;
  } catch (error) {
    console.error("[Push] Failed to create local subscription:", error);
    return null;
  }
}

// Schedule background retry to restore subscription
// This runs when the initial auto-restore fails (e.g., SW not active yet on cold PWA start)
async function scheduleBackgroundRestore(
  registration: ServiceWorkerRegistration | null,
  attempt: number = 0,
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const delay = 3000 * Math.pow(2, attempt); // 3s, 6s, 12s, 24s, 48s

  if (attempt >= MAX_ATTEMPTS) {
    console.log(
      "[Push] Background restore: max attempts reached, giving up for this session",
    );
    return;
  }

  console.log(
    `[Push] Background restore: scheduling attempt ${attempt + 1} in ${delay}ms`,
  );

  setTimeout(async () => {
    try {
      // Try to get the active SW registration
      const activeReg = await waitForActiveServiceWorker();
      const reg = activeReg || registration;

      if (!reg) {
        console.log("[Push] Background restore: no registration, retrying...");
        scheduleBackgroundRestore(registration, attempt + 1);
        return;
      }

      // Check if we already have a subscription now (maybe restored by the browser)
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        // Try to create a new one
        subscription = await createLocalPushSubscription(reg);
      }

      if (subscription) {
        console.log("[Push] Background restore: subscription established!");
        // Save to DB with retry
        saveSubscriptionWithRetry(subscription);
        // Note: we can't call setState from outside the hook,
        // but the visibilitychange handler will pick up the subscription
        // on next foreground event. The subscription object in the PushManager
        // is what matters for receiving notifications.
      } else {
        console.log("[Push] Background restore: still failed, retrying...");
        scheduleBackgroundRestore(registration, attempt + 1);
      }
    } catch (error) {
      console.error("[Push] Background restore error:", error);
      scheduleBackgroundRestore(registration, attempt + 1);
    }
  }, delay);
}

// Convert base64 URL to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Save subscription to database via API - NO client-side auth check
// The API route handles auth via cookies. This avoids the race condition
// where supabaseBrowser().auth.getUser() returns null before session is restored.
async function saveSubscriptionToApi(
  subscription: PushSubscription,
): Promise<void> {
  const subscriptionData = subscription.toJSON();

  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscriptionData.endpoint,
      p256dh: subscriptionData.keys?.p256dh,
      auth: subscriptionData.keys?.auth,
      device_name: getDeviceName(),
      user_agent: navigator.userAgent,
    }),
  });

  if (response.status === 401) {
    throw new Error("AUTH_NOT_READY");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to save subscription");
  }
}

// Save subscription with retry - handles auth not being ready on PWA restart
async function saveSubscriptionWithRetry(
  subscription: PushSubscription,
  attempt: number = 0,
): Promise<void> {
  try {
    await saveSubscriptionToApi(subscription);
    console.log("[Push] Subscription saved to database successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "AUTH_NOT_READY" && attempt < MAX_DB_RETRIES) {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
      console.log(
        `[Push] Auth not ready, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_DB_RETRIES})...`,
      );
      setTimeout(() => {
        saveSubscriptionWithRetry(subscription, attempt + 1);
      }, delay);
    } else if (attempt < MAX_DB_RETRIES) {
      // Other errors - still retry but log
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
      console.error(
        `[Push] DB save failed (attempt ${attempt + 1}), retrying in ${delay}ms:`,
        error,
      );
      setTimeout(() => {
        saveSubscriptionWithRetry(subscription, attempt + 1);
      }, delay);
    } else {
      console.error(
        "[Push] Failed to save subscription to DB after all retries:",
        error,
      );
    }
  }
}

// Remove subscription from database
async function removeSubscription(endpoint: string): Promise<void> {
  try {
    const response = await fetch("/api/notifications/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });

    if (!response.ok) {
      console.error("[Push] Failed to remove subscription from database");
    }
  } catch (error) {
    console.error("[Push] Error removing subscription:", error);
  }
}

// Get a friendly device name
function getDeviceName(): string {
  const ua = navigator.userAgent;

  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) return "Android Phone";
    return "Android Tablet";
  }
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";

  return "Unknown Device";
}
