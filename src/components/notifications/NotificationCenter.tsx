/**
 * NotificationCenter Component
 * Combines NotificationBell and NotificationModal
 * Used in the header for easy integration
 */
"use client";

import { useNotificationsRealtime } from "@/hooks/useNotifications";
import { useState } from "react";
import NotificationBell from "./NotificationBell";
import NotificationModal from "./NotificationModal";

type NotificationCenterProps = {
  className?: string;
};

export default function NotificationCenter({
  className,
}: NotificationCenterProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  useNotificationsRealtime();

  return (
    <>
      <NotificationBell
        onClick={() => setIsModalOpen(true)}
        className={className}
      />
      <NotificationModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}

// Export sub-components for flexible usage
export { NotificationBell, NotificationModal };
