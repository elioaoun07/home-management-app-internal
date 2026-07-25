// src/components/pm-live/shell/SideNav.tsx
// Desktop rail. Carries the extra views the phone's 4-slot bottom bar can't,
// plus the at-a-glance counts that make the rail worth its width.
"use client";

import { AlertTriangle } from "lucide-react";
import { NAV_ITEMS } from "./navItems";
import { BridgeStatusChip } from "../BridgeStatusChip";
import { useActiveSessions, useKpis } from "@/features/pm-live/selectors";
import { useViewState } from "@/features/pm-live/viewState";

export function SideNav() {
  const view = useViewState((s) => s.view);
  const setView = useViewState((s) => s.setView);
  const kpis = useKpis();
  const active = useActiveSessions();

  const badges: Partial<Record<string, number>> = {
    board: kpis.open,
    delivery: active.length,
    campaigns: kpis.campaigns,
  };

  return (
    <aside
      className="hidden lg:flex flex-col w-56 shrink-0 border-r"
      style={{ borderColor: "var(--pm-border)" }}
    >
      <div className="px-4 py-4">
        <h1 className="text-[15px] font-semibold" style={{ color: "var(--pm-fg-1)" }}>
          PM Live
        </h1>
        <div className="mt-2">
          <BridgeStatusChip />
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = view === id;
          const badge = badges[id];
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={isActive ? "page" : undefined}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left"
              style={{
                color: isActive ? "var(--pm-accent)" : "var(--pm-fg-2)",
                backgroundColor: isActive ? "var(--pm-accent-soft)" : "transparent",
              }}
            >
              <Icon size={16} strokeWidth={1.9} />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="text-[11px] tabular-nums" style={{ color: "var(--pm-fg-3)" }}>
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {kpis.blockers > 0 && (
        <button
          onClick={() => {
            useViewState.setState({ view: "board", query: "s:blocker" });
          }}
          className="m-2 p-3 rounded-lg text-left"
          style={{ backgroundColor: "var(--pm-warn-soft)" }}
        >
          <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--pm-warn)" }}>
            <AlertTriangle size={13} />
            {kpis.blockers} blocker{kpis.blockers === 1 ? "" : "s"} open
          </span>
          <span className="block mt-0.5 text-[11px]" style={{ color: "var(--pm-fg-3)" }}>
            Show them on the board →
          </span>
        </button>
      )}
    </aside>
  );
}
