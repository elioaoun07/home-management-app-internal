import { Icon } from "./Icon.jsx";

export const Card = ({ children, interactive = false, class: className = "", ...props }) => <div class={`card${interactive ? " interactive" : ""} ${className}`} {...props}>{children}</div>;
export const Chip = ({ children, tone = "" }) => <span class={`chip ${tone}`}>{children}</span>;
export const ProgressBar = ({ value = 0 }) => <div class="progress" aria-label={`${value}% complete`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
export const StatTile = ({ label, value, detail }) => <Card><div class="stat-value">{value}</div><div class="stat-label">{label}</div>{detail && <div class="muted" style={{ fontSize: 11, marginTop: 7 }}>{detail}</div>}</Card>;
export const Kbd = ({ children }) => <kbd class="chip mono">{children}</kbd>;
export const EmptyState = ({ icon = "file", title, children }) => <div class="empty"><Icon name={icon} size={28}/><h3>{title}</h3><div>{children}</div></div>;
export function Modal({ title, children, onClose }) {
  return <div class="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section class="modal" role="dialog" aria-modal="true" aria-label={title}><div class="page-head"><h2>{title}</h2><button class="icon-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button></div>{children}</section></div>;
}

