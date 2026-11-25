import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HUD, ZONES } from "../config";
import type { ZoneBoardState } from "../zoneModel";
import { SettingsMenu, type SettingsMenuProps } from "./SettingsMenu";
import { Back } from "../../components";

export interface TopBarProps extends SettingsMenuProps {
  id: string;
  title: string;
  /** DLV-175: "Attempt 2 · Revision 1/2" when this is not the first try. */
  attempt?: string | null;
  zones: ZoneBoardState;
  line: number;
  turn: string | null;
  caption: string;
  clock: ReactNode;
  theater?: ReactNode;
  roomSwitch?: ReactNode;
  replay?: boolean;
}

export function TopBar({
  id,
  title,
  attempt,
  zones,
  line,
  turn,
  caption,
  clock,
  theater,
  roomSwitch,
  replay,
  ...settings
}: TopBarProps) {
  const ref = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia(`(max-width: ${HUD.railBelow}px)`).matches,
  );
  useLayoutEffect(() => {
    const media = matchMedia(`(max-width: ${HUD.railBelow}px)`),
      changed = () => setNarrow(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useLayoutEffect(() => {
    const root = ref.current?.closest<HTMLElement>(".board-workshop");
    if (root) root.dataset.narrow = String(narrow);
  }, [narrow]);
  return (
    <header ref={ref} className="board-topbar">
      <Back fallback="/delivery" />
      <nav className="board-zone-track" aria-label="Delivery stages">
        {(["setup", "build", "verify", "test", "ship"] as const).map(
          (group) => (
            <span className="board-zone-group" key={group}>
              <b>{group.toUpperCase()}</b>
              <span>
                {ZONES.filter((zone) => zone.group === group).map((zone) => {
                  const evidence = zones.zones.find(
                    (value) => value.id === zone.id,
                  );
                  return (
                    <i
                      key={zone.id}
                      data-zone={zone.id}
                      data-state={evidence?.status ?? "off"}
                      title={`${String(zone.number).padStart(2, "0")} ${zone.label}`}
                      aria-label={zone.label}
                    />
                  );
                })}
              </span>
            </span>
          ),
        )}
      </nav>
      <div className="board-title">
        <span className="run-game-tag">{id}</span>
        {attempt && <span className="run-game-tag run-game-attempt">{attempt}</span>}
        <h1 title={title}>{title}</h1>
      </div>
      {roomSwitch}
      <span className="board-line" title="Completed or skipped stations">{line}/11 complete</span>
      <div className="board-status">
        {turn && (
          <strong className="board-turn" data-owner={turn === "YOUR TURN"}>
            <i />
            {turn}
          </strong>
        )}
        {caption && <span className="board-caption">{caption}</span>}
        <span className="board-clock">{clock}</span>
        {replay && <span className="board-replay-tag">Replay</span>}
      </div>
      <div className="board-top-controls">
        <SettingsMenu {...settings} />
        {theater}
      </div>
    </header>
  );
}
