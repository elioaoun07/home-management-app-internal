export function FoundryPortrait({
  state = "live",
  small = false,
}: {
  state?: string;
  small?: boolean;
}) {
  return (
    <svg
      className={`foundry-portrait board-portrait${small ? " foundry-portrait-small" : ""}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      data-state={state}
    >
      <path
        fill="var(--board-hull-top, var(--ink-muted))"
        d="M50 9 83 27 83 72 50 92 17 72 17 27Z"
      />
      <path
        fill="var(--board-hull-left, var(--surface-soft))"
        d="m17 27 33 20v45L17 72Z"
      />
      <path
        fill="var(--board-hull-right, var(--line))"
        d="m50 47 33-20v45L50 92Z"
      />
      <rect
        x="23"
        y="34"
        width="54"
        height="31"
        rx="11"
        fill="var(--theme-bg)"
      />
      <g className="portrait-eyes" fill="var(--accent)">
        <rect x="33" y="45" width="11" height="8" rx="4" />
        <rect x="56" y="45" width="11" height="8" rx="4" />
      </g>
      <rect
        x="47"
        y="1"
        width="6"
        height="12"
        fill="var(--board-hull-left, var(--ink-muted))"
      />
      <circle cx="50" cy="3" r="3" fill="var(--accent)" />
    </svg>
  );
}
