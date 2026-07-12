import { describe, expect, it } from "vitest";
import {
  EventsError,
  agentEventType,
  appendEvent,
  normalizeUsage,
  parseEvents,
  reduceUsage,
  replayAfter,
  truncateField,
} from "../../scripts/delivery/events.mjs";

describe("truncateField", () => {
  it("leaves short strings unchanged", () => {
    expect(truncateField("hi", 500)).toBe("hi");
  });

  it("truncates to the given max length", () => {
    expect(truncateField("a".repeat(10), 5)).toBe("aaaaa");
  });

  it("handles null/undefined as empty string", () => {
    expect(truncateField(null, 5)).toBe("");
    expect(truncateField(undefined, 5)).toBe("");
  });
});

describe("agentEventType", () => {
  it("prefixes with agent.", () => {
    expect(agentEventType("message")).toBe("agent.message");
    expect(agentEventType("command")).toBe("agent.command");
  });
});

describe("parseEvents", () => {
  it("returns [] for empty/whitespace input", () => {
    expect(parseEvents("")).toEqual([]);
    expect(parseEvents("   \n  ")).toEqual([]);
  });

  it("parses one event per line, ignoring blank lines", () => {
    const text = '{"seq":1,"type":"a"}\n\n{"seq":2,"type":"b"}\n';
    expect(parseEvents(text)).toEqual([
      { seq: 1, type: "a" },
      { seq: 2, type: "b" },
    ]);
  });

  it("throws EventsError with the offending line number on invalid json", () => {
    expect(() => parseEvents('{"seq":1}\nnot json\n')).toThrow(EventsError);
    expect(() => parseEvents('{"seq":1}\nnot json\n')).toThrow(/line 2/);
  });
});

describe("appendEvent / replayAfter: seq monotonicity", () => {
  it("assigns seq 1 to the first event on empty text", () => {
    const { text, event } = appendEvent("", { type: "agent.message", data: { x: 1 } });
    expect(event.seq).toBe(1);
    expect(text.endsWith("\n")).toBe(true);
    expect(parseEvents(text)).toEqual([event]);
  });

  it("increments seq on each successive append", () => {
    let text = "";
    let last;
    for (let i = 0; i < 5; i++) {
      const r = appendEvent(text, { type: "agent.message" });
      text = r.text;
      last = r.event;
    }
    expect(last!.seq).toBe(5);
    expect(parseEvents(text).map((e: { seq: number }) => e.seq)).toEqual([1, 2, 3, 4, 5]);
  });

  it("continues from the max existing seq even with gaps", () => {
    const seeded = '{"seq":1,"type":"a"}\n{"seq":5,"type":"b"}\n';
    const { event } = appendEvent(seeded, { type: "agent.message" });
    expect(event.seq).toBe(6);
  });

  it("requires a type", () => {
    const noType = {} as unknown as Parameters<typeof appendEvent>[1];
    expect(() => appendEvent("", noType)).toThrow(EventsError);
  });

  it("fills phase/agent/data/ts defaults", () => {
    const { event } = appendEvent("", { type: "agent.message" });
    expect(event.phase).toBeNull();
    expect(event.agent).toBeNull();
    expect(event.data).toEqual({});
    expect(typeof event.ts).toBe("string");
  });

  it("replayAfter returns only events with seq greater than the cursor", () => {
    let text = "";
    for (let i = 0; i < 3; i++) {
      text = appendEvent(text, { type: "agent.message", data: { i } }).text;
    }
    const replayed = replayAfter(text, 1);
    expect(replayed.map((e: { seq: number }) => e.seq)).toEqual([2, 3]);
  });
});

describe("normalizeUsage", () => {
  it("normalizes the codex shape", () => {
    const raw = { input_tokens: 100, cached_input_tokens: 20, output_tokens: 50, cost_usd: 0.01 };
    expect(normalizeUsage(raw, "codex")).toEqual({
      input: 100,
      cachedInput: 20,
      output: 50,
      costUsd: 0.01,
    });
  });

  it("normalizes the claude shape", () => {
    const raw = { input_tokens: 200, cache_read_input_tokens: 40, output_tokens: 80, total_cost_usd: 0.02 };
    expect(normalizeUsage(raw, "claude")).toEqual({
      input: 200,
      cachedInput: 40,
      output: 80,
      costUsd: 0.02,
    });
  });

  it("defaults costUsd to null when the provider omits it", () => {
    expect(normalizeUsage({ input_tokens: 1, output_tokens: 1 }, "codex").costUsd).toBeNull();
  });

  it("returns empty usage for null/undefined raw", () => {
    expect(normalizeUsage(null as unknown as object, "codex")).toEqual({
      input: 0,
      cachedInput: 0,
      output: 0,
      costUsd: null,
    });
  });

  it("throws for an unknown provider", () => {
    expect(() => normalizeUsage({}, "bogus" as unknown as "codex" | "claude")).toThrow(EventsError);
  });
});

describe("reduceUsage", () => {
  it("accumulates per-phase and total across mixed providers", () => {
    const records = [
      { phase: "DISCOVERY", usage: normalizeUsage({ input_tokens: 100, output_tokens: 10 }, "codex") },
      {
        phase: "DISCOVERY",
        usage: normalizeUsage({ input_tokens: 50, output_tokens: 5, total_cost_usd: 0.01 }, "claude"),
      },
      { phase: "PLAN", usage: normalizeUsage({ input_tokens: 20, output_tokens: 2 }, "codex") },
    ];
    const { perPhase, total } = reduceUsage(records);
    expect(perPhase.DISCOVERY).toEqual({ input: 150, cachedInput: 0, output: 15, costUsd: 0.01 });
    expect(perPhase.PLAN).toEqual({ input: 20, cachedInput: 0, output: 2, costUsd: null });
    expect(total).toEqual({ input: 170, cachedInput: 0, output: 17, costUsd: 0.01 });
  });

  it("keeps costUsd null in total when no record ever reported a cost", () => {
    const records = [
      { phase: "DISCOVERY", usage: normalizeUsage({ input_tokens: 1, output_tokens: 1 }, "codex") },
    ];
    expect(reduceUsage(records).total.costUsd).toBeNull();
  });

  it("returns zeroed totals for an empty record list", () => {
    expect(reduceUsage([])).toEqual({ perPhase: {}, total: { input: 0, cachedInput: 0, output: 0, costUsd: null } });
  });

  it("groups an unset phase under 'unknown'", () => {
    const { perPhase } = reduceUsage([{ usage: normalizeUsage({ input_tokens: 1 }, "codex") }]);
    expect(perPhase.unknown).toBeDefined();
  });
});
