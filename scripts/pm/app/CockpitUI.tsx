import type { ReactNode } from "react";

export function SectionNav({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string; active?: boolean }[];
}) {
  return (
    <nav className="cockpit-tabs" aria-label={label}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function Metric({
  label,
  value,
  href,
  children,
}: {
  label: string;
  value: ReactNode;
  href: string;
  children?: ReactNode;
}) {
  return (
    <a className="cockpit-metric" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      {children && <small>{children}</small>}
    </a>
  );
}

const words = (text: string) =>
  text.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
/** Human-readable recorded facts; raw export remains available separately. */
export function Evidence({ value }: { value: unknown }) {
  if (value == null) return <span className="quiet">Unrecorded</span>;
  if (typeof value !== "object")
    return (
      <span className="evidence-value">
        {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
      </span>
    );
  if (Array.isArray(value))
    return value.length ? (
      <ul className="evidence-list">
        {value.map((row, i) => (
          <li key={i}>
            <Evidence value={row} />
          </li>
        ))}
      </ul>
    ) : (
      <span className="quiet">No entries</span>
    );
  return (
    <dl className="evidence-facts">
      {Object.entries(value).map(([key, entry]) => (
        <div key={key}>
          <dt>{words(key)}</dt>
          <dd>
            {entry && typeof entry === "object" ? (
              <details>
                <summary>
                  {Array.isArray(entry) ? `${entry.length} entries` : "Details"}
                </summary>
                <Evidence value={entry} />
              </details>
            ) : (
              <Evidence value={entry} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RawEvidence({ value }: { value: unknown }) {
  return (
    <details className="raw-evidence">
      <summary>Raw evidence</summary>
      <pre>{JSON.stringify(value ?? null, null, 2)}</pre>
    </details>
  );
}

export function ScoreNav({ view = "sessions" }: { view?: string }) {
  return (
    <SectionNav
      label="Score views"
      items={[
        { label: "Sessions", href: "#/score", active: view === "sessions" },
        {
          label: "Backlog",
          href: "#/score?view=backlog",
          active: view === "backlog",
        },
        {
          label: "Arena",
          href: "#/score?view=arena",
          active: view === "arena",
        },
      ]}
    />
  );
}
