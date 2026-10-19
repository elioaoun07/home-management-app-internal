// DLV-133: identities and evidence for the existing Node/Linux checker boundary.
// No policy installation, provider dispatch, recovery loop or host test fallback.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, deepFreeze, fingerprint } from "./contracts.mjs";
import { inspectDependencyTree } from "./worker/dependency-inventory.mjs";
import { requiredNativePackages, validNativePackages, validNativeRuntimeFacts, probeNativeRuntimes } from "./worker/native-runtime-probe.mjs";
import { COMPILER_RESOURCE_PROFILE, isCompilerCommand } from "./compiler-resources.mjs";

export const ENVIRONMENT_SCHEMA = "delivery-v2/dependency-environment@1";
export const ENVIRONMENT_FILE = ".era-dependency-environment.json";
export const VERIFIER_VERSION = "node-linux-checker@2";
export const INSTALL_STORE_STRATEGY = "isolated-volume@1";
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const volumePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u;
const sha256 = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");
/** @typedef {Record<string, {argv:string[], assertions:number, inputs:Record<string,string>}>} CheckBindings */
const safeRelative = value => typeof value === "string" && value.length > 0 && !value.includes("\\") && value.split("/").every(part => part && part !== "." && part !== ".." && !part.includes(":"));
const validPackages = packages => packages && typeof packages === "object" && !Array.isArray(packages) &&
  ["typescript", "esbuild", "vitest", "eslint"].every(name => typeof packages[name] === "string") &&
  Object.entries(packages).every(([name, version]) => /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/iu.test(name) && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/u.test(version));
const validOracles = oracles => Array.isArray(oracles) && oracles.length > 0 &&
  new Set(oracles.map(row => row?.id)).size === oracles.length && oracles.every(row =>
    row && typeof row.id === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(row.id) &&
    Array.isArray(row.argv) && row.argv.length > 0 && row.argv.every(value => typeof value === "string" && value && !value.includes("\0")) &&
    Number.isInteger(row.assertions) && row.assertions > 0 && row.inputs && typeof row.inputs === "object" && !Array.isArray(row.inputs) &&
    Object.keys(row.inputs).length > 0 && Object.values(row.inputs).every(value => digestPattern.test(String(value))) &&
    (row.candidateFixture === undefined || (safeRelative(row.candidateFixture) && digestPattern.test(String(row.inputs[row.candidateFixture + "/eslint.config.mjs"])))));

/** Same executable, protected bytes and assertion obligation at preparation and launch. */
export function bindEnvironmentChecks({ oracles, checks, inputs }) {
  if (!checks?.specs || !Array.isArray(checks.inputs) || !checks.inputs.length || !Object.keys(checks.specs).length) throw new Error("proposed policy checks and protected inputs required before preparation");
  const bindings = /** @type {CheckBindings} */ ({});
  for (const [id, check] of Object.entries(checks.specs)) {
    const oracle = oracles.find(row => row.id === id);
    const assertions = check.expected?.assertions;
    if (check.kind !== "command" || !Number.isInteger(assertions) || assertions <= 0 || !oracle ||
        JSON.stringify(check.argv) !== JSON.stringify(oracle.argv) || assertions !== oracle.assertions) throw new Error("environment check executable/assertions mismatch: " + id);
    const pins = Object.fromEntries(checks.inputs.map(path => [path, inputs[path]]));
    if (!pins[check.argv[1]] || Object.entries(pins).some(([path, digest]) => !digestPattern.test(String(digest)) || oracle.inputs[path] !== digest)) throw new Error("environment check protected inputs mismatch: " + id);
    bindings[id] = { argv: [...check.argv], assertions, inputs: pins };
  }
  return bindings;
}

function validCheckBindings(bindings, oracles, canonical = canonicalJson) {
  if (bindings === undefined) return true; // Historical receipts remain inspectable.
  try {
    const inputs = Object.assign({}, ...Object.values(bindings).map(row => row.inputs));
    const checks = { specs: Object.fromEntries(Object.entries(bindings).map(([id, row]) => [id, { kind: "command", argv: row.argv, expected: { assertions: row.assertions } }])), inputs: Object.keys(inputs) };
    return canonical(bindEnvironmentChecks({ oracles, checks, inputs })) === canonical(bindings);
  } catch { return false; }
}

export function makeEnvironmentSpec({ image, nodeVersion, pnpmVersion, pnpmDigest, packageJson, lockfile, packages, oracles, checks = /** @type {CheckBindings|undefined} */ (undefined) }) {
  if (!digestPattern.test(String(image))) throw new Error("environment image must be an immutable digest");
  if (!/^v22\.\d+\.\d+$/u.test(String(nodeVersion)) || !/^10\.\d+\.\d+$/u.test(String(pnpmVersion))) throw new Error("this verifier supports Node 22 / pnpm 10 only");
  if (!packageJson || !lockfile) throw new Error("frozen manifest and lockfile required");
  if (!digestPattern.test(String(pnpmDigest))) throw new Error("complete pnpm tool digest required");
  if (!validPackages(packages)) throw new Error("compiler/native/oracle tool versions required");
  if (!validOracles(oracles)) throw new Error("distinct protected command oracles with argv, pinned inputs and positive assertion counts required");
  if (!validCheckBindings(checks, oracles)) throw new Error("environment check bindings invalid");
  const body = { schema: ENVIRONMENT_SCHEMA, verifier: VERIFIER_VERSION, image,
    platform: { os: "linux", arch: "x64", libc: "glibc" }, nodeVersion, pnpmVersion, pnpmDigest,
    packageDigest: sha256(packageJson), lockDigest: sha256(lockfile), packages: { ...packages }, nativePackages: requiredNativePackages(packageJson),
    install: { frozenLockfile: true, lifecycleScripts: false, pnpmfile: false, registry: "https://registry.npmjs.org/", store: INSTALL_STORE_STRATEGY },
    oracles: oracles.map(row => ({ id: row.id, argv: [...row.argv], assertions: row.assertions, inputs: { ...row.inputs }, ...(row.candidateFixture === undefined ? {} : { candidateFixture: row.candidateFixture }) })),
    ...(checks === undefined ? {} : { checks }) };
  return deepFreeze({ ...body, key: fingerprint(canonicalJson(body)) });
}

export function verifyEnvironmentSpec(spec) {
  if (!spec || !digestPattern.test(String(spec.key))) return false;
  const { key, ...body } = spec;
  return body.schema === ENVIRONMENT_SCHEMA && body.verifier === VERIFIER_VERSION &&
    digestPattern.test(String(body.image)) && digestPattern.test(String(body.pnpmDigest)) &&
    digestPattern.test(String(body.packageDigest)) && digestPattern.test(String(body.lockDigest)) &&
    body.platform?.os === "linux" && body.platform.arch === "x64" && body.platform.libc === "glibc" &&
    /^v22\.\d+\.\d+$/u.test(String(body.nodeVersion)) && /^10\.\d+\.\d+$/u.test(String(body.pnpmVersion)) &&
    body.install?.frozenLockfile === true && body.install.lifecycleScripts === false && body.install.pnpmfile === false && body.install.registry === "https://registry.npmjs.org/" && body.install.store === INSTALL_STORE_STRATEGY &&
    validPackages(body.packages) && validNativePackages(body.nativePackages) && validOracles(body.oracles) && validCheckBindings(body.checks, body.oracles) &&
    key === fingerprint(canonicalJson(body));
}

export function makeEnvironmentReceipt({ spec, volume, inventory, probes, oracles, observedAt }) {
  if (!verifyEnvironmentSpec(spec) || !volumePattern.test(String(volume)) || !inventory?.ok || !digestPattern.test(String(inventory.digest))) throw new Error("unverified environment cannot be published");
  if (probes?.ok !== true || probes.compilerNegativeControl !== true || probes.compilerPositiveControl !== true || probes.nativeExecuted !== true || probes.node !== spec.nodeVersion || probes.platform !== "linux" || probes.arch !== "x64" || !probes.glibc) throw new Error("target compiler/native witness missing");
  for (const [name, version] of Object.entries(spec.packages)) if (probes.packages?.[name] !== version) throw new Error("target package version mismatch: " + name);
  if (!validNativeRuntimeFacts(spec.nativePackages, probes.nativePackages)) throw new Error("required native SDK executable witness missing");
  if (oracles?.length !== spec.oracles.length || spec.oracles.some(expected => !oracles.some(actual => actual.id === expected.id && actual.exitCode === 0 && actual.passed === expected.assertions && actual.failed === 0))) throw new Error("protected oracle witness missing or inconclusive");
  const compilerOracles = spec.oracles.filter(oracle => isCompilerCommand(oracle.argv));
  if (compilerOracles.some(expected => !oracles.some(actual => actual.id === expected.id && canonicalJson(actual.compilerProfile ?? null) === canonicalJson(COMPILER_RESOURCE_PROFILE)))) throw new Error("compiler resource profile witness missing or mismatched");
  const body = { schema: ENVIRONMENT_SCHEMA, spec, volume, contentDigest: inventory.digest,
    probes, oracles, compilerProfile: COMPILER_RESOURCE_PROFILE, observedAt: String(observedAt) };
  return deepFreeze({ ...body, receiptDigest: fingerprint(canonicalJson(body)) });
}

export function verifyEnvironmentReceipt(receipt) {
  if (!receipt || !verifyEnvironmentSpec(receipt.spec)) return false;
  try {
    if (canonicalJson(receipt.compilerProfile ?? null) !== canonicalJson(COMPILER_RESOURCE_PROFILE)) return false;
    const rebuilt = makeEnvironmentReceipt({ spec: receipt.spec, volume: receipt.volume,
      inventory: { ok: true, digest: receipt.contentDigest }, probes: receipt.probes,
      oracles: receipt.oracles, observedAt: receipt.observedAt });
    return rebuilt.receiptDigest === receipt.receiptDigest;
  } catch { return false; }
}

export function environmentReference(receipt) {
  if (!verifyEnvironmentReceipt(receipt)) throw new Error("invalid environment receipt");
  return deepFreeze({ volume: receipt.volume, environment: { key: receipt.spec.key, contentDigest: receipt.contentDigest, receiptDigest: receipt.receiptDigest } });
}

export function writeEnvironmentReceipt(directory, receipt) {
  if (!verifyEnvironmentReceipt(receipt)) throw new Error("invalid environment receipt");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, receipt.spec.key.slice(7) + "-" + receipt.receiptDigest.slice(7) + ".json");
  const text = JSON.stringify(receipt, null, 2) + "\n";
  if (existsSync(file)) {
    if (readFileSync(file, "utf8") !== text) throw new Error("environment receipt collision");
    return file;
  }
  writeFileSync(file, text, { encoding: "utf8", flag: "wx" });
  return file;
}

export function findEnvironmentReceipt(directory, key) {
  if (!existsSync(directory)) return null;
  const found = [];
  for (const file of readdirSync(directory).filter(name => name.startsWith(key.slice(7) + "-") && name.endsWith(".json")).sort()) {
    const receipt = JSON.parse(readFileSync(join(directory, file), "utf8"));
    if (!verifyEnvironmentReceipt(receipt) || receipt.spec.key !== key) throw new Error("altered environment receipt: " + file);
    found.push(receipt);
  }
  return found.at(-1) || null;
}

// Real semantic compiler negative/control pair and the Linux esbuild executable.
// These run in the checker container, not in an owner's checkout.
export function targetProbeSource(spec) {
  return `const {createRequire}=require('node:module');const r=createRequire('/deps/package.json');
const spec=${JSON.stringify(spec)};const packages={};for(const name of Object.keys(spec.packages))packages[name]=r(name+'/package.json').version;
const ts=r('typescript'),esbuild=r('esbuild');
function semantic(text){const options={noLib:true,noResolve:true};const host=ts.createCompilerHost(options);host.getSourceFile=(name)=>name==='/probe.ts'?ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true):undefined;const program=ts.createProgram(['/probe.ts'],options,host);return program.getSemanticDiagnostics();}
if(!semantic('const value: number = "bad";').some(d=>d.code===2322)||semantic('const value: number = 1;').length)throw Error('compiler negative/control failed');
if(!esbuild.transformSync('const value: number = 1;', {loader:'ts'}).code.includes('value'))throw Error('native esbuild failed');
const probeNativeRuntimes=${probeNativeRuntimes.toString()};const nativePackages=probeNativeRuntimes(spec.nativePackages,require);
const facts={ok:true,compilerNegativeControl:true,compilerPositiveControl:true,nativeExecuted:true,node:process.version,platform:process.platform,arch:process.arch,glibc:process.report.getReport().header.glibcVersionRuntime||null,packages,nativePackages};
if(facts.node!==spec.nodeVersion||facts.platform!=='linux'||facts.arch!=='x64'||!facts.glibc||Object.entries(spec.packages).some(([n,v])=>packages[n]!==v))throw Error('target platform/toolchain mismatch');console.log(JSON.stringify(facts));`;
}

/** Supplied as trusted host code to a read-only container; no new image required. */
export function environmentVerificationSource(expected, image) {
  return `const fs=require('node:fs'),crypto=require('node:crypto');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const hash=s=>'sha256:'+crypto.createHash('sha256').update(s).digest('hex');
const expected=${JSON.stringify(expected)};const receiptFile='/deps/${ENVIRONMENT_FILE}';if(!fs.lstatSync(receiptFile).isFile()||fs.lstatSync(receiptFile).isSymbolicLink())throw Error('environment receipt is not a regular file');const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));const {receiptDigest,...body}=receipt;const {key,...specBody}=receipt.spec;
if(receipt.schema!==${JSON.stringify(ENVIRONMENT_SCHEMA)}||receipt.spec.verifier!==${JSON.stringify(VERIFIER_VERSION)}||receipt.spec.install?.store!==${JSON.stringify(INSTALL_STORE_STRATEGY)}||receipt.spec.image!==${JSON.stringify(image)}||key!==hash(canonical(specBody))||receiptDigest!==hash(canonical(body))||key!==expected.key||receiptDigest!==expected.receiptDigest||receipt.contentDigest!==expected.contentDigest)throw Error('environment receipt mismatch');
if(receipt.probes?.ok!==true||receipt.probes.compilerNegativeControl!==true||receipt.probes.compilerPositiveControl!==true||receipt.probes.nativeExecuted!==true||receipt.spec.oracles.length!==receipt.oracles.length||receipt.spec.oracles.some(e=>!receipt.oracles.some(a=>a.id===e.id&&a.exitCode===0&&a.passed===e.assertions&&a.failed===0)))throw Error('environment validation evidence incomplete');
const validNativePackages=${validNativePackages.toString()},validNativeRuntimeFacts=${validNativeRuntimeFacts.toString()};if(!validNativePackages(receipt.spec.nativePackages)||!validNativeRuntimeFacts(receipt.spec.nativePackages,receipt.probes.nativePackages))throw Error('environment native SDK evidence incomplete');
const canonicalJson=canonical,digestPattern=${digestPattern.toString()},bindEnvironmentChecks=${bindEnvironmentChecks.toString()},validCheckBindings=${validCheckBindings.toString()};
if(!validCheckBindings(receipt.spec.checks,receipt.spec.oracles,canonical))throw Error('environment check bindings invalid');
const isCompilerCommand=${isCompilerCommand.toString()},compilerProfile=${JSON.stringify(COMPILER_RESOURCE_PROFILE)};
const compilerOracles=receipt.spec.oracles.filter(row=>isCompilerCommand(row.argv));
if(canonical(receipt.compilerProfile)!==canonical(compilerProfile)||compilerOracles.some(expected=>!receipt.oracles.some(actual=>actual.id===expected.id&&canonical(actual.compilerProfile)===canonical(compilerProfile))))throw Error('compiler resource profile evidence mismatch');
const inspect=${inspectDependencyTree.toString()};const inventory=inspect('/deps',require);
if(!inventory.ok||inventory.digest!==expected.contentDigest)throw Error('dependency content changed or incomplete: '+JSON.stringify(inventory.errors));
if(process.platform!==receipt.spec.platform.os||process.arch!==receipt.spec.platform.arch||process.version!==receipt.spec.nodeVersion||!process.report.getReport().header.glibcVersionRuntime)throw Error('environment runtime mismatch');
console.log(JSON.stringify({ok:true,key,contentDigest:inventory.digest,receiptDigest,receipt}));`;
}

export function environmentProbeArgs({ image, dependencies, name, limits = {} }) {
  if (!digestPattern.test(String(image)) || !volumePattern.test(String(dependencies?.volume)) || !dependencies.environment || canonicalJson(Object.keys(dependencies.environment).sort()) !== canonicalJson(["contentDigest", "key", "receiptDigest"]) || Object.values(dependencies.environment).some(value => !digestPattern.test(String(value)))) throw new Error("invalid managed dependency binding");
  return ["create", "--name", name, "--pull=never", "--network", "none", "--user", "10001:10001", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", String(limits.pids || 256), "--memory", limits.memory || "4g", "--cpus", limits.cpus || "2", "--tmpfs", "/tmp:rw,uid=10001,gid=10001,size=256m", "--workdir", "/tmp", "--mount", "type=volume,source=" + dependencies.volume + ",target=/deps,readonly,volume-nocopy", image, "node", "-e", environmentVerificationSource(dependencies.environment, image)];
}

/** Read-only probe, positively identified cleanup, no automatic retry. */
export async function verifyManagedEnvironment({ image, dependencies, run, limits = {} }) {
  if (!dependencies?.environment) return { ok: true, legacy: true };
  let id = null;
  let primary = null;
  let result = null;
  try {
    const present = await run(["volume", "inspect", "--format", "{{.Name}}", dependencies.volume]);
    if (present.status !== 0 || present.stdout.trim() !== dependencies.volume) throw new Error("managed dependency volume missing or unavailable");
    const created = await run(environmentProbeArgs({ image, dependencies, limits, name: "era-v2-env-check-" + randomUUID() }));
    if (created.status !== 0 || !/^[a-f0-9]{64}$/u.test(created.stdout.trim())) throw new Error("environment probe creation failed or uncertain");
    id = created.stdout.trim();
    const started = await run(["start", "--attach", id]);
    const state = await run(["inspect", "--format", "{{.State.Status}} {{.State.ExitCode}}", id]);
    if (started.status !== 0 || state.status !== 0 || state.stdout.trim() !== "exited 0") throw new Error("environment verification failed: " + started.stderr);
    result = JSON.parse(started.stdout);
    if (!result.ok || result.key !== dependencies.environment.key || result.contentDigest !== dependencies.environment.contentDigest || result.receiptDigest !== dependencies.environment.receiptDigest) throw new Error("environment probe evidence mismatch");
  } catch (error) { primary = error; }
  if (id) {
    try { const removed = await run(["rm", "-f", id]); if (removed.status !== 0) primary = primary || new Error("environment probe cleanup unconfirmed: " + id); }
    catch (error) { primary ||= error; }
  }
  if (primary) return { ok: false, reason: primary.message, containerId: id };
  return result;
}

/** Qualification's existing synchronous Docker seam, with the same ownership rule. */
export function verifyManagedEnvironmentSync({ image, dependencies, run, limits = {} }) {
  if (!dependencies?.environment) return { ok: true, legacy: true };
  let id = null, primary = null, facts = null;
  try {
    const present = run(["volume", "inspect", "--format", "{{.Name}}", dependencies.volume]);
    if (present.status !== 0 || present.stdout.trim() !== dependencies.volume) throw new Error("managed dependency volume missing or unavailable");
    const created = run(environmentProbeArgs({ image, dependencies, limits, name: "era-v2-env-check-" + randomUUID() }));
    if (created.status !== 0 || !/^[a-f0-9]{64}$/u.test(created.stdout.trim())) throw new Error("environment probe creation failed or uncertain");
    id = created.stdout.trim();
    const result = run(["start", "--attach", id]);
    const state = run(["inspect", "--format", "{{.State.Status}} {{.State.ExitCode}}", id]);
    if (result.status !== 0 || state.status !== 0 || state.stdout.trim() !== "exited 0") throw new Error("environment verification failed: " + result.stderr);
    facts = JSON.parse(result.stdout);
    if (!facts.ok || facts.key !== dependencies.environment.key || facts.contentDigest !== dependencies.environment.contentDigest || facts.receiptDigest !== dependencies.environment.receiptDigest) throw new Error("environment probe evidence mismatch");
  } catch (error) { primary = error; }
  if (id) {
    try { if (run(["rm", "-f", id]).status !== 0) primary ||= new Error("environment probe cleanup unconfirmed: " + id); }
    catch (error) { primary ||= error; }
  }
  return primary ? { ok: false, reason: primary.message, containerId: id } : facts;
}
