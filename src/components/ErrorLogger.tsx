"use client";

import { useEffect } from "react";

export function ErrorLogger() {
  useEffect(() => {
    // Log errors globally
    const handleError = (event: ErrorEvent) => {
      logError({
        error_message: event.message,
        error_stack: event.error?.stack || "",
        component_name: "Global",
        url: window.location.href,
        user_agent: navigator.userAgent,
      });
    };

    // Log unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      // Ignore Next.js redirect errors (these are intentional)
      const reason = String(event.reason);
      if (
        reason.includes("NEXT_REDIRECT") ||
        reason.includes("NEXT_NOT_FOUND")
      ) {
        return;
      }

      logError({
        error_message: `Unhandled Promise Rejection: ${event.reason}`,
        error_stack: event.reason?.stack || String(event.reason),
        component_name: "Promise",
        url: window.location.href,
        user_agent: navigator.userAgent,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

async function logError(data: {
  error_message: string;
  error_stack: string;
  component_name: string;
  url: string;
  user_agent: string;
}) {
  try {
    await fetch("/api/error-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (err) {
    // Silently fail - don't want to cause more errors
    console.error("Failed to log error:", err);
  }
}
