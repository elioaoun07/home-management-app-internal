// A7's offline boundary. No provider imports, credentials or model dispatch.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { hash, normalized, isMain, ROOT } from "./scan.mjs";
import { localEnvironment } from "../delivery-v2/local-guardrails.mjs";
import { safeFacts } from "./privacy.mjs";

const sha = z.string().regex(/^[0-9a-f]{40}$/);
const path = z.string().regex(/^(?!\/)(?!.*(?:\.\.|\\))[a-zA-Z0-9_/.[\] -]+$/);
export const caseSchema = z
  .object({
    schema: z.literal("os/case@1"),
    id: z.string().regex(/^[A-Z]+-\d+$/),
    title: z.string().min(1),
    start: sha,
    solution: sha,
    brief: z.string().min(1),
    paths: z.array(path).min(1),
    source: z.string().min(1),
    oracle: path,
    oracleHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .strict();
export function caseFingerprint(value) {
  return hash(JSON.stringify(caseSchema.parse(value)));
}
export function loadCase(id = "KIT-11") {
  // Closed inventory, not user-selected executable oracle code.
  if (id !== "KIT-11") throw new Error("Unknown Arena case");
  return caseSchema.parse(
    JSON.parse(
      readFileSync(new URL("./cases/kit11.json", import.meta.url), "utf8"),
    ),
  );
}
function git(root, args) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr || "Git failed");
  return result.stdout;
}

// Two controls of the *same* real oracle. Neither is a model run or a scorecard.
export function controls(root = ROOT, id = "KIT-11") {
  const spec = loadCase(id),
    oracle = join(root, spec.oracle);
  if (hash(normalized(readFileSync(oracle, "utf8"))) !== spec.oracleHash)
    throw new Error(
      "Arena oracle changed; review the case before running controls",
    );
  const output = join(root, ".os/reports/arena");
  mkdirSync(output, { recursive: true });
  const dir = mkdtempSync(join(output, "controls-"));
  const rows = [
    ["baseline", spec.start, false],
    ["solution", spec.solution, true],
  ].map(([label, commit, expectedPass]) => {
    const candidate = join(dir, label);
    for (const file of spec.paths) {
      const dest = join(candidate, file);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, git(root, ["show", `${commit}:${file}`]));
    }
    const result = spawnSync(
      process.execPath,
      [oracle, candidate, join(dir, label + "-oracle")],
      {
        cwd: root,
        env: localEnvironment(),
        encoding: "utf8",
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      },
    );
    const completed =
      !result.error && !result.signal && Number.isInteger(result.status);
    // A build/infrastructure error is not evidence of the expected behavioural failure.
    const behavioral = /FAILED nonzero count is written/.test(
      result.stdout || "",
    );
    const verdict = !completed
      ? "unknown"
      : result.status === 0
        ? "pass"
        : behavioral
          ? "fail"
          : "unknown";
    return {
      label,
      commit,
      expected: expectedPass ? "pass" : "fail",
      verdict,
      matches: verdict === (expectedPass ? "pass" : "fail"),
      exitCode: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: result.error?.message || null,
    };
  });
  const evidence = safeFacts({
    schema: "os/arena-controls@1",
    caseId: spec.id,
    caseFingerprint: caseFingerprint(spec),
    oracleHash: spec.oracleHash,
    kind: "offline historical controls; not model runs",
    observedAt: new Date().toISOString(),
    rows,
    ok: rows.every((r) => r.matches),
  });
  writeFileSync(
    join(dir, "evidence.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  return { ...evidence, evidenceFile: join(dir, "evidence.json") };
}
if (isMain(import.meta.url)) {
  try {
    const [action, id = "KIT-11", ...extra] = process.argv.slice(2);
    if (extra.length || !["case", "controls"].includes(action))
      throw new Error(
        "Use os:arena case|controls [KIT-11]. Native dispatch is blocked pending hidden-oracle isolation.",
      );
    const value = action === "case" ? loadCase(id) : controls(ROOT, id);
    process.stdout.write(JSON.stringify(value, null, 2) + "\n");
    if (action === "controls" && !value.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`os:arena: ${error.message}\n`);
    process.exitCode = 2;
  }
}
