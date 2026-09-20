// Owner test gate (2026-09-19). After an Apply, the owner runs the tests on the
// laptop and records the result here. Passed unlocks Deliver; Failed keeps it
// locked unless the owner explicitly proceeds in the escalation dialog.
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { v2Post } from "./api";
import { client, pmKeys, useWorld } from "./state";
import { transport } from "./transport";
import { ErrorNotice } from "./components";
import type { V2TestGate } from "./types";

const commandId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "c-" + Date.now().toString(36);

export function useTestGate(enabled = true) {
  const { connected } = useWorld();
  return useQuery({
    queryKey: pmKeys.v2testgate,
    queryFn: ({ signal }) => transport().v2TestGate(signal),
    enabled: enabled && connected,
    refetchInterval: 8000,
  });
}

export function TestGateCard({ gate }: { gate: V2TestGate }) {
  const [confirm, setConfirm] = useState(false);
  const record = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      v2Post<{ ok: boolean; state: V2TestGate }>("test-gate", { application_id: gate.application?.application_id, ...body, command_id: commandId() }),
    onSuccess: (data) => {
      client.setQueryData(pmKeys.v2testgate, data.state);
      void client.invalidateQueries({ queryKey: pmKeys.v2testgate });
    },
  });
  if (!gate.application) return null;
  const failedRecorded = gate.record?.result === "failed";
  const alias = gate.application.run_id;
  if (!gate.locked) {
    return (
      <div className="test-gate" data-state={gate.record?.proceed ? "override" : "passed"}>
        {gate.record?.proceed ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
        <strong>{gate.record?.proceed ? "Tests failed · proceeding" : "Tests passed"}</strong>
      </div>
    );
  }
  return (
    <div className="test-gate" data-state={failedRecorded ? "failed" : "waiting"}>
      <div className="test-gate-head">
        <strong>Tests after Apply</strong>
        <small>{alias}</small>
      </div>
      <ErrorNotice error={record.error} />
      <div className="test-gate-actions">
        <button className="primary" disabled={record.isPending} onClick={() => record.mutate({ result: "passed" })}>
          <CheckCircle2 size={16} /> Passed
        </button>
        <button
          className="secondary"
          disabled={record.isPending}
          onClick={() => {
            if (!failedRecorded) record.mutate({ result: "failed" });
            setConfirm(true);
          }}
        >
          <XCircle size={16} /> Failed
        </button>
      </div>
      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-shade" />
          <Dialog.Content className="sheet test-gate-dialog" aria-describedby={undefined}>
            <div className="sheet-title">
              <Dialog.Title>Tests failed</Dialog.Title>
            </div>
            <p className="test-gate-warning">
              <ShieldAlert size={18} /> New deliveries stay locked.
            </p>
            <div className="test-gate-actions">
              <Dialog.Close className="secondary">Keep locked</Dialog.Close>
              <button
                className="primary danger"
                disabled={record.isPending}
                onClick={() => record.mutate({ result: "failed", proceed: true }, { onSuccess: () => setConfirm(false) })}
              >
                Proceed anyway
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
