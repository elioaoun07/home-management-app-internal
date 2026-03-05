"use client";

import { useTabSafe } from "@/contexts/TabContext";
import { useEffect } from "react";

/**
 * DeepLinkHandler - Processes URL params and custom events from the service worker
 * to route notifications to the correct tab/view without a full page reload.
 *
 * Supported URL params (on /expense or /dashboard):
 *   ?tab=reminder|dashboard|hub|expense
 *   ?item=ITEM_ID          → opens reminder tab with that item highlighted
 *   ?action=add-expense    → opens expense tab
 *   ?action=split-bill     → opens expense tab (SplitBillHandler picks it up)
 *   ?view=alerts|chat|feed|score → opens hub tab at that view
 *   ?thread=THREAD_ID      → opens hub tab at chat view with that thread
 *
 * Also listens for "notification-navigate" CustomEvent dispatched by
 * ServiceWorkerRegistration when the app is already open.
 */
export function DeepLinkHandler() {
  const tabCtx = useTabSafe();

  useEffect(() => {
    if (!tabCtx) return;

    const {
      setActiveTab,
      setHubDefaultView,
      setPendingItemId,
      setPendingAction,
      setPendingThreadId,
    } = tabCtx;

    function processParams(params: URLSearchParams) {
      const tab = params.get("tab");
      const item = params.get("item");
      const action = params.get("action");
      const view = params.get("view");
      const thread = params.get("thread");

      let handled = false;

      // Tab switch
      if (
        tab === "reminder" ||
        tab === "dashboard" ||
        tab === "hub" ||
        tab === "expense"
      ) {
        setActiveTab(tab);
        handled = true;
      }

      // Item deep link → reminder tab
      if (item) {
        setActiveTab("reminder");
        setPendingItemId(item);
        handled = true;
      }

      // Action deep links
      if (action === "add-expense") {
        setActiveTab("expense");
        handled = true;
      } else if (action === "split-bill") {
        setActiveTab("expense");
        setPendingAction("split-bill");
        handled = true;
      }

      // Hub view deep link
      if (
        view === "alerts" ||
        view === "chat" ||
        view === "feed" ||
        view === "score"
      ) {
        setActiveTab("hub");
        setHubDefaultView(view);
        handled = true;
      }

      // Thread deep link → hub tab, chat view, specific thread
      if (thread) {
        setActiveTab("hub");
        setHubDefaultView("chat");
        setPendingThreadId(thread);
        handled = true;
      }

      return handled;
    }

    // Process initial URL params on mount
    const url = new URL(window.location.href);
    if (url.searchParams.toString()) {
      const handled = processParams(url.searchParams);
      if (handled) {
        // Clean URL without reload
        const cleanUrl = url.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }

    // Listen for SW-dispatched navigation events (when app is already open)
    function handleNotificationNavigate(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (!detail?.url) return;

      try {
        const navUrl = new URL(detail.url, window.location.origin);
        processParams(navUrl.searchParams);
      } catch (e) {
        console.error("[DeepLink] Failed to process navigation event:", e);
      }
    }

    window.addEventListener(
      "notification-navigate",
      handleNotificationNavigate
    );

    return () => {
      window.removeEventListener(
        "notification-navigate",
        handleNotificationNavigate
      );
    };
  }, [tabCtx]);

  return null;
}
