// src/components/ServiceWorkerRegistration.tsx
// Component to register the service worker on app startup

"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only register in production or when explicitly enabled
    const shouldRegister =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_SW === "true";

    if (!shouldRegister) {
      console.log("[SW] Skipping service worker registration in development");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("[SW] Service workers not supported");
      return;
    }

    // Register service worker
    registerServiceWorker();

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener("message", handleSWMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
    };
  }, []);

  return null; // This component doesn't render anything
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log("[SW] Service worker registered:", registration.scope);

    // Check for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New service worker is ready, prompt user to refresh
            console.log("[SW] New version available");
            // Could show a toast here prompting user to refresh
          }
        });
      }
    });
  } catch (error) {
    console.error("[SW] Registration failed:", error);
  }
}

function handleSWMessage(event: MessageEvent) {
  const { type, url } = event.data || {};

  if (type === "NAVIGATE" && url) {
    // Navigate to URL requested by service worker
    window.location.href = url;
  }
}
