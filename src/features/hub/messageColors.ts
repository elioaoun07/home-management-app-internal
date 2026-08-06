// Fixed preset palette for per-message color tags (HUB-11). No color has a
// fixed meaning — the household assigns whatever it means to them (e.g. one
// color per person, or transfer vs expense) — so labels here are just the
// swatch name, not a category.

export const MESSAGE_COLOR_PALETTE = [
  { key: "rose", hex: "#fb7185", label: "Rose" },
  { key: "orange", hex: "#fb923c", label: "Orange" },
  { key: "amber", hex: "#fbbf24", label: "Amber" },
  { key: "lime", hex: "#a3e635", label: "Lime" },
  { key: "emerald", hex: "#34d399", label: "Emerald" },
  { key: "cyan", hex: "#22d3ee", label: "Cyan" },
  { key: "indigo", hex: "#818cf8", label: "Indigo" },
  { key: "fuchsia", hex: "#e879f9", label: "Fuchsia" },
] as const;

export type MessageColorKey = (typeof MESSAGE_COLOR_PALETTE)[number]["key"];

export const MESSAGE_COLOR_KEYS = MESSAGE_COLOR_PALETTE.map((c) => c.key);

export function isMessageColorKey(value: unknown): value is MessageColorKey {
  return (
    typeof value === "string" &&
    (MESSAGE_COLOR_KEYS as string[]).includes(value)
  );
}

export function getMessageColorHex(
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  return MESSAGE_COLOR_PALETTE.find((c) => c.key === key)?.hex ?? null;
}
