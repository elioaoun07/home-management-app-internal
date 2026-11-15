import { useEffect, useId, useRef } from "react";
import { ArrowUpRight, CircleDot } from "lucide-react";
import "./delivery-workshop.css";

export type WorkshopStation = "source" | "forge" | "lab" | "review" | "launch";

const stations = [
  { id: "source", name: "Source", action: "Read / explore", index: "01" },
  { id: "forge", name: "Forge", action: "Write / build", index: "02" },
  { id: "lab", name: "Lab", action: "Run / verify", index: "03" },
  { id: "review", name: "Review", action: "Inspect / hand over", index: "04" },
] as const;

function StationGlyph({ station }: { station: WorkshopStation }) {
  return (
    <svg
      viewBox="0 0 120 90"
      className="workshop-station-glyph"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="workshop-plinth-side"
        d="m10 58 50-26 50 26v9L60 93 10 67Z"
      />
      <path className="workshop-plinth-top" d="m10 58 50-26 50 26-50 26Z" />
      <path className="workshop-plinth-lines" d="m10 58 50 26 50-26M60 84v9" />
      {station === "source" && (
        <g className="workshop-machine">
          <path
            className="workshop-machine-face"
            d="m33 46 32-17 25 13v22L58 81 33 68Z"
          />
          <path d="m33 46 25 13 32-17M58 59v22m8-45 12 6-18 10-12-7Z" />
          <path
            className="workshop-machine-detail"
            d="m40 53 11 6m-11 1 11 6m14-2 17-9m-17 16 17-9"
          />
          <path
            className="workshop-file-float"
            d="m37 24 20-11 22 11v13L59 48 37 36Zm0 0 22 12 20-12M59 36v12"
          />
        </g>
      )}
      {station === "forge" && (
        <g className="workshop-machine">
          <path
            className="workshop-machine-face"
            d="m36 42 24-13 24 13v27L60 82 36 69Z"
          />
          <path d="m36 42 24 13 24-13M60 55v27M36 51l24 13 24-13M36 60l24 13 24-13" />
          <path
            className="workshop-forge-cube"
            d="m44 21 16-9 16 9v18l-16 9-16-9Zm0 0 16 9 16-9M60 30v18"
          />
          <path
            className="workshop-machine-detail"
            d="M60 4v4m29 12-5 3m-53-3 5 3M26 36h7m54 0h7"
          />
        </g>
      )}
      {station === "lab" && (
        <g className="workshop-machine">
          <path
            className="workshop-machine-face"
            d="m33 39 26-14 29 15v29L62 83 33 68Z"
          />
          <path d="m33 39 29 15 26-14M62 54v29m-21-38 16 8v16l-16-8Z" />
          <path
            className="workshop-machine-detail"
            d="m68 59 5 3 8-13m-11 19 10-5"
          />
          <path
            className="workshop-lab-ring"
            d="M34 25c0-10 53-10 53 0s-53 10-53 0Z"
          />
          <path
            className="workshop-lab-ring workshop-lab-ring-upper"
            d="M41 14c0-7 39-7 39 0s-39 7-39 0Z"
          />
        </g>
      )}
      {station === "review" && (
        <g className="workshop-machine">
          <path
            className="workshop-machine-face"
            d="m36 43 24-13 24 13v24L60 81 36 67Z"
          />
          <path d="m36 43 24 13 24-13M60 56v25" />
          <path
            className="workshop-review-shield"
            d="m60 11 20 10v18c0 13-20 23-20 23S40 52 40 39V21Z"
          />
          <path className="workshop-machine-detail" d="m51 36 7 7 13-16" />
        </g>
      )}
    </svg>
  );
}

/** The presence moves only when an observed action selects another station. */
export function DeliveryWorkshop({
  station,
  active,
  label,
  detail,
  phase,
  completed = false,
  onStationSelect,
}: {
  station: WorkshopStation;
  active: boolean;
  label: string;
  detail?: string | null;
  phase: string;
  completed?: boolean;
  onStationSelect?: (station: WorkshopStation) => void;
}) {
  const scene = useRef<HTMLElement>(null);
  const captionId = useId();
  useEffect(() => {
    const root = scene.current;
    if (!root) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const sync = () => {
      root.dataset.motion =
        active &&
        inView &&
        !preference.matches &&
        document.visibilityState !== "hidden"
          ? "active"
          : "paused";
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);
    preference.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      preference.removeEventListener("change", sync);
    };
  }, [active]);

  return (
    <section
      className="delivery-workshop"
      ref={scene}
      data-station={station}
      data-active={active}
      data-completed={completed}
      data-motion="paused"
      aria-label="ERA workshop"
      aria-describedby={captionId}
    >
      <header className="workshop-heading">
        <span>
          <CircleDot size={14} aria-hidden="true" />
          ERA / WORKSHOP
        </span>
        <span className="workshop-phase">
          <i aria-hidden="true" />
          {phase}
        </span>
      </header>
      <div className="workshop-map">
        <div className="workshop-atmosphere" aria-hidden="true" />
        <svg
          className="workshop-deck"
          viewBox="0 0 900 470"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            className="workshop-deck-shadow"
            d="m450 40 400 190v52L450 462 50 282v-52Z"
          />
          <path
            className="workshop-deck-surface"
            d="m450 15 400 190L450 425 50 205Z"
          />
          <path
            className="workshop-deck-edge"
            d="m50 205 400 220 400-220M450 425v35"
          />
          <g className="workshop-deck-grid">
            {[0, 1, 2, 3, 4, 5, 6].map((line) => (
              <path
                key={line}
                d={`M${100 + line * 50} ${180 - line * 24}l400 211M${500 + line * 50} ${39 + line * 24}l-400 211`}
              />
            ))}
          </g>
          <g className="workshop-connections">
            <path d="M180 155h145l125 85 125-85h145M180 350h145l125-110 125 110h145" />
            <path d="M180 155v195m540-195v195" />
            <circle cx="450" cy="240" r="33" />
            <ellipse cx="450" cy="240" rx="82" ry="40" />
          </g>
          <g className="workshop-signal-paths">
            <path data-route="source" d="M450 240 325 155H180" />
            <path data-route="forge" d="m450 240 125-85h145" />
            <path data-route="lab" d="m450 240 125 110h145" />
            <path data-route="review" d="M450 240 325 350H180" />
          </g>
          <g className="workshop-deck-pins">
            <path d="M450 7v16M40 205h22m776 0h22M450 414v22" />
            <circle cx="450" cy="240" r="5" />
          </g>
        </svg>
        {stations.map((item) => (
          <button
            type="button"
            className={`workshop-station workshop-station-${item.id}`}
            key={item.id}
            data-current={station === item.id}
            aria-label={`Open ${item.id === "source" ? "activity" : item.id === "forge" ? "changes" : item.id === "lab" ? "verification" : "brief"}`}
            onClick={() => onStationSelect?.(item.id)}
          >
            <span className="workshop-station-number">{item.index}</span>
            <StationGlyph station={item.id} />
            <strong>{item.name}</strong>
            <small>{item.action}</small>
            <span className="workshop-station-light" />
          </button>
        ))}
        <div className="workshop-presence" aria-hidden="true">
          <div className="workshop-presence-shadow" />
          <div className="workshop-bot">
            <span className="workshop-bot-name">ERA</span>
            <svg viewBox="0 0 110 116" fill="none">
              <ellipse
                className="workshop-bot-orbit"
                cx="55"
                cy="61"
                rx="49"
                ry="19"
                transform="rotate(-28 55 61)"
              />
              <path
                className="workshop-bot-body"
                d="m55 23 29 17v34L55 91 26 74V40Z"
              />
              <path
                className="workshop-bot-rim"
                d="m26 40 29 17 29-17M55 57v34m-16-8 16 9 16-9"
              />
              <path
                className="workshop-bot-face"
                d="m37 45 18 10 18-10v22L55 77 37 67Z"
              />
              <g className="workshop-bot-eyes">
                <path d="m44 57 4 2m14 0 4-2" />
              </g>
              <path className="workshop-bot-mouth" d="m50 67 5 3 5-3" />
              <path className="workshop-bot-aerial" d="M55 14v8m-4-11h8" />
              <path
                className="workshop-bot-exhaust"
                d="m47 98 8 5 8-5m-12 9 4 2 4-2"
              />
            </svg>
            {detail && (
              <span className="workshop-cargo">
                <svg viewBox="0 0 22 28" fill="none">
                  <path d="M2 2h11l7 7v17H2Z" />
                  <path d="M13 2v7h7M6 15h10M6 20h7" />
                </svg>
              </span>
            )}
          </div>
        </div>
        <span
          className="workshop-coordinate workshop-coordinate-left"
          aria-hidden="true"
        >
          ERA.01
        </span>
        <span
          className="workshop-coordinate workshop-coordinate-right"
          aria-hidden="true"
        >
          {completed ? "COMPLETE" : "LOCAL"}
        </span>
      </div>
      <div
        className="workshop-now"
        id={captionId}
        role="status"
        aria-atomic="true"
      >
        <span className="workshop-now-marker" aria-hidden="true">
          <ArrowUpRight size={20} />
        </span>
        <div>
          <strong>{label}</strong>
          {detail && <code title={detail}>{detail}</code>}
        </div>
        <span className="workshop-now-signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </section>
  );
}
