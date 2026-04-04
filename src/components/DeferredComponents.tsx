"use client";

import dynamic from "next/dynamic";

// Lazy-load heavy components that aren't needed for initial page render.
// AIChatAssistant is 1100+ lines and SplitBillHandler fires a 3s deferred query.
// Loading them after the main content paints saves significant JS parse time on 3G.
const AIChatAssistant = dynamic(
  () => import("@/components/ai/AIChatAssistant"),
  { ssr: false },
);
const SplitBillHandler = dynamic(
  () => import("@/components/expense/SplitBillHandler"),
  { ssr: false },
);

/** Renders heavy non-critical components lazily. Must be a Client Component for ssr:false. */
export function DeferredComponents() {
  return (
    <>
      <AIChatAssistant />
      <SplitBillHandler />
    </>
  );
}
