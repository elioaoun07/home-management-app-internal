import { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  CircleDot,
  CirclePause,
  GitCommitHorizontal,
  GitMerge,
  ListChecks,
  Orbit,
  Radar,
  ScanLine,
} from "lucide-react";
import type { LocalRunView } from "./LocalDelivery";
import {
  OWNER_STATIONS,
  ownerStationSignals,
  type OwnerStation,
} from "./ownerStations";
import type { BerthLabel, OwnerWorld } from "./ownerWorld";
import "./owner-room.css";

const glyphs = {
  test: ListChecks,
  review: ScanLine,
  merge: GitMerge,
  commit: GitCommitHorizontal,
  push: Radar,
  cleanup: Orbit,
};
const stateLabels: Record<string, string> = {
  done: "Complete",
  current: "Current step",
  pending: "Pending",
  stopped: "Stopped",
  optional: "Optional",
};
const assetPath = "/app/assets/brain-room.js";
const stateIcons = { done: Check, current: CircleDot, stopped: CirclePause, pending: null, optional: null };
type SceneModule = Pick<typeof import("./ownerWorld"), "createOwnerWorld">;

export function OwnerRoom({
  run,
  selected,
  onSelect,
  patch,
  blocked = false,
}: {
  run: LocalRunView;
  selected: OwnerStation;
  onSelect: (id: OwnerStation) => void;
  patch?: string | null;
  blocked?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    world = useRef<OwnerWorld | null>(null);
  const [labels, setLabels] = useState<BerthLabel[]>([]);
  const instructions = useId();
  const signals = ownerStationSignals(run);
  const state = { selected, signals, patch };
  const latest = useRef({ state, onSelect, blocked });
  latest.current = { state, onSelect, blocked };

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let active = true;
    const fallback = () => {
      if (!active) return;
      world.current?.dispose();
      world.current = null;
      setLabels([]);
    };
    void (import(/* webpackIgnore: true */ assetPath) as Promise<SceneModule>)
      .then((module) => {
        if (!active) return;
        world.current = module.createOwnerWorld(
          container,
          latest.current.state,
          (id) => {
            if (!latest.current.blocked) latest.current.onSelect(id);
          },
          setLabels,
          fallback,
        );
      })
      .catch(fallback);
    return () => {
      active = false;
      world.current?.dispose();
      world.current = null;
    };
  }, []);
  useEffect(() => {
    world.current?.update(latest.current.state);
    if (blocked) world.current?.stop();
  }, [selected, run, patch, blocked]);
  const boardLabels = labels.length > 0;
  return (
    <section
      className="owner-room"
      aria-label="Your board"
      data-view="board"
      data-loaded={!!labels.length}
    >
      <div
        className="owner-room-render"
        ref={host}
        role="region"
        aria-label="Workshop map"
        tabIndex={-1}
        style={{ pointerEvents: blocked ? "none" : undefined }}
      />
      <nav
        className="owner-room-stations"
        data-layout={boardLabels ? "berths" : "schematic"}
        aria-label="Owner workstations"
      >
        {OWNER_STATIONS.map(({ id, label }) => {
          const marker = labels.find((p) => p.id === id),
            Icon = glyphs[id],
            status = signals[id];
          const StateIcon = stateIcons[status];
          return (
            <button
              key={id}
              type="button"
              disabled={blocked}
              aria-label={label}
              aria-describedby={instructions + "-" + id}
              aria-pressed={id === selected}
              data-station={id}
              data-state={status}
              className="owner-room-station"
              title={label + " · " + stateLabels[status]}
              onClick={() => onSelect(id)}
              style={
                boardLabels && marker
                  ? {
                      left: marker.x + "%",
                      top: marker.y + "%",
                    }
                  : undefined
              }
            >
              <Icon
                className="owner-room-glyph"
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{label}</span>
              <span id={instructions + "-" + id} className="stage-announcement">
                {stateLabels[status]}
              </span>
              {StateIcon && (
                <StateIcon
                  className="owner-room-signal"
                  size={12}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
