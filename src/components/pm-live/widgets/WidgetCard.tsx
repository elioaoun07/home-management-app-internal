// src/components/pm-live/widgets/WidgetCard.tsx
// Frame for every dashboard widget — mirrors the role of
// src/components/dashboard-v2/WidgetCard.tsx in the themed app, on pm-live
// tokens instead of theme classes.
"use client";

export function WidgetCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  noPadding = false,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section className={`pm-card overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-start gap-3 px-3.5 pt-3 pb-2">
          <div className="min-w-0 flex-1">
            {title && (
              <h3
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--pm-fg-3)" }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[12px] mt-0.5" style={{ color: "var(--pm-fg-3)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={noPadding ? "" : "px-3.5 pb-3.5"}>{children}</div>
    </section>
  );
}

/** Shown when a snapshot row hasn't arrived — an older bridge, or a cold offline open. */
export function WidgetEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-[12.5px]" style={{ color: "var(--pm-fg-3)" }}>
      {children}
    </p>
  );
}
