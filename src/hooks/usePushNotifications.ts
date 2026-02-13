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

  // Track retry timers so we can clean up
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if initialization is in progress (prevent double-init)
  const isInitializing = useRef(false);
  // Track if a background restore is already scheduled
  const backgroundRestoreScheduled = useRef(false);

  // Initialize on mount + retry on visibility change (PWA coming back to foreground)
  useEffect(() => {
    console.log("[Push] useEffect mount - calling initializePushState");
    initializePushState();

    // When PWA comes back to foreground, re-check subscription
    const handleVisibilityChange = () => {
      console.log("[Push] Visibility changed:", document.visibilityState);
      if (document.visibilityState === "visible") {
        // Re-check subscription state when app comes to foreground
        const shouldBeSubscribed = getPushEnabledFromStorage();
        console.log("[Push] Should be subscribed:", shouldBeSubscribed);
        if (!isInitializing.current) {
          console.log("[Push] Re-initializing after visibility change");
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
  // IMPORTANT: This function must be idempotent and safe to call multiple times
  const initializePushState = useCallback(async () => {
    // Prevent concurrent initialization
    if (isInitializing.current) {
      console.log("[Push] Already initializing, skipping...");
      return;
    }
    isInitializing.current = true;

    try {
      console.log("[Push] === initializePushState START ===");

      // Check browser support
      if (typeof window === "undefined") {
        console.log("[Push] No window - SSR");
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

      console.log("[Push] Browser support:", isSupported);

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
      const wasEnabledBefore = getPushEnabledFromStorage();

      console.log("[Push] Permission:", permission);
      console.log("[Push] localStorage wasEnabledBefore:", wasEnabledBefore);

      // If permission was revoked, clear everything
      if (permission === "denied") {
        console.log("[Push] Permission denied - clearing state");
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

      // Step 1: Ensure service worker is registered
      console.log("[Push] Step 1: Getting service worker registration...");
      let registration: ServiceWorkerRegistration | null = null;
      try {
        registration = await getOrRegisterServiceWorker();
        console.log(
          "[Push] Service worker registration:",
          registration ? "OK" : "FAILED",
        );
      } catch (swError) {
        console.error("[Push] Service worker setup error:", swError);
      }

      // Step 2: Check for existing local push subscription
      console.log("[Push] Step 2: Checking for existing push subscription...");
      let subscription: PushSubscription | null = null;

      if (registration) {
        try {
          subscription = await registration.pushManager.getSubscription();
          console.log(
            "[Push] Existing subscription:",
            subscription ? "FOUND" : "NOT FOUND",
          );
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

      // Step 3: No local subscription - check if we should restore or show as disabled
      console.log(
        "[Push] Step 3: No subscription found, checking restore conditions...",
      );
      console.log("[Push]   - permission:", permission);
      console.log("[Push]   - wasEnabledBefore:", wasEnabledBefore);

      // CRITICAL FIX: Trust localStorage over Notification.permission!
      // On mobile PWAs, Notification.permission can return "default" on cold starts
      // even though permission was previously granted. We trust localStorage because
      // it's only set to true after successful subscription.
      // Only give up if permission is explicitly "denied" (already handled above).
      if (wasEnabledBefore) {
        console.log(
          "[Push] User previously enabled (localStorage=true) - keeping isSubscribed=true while restoring...",
        );
        console.log(
          "[Push] NOTE: permission is '" +
            permission +
            "' but we trust localStorage",
        );

        // First, immediately set state to show as subscribed (prevents UI flicker)
        setState({
          isSupported: true,
          permission,
          isSubscribed: true, // ALWAYS show as subscribed if user previously enabled
          isLoading: false,
          error: null,
          subscription: null,
        });

        // Then try to restore the subscription
        try {
          console.log("[Push] Attempting to restore subscription...");
          const activeRegistration = await waitForActiveServiceWorker();
          console.log(
            "[Push] Active registration:",
            activeRegistration ? "OK" : "FAILED",
          );

          const restored = await createLocalPushSubscription(
            activeRegistration || registration,
          );

          if (restored) {
            console.log("[Push] Successfully restored subscription!");
            // Also update permission state since we successfully subscribed
            const updatedPermission =
              Notification.permission as PushPermissionState;
            setState({
              isSupported: true,
              permission: updatedPermission,
              isSubscribed: true,
              isLoading: false,
              error: null,
              subscription: restored,
            });
            saveSubscriptionWithRetry(restored);
            return;
          }
        } catch (error) {
          console.error("[Push] Restore attempt failed:", error);
        }

        // If restore failed, schedule background retry (but keep showing as subscribed)
        console.log("[Push] Restore failed, scheduling background retry...");
        if (!backgroundRestoreScheduled.current) {
          backgroundRestoreScheduled.current = true;
          scheduleBackgroundRestore(registration, () => {
            backgroundRestoreScheduled.current = false;
          });
        }
        return;
      }

      // Step 4: Not subscribed - user never enabled OR permission not granted yet
      console.log(
        "[Push] Step 4: Not subscribed (user never enabled or permission not granted)",
      );
      setState({
        isSupported: true,
        permission,
        isSubscribed: false,
        isLoading: false,
        error: null,
        subscription: null,
      });
    } finally {
      isInitializing.current = false;
      console.log("[Push] === initializePushState END ===");
    }
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
    backgroundRestoreScheduled.current = false; // Allow new restore attempts
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
// The onComplete callback is called when max attempts reached or subscription established
async function scheduleBackgroundRestore(
  registration: ServiceWorkerRegistration | null,
  onComplete?: () => void,
  attempt: number = 0,
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const delay = 3000 * Math.pow(2, attempt); // 3s, 6s, 12s, 24s, 48s

  if (attempt >= MAX_ATTEMPTS) {
    console.log(
      "[Push] Background restore: max attempts reached, giving up for this session",
    );
    onComplete?.();
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
        scheduleBackgroundRestore(registration, onComplete, attempt + 1);
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
        onComplete?.();
        // Note: we can't call setState from outside the hook,
        // but the visibilitychange handler will pick up the subscription
        // on next foreground event. The subscription object in the PushManager
        // is what matters for receiving notifications.
      } else {
        console.log("[Push] Background restore: still failed, retrying...");
        scheduleBackgroundRestore(registration, onComplete, attempt + 1);
      }
    } catch (error) {
      console.error("[Push] Background restore error:", error);
      scheduleBackgroundRestore(registration, onComplete, attempt + 1);
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
