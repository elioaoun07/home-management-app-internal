// Only builtins and --version; no SDK initialization, credentials or provider job.
import { createRequire } from "node:module";
const hostRequire = createRequire(import.meta.url);

export function requiredNativePackages(packageJson) {
  const manifest = JSON.parse(String(packageJson)), result = {};
  for (const name of ["@openai/codex-sdk", "@anthropic-ai/claude-agent-sdk"]) {
    const versions = [manifest.dependencies?.[name], manifest.devDependencies?.[name], manifest.optionalDependencies?.[name]].filter(value => value !== undefined);
    if (!versions.length) continue;
    if (versions.some(value => !/^\d+\.\d+\.\d+$/u.test(String(value)) || value !== versions[0])) throw new Error("native SDK requires one exact manifest version: " + name);
    result[name] = versions[0];
  }
  return result;
}

export function validNativePackages(packages) {
  return packages && typeof packages === "object" && !Array.isArray(packages) && Object.entries(packages).every(([name, version]) => ["@openai/codex-sdk", "@anthropic-ai/claude-agent-sdk"].includes(name) && /^\d+\.\d+\.\d+$/u.test(String(version)));
}

export function validNativeRuntimeFacts(required, facts) {
  return Object.entries(required).every(([name, version]) => facts?.[name]?.sdkVersion === version && facts[name].executed === true && facts[name].exitCode === 0 && typeof facts[name].cliVersion === "string" && /^\d+\.\d+\.\d+$/u.test(facts[name].cliVersion) && (name !== "@openai/codex-sdk" || facts[name].cliVersion === version));
}

export function probeNativeRuntimes(required, loadModules = hostRequire, dependencyRoot = "/deps/node_modules") {
  const fs = loadModules("node:fs"), path = loadModules("node:path"), { createRequire } = loadModules("node:module"), { spawnSync } = loadModules("node:child_process");
  if (typeof dependencyRoot !== "string" || !path.isAbsolute(dependencyRoot) || path.resolve(dependencyRoot) !== dependencyRoot || path.basename(dependencyRoot) !== "node_modules") throw new Error("native dependency root must be a normalized absolute node_modules directory");
  const inside = file => file.startsWith(dependencyRoot + path.sep);
  const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
  const facts = {};
  for (const [name, version] of Object.entries(required)) {
    const sdkRoot = fs.realpathSync(path.join(dependencyRoot, name));
    if (!inside(sdkRoot)) throw new Error("native SDK escaped dependency root: " + name);
    const sdk = read(path.join(sdkRoot, "package.json"));
    if (sdk.name !== name || sdk.version !== version) throw new Error("native SDK identity mismatch: " + name);
    const entry = sdk.exports?.["."]?.import || sdk.exports?.["."]?.default || sdk.main;
    if (typeof entry !== "string" || !entry || path.resolve(sdkRoot, entry).indexOf(sdkRoot + path.sep) !== 0) throw new Error("native SDK entry unavailable: " + name);
    // Resolve from the actual SDK entry, not /deps: pnpm keeps transitive
    // packages beside their declaring dependency, and package.json is unexported.
    const sdkRequire = createRequire(fs.realpathSync(path.resolve(sdkRoot, entry)));
    let executable, cliVersion;
    if (name === "@openai/codex-sdk") {
      const cliFile = sdkRequire.resolve("@openai/codex/package.json"), cli = read(cliFile);
      const nativeFile = createRequire(cliFile).resolve("@openai/codex-linux-x64/package.json"), native = read(nativeFile);
      if (cli.version !== version || native.version !== version + "-linux-x64") throw new Error("Codex native identity mismatch");
      const root = path.join(path.dirname(nativeFile), "vendor", "x86_64-unknown-linux-musl");
      const current = path.join(root, "bin", "codex");
      executable = fs.existsSync(current) && fs.existsSync(path.join(root, "codex-package.json")) ? current : path.join(root, "codex", "codex");
      cliVersion = version;
    } else if (name === "@anthropic-ai/claude-agent-sdk") {
      const nativeFile = sdkRequire.resolve("@anthropic-ai/claude-agent-sdk-linux-x64/package.json"), native = read(nativeFile);
      if (native.version !== version || !/^\d+\.\d+\.\d+$/u.test(String(sdk.claudeCodeVersion))) throw new Error("Claude native identity mismatch");
      executable = path.join(path.dirname(nativeFile), "claude");
      cliVersion = sdk.claudeCodeVersion;
    } else throw new Error("unsupported native SDK: " + name);
    if (!inside(fs.realpathSync(executable)) || !fs.statSync(executable).isFile()) throw new Error("native executable absent or escaped: " + name);
    const result = spawnSync(executable, ["--version"], { cwd: "/tmp", env: { HOME: "/tmp", PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8" }, timeout: 15000, maxBuffer: 65536, encoding: "utf8" });
    const stdout = String(result.stdout || "").trim();
    if (result.error || result.status !== 0 || !stdout.split(/\s+/u).includes(cliVersion)) throw new Error("native --version failed: " + name + ": " + (result.error?.message || result.stderr || stdout));
    facts[name] = { sdkVersion: version, cliVersion, executed: true, exitCode: result.status, executable, stdout };
  }
  return facts;
}
