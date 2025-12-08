// src/hooks/useLongPress.ts
import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  delay?: number; // ms to hold before triggering
  shouldPreventDefault?: boolean;
}

/**
 * Hook for detecting long press gestures on mobile and desktop
 * Provides haptic feedback on supported devices
 */
export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  shouldPreventDefault = true,
}: UseLongPressOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const targetRef = useRef<EventTarget | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (shouldPreventDefault && e.target) {
        e.preventDefault();
      }

      targetRef.current = e.target;
      isLongPressRef.current = false;

      timeoutRef.current = setTimeout(() => {
        isLongPressRef.current = true;

        // Trigger haptic feedback on mobile
        if ("vibrate" in navigator) {
          navigator.vibrate(50); // Short vibration
        }

        onLongPress(e);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = false) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (shouldTriggerClick && !isLongPressRef.current && onClick) {
        onClick(e);
      }
    },
    [onClick]
  );

  return {
    onMouseDown: start,
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchStart: start,
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
    onTouchCancel: (e: React.TouchEvent) => clear(e, false),
  };
}
