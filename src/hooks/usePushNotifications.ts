// src/hooks/usePushNotifications.ts
// Hook for managing Web Push notifications subscription

"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

// The VAPID public key - must match the server's public key
// You need to generate this and set it in your environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: false,
    isLoading: true,
    error: null,
    subscription: null,
  });

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

    // Check if already subscribed
    let subscription: PushSubscription | null = null;
    let isSubscribed = false;

    try {
      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.getSubscription();
      isSubscribed = subscription !== null;
    } catch (error) {
      console.error("[Push] Error checking subscription:", error);
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
