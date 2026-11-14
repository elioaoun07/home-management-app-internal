import { useRoute, useWorld } from "./state";
import { PageTitle } from "./components";
import { sessionHref } from "./cockpitModel";
import { compareArena } from "./arenaModel";
import spec from "../../os/cases/kit11.json";
import { ScoreNav, Evidence, RawEvidence } from "./CockpitUI";

export function Arena() {
  const { world } = useWorld(),
    route = useRoute();
  const records =
    world.cockpit?.records.filter((r) => r.session.arena?.caseId === spec.id) ||
    [];
  const selected = ["left", "right"].map((key) =>
    records.find((r) => r.session.id === route.query.get(key)),
  );
  const comparison = compareArena(selected[0], selected[1]);
  const choose = (key: string, id: string) => {
    const q = new URLSearchParams(route.query);
    if (id) q.set(key, id);
    else q.delete(key);
    location.hash = `/score?${q}`;
  };
  return (
    <div className="cockpit">
      <PageTitle title="Arena" />
      <ScoreNav view="arena" />
      <section className="cockpit-panel">
        <h2>
          {spec.id} · {spec.title}
        </h2>
        <details>
          <summary>Case</summary>
          <p>{spec.brief}</p>
          <code>{spec.start}</code>
          <p>Scope · {spec.paths.join(", ")}</p>
        </details>
        <span role="status">Native launch blocked</span>
        <details>
          <summary>Launch boundary</summary>
          <p>
            Current native adapters cannot enforce a hidden oracle outside the
            worktree.
          </p>
          <code>pnpm os:arena controls KIT-11</code>
        </details>
      </section>
      <div className="compare-grid">
        {["left", "right"].map((key, index) => {
          const record = selected[index],
            s = record?.session;
          return (
            <section className="cockpit-panel" key={key}>
              <label>
                {index === 0 ? "Claude" : "Codex"}
                <select
                  className="arena-select"
                  aria-label={index === 0 ? "Claude run" : "Codex run"}
                  value={s?.id || ""}
                  onChange={(e) => choose(key, e.target.value)}
                >
                  <option value="">Select run</option>
                  {records
                    .filter(
                      (r) =>
                        r.session.agent === (index === 0 ? "claude" : "codex"),
                    )
                    .map((r) => (
                      <option key={r.session.id} value={r.session.id}>
                        {r.session.tier} · {r.session.id}
                      </option>
                    ))}
                </select>
              </label>
              {!s ? (
                <p>No run selected · n=0</p>
              ) : (
                <>
                  <h2>{s.tier} · n=1</h2>
                  <a href={sessionHref(s.id)}>Flight report</a>
                  <p>Oracle · {s.arena?.oracleVerdict || "unknown"}</p>
                  <p>
                    {s.effort || "Effort unrecorded"} ·{" "}
                    {s.setup?.fingerprint || "Setup unrecorded"}
                  </p>
                  {(
                    [
                      "rules",
                      "checks",
                      "process",
                      "scope",
                      "autonomy",
                      "cost",
                    ] as const
                  ).map((panel) => (
                    <details key={panel}>
                      <summary>{panel}</summary>
                      <Evidence value={s.scorecard?.[panel]} />
                      <RawEvidence value={s.scorecard?.[panel]} />
                    </details>
                  ))}
                </>
              )}
            </section>
          );
        })}
      </div>
      <details className="cockpit-panel" open>
        <summary>
          {comparison.comparable
            ? "Same frozen case · raw evidence"
            : "Comparison unavailable"}
        </summary>
        {comparison.reasons.map((r) => (
          <p key={r}>{r}</p>
        ))}
      </details>
    </div>
  );
}
