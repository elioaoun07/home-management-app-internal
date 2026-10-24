import { createRequire } from "node:module";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

const clientDirectories = ["components", "features", "hooks", "contexts"];
const mutationMethods = ["POST", "PATCH", "PUT", "DELETE"];
const positiveFixtures = mutationMethods.map(
  (method) => `fetch("/fixture", { method: "${method}" });`,
);
const negativeFixtures = [
  'fetch("/fixture", { method: "GET" });',
  'fetch("/fixture");',
  'safeFetch("/fixture", { method: "POST" });',
  'fetch("/fixture", { headers: { method: "POST" } });',
];

describe("raw mutating fetch guard", () => {
  const root = process.cwd();
  const packageRoot = dirname(
    realpathSync(createRequire(import.meta.url).resolve("eslint/package.json")),
  );
  const virtualStore = resolve(packageRoot, "../../..");
  const nodePath = [
    join(packageRoot, "bin/node_modules"),
    join(packageRoot, "node_modules"),
    dirname(packageRoot),
    ...(virtualStore.endsWith(".pnpm") ? [join(virtualStore, "node_modules")] : []),
  ].join(delimiter);

  type LintResult = {
    filePath: string;
    fatalErrorCount: number;
    messages: Array<{ ruleId: string | null; line: number; severity: number }>;
  };
  const clientCode = [...positiveFixtures, ...negativeFixtures].join("\n");
  const serverPath = "src/app/api/__raw_fetch_guard_fixture__/route.ts";
  const serverCode = positiveFixtures.join("\n");
  const inputs: Record<string, string> = Object.fromEntries([
    ...clientDirectories.map((directory) => [
      `src/${directory}/__raw_fetch_guard_fixture__.ts`,
      clientCode,
    ]),
    [serverPath, serverCode],
  ]);
  const results = new Map<string, LintResult>();

  beforeAll(() => {
    // Load the real config once at the repository root. The file-based CLI
    // harness intermittently stalled during plugin loading from its temporary
    // cwd. Virtual paths preserve every client/server glob without fixture files.
    const script = `
      const { ESLint } = require("eslint");
      const { readFileSync } = require("node:fs");
      const { join } = require("node:path");
      (async () => {
        const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: join(process.cwd(), "eslint.config.mjs") });
        const rows = [];
        for (const [filePath, code] of Object.entries(JSON.parse(readFileSync(0, "utf8")))) {
          rows.push(...await eslint.lintText(code, { filePath }));
        }
        process.stdout.write(JSON.stringify(rows));
      })().catch(error => { process.stderr.write(String(error.stack || error)); process.exitCode = 1; });
    `;
    const completed = spawnSync(
      process.execPath,
      ["-e", script],
      {
        cwd: root,
        input: JSON.stringify(inputs),
        encoding: "utf8",
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, NODE_PATH: nodePath },
      },
    );
    expect(completed.error).toBeUndefined();
    expect(completed.signal).toBeNull();
    expect([0, 1]).toContain(completed.status);
    const rows = JSON.parse(completed.stdout) as LintResult[];
    expect(rows).toHaveLength(Object.keys(inputs).length);
    for (const row of rows) {
      const filePath = relative(root, row.filePath).replaceAll("\\", "/");
      expect(inputs).toHaveProperty(filePath);
      results.set(filePath, row);
    }
    expect(results.size).toBe(Object.keys(inputs).length);
  });

  function lintText(code: string, filePath: string) {
    expect(inputs[filePath]).toBe(code);
    const result = results.get(filePath);
    expect(result).toBeDefined();
    return result!;
  }

  it.each(clientDirectories)("warns only for literal mutations in %s", async (directory) => {
    const code = [...positiveFixtures, ...negativeFixtures].join("\n");
    const result = lintText(code, `src/${directory}/__raw_fetch_guard_fixture__.ts`);

    expect(result.fatalErrorCount).toBe(0);
    expect(result.messages.filter((message) => message.ruleId === null)).toEqual(
      [],
    );

    const guardMessages = result.messages.filter(
      (message) => message.ruleId === "no-restricted-syntax",
    );
    expect(guardMessages.map((message) => message.line)).toEqual([1, 2, 3, 4]);
    expect(guardMessages.every((message) => message.severity === 1)).toBe(true);
  });

  it("does not apply to server route files", async () => {
    const code = mutationMethods
      .map((method) => `fetch("/fixture", { method: "${method}" });`)
      .join("\n");
    const result = lintText(code, "src/app/api/__raw_fetch_guard_fixture__/route.ts");

    expect(result.fatalErrorCount).toBe(0);
    expect(result.messages.filter((message) => message.ruleId === null)).toEqual(
      [],
    );
    expect(
      result.messages.filter(
        (message) => message.ruleId === "no-restricted-syntax",
      ),
    ).toEqual([]);
  });
});
