import { navigate } from "../../app/router.js";

export function Breadcrumbs({ items = [] }) {
  return <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/">PM</a>{items.map((item) => <span key={item.label}>› {item.href ? <a href={`#${item.href}`}>{item.label}</a> : item.label}</span>)}</nav>;
}

