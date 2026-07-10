/**
 * Notification Registry — single source of truth for every `notification_type`.
 *
 * Before this file, routing lived in `getActionRoute()`, actions lived in
 * `getQuickActions()`, and icons were hand-duplicated separately in
 * NotificationModal.tsx and HubPage.tsx's AlertsView — three places to update
 * per type, guaranteed to drift (see FABLED 2 gap G2). This file is now the
 * only place a new notification type is defined. `useNotifications.ts`
 * re-exports the resolver functions for existing call sites.
 *
 * Adding a new type: add one entry to NOTIFICATION_REGISTRY. TypeScript's
 * `Record<NotificationType, ...>` requires every value from the DB enum
 * union (defined in `src/app/api/notifications/in-app/route.ts`) to have a
 * spec — a type with no registry entry cannot compile.
 */
"use client";

import type { Notification, NotificationType } from "@/app/api/notifications/in-app/route";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  BarChart2,
  Bell,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Info,
  MessageCircle,
  MessageSquare,
  Send,
  SplitSquareHorizontal,
  Target,
  Trophy,
  Wallet,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

// ============================================
// Taxonomy (user-defined, 2026-07-10)
// ============================================
// "System alerts" — app-generated prompts (log transactions, overdue
// summaries, budget/bill/goal nudges, chat). Never synced to Google Calendar.
// "Scheduled notifications" — fired from a user-created Reminder/Event/Chore
// (`item_reminder` / `item_due` / `item_overdue`). Eligible for the one-way
// Google Calendar backup sync because they carry a real due/start time.
export type NotificationClass = "system" | "scheduled";

// ============================================
// Quick actions (moved here from useNotifications.ts)
// ============================================
export type QuickActionId =
  | "open" // primary navigation to the notification target
  | "log_transaction" // open expense form / recurring log
  | "complete_task" // mark item complete (item_reminder)
  | "confirm" // "already done" — clears notification, no nav
  | "snooze_15m"
  | "snooze_1h"
  | "snooze_tomorrow"
  | "dismiss"
  | "view_budget"
  | "open_split_bill"
  | "reply"; // open chat thread

export type QuickAction = {
  id: QuickActionId;
  label: string;
  icon: "send" | "check" | "clock" | "x" | "eye" | "wallet" | "split" | "reply";
  variant: "primary" | "success" | "neutral" | "muted";
  /** When true, mark the notification action_completed after running. */
  closesNotification?: boolean;
};

const OPEN_DISMISS: QuickAction[] = [
  { id: "open", label: "Open", icon: "eye", variant: "primary" },
  { id: "dismiss", label: "Dismiss", icon: "x", variant: "muted", closesNotification: true },
];

// ============================================
// Route resolution
// ============================================
// Page routes the app will actually navigate to (as opposed to tab-based
// deep links handled by the caller). Kept here so `resolveRoute` and the
// `action_url`/`action_data.route` validators share one allowlist.
export const VALID_PAGE_ROUTES = [
  "/dashboard",
  "/expense",
  "/recurring",
  "/settings",
  "/quick-expense",
  "/chat",
  "/reminders",
  "/focus",
  "/catalogue",
  "/recipe",
] as const;

// ============================================
// Icon
// ============================================
export type NotificationIconSpec = { Icon: LucideIcon; colorClass: string };

// ============================================
// The registry
// ============================================
export interface NotificationTypeSpec {
  type: NotificationType;
  class: NotificationClass;
  /** Type-based fallback route, used when action_url/action_data.route are absent or invalid. */
  resolveRoute: (n: Notification) => string | null;
  quickActions: (n: Notification) => QuickAction[];
  /** Only "scheduled" types may be true — system alerts never sync to Google Calendar. */
  calendarSync: boolean;
  /** Eligible to appear in the full-screen critical-alert takeover gate (still gated by priority at render time). */
  takeoverEligible: boolean;
  icon: NotificationIconSpec;
  defaultPriority: "low" | "normal" | "high" | "urgent";
  /** Recommended retention window for producers setting `expires_at`. Null = no default expiry. */
  expiresAfterHours: number | null;
}

export const NOTIFICATION_REGISTRY: Record<NotificationType, NotificationTypeSpec> = {
  daily_reminder: {
    type: "daily_reminder",
    class: "system",
    resolveRoute: () => "/expense",
    quickActions: () => [
      { id: "log_transaction", label: "Log Now", icon: "send", variant: "primary" },
      { id: "confirm", label: "Already Done", icon: "check", variant: "success", closesNotification: true },
      { id: "snooze_1h", label: "Later", icon: "clock", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: FileText, colorClass: "text-cyan-400" },
    defaultPriority: "normal",
    expiresAfterHours: 24,
  },
  daily_items_summary: {
    type: "daily_items_summary",
    class: "system",
    resolveRoute: () => "/reminders",
    quickActions: () => OPEN_DISMISS,
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: CheckSquare, colorClass: "text-cyan-400" },
    defaultPriority: "normal",
    expiresAfterHours: 24,
  },
  weekly_summary: {
    type: "weekly_summary",
    class: "system",
    resolveRoute: () => "/expense?tab=dashboard",
    quickActions: () => OPEN_DISMISS,
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: BarChart2, colorClass: "text-blue-400" },
    defaultPriority: "normal",
    expiresAfterHours: 168,
  },
  monthly_summary: {
    type: "monthly_summary",
    class: "system",
    resolveRoute: () => "/expense?tab=dashboard",
    quickActions: () => OPEN_DISMISS,
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: BarChart2, colorClass: "text-blue-400" },
    defaultPriority: "normal",
    expiresAfterHours: 720,
  },
  budget_warning: {
    type: "budget_warning",
    class: "system",
    resolveRoute: () => "/expense?tab=dashboard",
    quickActions: () => [
      { id: "view_budget", label: "View Budget", icon: "wallet", variant: "primary" },
      { id: "dismiss", label: "Got It", icon: "check", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: AlertTriangle, colorClass: "text-amber-400" },
    defaultPriority: "high",
    expiresAfterHours: 48,
  },
  budget_exceeded: {
    type: "budget_exceeded",
    class: "system",
    resolveRoute: () => "/expense?tab=dashboard",
    quickActions: () => [
      { id: "view_budget", label: "View Budget", icon: "wallet", variant: "primary" },
      { id: "dismiss", label: "Got It", icon: "check", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: true,
    icon: { Icon: AlertCircle, colorClass: "text-red-400" },
    defaultPriority: "urgent",
    expiresAfterHours: 48,
  },
  bill_due: {
    type: "bill_due",
    class: "system",
    resolveRoute: () => "/recurring",
    quickActions: () => [
      { id: "log_transaction", label: "Log Now", icon: "wallet", variant: "primary" },
      { id: "confirm", label: "Already Paid", icon: "check", variant: "success", closesNotification: true },
      { id: "snooze_1h", label: "Later", icon: "clock", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: CreditCard, colorClass: "text-blue-400" },
    defaultPriority: "high",
    expiresAfterHours: 72,
  },
  bill_overdue: {
    type: "bill_overdue",
    class: "system",
    resolveRoute: () => "/recurring",
    quickActions: () => [
      { id: "log_transaction", label: "Log Now", icon: "wallet", variant: "primary" },
      { id: "confirm", label: "Already Paid", icon: "check", variant: "success", closesNotification: true },
      { id: "snooze_1h", label: "Later", icon: "clock", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: true,
    icon: { Icon: CreditCard, colorClass: "text-red-400" },
    defaultPriority: "urgent",
    expiresAfterHours: 72,
  },
  item_reminder: {
    type: "item_reminder",
    class: "scheduled",
    resolveRoute: () => "/expense?tab=reminder",
    quickActions: () => [
      { id: "complete_task", label: "Done", icon: "check", variant: "success", closesNotification: true },
      { id: "snooze_15m", label: "Snooze 15m", icon: "clock", variant: "neutral", closesNotification: true },
      { id: "open", label: "Open", icon: "eye", variant: "muted" },
    ],
    calendarSync: true,
    takeoverEligible: false,
    icon: { Icon: Clock, colorClass: "text-orange-400" },
    defaultPriority: "normal",
    expiresAfterHours: 48,
  },
  item_due: {
    type: "item_due",
    class: "scheduled",
    resolveRoute: () => "/expense?tab=reminder",
    quickActions: () => [
      { id: "complete_task", label: "Done", icon: "check", variant: "success", closesNotification: true },
      { id: "snooze_15m", label: "Snooze 15m", icon: "clock", variant: "neutral", closesNotification: true },
      { id: "open", label: "Open", icon: "eye", variant: "muted" },
    ],
    calendarSync: true,
    takeoverEligible: true,
    icon: { Icon: Clock, colorClass: "text-orange-400" },
    defaultPriority: "high",
    expiresAfterHours: 24,
  },
  item_overdue: {
    type: "item_overdue",
    class: "scheduled",
    resolveRoute: () => "/expense?tab=reminder",
    quickActions: () => [
      { id: "complete_task", label: "Done", icon: "check", variant: "success", closesNotification: true },
      { id: "snooze_15m", label: "Snooze 15m", icon: "clock", variant: "neutral", closesNotification: true },
      { id: "open", label: "Open", icon: "eye", variant: "muted" },
    ],
    calendarSync: true,
    takeoverEligible: true,
    icon: { Icon: AlertCircle, colorClass: "text-red-400" },
    defaultPriority: "urgent",
    expiresAfterHours: 24,
  },
  goal_milestone: {
    type: "goal_milestone",
    class: "system",
    resolveRoute: () => "/expense?tab=hub",
    quickActions: () => OPEN_DISMISS,
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: Target, colorClass: "text-cyan-400" },
    defaultPriority: "normal",
    expiresAfterHours: 72,
  },
  goal_completed: {
    type: "goal_completed",
    class: "system",
    resolveRoute: () => "/expense?tab=hub",
    quickActions: () => OPEN_DISMISS,
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: Trophy, colorClass: "text-yellow-400" },
    defaultPriority: "normal",
    expiresAfterHours: 72,
  },
  chat_message: {
    type: "chat_message",
    class: "system",
    resolveRoute: (n) => {
      const threadId = (n.action_data as Record<string, unknown> | null)?.thread_id;
      return threadId ? `/chat?thread=${threadId}` : "/chat";
    },
    quickActions: () => [
      { id: "reply", label: "Reply", icon: "reply", variant: "primary" },
      { id: "confirm", label: "Mark Read", icon: "eye", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: MessageCircle, colorClass: "text-blue-400" },
    defaultPriority: "normal",
    expiresAfterHours: 24,
  },
  chat_mention: {
    type: "chat_mention",
    class: "system",
    resolveRoute: (n) => {
      const threadId = (n.action_data as Record<string, unknown> | null)?.thread_id;
      return threadId ? `/chat?thread=${threadId}` : "/chat";
    },
    quickActions: () => [
      { id: "reply", label: "Reply", icon: "reply", variant: "primary" },
      { id: "confirm", label: "Mark Read", icon: "eye", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: MessageSquare, colorClass: "text-blue-400" },
    defaultPriority: "high",
    expiresAfterHours: 24,
  },
  transaction_pending: {
    type: "transaction_pending",
    class: "system",
    // Split-bill notifications are normally intercepted before routing (the
    // caller opens SplitBillContext's modal using action_data directly) —
    // this is the fallback only for callers that don't do that interception.
    resolveRoute: () => "/expense",
    quickActions: () => [
      { id: "open_split_bill", label: "Add Amount", icon: "split", variant: "primary" },
      { id: "dismiss", label: "Dismiss", icon: "x", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: ArrowLeftRight, colorClass: "text-blue-400" },
    defaultPriority: "high",
    expiresAfterHours: 48,
  },
  info: {
    type: "info",
    class: "system",
    resolveRoute: () => null,
    quickActions: () => OPEN_DISMISS,
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: Info, colorClass: "text-blue-400" },
    defaultPriority: "low",
    expiresAfterHours: 24,
  },
  success: {
    type: "success",
    class: "system",
    resolveRoute: () => null,
    quickActions: () => [
      { id: "dismiss", label: "Dismiss", icon: "x", variant: "muted", closesNotification: true },
    ],
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: CheckCircle2, colorClass: "text-emerald-400" },
    defaultPriority: "low",
    expiresAfterHours: 24,
  },
  warning: {
    type: "warning",
    class: "system",
    resolveRoute: () => null,
    quickActions: () => OPEN_DISMISS,
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: AlertTriangle, colorClass: "text-amber-400" },
    defaultPriority: "high",
    expiresAfterHours: 48,
  },
  error: {
    type: "error",
    class: "system",
    resolveRoute: () => null,
    quickActions: () => OPEN_DISMISS,
    calendarSync: false,
    takeoverEligible: false,
    icon: { Icon: XCircle, colorClass: "text-red-400" },
    defaultPriority: "high",
    expiresAfterHours: 48,
  },
};

const DEFAULT_ICON: NotificationIconSpec = { Icon: Bell, colorClass: "text-yellow-400" };

function getSpec(type: NotificationType | null): NotificationTypeSpec | null {
  return type ? NOTIFICATION_REGISTRY[type] ?? null : null;
}

// ============================================
// Public resolvers — the single implementation NotificationModal.tsx and
// HubPage.tsx's AlertsView both call, replacing their separate hand-rolled
// route/action/icon switches.
// ============================================

function isValidPageRoute(url: string): boolean {
  return (
    VALID_PAGE_ROUTES.some((route) => url === route || url.startsWith(route + "/")) ||
    url.startsWith("/expense?") ||
    url.startsWith("/dashboard?")
  );
}

/** Resolve the route a notification should navigate to when tapped. */
export function getActionRoute(notification: Notification): string | null {
  if (notification.action_url && isValidPageRoute(notification.action_url)) {
    return notification.action_url;
  }

  const dataRoute = notification.action_data?.route;
  if (typeof dataRoute === "string" && isValidPageRoute(dataRoute)) {
    return dataRoute;
  }

  return getSpec(notification.notification_type)?.resolveRoute(notification) ?? null;
}

/** Return 1–3 contextual quick actions for a notification, most useful first. */
export function getQuickActions(notification: Notification): QuickAction[] {
  return getSpec(notification.notification_type)?.quickActions(notification) ?? OPEN_DISMISS;
}

/** Icon spec (Lucide component + color class) for a notification type. Callers render `<Icon className={cn("w-5 h-5", colorClass)} />`. */
export function getNotificationIconSpec(type: NotificationType | null | undefined): NotificationIconSpec {
  return getSpec(type ?? null)?.icon ?? DEFAULT_ICON;
}

/** Convenience renderer for call sites that just want a ReactNode. */
export function renderNotificationIcon(
  type: NotificationType | null | undefined,
  className = "w-5 h-5",
): ReactNode {
  const { Icon, colorClass } = getNotificationIconSpec(type);
  return <Icon className={`${className} ${colorClass}`} />;
}

export function getNotificationClass(type: NotificationType | null | undefined): NotificationClass {
  return getSpec(type ?? null)?.class ?? "system";
}

export function isCalendarSyncEligible(type: NotificationType | null | undefined): boolean {
  return getSpec(type ?? null)?.calendarSync ?? false;
}

export function isTakeoverEligible(type: NotificationType | null | undefined): boolean {
  return getSpec(type ?? null)?.takeoverEligible ?? false;
}

export function getDefaultExpiresAfterHours(type: NotificationType | null | undefined): number | null {
  return getSpec(type ?? null)?.expiresAfterHours ?? null;
}

/** Icon for a QuickAction button — shared by NotificationModal's drawer and the /alerts page. */
export function renderQuickActionIcon(
  icon: QuickAction["icon"],
  className = "w-3.5 h-3.5",
): ReactNode {
  switch (icon) {
    case "send":
      return <Send className={className} />;
    case "check":
      return <CheckCircle className={className} />;
    case "clock":
      return <Clock className={className} />;
    case "x":
      return <X className={className} />;
    case "eye":
      return <Eye className={className} />;
    case "wallet":
      return <Wallet className={className} />;
    case "split":
      return <SplitSquareHorizontal className={className} />;
    case "reply":
      return <MessageSquare className={className} />;
    default:
      return null;
  }
}
