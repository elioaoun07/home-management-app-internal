import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const RoomSettled = createContext<(() => void) | undefined>(undefined);
export const useRoomSettled = () => useContext(RoomSettled);

export function LibraryEyelids({ closing = false, opening = false, onOpened }: {
  closing?: boolean; opening?: boolean; onOpened?: () => void;
}) {
  return createPortal(<div className={`library-eyes ${closing ? "departing" : opening ? "arriving" : "waiting"}`}
    aria-hidden="true" onAnimationEnd={onOpened}>
    <span /><span />
  </div>, document.body);
}

/** Keep the cut across the authenticated run read and optional 3D chunk. */
export function LibraryArrival({ active, error, children }: { active: boolean; error: boolean; children: ReactNode }) {
  const [settled, setSettled] = useState(false);
  const [finished, setFinished] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const settle = useCallback(() => setSettled(true), []);
  const opening = settled || error;
  useEffect(() => {
    if (!active || finished || opening) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setFinished(true); return; }
    const timer = window.setTimeout(() => setWaiting(true), 800);
    return () => clearTimeout(timer);
  }, [active, finished, opening]);
  return <RoomSettled.Provider value={active ? settle : undefined}>
    {children}
    {active && !finished && <>
      <LibraryEyelids opening={opening} onOpened={() => setFinished(true)} />
      {waiting && !opening && createPortal(<div className="library-transfer-wait">
        <span role="status">Opening delivery room…</span>
        <button type="button" onClick={() => setFinished(true)}>Skip transition</button>
      </div>, document.body)}
    </>}
  </RoomSettled.Provider>;
}
