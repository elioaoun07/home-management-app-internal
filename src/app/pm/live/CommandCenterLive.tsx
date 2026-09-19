// src/app/pm/live/CommandCenterLive.tsx
// The phone shell for the shared Command Center views: sets the relay transport,
// maps the earlier `?view=` shortcuts onto the shared routes, and mounts the app.
"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { createRelayTransport } from "@/features/pm-live/relay/transport";
import { CommandCenter } from "../../../../scripts/pm/app/CommandCenter";
import { setTransport } from "../../../../scripts/pm/app/transport";
import "../../../../scripts/pm/app/brand.css";
import "../../../../scripts/pm/app/styles.css";
import "../../../../scripts/pm/app/delivery.css";
import "../../../../scripts/pm/app/board.css";
import "../../../../scripts/pm/app/dashboard.css";
import "../../../../scripts/pm/app/responsive.css";

const VIEW_ROUTES: Record<string, string> = {
  delivery: "#/delivery",
  board: "#/explore?view=board",
  campaigns: "#/",
  overview: "#/",
};

export default function CommandCenterLive({ view }: { view: string | null }) {
  const [ready] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!location.hash && view && VIEW_ROUTES[view]) history.replaceState(null, "", location.pathname + VIEW_ROUTES[view]);
    setTransport(createRelayTransport({ supabase: supabaseBrowser() }));
    return true;
  });
  return ready ? <CommandCenter /> : null;
}
