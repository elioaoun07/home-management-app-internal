import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DETECTORS, evaluate, loadDetectors } from "../../scripts/os/eval.mjs";
import { scan } from "../../scripts/os/scan.mjs";

type Change = {
  file: string;
  beforeFile?: string;
  before: string | null;
  after: string | null;
};
type Fixture = { expected: string; changes: Change[] };
const fixtureRoot = resolve("tests/os/fixtures/detectors");
const fixtures = (id: string): Fixture[] =>
  JSON.parse(readFileSync(resolve(fixtureRoot, `${id}.json`), "utf8"));
const detector = (rule: string) =>
  loadDetectors().find((entry) => entry.meta.rule === rule)!;
const check = (rule: string, changes: Change[]) =>
  evaluate({ changes }, [detector(rule)]).rules[0];
const change = (
  file: string,
  after: string,
  before: string | null = null,
): Change => ({ file, before, after });

for (const [id, module] of DETECTORS) {
  describe(id as string, () => {
    for (const fixture of fixtures(id as string)) {
      it(`fixture: ${fixture.expected}`, () => {
        const result = evaluate(fixture, [{ id, ...module }]).rules[0];
        expect(result.verdict).toBe(fixture.expected);
        expect(result.schema).toBe("os/verdict@1");
        expect(result.version).toBe(1);
        expect(result.rule).toMatch(/^HR-\d+$/);
        if (fixture.expected === "fail") {
          expect(result.file).toBeTruthy();
          expect(result.line).toBeGreaterThan(0);
          expect(result.excerpt).toBeTruthy();
        }
      });
    }
    if (!["HR-24", "HR-25", "HR-11", "HR-23"].includes(module.meta.rule)) {
      it("reports removal as improved, with base-file evidence", () => {
        const fixture = fixtures(id as string).find(
          (entry) => entry.expected === "fail",
        )!;
        const result = evaluate(
          {
            changes: fixture.changes.map((entry) => ({
              ...entry,
              before: entry.after,
              after: null,
            })),
          },
          [{ id, ...module }],
        ).rules[0];
        expect(result.verdict).toBe("improved");
        expect(result.side).toBe("base");
        expect(result.removed).toBeGreaterThan(0);
      });
      it("leaves unchanged baseline violations alone", () => {
        const fixture = fixtures(id as string).find(
          (entry) => entry.expected === "fail",
        )!;
        const result = evaluate(
          {
            changes: fixture.changes.map((entry) => ({
              ...entry,
              before: entry.after,
              after: `// unrelated edit\n${entry.after}`,
            })),
          },
          [{ id, ...module }],
        ).rules[0];
        expect(result.verdict).toBe("pass");
        expect(result.added).toBe(0);
        expect(result.removed).toBe(0);
      });
    }
  });
}

describe("detector boundaries", () => {
  it("prioritizes new failures over removals and tracks duplicate calls", () => {
    const file = "src/components/Card.tsx";
    const result = check("HR-22", [
      change(
        file,
        "console.warn(2);\nconsole.warn(2);\n",
        "console.log(1);\nconsole.warn(2);\n",
      ),
    ]);
    expect(result.verdict).toBe("fail");
    expect([result.added, result.removed]).toEqual([1, 1]);
    expect(result.line).toBe(2);
  });
  it("handles computed members, multiline calls, JSX expressions, and excludes test fixtures", () => {
    expect(
      check("HR-22", [
        change("src/app/cards/page.tsx", 'console["warn"](\n  "x"\n);'),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-7", [
        change("src/lib/network.ts", 'const online = navigator["onLine"];'),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-19", [
        change("src/components/Input.tsx", '<Input type={"number"} />;'),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-22", [change("src/features/card.test.ts", "console.log(1);")])
        .verdict,
    ).toBe("n/a");
  });
  it("does not turn formatting changes into new violations", () => {
    expect(
      check("HR-22", [
        change(
          "src/components/Card.tsx",
          "console.log(\n  1, 2\n);",
          "console.log(1,2);",
        ),
      ]).verdict,
    ).toBe("pass");
  });
  it("detects timeout omissions and honors safeFetch aliases and explicit timeouts", () => {
    const file = "src/features/cards/hooks.ts";
    for (const url of [
      "/api/ai-chat",
      "/api/era/ask",
      "/api/statement-import/parse",
      "/api/cards/upload",
    ]) {
      expect(
        check("HR-6", [
          change(file, `safeFetch('${url}', { method: 'POST' });`),
        ]).verdict,
        url,
      ).toBe("fail");
      expect(
        check("HR-6", [
          change(file, `safeFetch('${url}', { timeoutMs: 60000 });`),
        ]).verdict,
        url,
      ).toBe("pass");
    }
    expect(
      check("HR-6", [
        change(
          file,
          "const data = new FormData(); safeFetch('/api/cards', { body: data });",
        ),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-6", [
        change(
          file,
          "const options = { method: 'PATCH' }; window.fetch('/api/cards', options);",
        ),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-6", [
        change(
          file,
          "import { safeFetch as send } from '@/lib/safeFetch'; send('/api/ai-chat', {});",
        ),
      ]).verdict,
    ).toBe("fail");
  });
  it("requires changed trace content with an ID in a canonical active PM file", () => {
    const src = change("src/lib/cards.ts", "export const n = 1;");
    const book =
      "ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md";
    expect(
      check("HR-25", [src, change(book, "# R94\nNew prose\n", "# R94\n")])
        .verdict,
    ).toBe("fail");
    expect(check("HR-25", [src, change(book, "R94 verified\n")]).verdict).toBe(
      "pass",
    );
    expect(
      check("HR-25", [
        src,
        change(
          book.replace("PM Tooling/", "_Archive/PM Tooling/"),
          "R94 verified\n",
        ),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-25", [src, { file: book, before: "R94", after: null }]).verdict,
    ).toBe("fail");
  });
  it("rejects unpaired migrations and deleted counterparts", () => {
    const migration = change("migrations/2026-11-10_cards.sql", "-- migration");
    expect(check("HR-24", [migration]).verdict).toBe("fail");
    expect(
      check("HR-24", [
        change("migrations/schema.sql", "-- schema"),
        { ...migration, before: "-- migration", after: null },
      ]).verdict,
    ).toBe("fail");
  });
  it("checks validation per exported mutating handler; comments and JSON.parse cannot satisfy it", () => {
    const file = "src/app/api/cards/route.ts";
    const valid = fixtures("hr-12-api-validation")[1].changes[0].after!;
    expect(
      check("HR-12", [
        change(
          file,
          `${valid}\nexport const PATCH = async () => Response.json({});`,
        ),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-12", [
        change(
          file,
          "import { z } from 'zod'; export async function POST() { /* schema.parse() */ return JSON.parse('{}'); }",
        ),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-12", [
        change(
          file,
          valid.replace(
            "export async function POST",
            "export const POST = async function",
          ),
        ),
      ]).verdict,
    ).toBe("pass");
    expect(
      check("HR-12", [
        change(
          file,
          "import { z } from 'zod'; export function POST() { return other.parse({}); }",
        ),
      ]).verdict,
    ).toBe("fail");
    expect(
      check("HR-12", [
        change(
          file,
          valid.replace("export async function POST", "async function save") +
            "\nexport { save as POST };\n",
        ),
      ]).verdict,
    ).toBe("pass");
    expect(
      check("HR-12", [
        change(
          file,
          "export async function GET() { return Response.json({}); }",
        ),
      ]).verdict,
    ).toBe("n/a");
  });
  it("detects removal of each cron guard and refuses a conditional missing-secret bypass", () => {
    const file = "src/app/api/cron/cards/route.ts",
      valid = fixtures("hr-8-cron-guards")[1].changes[0].after!;
    for (const broken of [
      valid.replace("!secret || ", "secret && "),
      valid.replace("!secret || ", "!secret && "),
      valid.replace(
        "export const maxDuration = 60;",
        "const maxDuration = 60;",
      ),
      valid.replace("maxDuration = 60", "maxDuration = 60.5"),
      valid.replace(
        "const db = supabaseAdmin();",
        "const db = supabaseServer();",
      ),
      valid.replace("status: 401", "status: 200"),
    ]) {
      expect(check("HR-8", [change(file, broken, valid)]).verdict).toBe("fail");
    }
  });
  it("refuses to load detectors without their three fixture contracts", () => {
    expect(loadDetectors()).toHaveLength(21);
    expect(() => loadDetectors(resolve("tests/os/missing-fixtures"))).toThrow();
  });
  it("includes versioned detector ownership and fixture files in the A1 registry", () => {
    const registry = scan();
    const entries = registry.entities.filter(
      (entry: { kind: string }) => entry.kind === "detector",
    );
    expect(entries).toHaveLength(25);
    for (const entry of entries) {
      expect(["diff", "transcript"]).toContain(entry.type);
      expect(entry.version).toBe(1);
      expect(["checked", "advisory"]).toContain(entry.level);
      expect(entry.enforces).toHaveLength(1);
      expect(entry.fixtures).toHaveLength(1);
      expect(
        registry.sources.some(
          (source: { path: string }) => source.path === entry.fixtures[0],
        ),
      ).toBe(true);
      expect(
        registry.entities.find(
          (rule: { id: string }) => rule.id === entry.enforces[0],
        ).detectors,
      ).toContain(entry.id);
    }
  }, 60_000);
});
