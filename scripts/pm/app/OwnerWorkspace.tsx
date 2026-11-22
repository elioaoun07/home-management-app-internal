import { useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { LocalAct, LocalRunView } from "./LocalDelivery";
import { OwnerRoom } from "./OwnerRoom";
import { OwnerStationDetail } from "./OwnerStationDetail";
import {
  currentOwnerStation,
  OWNER_STATIONS,
  ownerStationState,
  type OwnerStation,
} from "./ownerStations";
import "./owner-workspace.css";

import type { Floor } from "./brain/layout";
export type DeliveryRoom = Floor;

export function RoomSwitch({
  room,
  onChange,
}: {
  room: DeliveryRoom;
  onChange: (room: DeliveryRoom) => void;
}) {
  return (
    <nav className="delivery-room-switch" aria-label="Delivery rooms">
      <button
        type="button"
        aria-pressed={room === "ai"}
        onClick={() => onChange("ai")}
      >
        <Bot size={16} />
        AI room
      </button>
      <button
        type="button"
        aria-pressed={room === "owner"}
        onClick={() => onChange("owner")}
      >
        <SlidersHorizontal size={15} />
        Owner room
      </button>
    </nav>
  );
}

export function opensAtOwner(run: LocalRunView) {
  return (
    !run.parked &&
    (!!run.handover ||
      !!run.merge_pending ||
      !!run.applied ||
      !!run.committed ||
      !!run.pushed ||
      [
        "uat-ready",
        "merging",
        "merged",
        "committed",
        "pushed",
        "cleaned",
        "refresh-conflict",
        "refresh-failed",
      ].includes(run.phase))
  );
}

export function OwnerWorkspace({
  run,
  busy,
  act,
  patch,
  calm = false,
  readOnly = false,
  initialStation,
  onStationChange,
}: {
  run: LocalRunView;
  busy: boolean;
  act: LocalAct;
  patch: string | null;
  calm?: boolean;
  readOnly?: boolean;
  initialStation?: OwnerStation;
  onStationChange?: (station?: OwnerStation) => void;
}) {
  const current = currentOwnerStation(run);
  const [inspected, inspect] = useState<OwnerStation | undefined>(
    initialStation,
  );
  const selected = inspected ?? current;
  const [readerOpen, setReaderOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [displayedPatch, setDisplayedPatch] = useState<string | null>(null);
  const reader = useRef<HTMLElement>(null);
  const sceneElement = useRef<HTMLDivElement>(null);
  const closeReader = () => {
    setReaderOpen(false);
    setExpanded(false);
    requestAnimationFrame(() => sceneElement.current?.querySelector<HTMLButtonElement>(
      ".owner-room-station[aria-pressed=true]",
    )?.focus({ preventScroll: true }));
  };
  const position = OWNER_STATIONS.findIndex(
    (station) => station.id === selected,
  );
  const openStation = (station: OwnerStation) => {
    inspect(station === current ? undefined : station);
    onStationChange?.(station === current ? undefined : station);
    setReaderOpen(true);
    requestAnimationFrame(() => {
      const node = reader.current;
      if (!node) return;
      node.scrollTop = 0;
      node.focus({ preventScroll: true });
      if (!calm && window.matchMedia("(max-width: 820px)").matches)
        node.scrollIntoView({ block: "start" });
    });
  };
  const scene = !calm && (
    <div ref={sceneElement} className="owner-workspace-scene" hidden={expanded && readerOpen}>
      <OwnerRoom
        run={run}
        selected={selected}
        onSelect={openStation}
        blocked={expanded && readerOpen}
        patch={
          readOnly ||
          (selected !== "merge" && selected !== "review")
            ? null
            : displayedPatch
        }
      />
      {!readerOpen && (
        <button
          className="owner-open-reader"
          onClick={() => openStation(selected)}
        >
          <Crosshair size={16} />
          Inspect {OWNER_STATIONS[position].label}
        </button>
      )}
    </div>
  );
  return (
    <section
      className="owner-workspace"
      data-calm={calm}
      data-reader={readerOpen}
      data-expanded={expanded && readerOpen}
      aria-label="Owner workflow"
    >
      {scene}
      {calm && (
        <nav className="calm-stations" aria-label="Owner stations">
          {OWNER_STATIONS.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              aria-pressed={selected === id}
              data-state={ownerStationState(run, id)}
              onClick={() => openStation(id)}
            >
              {ownerStationState(run, id) === "done" ? (
                <Check size={14} />
              ) : (
                <i />
              )}
              {label}
            </button>
          ))}
        </nav>
      )}
        <section
          className="owner-inspector"
          hidden={!readerOpen && !calm}
          aria-label="Station inspector"
          tabIndex={-1}
          ref={reader}
          onKeyDown={event => {
            if (!calm && event.key === "Escape" && !event.defaultPrevented) {
              event.preventDefault();
              if (expanded) setExpanded(false);
              else closeReader();
            }
          }}
        >
          <header className="owner-inspector-toolbar">
            <span>
              Workstation {String(position + 1).padStart(2, "0")} / 06
            </span>
            <button
              type="button"
              aria-label="Previous station"
              title="Previous station"
              disabled={position === 0}
              onClick={() => openStation(OWNER_STATIONS[position - 1].id)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next station"
              title="Next station"
              disabled={position === OWNER_STATIONS.length - 1}
              onClick={() => openStation(OWNER_STATIONS[position + 1].id)}
            >
              <ChevronRight size={18} />
            </button>
            {!calm && (
              <>
                <button
                  type="button"
                  aria-label={expanded ? "Restore room" : "Expand inspector"}
                  title={expanded ? "Restore room" : "Expand inspector"}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  aria-label="Close inspector"
                  title="Close inspector"
                  onClick={closeReader}
                >
                  <X size={16} />
                </button>
              </>
            )}
          </header>
          <OwnerStationDetail
            key={selected}
            station={selected}
            run={run}
            act={(action, evidence) => {
              if (selected === current) inspect(undefined);
              act(action, evidence);
            }}
            patch={patch}
            busy={busy}
            readOnly={readOnly}
            onPatchViewed={setDisplayedPatch}
            onSelectStation={openStation}
          />
        </section>
    </section>
  );
}
