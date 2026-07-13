import { useEffect, useRef, useState } from "preact/hooks";

export function DropdownMenu({ label = "Actions", children }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => { const close = (event) => !ref.current?.contains(event.target) && setOpen(false); addEventListener("pointerdown", close); return () => removeEventListener("pointerdown", close); }, []);
  return <div ref={ref} style={{ position: "relative" }}><button class="button" onClick={() => setOpen(!open)}>{label}</button>{open && <div class="card" style={{ position:"absolute", zIndex:30, right:0, top:"calc(100% + 6px)", minWidth:180, background:"var(--era-bg-elevated)" }} onClick={() => setOpen(false)}>{children}</div>}</div>;
}

