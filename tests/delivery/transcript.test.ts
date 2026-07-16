import { describe, expect, it } from "vitest";
import {
  TranscriptError,
  DEFAULT_MAX_RECORD_BYTES,
  appendRecordText,
  appendTurnEntryText,
  buildCrashSealEntry,
  buildRecord,
  buildTurnEntry,
  findMatches,
  findOrphanedTurnIds,
  formatRecord,
  formatTurnEntry,
  formatTurnId,
  parseTurnRecords,
  parseTurns,
  truncateRecordText,
  turnPromptFileName,
  turnShardFileName,
} from "../../scripts/delivery/transcript.mjs";

describe("formatTurnId", () => {
  it("zero-pads to 4 digits", () => {
    expect(formatTurnId(7)).toBe("0007");
    expect(formatTurnId(1234)).toBe("1234");
  });

  it("does not truncate beyond 4 digits", () => {
    expect(formatTurnId(12345)).toBe("12345");
  });

  it("throws for non-positive-integer input", () => {
    expect(() => formatTurnId(0)).toThrow(TranscriptError);
    expect(() => formatTurnId(-1)).toThrow(TranscriptError);
    expect(() => formatTurnId(1.5)).toThrow(TranscriptError);
  });
});

describe("turnShardFileName / turnPromptFileName", () => {
  it("builds the expected relative names", () => {
    expect(turnShardFileName("0007")).toBe("t-0007.ndjson");
    expect(turnPromptFileName("0007")).toBe("0007.md");
  });
});

describe("truncateRecordText", () => {
  it("leaves short text unchanged", () => {
    const { text, truncated } = truncateRecordText("hello", 100);
    expect(text).toBe("hello");
    expect(truncated).toBeNull();
  });

  it("handles null/undefined as empty string", () => {
    expect(truncateRecordText(null, 100).text).toBe("");
    expect(truncateRecordText(undefined, 100).text).toBe("");
  });

  it("head/tail-splits oversized text and reports byte counts", () => {
    const big = "A".repeat(50) + "B".repeat(50) + "C".repeat(50); // 150 bytes ascii
    const { text, truncated } = truncateRecordText(big, 60);
    expect(truncated).not.toBeNull();
    expect(truncated!.originalBytes).toBe(150);
    expect(text.startsWith("A")).toBe(true);
    expect(text.endsWith("C")).toBe(true);
    expect(text).toContain("\n…\n");
    // kept bytes should roughly match the budget (minus the marker)
    expect(truncated!.keptHeadBytes + truncated!.keptTailBytes).toBeLessThanOrEqual(60);
  });

  it("respects the default 64 KiB cap", () => {
    const huge = "x".repeat(DEFAULT_MAX_RECORD_BYTES + 1000);
    const { truncated } = truncateRecordText(huge);
    expect(truncated).not.toBeNull();
  });
});

describe("buildRecord / formatRecord / parseTurnRecords", () => {
  it("builds a minimal record with defaults", () => {
    const record = buildRecord({ turnId: "0001", seq: 1, kind: "assistant.text", text: "hi" });
    expect(record.v).toBe(1);
    expect(record.kind).toBe("assistant.text");
    expect(record.provider).toBeNull();
    expect(record.text).toBe("hi");
    expect(typeof record.ts).toBe("string");
  });

  it("requires turnId, numeric seq, and a known kind", () => {
    type BuildRecordArgs = Parameters<typeof buildRecord>[0];
    expect(() => buildRecord({ seq: 1, kind: "assistant.text" } as unknown as BuildRecordArgs)).toThrow(TranscriptError);
    expect(() => buildRecord({ turnId: "0001", kind: "assistant.text" } as unknown as BuildRecordArgs)).toThrow(TranscriptError);
    expect(() => buildRecord({ turnId: "0001", seq: 1, kind: "bogus" })).toThrow(TranscriptError);
  });

  it("truncates oversized string fields and sets the truncated marker", () => {
    const record = buildRecord({
      turnId: "0001",
      seq: 2,
      kind: "tool.result",
      output: "y".repeat(200),
      maxRecordBytes: 50,
    });
    expect(record.output.length).toBeLessThan(200);
    expect(record.truncated).toBeDefined();
    expect(record.truncated.originalBytes).toBe(200);
  });

  it("passes non-string fields through unchanged", () => {
    const record = buildRecord({ turnId: "0001", seq: 3, kind: "tool.result", isError: true, exitCode: 1 });
    expect(record.isError).toBe(true);
    expect(record.exitCode).toBe(1);
  });

  it("round-trips through format/parse", () => {
    const record = buildRecord({ turnId: "0001", seq: 1, kind: "prompt", text: "assembled prompt" });
    const line = formatRecord(record);
    expect(parseTurnRecords(`${line}\n`)).toEqual([record]);
  });

  it("parseTurnRecords returns [] for empty/whitespace text", () => {
    expect(parseTurnRecords("")).toEqual([]);
    expect(parseTurnRecords("   \n ")).toEqual([]);
  });

  it("parseTurnRecords throws with the offending line number on invalid json", () => {
    expect(() => parseTurnRecords('{"v":1}\nnot json\n')).toThrow(/line 2/);
  });
});

describe("appendRecordText", () => {
  it("appends with a trailing newline and no reparse of prior content", () => {
    const r1 = buildRecord({ turnId: "0001", seq: 1, kind: "prompt", text: "a" });
    const r2 = buildRecord({ turnId: "0001", seq: 2, kind: "assistant.text", text: "b" });
    let text = appendRecordText("", r1);
    text = appendRecordText(text, r2);
    expect(parseTurnRecords(text)).toEqual([r1, r2]);
  });

  it("requires a record with a kind", () => {
    expect(() => appendRecordText("", {})).toThrow(TranscriptError);
  });
});

describe("buildTurnEntry / formatTurnEntry / parseTurns / appendTurnEntryText", () => {
  const base = {
    turnId: "0001",
    phase: "DISCOVERY",
    agent: "orchestrator",
    provider: "claude",
    model: "claude-sonnet-5",
    effort: "medium",
    startedAt: "2026-07-16T00:00:00.000Z",
    durationMs: 1200,
    promptFile: "transcript/prompts/0001.md",
    recordsFile: "transcript/t-0001.ndjson",
    records: 5,
    usage: { input: 100, cachedRead: 0, cacheCreation: 0, output: 20, reasoningOutput: 0 },
    result: "ok",
    strategy: "start",
  };

  it("builds a valid entry with sane defaults", () => {
    const entry = buildTurnEntry(base);
    expect(entry.v).toBe(1);
    expect(entry.snapshotRef).toBeNull();
    expect(entry.configChangeRef).toBeNull();
  });

  it("rejects an unknown result or strategy", () => {
    expect(() => buildTurnEntry({ ...base, result: "bogus" })).toThrow(TranscriptError);
    expect(() => buildTurnEntry({ ...base, strategy: "bogus" })).toThrow(TranscriptError);
  });

  it("requires turnId", () => {
    expect(() => buildTurnEntry({ ...base, turnId: undefined as unknown as string })).toThrow(TranscriptError);
  });

  it("round-trips through format/parse and append", () => {
    const entry = buildTurnEntry(base);
    const text = appendTurnEntryText("", entry);
    expect(text.endsWith("\n")).toBe(true);
    expect(parseTurns(text)).toEqual([entry]);
    expect(formatTurnEntry(entry)).toBe(JSON.stringify(entry));
  });

  it("appends multiple entries in order without reparsing", () => {
    const e1 = buildTurnEntry(base);
    const e2 = buildTurnEntry({ ...base, turnId: "0002", startedAt: "2026-07-16T00:05:00.000Z" });
    let text = appendTurnEntryText("", e1);
    text = appendTurnEntryText(text, e2);
    expect(parseTurns(text).map((t: { turnId: string }) => t.turnId)).toEqual(["0001", "0002"]);
  });
});

describe("crash-turn reconciliation", () => {
  it("findOrphanedTurnIds returns prompt turnIds with no closing entry", () => {
    expect(findOrphanedTurnIds(["0001", "0002"], ["0001", "0002", "0003"])).toEqual(["0003"]);
  });

  it("returns [] when everything closed cleanly", () => {
    expect(findOrphanedTurnIds(["0001", "0002"], ["0001", "0002"])).toEqual([]);
  });

  it("handles empty inputs", () => {
    expect(findOrphanedTurnIds([], [])).toEqual([]);
    expect(findOrphanedTurnIds(undefined as unknown as string[], undefined as unknown as string[])).toEqual([]);
  });

  it("buildCrashSealEntry produces a result:crashed, strategy:start entry", () => {
    const entry = buildCrashSealEntry({
      turnId: "0003",
      phase: "BUILDING",
      agent: "orchestrator",
      provider: "codex",
      model: "gpt-5.2-codex",
      effort: "high",
      promptFile: "transcript/prompts/0003.md",
      recordsFile: "transcript/t-0003.ndjson",
      sealedAt: "2026-07-16T01:00:00.000Z",
    });
    expect(entry.result).toBe("crashed");
    expect(entry.strategy).toBe("start");
    expect(entry.records).toBe(0);
    expect(entry.usage).toBeNull();
  });
});

describe("findMatches", () => {
  it("finds a single literal match with a snippet", () => {
    const matches = findMatches("the quick brown fox", "quick");
    expect(matches).toHaveLength(1);
    expect(matches[0].start).toBe(4);
    expect(matches[0].len).toBe(5);
    expect(matches[0].snippet).toContain("quick");
  });

  it("is case-insensitive by default", () => {
    expect(findMatches("Hello World", "world")).toHaveLength(1);
  });

  it("honors caseSensitive:true", () => {
    expect(findMatches("Hello World", "world", { caseSensitive: true })).toHaveLength(0);
    expect(findMatches("Hello World", "World", { caseSensitive: true })).toHaveLength(1);
  });

  it("finds multiple non-overlapping matches", () => {
    expect(findMatches("abcabcabc", "abc")).toHaveLength(3);
  });

  it("returns [] for empty query or text", () => {
    expect(findMatches("hello", "")).toEqual([]);
    expect(findMatches("", "hello")).toEqual([]);
    expect(findMatches(null as unknown as string, "hello")).toEqual([]);
  });
});
