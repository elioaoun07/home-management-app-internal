import { Icon } from "./Icon.jsx";
import { useLayoutEffect, useRef } from "preact/hooks";

export const Card = ({ children, interactive = false, class: className = "", ...props }) => <div class={`card${interactive ? " interactive" : ""} ${className}`} {...props}>{children}</div>;
export const Chip = ({ children, tone = "" }) => <span class={`chip ${tone}`}>{children}</span>;
export const ProgressBar = ({ value = 0 }) => <div class="progress" aria-label={`${value}% complete`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
export const StatTile = ({ label, value, detail }) => <Card><div class="stat-value">{value}</div><div class="stat-label">{label}</div>{detail && <div class="muted" style={{ fontSize: 11, marginTop: 7 }}>{detail}</div>}</Card>;
export const Kbd = ({ children }) => <kbd class="chip mono">{children}</kbd>;
export const EmptyState = ({ icon = "file", title, children }) => <div class="empty"><Icon name={icon} size={28}/><h3>{title}</h3><div>{children}</div></div>;
export function Modal({ title, children, onClose }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [...dialog.current.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex="0"]')].filter((node) => !node.disabled && node.getClientRects().length);
    (focusable()[0] || dialog.current).focus();
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key !== "Tab") return;
      const nodes = focusable(), first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); dialog.current.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => { document.removeEventListener("keydown", keydown, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div class="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialog} tabIndex={-1} class="modal" role="dialog" aria-modal="true" aria-label={title}><div class="page-head"><h2>{title}</h2><button class="icon-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button></div>{children}</section></div>;
}
