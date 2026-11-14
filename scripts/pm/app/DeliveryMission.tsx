import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowUpRight,
  Crosshair,
  Flag,
  Orbit,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { Work } from "./types";
import "./delivery-mission.css";

/** A launch scene, not a session indicator: later stages are deliberately unfilled. */
export function DeliveryMission({
  work,
  lane,
  children,
  busy = false,
  blocked = false,
}: {
  work: Work;
  lane: "local" | "confined";
  children: ReactNode;
  busy?: boolean;
  blocked?: boolean;
}) {
  const scene = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = scene.current;
    if (!root) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const sync = () => {
      root.dataset.motion =
        inView && document.visibilityState !== "hidden" && !preference.matches
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
  }, []);

  return (
    <section
      className="delivery-mission"
      data-busy={busy}
      data-blocked={blocked}
      data-motion="paused"
      ref={scene}
      aria-label="Mission launch"
    >
      <header className="mission-heading">
        <div className="mission-identity">
          <span className="mission-tag">
            <Crosshair size={15} aria-hidden="true" />
            {work.idChip || work.id}
          </span>
          <span className="mission-campaign">{work.module}</span>
          <span className="mission-lane">
            {lane === "local" ? "Local" : "Confined"}
          </span>
        </div>
        <h1>{work.title}</h1>
      </header>
      <div className="mission-bay">
        <div className="mission-scene" aria-hidden="true">
          <span className="mission-scene-label">ERA / Launch bay</span>
          <div className="mission-orbital">
            <span className="mission-aura" />
            <svg viewBox="0 0 360 360" className="mission-orbits" fill="none">
              <circle className="mission-guide" cx="180" cy="180" r="150" />
              <circle
                className="mission-guide mission-guide-inner"
                cx="180"
                cy="180"
                r="105"
              />
              <path
                className="mission-crosshair"
                d="M180 14v20m0 292v20M14 180h20m292 0h20"
              />
              <g className="mission-rotor">
                <circle
                  cx="180"
                  cy="180"
                  r="150"
                  strokeDasharray="90 175 30 175"
                />
                <circle className="mission-satellite" cx="180" cy="30" r="4" />
                <circle
                  className="mission-satellite"
                  cx="180"
                  cy="330"
                  r="2.5"
                />
              </g>
              <g className="mission-counter-rotor">
                <ellipse
                  cx="180"
                  cy="180"
                  rx="138"
                  ry="65"
                  transform="rotate(-35 180 180)"
                />
                <ellipse
                  className="mission-ellipse-faint"
                  cx="180"
                  cy="180"
                  rx="138"
                  ry="65"
                  transform="rotate(35 180 180)"
                />
              </g>
              <g className="mission-glyph">
                <path
                  className="mission-glyph-face"
                  d="m180 124 49 28v56l-49 28-49-28v-56Z"
                />
                <path d="m131 152 49 28 49-28m-49 28v56m-25-70 25-14 25 14-25 14Z" />
                <path className="mission-glyph-cut" d="m167 190 13 8 13-8" />
              </g>
            </svg>
            <span className="mission-spark mission-spark-one" />
            <span className="mission-spark mission-spark-two" />
            <span className="mission-spark mission-spark-three" />
          </div>
          <div className="mission-scene-footer">
            <span>Mission control</span>
            <ArrowUpRight size={17} />
          </div>
        </div>
        <div className="mission-console">
          <div className="mission-console-heading">
            <span>
              <Orbit size={16} aria-hidden="true" />
              Launch setup
            </span>
            {(busy || blocked) && (
              <span className="mission-state" role="status">
                {busy ? "Checking…" : "Blocked"}
              </span>
            )}
          </div>
          <div className="mission-controls">{children}</div>
        </div>
      </div>
      <ol className="mission-route" aria-label="Delivery stages">
        {[
          { label: "Setup", Icon: Crosshair },
          { label: "Build", Icon: Wrench },
          { label: "Review", Icon: ShieldCheck },
          { label: "Ship", Icon: Flag },
        ].map(({ label, Icon }, index) => (
          <li key={label} aria-current={index === 0 ? "step" : undefined}>
            <span className="mission-stage-node">
              <Icon size={17} aria-hidden="true" />
            </span>
            <span className="mission-stage-label">
              <small>0{index + 1}</small>
              {label}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
