"use client";

import { useEffect } from "react";

/**
 * After the first page load completes, collects all downloaded /_next/static/
 * JS chunk URLs and sends them to the service worker for background caching.
 *
 * On subsequent visits the SW serves these chunks instantly from cache,
 * making the app load in <1s regardless of network speed.
 */
export function ServiceWorkerWarmup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const warm = () => {
      const sw = navigator.serviceWorker.controller;
      if (!sw) return;

      const urls = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter(
          (url) =>
            url.includes("/_next/static/") &&
            (url.endsWith(".js") || url.endsWith(".css")),
        );

      if (urls.length > 0) {
        sw.postMessage({ type: "WARM_CACHE", payload: { urls } });
      }
    };

    // Wait for idle time so warmup doesn't compete with critical rendering work
    if ("requestIdleCallback" in window) {
      requestIdleCallback(warm, { timeout: 5000 });
    } else {
      setTimeout(warm, 3000);
    }
  }, []);

  return null;
}
