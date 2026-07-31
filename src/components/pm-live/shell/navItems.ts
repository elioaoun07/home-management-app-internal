// src/components/pm-live/shell/navItems.ts
// Phone-only nav. Four bottom-bar tabs; Usage is reached by pushing from the
// Home screen's Spend widget rather than owning a fifth tab slot, and Capture
// lives on the raised centre FAB instead of a TopBar button.
import { Layers, LayoutDashboard, ListChecks, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ViewId } from "@/features/pm-live/viewState";

export interface TabItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
}

export const TAB_ITEMS: TabItem[] = [
  { id: "overview", label: "Home", icon: LayoutDashboard },
  { id: "board", label: "Board", icon: ListChecks },
  { id: "delivery", label: "Delivery", icon: Rocket },
  { id: "campaigns", label: "Campaigns", icon: Layers },
];
