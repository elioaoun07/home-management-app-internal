// DLV-133 trusted local setup. Nothing here is called by readiness reads.
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { canonicalJson, fingerprint } from "./contracts.mjs";
import { parseTestCounts } from "./checks.mjs";
import { bindEnvironmentChecks, makeEnvironmentSpec, makeEnvironmentReceipt, environmentReference, findEnvironmentReceipt, writeEnvironmentReceipt, verifyManagedEnvironment, targetProbeSource, ENVIRONMENT_FILE } from "./dependency-environment.mjs";
import { dependencyInventorySource } from "./worker/dependency-inventory.mjs";
import { selectDiagnosticPackages, diagnosticPackageFactsSource } from "./checker-package-diagnostic.mjs";
import { inspectValidationContinuation, inspectCompilerClosureExtension } from "./checker-validation-continuation.mjs";
import { COMPILER_RESOURCE_PROFILE, isCompilerCommand, compilerResourceFlags } from "./compiler-resources.mjs";

const hash = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const offline = ["--pull=never", "--network", "none", "--user", "10001:10001", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "256", "--memory", "4g", "--cpus", "2", "--tmpfs", "/tmp:rw,uid=10001,gid=10001,size=2g", "--env", "HOME=/tmp", "--env", "CI=true"];
const mount = (volume, target, writable = false) => ["--mount", "type=volume,source=" + volume + ",target=" + target + (writable ? "" : ",readonly") + ",volume-nocopy"];
const checkerFlags = (volume, inputs) => [...offline, ...mount(volume, "/deps"), ...mount(inputs, "/inputs"), "--mount", "type=volume,source=" + volume + ",volume-subpath=node_modules,target=/inputs/program/node_modules,readonly,volume-nocopy", "--workdir", "/inputs/program"];
function assertArgvBudget(args, reserve = 0) {
  // Conservative upper bound includes Windows quoting/escaping and executable.
  if (args.reduce((size, arg) => size + String(arg).length * 2 + 3, reserve + 1024) > 30000) throw new Error("Docker argv exceeds bounded Windows command-line transport; use stdin");
}

/** @typedef {{root:string, image:string, nodeVersion:string, pnpmVersion:string,
 * packages:Record<string,string>, oracles:Array<{id:string,argv:string[],assertions:number,inputs:Record<string,string>}>,
 * program:{root:string,files:Record<string,string>}, pnpm:{root:string,digest:string},
 * receipts:string,evidence:string,policyFile:string}} CheckerEnvironmentRecipe */

function closedFile(root, name, expected) {
  if (typeof name !== "string" || !name || name.includes("\\") || name.split("/").some(part => !part || part === "." || part === "..") || /(^|\/)(?:\.env(?:\.|$)|\.git(?:\/|$)|\.delivery(?:\/|$)|\.pm(?:\/|$)|node_modules(?:\/|$)|\.npmrc$)/u.test(name)) throw new Error("unsafe verification input: " + name);
  const base = resolve(root);
  const file = resolve(base, name);
  if (relative(base, file).startsWith("..")) throw new Error("input escapes root");
  let cursor = base;
  if (lstatSync(cursor).isSymbolicLink()) throw new Error("linked input root");
  for (const part of name.split("/")) { cursor = join(cursor, part); if (lstatSync(cursor).isSymbolicLink()) throw new Error("linked verification input: " + name); }
  if (!lstatSync(file).isFile() || hash(readFileSync(file)) !== expected) throw new Error("verification input changed: " + name);
  return file;
}

export function pinnedToolDigest(root) {
  const files = [];
  let bytes = 0;
  function walk(dir, prefix = "") {
    if (lstatSync(dir).isSymbolicLink()) throw new Error("linked pnpm tool input");
    for (const name of readdirSync(dir).sort()) {
      const file = join(dir, name), rel = prefix + name, stat = lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error("linked pnpm tool input");
      if (stat.isDirectory()) walk(file, rel + "/");
      else if (stat.isFile()) {
        bytes += stat.size;
        if (bytes > 128 * 1024 * 1024 || files.length >= 20000) throw new Error("pnpm tool input exceeds verifier limits");
        files.push({ path: rel, digest: hash(readFileSync(file)) });
      }
      else throw new Error("unsupported pnpm tool input");
    }
  }
  walk(root);
  return fingerprint(canonicalJson(files));
}

/** Inspect explicit frozen inputs only; no Docker, temp directory, policy or job.
 * @param {CheckerEnvironmentRecipe} recipe */
export function planCheckerEnvironment(recipe) {
  if (!recipe?.policyFile) throw new Error("proposed policy file required before preparation");
  const policy = JSON.parse(readFileSync(recipe.policyFile, "utf8"));
  const checks = bindEnvironmentChecks({ oracles: recipe.oracles || [], checks: policy.checks, inputs: recipe.program?.files || {} });
  if (!recipe?.root || !recipe.program?.root || !recipe.program.files || !recipe.pnpm?.root || !recipe.receipts) throw new Error("recipe needs frozen root, explicit program manifest, pinned pnpm tool and receipt directory");
  for (const name of ["package.json", "pnpm-lock.yaml"]) {
    const stat = lstatSync(join(recipe.root, name));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("frozen input must be a regular file: " + name);
  }
  const packageJson = readFileSync(join(recipe.root, "package.json"));
  const lockfile = readFileSync(join(recipe.root, "pnpm-lock.yaml"));
  const project = JSON.parse(packageJson);
  if (project.workspaces || project.pnpm || ["pnpm-workspace.yaml", ".pnpmfile.cjs", "pnpmfile.cjs", ".npmrc", ".pnpmrc", "patches"].some(name => existsSync(join(recipe.root, name)))) throw new Error("workspace, patch or pnpm hook configuration needs a separately supported recipe");
  const tool = JSON.parse(readFileSync(join(recipe.pnpm.root, "package.json"), "utf8"));
  if (tool.name !== "pnpm" || tool.version !== recipe.pnpmVersion || tool.bin?.pnpm !== "bin/pnpm.cjs") throw new Error("pnpm identity/version mismatch");
  const pnpmDigest = pinnedToolDigest(recipe.pnpm.root);
  if (pnpmDigest !== recipe.pnpm.digest) throw new Error("pnpm tool digest mismatch");
  const spec = makeEnvironmentSpec({ ...recipe, pnpmDigest, packageJson, lockfile, checks });
  for (const oracle of spec.oracles) assertArgvBudget(oracle.argv, 8192);
  if (recipe.program.files["package.json"] !== spec.packageDigest || recipe.program.files["pnpm-lock.yaml"] !== spec.lockDigest) throw new Error("program manifest and lockfile must match dependency inputs");
  for (const [name, digest] of Object.entries(recipe.program.files)) closedFile(recipe.program.root, name, digest);
  for (const oracle of spec.oracles) for (const [name, digest] of Object.entries(oracle.inputs)) {
    if (recipe.program.files[name] !== digest) throw new Error("oracle outside pinned program: " + name);
  }
  for (const oracle of spec.oracles) if (oracle.candidateFixture) {
    for (const [name, digest] of Object.entries(recipe.program.files)) if (name.startsWith(oracle.candidateFixture + "/") && oracle.inputs[name] !== digest) throw new Error("candidate fixture input not pinned: " + name);
  }
  return { spec, programDigest: fingerprint(canonicalJson(recipe.program.files)), effects: { registry: ["registry.npmjs.org"], install: "frozen Linux install; scripts and pnpmfile disabled", existingVolumes: "read-only, never replaced", newVolumes: "separate inputs, dependency staging and disposable pnpm store; failed store retained", policyWrites: false, providerJobs: 0 } };
}

// pnpm's default reporter hides transitive optional fetch failures even when
// their native binary is required here. Retain debug events in numbered evidence;
// inventory verification still refuses every missing target after a zero exit.
const installSource = `const fs=require('node:fs'),{spawn}=require('node:child_process');
for(const name of ['package.json','pnpm-lock.yaml'])fs.copyFileSync('/inputs/'+name,'/deps/'+name);
function storage(phase){console.log(JSON.stringify({name:'era:installer-filesystem',phase,filesystems:['/tmp','/deps','/pnpm-store'].map(path=>{const s=fs.statfsSync(path);return{path,type:s.type,blockSize:s.bsize,totalBytes:s.blocks*s.bsize,freeBytes:s.bfree*s.bsize,availableBytes:s.bavail*s.bsize}})}))}storage('before');
let expired=false,killTimer;const child=spawn(process.execPath,['/inputs/pnpm/bin/pnpm.cjs','install','--reporter=ndjson','--frozen-lockfile','--ignore-scripts','--ignore-pnpmfile','--prod=false','--package-import-method=copy','--store-dir=/pnpm-store','--registry=https://registry.npmjs.org/','--config.https-proxy=http://127.0.0.1:3128','--config.verify-store-integrity=true','--config.fetch-retries=0','--network-concurrency=4'],{cwd:'/deps',stdio:'inherit',env:{...process.env,NPM_CONFIG_USERCONFIG:'/dev/null',NPM_CONFIG_GLOBALCONFIG:'/dev/null'}});
const deadline=setTimeout(()=>{expired=true;child.kill('SIGTERM');killTimer=setTimeout(()=>{child.kill('SIGKILL');process.exit(124)},10000)},1200000);
const finish=code=>{clearTimeout(deadline);clearTimeout(killTimer);storage('after');process.exit(expired?124:(code??1))};child.once('error',()=>finish(1));child.once('exit',finish);`;

/**
 * Explicit owner-invoked preparation only. The injected Docker seam makes all
 * state/failure paths testable without a daemon, network or provider.
 */
export async function stageCheckerEnvironment({ recipe, docker, now = () => new Date().toISOString(), nonce = String(randomUUID()) }) {
  const result = await stageCheckerInputs({ recipe, docker, now, nonce });
  if ("diagnostic" in result) throw new Error("diagnostic cannot certify an environment");
  return result;
}

export async function stageCheckerPackageDiagnostic({ recipe, docker, packages, nonce = String(randomUUID()) }) {
  if (!Array.isArray(packages)) throw new Error("diagnostic package selection required");
  const result = await stageCheckerInputs({ recipe, docker, nonce, diagnosticPackages: packages });
  if (!("diagnostic" in result)) throw new Error("diagnostic did not execute");
  return result;
}

export function planCheckerValidationContinuation({ recipe, priorEvidence, expectedKey, expectedVolume, expectedInventoryDigest, priorRecipe = /** @type {CheckerEnvironmentRecipe|null} */ (null), expectedPriorKey = /** @type {string|null} */ (null) }) {
  const plan = planCheckerEnvironment(recipe);
  if (plan.spec.key !== expectedKey) throw new Error("Continuation requires the exact reviewed environment key");
  if (!priorRecipe && expectedPriorKey !== null) throw new Error("source recipe required for prior key");
  const source = priorRecipe ? planCheckerEnvironment(priorRecipe) : plan;
  const extension = priorRecipe ? inspectCompilerClosureExtension({ sourceRecipe: priorRecipe, sourceSpec: source.spec, targetRecipe: recipe, targetSpec: plan.spec, expectedSourceKey: expectedPriorKey }) : null;
  if (priorRecipe && findEnvironmentReceipt(priorRecipe.receipts, source.spec.key)) throw new Error("source closure extension cannot repurpose a published environment");
  const continuation = inspectValidationContinuation({ priorEvidence, expectedVolume, expectedInventoryDigest, spec: source.spec, installSource, probeSource: targetProbeSource(source.spec), failedArgs: (volume, inputs, sourceText) => ["create", ...checkerFlags(volume, inputs), source.spec.image, "node", "-e", sourceText] });
  const hostSources = Object.fromEntries(["stage-checker-environment.mjs", "checker-validation-continuation.mjs", "dependency-environment.mjs", "compiler-resources.mjs", "worker/dependency-inventory.mjs", "worker/native-runtime-probe.mjs", "contracts.mjs", "checks.mjs"].map(name => [name, hash(readFileSync(new URL(name, import.meta.url)))]));
  return { ...continuation, environmentKey: plan.spec.key, ...(extension ? { closureExtension: extension } : {}), programDigest: plan.programDigest, probeSourceDigest: hash(targetProbeSource(plan.spec)), compilerProfile: COMPILER_RESOURCE_PROFILE, hostSources };
}

export async function resumeCheckerValidation({ recipe, priorEvidence, expectedKey, expectedVolume, expectedInventoryDigest, expectedEvidenceDigest, docker, nonce = String(randomUUID()), now = () => new Date().toISOString(), priorRecipe = /** @type {CheckerEnvironmentRecipe|null} */ (null), expectedPriorKey = /** @type {string|null} */ (null) }) {
  const continuation = planCheckerValidationContinuation({ recipe, priorEvidence, expectedKey, expectedVolume, expectedInventoryDigest, priorRecipe, expectedPriorKey });
  if (continuation.evidenceDigest !== expectedEvidenceDigest) throw new Error("Continuation prior evidence changed or was not explicitly reviewed");
  if (resolve(recipe.evidence) === resolve(priorEvidence)) throw new Error("Continuation must preserve the original evidence directory");
  return stageCheckerInputs({ recipe, docker, nonce, now, continuation });
}

async function stageCheckerInputs({ recipe, docker, now = () => new Date().toISOString(), nonce = String(randomUUID()), diagnosticPackages = /** @type {string[]|undefined} */ (undefined), continuation = /** @type {ReturnType<typeof planCheckerValidationContinuation>|null} */ (null) }) {
  const plan = planCheckerEnvironment(recipe);
  const diagnostic = diagnosticPackages === undefined ? null : selectDiagnosticPackages(readFileSync(join(recipe.root, "pnpm-lock.yaml")), diagnosticPackages);
  if (diagnostic && diagnostic.sourceLockDigest !== plan.spec.lockDigest) throw new Error("diagnostic source lockfile changed after preflight");
  if (!/^[A-Za-z0-9-]{1,40}$/u.test(nonce)) throw new Error("invalid preparation nonce");
  if (!docker?.run || !recipe.evidence) throw new Error("preparation requires a Docker seam and fresh evidence directory");
  if (existsSync(recipe.evidence)) throw new Error("evidence directory already exists");
  mkdirSync(recipe.evidence, { recursive: true });
  let sequence = 0;
  const owned = new Set(), cleanupTried = new Set(), secondary = [];
  const volume = continuation?.volume || (diagnostic ? "era-v2-diag-" : "era-v2-deps-") + plan.spec.key.slice(7, 31) + "-" + nonce;
  const inputs = "era-v2-deps-inputs-" + nonce;
  const store = continuation?.store || "era-v2-pnpm-store-" + nonce;
  let inputsOwned = false, stagingOwned = false, storeOwned = false, storeRemoved = false, primary = null, receipt = null, staging = null, reused = false, diagnosticFacts = null;
  const save = (file, value) => writeFileSync(join(recipe.evidence, file), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  async function run(args, options) {
    assertArgvBudget(args);
    const result = await docker.run(args, options);
    if (args[0] === "create" && result.status === 0 && /^[a-f0-9]{64}$/u.test(result.stdout.trim())) owned.add(result.stdout.trim());
    if (args[0] === "rm" && owned.has(args.at(-1))) { cleanupTried.add(args.at(-1)); if (result.status === 0) owned.delete(args.at(-1)); }
    save(String(++sequence).padStart(3, "0") + ".json", { args, ...(options?.input === undefined ? {} : { inputSha256: hash(options.input), inputBytes: Buffer.byteLength(options.input) }), ...result });
    return result;
  }
  async function must(args, options) {
    const result = await run(args, options);
    if (result.status !== 0 || result.error) throw new Error("Docker operation failed: " + args.slice(0, 2).join(" ") + ": " + (result.error || result.stderr));
    return result;
  }
  async function remove(id) {
    if (!owned.has(id) || cleanupTried.has(id)) return;
    cleanupTried.add(id);
    try { await must(["rm", "-f", id]); owned.delete(id); }
    catch (error) { secondary.push("container cleanup unconfirmed: " + id + ": " + error.message); }
  }
  async function create(args) {
    const result = await must(["create", ...args]);
    const id = result.stdout.trim();
    if (!/^[a-f0-9]{64}$/u.test(id)) throw new Error("container creation uncertain; no retry");
    owned.add(id); return id;
  }
  async function start(id, timeout = 300000, input = /** @type {string|undefined} */ (undefined)) {
    const result = await run(["start", "--attach", ...(input === undefined ? [] : ["--interactive"]), id], { timeout, ...(input === undefined ? {} : { input }) });
    const state = await must(["inspect", "--format", "{{.State.Status}} {{.State.ExitCode}}", id]);
    if (result.status !== 0 || result.error || state.stdout.trim() !== "exited 0") throw new Error("container failed: " + id + ": " + result.stderr);
    return result;
  }
  async function once(flags, argv, input = /** @type {string|undefined} */ (undefined)) {
    const id = await create([...(input === undefined ? [] : ["-i"]), ...flags, plan.spec.image, ...argv]);
    let failed = false;
    try { return await start(id, 300000, input); }
    catch (error) { failed = true; throw error; }
    finally {
      await remove(id);
      if (owned.has(id) && !failed) throw new Error("preparation not quiescent: " + id);
    }
  }
  const checkFlags = () => checkerFlags(volume, inputs);
  try {
    if (diagnostic) save("diagnostic-plan.json", { ...diagnostic, environmentKey: plan.spec.key, receiptEligible: false });
    if (continuation) save("continuation-plan.json", continuation);
    const image = await must(["image", "inspect", "--format", "{{.Id}} {{.Os}}/{{.Architecture}}", plan.spec.image]);
    if (image.stdout.trim() !== plan.spec.image + " linux/amd64") throw new Error("target image/platform mismatch");
    const cached = diagnostic ? null : findEnvironmentReceipt(recipe.receipts, plan.spec.key);
    if (continuation && cached) throw new Error("continuation refused: environment already has a reusable receipt");
    if (cached) {
      const facts = await verifyManagedEnvironment({ image: plan.spec.image, dependencies: environmentReference(cached), run });
      if (!facts.ok) throw new Error("cached environment refused; no automatic rebuild: " + facts.reason);
      receipt = cached; reused = true;
    } else {
      if (continuation) {
        for (const name of [volume, store]) {
          if ((await must(["volume", "inspect", "--format", '{{index .Labels "era.dependency.staging"}}', name])).stdout.trim() !== continuation.originalNonce) throw new Error("retained volume ownership changed: " + name);
          if ((await must(["container", "ls", "--all", "--filter", "volume=" + name, "--format", "{{.ID}}"])).stdout.trim()) throw new Error("retained volume has attached containers: " + name);
        }
        stagingOwned = true; storeOwned = true;
      }
      for (const name of continuation ? [inputs] : [volume, inputs, store]) {
        if ((await must(["volume", "ls", "--filter", "name=^" + name + "$", "--format", "{{.Name}}"])).stdout.trim()) throw new Error("volume collision: " + name);
        await must(["volume", "create", "--label", "era.dependency.staging=" + nonce, name]);
        if ((await must(["volume", "inspect", "--format", '{{index .Labels "era.dependency.staging"}}', name])).stdout.trim() !== nonce) throw new Error("volume creation unconfirmed: " + name);
        if (name === inputs) inputsOwned = true;
        if (name === volume) stagingOwned = true;
        if (name === store) storeOwned = true;
      }
      staging = mkdtempSync(join(tmpdir(), "era-checker-inputs-"));
      writeFileSync(join(staging, "package.json"), diagnostic?.packageJson ?? readFileSync(join(recipe.root, "package.json")));
      writeFileSync(join(staging, "pnpm-lock.yaml"), diagnostic?.lockfile ?? readFileSync(join(recipe.root, "pnpm-lock.yaml")));
      if (hash(readFileSync(join(staging, "package.json"))) !== (diagnostic?.packageDigest ?? plan.spec.packageDigest) || hash(readFileSync(join(staging, "pnpm-lock.yaml"))) !== (diagnostic?.lockDigest ?? plan.spec.lockDigest)) throw new Error("manifest/lockfile changed during staging");
      if (!continuation) {
        cpSync(recipe.pnpm.root, join(staging, "pnpm"), { recursive: true, dereference: false, verbatimSymlinks: true });
        if (pinnedToolDigest(join(staging, "pnpm")) !== plan.spec.pnpmDigest) throw new Error("pnpm changed during staging");
      }
      mkdirSync(join(staging, "program", "node_modules"), { recursive: true });
      for (const oracle of diagnostic ? [] : plan.spec.oracles) if (oracle.candidateFixture) mkdirSync(join(staging, "program", oracle.candidateFixture, "node_modules"), { recursive: true });
      for (const [name, digest] of Object.entries(diagnostic ? {} : recipe.program.files)) {
        const source = closedFile(recipe.program.root, name, digest), destination = join(staging, "program", name);
        mkdirSync(dirname(destination), { recursive: true }); copyFileSync(source, destination);
        if (hash(readFileSync(destination)) !== digest) throw new Error("program changed during staging: " + name);
      }
      const seed = await create(continuation
        ? ["--pull=never", "--network", "none", "--user", "10001:10001", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "64", "--memory", "256m", "--cpus", "1", ...mount(inputs, "/inputs", true), plan.spec.image, "node", "-e", "process.exit(0)"]
        : ["--pull=never", "--network", "none", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--security-opt", "no-new-privileges", "--pids-limit", "64", "--memory", "256m", "--cpus", "1", ...mount(inputs, "/inputs", true), ...mount(volume, "/deps", true), ...mount(store, "/pnpm-store", true), plan.spec.image, "node", "-e", "const fs=require('node:fs');for(const root of ['/deps','/pnpm-store']){fs.chownSync(root,10001,10001);const s=fs.statSync(root);if(s.uid!==10001||s.gid!==10001||(s.mode&4095)!==493)throw Error('unsafe staging root: '+root);console.log(JSON.stringify({root,uid:s.uid,gid:s.gid,mode:s.mode&4095}));}"]);
      await must(["cp", staging + "/.", seed + ":/inputs"]); await start(seed); await remove(seed);
      if (!continuation) {
      const permission = `const fs=require('node:fs');if(process.getuid()!==10001||process.getgid()!==10001||process.version!==${JSON.stringify(plan.spec.nodeVersion)}||process.platform!=='linux'||process.arch!=='x64'||!process.report.getReport().header.glibcVersionRuntime||JSON.parse(fs.readFileSync('/inputs/pnpm/package.json','utf8')).version!==${JSON.stringify(plan.spec.pnpmVersion)})throw Error('offline target/tool mismatch');for(const root of ['/deps','/pnpm-store']){const f=root+'/.permission-probe';let made=false;try{fs.writeFileSync(f,'probe',{flag:'wx',mode:384});made=true;if(fs.readFileSync(f,'utf8')!=='probe')throw Error('readback')}finally{if(made)fs.unlinkSync(f)}if(fs.existsSync(f))throw Error('probe remains')}console.log('{"probeAbsent":true}');`;
      await once([...offline, ...mount(volume, "/deps", true), ...mount(store, "/pnpm-store", true), ...mount(inputs, "/inputs")], ["node", "-e", permission]);
      if (owned.size || secondary.length) throw new Error("staging cleanup not confirmed before network");
      const proxy = await create(["--pull=never", "--network", "bridge", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--cap-add", "NET_ADMIN", "--cap-add", "SETUID", "--cap-add", "SETGID", "--security-opt", "no-new-privileges", "--pids-limit", "64", "--memory", "128m", "--cpus", "0.5", plan.spec.image, "node", "/opt/era/scripts/delivery-v2/worker/egress.mjs", '["registry.npmjs.org"]']);
      await must(["start", proxy]);
      const ready = await must(["exec", proxy, "node", "-e", "fetch('http://127.0.0.1:3128/__era/ready',{signal:AbortSignal.timeout(5000)}).then(r=>r.json()).then(x=>{if(!x.ready||x.proxyUid!==10002||x.firewall!=='uid-proxy-only@1'||JSON.stringify(x.allowHosts)!=='[\"registry.npmjs.org\"]')throw Error('egress mismatch');console.log(JSON.stringify(x))}).catch(e=>{console.error(e.message);process.exitCode=1})"]);
      if (!JSON.parse(ready.stdout).ready) throw new Error("egress not ready");
      const installFlags = [...offline];
      installFlags.splice(installFlags.indexOf("--network"), 2, "--network", "container:" + proxy);
      const installer = await create([...installFlags, ...mount(inputs, "/inputs"), ...mount(volume, "/deps", true), ...mount(store, "/pnpm-store", true), "--workdir", "/deps", plan.spec.image, "node", "-e", installSource]);
      await start(installer, 1220000); await remove(installer); await remove(proxy);
      }
      if (owned.size || secondary.length) throw new Error("writers/egress not quiescent before validation");
      const before = JSON.parse((await once([...offline, ...mount(volume, "/deps")], ["node", "-e", dependencyInventorySource()])).stdout);
      save("inventory.before.json", before);
      if (diagnostic) {
        diagnosticFacts = JSON.parse((await once([...offline, ...mount(volume, "/deps")], ["node", "-e", diagnosticPackageFactsSource(diagnostic.packages)])).stdout);
        save("diagnostic-packages.json", diagnosticFacts);
      }
      if (!before.ok) throw new Error("dependency tree incomplete: " + JSON.stringify(before.errors));
      if (continuation && before.digest !== continuation.inventoryDigest) throw new Error("retained dependency inventory changed since completed install");
      for (const [name, expected] of [["package.json", diagnostic?.packageDigest ?? plan.spec.packageDigest], ["pnpm-lock.yaml", diagnostic?.lockDigest ?? plan.spec.lockDigest]]) {
        if (before.entries.find(entry => entry.path === name)?.sha256 !== expected.slice(7)) throw new Error("installed frozen input mismatch: " + name);
      }
      if (diagnostic) {
        if (!diagnosticFacts.ok) throw new Error("diagnostic package payload missing: " + JSON.stringify(diagnosticFacts));
      } else {
      const probeSource = targetProbeSource(plan.spec);
      save("target-probe.json", { source: probeSource, digest: hash(probeSource) });
      const probes = JSON.parse((await once(checkFlags(), ["node", "-"], probeSource)).stdout);
      const oracles = [];
      for (const oracle of plan.spec.oracles) {
        const flags = [...checkFlags()];
        if (isCompilerCommand(oracle.argv)) flags[flags.indexOf("--memory") + 1] = COMPILER_RESOURCE_PROFILE.containerMemory;
        flags.push(...compilerResourceFlags(oracle.argv));
        if (oracle.candidateFixture) flags.push("--mount", "type=volume,source=" + inputs + ",volume-subpath=program/" + oracle.candidateFixture + ",target=/candidate,readonly,volume-nocopy", "--mount", "type=volume,source=" + volume + ",volume-subpath=node_modules,target=/candidate/node_modules,readonly,volume-nocopy");
        const result = await once(flags, oracle.argv), counts = parseTestCounts(result.stdout + "\n" + result.stderr);
        if (counts.executed !== oracle.assertions || counts.selected !== oracle.assertions || counts.skipped !== 0 || counts.failed !== 0) throw new Error("oracle inconclusive: " + oracle.id);
        oracles.push({ id: oracle.id, exitCode: 0, passed: counts.executed, failed: counts.failed, programDigest: plan.programDigest, ...(isCompilerCommand(oracle.argv) ? { compilerProfile: COMPILER_RESOURCE_PROFILE } : {}) });
      }
      const after = JSON.parse((await once([...offline, ...mount(volume, "/deps")], ["node", "-e", dependencyInventorySource()])).stdout);
      save("inventory.after.json", after);
      if (!after.ok || before.digest !== after.digest) throw new Error("dependencies changed during validation");
      receipt = makeEnvironmentReceipt({ spec: plan.spec, volume, inventory: after, probes, oracles, observedAt: now() });
      save("receipt.proposed.json", receipt);
      await once([...offline, ...mount(volume, "/deps", true)], ["node", "-e", "const fs=require('node:fs');fs.writeFileSync('/deps/" + ENVIRONMENT_FILE + "',fs.readFileSync(0,'utf8'),{flag:'wx',mode:384});"], JSON.stringify(receipt));
      const verified = await verifyManagedEnvironment({ image: plan.spec.image, dependencies: environmentReference(receipt), run });
      if (!verified.ok) throw new Error("final environment attestation refused: " + verified.reason);
      }
    }
  } catch (error) { primary = error; }
  finally {
    for (const id of [...owned]) await remove(id);
    if (inputsOwned && !owned.size) { try { await must(["volume", "rm", inputs]); } catch (error) { secondary.push(error.message); } }
    if (staging) {
      try { const absolute = resolve(staging), rel = relative(resolve(tmpdir()), absolute); if (!rel || rel.startsWith("..")) throw new Error("staging cleanup target escaped temp root"); rmSync(absolute, { recursive: true, force: true }); }
      catch (error) { secondary.push("temporary input cleanup: " + error.message); }
    }
    if (storeOwned && !primary && !secondary.length && !owned.size) {
      try {
        if (continuation && (await must(["volume", "inspect", "--format", '{{index .Labels "era.dependency.staging"}}', store])).stdout.trim() !== continuation.originalNonce) throw new Error("retained store ownership changed");
        await must(["volume", "rm", store]);
        if ((await must(["volume", "ls", "--filter", "name=^" + store + "$", "--format", "{{.Name}}"])).stdout.trim()) throw new Error("pnpm store cleanup unconfirmed: " + store);
        storeRemoved = true;
      } catch (error) { secondary.push("pnpm store cleanup: " + error.message); }
    }
    // Publish reusable authority only after all owned containers and inputs have
    // confirmed cleanup. A failed attempt retains its separate staging volume.
    if (receipt && !reused && !primary && !secondary.length) {
      try { writeEnvironmentReceipt(recipe.receipts, receipt); }
      catch (error) { primary = error; }
    }
    try { save("outcome.json", { completed: Boolean(diagnostic ? diagnosticFacts?.ok : receipt) && !primary && !secondary.length, ...(diagnostic ? { diagnostic: true, receiptEligible: false } : {}), ...(continuation ? { continuedValidation: true, priorEvidenceDigest: continuation.evidenceDigest, installed: false } : {}), primary: primary?.message || null, secondary, ownedContainers: [...owned], sourceVolumesReplaced: false, stagedVolumeRetained: stagingOwned ? volume : null, storeVolume: storeOwned ? store : null, storeCleanupConfirmed: storeRemoved, storeVolumeRetained: storeOwned && !storeRemoved ? store : null, usedVolume: receipt?.volume || null, reused, providerJobs: 0 }); }
    catch (error) { secondary.push("outcome write: " + error.message); }
  }
  if (primary) throw primary;
  if (secondary.length) throw new Error(secondary.join("; "));
  if (diagnostic) return { diagnostic: true, receiptEligible: false, packages: diagnosticFacts, volume, evidence: recipe.evidence };
  return { reused, receipt, dependencies: environmentReference(receipt), evidence: recipe.evidence };
}
