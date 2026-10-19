import { Script } from "node:vm";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { assembleRuntimeImage, freezeRuntimeImageContext, planCodexRuntimeOverlay, runtimeOverlaySource, runtimeImageVerificationSource } from "../../scripts/delivery-v2/runtime-image.mjs";

const version = "0.156.1", baseImage = "sha256:" + "7".repeat(64);
function input() {
  const platforms = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-arm64", "win32-x64"];
  const packages: Array<{ name: string; version: string; dependencies: Record<string, string>; optionalDependencies: Record<string, string> }> = [{ name: "@openai/codex-sdk", version, dependencies: { "@openai/codex": version }, optionalDependencies: {} },
    { name: "@openai/codex", version, dependencies: {}, optionalDependencies: Object.fromEntries(platforms.map(p => ["@openai/codex-" + p, "npm:@openai/codex@" + version + "-" + p])) },
    ...platforms.map(p => ({ name: "@openai/codex", version: version + "-" + p, dependencies: {}, optionalDependencies: {} })),
  ];
  const metadata = packages.map(p => ({ ...p, scripts: {} as Record<string, string>, dist: { integrity: "sha512-" + Buffer.alloc(64, 1).toString("base64"), tarball: "https://registry.npmjs.org/" + p.name + "/-/" + p.name.split("/")[1] + "-" + p.version + ".tgz" } }));
  return { baseImage, fromVersion: "0.144.1", toVersion: version, metadata,
    lockfile: "lockfileVersion: '9.0'\n\npackages:\n" + metadata.map(p => "  '" + p.name + "@" + p.version + "':\n    resolution: {integrity: " + p.dist.integrity + "}\n\n").join("") };
}

describe("explicit runtime overlay", () => {
  it("freezes the trusted source closure and refuses archive drift before creating a context", () => {
    const root = mkdtempSync(join(tmpdir(), "era-runtime-fixture-"));
    try {
      const names = ["scripts/delivery/runner.mjs", "scripts/delivery-v2/worker/runner.mjs", "scripts/delivery-v2/worker/LICENSE.moby", "scripts/pm/shared/a.mjs", "scripts/pm/mutations.mjs", "scripts/pm/lint.mjs"];
      for (const name of names) { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), "original"); }
      const archive = join(root, "runtime.tar"); writeFileSync(archive, "verified fixture");
      const staged = { ok: true, baseImage, archive, archiveDigest: "sha256:" + createHash("sha256").update(readFileSync(archive)).digest("hex") };
      const context = join(root, "build");
      const frozen = freezeRuntimeImageContext({ repoRoot: root, staged, context });
      expect(frozen.files.map(f => f.path).sort()).toEqual(names.sort());
      writeFileSync(join(root, names[0]), "later unrelated edit");
      expect(readFileSync(join(context, names[0]), "utf8")).toBe("original");
      writeFileSync(archive, "tampered");
      expect(() => freezeRuntimeImageContext({ repoRoot: root, staged, context: join(root, "second") })).toThrow(/verified/);
      expect(() => freezeRuntimeImageContext({ repoRoot: root, staged, context })).toThrow(/fresh/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("binds exactly the Linux SDK/CLI/native closure to the frozen lock", () => {
    const plan = planCodexRuntimeOverlay(input());
    expect(plan.selected.map(p => p.target)).toEqual(["@openai/codex-sdk", "@openai/codex", "@openai/codex-linux-x64"]);
    expect(plan.selected.map(p => p.version)).toEqual([version, version, version + "-linux-x64"]);
    expect(plan.lockDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
  it.each(["node:22", "sha256:bad", "sha256:" + "7".repeat(64) + "\nRUN curl evil"])("refuses an unpinned or injected base %s", image => {
    expect(() => planCodexRuntimeOverlay({ ...input(), baseImage: image })).toThrow();
  });
  it("refuses changing a package outside the reviewed graph", () => {
    const candidate = input(); candidate.metadata[2].name = "@other/codex";
    expect(() => planCodexRuntimeOverlay(candidate)).toThrow(/unexpected/);
  });
  it("refuses missing or duplicate platform evidence", () => {
    const candidate = input(); candidate.metadata[2] = candidate.metadata[3];
    expect(() => planCodexRuntimeOverlay(candidate)).toThrow(/complete/);
  });
  it("refuses an unpinned tarball or a lock integrity disagreement", () => {
    const candidate = input(); candidate.metadata[0].dist.tarball = "https://other.example/a.tgz";
    expect(() => planCodexRuntimeOverlay(candidate)).toThrow(/source/);
    const drift = input(); drift.metadata[0].dist.integrity = "sha512-" + Buffer.alloc(64, 2).toString("base64");
    expect(() => planCodexRuntimeOverlay(drift)).toThrow(/frozen lock/);
  });
  it.each(["preinstall", "install", "postinstall", "prepare"])("does not gain lifecycle permission for %s", hook => {
    const candidate = input(); candidate.metadata[0].scripts[hook] = "node side-effect.js";
    expect(() => planCodexRuntimeOverlay(candidate)).toThrow(/lifecycle/);
  });
  it("refuses a changed transitive edge despite an otherwise valid pin", () => {
    const candidate = input(); candidate.metadata[1].optionalDependencies["@openai/codex-linux-x64"] = "npm:@openai/codex@0.144.1-linux-x64";
    expect(() => planCodexRuntimeOverlay(candidate)).toThrow(/optional edge/);
  });
  it("produces syntactically valid bounded staging code without executing SDKs", () => {
    const source = runtimeOverlaySource(planCodexRuntimeOverlay(input()));
    expect(() => new Script(source)).not.toThrow();
    expect(source).not.toContain("startThread");
    expect(source).not.toContain("prepareSubscription");
    expect(source).toContain("archive integrity mismatch");
    expect(source).toContain("overlay would retain removed package files");
  });
  it.each(["success", "copy-failed", "commit-failed", "cleanup-failed", "running-container", "ancestry-drift", "tag-collision", "inventory-failed"])("local Engine assembly: %s", async scenario => {
    const root = mkdtempSync(join(tmpdir(), "era-runtime-engine-"));
    const calls: string[][] = [], container = "a".repeat(64), image = "sha256:" + "b".repeat(64);
    const config = { User: "10001:10001", Env: ["PATH=/bin"], Cmd: ["node"], Volumes: null };
    const base = { Id: baseImage, Os: "linux", Architecture: "amd64", Config: config, RootFS: { Layers: ["base-layer"] } };
    let payload: Buffer | undefined;
    try {
      for (const name of ["scripts/delivery/a.mjs", "scripts/delivery-v2/a.mjs", "scripts/pm/shared/a.mjs", "scripts/pm/mutations.mjs", "scripts/pm/lint.mjs"]) { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), "trusted source"); }
      const archive = join(root, "runtime.tar"); writeFileSync(archive, Buffer.from([0, 255, 128, 1]));
      const staged = { ok: true, baseImage, targetVersion: version, archive, archiveDigest: "sha256:" + createHash("sha256").update(readFileSync(archive)).digest("hex") };
      const runtimeEvidence = { baseImage, toVersion: version, packages: ["@openai/codex-sdk", "@openai/codex", "@openai/codex-linux-x64"].map(target => ({ target, version, after: { digest: "sha256:" + "c".repeat(64) } })) };
      writeFileSync(join(root, "runtime-evidence.json"), JSON.stringify(runtimeEvidence));
      expect(() => new Script(runtimeImageVerificationSource({ frozen: { baseImage, files: [] }, runtimeEvidence, targetVersion: version }))).not.toThrow();
      const docker = { async run(args: string[], options: { input?: Buffer|string } = {}) {
        calls.push(args);
        let stdout = "", status = 0;
        if (args[0] === "image" && args[1] === "inspect") stdout = JSON.stringify(args.at(-1) === baseImage ? base : { ...base, Id: image, RootFS: { Layers: [scenario === "ancestry-drift" ? "wrong-layer" : "base-layer", "new-layer"] } });
        if (args[0] === "image" && args[1] === "ls" && scenario === "tag-collision") stdout = "existing";
        if (args[0] === "create") stdout = container;
        if (args[0] === "cp" && Buffer.isBuffer(options.input)) { payload = options.input; if (scenario === "copy-failed") status = 1; }
        if (args[0] === "inspect") stdout = JSON.stringify({ Image: baseImage, State: { Status: scenario === "running-container" ? "running" : "created", Running: scenario === "running-container", Pid: 0 }, HostConfig: { NetworkMode: "none" }, Mounts: [] });
        if (args[0] === "commit") { stdout = image; if (scenario === "commit-failed") status = 1; }
        if (args[0] === "rm" && scenario === "cleanup-failed") status = 1;
        if (args[0] === "ps" && scenario === "cleanup-failed") stdout = container;
        if (args[0] === "run") { stdout = JSON.stringify({ ok: true, version, packages: 3, sourceFiles: 5, providerJobs: 0 }); if (scenario === "inventory-failed") status = 1; }
        return { stdout, status, stderr: "", error: null };
      } };
      const operation = assembleRuntimeImage({ repoRoot: root, staged, evidence: join(root, "evidence"), tag: "era-delivery-test:fixture", docker });
      if (scenario === "success") expect(await operation).toMatchObject({ ok: true, image, assembly: "local-engine-copy-commit@1" });
      else await expect(operation).rejects.toThrow();
      expect(calls.some(args => ["build", "buildx", "pull", "start", "exec"].includes(args[0]))).toBe(false);
      for (const args of calls.filter(a => a[0] === "run")) expect(args).toEqual(expect.arrayContaining(["--network", "none", "--read-only", "--pull=never", "--cap-drop", "ALL", image]));
      if (scenario !== "tag-collision") {
        expect(payload).toEqual(readFileSync(archive));
        expect(calls.find(args => args[0] === "create")).toEqual(expect.arrayContaining(["--pull=never", "--network", "none", "--cap-drop", "ALL", baseImage]));
        expect(calls.filter(args => args[0] === "rm")).toEqual([["rm", container]]);
      }
      if (["running-container", "copy-failed", "tag-collision"].includes(scenario)) expect(calls.some(args => args[0] === "commit")).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
