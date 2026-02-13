// src/hooks/usePushNotifications.ts
// Hook for managing Web Push notifications subscription

"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";

// The VAPID public key - must match the server's public key
// You need to generate this and set it in your environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// LocalStorage key to track subscription state
const PUSH_ENABLED_KEY = "push_notifications_enabled";

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
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: false,
    isLoading: true,
    error: null,
    subscription: null,
  });

  // Track if we've already tried to auto-restore subscription
  const hasAttemptedRestore = useRef(false);

  // Check if push is supported and current permission state
  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = useCallback(async () => {
    // Check browser support
    if (typeof window === "undefined") {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!isSupported) {
      setState((prev) => ({
        ...prev,
        isSupported: false,
        permission: "unsupported",
        isLoading: false,
      }));
      return;
    }

    // Get current permission state
    const permission = Notification.permission as PushPermissionState;

    // Check localStorage first - if user previously enabled notifications
    const wasEnabledBefore = getPushEnabledFromStorage();

    // Check if already subscribed via local PushManager
    let subscription: PushSubscription | null = null;
    let isSubscribed = false;

    try {
      // First, ensure service worker is registered (especially important on Android PWA restart)
      let registration: ServiceWorkerRegistration | null = null;

      try {
        // Check if there's an existing registration
        const existingReg = await navigator.serviceWorker.getRegistration("/");
        registration = existingReg || null;

        if (!registration) {
          console.log(
            "[Push] No service worker registration found, registering...",
          );
          registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
        }

        // Wait for the service worker to be ready
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
      } catch (swError) {
        console.error("[Push] Service worker setup error:", swError);
      }

      if (registration) {
        subscription = await registration.pushManager.getSubscription();
        isSubscribed = subscription !== null;

        if (subscription) {
          console.log(
            "[Push] Local subscription found:",
            subscription.endpoint.substring(0, 50) + "...",
          );
          // Ensure localStorage is synced
          setPushEnabledInStorage(true);
          // Verify/update the subscription in database (async, don't wait)
          verifySubscriptionInDatabase(subscription).catch(console.error);
        }
      } else {
        console.log("[Push] No service worker registration available");
      }
    } catch (error) {
      console.error("[Push] Error checking subscription:", error);
    }

    // If no local subscription but user previously enabled notifications and permission is still granted
    // This handles Android PWA losing subscription state on restart
    if (
      !isSubscribed &&
      permission === "granted" &&
      wasEnabledBefore &&
      !hasAttemptedRestore.current
    ) {
      hasAttemptedRestore.current = true;
      console.log(
        "[Push] No local subscription but was enabled before, auto-restoring...",
      );

      try {
        const restored = await autoResubscribe();
        if (restored) {
          subscription = restored;
          isSubscribed = true;
          console.log("[Push] Successfully re-established subscription");
        } else {
          // Failed to restore, clear the localStorage flag
          console.log("[Push] Failed to restore subscription");
          setPushEnabledInStorage(false);
        }
      } catch (error) {
        console.error("[Push] Error auto-restoring subscription:", error);
        setPushEnabledInStorage(false);
      }
    }

    // If permission was revoked, clear storage
    if (permission === "denied") {
      setPushEnabledInStorage(false);
    }

    setState({
      isSupported: true,
      permission,
      isSubscribed,
      isLoading: false,
      error: null,
      subscription,
    });
  }, []);

  // Register service worker
  const registerServiceWorker =
    useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
      if (!("serviceWorker" in navigator)) {
        return null;
      }

      try {
        // Register the service worker
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("[Push] Service worker registered:", registration.scope);

        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;

        return registration;
      } catch (error) {
        console.error("[Push] Service worker registration failed:", error);
        throw error;
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

      // Register/get service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error("Failed to register service worker");
      }

      // Check if VAPID key is configured
      if (!VAPID_PUBLIC_KEY) {
        throw new Error("VAPID public key not configured");
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Required - all push must show a notification
        applicationServerKey: applicationServerKey as BufferSource,
      });

      console.log("[Push] Subscription created:", subscription.endpoint);

      // Save subscription to database
      await saveSubscription(subscription);

      // Save to localStorage for quick restore on next app open
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
  }, [requestPermission, registerServiceWorker]);

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

      // Clear localStorage flag
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

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to send test notification");
      }
    } catch (error) {
      console.error("[Push] Test notification failed:", error);
      throw error;
    }
  }, [state.isSubscribed]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    checkSupport,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// Save subscription to database via API
async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to save subscription");
  }
}

// Remove subscription from database
async function removeSubscription(endpoint: string): Promise<void> {
  const response = await fetch("/api/notifications/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    console.error("[Push] Failed to remove subscription from database");
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

// Check database subscription status
async function checkDatabaseSubscriptionStatus(): Promise<{
  hasActiveSubscription: boolean;
  count: number;
} | null> {
  try {
    const response = await fetch("/api/notifications/status", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[Push] Error checking database status:", error);
    return null;
  }
}

// Verify/update subscription in database
async function verifySubscriptionInDatabase(
  subscription: PushSubscription,
): Promise<void> {
  try {
    const subscriptionData = subscription.toJSON();

    const response = await fetch("/api/notifications/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscriptionData.endpoint,
      }),
    });

    if (!response.ok) {
      console.error("[Push] Failed to verify subscription in database");
      return;
    }

    const { exists, isActive } = await response.json();

    // If subscription doesn't exist in database or is inactive, save it
    if (!exists || !isActive) {
      console.log("[Push] Updating subscription in database...");
      await saveSubscription(subscription);
    }
  } catch (error) {
    console.error("[Push] Error verifying subscription:", error);
  }
}

// Auto re-subscribe when permission is granted but local subscription is lost
async function autoResubscribe(): Promise<PushSubscription | null> {
  try {
    if (!VAPID_PUBLIC_KEY) {
      console.error("[Push] VAPID key not configured");
      return null;
    }

    // Ensure service worker is registered
    let registration: ServiceWorkerRegistration;

    try {
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
    } catch (error) {
      console.error("[Push] Failed to register service worker:", error);
      return null;
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    // Subscribe to push manager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    console.log(
      "[Push] Auto re-subscribe successful:",
      subscription.endpoint.substring(0, 50) + "...",
    );

    // Save to database (this will also clean up old subscriptions)
    await saveSubscription(subscription);

    return subscription;
  } catch (error) {
    console.error("[Push] Auto re-subscribe failed:", error);
    return null;
  }
}
