// src/app/pm/live/CommandCenterEntry.tsx
// Loads the shared Command Center on the client only. Its styles travel with the
// lazily loaded chunk, so the legacy view (?ui=legacy) never receives them.
"use client";

import dynamic from "next/dynamic";

const CommandCenterLive = dynamic(() => import("./CommandCenterLive"), {
  ssr: false,
  loading: () => <div className="min-h-[100dvh]" style={{ background: "var(--pm-bg)" }} />,
});

export function CommandCenterEntry({ view }: { view: string | null }) {
  return <CommandCenterLive view={view} />;
}
