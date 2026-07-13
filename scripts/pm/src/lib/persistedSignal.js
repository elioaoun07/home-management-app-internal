import { signal } from "@preact/signals";

export function persistedSignal(key, fallback) {
  let initial = fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored != null) initial = JSON.parse(stored);
  } catch {}
  const value = signal(initial);
  value.subscribe((next) => {
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  });
  return value;
}

