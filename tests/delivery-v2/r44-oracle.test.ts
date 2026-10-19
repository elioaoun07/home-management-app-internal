import { expect, it } from "vitest";
import { ESLint } from "eslint";
import { inspectFetchGuard, selfTestFetchGuard } from "../delivery-oracles/r44-fetch-guard.mjs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

it.each(["components", "features", "hooks", "contexts", "app/api"])("refuses ignored %s fixtures instead of passing unevaluated exclusions", async directory => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: true,
    overrideConfig: [
      { ignores: [`src/${directory}/**`] },
      { files: ["src/**/*.ts"] },
      {
        files: ["src/{components,features,hooks,contexts}/**/*.ts"],
        rules: { "no-restricted-syntax": ["warn", { selector: "CallExpression[callee.name='fetch'] > ObjectExpression.arguments > Property[key.name='method'][value.value=/^(POST|PATCH|PUT|DELETE)$/]", message: "Use safeFetch" }] },
      },
    ],
  });
  await expect(inspectFetchGuard(eslint)).rejects.toThrow(`ESLint fixture was not evaluated: src/${directory}/`);
});

it("refuses ignored fixtures even when ESLint suppresses the ignore warning", async () => {
  const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, warnIgnored: false, overrideConfig: [{ ignores: ["src/**"] }] });
  await expect(inspectFetchGuard(eslint)).rejects.toThrow("ESLint fixture was not evaluated");
});

it("refuses files without a matching ESLint configuration", async () => {
  const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: [{ files: ["unrelated/**/*.ts"] }] });
  await expect(inspectFetchGuard(eslint)).rejects.toThrow("ESLint fixture was not evaluated");
});

it("the protected R44 oracle distinguishes a warning guard from a missing guard", async () => {
  expect(await selfTestFetchGuard(process.cwd())).toBe(37);
  const baseline = await inspectFetchGuard(new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: [{ files: ["src/**/*.ts"] }] }));
  expect(baseline).toHaveLength(36);
  expect(baseline.filter(row => !row.ok)).toHaveLength(16);
});

it("executes all 36 candidate assertions through the real ESLint CLI on the pinned positive fixture", async () => {
  const result = spawnSync(process.execPath, [resolve("tests/delivery-oracles/r44-fetch-guard.mjs"), resolve("tests/delivery-oracles/fixtures/r44-positive")], { encoding: "utf8", windowsHide: true, timeout: 55000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe("Tests 36 passed (36)");
}, 60000);
