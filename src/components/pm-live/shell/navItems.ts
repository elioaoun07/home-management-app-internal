// src/components/pm-live/shell/navItems.ts
// One nav definition, rendered by both the phone's bottom bar and the desktop
// side rail — so the two can never drift out of step.
import { DollarSign, Layers, LayoutDashboard, ListChecks, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ViewId } from "@/features/pm-live/viewState";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  /** Campaigns is a desktop drill-down; the phone reaches it from Overview instead. */
  desktopOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "board", label: "Board", icon: ListChecks },
  { id: "delivery", label: "Delivery", icon: Rocket },
  { id: "usage", label: "Usage", icon: DollarSign },
  { id: "campaigns", label: "Campaigns", icon: Layers, desktopOnly: true },
];
