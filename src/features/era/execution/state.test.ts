import { describe, expect, it } from "vitest";
import {
  initialRun,
  transition,
  runStatus,
  ATTEMPT_TIMEOUT_MS,
  resultSchema,
  type RunState,
} from "./state";

const attempt = "11111111-1111-4111-8111-111111111111";
const artifact = {
  entity: "shopping_item" as const,
  action: "created" as const,
  id: attempt,
  title: "Milk",
};
const now = Date.now();
function state(read = false): RunState {
  return initialRun({
    id: attempt,
    conversationId: attempt,
    sourceText: "Add milk then remind me",
    text: "Ready",
    referenceDate: new Date(now).toISOString(),
    timeZone: "Asia/Beirut",
    focus: null,
    plan: {
      steps: [
        {
          id: "shopping",
          label: "Milk",
          capabilityId: read ? "shopping.list" : "shopping.add",
          slots: read ? {} : { items: ["Milk"] },
        },
        {
          id: "reminder",
          label: "Collect milk",
          capabilityId: "reminder.create",
          slots: { rawText: "Collect milk" },
        },
      ],
    },
  });
}
function begin(s: RunState) {
  return transition(
    transition(s, { type: "confirm" }, now),
    { type: "begin", stepId: "shopping", attemptId: attempt },
    now,
  );
}
describe("ERA durable state transitions", () => {
  it("requires confirmation and never begins a later step first", () => {
    expect(runStatus(state())).toBe("awaiting_confirm");
    expect(() =>
      transition(
        state(),
        { type: "begin", stepId: "shopping", attemptId: attempt },
        now,
      ),
    ).toThrow();
    expect(() =>
      transition(
        begin(state()),
        { type: "begin", stepId: "reminder", attemptId: attempt },
        now,
      ),
    ).toThrow();
  });
  it("rejects double dispatch, wrong attempt and duplicate completion", () => {
    const s = begin(state());
    expect(() =>
      transition(
        s,
        { type: "begin", stepId: "shopping", attemptId: attempt },
        now,
      ),
    ).toThrow();
    expect(() =>
      transition(
        s,
        {
          type: "finish",
          stepId: "shopping",
          attemptId: "22222222-2222-4222-8222-222222222222",
          result: { text: "Done" },
        },
        now,
      ),
    ).toThrow();
    const done = transition(
      s,
      {
        type: "finish",
        stepId: "shopping",
        attemptId: attempt,
        result: { text: "Added", artifacts: [artifact] },
      },
      now,
    );
    expect(done.steps[0].status).toBe("done");
    expect(() =>
      transition(
        done,
        {
          type: "finish",
          stepId: "shopping",
          attemptId: attempt,
          result: { text: "Added" },
        },
        now,
      ),
    ).toThrow();
  });
  it("recovers lost write responses as uncertain and fences the previous executor", () => {
    const s = begin(state());
    expect(() => transition(s, { type: "recover" }, now + 1)).toThrow();
    const recovered = transition(
      s,
      { type: "recover" },
      now + ATTEMPT_TIMEOUT_MS,
    );
    expect(runStatus(recovered)).toBe("uncertain");
    expect(() =>
      transition(
        recovered,
        { type: "begin", stepId: "shopping", attemptId: attempt },
        now,
      ),
    ).toThrow();
    expect(() =>
      transition(
        recovered,
        {
          type: "finish",
          stepId: "shopping",
          attemptId: attempt,
          result: { text: "Added" },
        },
        now,
      ),
    ).toThrow();
    expect(() => transition(recovered, { type: "retry_read" }, now)).toThrow();
  });
  it("allows interrupted reads to run again without replaying a write", () => {
    const recovered = transition(
      begin(state(true)),
      { type: "recover" },
      now + ATTEMPT_TIMEOUT_MS,
    );
    expect(runStatus(recovered)).toBe("queued");
    expect(
      transition(
        recovered,
        { type: "begin", stepId: "shopping", attemptId: attempt },
        now,
      ).steps[0].status,
    ).toBe("running");
  });
  it("persists partial item receipts and keeps an active batch alive", () => {
    const progress = transition(
      begin(state()),
      {
        type: "progress",
        stepId: "shopping",
        attemptId: attempt,
        result: {
          text: "Added 1 of 2",
          artifacts: [artifact],
          metadata: { partial: true },
        },
      },
      now + 60_000,
    );
    expect(() =>
      transition(progress, { type: "recover" }, now + ATTEMPT_TIMEOUT_MS),
    ).toThrow();
    const failed = transition(
      progress,
      {
        type: "finish",
        stepId: "shopping",
        attemptId: attempt,
        result: { text: "Uncertain", ok: false, metadata: { partial: true } },
      },
      now,
    );
    expect(failed.steps[0].result?.artifacts).toEqual([artifact]);
    expect(runStatus(failed)).toBe("uncertain");
  });
  it("does not acknowledge a write without an artifact", () => {
    const s = transition(
      begin(state()),
      {
        type: "finish",
        stepId: "shopping",
        attemptId: attempt,
        result: { text: "Done" },
      },
      now,
    );
    expect(runStatus(s)).toBe("uncertain");
  });
  it("stores the exact question and finishes a continuation without redoing creates", () => {
    const pending = {
      kind: "slot" as const,
      capability: "shopping.group" as const,
      args: { messageIds: [attempt] },
      slot: "group",
      options: [{ label: "General", value: "general" }],
      question: "Which group?",
      rawText: "Milk",
      createdAt: now,
    };
    const waiting = transition(
      begin(state()),
      {
        type: "finish",
        stepId: "shopping",
        attemptId: attempt,
        result: { text: "Which group?", artifacts: [artifact], pending },
      },
      now,
    );
    const restored = JSON.parse(JSON.stringify(waiting)) as RunState;
    expect(runStatus(restored)).toBe("waiting");
    expect(restored.steps[0].result?.pending).toEqual(pending);
    expect(() =>
      transition(
        restored,
        { type: "begin", stepId: "shopping", attemptId: attempt },
        now,
      ),
    ).toThrow();
    const answering = transition(
      restored,
      {
        type: "begin",
        stepId: "shopping",
        attemptId: attempt,
        continuation: true,
      },
      now,
    );
    const done = transition(
      answering,
      {
        type: "finish",
        stepId: "shopping",
        attemptId: attempt,
        result: {
          text: "Grouped",
          artifacts: [{ ...artifact, action: "updated" }],
        },
      },
      now,
    );
    expect(done.steps[0].result?.artifacts).toHaveLength(2);
    expect(done.steps[0].result?.pending).toBeUndefined();
    expect(runStatus(done)).toBe("queued");
  });
  it("skips an uncertain step without erasing completed facts, cancellation is final", () => {
    const uncertain = transition(
      begin(state()),
      { type: "recover" },
      now + ATTEMPT_TIMEOUT_MS,
    );
    const skipped = transition(uncertain, { type: "skip" }, now);
    expect(skipped.steps[0].status).toBe("skipped");
    expect(runStatus(skipped)).toBe("queued");
    const cancelled = transition(skipped, { type: "cancel" }, now);
    expect(runStatus(cancelled)).toBe("cancelled");
    expect(() =>
      transition(
        cancelled,
        { type: "begin", stepId: "reminder", attemptId: attempt },
        now,
      ),
    ).toThrow();
  });
  it("refuses function-bearing handoffs and accepts persisted reminder questions", () => {
    expect(
      resultSchema.safeParse({
        text: "Open",
        proposal: { kind: "handoff", text: "Open", open: () => {} },
      }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({
        text: "When?",
        pending: {
          kind: "draftReminder",
          title: "Collect milk",
          priority: "normal",
          rawText: "Collect milk",
          createdAt: now,
        },
      }).success,
    ).toBe(true);
  });
});
