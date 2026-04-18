"use client";

import HubPage from "@/components/hub/HubPage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function AlertsPage() {
  const themeClasses = useThemeClasses();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("min-h-screen pt-16", themeClasses.bgPage)}>
      {/* HubPage with only Alerts/Feed views */}
      {mounted && (
        <HubPage
          standalone
          allowedViews={["alerts", "feed"]}
          initialView="alerts"
          hideHeader
        />
      )}
    </div>
  );
}
