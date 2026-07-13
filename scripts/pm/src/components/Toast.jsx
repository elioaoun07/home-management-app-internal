import { dismissToast, toasts } from "../app/store.js";

export function ToastHost() {
  return <div class="toast-host" aria-live="polite">{toasts.value.map((toast) => <div class={`toast ${toast.type}`} key={toast.id}><span>{toast.message}</span>{toast.action && <button class="button ghost" onClick={() => { toast.action.run(); dismissToast(toast.id); }}>{toast.action.label}</button>}<button class="icon-button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">×</button></div>)}</div>;
}

