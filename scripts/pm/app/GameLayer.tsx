import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { useWorld } from "./state";
import { Orbit } from "lucide-react";
import { gameFacts } from "./gameModel";
import { sessionHref, setupConflictCount } from "./cockpitModel";
import "./game.css";

type GameTransition = "enter" | "exit" | null;
const GameContext = createContext<{
  enabled: boolean;
  toggle: () => void;
  transitioning: GameTransition;
}>({ enabled: false, toggle: () => {}, transitioning: null });
export const useGameLayer = () => useContext(GameContext);

export function GameProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("pm-game-layer") === "on";
    } catch {
      return false;
    }
  });
  const [transition, setTransition] = useState(0);
  const [transitioning, setTransitioning] = useState<GameTransition>(null);
  useEffect(() => {
    if (!transitioning) return;
    const timeout = setTimeout(
      () => setTransitioning(null),
      transitioning === "enter" ? 1800 : 1000,
    );
    return () => clearTimeout(timeout);
  }, [transition, transitioning]);
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setTransition((n) => n + 1);
    setTransitioning(next ? "enter" : "exit");
    try {
      localStorage.setItem("pm-game-layer", next ? "on" : "off");
    } catch {
      /* session-only preference */
    }
  };
  return (
    <GameContext.Provider value={{ enabled, toggle, transitioning }}>
      <div
        className="game-shell"
        data-game={enabled}
        data-transition={transitioning || undefined}
      >
        {transitioning && (
          <div
            key={transition}
            className="game-activation"
            data-direction={transitioning}
            aria-hidden="true"
          >
            <span className="game-aperture" />
            <span className="game-sweep" />
          </div>
        )}
        {children}
      </div>
    </GameContext.Provider>
  );
}

export function GameToggle() {
  const { enabled, toggle } = useGameLayer();
  const gradientId = useId();
  const iconStroke = `url(#${gradientId})`;
  return (
    <button
      className="icon-button game-toggle-icon"
      role="switch"
      aria-label="Game layer"
      aria-checked={enabled}
      title={enabled ? "Game layer on" : "Game layer off"}
      onClick={toggle}
    >
      <Orbit
        className="game-toggle-svg"
        size={19}
        stroke={iconStroke}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="4"
            y1="19"
            x2="20"
            y2="5"
            gradientUnits="userSpaceOnUse"
          >
            <stop className="game-toggle-stop game-toggle-stop-start" />
            <stop
              className="game-toggle-stop game-toggle-stop-mid"
              offset="0.56"
            />
            <stop
              className="game-toggle-stop game-toggle-stop-end"
              offset="1"
            />
          </linearGradient>
        </defs>
      </Orbit>
    </button>
  );
}

export function GameSetting() {
  const { enabled, toggle } = useGameLayer();
  return (
    <section className="settings-card game-setting">
      <h3>Game layer</h3>
      <button
        className="secondary"
        role="switch"
        aria-label="Game layer"
        aria-checked={enabled}
        onClick={toggle}
      >
        {enabled ? "On" : "Off"}
      </button>
    </section>
  );
}

// The calm view renders precisely the same numbers and evidence, with plain labels.
export function GameLayer() {
  const { world } = useWorld(),
    { enabled } = useGameLayer();
  const data = world.cockpit;
  if (!data || data.pending) return null;
  const facts = gameFacts(data);
  return (
    <section
      className="game-facts"
      data-game={enabled}
      aria-label="Measured progress"
    >
      <details className="cockpit-panel">
        <summary>
          <span>{enabled ? "Clean streak" : "Consecutive clean sessions"}</span>
          <strong>{facts.unordered ? "—" : facts.streak.length}</strong>
        </summary>
        {facts.unordered && <span>Session order unrecorded</span>}
        {facts.streak.map((r) => (
          <a
            className="session-identity"
            href={sessionHref(r.session.id)}
            key={r.session.id}
          >
            {r.session.id}
          </a>
        ))}
        {facts.boundary && (
          <a
            className="session-identity"
            href={sessionHref(facts.boundary.session.id)}
          >
            Boundary · {facts.boundary.session.id}
          </a>
        )}
        {!data.records.length && <span>No sessions recorded</span>}
      </details>
      <details className="cockpit-panel">
        <summary>
          <span>{enabled ? "Shield wall" : "Guarded rules"}</span>
          <strong>
            {data.setup ? `${facts.guarded.length}/${facts.rules.length}` : "—"}
          </strong>
        </summary>
        {facts.rules.map((r) => (
          <a
            className="session-identity"
            key={r.id}
            href={`#/setup?tab=map&rule=${r.id}`}
          >
            {r.id} · {r.level || "unknown"}
          </a>
        ))}
      </details>
      <details className="cockpit-panel">
        <summary>
          <span>
            {enabled && data.setup && setupConflictCount(data.conflicts) === 0
              ? "Zero conflicts"
              : "Setup conflicts"}
          </span>
          <strong>{data.setup ? setupConflictCount(data.conflicts) : "—"}</strong>
        </summary>
        <a href="#/setup?tab=conflicts">Evidence</a>
        {data.stale && <span>Saved snapshot</span>}
        {data.conflicts.filter(r => ["error", "warning"].includes(r.severity)).map((r, i) => (
          <p key={i}>
            {r.severity} · {r.source} · {r.message}
          </p>
        ))}
      </details>
      <details className="cockpit-panel">
        <summary>{enabled ? "Debt bosses" : "Recorded baseline debt"}</summary>
        {!facts.debt.length && <span>Baseline unrecorded</span>}
        {facts.debt.map((d) => (
          <div key={d.id}>
            <a href="#/setup?tab=rulebook">
              {d.id} · {d.baseline}
            </a>
            <meter
              min={0}
              max={Math.max(1, d.baseline || 0)}
              value={d.baseline || 0}
              aria-label={d.id}
            />
            <code>{d.source}</code>
          </div>
        ))}
      </details>
      <details className="cockpit-panel">
        <summary>{enabled ? "Parity quest" : "Setup coverage"}</summary>
        {facts.parity.map((p) => (
          <div key={p.agent}>
            <a className="session-identity" href="#/setup?tab=map">
              {p.agent} ·{" "}
              {p.recorded ? `${p.covered.length}/${p.total}` : "unrecorded"}
            </a>
            {p.covered.map((r) => (
              <a key={r.id} href={`#/setup?tab=map&rule=${r.id}`}>
                {r.id}{" "}
              </a>
            ))}
          </div>
        ))}
      </details>
    </section>
  );
}
