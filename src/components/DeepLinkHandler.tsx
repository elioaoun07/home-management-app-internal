"use client";

import { useTabSafe } from "@/contexts/TabContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Cookie written by NfcBridgePage when the user taps an NFC tag in the browser.
// The PWA picks it up here on next open and navigates to the stored path.
const NFC_REDIRECT_COOKIE = "era_nfc_redirect";

function consumeNfcRedirectCookie(): string | null {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${NFC_REDIRECT_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split("=").slice(1).join("="));
  // Immediately clear the cookie
  document.cookie = `${NFC_REDIRECT_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
  return value;
}

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
 *
 * NFC bridge: when a user taps an NFC tag in the browser, a cookie is set.
 * On next PWA open (standalone mode), this handler reads that cookie and
 * navigates to the stored NFC path so the authenticated checklist loads.
 */
export function DeepLinkHandler() {
  const tabCtx = useTabSafe();
  const router = useRouter();

  // NFC redirect cookie pickup — only in standalone PWA mode
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;

    const nfcPath = consumeNfcRedirectCookie();
    if (nfcPath && nfcPath.startsWith("/nfc/")) {
      router.push(nfcPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        tab === "recurring" ||
        tab === "expense"
      ) {
        setActiveTab(tab);
        handled = true;
      } else if (tab === "hub") {
        // Legacy: hub tab → route to alerts page
        router.push("/alerts");
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

      // Hub view deep link → route to standalone /alerts page
      if (view === "alerts" || view === "feed") {
        router.push("/alerts");
        handled = true;
      } else if (view === "chat" || view === "score") {
        // Chat and Score still go via hub context (for /chat standalone page)
        router.push("/chat");
        handled = true;
      }

      // Thread deep link → chat standalone page
      if (thread) {
        router.push(`/chat?thread=${thread}`);
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
      handleNotificationNavigate,
    );

    return () => {
      window.removeEventListener(
        "notification-navigate",
        handleNotificationNavigate,
      );
    };
  }, [tabCtx]);

  return null;
}
