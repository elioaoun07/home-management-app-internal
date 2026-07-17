import { signal } from "@preact/signals";

// Reactive "phone-width viewport" flag. 700px matches the mobile.css breakpoint.
const query = typeof matchMedia === "function" ? matchMedia("(max-width: 700px)") : null;
export const isCompact = signal(Boolean(query?.matches));
query?.addEventListener("change", (event) => { isCompact.value = event.matches; });
