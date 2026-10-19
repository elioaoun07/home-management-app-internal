// A failed host launch after a completed install is not permission to install
// again. This read-only preflight admits only that exact interrupted boundary.
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson, fingerprint } from "./contracts.mjs";

const hash = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const succeeded = row => row?.status === 0 && !row.error;
const idPattern = /^[a-f0-9]{64}$/u;

/** A completed installation can serve an extended source closure only after
 * explicit review of both keys. Dependency inputs and all existing bytes/check
 * obligations must stay identical; the full positive control pins every input.
 * This does not certify the extended program or authorize an operational pass.
 */
export function inspectCompilerClosureExtension({ sourceRecipe, sourceSpec, targetRecipe, targetSpec, expectedSourceKey }) {
  if (sourceSpec.key !== expectedSourceKey || sourceSpec.key === targetSpec.key) throw new Error("source closure extension requires distinct exact reviewed keys");
  const provisioning = spec => Object.fromEntries(Object.entries(spec).filter(([key]) => !["key", "oracles"].includes(key)));
  if (canonicalJson(provisioning(sourceSpec)) !== canonicalJson(provisioning(targetSpec))) throw new Error("source closure extension cannot change dependency or check inputs");
  const original = sourceRecipe.program.files, next = targetRecipe.program.files;
  if (Object.entries(original).some(([path, digest]) => next[path] !== digest)) throw new Error("source closure extension must preserve every original input");
  const added = Object.keys(next).filter(path => !(path in original)).sort();
  if (!added.length || added.some(path => !/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/u.test(path))) throw new Error("source closure extension needs pinned source additions");
  const positive = spec => spec.oracles.filter(row => row.argv?.[0] === "node" && row.argv[1] === "scripts/delivery-v2/probes/compiler-program.mjs" && row.argv[2] === "/inputs/program" && row.argv[3] === "positive" && row.argv.length === 4);
  const before = positive(sourceSpec), after = positive(targetSpec);
  if (before.length !== 1 || after.length !== 1 || before[0].id !== after[0].id || canonicalJson(before[0].inputs) !== canonicalJson(original) || canonicalJson(after[0].inputs) !== canonicalJson(next)) throw new Error("source closure extension requires the complete positive compiler witness");
  const obligations = (spec, id) => spec.oracles.map(row => row.id === id ? { ...row, inputs: {} } : row);
  if (canonicalJson(obligations(sourceSpec, before[0].id)) !== canonicalJson(obligations(targetSpec, after[0].id))) throw new Error("source closure extension cannot weaken or replace an oracle");
  if (resolve(sourceRecipe.program.root) === resolve(targetRecipe.program.root)) throw new Error("source closure extension must preserve the original frozen tree");
  return { sourceEnvironmentKey: sourceSpec.key, targetEnvironmentKey: targetSpec.key, sourceProgramDigest: fingerprint(canonicalJson(original)), targetProgramDigest: fingerprint(canonicalJson(next)), addedInputs: added.map(path => ({ path, sha256: next[path] })) };
}

export function inspectValidationContinuation({ priorEvidence, expectedVolume, expectedInventoryDigest, spec, installSource, probeSource, failedArgs }) {
  const root = resolve(priorEvidence), artifacts = {};
  if (lstatSync(root).isSymbolicLink()) throw new Error("linked prior evidence root");
  const read = name => {
    const file = join(root, name), stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128 * 1024 * 1024) throw new Error("invalid prior evidence file: " + name);
    const bytes = readFileSync(file); artifacts[name] = hash(bytes); return JSON.parse(bytes.toString("utf8"));
  };
  const outcome = read("outcome.json"), inventory = read("inventory.before.json");
  const prefix = "era-v2-deps-" + spec.key.slice(7, 31) + "-";
  const volume = outcome.stagedVolumeRetained;
  if (typeof volume !== "string" || volume !== expectedVolume || !volume.startsWith(prefix)) throw new Error("continuation volume/key mismatch");
  const nonce = volume.slice(prefix.length), inputs = "era-v2-deps-inputs-" + nonce, store = "era-v2-pnpm-store-" + nonce;
  if (!/^[A-Za-z0-9-]{1,40}$/u.test(nonce) || outcome.completed !== false || outcome.diagnostic || outcome.reused !== false || outcome.usedVolume !== null || outcome.providerJobs !== 0 || outcome.sourceVolumesReplaced !== false || outcome.ownedContainers?.length !== 0 || outcome.secondary?.length !== 0 || outcome.storeVolumeRetained !== store || outcome.storeVolume !== store || outcome.storeCleanupConfirmed !== false) throw new Error("prior attempt is not a quiescent interrupted validation");
  if (inventory.schema !== "delivery-v2/dependency-inventory@1" || inventory.ok !== true || inventory.errors?.length !== 0 || !Array.isArray(inventory.entries) || inventory.digest !== expectedInventoryDigest || hash(JSON.stringify(inventory.entries)) !== inventory.digest) throw new Error("prior inventory identity mismatch");
  for (const [path, digest] of [["package.json", spec.packageDigest], ["pnpm-lock.yaml", spec.lockDigest]]) if (inventory.entries.find(row => row.path === path)?.sha256 !== digest.slice(7)) throw new Error("prior frozen dependency inputs mismatch");
  const files = readdirSync(root).filter(name => /^\d+\.json$/u.test(name)).sort();
  if (!files.length || files.some((name, index) => name !== String(index + 1).padStart(3, "0") + ".json")) throw new Error("prior operation journal incomplete");
  const records = files.map(read), failures = records.filter(row => !succeeded(row));
  if (failures.length !== 1 || failures[0].error !== "ENAMETOOLONG" || failures[0].status !== null || failures[0].stdout !== "" || failures[0].stderr !== "" || canonicalJson(failures[0].args) !== canonicalJson(failedArgs(volume, inputs, probeSource))) throw new Error("continuation requires the exact pre-native host launch failure");
  const failedAt = records.indexOf(failures[0]);
  const created = records.filter(row => row.args?.[0] === "create" && succeeded(row));
  for (const row of created) {
    const id = row.stdout.trim();
    if (!idPattern.test(id) || !records.some((other, index) => index < failedAt && succeeded(other) && canonicalJson(other.args) === canonicalJson(["rm", "-f", id]))) throw new Error("prior container cleanup unconfirmed");
  }
  const install = created.filter(row => row.args.at(-1) === installSource);
  if (install.length !== 1 || !install[0].args.includes(spec.image) || !install[0].args.includes("type=volume,source=" + volume + ",target=/deps,volume-nocopy") || !install[0].args.includes("type=volume,source=" + store + ",target=/pnpm-store,volume-nocopy")) throw new Error("prior install does not bind the retained volume");
  const installer = install[0].stdout.trim();
  if (!records.some(row => succeeded(row) && canonicalJson(row.args) === canonicalJson(["start", "--attach", installer])) || !records.some(row => succeeded(row) && canonicalJson(row.args) === canonicalJson(["inspect", "--format", "{{.State.Status}} {{.State.ExitCode}}", installer]) && row.stdout.trim() === "exited 0")) throw new Error("prior installer completion not proven");
  const inventoried = records.some(row => {
    if (!succeeded(row) || row.args?.[0] !== "start" || !row.args.includes("--attach")) return false;
    try { const facts = JSON.parse(row.stdout); return facts.digest === inventory.digest && facts.ok === true && hash(JSON.stringify(facts.entries)) === inventory.digest; } catch { return false; }
  });
  if (!inventoried || !records.some(row => succeeded(row) && canonicalJson(row.args) === canonicalJson(["volume", "rm", inputs]))) throw new Error("prior inventory or input cleanup not proven");
  for (const name of [volume, inputs, store]) if (!records.some(row => succeeded(row) && canonicalJson(row.args) === canonicalJson(["volume", "inspect", "--format", '{{index .Labels "era.dependency.staging"}}', name]) && row.stdout.trim() === nonce)) throw new Error("prior volume ownership not proven");
  return { schema: "delivery-v2/checker-validation-continuation@1", priorEvidence: root, environmentKey: spec.key, volume, store, originalNonce: nonce, inventoryDigest: inventory.digest, artifacts, evidenceDigest: fingerprint(canonicalJson(artifacts)), phase: "post-install-validation", install: false, providerJobs: 0 };
}
