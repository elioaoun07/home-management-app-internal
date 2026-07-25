// src/components/pm-live/TaskDetailSheet.tsx
// Full view of one checklist item. This is where launching a delivery becomes
// an explicit choice rather than a side-effect of tapping a row.
"use client";

import { SEVERITY_DOT } from "@/features/pm-live/chartTheme";
import type { PmTask } from "@/features/pm-live/types";
import { Sheet } from "./Sheet";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2 border-b last:border-b-0" style={{ borderColor: "var(--pm-border)" }}>
      <dt className="text-[11px] uppercase tracking-wider" style={{ color: "var(--pm-fg-3)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] break-words" style={{ color: "var(--pm-fg-1)" }}>
        {children}
      </dd>
    </div>
  );
}

export function TaskDetailSheet({
  task,
  onClose,
  onLaunch,
}: {
  task: PmTask;
  onClose: () => void;
  onLaunch: (task: PmTask) => void;
}) {
  const deliverable = !!task.idChip && task.state !== "done";

  return (
    <Sheet
      title={task.idChip || "Checklist item"}
      subtitle={`${task.module} · ${task.section}`}
      onClose={onClose}
      footer={
        deliverable ? (
          <button onClick={() => onLaunch(task)} data-variant="primary" className="pm-btn w-full">
            Deliver this item
          </button>
        ) : (
          <p className="text-[12px] text-center" style={{ color: "var(--pm-fg-3)" }}>
            {task.state === "done"
              ? "Already done — sweep it to Feature State on the laptop."
              : "No ID chip, so there is nothing to key a delivery session to."}
          </p>
        )
      }
    >
      <p className="text-[14px] leading-relaxed mb-3" style={{ color: "var(--pm-fg-1)" }}>
        {task.text}
      </p>

      <dl>
        <Field label="Severity">
          {task.severity ? (
            <span className="inline-flex items-center gap-1.5 capitalize">
              <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[task.severity]}`} aria-hidden />
              {task.severity}
            </span>
          ) : (
            <span style={{ color: "var(--pm-fg-3)" }}>unrated</span>
          )}
        </Field>
        <Field label="Effort">{task.effort || <span style={{ color: "var(--pm-fg-3)" }}>unsized</span>}</Field>
        <Field label="Lane">{task.section}</Field>
        <Field label="File">
          <span className="font-mono text-[12px]">
            {task.file}
            <span style={{ color: "var(--pm-fg-3)" }}> · #{task.cbidx}</span>
          </span>
        </Field>
        <Field label="Source line">
          <code className="block text-[11.5px] font-mono whitespace-pre-wrap" style={{ color: "var(--pm-fg-2)" }}>
            {task.lineText}
          </code>
        </Field>
      </dl>

      <p className="mt-3 text-[11.5px]" style={{ color: "var(--pm-fg-3)" }}>
        Checklist items are read-only here. Ticking one is the outcome of a delivery session, or a laptop edit.
      </p>
    </Sheet>
  );
}
