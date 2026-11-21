import type { Cockpit, Entity } from "./cockpitTypes";
import { skillUse } from "./skillUseModel";

export function SetupSkillUse({
  entries,
  usage,
  selected,
  onSelect,
}: {
  entries: Entity[];
  usage?: Cockpit["skillUsage"];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="setup-skills-scroll">
      <table className="setup-skills" aria-label="Skill use">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Last used</th>
            <th>Sessions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const use = skillUse(entry, usage);
            return (
              <tr key={entry.id}>
                <td>
                  <button
                    className="setup-entry"
                    data-skill={entry.name || entry.id.split(":").at(-1)}
                    aria-pressed={selected === entry.id}
                    onClick={() => onSelect(entry.id)}
                  >
                    <strong>{entry.name || entry.id}</strong>
                    <small>{entry.disabled ? "Disabled" : "skill"}</small>
                    <code>{entry.source || entry.id}</code>
                    {use.unused && (
                      <span className="setup-skill-unused">Unused</span>
                    )}
                  </button>
                </td>
                <td className="setup-skill-last-used">
                  {use.lastUsed ? (
                    <time dateTime={use.lastUsed}>
                      {use.lastUsed.slice(0, 10)}
                    </time>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="setup-skill-sessions">{use.sessions ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
