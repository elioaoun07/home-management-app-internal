import { useId } from "react";
import { ArrowUpRight } from "lucide-react";
import { ERAMark } from "@/components/shared/ERAMark";
import type { coreSessionState } from "./coreState";
import { useCoreMotion } from "./useCoreMotion";
import "./core-motion.css";

type CoreStatus = ReturnType<typeof coreSessionState>;

/** Game-only visual feedback. The throttle never issues a session command. */
export function EraCore({
  status,
  uncertain,
}: {
  status: CoreStatus;
  uncertain: boolean;
}) {
  const { section, throttle } = useCoreMotion(status.state);
  const captionId = useId();

  return (
    <section
      ref={section}
      className="bridge-core era-session-core"
      aria-label="Bridge status"
      data-state={status.state}
    >
      <span className="bridge-kicker">ERA · Agentic OS</span>
      <button
        type="button"
        className="bridge-orbit core-throttle"
        aria-label="Throttle ERA"
        aria-describedby={captionId}
        title="Throttle"
        onClick={throttle}
      >
        <span className="core-wheel" aria-hidden="true">
          <span className="core-heat" />
          <span className="core-friction-halo" />
          <svg
            viewBox="0 0 300 300"
            className="bridge-orbit-lines core-wheel-lines"
          >
            <circle className="orbit-guide" cx="150" cy="150" r="140" />
            <g className="core-rotor">
              <circle
                className="orbit-arc"
                cx="150"
                cy="150"
                r="114"
                pathLength="100"
              />
              <circle className="orbit-node" cx="150" cy="10" r="4" />
              <circle className="orbit-node" cx="150" cy="290" r="4" />
            </g>
            <g className="core-counter-rotor">
              <ellipse
                className="orbit-inner"
                cx="150"
                cy="150"
                rx="103"
                ry="82"
                pathLength="100"
              />
            </g>
            <g className="core-split-ring">
              <path
                d="M150 36 A114 114 0 0 1 150 264"
                transform="translate(7 -7)"
              />
              <path
                d="M150 264 A114 114 0 0 1 150 36"
                transform="translate(-7 7)"
              />
            </g>
            <path
              className="orbit-crosshair"
              d="M0 150h20m260 0h20M150 0v20m0 260v20"
            />
          </svg>
          <span className="core-hub">
            <ERAMark module="memory" size={112} />
            <span className="bridge-core-wordmark">era</span>
          </span>
          <canvas className="core-exhaust" />
        </span>
      </button>
      <div className="bridge-core-caption" role="status" id={captionId}>
        <span className="bridge-kicker">{status.unit}</span>
        <strong>
          {status.value !== null && <span>{status.value} </span>}
          {status.label}
        </strong>
        {uncertain && status.value !== null && <small>Status incomplete</small>}
      </div>
      <a className="bridge-core-link" href="#/sessions?view=delivery">
        Open sessions <ArrowUpRight size={15} />
      </a>
    </section>
  );
}
