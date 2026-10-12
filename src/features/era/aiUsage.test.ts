import { describe, expect, it } from "vitest";
import {
  type AiUsageReceipt,
  aggregateAiUsage,
  formatUsd,
  monthBounds,
  rateOf,
  shiftMonth,
} from "./aiUsage";

const at = (d: number, h: number) => new Date(2026, 9, d, h, 0, 0).toISOString(); // Oct 2026, local

function call(day: number, hour: number, input: number, output: number, model: string, auto = false): AiUsageReceipt[] {
  const session_id = auto ? "era-ask-auto" : "era-ask";
  const created_at = at(day, hour);
  return [
    { created_at, role: "user", session_id, input_tokens: input, output_tokens: 0, model_used: model },
    { created_at, role: "assistant", session_id, input_tokens: 0, output_tokens: output, model_used: model },
  ];
}

const chat = (id: string) => ({
  id,
  title: `Chat ${id}`,
  active_face_key: "budget",
  created_at: at(1, 8),
  updated_at: at(1, 8),
});

describe("rateOf", () => {
  it("prefers the most specific Claude model", () => {
    expect(rateOf("claude-opus-5-5")).toEqual({ input: 4, output: 20 });
    expect(rateOf("claude-opus-5")).toEqual({ input: 5, output: 25 });
  });
  it("ignores the :estimated suffix", () => {
    expect(rateOf("claude-haiku-5-5:estimated")).toEqual({ input: 0.1, output: 0.5 });
  });
  it("prices legacy Gemini Flash and Lite", () => {
    expect(rateOf("gemini-flash-latest")).toEqual({ input: 0.3, output: 2.5 });
    expect(rateOf("gemini-flash-lite-latest")).toEqual({ input: 0.1, output: 0.4 });
  });
  it("returns null for unknown or missing models", () => {
    expect(rateOf("unknown:no-response")).toBeNull();
    expect(rateOf(null)).toBeNull();
  });
});

describe("aggregateAiUsage", () => {
  it("buckets calls by local day, newest first, with a month total", () => {
    const { days, total } = aggregateAiUsage({
      receipts: [
        ...call(3, 9, 1_000_000, 100_000, "claude-haiku-5-5"),
        ...call(3, 22, 2_000, 500, "claude-haiku-5-5", true),
        ...call(5, 10, 10_000, 1_000, "gemini-flash-latest"),
      ],
      answers: [],
      chats: [],
    });
    expect(days.map((d) => d.key)).toEqual(["2026-10-05", "2026-10-03"]);
    const oct3 = days[1];
    expect(oct3.calls).toBe(2);
    expect(oct3.autoCalls).toBe(1);
    expect(oct3.input).toBe(1_002_000);
    expect(oct3.output).toBe(100_500);
    // 1M-token prompt is long-tier ($0.50/$2.50): 1M × 0.50 + 0.1M × 2.50;
    // the 2K call stays base ($0.10/$0.50): 2K × 0.10 + 0.5K × 0.50.
    expect(oct3.cost).toBeCloseTo(0.5 + 0.25 + 0.00045, 8);
    expect(total.calls).toBe(3);
    expect(total.cost).toBeCloseTo(oct3.cost + (10_000 * 0.3 + 1_000 * 2.5) / 1e6, 8);
  });

  it("bills Haiku 5.5 at the long-prompt rate only above 100K input", () => {
    const at100k = aggregateAiUsage({
      receipts: call(3, 9, 100_000, 1_000, "claude-haiku-5-5"),
      answers: [],
      chats: [],
    }).total;
    const over = aggregateAiUsage({
      receipts: call(3, 9, 100_001, 1_000, "claude-haiku-5-5"),
      answers: [],
      chats: [],
    }).total;
    expect(at100k.cost).toBeCloseTo((100_000 * 0.1 + 1_000 * 0.5) / 1e6, 8);
    expect(over.cost).toBeCloseTo((100_001 * 0.5 + 1_000 * 2.5) / 1e6, 8);
  });

  it("reprices prompt-cache reads (0.1×) and writes (1.25×) from the model suffix", () => {
    const { total } = aggregateAiUsage({
      receipts: call(3, 9, 6_000, 400, "claude-haiku-5-5:cache=5000/0"),
      answers: [],
      chats: [],
    });
    // 1K uncached + 5K read × 0.1 = 1.5K input-equivalent; 400 output.
    expect(total.input).toBe(6_000);
    expect(total.cost).toBeCloseTo((1_500 * 0.1 + 400 * 0.5) / 1e6, 10);
    const write = aggregateAiUsage({
      receipts: call(3, 9, 6_000, 0, "claude-haiku-5-5:cache=0/5000"),
      answers: [],
      chats: [],
    }).total;
    expect(write.cost).toBeCloseTo(((1_000 + 5_000 * 1.25) * 0.1) / 1e6, 10);
  });

  it("keeps unpriced tokens out of cost but reports them", () => {
    const { total } = aggregateAiUsage({
      receipts: call(3, 9, 100, 50, "mystery-model"),
      answers: [],
      chats: [],
    });
    expect(total.cost).toBe(0);
    expect(total.unpricedTokens).toBe(150);
  });

  it("prices a model-less input receipt from its call's output receipt", () => {
    const [input, output] = call(3, 9, 1_000_000, 0, "gemini-flash-latest");
    const { total } = aggregateAiUsage({
      receipts: [{ ...input, model_used: null }, output],
      answers: [],
      chats: [],
    });
    expect(total.unpricedTokens).toBe(0);
    expect(total.cost).toBeCloseTo(0.3, 8);
  });

  it("links each AI chat once per day, in order of its first answer", () => {
    const { days } = aggregateAiUsage({
      receipts: call(3, 9, 10, 5, "claude-haiku-5-5"),
      answers: [
        { conversation_id: "b", created_at: at(3, 11) },
        { conversation_id: "a", created_at: at(3, 9) },
        { conversation_id: "a", created_at: at(3, 12) },
        { conversation_id: "gone", created_at: at(3, 13) },
      ],
      chats: [chat("a"), chat("b")],
    });
    expect(days).toHaveLength(1);
    expect(days[0].chats.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("is empty for a month with no AI calls (native-only chats never write receipts)", () => {
    expect(aggregateAiUsage({ receipts: [], answers: [], chats: [] }).days).toEqual([]);
  });
});

describe("month helpers", () => {
  it("bounds a month at local midnight", () => {
    const { from, to } = monthBounds("2026-10");
    expect(new Date(from)).toEqual(new Date(2026, 9, 1));
    expect(new Date(to)).toEqual(new Date(2026, 10, 1));
  });
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("formats cents finely under a dollar", () => {
    expect(formatUsd(0.01234)).toBe("$0.0123");
    expect(formatUsd(4.567)).toBe("$4.57");
  });
});
