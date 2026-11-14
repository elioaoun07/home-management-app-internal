import { useEffect, useRef, type ReactNode } from "react";
// Preserve native modified/keyboard navigation; distinguish the app's detail
// click from its double-click pin gesture without firing both actions.
export function DetailLink({
  href,
  onPin,
  children,
  className,
}: {
  href: string;
  onPin?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (
          !onPin ||
          event.detail === 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        if (event.detail === 1)
          timer.current = setTimeout(() => {
            location.hash = href.replace(/^#/, "");
          }, 220);
      }}
      onDoubleClick={(event) => {
        if (
          !onPin ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        onPin();
      }}
    >
      {children}
    </a>
  );
}
