import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { tracePath } from "./LivePulse";
import { FoundryPortrait } from "./stage/hud/FoundryHud";
import { useBoardNow } from "./stage/clockStore";
import { buildTimeline } from "./localRunScene";
import { clock, liveness } from "./localRunLiveness";
import type { LocalRunView } from "./LocalDelivery";

function PocketClock({
  run,
  state,
  fallback,
}: {
  run?: LocalRunView;
  state: string;
  fallback: string;
}) {
  const now = useBoardNow(),
    timeline = useMemo(() => (run ? buildTimeline(run) : null), [run]);
  const closed =
    run &&
    (["failed", "shipped", "cancelled", "reverted"].includes(run.phase) ||
      run.interrupted);
  const value =
    !timeline || timeline.start === null || state === "link-down"
      ? fallback
      : clock(
          Math.max(0, (closed ? (timeline.end ?? now) : now) - timeline.start),
        );
  return <time>{value}</time>;
}
function PocketCaption({
  run,
  state,
  fallback,
}: {
  run?: LocalRunView;
  state: string;
  fallback: string;
}) {
  const now = useBoardNow();
  return (
    <strong>
      {run && state !== "link-down" ? liveness(run, now).caption : fallback}
    </strong>
  );
}

export interface DocumentPip {
  requestWindow: (options: {
    width: number;
    height: number;
  }) => Promise<Window>;
}

export function documentPip(): DocumentPip | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { documentPictureInPicture?: DocumentPip })
    .documentPictureInPicture;
}

/** A second render target shares recorded facts; it owns no animation clock. */
export function PocketEra({
  target,
  state,
  caption,
  elapsed,
  signals,
  now,
  onClose,
  run,
}: {
  target: Window;
  state: string;
  caption: string;
  elapsed: string;
  signals: number[];
  now: number;
  onClose: () => void;
  run?: LocalRunView;
}) {
  useEffect(() => {
    const onHide = () => onClose();
    const close = () => target.close();
    target.addEventListener("pagehide", onHide);
    window.addEventListener("pagehide", close);
    const theme = new MutationObserver(() => syncPipTheme(target));
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    return () => {
      theme.disconnect();
      target.removeEventListener("pagehide", onHide);
      window.removeEventListener("pagehide", close);
      target.close();
    };
  }, [target, onClose]);
  return createPortal(
    <div className="pocket-era" data-liveness={state}>
      <style>{`
        html,body{margin:0;min-height:100%;background:var(--theme-bg);color:var(--ink);font-family:system-ui,sans-serif}
        .pocket-era{box-sizing:border-box;display:grid;grid-template-columns:1fr auto;align-content:center;gap:10px;padding:14px;height:100vh;overflow:hidden;background:var(--theme-bg);color:var(--accent)}
        .pocket-era-bot{grid-column:1/-1;justify-self:center;width:84px;height:84px;fill:var(--surface);stroke:currentColor;stroke-width:2}
        .pocket-era .foundry-portrait{grid-column:1/-1;justify-self:center;width:84px;height:84px}.pocket-era strong,.pocket-era time{font-size:14px;color:var(--ink);font-variant-numeric:tabular-nums}
        .pocket-era-pulse{grid-column:1/-1;width:100%;height:22px;fill:none;stroke:currentColor;stroke-width:1.5}
        .pocket-era[data-liveness="stale"],.pocket-era[data-liveness="your-turn"],.pocket-era[data-liveness="uat-ready"]{color:var(--warning-ink)}
        .pocket-era[data-liveness="quiet"],.pocket-era[data-liveness="cancelled"],.pocket-era[data-liveness="failed"],.pocket-era[data-liveness="reverted"]{color:var(--ink-muted)}
        .pocket-era[data-liveness="signal-lost"]{opacity:.5}.pocket-era[data-liveness="signal-lost"] .pocket-era-bot{fill:none;stroke-dasharray:4 3}
        .pocket-era[data-liveness="failed"] .pocket-era-bot{stroke-dasharray:18 6}
        .pocket-era[data-liveness="link-down"] .pocket-era-pulse{stroke-dasharray:2 3}
      `}</style>
      <FoundryPortrait state={state} small />
      <PocketCaption run={run} state={state} fallback={caption} />
      <PocketClock run={run} state={state} fallback={elapsed} />
      <svg
        className="pocket-era-pulse"
        viewBox="0 0 280 24"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points={tracePath(
            signals.map((at) => now - (now - at) * 0.4),
            now,
            280,
            24,
          )}
        />
      </svg>
    </div>,
    target.document.body,
  );
}

export function copyPipStyles(target: Window) {
  target.document.title = "Pocket ERA";
  for (const sheet of document.querySelectorAll(
    'link[rel="stylesheet"], style',
  )) {
    target.document.head.append(sheet.cloneNode(true));
  }
  syncPipTheme(target);
}

function syncPipTheme(target: Window) {
  const currentTheme = document.documentElement.dataset.theme;
  if (currentTheme)
    target.document.documentElement.dataset.theme = currentTheme;
  else delete target.document.documentElement.dataset.theme;
  target.document.documentElement.className =
    document.documentElement.className;
  target.document.body.className = document.body.className;
  const style = getComputedStyle(document.documentElement);
  for (const token of [
    "--accent",
    "--theme-bg",
    "--surface",
    "--ink",
    "--ink-muted",
    "--line",
    "--warning-ink",
  ]) {
    target.document.documentElement.style.setProperty(
      token,
      style.getPropertyValue(token),
    );
  }
}
