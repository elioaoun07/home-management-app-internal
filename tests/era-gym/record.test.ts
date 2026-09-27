// HUB-77 — ERA Gym, RECORD mode. Calls the live model for paths A and C,
// stores every response in recordings/model-responses.json (replayed by
// gym.test.ts in CI) and writes REPORT.md.
//
// Skipped unless ERA_GYM_RECORD=1:
//   ERA_GYM_RECORD=1 pnpm vitest run tests/era-gym/record.test.ts
//
// Sends only the synthetic corpus and the fake household — no household
// data. Hard cap: 500 model calls per run (plan §7). Unchanged prompts reuse
// their recording instead of calling again. Uses GEMINI_API_KEY from the
// environment or .env; the primary model only (no fallback), so every
// recorded answer names the model that produced it.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  decide,
  gymFetch,
  loadCorpus,
  loadRecordings,
  promptHash,
  RECORDINGS,
  renderReport,
  runCase,
  score,
  summarize,
  type ModelFn,
  type ModelReply,
} from "./gym";

vi.mock("@/features/items/useItems", async () => ({ fetchItems: (await import("./mocks")).fakeFetchItems }));
vi.mock("@/lib/supabase/client", async () => ({ supabaseBrowser: (await import("./mocks")).fakeSupabase }));
vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
  probeNow: () => Promise.resolve(),
}));

const MAX_CALLS = 500;
const RECORD = process.env.ERA_GYM_RECORD === "1";

function loadDotEnv() {
  const file = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*(GEMINI_API_KEY|GEMINI_MODEL)\s*=\s*"?([^"#\r\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

describe.skipIf(!RECORD)("ERA Gym — record live model responses", () => {
  it(
    "records paths A and C and writes the report",
    async () => {
      loadDotEnv();
      expect(process.env.GEMINI_API_KEY, "GEMINI_API_KEY").toBeTruthy();
      // Own client: gemini.ts builds its client at import time, before .env
      // is read here. Same default model as production (gemini.ts).
      const { GoogleGenAI } = await import("@google/genai");
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const geminiModel = process.env.GEMINI_MODEL || "gemini-flash-latest";
      const { ASK_AI_RESPONSE_SCHEMA } = await import("@/lib/ai/eraAskProposal");
      const { UNDERSTAND_SCHEMA } = await import("./understand");

      // Route only the app's own /api/* calls to the fake household.
      const realFetch = globalThis.fetch;
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).startsWith("/api/") ? gymFetch(input, init) : realFetch(input, init),
      );

      const previous = loadRecordings();
      const entries: Record<string, ModelReply & { hash: string }> = {};
      let calls = 0;

      const live: ModelFn = async (call) => {
        const hash = promptHash(call);
        const prior = previous?.entries[call.key];
        if (prior && prior.hash === hash) {
          entries[call.key] = prior;
          return prior;
        }
        if (++calls > MAX_CALLS) throw new Error(`call cap ${MAX_CALLS} reached`);
        const config =
          call.schema === "askai"
            ? { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: "application/json", responseSchema: ASK_AI_RESPONSE_SCHEMA }
            : { temperature: 0, maxOutputTokens: 512, responseMimeType: "application/json", responseSchema: UNDERSTAND_SCHEMA };
        const request = () =>
          genAI.models.generateContent({
            model: geminiModel,
            contents: [{ role: "user", parts: [{ text: call.user }] }],
            config: { systemInstruction: call.system, ...config },
          });
        // Latency is measured on the successful attempt only.
        let res;
        let started = performance.now();
        try {
          started = performance.now();
          res = await request();
        } catch (err) {
          if (!/429|RESOURCE_EXHAUSTED/.test(String(err))) throw err;
          await new Promise((r) => setTimeout(r, 30_000));
          started = performance.now();
          res = await request();
        }
        const reply: ModelReply = {
          text: res.text ?? "",
          ms: Math.round(performance.now() - started),
          inTok: res.usageMetadata?.promptTokenCount ?? 0,
          outTok: res.usageMetadata?.candidatesTokenCount ?? 0,
          model: res.modelVersion ?? geminiModel,
        };
        entries[call.key] = { ...reply, hash };
        return reply;
      };

      const corpus = loadCorpus();
      const rows = { A: [] as never[], B: [] as never[], C: [] as never[] } as Record<
        "A" | "B" | "C",
        Array<{ c: (typeof corpus)[number]; r: Awaited<ReturnType<typeof runCase>>; s: ReturnType<typeof score> }>
      >;
      for (const p of ["A", "B", "C"] as const) {
        for (const c of corpus) {
          const r = await runCase(c, p, live);
          rows[p].push({ c, r, s: score(c, r) });
        }
      }

      const models = [...new Set(Object.values(entries).map((e) => e.model))].join(", ");
      const recordedAt = new Date().toISOString();
      fs.mkdirSync(path.dirname(RECORDINGS), { recursive: true });
      fs.writeFileSync(
        RECORDINGS,
        `${JSON.stringify({ meta: { recordedAt, model: models, calls: Object.keys(entries).length }, entries }, null, 2)}\n`,
      );

      const summaries = (["A", "B", "C"] as const).map((p) => summarize(p, rows[p]));
      const report = renderReport(summaries, decide(summaries[0], summaries[2]), { model: models, recordedAt });
      const detail = (["A", "C"] as const)
        .flatMap((p) =>
          rows[p]
            .filter((x) => x.r.via !== "router")
            .map((x) => `| ${p} | ${x.c.id} | ${x.c.turns.at(-1)} | ${x.s.correct ? "✓" : "✗"} | ${x.r.outcome} | ${x.r.effect ? JSON.stringify(x.r.effect) : ""} | ${x.r.model?.ms ?? ""} |`),
        );
      fs.writeFileSync(
        path.join(__dirname, "REPORT.md"),
        `${report}\n## Model-routed cases\n\n| Path | Case | Last turn | ✓ | Outcome | Effect | ms |\n|---|---|---|---|---|---|---|\n${detail.join("\n")}\n`,
      );
      process.stdout.write(`\n${report}\nNew live calls this run: ${calls}\n`);
      vi.unstubAllGlobals();
    },
    30 * 60_000,
  );
});
