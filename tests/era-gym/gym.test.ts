// HUB-77 — ERA Gym, CI mode: no network. Path B runs fully; paths A and C
// replay recorded model responses (record.test.ts) and count anything
// unrecorded as such. Hard gates here are the release gates that must hold
// regardless of the routing decision.
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  decide,
  gymFetch,
  loadCorpus,
  loadRecordings,
  renderReport,
  replayModel,
  runCase,
  score,
  summarize,
  type CaseScore,
  type GymCase,
  type PathResult,
} from "./gym";

vi.mock("@/features/items/useItems", async () => ({ fetchItems: (await import("./mocks")).fakeFetchItems }));
vi.mock("@/lib/supabase/client", async () => ({ supabaseBrowser: (await import("./mocks")).fakeSupabase }));
vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
  probeNow: () => Promise.resolve(),
}));

const corpus = loadCorpus();
const rows: Record<"A" | "B" | "C", Array<{ c: GymCase; r: PathResult; s: CaseScore }>> = { A: [], B: [], C: [] };

beforeAll(async () => {
  vi.stubGlobal("fetch", gymFetch);
  const model = replayModel(loadRecordings());
  for (const p of ["A", "B", "C"] as const) {
    for (const c of corpus) {
      const r = await runCase(c, p, model);
      rows[p].push({ c, r, s: score(c, r) });
    }
  }
});

describe("ERA Gym corpus", () => {
  it("carries full context on every case", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(47);
    for (const c of corpus) {
      expect(c.turns.length).toBeGreaterThan(0);
      expect(c.context).toMatchObject({
        face: expect.any(String),
        page: expect.any(String),
        clock: expect.any(String),
        timezone: expect.any(String),
        actor: expect.any(String),
      });
      expect(Array.isArray(c.context.focus)).toBe(true);
      expect(Array.isArray(c.context.lexicon)).toBe(true);
      expect(c.expect.outcome).toBeTruthy();
    }
  });

  it("covers every mandatory slice (plan §7)", () => {
    const slices = new Set(corpus.map((c) => c.slice));
    for (const s of ["amount", "franco", "speech-act", "correction", "partner", "uncertain", "voice"]) {
      expect(slices, s).toContain(s);
    }
  });

  it("has unique ids and both splits", () => {
    expect(new Set(corpus.map((c) => c.id)).size).toBe(corpus.length);
    expect(corpus.some((c) => c.split === "heldout")).toBe(true);
  });
});

describe("ERA Gym release gates", () => {
  it("fast path (B) produces zero wrong money effects", () => {
    const bad = rows.B.filter((x) => x.s.wrongMoney && !x.c.knownGap).map((x) => `${x.c.id}: ${x.c.turns.join(" / ")} → ${JSON.stringify(x.r.effect)}`);
    expect(bad).toEqual([]);
  });

  it("no path writes or proposes anything for a negated sentence", () => {
    for (const p of ["A", "B", "C"] as const) {
      for (const x of rows[p].filter((x) => x.c.slice === "speech-act" && x.c.expect.outcome === "no_action")) {
        expect(x.s.wrongEffect, `${p} ${x.c.id}`).toBe(false);
      }
    }
  });

  // Release gate for the SHIPPED path (A). Path C is the unshipped
  // Understand prototype — its wrong money effects feed the §7 decision
  // rule (see the report) instead of failing CI.
  it("today's model path (A) produces zero wrong money effects", () => {
    const bad = rows.A.filter((x) => x.r.via === "model" && x.s.wrongMoney && !x.c.knownGap).map((x) => `A ${x.c.id}`);
    expect(bad).toEqual([]);
  });

  it("prints the report", () => {
    const rec = loadRecordings();
    const summaries = (["A", "B", "C"] as const).map((p) => summarize(p, rows[p]));
    const report = renderReport(summaries, decide(summaries[0], summaries[2]), {
      model: rec?.meta.model,
      recordedAt: rec?.meta.recordedAt,
    });
    // Visible with `pnpm vitest run tests/era-gym --reporter=verbose`.
    process.stdout.write(`\n${report}\n`);
    const misses = rows.B.filter((x) => !x.s.correct).map((x) => `  B ✗ ${x.c.id} "${x.c.turns.at(-1)}" → ${x.r.outcome} ${JSON.stringify(x.r.effect ?? {})}`);
    process.stdout.write(`${misses.join("\n")}\n`);
    expect(summaries[1].n).toBe(corpus.length);
  });
});
