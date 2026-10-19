import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import * as realFs from "node:fs";
import * as crypto from "node:crypto";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalJson, fingerprint } from "../../scripts/delivery-v2/contracts.mjs";
import { makeEnvironmentSpec, verifyEnvironmentSpec, makeEnvironmentReceipt, verifyEnvironmentReceipt, environmentReference, writeEnvironmentReceipt, findEnvironmentReceipt, environmentProbeArgs, environmentVerificationSource, verifyManagedEnvironment, verifyManagedEnvironmentSync, targetProbeSource } from "../../scripts/delivery-v2/dependency-environment.mjs";
import { inspectDependencyTree } from "../../scripts/delivery-v2/worker/dependency-inventory.mjs";
import { planCheckerEnvironment, pinnedToolDigest, stageCheckerEnvironment, stageCheckerPackageDiagnostic, planCheckerValidationContinuation, resumeCheckerValidation } from "../../scripts/delivery-v2/stage-checker-environment.mjs";
import { selectDiagnosticPackages } from "../../scripts/delivery-v2/checker-package-diagnostic.mjs";
import { probeNativeRuntimes } from "../../scripts/delivery-v2/worker/native-runtime-probe.mjs";
import { provisionCheckerDependencies } from "../../scripts/delivery-v2/setup-checker-deps.mjs";
import { boundaryBindingDigest, makeBoundaryConfig, createContainerRuntime } from "../../scripts/delivery-v2/worker-boundary.mjs";
import { readImageBinding } from "../../scripts/delivery-v2/probes/worker-qualification.mjs";
import { runProcess } from "../../scripts/delivery-v2/process.mjs";
import { COMPILER_RESOURCE_PROFILE } from "../../scripts/delivery-v2/compiler-resources.mjs";

const image = "sha256:" + "1".repeat(64);
const hash = (text: string) => "sha256:" + createHash("sha256").update(text).digest("hex");
const roots: string[] = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), "era-env-fixture-")); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const packages = { typescript: "5.9.2", esbuild: "0.25.12", vitest: "4.1.7", eslint: "9.36.0" };
const specInput = () => ({ image, nodeVersion: "v22.23.2", pnpmVersion: "10.16.0", pnpmDigest: hash("pnpm"), packageJson: "{}", lockfile: "lock", packages, oracles: [{ id: "behavior", argv: ["node", "oracle.mjs"], assertions: 2, inputs: { "oracle.mjs": hash("oracle") } }] });
const probes = () => ({ ok: true, compilerNegativeControl: true, compilerPositiveControl: true, nativeExecuted: true, node: "v22.23.2", platform: "linux", arch: "x64", glibc: "2.36", packages });
function receipt() {
  return makeEnvironmentReceipt({ spec: makeEnvironmentSpec(specInput()), volume: "era-v2-deps-fixture", inventory: { ok: true, digest: hash("tree") }, probes: probes(), oracles: [{ id: "behavior", exitCode: 0, passed: 2, failed: 0 }], observedAt: "2026-10-17T00:00:00Z" });
}

describe("content-addressed environment evidence", () => {
  it("requires the versioned compiler profile in receipt authority and every full compiler witness", () => {
    const good = receipt();expect(good.compilerProfile).toEqual(COMPILER_RESOURCE_PROFILE);
    for (const compilerProfile of [undefined, { ...COMPILER_RESOURCE_PROFILE, oldSpaceMiB: 4096 }, { ...COMPILER_RESOURCE_PROFILE, nodeOptions: "--require=untrusted" }]) {
      const altered = { ...good, compilerProfile };
      expect(verifyEnvironmentReceipt(altered)).toBe(false);
      const { receiptDigest: _digest, ...body } = altered;
      void _digest;
      expect(verifyEnvironmentReceipt({ ...body, receiptDigest: fingerprint(canonicalJson(body)) })).toBe(false);
    }
    const input = specInput(), spec = makeEnvironmentSpec({ ...input, oracles: [{ ...input.oracles[0], argv: ["node", "scripts/delivery-v2/probes/compiler-program.mjs", "/inputs/program", "positive"] }] });
    const create = (compilerProfile?: object) => makeEnvironmentReceipt({ spec, volume: "fixture", inventory: { ok: true, digest: hash("tree") }, probes: probes(), oracles: [{ id: "behavior", exitCode: 0, passed: 2, failed: 0, compilerProfile }], observedAt: "fixture" });
    expect(() => create()).toThrow(/resource profile witness/);
    expect(() => create({ ...COMPILER_RESOURCE_PROFILE, oldSpaceMiB: 2048 })).toThrow(/resource profile witness/);
    expect(verifyEnvironmentReceipt(create(COMPILER_RESOURCE_PROFILE))).toBe(true);
    expect(create(COMPILER_RESOURCE_PROFILE).spec.key).toBe(spec.key);
  });
  it("keys immutable toolchain, lockfile and oracle inputs, not a mutable volume name", () => {
    const input = specInput(), spec = makeEnvironmentSpec(input);
    expect(makeEnvironmentSpec(input).key).toBe(spec.key);
    for (const change of [{ image: "sha256:" + "2".repeat(64) }, { lockfile: "new lock" }, { pnpmDigest: hash("changed tool") }, { packages: { ...packages, esbuild: "0.25.13" } }, { oracles: [{ ...input.oracles[0], inputs: { "oracle.mjs": hash("changed oracle") } }] }]) {
      expect(makeEnvironmentSpec({ ...input, ...change }).key).not.toBe(spec.key);
    }
    expect(() => makeEnvironmentSpec({ ...input, image: "worker:latest" })).toThrow(/immutable/);
    expect(() => makeEnvironmentSpec({ ...input, oracles: [] })).toThrow(/oracles/);
  });
  it("refuses native/compiler gaps and zero, missing or failing oracle evidence", () => {
    const good = receipt();
    for (const change of [{ probes: { ...probes(), compilerNegativeControl: false } }, { probes: { ...probes(), platform: "win32" } }, { probes: { ...probes(), nativeExecuted: false } }, { oracles: [] }, { oracles: [{ id: "behavior", exitCode: 0, passed: 0, failed: 0 }] }, { oracles: [{ id: "behavior", exitCode: 1, passed: 2, failed: 0 }] }]) {
      expect(() => makeEnvironmentReceipt({ spec: good.spec, volume: good.volume, inventory: { ok: true, digest: good.contentDigest }, probes: probes(), oracles: good.oracles, observedAt: good.observedAt, ...change })).toThrow();
    }
  });
  it("binds the owned store strategy and manifest-declared native executable obligations", () => {
    const input = specInput(), current = makeEnvironmentSpec(input);
    expect(current.verifier).toBe("node-linux-checker@2");expect(current.install.store).toBe("isolated-volume@1");
    for (const change of [{ verifier: "node-linux-checker@1" }, { install: { ...current.install, store: "tmpfs" } }]) {
      const { key, ...body } = { ...current, ...change }, changedKey = fingerprint(canonicalJson(body));
      expect(changedKey).not.toBe(key);expect(verifyEnvironmentSpec({ ...body, key: changedKey })).toBe(false);
    }
    const native = makeEnvironmentSpec({ ...input, packageJson: JSON.stringify({ devDependencies: { "@openai/codex-sdk": "0.144.1" } }) });
    expect(native.nativePackages).toEqual({ "@openai/codex-sdk": "0.144.1" });
    expect(makeEnvironmentSpec({ ...input, packageJson: JSON.stringify({ optionalDependencies: { "@openai/codex-sdk": "0.144.1" } }) }).nativePackages).toEqual(native.nativePackages);
    expect(() => makeEnvironmentSpec({ ...input, packageJson: JSON.stringify({ devDependencies: { "@openai/codex-sdk": "0.144.1" }, optionalDependencies: { "@openai/codex-sdk": "0.144.0" } }) })).toThrow(/exact manifest/);
    expect(() => makeEnvironmentReceipt({ spec: native, volume: "fixture", inventory: { ok: true, digest: hash("tree") }, probes: probes(), oracles: [{ id: "behavior", exitCode: 0, passed: 2, failed: 0 }], observedAt: "fixture" })).toThrow(/native SDK executable/);
    expect(() => makeEnvironmentSpec({ ...input, packageJson: JSON.stringify({ devDependencies: { "@openai/codex-sdk": "^0.144.1" } }) })).toThrow(/exact manifest/);
  });
  it("resolves the import-only Codex SDK's transitive executable and runs only a bounded offline version probe", () => {
    const sdk = "/deps/node_modules/@openai/codex-sdk", cli = "/deps/node_modules/.pnpm/codex/package.json", native = "/deps/node_modules/.pnpm/codex-linux/package.json";
    const manifests: Record<string, unknown> = {
      [sdk + "/package.json"]: { name: "@openai/codex-sdk", version: "0.144.1", exports: { ".": { import: "./dist/index.js" } } },
      [cli]: { version: "0.144.1" }, [native]: { version: "0.144.1-linux-x64" },
    };
    const resolutions: string[] = [], commands: { executable: string; args: string[]; options: { timeout: number; env: Record<string, string> } }[] = [];
    let missing = false, status = 0;
    const fs = { realpathSync: (file: string) => { if (missing && file.endsWith("/codex")) throw new Error("missing native payload");return file; }, readFileSync: (file: string) => JSON.stringify(manifests[file]), existsSync: () => true, statSync: () => ({ isFile: () => true }) };
    const loader = (name: string) => name === "node:fs" ? fs : name === "node:path" ? posix : name === "node:module" ? { createRequire: (file: string) => { resolutions.push(file);return { resolve: (id: string) => id === "@openai/codex/package.json" ? cli : native }; } } : { spawnSync: (executable: string, args: string[], options: { timeout: number; env: Record<string, string> }) => { commands.push({ executable, args, options });return { status, stdout: "codex-cli 0.144.1", stderr: "" }; } };
    expect(probeNativeRuntimes({ "@openai/codex-sdk": "0.144.1" }, loader as never)).toMatchObject({ "@openai/codex-sdk": { executed: true, sdkVersion: "0.144.1", cliVersion: "0.144.1", exitCode: 0 } });
    expect(resolutions).toEqual([sdk + "/dist/index.js", cli]);expect(commands[0].args).toEqual(["--version"]);
    expect(commands[0].options).toMatchObject({ timeout: 15000, env: { HOME: "/tmp" } });
    expect(Object.keys(commands[0].options.env).sort()).toEqual(["HOME", "LANG", "PATH"]);
    status = 1;expect(() => probeNativeRuntimes({ "@openai/codex-sdk": "0.144.1" }, loader as never)).toThrow(/--version failed/);
    missing = true;const before = commands.length;
    expect(() => probeNativeRuntimes({ "@openai/codex-sdk": "0.144.1" }, loader as never)).toThrow(/missing native payload/);expect(commands).toHaveLength(before);
    for (const root of ["node_modules", "/opt/era/../node_modules", "/opt/era", "/opt/era/node_modules/"]) expect(() => probeNativeRuntimes({}, loader as never, root)).toThrow(/normalized absolute/);
    expect(probeNativeRuntimes({}, loader as never, "/opt/era/node_modules")).toEqual({});
    status = 0;missing = false;
    const imageLoader = (name: string) => name === "node:fs" ? { ...fs, readFileSync: (file: string) => fs.readFileSync(file.replace("/opt/era", "/deps")) } : name === "node:module" ? { createRequire: () => ({ resolve: (id: string) => (id === "@openai/codex/package.json" ? cli : native).replace("/deps", "/opt/era") }) } : loader(name);
    expect(probeNativeRuntimes({ "@openai/codex-sdk": "0.144.1" }, imageLoader as never, "/opt/era/node_modules")).toMatchObject({ "@openai/codex-sdk": { executed: true } });
    expect(commands.at(-1)!.executable).toContain("/opt/era/node_modules/");
    const escaping = (name: string) => name === "node:fs" ? { ...fs, realpathSync: () => "/outside/package" } : loader(name);
    expect(() => probeNativeRuntimes({ "@openai/codex-sdk": "0.144.1" }, escaping as never, "/opt/era/node_modules")).toThrow(/escaped dependency root/);
  });
  it("refuses malformed oracle/version identities even with a matching recomputed key", () => {
    const { key, ...body } = makeEnvironmentSpec(specInput());
    for (const change of [
      { oracles: [body.oracles[0], body.oracles[0]] },
      { oracles: [{ ...body.oracles[0], assertions: 1.5 }] },
      { oracles: [{ ...body.oracles[0], argv: [42] }] },
      { packages: { ...packages, esbuild: "latest" } },
    ]) {
      const altered = { ...body, ...change }, alteredKey = fingerprint(canonicalJson(altered));
      expect(alteredKey).not.toBe(key);
      expect(verifyEnvironmentSpec({ ...altered, key: alteredKey })).toBe(false);
    }
  });
  it("retains immutable receipts and rejects altered cache evidence", () => {
    const root = temp(), good = receipt(), file = writeEnvironmentReceipt(root, good);
    expect(writeEnvironmentReceipt(root, good)).toBe(file);
    expect(findEnvironmentReceipt(root, good.spec.key)?.receiptDigest).toBe(good.receiptDigest);
    expect(verifyEnvironmentReceipt({ ...good, contentDigest: hash("wrong") })).toBe(false);
    writeFileSync(file, JSON.stringify({ ...good, contentDigest: hash("wrong") }));
    expect(() => findEnvironmentReceipt(root, good.spec.key)).toThrow(/altered/);
  });
  it("binds qualification to content and evidence as well as the volume", () => {
    const deps = environmentReference(receipt()), a = makeBoundaryConfig({ image, dependencies: deps });
    const b = makeBoundaryConfig({ image, dependencies: { ...deps, environment: { ...deps.environment, contentDigest: hash("different") } } });
    expect(boundaryBindingDigest(a, image)).not.toBe(boundaryBindingDigest(b, image));
    expect(() => Reflect.apply(makeBoundaryConfig, null, [{ image, dependencies: { volume: deps.volume, environment: { key: deps.environment.key } } }])).toThrow(/binding/);
  });
});

describe("complete inventory", () => {
  it("hashes all regular files and retains lstat data; receipt is verified separately", () => {
    const root = temp(); mkdirSync(join(root, "node_modules")); writeFileSync(join(root, "node_modules", "module.js"), "one");
    const before = inspectDependencyTree(root);
    expect(before.ok).toBe(true); expect(before.metadata.length).toBe(before.entries.length);
    writeFileSync(join(root, ".era-dependency-environment.json"), "reserved receipt");
    expect(inspectDependencyTree(root).digest).toBe(before.digest);
    writeFileSync(join(root, "node_modules", "module.js"), "two");
    expect(inspectDependencyTree(root).digest).not.toBe(before.digest);
  });
  function linkedTree(targets: Record<string, string>) {
    const names = Object.keys(targets);
    const fs = {
      lstatSync(name: string) { if (name !== "/deps" && !names.includes(name)) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return { mode: 493, uid: 10001, gid: 10001, isDirectory: () => name === "/deps", isSymbolicLink: () => name !== "/deps", isFile: () => false }; },
      readdirSync: () => names.map(name => name.slice(6)), readlinkSync: (name: string) => Buffer.from(targets[name]),
    };
    return inspectDependencyTree("/deps", ((name: string) => name === "node:fs" ? fs : name === "node:path" ? posix : { createHash }) as never);
  }
  it("fails closed for missing targets, escapes and cycles without following linked directories", () => {
    expect(linkedTree({ "/deps/a": "absent" }).errors[0].code).toBe("ENOENT");
    expect(linkedTree({ "/deps/a": "../outside" }).errors[0].code).toBe("link-escape");
    expect(linkedTree({ "/deps/a": "/host/secret" }).errors[0].code).toBe("absolute-link");
    // Backslash is a literal filename byte on Linux, not a path separator.
    expect(linkedTree({ "/deps/a": "b\\", "/deps/b": "." }).errors[0].code).toBe("ENOENT");
    expect(linkedTree({ "/deps/a": "b", "/deps/b": "a" }).errors.every(row => row.code === "link-cycle")).toBe(true);
  });
});

describe("managed binding probes", () => {
  it("executes the builtin verifier against fixture bytes and refuses payload or receipt changes", () => {
    const root = temp(), spec = makeEnvironmentSpec({ ...specInput(), checks: { behavior: { argv: ["node", "oracle.mjs"], assertions: 2, inputs: { "oracle.mjs": hash("oracle") } } } });
    writeFileSync(join(root, "package.json"), "{}");writeFileSync(join(root, "pnpm-lock.yaml"), "lock");writeFileSync(join(root, "payload.js"), "original");
    const attestation = makeEnvironmentReceipt({ spec, volume: "fixture", inventory: inspectDependencyTree(root), probes: probes(), oracles: [{ id: "behavior", exitCode: 0, passed: 2, failed: 0 }], observedAt: "fixture" });
    writeFileSync(join(root, ".era-dependency-environment.json"), JSON.stringify(attestation));
    const mapped = (name: string) => { if (name !== "/deps" && !name.startsWith("/deps/")) throw new Error("outside fixture");return join(root, name.slice(5)); };
    const fs = { lstatSync: (name: string) => realFs.lstatSync(mapped(name)), readdirSync: (name: string) => realFs.readdirSync(mapped(name)), readFileSync: (name: string, encoding?: BufferEncoding) => encoding ? realFs.readFileSync(mapped(name), encoding) : realFs.readFileSync(mapped(name)) };
    const output: string[] = [];
    const context = { require: (name: string) => name === "node:fs" ? fs : name === "node:crypto" ? crypto : name === "node:path" ? posix : (() => { throw new Error("unexpected module"); })(), console: { log: (text: string) => output.push(text) }, process: { version: spec.nodeVersion, platform: "linux", arch: "x64", report: { getReport: () => ({ header: { glibcVersionRuntime: "2.36" } }) } } };
    const expected = environmentReference(attestation).environment;
    runInNewContext(environmentVerificationSource(expected, image), { ...context });
    expect(JSON.parse(output[0]).ok).toBe(true);
    for (const compilerProfile of [undefined, { ...COMPILER_RESOURCE_PROFILE, oldSpaceMiB: 4096 }]) {
      const { receiptDigest: _digest, ...body } = { ...attestation, compilerProfile };
      void _digest;
      const altered = { ...body, receiptDigest: fingerprint(canonicalJson(body)) };
      writeFileSync(join(root, ".era-dependency-environment.json"), JSON.stringify(altered));
      expect(() => runInNewContext(environmentVerificationSource({ ...expected, receiptDigest: altered.receiptDigest }, image), { ...context })).toThrow(/resource profile evidence/);
    }
    const compilerSpec = makeEnvironmentSpec({ ...specInput(), oracles: [{ ...specInput().oracles[0], argv: ["node", "scripts/delivery-v2/probes/compiler-program.mjs", "/inputs/program", "positive"] }] });
    const compilerReceipt = makeEnvironmentReceipt({ spec: compilerSpec, volume: "fixture", inventory: inspectDependencyTree(root), probes: probes(), oracles: [{ id: "behavior", exitCode: 0, passed: 2, failed: 0, compilerProfile: COMPILER_RESOURCE_PROFILE }], observedAt: "fixture" });
    for (const compilerProfile of [undefined, { ...COMPILER_RESOURCE_PROFILE, oldSpaceMiB: 4096 }]) {
      const { receiptDigest: _digest, ...body } = { ...compilerReceipt, oracles: [{ ...compilerReceipt.oracles[0], compilerProfile }] };
      void _digest;
      const altered = { ...body, receiptDigest: fingerprint(canonicalJson(body)) };
      writeFileSync(join(root, ".era-dependency-environment.json"), JSON.stringify(altered));
      expect(verifyEnvironmentReceipt(altered)).toBe(false);
      expect(() => runInNewContext(environmentVerificationSource({ key: compilerSpec.key, contentDigest: altered.contentDigest, receiptDigest: altered.receiptDigest }, image), { ...context })).toThrow(/resource profile evidence/);
    }
    writeFileSync(join(root, ".era-dependency-environment.json"), JSON.stringify(attestation));
    writeFileSync(join(root, "payload.js"), "corrupt");
    expect(() => runInNewContext(environmentVerificationSource(expected, image), { ...context })).toThrow(/content changed/);
    writeFileSync(join(root, "payload.js"), "original");
    expect(() => runInNewContext(environmentVerificationSource(expected, "sha256:" + "2".repeat(64)), { ...context })).toThrow(/receipt mismatch/);
    const forgedSpec = { ...spec, checks: { behavior: { ...spec.checks!.behavior, assertions: 1 } } };
    const { key: originalKey, ...forgedSpecBody } = forgedSpec;
    forgedSpec.key = fingerprint(canonicalJson(forgedSpecBody));
    expect(forgedSpec.key).not.toBe(originalKey);
    const { receiptDigest: originalReceiptDigest, ...forgedReceiptBody } = { ...attestation, spec: forgedSpec };
    const forgedReceipt = { ...forgedReceiptBody, receiptDigest: fingerprint(canonicalJson(forgedReceiptBody)) };
    expect(forgedReceipt.receiptDigest).not.toBe(originalReceiptDigest);
    expect(verifyEnvironmentReceipt(forgedReceipt)).toBe(false);
    writeFileSync(join(root, ".era-dependency-environment.json"), JSON.stringify(forgedReceipt));
    expect(() => runInNewContext(environmentVerificationSource({ ...expected, key: forgedSpec.key, receiptDigest: forgedReceipt.receiptDigest }, image), { ...context })).toThrow(/check bindings invalid/);
    const altered = { ...attestation, probes: { ...attestation.probes, nativeExecuted: false } };
    const { receiptDigest: oldDigest, ...body } = altered;
    const forgery = { ...body, receiptDigest: fingerprint(canonicalJson(body)) };
    expect(forgery.receiptDigest).not.toBe(oldDigest);
    writeFileSync(join(root, ".era-dependency-environment.json"), JSON.stringify(forgery));
    expect(() => runInNewContext(environmentVerificationSource({ ...expected, receiptDigest: forgery.receiptDigest }, image), { ...context })).toThrow(/validation evidence incomplete/);
  });
  it("checks an existing volume before create and uses an offline read-only mount", async () => {
    const dependencies = environmentReference(receipt()), calls: string[][] = [], id = "a".repeat(64);
    const run = (args: string[]) => { calls.push(args); return { status: 0, stderr: "", stdout: args[0] === "volume" ? dependencies.volume : args[0] === "create" ? id : args[0] === "inspect" ? "exited 0" : args[0] === "start" ? JSON.stringify({ ok: true, ...dependencies.environment }) : "" }; };
    expect((await verifyManagedEnvironment({ image, dependencies, run })).ok).toBe(true);
    expect(verifyManagedEnvironmentSync({ image, dependencies, run }).ok).toBe(true);
    const args = environmentProbeArgs({ image, dependencies, name: "fixture" });
    expect(args).toContain("--pull=never");expect(args).toContain("no-new-privileges");
    expect(args).toContain("type=volume,source=" + dependencies.volume + ",target=/deps,readonly,volume-nocopy");
    expect(calls.filter(row => row[0] === "rm")).toHaveLength(2);
  });
  it("refuses a missing volume without accidentally creating it or a container", async () => {
    const calls: string[][] = [], dependencies = environmentReference(receipt());
    const run = (args: string[]) => { calls.push(args); return { status: 1, stdout: "", stderr: "missing" }; };
    expect((await verifyManagedEnvironment({ image, dependencies, run })).ok).toBe(false);
    expect(calls).toHaveLength(1);
    expect(readImageBinding({ boundary: makeBoundaryConfig({ image, dependencies }), backend_id: "codex-exec-sdk", docker: run }).binding).toBeNull();
    expect(calls.every(row => row[0] === "volume")).toBe(true);
  });
  it("rechecks dependency contents even when native binding facts were memoized", async () => {
    const dependencies = environmentReference(receipt()), calls: string[][] = [], id = "b".repeat(64);
    let corrupt = false;
    const run = async (args: string[]) => {
      calls.push(args);
      if (args[0] === "volume") return { status: 0, stdout: dependencies.volume, stderr: "", error: null };
      if (args[0] === "create") return { status: 0, stdout: id, stderr: "", error: null };
      if (args[0] === "start") return { status: corrupt ? 1 : 0, stdout: JSON.stringify({ ok: true, ...dependencies.environment }), stderr: corrupt ? "content changed" : "", error: null };
      return { status: 0, stderr: "", error: null, stdout: args[0] === "inspect" ? "exited 0" : args[0] === "image" ? image : args[0] === "run" ? JSON.stringify({ task_brief_version: 1, sdk: { "codex-exec-sdk": "fixture" }, battery_digest: "fixture" }) : "" };
    };
    const docker = { run, runSync: () => ({ status: 0, stdout: "", stderr: "", error: null }), async *lines() { yield ""; } };
    const runtime = createContainerRuntime({ boundary: makeBoundaryConfig({ image, dependencies, synthetic: true }), hostRoot: temp(), workRoot: temp(), docker });
    expect(await runtime.binding("codex-exec-sdk")).not.toBeNull();
    corrupt = true;
    expect(await runtime.binding("codex-exec-sdk")).toBeNull();
    const before = calls.length, candidate = { root: temp(), candidate_id: "fixture", generation: "C1" };
    expect((await runtime.typecheckExecutor({ run_id: "r-env", candidate, include: ["src/a.ts"] })).ok).toBe(false);
    await expect(runtime.checkExecutor({ run_id: "r-env", candidate })).rejects.toThrow(/environment refused/);
    expect(calls.slice(before).some(row => row[0] === "volume" && row[1] === "create")).toBe(false);
  });
});

describe("policy/recipe preflight before provisioning", () => {
  it("rejects oversized oracle arguments before any install or evidence directory", async () => {
    const recipe = recipeFixture();recipe.oracles[0].argv.push("x".repeat(20000));
    const policy = JSON.parse(readFileSync(recipe.policyFile, "utf8"));policy.checks.specs.behavior.argv = recipe.oracles[0].argv;
    writeFileSync(recipe.policyFile, JSON.stringify(policy));const calls: string[][] = [];
    await expect(stageCheckerEnvironment({ recipe, docker: { run: async (args: string[]) => { calls.push(args);throw new Error("no Docker"); } } })).rejects.toThrow(/Windows command-line transport/);
    expect(calls).toEqual([]);expect(realFs.existsSync(recipe.evidence)).toBe(false);
  });
  it.each(["name-only", "argv", "assertions", "missing-count", "input", "missing-policy"])("refuses %s with zero Docker calls and no evidence directory", async defect => {
    const recipe = recipeFixture();
    const policy = JSON.parse(readFileSync(recipe.policyFile, "utf8"));
    if (defect === "name-only") recipe.oracles[0].id = "self-test";
    if (defect === "argv") policy.checks.specs.behavior.argv.push("--self-test");
    if (defect === "assertions") policy.checks.specs.behavior.expected.assertions = 1;
    if (defect === "missing-count") delete policy.checks.specs.behavior.expected.assertions;
    if (defect === "input") recipe.oracles[0].inputs["oracle.mjs"] = hash("different executable");
    writeFileSync(recipe.policyFile, JSON.stringify(policy));
    if (defect === "missing-policy") recipe.policyFile = "";
    const calls: string[][] = [];
    const docker = { run: async (args: string[]) => { calls.push(args); throw new Error("must not reach Docker"); } };
    await expect(stageCheckerEnvironment({ recipe, docker })).rejects.toThrow(/policy|mismatch/);
    expect(calls).toEqual([]);
    expect(realFs.existsSync(recipe.evidence)).toBe(false);
  });
  it("binds exact assertions and bytes in the key; a changed policy cannot reuse an earlier expected key", async () => {
    const recipe = recipeFixture(), first = planCheckerEnvironment(recipe);
    expect(first.spec.checks?.behavior).toEqual({ argv: ["node", "oracle.mjs"], assertions: 2, inputs: { "oracle.mjs": hash("oracle") } });
    const policy = JSON.parse(readFileSync(recipe.policyFile, "utf8"));
    policy.checks.specs.behavior.expected.assertions = 3; recipe.oracles[0].assertions = 3;
    writeFileSync(recipe.policyFile, JSON.stringify(policy));
    expect(planCheckerEnvironment(recipe).spec.key).not.toBe(first.spec.key);
    await expect(provisionCheckerDependencies({ recipe, expectedKey: first.spec.key })).rejects.toThrow(/exact reviewed/);
  });
  it("mounts a pinned positive fixture read-only at the real candidate argument", async () => {
    const recipe = recipeFixture(), fixture = "fixtures/positive", file = fixture + "/eslint.config.mjs";
    mkdirSync(join(recipe.program.root, fixture), { recursive: true });writeFileSync(join(recipe.program.root, file), "fixture");
    const files = { ...recipe.program.files, [file]: hash("fixture") };
    const oracle = { ...recipe.oracles[0], argv: ["node", "oracle.mjs", "/candidate"], candidateFixture: fixture, inputs: { ...recipe.oracles[0].inputs, [file]: hash("fixture") } };
    const configured = { ...recipe, program: { ...recipe.program, files }, oracles: [oracle] };
    const policy = JSON.parse(readFileSync(recipe.policyFile, "utf8"));policy.checks.specs.behavior.argv = oracle.argv;
    writeFileSync(recipe.policyFile, JSON.stringify(policy));
    const docker = dockerFixture(configured);
    await stageCheckerEnvironment({ recipe: configured, docker, nonce: "positive" });
    expect(docker.calls.some(args => args.includes("type=volume,source=era-v2-deps-inputs-positive,volume-subpath=program/fixtures/positive,target=/candidate,readonly,volume-nocopy"))).toBe(true);
    const moved = { ...configured, evidence: join(recipe.root, "untouched"), oracles: [{ ...oracle, candidateFixture: "../outside" }] };
    const before = docker.calls.length;
    await expect(stageCheckerEnvironment({ recipe: moved, docker })).rejects.toThrow(/oracles/);
    expect(docker.calls).toHaveLength(before);
  });
});

function recipeFixture() {
  const root = temp(), program = join(root, "program"), pnpm = join(root, "tool");
  mkdirSync(program);mkdirSync(join(pnpm, "bin"), { recursive: true });mkdirSync(join(pnpm, "dist"));
  writeFileSync(join(root, "package.json"), "{}");writeFileSync(join(root, "pnpm-lock.yaml"), "lock");
  writeFileSync(join(pnpm, "package.json"), '{"name":"pnpm","version":"10.16.0","bin":{"pnpm":"bin/pnpm.cjs"}}');writeFileSync(join(pnpm, "bin", "pnpm.cjs"), "tool");writeFileSync(join(pnpm, "dist", "pnpm.cjs"), "bundle");
  const files = { "package.json": hash("{}"), "pnpm-lock.yaml": hash("lock"), "oracle.mjs": hash("oracle") };
  writeFileSync(join(program, "package.json"), "{}");writeFileSync(join(program, "pnpm-lock.yaml"), "lock");writeFileSync(join(program, "oracle.mjs"), "oracle");
  const policyFile = join(root, "policy.json");
  const oracle = specInput().oracles[0];
  writeFileSync(policyFile, JSON.stringify({ checks: { specs: { [oracle.id]: { kind: "command", argv: oracle.argv, expected: { assertions: oracle.assertions } } }, inputs: ["oracle.mjs"] } }));
  return { ...specInput(), policyFile, root, program: { root: program, files }, pnpm: { root: pnpm, digest: pinnedToolDigest(pnpm) }, receipts: join(root, "receipts"), evidence: join(root, "evidence") };
}

function dockerFixture(recipe: ReturnType<typeof recipeFixture>, options: { failInstall?: boolean; installStdout?: string; incomplete?: boolean; zeroOracle?: boolean } = {}) {
  const calls: string[][] = [], containers = new Map<string, string[]>(), volumes = new Map<string, string>();let serial = 0;
  const spec = planCheckerEnvironment(recipe).spec;
  const entries = [
    { path: "package.json", kind: "file", mode: 33188, uid: 10001, gid: 10001, size: 2, sha256: spec.packageDigest.slice(7) },
    { path: "pnpm-lock.yaml", kind: "file", mode: 33188, uid: 10001, gid: 10001, size: 4, sha256: spec.lockDigest.slice(7) },
  ];
  const inventory = { schema: "delivery-v2/dependency-inventory@1", ok: !options.incomplete, digest: hash(JSON.stringify(entries)), entries, metadata: [], errors: options.incomplete ? [{ path: "node_modules/missing", code: "ENOENT" }] : [] };
  const inputs: { args: string[]; input: string }[] = [];
  return { calls, volumes, inputs, async run(args: string[], runOptions: { input?: string; timeout?: number } = {}) {
    calls.push([...args]);if (runOptions.input !== undefined) inputs.push({ args, input: runOptions.input });let stdout = "", status: number | null = 0, stderr = "";
    if (args[0] === "image") stdout = image + " linux/amd64";
    else if (args[0] === "volume" && args[1] === "create") { const label = args.find(arg => arg.startsWith("era.dependency.staging="))!.split("=")[1];volumes.set(args.at(-1)!, label); }
    else if (args[0] === "volume" && args[1] === "inspect") stdout = args[3].includes(".Labels") ? volumes.get(args.at(-1)!) || "" : args.at(-1)!;
    else if (args[0] === "volume" && args[1] === "rm") volumes.delete(args.at(-1)!);
    else if (args[0] === "volume" && args[1] === "ls") stdout = [...volumes.keys()].filter(name => new RegExp(args[args.indexOf("--filter") + 1].slice(5)).test(name)).join("\n");
    else if (args[0] === "create") { stdout = (++serial).toString(16).padStart(64, "0");containers.set(stdout, args); }
    else if (args[0] === "exec") stdout = JSON.stringify({ ready: true, proxyUid: 10002, firewall: "uid-proxy-only@1", allowHosts: ["registry.npmjs.org"] });
    else if (args[0] === "inspect") stdout = "exited 0";
    else if (args[0] === "start" && args.includes("--attach")) {
      const command = containers.get(args.at(-1)!)!, at = command.indexOf("-e"), source = at < 0 ? runOptions.input || "" : command[at + 1];
      if (source.includes("const inspect =")) stdout = JSON.stringify(inventory);
      else if (source.includes("const expected=")) { const expected = JSON.parse(source.match(/const expected=(.*?);const receiptFile/u)![1]);stdout = JSON.stringify({ ok: true, ...expected }); }
      else if (source.includes("compilerNegativeControl:true")) stdout = JSON.stringify(probes());
      else if (source.includes("--frozen-lockfile")) { stdout = options.installStdout || ""; if (options.failInstall) { status = 1;stderr = "install fixture failure"; } }
      else if (at < 0) {
        const oracle = recipe.oracles.find(row => JSON.stringify(command.slice(command.indexOf(image) + 1)) === JSON.stringify(row.argv));
        const count = oracle?.assertions ?? 2;
        stdout = options.zeroOracle ? "0 of 0 checks passed" : `${count} of ${count} checks passed`;
      }
      else stdout = "{}";
    }
    return { status: status as number | null, stdout, stderr, error: null as string | null };
  } };
}

async function interruptedValidationFixture(compiler = false) {
  const recipe = recipeFixture();
  if (compiler) {
    const file = "scripts/delivery-v2/probes/compiler-program.mjs";
    mkdirSync(join(recipe.program.root, "scripts/delivery-v2/probes"), { recursive: true });
    writeFileSync(join(recipe.program.root, file), "compiler probe");
    Object.assign(recipe.program.files, { [file]: hash("compiler probe") });
    recipe.oracles.push({ id: "full-program-positive", argv: ["node", file, "/inputs/program", "positive"], assertions: 1, inputs: { ...recipe.program.files } });
  }
  const docker = dockerFixture(recipe), delegate = docker.run.bind(docker), spec = planCheckerEnvironment(recipe).spec;
  docker.run = async (args, options) => {
    if (args[0] === "create" && args.at(-1) === "-" && args.at(-2) === "node") {
      // Preserve the actual pre-fix failure shape, including its exact original
      // source. No Docker process is launched by this fixture.
      args.splice(args.indexOf("-i"), 1);args.splice(-1, 1, "-e", targetProbeSource(spec));
      return { status: null, stdout: "", stderr: "", error: "ENAMETOOLONG" };
    }
    return delegate(args, options);
  };
  await expect(stageCheckerEnvironment({ recipe, docker, nonce: "interrupted" })).rejects.toThrow(/ENAMETOOLONG/);
  docker.run = delegate;
  const outcome = JSON.parse(readFileSync(join(recipe.evidence, "outcome.json"), "utf8"));
  const inventory = JSON.parse(readFileSync(join(recipe.evidence, "inventory.before.json"), "utf8"));
  const input = { recipe: { ...recipe, evidence: join(recipe.root, "continued") }, priorEvidence: recipe.evidence, expectedKey: spec.key, expectedVolume: outcome.stagedVolumeRetained, expectedInventoryDigest: inventory.digest };
  const plan = planCheckerValidationContinuation(input);
  return { original: recipe, docker, input: { ...input, expectedEvidenceDigest: plan.evidenceDigest, docker, nonce: "continuation" }, plan };
}

describe("post-install validation continuation", () => {
  async function extensionFixture() {
    const f = await interruptedValidationFixture(true);
    const root = join(f.original.root, "extended-program");
    realFs.cpSync(f.original.program.root, root, { recursive: true });
    mkdirSync(join(root, "src"));writeFileSync(join(root, "src/Widget.jsx"), "export const answer = 42;");
    const files = { ...f.original.program.files, "src/Widget.jsx": hash("export const answer = 42;") };
    const recipe = { ...f.input.recipe, program: { root, files }, oracles: f.original.oracles.map(row => row.id === "full-program-positive" ? { ...row, inputs: { ...files } } : row) };
    return { ...f, next: { ...f.input, recipe, priorRecipe: f.original, expectedPriorKey: f.input.expectedKey, expectedKey: planCheckerEnvironment(recipe).spec.key } };
  }
  it("rebinds only an explicitly reviewed source extension, preserving dependencies and all previous obligations without installation", async () => {
    const f = await extensionFixture(), before = f.docker.calls.length;
    expect(f.next.expectedKey).not.toBe(f.input.expectedKey);
    const plan = planCheckerValidationContinuation(f.next);
    expect(plan.closureExtension).toMatchObject({ sourceEnvironmentKey: f.input.expectedKey, targetEnvironmentKey: f.next.expectedKey, addedInputs: [{ path: "src/Widget.jsx" }] });
    const result = await resumeCheckerValidation(f.next);
    if (!("receipt" in result) || !result.receipt) throw new Error("Expected verified continuation receipt");
    expect(result.receipt.spec.key).toBe(f.next.expectedKey);
    expect(result.receipt.volume).toBe(f.input.expectedVolume);
    expect(verifyEnvironmentReceipt(result.receipt)).toBe(true);
    expect(f.docker.calls.slice(before).some(args => args.join(" ").includes("--frozen-lockfile") || args.includes("bridge"))).toBe(false);
    expect(readFileSync(join(f.original.program.root, "oracle.mjs"), "utf8")).toBe("oracle");
    expect(realFs.existsSync(join(f.original.program.root, "src/Widget.jsx"))).toBe(false);
  });
  it.each(["source-key", "dependency", "existing-input", "assertions", "missing-positive-pin", "published"])("refuses source extension %s drift before Docker", async defect => {
    const f = await extensionFixture(), before = f.docker.calls.length;
    if (defect === "source-key") f.next.expectedPriorKey = hash("wrong");
    if (defect === "dependency") f.next.recipe.nodeVersion = "v22.24.0";
    if (defect === "existing-input") {
      writeFileSync(join(f.next.recipe.program.root, "oracle.mjs"), "changed");
      f.next.recipe.program.files["oracle.mjs"] = hash("changed");
    }
    if (defect === "assertions") f.next.recipe.oracles.find(row => row.id === "full-program-positive")!.assertions = 2;
    if (defect === "missing-positive-pin") Reflect.deleteProperty(f.next.recipe.oracles.find(row => row.id === "full-program-positive")!.inputs, "src/Widget.jsx");
    if (defect === "published") {
      const spec = planCheckerEnvironment(f.original).spec;
      writeEnvironmentReceipt(f.original.receipts, makeEnvironmentReceipt({ spec, volume: f.input.expectedVolume, inventory: { ok: true, digest: f.input.expectedInventoryDigest }, probes: probes(), oracles: spec.oracles.map((row: { id: string; assertions: number }) => ({ id: row.id, exitCode: 0, passed: row.assertions, failed: 0, compilerProfile: COMPILER_RESOURCE_PROFILE })), observedAt: "fixture" }));
    }
    if (defect !== "existing-input") f.next.expectedKey = planCheckerEnvironment(f.next.recipe).spec.key;
    await expect(resumeCheckerValidation(f.next)).rejects.toThrow();
    expect(f.docker.calls).toHaveLength(before);
    expect(realFs.existsSync(f.next.recipe.evidence)).toBe(false);
  });
  it("validates the exact retained volume without install, proxy, provider, or store mounts", async () => {
    const f = await interruptedValidationFixture(), before = f.docker.calls.length;
    const priorOutcome = readFileSync(join(f.original.evidence, "outcome.json"), "utf8");
    const result = await resumeCheckerValidation(f.input);
    expect(result).toMatchObject({ reused: false, dependencies: { volume: f.input.expectedVolume } });
    expect("receipt" in result && verifyEnvironmentReceipt(result.receipt)).toBe(true);
    const calls = f.docker.calls.slice(before), mounts = calls.flatMap(args => args.filter(arg => arg.startsWith("type=volume,")));
    expect(calls.filter(args => args[0] === "volume" && args[1] === "create").map(args => args.at(-1))).toEqual(["era-v2-deps-inputs-continuation"]);
    expect(calls.some(args => args.join(" ").includes("--frozen-lockfile") || args.includes("bridge") || args.some(arg => arg.startsWith("container:")))).toBe(false);
    expect(mounts.some(value => value.includes("target=/pnpm-store"))).toBe(false);
    expect(calls.filter(args => args[0] === "create").every(args => args.includes("none") && args.includes("--read-only"))).toBe(true);
    const writableDependencies = calls.filter(args => args.includes("type=volume,source=" + f.input.expectedVolume + ",target=/deps,volume-nocopy"));
    expect(writableDependencies).toHaveLength(1);expect(writableDependencies[0].join(" ")).toContain("flag:'wx'");
    expect(readFileSync(join(f.original.evidence, "outcome.json"), "utf8")).toBe(priorOutcome);
    expect(JSON.parse(readFileSync(join(f.input.recipe.evidence, "outcome.json"), "utf8"))).toMatchObject({ completed: true, continuedValidation: true, installed: false, storeCleanupConfirmed: true });
    expect(JSON.parse(readFileSync(join(f.input.recipe.evidence, "continuation-plan.json"), "utf8"))).toMatchObject({ environmentKey: f.input.expectedKey, evidenceDigest: f.plan.evidenceDigest, hostSources: { "stage-checker-environment.mjs": expect.stringMatching(/^sha256:/u) } });
  });
  it.each(["key", "volume", "inventory", "journal", "outcome", "program"])("refuses changed %s evidence before Docker", async defect => {
    const f = await interruptedValidationFixture(), before = f.docker.calls.length;
    if (defect === "key") f.input.expectedKey = hash("another");
    if (defect === "volume") f.input.expectedVolume = "other-volume";
    if (defect === "inventory") f.input.expectedInventoryDigest = hash("another");
    if (defect === "journal") {
      const file = join(f.original.evidence, "001.json"), row = JSON.parse(readFileSync(file, "utf8"));row.extra = "changed";writeFileSync(file, JSON.stringify(row));
    }
    if (defect === "outcome") {
      const file = join(f.original.evidence, "outcome.json"), row = JSON.parse(readFileSync(file, "utf8"));row.completed = true;writeFileSync(file, JSON.stringify(row));
    }
    if (defect === "program") writeFileSync(join(f.original.program.root, "oracle.mjs"), "changed");
    await expect(resumeCheckerValidation(f.input)).rejects.toThrow();
    expect(f.docker.calls).toHaveLength(before);expect(realFs.existsSync(f.input.recipe.evidence)).toBe(false);
  });
  it.each(["ownership", "attached", "inventory", "oracle", "store-cleanup"])("refuses %s failure without publishing or reinstalling", async defect => {
    const f = await interruptedValidationFixture(), delegate = f.docker.run.bind(f.docker), containers = new Map<string, string[]>(), before = f.docker.calls.length;
    f.docker.run = async (args, options) => {
      const result = await delegate(args, options);
      if (args[0] === "create") containers.set(result.stdout, args);
      if (defect === "ownership" && args[0] === "volume" && args[1] === "inspect" && args.at(-1) === f.input.expectedVolume) result.stdout = "foreign";
      if (defect === "attached" && args[0] === "container") result.stdout = "f".repeat(64);
      const command = containers.get(args.at(-1)!) || [];
      if (defect === "inventory" && args[0] === "start" && command.some(value => value.includes("const inspect ="))) { const row = JSON.parse(result.stdout);row.digest = hash("changed");result.stdout = JSON.stringify(row); }
      if (defect === "oracle" && args[0] === "start" && command.at(-1) === "oracle.mjs") result.stdout = "0 of 0 checks passed";
      if (defect === "store-cleanup" && args[0] === "volume" && args[1] === "rm" && args.at(-1) === f.plan.store) result.status = 1;
      return result;
    };
    await expect(resumeCheckerValidation(f.input)).rejects.toThrow();
    expect(findEnvironmentReceipt(f.original.receipts, f.input.expectedKey)).toBeNull();
    expect(f.docker.calls.slice(before).some(args => args.join(" ").includes("--frozen-lockfile"))).toBe(false);
    expect(JSON.parse(readFileSync(join(f.input.recipe.evidence, "outcome.json"), "utf8"))).toMatchObject({ completed: false });
  });
  it("transports large frozen manifests and receipts intact without putting them in Windows argv", async () => {
    const recipe = recipeFixture();
    for (let index = 0; index < 350; index++) {
      const name = "input-" + String(index).padStart(4, "0") + "-" + "x".repeat(80) + ".ts";
      writeFileSync(join(recipe.program.root, name), "input");Object.assign(recipe.program.files, { [name]: hash("input") });Object.assign(recipe.oracles[0].inputs, { [name]: hash("input") });
    }
    const spec = planCheckerEnvironment(recipe).spec, source = targetProbeSource(spec), docker = dockerFixture(recipe);
    expect(source.length).toBeGreaterThan(32767);
    const result = await stageCheckerEnvironment({ recipe, docker, nonce: "large" });
    expect(docker.inputs.some(row => row.input === source && row.args.includes("--interactive"))).toBe(true);
    expect(docker.inputs.some(row => row.input === JSON.stringify(result.receipt))).toBe(true);
    expect(docker.calls.every(args => args.reduce((size, arg) => size + arg.length * 2 + 3, 1024) < 30000)).toBe(true);
    const warm = environmentProbeArgs({ image, dependencies: result.dependencies, name: "large-warm" });
    expect(warm.reduce((size, arg) => size + arg.length * 2 + 3, 1024)).toBeLessThan(30000);
    expect(warm.join(" ")).not.toContain("input-0000");
    // Execute a large serialized payload over the same local child-process stdin
    // seam on Windows; no Docker, provider, package code or network is involved.
    const payload = JSON.stringify(spec), actual = await runProcess(process.execPath, ["-"], { input: "process.stdout.write(require('node:crypto').createHash('sha256').update(" + JSON.stringify(payload) + ").digest('hex'))", timeout: 5000 });
    expect(actual.status).toBe(0);expect(actual.stdout).toBe(hash(payload).slice(7));
  });
});

describe("separate staging, without Docker or network", () => {
  it("uses the approved checker profile without changing frozen oracle argv, installer memory or other limits", async () => {
    const recipe = recipeFixture(), file = "scripts/delivery-v2/probes/compiler-program.mjs";
    mkdirSync(join(recipe.program.root, "scripts/delivery-v2/probes"), { recursive: true });writeFileSync(join(recipe.program.root, file), "oracle");
    Object.assign(recipe.program.files, { [file]: hash("oracle") });Object.assign(recipe.oracles[0].inputs, { [file]: hash("oracle") });
    recipe.oracles[0].argv = ["node", file, "/inputs/program", "positive"];
    const policy = JSON.parse(readFileSync(recipe.policyFile, "utf8"));policy.checks.specs.behavior.argv = recipe.oracles[0].argv;policy.checks.inputs.push(file);writeFileSync(recipe.policyFile, JSON.stringify(policy));
    const docker = dockerFixture(recipe), before = planCheckerEnvironment(recipe).spec.key;
    const result = await stageCheckerEnvironment({ recipe, docker, nonce: "compiler-profile" });
    const command = docker.calls.find(args => args[0] === "create" && args.includes(file))!;
    expect(command.slice(-4)).toEqual(recipe.oracles[0].argv);
    expect(command[command.indexOf("--memory") + 1]).toBe("8g");expect(command[command.indexOf("--cpus") + 1]).toBe("2");expect(command[command.indexOf("--pids-limit") + 1]).toBe("256");
    expect(command).toContain("/tmp:rw,uid=10001,gid=10001,size=2g");expect(command).toContain("NODE_OPTIONS=--max-old-space-size=6144");
    const installer = docker.calls.find(args => args[0] === "create" && args.some(value => value.includes("'--frozen-lockfile'")))!;
    expect(installer[installer.indexOf("--memory") + 1]).toBe("4g");
    expect(docker.calls.filter(args => args.some(value => value.startsWith("NODE_OPTIONS=")))).toHaveLength(1);
    expect(result.receipt.spec.key).toBe(before);expect(result.receipt.oracles[0]).toMatchObject({ compilerProfile: COMPILER_RESOURCE_PROFILE });
  });
  it("diagnoses only pinned leaf payloads without becoming reusable environment evidence", async () => {
    const recipe = recipeFixture();
    const lock = "lockfileVersion: '9.0'\n\npackages:\n  '@fixture/native@1.2.3':\n    resolution: {integrity: sha512-YWJj}\n    cpu: [x64]\n    os: [linux]\n\nsnapshots:\n  '@fixture/native@1.2.3':\n    optional: true\n";
    writeFileSync(join(recipe.root, "pnpm-lock.yaml"), lock);writeFileSync(join(recipe.program.root, "pnpm-lock.yaml"), lock);
    recipe.program.files["pnpm-lock.yaml"] = hash(lock);
    const selection = selectDiagnosticPackages(lock, ["@fixture/native@1.2.3"]);
    expect(selection.lockfile).toContain("resolution: {integrity: sha512-YWJj}");
    expect(selection.lockfile).toContain("optional: true");
    const docker = dockerFixture(recipe), run = docker.run.bind(docker), containers = new Map<string, string[]>();
    docker.run = async (args, options) => {
      const result = await run(args, options);
      if (args[0] === "create") containers.set(result.stdout, args);
      if (args[0] === "start" && args.includes("--attach")) {
        const command = containers.get(args.at(-1)!)!, source = command[command.indexOf("-e") + 1];
        if (source?.includes("const inspect =")) {
          const inventory = JSON.parse(result.stdout);
          inventory.entries[0].sha256 = selection.packageDigest.slice(7);inventory.entries[1].sha256 = selection.lockDigest.slice(7);
          result.stdout = JSON.stringify(inventory);
        } else if (source?.includes("delivery-v2/package-facts@1")) result.stdout = JSON.stringify({ ok: true, packages: [{ name: "@fixture/native", native: [{ path: "native", elfClass: 2, machine: 62 }] }] });
      }
      return result;
    };
    const result = await stageCheckerPackageDiagnostic({ recipe, docker, packages: ["@fixture/native@1.2.3"], nonce: "diagnostic" });
    expect(result.receiptEligible).toBe(false);expect(result.volume).toContain("era-v2-diag-");
    expect(findEnvironmentReceipt(recipe.receipts, planCheckerEnvironment(recipe).spec.key)).toBeNull();
    expect(docker.calls.some(args => args.join(" ").includes("compilerNegativeControl:true"))).toBe(false);
    expect(docker.calls.some(args => args.join(" ").includes("--reporter=ndjson"))).toBe(true);
    const install = docker.calls.find(args => args[0] === "create" && args.join(" ").includes("--frozen-lockfile"))!;
    expect(install).toContain("/tmp:rw,uid=10001,gid=10001,size=2g");
    expect(install.join(" ")).toContain("fs.statfsSync(path)");
    expect(install.join(" ")).toContain("--config.fetch-retries=0");
    expect(install.join(" ")).not.toContain("--config.fetch-timeout");
    expect(install.join(" ")).toContain("--store-dir=/pnpm-store");
    const outcome = JSON.parse(readFileSync(join(recipe.evidence, "outcome.json"), "utf8"));
    expect(outcome).toMatchObject({ completed: true, diagnostic: true, receiptEligible: false, ownedContainers: [] });
    expect(realFs.existsSync(join(recipe.evidence, "diagnostic-packages.json"))).toBe(true);
  });
  it("refuses diagnostic dependency edges, foreign resolutions and undeclared packages before Docker", async () => {
    const lock = "lockfileVersion: '9.0'\n\npackages:\n  '@fixture/native@1.2.3':\n    resolution: {integrity: sha512-YWJj}\n\nsnapshots:\n  '@fixture/native@1.2.3':\n    optional: true\n";
    for (const bad of [lock.replace("optional: true", "dependencies:\n      other: 1.0.0"), lock.replace("integrity: sha512-YWJj", "tarball: https://other.invalid/pkg.tgz"), lock.replace("1.2.3", "2.0.0")]) expect(() => selectDiagnosticPackages(bad, ["@fixture/native@1.2.3"])).toThrow();
    for (const comment of ["  # comment", "# comment", "  # comment: with colon"]) {
      const concealedEdge = lock.replace("optional: true", "optional: true\n" + comment + "\n    dependencies:\n      other: 1.0.0");
      expect(() => selectDiagnosticPackages(concealedEdge, ["@fixture/native@1.2.3"])).toThrow(/dependency edges|unsupported/);
      const concealedResolution = lock.replace("    resolution: {integrity: sha512-YWJj}", "    resolution: {integrity: sha512-YWJj}\n" + comment + "\n    dependencies:\n      other: 1.0.0");
      expect(() => selectDiagnosticPackages(concealedResolution, ["@fixture/native@1.2.3"])).toThrow(/supported integrity-pinned leaf/);
    }
    expect(() => selectDiagnosticPackages(lock, ["@fixture/native@latest"])).toThrow();
    const recipe = recipeFixture(), docker = dockerFixture(recipe);
    await expect(stageCheckerPackageDiagnostic({ recipe, docker, packages: undefined })).rejects.toThrow(/selection required/);
    await expect(stageCheckerPackageDiagnostic({ recipe, docker, packages: ["@fixture/native@1.2.3"] })).rejects.toThrow(/lockfile version/);
    expect(docker.calls).toEqual([]);expect(realFs.existsSync(recipe.evidence)).toBe(false);
  });
  it("disables legacy destructive setup before any process is invoked", async () => {
    await expect(provisionCheckerDependencies()).rejects.toThrow(/explicit reviewed recipe/i);
    const recipe = recipeFixture();
    await expect(provisionCheckerDependencies({ recipe, expectedKey: hash("unreviewed") })).rejects.toThrow(/exact reviewed/);
    expect(realFs.existsSync(recipe.evidence)).toBe(false);
  });
  it("publishes only after complete/native/compiler/oracle gates; warm reuse never installs", async () => {
    const recipe = recipeFixture(), docker = dockerFixture(recipe);
    const cold = await stageCheckerEnvironment({ recipe, docker, nonce: "cold" });
    expect(cold.reused).toBe(false);expect(verifyEnvironmentReceipt(cold.receipt)).toBe(true);
    expect(docker.calls.some(row => row.join(" ").includes("--ignore-scripts"))).toBe(true);
    expect(docker.calls.filter(row => row[0] === "volume" && row[1] === "rm").every(row => /^(era-v2-deps-inputs-|era-v2-pnpm-store-)/u.test(row.at(-1)!))).toBe(true);
    const installer = docker.calls.find(row => row[0] === "create" && row.join(" ").includes("--frozen-lockfile"))!;
    expect(installer).toContain("type=volume,source=era-v2-pnpm-store-cold,target=/pnpm-store,volume-nocopy");
    expect(installer).toContain("/tmp:rw,uid=10001,gid=10001,size=2g");
    expect(installer.join(" ")).toContain("1200000");expect(installer.join(" ")).not.toContain("--store-dir=/tmp");
    const checks = docker.calls.filter(row => row[0] === "create" && (row.join(" ").includes("const inspect =") || row.join(" ").includes("compilerNegativeControl:true")));
    expect(checks.every(row => !row.some(value => value.includes("target=/pnpm-store")))).toBe(true);
    expect(JSON.parse(readFileSync(join(recipe.evidence, "outcome.json"), "utf8"))).toMatchObject({ storeCleanupConfirmed: true, storeVolumeRetained: null });
    expect(docker.calls.flatMap(row => row.filter(value => value.startsWith("type=volume,"))).every(value => value.includes("volume-nocopy"))).toBe(true);
    const before = docker.calls.length;
    const warm = await stageCheckerEnvironment({ recipe: { ...recipe, evidence: join(recipe.root, "warm") }, docker, nonce: "warm" });
    expect(warm.reused).toBe(true);expect(warm.receipt.receiptDigest).toBe(cold.receipt.receiptDigest);
    expect(docker.calls.slice(before).some(row => row[0] === "create" && row.join(" ").includes("--frozen-lockfile"))).toBe(false);
    expect(docker.calls.slice(before).some(row => row[0] === "volume" && row[1] === "create")).toBe(false);
  });
  it("preserves install failure, retains staging, cleans only owned containers and publishes nothing", async () => {
    const recipe = recipeFixture(), docker = dockerFixture(recipe, { failInstall: true });
    await expect(stageCheckerEnvironment({ recipe, docker, nonce: "failed" })).rejects.toThrow(/install fixture failure/);
    const outcome = JSON.parse(readFileSync(join(recipe.evidence, "outcome.json"), "utf8"));
    expect(outcome.completed).toBe(false);expect(outcome.sourceVolumesReplaced).toBe(false);expect(outcome.providerJobs).toBe(0);
    expect(outcome.storeVolumeRetained).toBe("era-v2-pnpm-store-failed");expect(outcome.storeCleanupConfirmed).toBe(false);
    expect(findEnvironmentReceipt(recipe.receipts, planCheckerEnvironment(recipe).spec.key)).toBeNull();
    const removed = docker.calls.filter(row => row[0] === "rm").map(row => row.at(-1));expect(new Set(removed).size).toBe(removed.length);
    expect(docker.calls.filter(row => row[0] === "volume" && row[1] === "rm").every(row => row.at(-1)!.includes("inputs"))).toBe(true);
  });
  it("retains optional fetch diagnostics after a zero installer exit while refusing the incomplete tree", async () => {
    const diagnostic = JSON.stringify({ name: "pnpm:skipped-optional-dependency", level: "debug", reason: "resolution_failure", details: "fixture fetch failure", package: { name: "@openai/codex-linux-x64" } }) + "\n";
    const recipe = recipeFixture(), docker = dockerFixture(recipe, { incomplete: true, installStdout: diagnostic });
    await expect(stageCheckerEnvironment({ recipe, docker, nonce: "optional-failure" })).rejects.toThrow(/incomplete/);
    const installer = docker.calls.find(row => row[0] === "create" && row.join(" ").includes("--frozen-lockfile"))!;
    expect(installer.join(" ")).toContain("'--reporter=ndjson'");
    const evidence = realFs.readdirSync(recipe.evidence).filter(name => /^\d+\.json$/u.test(name)).map(name => JSON.parse(readFileSync(join(recipe.evidence, name), "utf8")));
    expect(evidence.some(row => row.status === 0 && row.stdout === diagnostic)).toBe(true);
    expect(findEnvironmentReceipt(recipe.receipts, planCheckerEnvironment(recipe).spec.key)).toBeNull();
    const outcome = JSON.parse(readFileSync(join(recipe.evidence, "outcome.json"), "utf8"));
    expect(outcome.completed).toBe(false);expect(outcome.ownedContainers).toEqual([]);
    expect(outcome.stagedVolumeRetained).toContain("optional-failure");
  });
  it.each(["inventory", "inputs"])("does not publish after unconfirmed %s cleanup", async phase => {
    const recipe = recipeFixture(), docker = dockerFixture(recipe), delegate = docker.run.bind(docker);
    let removals = 0;
    docker.run = async (args, options) => {
      const result = await delegate(args, options);
      if ((phase === "inventory" && args[0] === "rm" && ++removals === 5) ||
          (phase === "inputs" && args[0] === "volume" && args[1] === "rm")) return { ...result, status: 1, stderr: "cleanup fixture failure" };
      return result;
    };
    await expect(stageCheckerEnvironment({ recipe, docker, nonce: "cleanup" })).rejects.toThrow(/quiescent|cleanup fixture/);
    expect(findEnvironmentReceipt(recipe.receipts, planCheckerEnvironment(recipe).spec.key)).toBeNull();
    const outcome = JSON.parse(readFileSync(join(recipe.evidence, "outcome.json"), "utf8"));
    expect(outcome.completed).toBe(false);
    expect(outcome.secondary.length).toBeGreaterThan(0);
    const removed = docker.calls.filter(row => row[0] === "rm").map(row => row.at(-1));
    expect(new Set(removed).size).toBe(removed.length);
  });
  it.each(["remove", "still-present"])("does not publish after unconfirmed pnpm store cleanup: %s", async phase => {
    const recipe = recipeFixture(), docker = dockerFixture(recipe), delegate = docker.run.bind(docker);
    let removalRequested = false;
    docker.run = async (args, options) => {
      const result = await delegate(args, options);
      if (args[0] === "volume" && args[1] === "rm" && args.at(-1) === "era-v2-pnpm-store-store-cleanup") {
        removalRequested = true;
        if (phase === "remove") return { ...result, status: 1, stderr: "store removal refused" };
      }
      if (phase === "still-present" && removalRequested && args[0] === "volume" && args[1] === "ls") return { ...result, stdout: "era-v2-pnpm-store-store-cleanup" };
      return result;
    };
    await expect(stageCheckerEnvironment({ recipe, docker, nonce: "store-cleanup" })).rejects.toThrow(/store cleanup/);
    expect(findEnvironmentReceipt(recipe.receipts, planCheckerEnvironment(recipe).spec.key)).toBeNull();
    expect(JSON.parse(readFileSync(join(recipe.evidence, "outcome.json"), "utf8"))).toMatchObject({ completed: false, storeCleanupConfirmed: false, storeVolumeRetained: "era-v2-pnpm-store-store-cleanup" });
  });
  it("does not rebuild or replace a cached volume when fresh verification refuses it", async () => {
    const recipe = recipeFixture(), docker = dockerFixture(recipe);
    await stageCheckerEnvironment({ recipe, docker, nonce: "cold" });
    const before = docker.calls.length, delegate = docker.run.bind(docker);
    docker.run = async (args, options) => {
      const result = await delegate(args, options);
      return args[0] === "volume" && args[1] === "inspect" ? { ...result, status: 1, stderr: "missing cached volume" } : result;
    };
    await expect(stageCheckerEnvironment({ recipe: { ...recipe, evidence: join(recipe.root, "refused") }, docker, nonce: "warm" })).rejects.toThrow(/cached environment refused/);
    expect(docker.calls.slice(before).some(row => row[0] === "create" || row[0] === "rm" || (row[0] === "volume" && ["create", "rm"].includes(row[1])))).toBe(false);
  });
  it.each([{ incomplete: true }, { zeroOracle: true }])("does not publish an incomplete tree or inconclusive oracle: %j", async options => {
    const recipe = recipeFixture(), docker = dockerFixture(recipe, options);
    await expect(stageCheckerEnvironment({ recipe, docker, nonce: "rejected" })).rejects.toThrow(/incomplete|inconclusive/);
    expect(findEnvironmentReceipt(recipe.receipts, planCheckerEnvironment(recipe).spec.key)).toBeNull();
    expect(docker.calls.some(row => row[0] === "create" && row.join(" ").includes("fs.writeFileSync('/deps/.era-dependency-environment.json'"))).toBe(false);
  });
  it("rejects moving oracle bytes and host dependency copying before any Docker call", () => {
    const recipe = recipeFixture();writeFileSync(join(recipe.program.root, "oracle.mjs"), "changed");
    expect(() => planCheckerEnvironment(recipe)).toThrow(/changed/);
    expect(() => planCheckerEnvironment({ ...recipe, program: { ...recipe.program, files: { ...recipe.program.files, "node_modules/private.js": hash("secret") } } })).toThrow();
  });
});
