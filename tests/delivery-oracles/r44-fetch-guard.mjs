// Protected R44 acceptance input. This does not change the application's rule.
// Usage: node <this file> <candidate root> [--self-test]
import { ESLint } from "eslint";
import { resolve, join, dirname, delimiter, basename } from "node:path";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const directories = ["components", "features", "hooks", "contexts"];
const methods = ["POST", "PATCH", "PUT", "DELETE"];
const examples = [
  ...methods.map(method => ({ code: `fetch('/fixture', { method: '${method}' });`, warns: true })),
  { code: "fetch('/fixture', { method: 'GET' });", warns: false },
  { code: "fetch('/fixture');", warns: false },
  { code: "safeFetch('/fixture', { method: 'POST' });", warns: false },
  { code: "fetch('/fixture', { headers: { method: 'POST' } });", warns: false },
];

async function lintFixture(eslint, code, filePath) {
  const rows = await eslint.lintText(code, { filePath });
  assert.equal(rows.length, 1, `ESLint fixture was not evaluated: ${filePath}`);
  const result = rows[0];
  assert.equal(result.fatalErrorCount, 0, `ESLint fixture could not be parsed: ${filePath}`);
  // ESLint reports ignored/unconfigured files as rule-less warnings, not fatal
  // errors. An exclusion is proven only when the file was actually evaluated.
  assert(result.messages.every(message => message.ruleId !== null), `ESLint fixture was not evaluated: ${filePath}: ${JSON.stringify(result.messages)}`);
  return result;
}

export async function inspectFetchGuard(eslint) {
  const results = [];
  for (const directory of directories) {
    const result = await lintFixture(eslint, examples.map(example => example.code).join("\n"), `src/${directory}/__r44_fixtures.ts`);
    for (const [index, example] of examples.entries()) {
      const messages = result.messages.filter(message => message.ruleId === "no-restricted-syntax" && message.line === index + 1);
      results.push({ filePath: `src/${directory}/__r44_fixture_${index}.ts`, ok: !result.fatalErrorCount && (example.warns ? messages.length === 1 && messages[0].severity === 1 : messages.length === 0) });
    }
  }
  const server = await lintFixture(eslint, methods.map(method => `fetch('/fixture', { method: '${method}' });`).join("\n"), "src/app/api/r44-fixture/route.ts");
  for (const [index, method] of methods.entries()) results.push({ filePath: `server:${method}`, ok: !server.fatalErrorCount && !server.messages.some(message => message.ruleId === "no-restricted-syntax" && message.line === index + 1) });
  return results;
}

export async function selfTestFetchGuard(root) {
  const base = { cwd: root, overrideConfigFile: true };
  const files = ["src/**/*.ts"];
  const positive = new ESLint({ ...base, overrideConfig: [{ files }, {
    files: directories.map(directory => `src/${directory}/**/*.ts`),
    rules: { "no-restricted-syntax": ["warn", { selector: "CallExpression[callee.name='fetch'] > ObjectExpression.arguments > Property[key.name='method'][value.value=/^(POST|PATCH|PUT|DELETE)$/]", message: "Use safeFetch" }] },
  }] });
  const results = await inspectFetchGuard(positive);
  assert(results.every(result => result.ok), JSON.stringify(results.filter(result => !result.ok)));
  const negative = await inspectFetchGuard(new ESLint({ ...base, overrideConfig: [{ files }] }));
  assert.equal(negative.filter(result => !result.ok).length, 16);
  return results.length + 1;
}

// Exercise the installed CLI's config loader, as `pnpm lint` does. Next's
// FlatCompat plugin patch has different ESM/CJS loading behavior when imported
// directly through the API; replacing candidate configuration is not a check.
export function candidateLinter(root) {
  const packageRoot = dirname(realpathSync(createRequire(import.meta.url).resolve("eslint/package.json")));
  const cli = join(packageRoot, "bin/eslint.js");
  // Match pnpm's generated executable shim, including its virtual-store hoist.
  const virtualStore = resolve(packageRoot, "../../..");
  const nodePath = [join(packageRoot, "node_modules"), dirname(packageRoot), ...(basename(virtualStore) === ".pnpm" ? [join(virtualStore, "node_modules")] : [])].join(delimiter);
  return { async lintText(code, { filePath }) {
    const result = spawnSync(process.execPath, [cli, "--config", join(root, "eslint.config.mjs"), "--stdin", "--stdin-filename", filePath, "--format", "json"],
      { cwd: root, input: code, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024, env: { ...process.env, NODE_PATH: nodePath } });
    assert(!result.error && !result.signal && [0, 1].includes(result.status), "ESLint did not complete: " + result.stderr);
    const rows = JSON.parse(result.stdout);
    assert.equal(rows.length, 1, "ESLint fixture was not evaluated");
    return rows;
  } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  try {
    let count;
    if (process.argv.includes("--self-test")) count = await selfTestFetchGuard(root);
    else if (process.argv.includes("--baseline-control")) {
      const results = await inspectFetchGuard(candidateLinter(root));
      const failed = results.filter(result => !result.ok);
      assert.equal(failed.length, 16, "baseline is no longer the reviewed missing guard");
      assert(failed.every(result => /__r44_fixture_[0-3]\.ts$/u.test(result.filePath)), "baseline failures are not the expected mutations");
      count = 1;
    } else {
      const results = await inspectFetchGuard(candidateLinter(root));
      assert(results.every(result => result.ok), JSON.stringify(results.filter(result => !result.ok)));
      count = results.length;
    }
    process.stdout.write(`Tests ${count} passed (${count})\n`);
  } catch (error) { process.stderr.write(String(error) + "\n"); process.exitCode = 1; }
}
