import {
  Check,
  Circle,
  CircleDot,
  CirclePause,
  GitCommitHorizontal,
} from "lucide-react";
import type { LocalAct, LocalRunView } from "./LocalDelivery";
import { LocalActions } from "./LocalWorkflow";
import { LocalAcceptance } from "./LocalAcceptance";
import { OwnerDiff } from "./OwnerDiff";
import {
  OWNER_STATIONS,
  needsManualCommit,
  ownerStationState,
  type OwnerStation,
} from "./ownerStations";
import "./owner-stations.css";

const statusText = {
  done: "Complete",
  pending: "Waiting",
  current: "Your turn",
  stopped: "Blocked",
  optional: "Optional",
};
const dependsOn: Record<OwnerStation, string> = {
  test: "Awaiting test handover",
  review: "Awaiting candidate",
  merge: "Complete Test and any required Review",
  commit: "Available after Merge",
  push: "Available after Commit",
  cleanup: "Available after the session ends",
};

function TestEvidence({ run }: { run: LocalRunView }) {
  if (!run.handover) return <p className="quiet">{dependsOn.test}</p>;
  return (
    <div className="owner-test-evidence">
      {run.handover.scenarios?.map((scenario) => (
        <details key={scenario.id}>
          <summary>
            <span>{scenario.title}</span>
            <small>{scenario.result}</small>
          </summary>
          <ol>
            {scenario.steps.map((step, index) => (
              <li key={index}>
                <strong>{step.action}</strong>
                {step.expected && <p>{step.expected}</p>}
              </li>
            ))}
          </ol>
          {scenario.receipt?.note && <p>{scenario.receipt.note}</p>}
        </details>
      ))}
      {run.handover.signoff && (
        <small>Signed off · {run.handover.signoff.actor}</small>
      )}
    </div>
  );
}

function Receipt({ name, value }: { name: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="owner-receipt">
      <span>{name}</span>
      <code>{value}</code>
    </div>
  );
}

export function OwnerStationDetail({
  run,
  station,
  busy,
  act,
  patch,
  readOnly = false,
  onPatchViewed,
  onSelectStation,
}: {
  run: LocalRunView;
  station: OwnerStation;
  busy: boolean;
  act: LocalAct;
  patch: string | null;
  readOnly?: boolean;
  onPatchViewed?: (patch: string | null) => void;
  onSelectStation?: (station: OwnerStation) => void;
}) {
  const label = OWNER_STATIONS.find((entry) => entry.id === station)!.label;
  const state = ownerStationState(run, station);
  const status =
    state === "done" ? (
      <Check />
    ) : state === "stopped" ? (
      <CirclePause />
    ) : state === "current" ? (
      <CircleDot />
    ) : (
      <Circle />
    );
  const actions = (reviewAvailable: boolean) =>
    !readOnly && (
      <LocalActions
        key={station}
        run={run}
        station={station}
        busy={busy}
        act={act}
        reviewAvailable={reviewAvailable}
        onSelectStation={onSelectStation}
      />
    );
  const comparison = station === "review" || station === "merge";
  return (
    <section className="owner-station-detail" aria-label={label + " station"}>
      <header className="owner-station-heading">
        <h2>{label}</h2>
        <span className="owner-stage-status" data-state={state}>
          {status}
          {station === "commit" && needsManualCommit(run)
            ? "Manual"
            : statusText[state]}
        </span>
      </header>
      {station === "test" && <LocalAcceptance run={run} busy={busy} act={act} readOnly={readOnly} />}
      {station === "test" && !["accepting", "acceptance-paused", "stopped"].includes(run.phase) && <TestEvidence run={run} />}
      {/* An unmerged candidate can be thrown away from where the owner judges it; Clean up owns the preview. */}
      {station === "test" && !readOnly && onSelectStation && run.phase === "uat-ready" && !run.applied && !run.merge_pending && !run.cleaned_at && (
        <div className="gate-actions">
          <button className="secondary" disabled={busy} onClick={() => onSelectStation("cleanup")}>Discard</button>
        </div>
      )}
      {station === "review" && !!run.risk?.flagged.length && (
        <details>
          <summary>
            Flagged files <small>{run.risk.flagged.length}</small>
          </summary>
          <ul>
            {run.risk.flagged.map((file) => (
              <li key={file.path}>
                <code>{file.path}</code> · {file.domains.join(", ")}
              </li>
            ))}
          </ul>
        </details>
      )}
      {station === "merge" && run.applied && (
        <Receipt
          name="Merged into"
          value={run.applied.main_head?.slice(0, 12)}
        />
      )}
      {station === "merge" && state === "pending" && run.head && (
        <p className="quiet">{dependsOn.merge}</p>
      )}
      {station === "commit" && run.committed && (
        <div className="owner-commit-receipt">
          <GitCommitHorizontal size={18} />
          <Receipt name="Commit" value={run.committed.sha} />
        </div>
      )}
      {station === "push" && run.pushed && (
        <>
          <Receipt
            name="Destination"
            value={run.pushed.remote + "/" + run.pushed.branch}
          />
          <Receipt name="Commit" value={run.pushed.sha} />
        </>
      )}
      {station === "cleanup" && (
        <Receipt
          name={run.cleaned_at ? "Archive" : "Worktree"}
          value={run.cleaned_at ? run.cleanup_archive : run.workspace}
        />
      )}
      {(station === "commit" || station === "push") &&
        state === "pending" &&
        run.publication?.action !== station && (
          <p className="quiet">{dependsOn[station]}</p>
        )}
      {station === "cleanup" &&
        state === "pending" &&
        ["preparing", "building", "checking", "accepting"].includes(run.phase) && (
          <p className="quiet">{dependsOn.cleanup}</p>
        )}
      {comparison && !readOnly ? (
        <OwnerDiff
          run={run}
          patch={patch}
          actions={actions}
          onPatchViewed={onPatchViewed}
          against={station === "merge" && state !== "done" ? "repo" : "base"}
        />
      ) : comparison && readOnly ? (
        <p className="quiet">Comparison available in Live</p>
      ) : (
        actions(false)
      )}
    </section>
  );
}
