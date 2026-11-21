import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Award, Settings2 } from "lucide-react";
import { GameToggle } from "../../GameLayer";

export interface SettingsMenuProps {
  tempo: 0.75 | 1 | 1.5;
  onTempo?: (tempo: 0.75 | 1 | 1.5) => void;
  rank: boolean;
  onRank: () => void;
  controls?: ReactNode;
  showTempo?: boolean;
}

export function SettingsMenu({
  tempo,
  onTempo,
  rank,
  onRank,
  controls,
  showTempo = true,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const box = trigger.current.getBoundingClientRect(),
      computed = getComputedStyle(trigger.current);
    const tokens = Object.fromEntries(
      [
        "--theme-bg",
        "--surface",
        "--surface-soft",
        "--ink",
        "--ink-muted",
        "--accent",
        "--line",
        "--warning-ink",
        "--font-mono",
      ].map((name) => [name, computed.getPropertyValue(name)]),
    );
    setStyle({
      ...tokens,
      top: box.bottom + 8,
      right: Math.max(12, innerWidth - box.right),
    });
    panel.current
      ?.querySelector<HTMLElement>("select,button")
      ?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="board-settings-trigger"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Settings2 size={18} />
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panel}
            className="board-settings-panel"
            role="dialog"
            aria-label="Settings"
            style={style}
            hidden={!open}
          >
            {showTempo && <label className="board-tempo">
              <span>Tempo</span>
              <select
                aria-label="Tempo"
                value={tempo}
                onChange={(event) =>
                  onTempo?.(Number(event.target.value) as 0.75 | 1 | 1.5)
                }
              >
                <option value={0.75}>0.75×</option>
                <option value={1}>1×</option>
                <option value={1.5}>1.5×</option>
              </select>
            </label>}
            <GameToggle />
            <button
              type="button"
              role="switch"
              aria-label="Rank"
              aria-checked={rank}
              onClick={onRank}
            >
              <Award size={17} />
              <span>Rank</span>
            </button>
            {controls}
          </div>,
          document.fullscreenElement ?? document.body,
        )}
    </>
  );
}
