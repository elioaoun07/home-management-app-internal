// src/hooks/usePushNotifications.ts
// Hook for managing Web Push notifications subscription
// ROBUST version: Proactive sync on every foreground, unique device ID, endpoint change detection

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The VAPID public key - must match the server's public key
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// LocalStorage keys
const PUSH_ENABLED_KEY = "push_notifications_enabled";
const DEVICE_ID_KEY = "push_device_id";
const LAST_ENDPOINT_KEY = "push_last_endpoint";
const LAST_SYNC_KEY = "push_last_sync";

// Minimum time between foreground syncs (prevent spam on rapid focus/blur)
// Android gets a shorter window because FCM rotates tokens more aggressively
const MIN_SYNC_INTERVAL_MS =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)
    ? 15000
    : 30000;

// Type for ServiceWorkerRegistration with PushManager
type SWRegistrationWithPush = ServiceWorkerRegistration & {
  pushManager: PushManager;
};

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

// ============================================
// PERSISTENT DEVICE ID
// ============================================

// Generate or retrieve a persistent device ID
// This survives app restarts and is unique per browser/device
function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "unknown";

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      // Generate a unique ID: timestamp + random + basic fingerprint
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 10);
      const fingerprint = navigator.userAgent.length.toString(36);
      deviceId = `${timestamp}-${random}-${fingerprint}`;
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
      console.log("[Push] Generated new device ID:", deviceId);
    }
    return deviceId;
  } catch {
    return "fallback-" + Date.now().toString(36);
  }
}

// Get device type for display purposes
function getDeviceType(): string {
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

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

function getPushEnabledFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PUSH_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

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

function getLastEndpointFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_ENDPOINT_KEY);
  } catch {
    return null;
  }
}

function setLastEndpointInStorage(endpoint: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (endpoint) {
      localStorage.setItem(LAST_ENDPOINT_KEY, endpoint);
    } else {
      localStorage.removeItem(LAST_ENDPOINT_KEY);
    }
  } catch {
    // Ignore
  }
}

function getLastSyncTime(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem(LAST_SYNC_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

function setLastSyncTime(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  } catch {
    // Ignore
  }
}

// ============================================
// MAIN HOOK
// ============================================

export function usePushNotifications() {
  const wasEnabled = getPushEnabledFromStorage();

  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: wasEnabled,
    isLoading: true,
    error: null,
    subscription: null,
  });

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializing = useRef(false);
  const isSyncing = useRef(false);

  // ========== CORE: Sync subscription to DB ==========
  // This is the KEY function - called on init AND every foreground
  const syncSubscriptionToDb = useCallback(
    async (
      subscription: PushSubscription,
      force: boolean = false,
    ): Promise<{ success: boolean; needsResubscribe?: boolean }> => {
      // Throttle syncs unless forced
      if (!force) {
        const lastSync = getLastSyncTime();
        const timeSinceLastSync = Date.now() - lastSync;
        if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS) {
          console.log(
            `[Push] Skipping sync - only ${Math.round(timeSinceLastSync / 1000)}s since last sync`,
          );
          return { success: true };
        }
      }

      // Check if endpoint changed (this is critical!)
      const currentEndpoint = subscription.endpoint;
      const lastEndpoint = getLastEndpointFromStorage();
      const endpointChanged = lastEndpoint && lastEndpoint !== currentEndpoint;

      if (endpointChanged) {
        console.log(
          "[Push] ⚠️ ENDPOINT CHANGED! Old:",
          lastEndpoint?.substring(0, 50),
        );
        console.log(
          "[Push] ⚠️ ENDPOINT CHANGED! New:",
          currentEndpoint.substring(0, 50),
        );
      }

      console.log(
        "[Push] Syncing subscription to DB...",
        force ? "(forced)" : "",
      );

      try {
        const result = await saveSubscriptionToApi(subscription);
        setLastEndpointInStorage(currentEndpoint);
        setLastSyncTime();
        if (result.was_previously_inactive) {
          console.warn(
            "[Push] ⚠️ Server flagged endpoint as previously dead — FCM token rotation needed",
          );
        } else {
          console.log("[Push] ✓ Subscription synced to DB successfully");
        }
        return { success: true, needsResubscribe: result.was_previously_inactive };
      } catch (error) {
        console.error("[Push] ✗ Failed to sync subscription:", error);
        return { success: false };
      }
    },
    [],
  );

  // ========== Force fresh FCM subscription (dead token recovery) ==========
  // Called when the server signals the current endpoint was previously inactive.
  // Chrome Android may cache a dead FCM token without firing pushsubscriptionchange.
  // We unsubscribe and re-subscribe to force Chrome to obtain a fresh token from FCM.
  const forceResubscribe = useCallback(
    async (deadSubscription: PushSubscription): Promise<void> => {
      console.log(
        "[Push] 🔄 Forcing fresh FCM subscription to replace dead endpoint",
      );
      try {
        const registration = (await navigator.serviceWorker
          .ready) as SWRegistrationWithPush;
        await deadSubscription.unsubscribe();
        console.log("[Push] Old (dead) subscription unregistered");

        const newSub = await createLocalPushSubscription(registration);
        if (newSub) {
          console.log(
            "[Push] ✓ Fresh subscription obtained:",
            newSub.endpoint.substring(0, 50),
          );
          await saveSubscriptionToApi(newSub);
          setLastEndpointInStorage(newSub.endpoint);
          setLastSyncTime();
          setState((prev) => ({ ...prev, subscription: newSub }));
        } else {
          console.error("[Push] Failed to obtain fresh subscription");
        }
      } catch (err) {
        console.error("[Push] forceResubscribe error:", err);
      }
    },
    [],
  );

  // ========== Initialize Push State ==========
  const initializePushState = useCallback(async () => {
    if (isInitializing.current) {
      console.log("[Push] Already initializing, skipping...");
      return;
    }
    isInitializing.current = true;

    try {
      console.log("[Push] === initializePushState START ===");

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
      const wasEnabledBefore = getPushEnabledFromStorage();

      console.log("[Push] Permission:", permission);
      console.log("[Push] localStorage wasEnabledBefore:", wasEnabledBefore);

      // If permission explicitly denied, clear everything
      if (permission === "denied") {
        console.log("[Push] Permission denied - clearing state");
        setPushEnabledInStorage(false);
        setLastEndpointInStorage(null);
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

      // Get or register service worker
      const registration = await getOrRegisterServiceWorker();
      if (!registration) {
        console.error("[Push] Failed to get service worker registration");
        setState({
          isSupported: true,
          permission,
          isSubscribed: wasEnabledBefore,
          isLoading: false,
          error: "Service worker not available",
          subscription: null,
        });
        return;
      }

      // Check for existing local subscription
      let subscription = await registration.pushManager.getSubscription();
      console.log(
        "[Push] Existing subscription:",
        subscription ? "FOUND" : "NOT FOUND",
      );

      if (subscription) {
        // We have a local subscription - sync it to DB immediately
        const activeSub = subscription; // capture non-null for .then() closure
        setPushEnabledInStorage(true);
        setState({
          isSupported: true,
          permission,
          isSubscribed: true,
          isLoading: false,
          error: null,
          subscription: activeSub,
        });

        // Sync to DB in background; if the endpoint was dead, force fresh re-subscription
        syncSubscriptionToDb(activeSub, false).then((result) => {
          if (result.needsResubscribe) {
            forceResubscribe(activeSub);
          }
        });
        return;
      }

      // No local subscription - check if we should restore
      if (wasEnabledBefore && permission === "granted") {
        console.log(
          "[Push] User had notifications enabled - attempting restore...",
        );

        // Show as subscribed while restoring
        setState({
          isSupported: true,
          permission,
          isSubscribed: true,
          isLoading: false,
          error: null,
          subscription: null,
        });

        // Try to restore subscription
        try {
          subscription = await createLocalPushSubscription(registration);
          if (subscription) {
            console.log("[Push] ✓ Subscription restored!");
            setState((prev) => ({ ...prev, subscription }));
            syncSubscriptionToDb(subscription, true);
          } else {
            console.warn("[Push] Could not restore subscription");
            // Keep showing as subscribed - will retry on next foreground
          }
        } catch (error) {
          console.error("[Push] Restore failed:", error);
        }
        return;
      }

      // Not subscribed - user never enabled or permission not granted
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
  }, [syncSubscriptionToDb, forceResubscribe]);

  // ========== Foreground Sync (CRITICAL!) ==========
  // This is called EVERY TIME the app comes to foreground
  const handleForegroundSync = useCallback(async () => {
    if (isSyncing.current) return;
    if (!getPushEnabledFromStorage()) return;

    isSyncing.current = true;
    console.log("[Push] App came to foreground - checking subscription...");

    try {
      const registration = (await navigator.serviceWorker?.ready) as
        | SWRegistrationWithPush
        | undefined;
      if (!registration) return;

      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Check if endpoint changed
        const currentEndpoint = subscription.endpoint;
        const lastEndpoint = getLastEndpointFromStorage();

        if (lastEndpoint !== currentEndpoint) {
          console.log(
            "[Push] 🔄 Endpoint changed on foreground - forcing sync!",
          );
          const result = await syncSubscriptionToDb(subscription, true);
          setState((prev) => ({ ...prev, subscription }));
          if (result.needsResubscribe) {
            await forceResubscribe(subscription);
          }
        } else {
          // Same endpoint - sync (throttled); if dead, force fresh subscription
          syncSubscriptionToDb(subscription, false).then((result) => {
            if (result.needsResubscribe) {
              forceResubscribe(subscription);
            }
          });
        }
      } else if (getPushEnabledFromStorage()) {
        // Subscription disappeared! Try to restore it
        console.log("[Push] ⚠️ Subscription disappeared - restoring...");
        const restored = await createLocalPushSubscription(registration);
        if (restored) {
          console.log("[Push] ✓ Subscription restored on foreground");
          await syncSubscriptionToDb(restored, true);
          setState((prev) => ({ ...prev, subscription: restored }));
        }
      }
    } catch (error) {
      console.error("[Push] Foreground sync error:", error);
    } finally {
      isSyncing.current = false;
    }
  }, [syncSubscriptionToDb, forceResubscribe]);

  // ========== Effect: Initialize + Foreground Listener ==========
  useEffect(() => {
    console.log("[Push] useEffect mount");
    initializePushState();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Small delay to let auth session restore
        setTimeout(handleForegroundSync, 1000);
      }
    };

    // Also sync on focus (covers more cases than visibilitychange)
    const handleFocus = () => {
      setTimeout(handleForegroundSync, 500);
    };

    // Listen for SW messages about subscription changes (from pushsubscriptionchange handler)
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SUBSCRIPTION_CHANGED") {
        console.log("[Push] SW reported subscription change — forcing foreground sync");
        isSyncing.current = false; // Reset throttle so sync runs immediately
        handleForegroundSync();
      } else if (event.data?.type === "SUBSCRIPTION_LOST") {
        console.warn("[Push] SW reported subscription lost — prompting user to re-enable");
        setState((prev) => ({
          ...prev,
          isSubscribed: false,
          error: "Push subscription was lost. Please re-enable notifications.",
        }));
        setPushEnabledInStorage(false);
        setLastEndpointInStorage(null);
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleSwMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [initializePushState, handleForegroundSync]);

  // ========== Request Permission ==========
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: "Push notifications are not supported",
      }));
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({
        ...prev,
        permission: permission as PushPermissionState,
        error: permission === "denied" ? "Permission denied" : null,
      }));
      return permission === "granted";
    } catch (error) {
      console.error("[Push] Permission request failed:", error);
      return false;
    }
  }, [state.isSupported]);

  // ========== Subscribe ==========
  const subscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      if (Notification.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return false;
        }
      }

      const registration = await getOrRegisterServiceWorker();
      if (!registration) {
        throw new Error("Service worker not available");
      }

      if (!VAPID_PUBLIC_KEY) {
        throw new Error("VAPID key not configured");
      }

      // Get or create subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      console.log(
        "[Push] Subscription ready:",
        subscription.endpoint.substring(0, 50),
      );

      // Save to API (blocking - user is waiting)
      await saveSubscriptionToApi(subscription);

      // Update local storage
      setPushEnabledInStorage(true);
      setLastEndpointInStorage(subscription.endpoint);
      setLastSyncTime();

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        subscription,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error("[Push] Subscribe failed:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Subscribe failed",
      }));
      return false;
    }
  }, [requestPermission]);

  // ========== Unsubscribe ==========
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = (await navigator.serviceWorker
        .ready) as SWRegistrationWithPush;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await removeSubscription(subscription.endpoint);
      }

      // Clear ALL local storage related to push
      setPushEnabledInStorage(false);
      setLastEndpointInStorage(null);

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
        error: error instanceof Error ? error.message : "Unsubscribe failed",
      }));
      return false;
    }
  }, []);

  // ========== Send Test Notification ==========
  const sendTestNotification = useCallback(async (): Promise<void> => {
    if (!state.isSubscribed) {
      throw new Error("Not subscribed to push notifications");
    }

    // Force sync before sending test to ensure DB has current endpoint
    if (state.subscription) {
      try {
        await syncSubscriptionToDb(state.subscription, true);
      } catch {
        // Continue anyway
      }
    }

    const response = await fetch("/api/notifications/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Test failed (${response.status})`);
    }
  }, [state.isSubscribed, state.subscription, syncSubscriptionToDb]);

  // ========== Refresh Subscription ==========
  const refreshSubscription = useCallback(async (): Promise<void> => {
    console.log("[Push] Manual refresh requested");
    isSyncing.current = false; // Reset sync lock
    await handleForegroundSync();
  }, [handleForegroundSync]);

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

// ============================================
// VAPID KEY STORAGE (for SW pushsubscriptionchange handler)
// ============================================

async function storeVapidKeyInIdb(vapidKey: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("push-config", 1);
      req.onupgradeneeded = (e) => {
        (e.target as IDBOpenDBRequest).result.createObjectStore("config");
      };
      req.onsuccess = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        const tx = db.transaction("config", "readwrite");
        tx.objectStore("config").put(vapidKey, "vapidPublicKey");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-critical — SW will prompt user to re-enable if key is missing
  }
}

async function getOrRegisterServiceWorker(): Promise<SWRegistrationWithPush | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    // First try to get existing registration
    if (navigator.serviceWorker.controller) {
      return navigator.serviceWorker.ready as Promise<SWRegistrationWithPush>;
    }

    let registration = await navigator.serviceWorker.getRegistration("/");
    if (registration) return registration as SWRegistrationWithPush;

    // Only register a NEW service worker in production (or when explicitly enabled).
    // In development, a stale SW can serve cached HTML/JS causing hydration mismatches.
    const shouldRegister =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_SW === "true";

    if (!shouldRegister) {
      console.log("[Push] Skipping SW registration in development");
      return null;
    }

    // Register new service worker
    console.log("[Push] Registering service worker...");
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration as SWRegistrationWithPush;
  } catch (error) {
    console.error("[Push] Service worker setup failed:", error);
    return null;
  }
}

async function createLocalPushSubscription(
  registration: SWRegistrationWithPush,
): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.error("[Push] VAPID key not configured");
    return null;
  }

  try {
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });
    console.log("[Push] Local subscription created");
    return subscription;
  } catch (error) {
    console.error("[Push] Failed to create subscription:", error);
    return null;
  }
}

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

async function saveSubscriptionToApi(
  subscription: PushSubscription,
): Promise<{ was_previously_inactive?: boolean }> {
  const subscriptionData = subscription.toJSON();
  const deviceId = getOrCreateDeviceId();
  const deviceType = getDeviceType();

  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscriptionData.endpoint,
      p256dh: subscriptionData.keys?.p256dh,
      auth: subscriptionData.keys?.auth,
      device_id: deviceId,
      device_name: `${deviceType} (${deviceId.substring(0, 8)})`,
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

  // Cache VAPID public key in IndexedDB so the SW's pushsubscriptionchange
  // handler can re-subscribe autonomously when FCM rotates the token.
  if (VAPID_PUBLIC_KEY) {
    storeVapidKeyInIdb(VAPID_PUBLIC_KEY);
  }

  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function removeSubscription(endpoint: string): Promise<void> {
  try {
    await fetch("/api/notifications/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
  } catch (error) {
    console.error("[Push] Error removing subscription:", error);
  }
}
