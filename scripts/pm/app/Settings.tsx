// Delivery Settings (2026-09-19): the owner's token allowances — the shared
// allowance (today or until reset), the default per-task allowance, and a top-up
// or reset for each open task, including one that is running. Changes are recorded
// server-side (`.delivery/v2/allowances.json`) and apply before the next job step.
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Info, RotateCcw } from "lucide-react";
import { v2Post } from "./api";
import { client, pmKeys, useWorld } from "./state";
import { transport } from "./transport";
import { Empty, ErrorNotice, Sheet } from "./components";
import { PairV2, useV2Session } from "./DeliveryV2";
import { TestGateCard, useTestGate } from "./TestGate";
import { compact } from "./deliveryReviewModel";
import type { V2AllowanceRun, V2Allowances } from "./types";

const STEPS = [50_000, 100_000, 250_000];
const RUN_STEPS = [25_000, 50_000, 100_000];

const commandId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "c-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

export { compact };

const full = (value: number | null) => (value == null ? "—" : value.toLocaleString());

/** "Since 00:00", "Since Sep 19, 14:02" or "All time". */
export function sinceLabel(since: string | null, now = new Date()) {
  if (!since) return "All time";
  const at = new Date(since);
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return at.toDateString() === now.toDateString()
    ? "Since " + time
    : "Since " + at.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + time;
}

/** Whole tokens from what the owner typed: "250000", "250,000", "250k", "1.5m". */
export function parseAmount(text: string): number | null {
  const match = text.trim().toLowerCase().replace(/[,\s_]/gu, "").match(/^(\d+(?:\.\d+)?)([km]?)$/u);
  if (!match) return null;
  const value = Math.round(Number(match[1]) * (match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1));
  return Number.isInteger(value) && value > 0 && value <= 50_000_000 ? value : null;
}

function useAllowances(enabled: boolean) {
  return useQuery({
    queryKey: pmKeys.v2allowances,
    queryFn: ({ signal }) => transport().v2Allowances(signal),
    enabled,
    refetchInterval: 5000,
  });
}

function useAllowanceChange() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      v2Post<{ ok: boolean; allowances: V2Allowances }>("allowances", { ...body, command_id: commandId() }),
    onSuccess: (data) => {
      client.setQueryData(pmKeys.v2allowances, data.allowances);
      void client.invalidateQueries({ queryKey: pmKeys.v2queue });
      void client.invalidateQueries({ queryKey: pmKeys.v2runs });
      void client.invalidateQueries({ queryKey: ["pm-app", "v2", "run"] });
    },
  });
}

function Meter({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  const over = limit != null && used > limit ? used - limit : null;
  return (
    <div className="allowance-meter" data-over={over != null}>
      <div className="allowance-figures">
        <strong>{full(used)}</strong>
        <span>/ {limit == null ? "No limit" : full(limit)}</span>
        {over != null && <b>+{over.toLocaleString()}</b>}
      </div>
      {limit != null && (
        <div className="allowance-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)}>
          <i style={{ width: Math.min(100, (used / limit) * 100) + "%" }} />
        </div>
      )}
    </div>
  );
}

function LimitForm({
  value,
  placeholder,
  busy,
  onSave,
  onClear,
  clearLabel,
}: {
  value: number | null;
  placeholder: string;
  busy: boolean;
  onSave: (limit: number) => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  const [text, setText] = useState("");
  const parsed = parseAmount(text);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (parsed != null) {
      onSave(parsed);
      setText("");
    }
  };
  return (
    <form className="allowance-form" onSubmit={submit}>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Limit"
        placeholder={value == null ? placeholder : value.toLocaleString()}
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-invalid={text.trim() !== "" && parsed == null}
      />
      <button className="primary" disabled={parsed == null || busy}>
        Set
      </button>
      {onClear && (
        <button type="button" className="text-button" disabled={busy} onClick={onClear}>
          {clearLabel}
        </button>
      )}
    </form>
  );
}

function RunRow({ run, busy, change }: { run: V2AllowanceRun; busy: boolean; change: (body: Record<string, unknown>) => void }) {
  return (
    <li className="allowance-run" data-running={run.running}>
      <div className="allowance-run-head">
        <span className="allowance-run-id">
          {run.running && <i className="live-dot" aria-label="Running" />}
          {run.alias || run.run_id}
        </span>
        <span className="allowance-run-title">{run.title}</span>
      </div>
      <Meter used={run.used} limit={run.allowance} label={(run.alias || run.run_id) + " allowance"} />
      {run.allowance != null && (
        <div className="allowance-actions">
          {RUN_STEPS.map((step) => (
            <button key={step} className="allowance-chip" disabled={busy} onClick={() => change({ action: "run-add", run_id: run.run_id, amount: step })}>
              +{compact(step)}
            </button>
          ))}
          <button
            className="allowance-chip"
            disabled={busy || run.used === 0}
            aria-label={"Reset " + (run.alias || run.run_id)}
            title="Reset"
            onClick={() => change({ action: "run-reset", run_id: run.run_id })}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      )}
    </li>
  );
}

function historyLine(entry: V2Allowances["history"][number]) {
  const d = entry.detail || {};
  const amount = (value: unknown) => (typeof value === "number" ? compact(value) : "policy");
  switch (entry.action) {
    case "fleet":
      return "Shared · " + amount(d.limit) + (d.period === "day" ? " / day" : "");
    case "fleet-reset":
      return "Shared · reset";
    case "task":
      return "Per task · " + amount(d.limit);
    case "run-add":
      return String(d.run_id) + " · +" + amount(d.amount);
    case "run-reset":
      return String(d.run_id) + " · reset";
    default:
      return entry.action;
  }
}

function SettingsBody({ data }: { data: V2Allowances }) {
  const change = useAllowanceChange();
  const gate = useTestGate();
  const busy = change.isPending;
  const send = (body: Record<string, unknown>) => change.mutate(body);
  const { fleet, task } = data;
  return (
    <div className="settings-body">
      {!data.readable && <ErrorNotice error={new Error("Settings file unreadable — policy amounts apply")} />}
      <ErrorNotice error={change.error} />

      {gate.data?.application && (
        <section className="settings-card" aria-labelledby="settings-tests">
          <header>
            <h3 id="settings-tests">Tests</h3>
          </header>
          <TestGateCard gate={gate.data} />
        </section>
      )}

      <section className="settings-card" aria-labelledby="settings-shared">
        <header>
          <h3 id="settings-shared">Shared</h3>
          <div className="segmented" role="radiogroup" aria-label="Window">
            {(["day", "reset"] as const).map((period) => (
              <button
                key={period}
                role="radio"
                aria-checked={fleet.period === period}
                disabled={busy}
                onClick={() => fleet.period !== period && send({ action: "fleet", limit: fleet.source === "settings" ? fleet.limit : null, period })}
              >
                {period === "day" ? "Today" : "Until reset"}
              </button>
            ))}
          </div>
        </header>
        <small className="settings-since">{sinceLabel(fleet.since)}</small>
        <Meter used={fleet.used} limit={fleet.limit} label="Shared allowance" />
        <div className="allowance-actions">
          {fleet.limit != null &&
            STEPS.map((step) => (
              <button key={step} className="allowance-chip" disabled={busy} onClick={() => send({ action: "fleet", limit: (fleet.limit || 0) + step, period: fleet.period })}>
                +{compact(step)}
              </button>
            ))}
          <button className="allowance-chip" disabled={busy} onClick={() => send({ action: "fleet-reset" })}>
            <RotateCcw size={14} /> Reset
          </button>
        </div>
        <LimitForm
          value={fleet.limit}
          placeholder="No limit"
          busy={busy}
          onSave={(limit) => send({ action: "fleet", limit, period: fleet.period })}
          onClear={fleet.source === "settings" ? () => send({ action: "fleet", limit: null, period: fleet.period }) : undefined}
          clearLabel={fleet.policyLimit == null ? "Remove" : "Policy " + compact(fleet.policyLimit)}
        />
      </section>

      <section className="settings-card" aria-labelledby="settings-task">
        <header>
          <h3 id="settings-task">Per task</h3>
          <strong className="settings-value">{full(task.limit ?? task.policyLimit)}</strong>
        </header>
        <LimitForm
          value={task.limit ?? task.policyLimit}
          placeholder="No limit"
          busy={busy}
          onSave={(limit) => send({ action: "task", limit })}
          onClear={task.limit != null ? () => send({ action: "task", limit: null }) : undefined}
          clearLabel={task.policyLimit == null ? "Remove" : "Policy " + compact(task.policyLimit)}
        />
      </section>

      <section className="settings-card" aria-labelledby="settings-tasks">
        <header>
          <h3 id="settings-tasks">Open tasks</h3>
          <span
            className="settings-info"
            tabIndex={0}
            role="note"
            aria-label="Changes apply before the next step"
            title="Changes apply before the next step"
          >
            <Info size={15} />
          </span>
        </header>
        {data.runs.length ? (
          <ul className="allowance-runs">
            {data.runs.map((run) => (
              <RunRow key={run.run_id} run={run} busy={busy} change={send} />
            ))}
          </ul>
        ) : (
          <p className="settings-empty">None</p>
        )}
      </section>

      {!!data.history.length && (
        <section className="settings-card settings-history" aria-labelledby="settings-history">
          <header>
            <h3 id="settings-history">Recent</h3>
          </header>
          <ul>
            {data.history.map((entry, index) => (
              <li key={(entry.command_id || "") + index}>
                <span>{historyLine(entry)}</span>
                <time dateTime={entry.at}>{sinceLabel(entry.at).replace("Since ", "")}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connected } = useWorld();
  const session = useV2Session();
  const paired = !!session.data?.paired;
  const query = useAllowances(open && connected && paired);
  let body;
  if (!connected) body = <Empty title="Offline" />;
  else if (session.data && !paired && transport().capabilities.pairing) body = <PairV2 />;
  else if (query.error) body = <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  else if (query.isSuccess && !query.data) body = <Empty title="On the laptop" />;
  else if (!query.data) body = <div className="settings-loading" aria-busy="true" />;
  else body = <SettingsBody data={query.data} />;
  return (
    <Sheet title="Settings" open={open} onClose={onClose} side>
      {body}
    </Sheet>
  );
}
