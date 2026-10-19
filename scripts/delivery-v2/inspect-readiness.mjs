// DLV-137 inspection adapter. No runtime factory, provider, credential reader,
// preparation, reconciliation, maintenance or write path is used here.
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, relative } from "node:path";
import { canonicalJson, fingerprint } from "./contracts.mjs";
import { loadExecutionPolicy, resolveWorkFile, masterBookFor, executorPermitted, WORK_PROFILES } from "./policy.mjs";
import { resolveExecutorChoice, validateRunSettings, describeExecutor, admitExecutorProfile } from "./adapters/registry.mjs";
import { openStore } from "./store.mjs";
import { createJourney } from "./journey.mjs";
import { fileTasks } from "../pm/shared/tasks.mjs";
import { normalizeWorkId } from "../pm/shared/work-id.mjs";
import { freezeSelectedItem } from "./work-ref.mjs";
import { pinCheckPlan } from "./checks.mjs";
import { loadQualification } from "./qualification.mjs";
import { readAllowances, effectivePolicy, runAllowance } from "./allowances.mjs";
import { resolveEnforcement } from "./budget.mjs";
import { bindEnvironmentChecks, verifyEnvironmentReceipt, environmentReference } from "./dependency-environment.mjs";
import { boundaryBindingDigest } from "./worker-boundary.mjs";
import { compilerFiles } from "./compiler-input.mjs";
import { compilerObservation } from "./compiler-observation.mjs";
import { evaluateReadiness, readinessFact as fact, nativeModelAvailabilityFact, nativeModelDiagnostics } from "./readiness.mjs";

export const OBSERVATION_MAX_AGE_MS = 60_000;
const action = "Review the existing policy and selected item";
const blocked = (code, detail, nextAction = action) => fact("blocked", code, detail, null, nextAction);
const unavailable = (code, detail, nextAction = "Obtain approved current runtime evidence") => fact("unavailable", code, detail, null, nextAction);

// Only explicit source/check inputs. Never follow links or inspect auth files.
function input(root, name) {
  if (typeof name !== "string" || !name || name.includes("\\") || name.split("/").some(p => !p || p === "." || p === "..") || /(^|\/)(?:\.env(?:\.|$)|\.git(?:\/|$)|\.delivery(?:\/|$)|\.pm(?:\/|$)|\.npmrc$)/u.test(name)) throw new Error("unsafe source/check input: " + name);
  const base = resolve(root), path = resolve(base, name);
  if (relative(base, path).startsWith("..")) throw new Error("source/check input escapes root");
  let current = base;
  for (const part of ["", ...name.split("/")]) {
    if (part) current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error("linked source/check input: " + name);
  }
  if (!lstatSync(path).isFile()) throw new Error("source/check input is not an explicit file: " + name);
  return { path: name, sha256: "sha256:" + createHash("sha256").update(readFileSync(path)).digest("hex") };
}

/** Runs in the bounded passive observation thread. No store, runtime or probe. */
export function readCompilerInputs(root, configured) {
  const program = compilerFiles(root, configured);
  const inputs = program.files.map(name => program.walkedInputs[name] || input(root, name));
  if (inputs.some(entry => program.generatedTypes[entry.path] && program.generatedTypes[entry.path] !== entry.sha256)) throw new Error("generated compiler input changed");
  return inputs;
}

/** A trusted caller may supply observations already obtained by an explicit
 * approved probe. Public CLI/GET inputs cannot supply them. Missing or old
 * observations stay unknown; a matching file receipt alone is not a live probe.
 * @param {{root:string,pmRel?:string,file?:string,id?:string,executor?:string,model?:string|null,effort?:string|null,workProfile?:string,
 * now?:string,observations?:Record<string,object>,readOnlyStore?:object|null}} options */
export async function inspectReadiness({ root, pmRel = "ERA Notes/10 - Project Management", file = "", id = "", executor = "", model = null, effort = null, workProfile = "focused", now = new Date().toISOString(), observations = {}, readOnlyStore = null }) {
  const selection = { file, id: normalizeWorkId(id) || id, executor, model, effort, workProfile };
  const facts = {};
  let loaded;
  try { loaded = loadExecutionPolicy({ root }); }
  catch (error) { loaded = { ok: false, policy: null, refusals: [{ code: "execution-policy-unreadable", detail: error.message }] }; }
  const allowances = readAllowances({ root });
  const policy = loaded.ok ? effectivePolicy(loaded.policy, { settings: allowances.settings, now }) : null;
  facts.policy = loaded.ok ? fact("satisfied", "policy-current", null, { revision: policy.policy_revision, digest: loaded.digest || fingerprint(canonicalJson(loaded.policy)) })
    : { ...blocked("policy-unavailable", null), reasons: loaded.refusals };
  if (policy?.grant.expires_at && Date.parse(policy.grant.expires_at) <= Date.parse(now)) facts.policy = blocked("grant-expired", policy.grant.expires_at, "Review current owner authority");
  const chosen = resolveExecutorChoice(executor), settings = policy && chosen ? validateRunSettings({ executor, model, effort, catalog: policy.executors.catalog }) : null;
  const selectionReasons = [];
  if (!chosen) selectionReasons.push({ code: "no-executor-selected", detail: executor || null });
  if (policy && chosen && !executorPermitted(policy, chosen.backend_id)) selectionReasons.push({ code: "executor-not-permitted-by-policy", detail: chosen.backend_id });
  if (settings && !settings.ok) selectionReasons.push(...settings.refusals);
  if (!WORK_PROFILES.includes(workProfile)) selectionReasons.push({ code: "unsupported-work-profile", detail: workProfile });
  facts.selection = policy ? { ...fact(selectionReasons.length ? "blocked" : "satisfied", "selection-current", null, settings?.settings || null, "Choose permitted executor/model/effort"), reasons: selectionReasons }
    : unavailable("selection-policy-unavailable", "Policy is required to validate selection", action);

  let raw = null, bookRaw = null, row = null, frozen = null, assessment = null, testGate = null, store = readOnlyStore, storeError = null;
  try {
    const resolved = resolveWorkFile({ root, pmRel, file });
    if (!resolved.ok) throw new Error(resolved.detail);
    input(root, relative(root, resolved.path).split("\\").join("/"));
    raw = readFileSync(resolved.path, "utf8");
    const rows = fileTasks(raw).filter(entry => entry.idChip === selection.id);
    if (rows.length !== 1) throw new Error("selection is missing or ambiguous");
    row = rows[0];
    const book = resolveWorkFile({ root, pmRel, file: masterBookFor(file) || "" });
    if (!book.ok) throw new Error("Master Book is unavailable");
    input(root, relative(root, book.path).split("\\").join("/"));
    bookRaw = readFileSync(book.path, "utf8");
    if (!policy) throw new Error("policy unavailable for contract validation");
    frozen = freezeSelectedItem({ raw, file, cbidx: row.cbidx, witness: { alias: selection.id, line: raw.split("\n")[row.line] }, bookRaw, acceptanceVersion: 2,
      requestedDisposition: policy.execution.maxRequestedDisposition, criteria: policy.criteria, scratchScope: policy.scratchScope, publicationScope: policy.publicationScope });
    if (!frozen.ok) throw new Error(String(frozen.reason));
    const sourceInputs = policy.scratchScope.include.map(name => input(root, name));
    facts.source = fact("satisfied", "source-current", null, { source: frozen.contract.source_fingerprint, acceptance: frozen.contract.acceptance_fingerprint, inputs: sourceInputs });
  } catch (error) { facts.source = blocked("source-unavailable", error.message, "Resolve selection/source and exact snapshot scope"); }

  const assessmentJourney = policy && row ? createJourney({ root, pmRel, store: () => store, now: () => now }) : null;
  if (assessmentJourney) {
    assessment = assessmentJourney.assess({ file, id: selection.id, withoutStore: true });
    if (assessment.ok && facts.source.state === "satisfied") {
      const paths = assessment.declared, evidence = facts.source.evidence;
      if (!paths?.length) facts.source = { ...unavailable("source-scope-unknown", "No declared Touches", "Declare exact item scope"), evidence };
      else if (paths.some(path => !policy.publicationScope.allowedPaths.some(allowed => path === allowed || path.startsWith(allowed + "/")))) facts.source = { ...blocked("scope-not-authorized", paths, "Review exact publication/snapshot scope"), evidence };
    }
  }
  try {
    const storePath = join(root, ".delivery/v2/supervisor.sqlite");
    if (!store && existsSync(storePath)) store = openStore({ path: storePath, readOnly: true });
    if (policy && row) {
      const journey = assessmentJourney;
      assessment = journey.assess({ file, id: selection.id, withoutStore: !store });
      if (!assessment.ok) facts.coordination = { ...blocked("coordination-unavailable", null), reasons: assessment.refusals };
      else {
        const reasons = [...assessment.readiness.blockers];
        const gate = store ? journey.testGate() : { locked: false, application: null, record: null };
        testGate = gate;
        if (gate.locked) reasons.push({ code: "owner-tests-pending", detail: gate.application?.application_id || null });
        facts.coordination = { ...fact(reasons.length ? "blocked" : "satisfied", "coordination-current", null, { verdict: assessment.verdict, reasons: assessment.reasons, testGateLocked: gate.locked }), reasons };
      }
    } else facts.coordination = unavailable("coordination-source-unavailable", "Selection/policy is required", action);
  } catch (error) {
    storeError = error.message;
    facts.coordination = { ...unavailable("coordination-store-unavailable", storeError, "Review store version/access without migrating during inspection"),
      reasons: [...(assessment?.readiness?.blockers || []), { code: "coordination-store-unavailable", detail: storeError }] };
  }
  finally {
    if (store && !store.readOnlySnapshotCurrent()) {
      storeError = "Store changed during inspection";
      facts.coordination = unavailable("coordination-store-moved", storeError, "Inspect again after store activity settles");
    }
    store?.close();
  }

  const checkInputs = [];
  try {
    if (!policy) throw new Error("policy unavailable");
    for (const name of policy.checks.inputs) checkInputs.push(input(root, name));
    const plan = pinCheckPlan({ criteria: policy.criteria, specs: policy.checks.specs, checkerInputs: checkInputs });
    const commands = Object.values(plan.specs).filter(spec => spec.kind === "command");
    if (!commands.length || commands.some(spec => !spec.argv.length) || !checkInputs.length) throw new Error("pinned command checks/inputs are missing");
    const typecheck = policy.checks.requiredVerifications.typecheck;
    if (!typecheck?.enabled || typecheck.enforcement !== "required" || typecheck.isolation !== "checker") throw new Error("protected checker isolation is not required; no host fallback can certify readiness");
    const configured = typecheck.program;
    const inputs = await compilerObservation(root, configured);
    facts.checks = fact("satisfied", "checks-pinned", "Inputs pinned; checks not executed", { digest: plan.plan_digest, inputs: checkInputs, program: { files: inputs.length, fingerprint: fingerprint(canonicalJson(inputs)) } });
  } catch (error) { facts.checks = { ...blocked("checks-not-prepared", error.message, "Prepare pinned protected checks under DLV-133/selected item"), evidence: { inputs: checkInputs } }; }

  let manifests = null;
  try { manifests = ["package.json", "pnpm-lock.yaml"].map(name => input(root, name)); } catch { /* reported by environment gate below */ }

  // Bind all live observations to this exact selection and passive snapshot.
  const contextFingerprint = fingerprint(canonicalJson({ selection, facts, manifests, policy: policy ? fingerprint(canonicalJson(policy)) : null, allowances: allowances.settings }));
  // Diagnose freshness independently of dependent gates. Only timestamps and
  // digests cross this seam; observation payloads and collector errors do not.
  // These diagnostics are outside the facts/fingerprint and confer no authority.
  const diagnosticTime = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/u.test(value) && value.length <= 40 ? value : null;
  const diagnosticDigest = value => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value) ? value : null;
  const observationDiagnostics = Object.fromEntries(["runtime", "authentication", "environment", "modelAvailability"].map(name => {
    const observed = observations[name];
    const age = observed ? Date.parse(now) - Date.parse(observed.observedAt) : NaN;
    return [name, {
      observedAt: diagnosticTime(observed?.observedAt),
      evaluatedAt: diagnosticTime(now),
      ageMs: Number.isFinite(age) ? age : null,
      maxAgeMs: OBSERVATION_MAX_AGE_MS,
      expectedContextFingerprint: contextFingerprint,
      actualContextFingerprint: diagnosticDigest(observed?.contextFingerprint),
      reason: !observed ? "unobserved" : observed.contextFingerprint !== contextFingerprint ? "context-mismatch"
        : !Number.isFinite(age) ? "invalid" : age < 0 ? "future" : age > OBSERVATION_MAX_AGE_MS ? "expired" : "current",
    }];
  }));
  const currentObservation = name => {
    const observed = observations[name];
    const code = name === "modelAvailability" ? "native-model" : name;
    if (!observed) return fact("unknown", code + "-unprobed", "Inspection does not run probes", null, "Obtain approved current " + name + " evidence");
    const age = Date.parse(now) - Date.parse(observed.observedAt);
    if (observed.contextFingerprint !== contextFingerprint || !Number.isFinite(age) || age < 0 || age > OBSERVATION_MAX_AGE_MS) return blocked(code + "-stale", "Observation is expired or bound to different inputs", "Refresh approved " + name + " evidence");
    return observed.fact && ["satisfied", "blocked", "unknown", "unavailable"].includes(observed.fact.state) ? observed.fact : blocked(code + "-evidence-invalid", "Malformed observation");
  };
  facts.runtime = policy?.runtime ? currentObservation("runtime") : blocked("no-worker-runtime-configured", null, "Configure and qualify the isolated runtime");
  if (facts.runtime.state === "satisfied") {
    const evidence = facts.runtime.evidence, expected = boundaryBindingDigest(policy.runtime, policy.runtime.image, evidence?.egressId || null);
    if (!chosen || evidence?.image !== policy.runtime.image || evidence?.binding?.backend_id !== chosen.backend_id || evidence.binding.boundary_digest !== expected ||
        (policy.runtime.network.mode === "namespace-proxy" && !evidence.egressId)) facts.runtime = blocked("runtime-binding-mismatch", "Probe is not bound to the installed image/boundary/executor");
  }
  facts.authentication = facts.runtime.state === "satisfied" ? currentObservation("authentication") : unavailable("authentication-runtime-unavailable", "Runtime evidence is required; credentials were not read");
  if (facts.authentication.state === "satisfied") {
    const evidence = facts.authentication.evidence;
    if (!chosen || evidence?.backend_id !== chosen.backend_id || evidence.additionalSpendAllowed !== false || evidence.includedUsageAvailable !== true || evidence.method !== (chosen.id === "codex" ? "chatgpt" : "claude.ai")) facts.authentication = blocked("subscription-evidence-invalid", "Subscription-only included usage is not proven", "Review approved subscription readiness evidence");
  }
  const managed = policy?.runtime?.dependencies?.environment;
  facts.environment = !managed ? blocked("managed-environment-not-configured", "DLV-133 operational witness/activation is pending", "Complete separately approved DLV-133 witness and activation") : currentObservation("environment");
  if (facts.environment.state === "satisfied") {
    const receipt = facts.environment.evidence?.receipt;
    if (!verifyEnvironmentReceipt(receipt) || canonicalJson(environmentReference(receipt).environment) !== canonicalJson(managed)) facts.environment = blocked("environment-receipt-invalid", "Managed environment identity/evidence is incomplete", "Review DLV-133 environment receipt");
    else if (!manifests || manifests[0].sha256 !== receipt.spec.packageDigest || manifests[1].sha256 !== receipt.spec.lockDigest) facts.environment = blocked("environment-manifest-mismatch", "Current manifest/lock differs from verified environment", "Review a separately staged environment for the current inputs");
    else {
      const commands = Object.entries(policy.checks.specs).filter(([, spec]) => spec.kind === "command");
      const matching = commands.map(([id, spec]) => receipt.spec.oracles.find(oracle => oracle.id === id && canonicalJson(oracle.argv) === canonicalJson(spec.argv)));
      const hashes = Object.assign({}, ...matching.filter(Boolean).map(oracle => oracle.inputs));
      let bindingMismatch = false;
      if (receipt.spec.checks || commands.some(([, spec]) => spec.expected?.assertions !== undefined)) {
        try {
          const bindings = bindEnvironmentChecks({ oracles: receipt.spec.oracles, checks: policy.checks, inputs: Object.fromEntries(checkInputs.map(row => [row.path, row.sha256])) });
          bindingMismatch = canonicalJson(bindings) !== canonicalJson(receipt.spec.checks);
        } catch { bindingMismatch = true; }
      }
      if (bindingMismatch || matching.some(oracle => !oracle) || checkInputs.some(entry => hashes[entry.path] !== entry.sha256)) facts.environment = blocked("environment-check-input-mismatch", "Verified command executables, assertions or protected inputs differ from current checks", "Review current protected oracle inputs under DLV-133");
    }
  }
  facts.modelAvailability = chosen?.id === "codex" ? currentObservation("modelAvailability") : fact("satisfied", "native-model-check-not-applicable", "This native catalog check applies to Codex only");
  if (chosen?.id === "codex" && facts.modelAvailability.state === "satisfied") {
    facts.modelAvailability = facts.runtime.state === "satisfied" && facts.authentication.state === "satisfied" && facts.environment.state === "satisfied"
      ? nativeModelAvailabilityFact({ selection, evidence: facts.modelAvailability.evidence,
        expectedNativeVersion: facts.environment.evidence?.receipt?.probes?.nativePackages?.["@openai/codex-sdk"]?.cliVersion, now: Date.parse(now) })
      : unavailable("native-model-runtime-unavailable", "Current runtime, subscription and environment evidence is required");
  }
  let described = null;
  if (chosen && facts.runtime.state === "satisfied" && facts.environment.state === "satisfied") {
    const binding = facts.runtime.evidence?.binding;
    const qualification = loadQualification({ root, backend_id: chosen.backend_id, binding });
    if (qualification.ok) {
      described = await describeExecutor(chosen.backend_id, { observations: qualification.observations, qualification_ref: qualification.qualification_ref, observed_at: qualification.observed_at, runtime: { binding: qualification.binding } });
      const admitted = described.ok && admitExecutorProfile(described.profile, { requireConfinement: true, strictBoundRequired: policy.resources.strict || policy.executors.strictBoundRequired || policy.resources.enforcement === "hard-cap" });
      facts.qualification = admitted?.admitted ? fact("satisfied", "qualification-bound", null, { ref: qualification.qualification_ref, binding }) : { ...blocked("qualification-not-admitted", null), reasons: admitted?.refusals || [described.refusal] };
    } else facts.qualification = { ...blocked("qualification-unavailable", null), reasons: qualification.refusals };
  } else facts.qualification = unavailable("qualification-binding-unavailable", "Current runtime/environment binding is required");
  if (!policy || !allowances.ok || storeError) facts.budget = { ...unavailable("budget-evidence-unavailable", allowances.error || storeError || "Policy unavailable", "Review allowance/store evidence"), evidence: policy ? { unit: policy.resources.unit, configuredAllowance: policy.resources.allowance, reservation: policy.resources.perJobReservation.amount, usage: "unknown" } : null };
  else {
    const limits = { ...policy.resources, allowance: runAllowance({ settings: allowances.settings, grantAllowance: policy.resources.allowance, run_id: "" }).allowance }, reservation = limits.perJobReservation.amount;
    const enforcement = resolveEnforcement({ mode: limits.enforcement, limit: limits.allowance, unit: limits.unit, capability: described?.profile?.resources || {} });
    const reasons = [...enforcement.refusals];
    if (reservation == null || (limits.allowance != null && reservation > limits.allowance)) reasons.push({ code: "budget-reservation-unavailable", detail: reservation });
    facts.budget = { ...fact(reasons.length ? "blocked" : "satisfied", "budget-configured", limits.enforcement === "advisory" ? "Advisory; no in-job hard-cap claim" : limits.enforcement, { unit: limits.unit, allowance: limits.allowance, reservation, enforcement: enforcement.mode, fleetAllowance: policy.concurrency.fleetAllowance }), reasons };
  }
  const result = evaluateReadiness({ selection, facts });
  return { ...result, contextFingerprint, observationDiagnostics,
    nativeModelDiagnostics: chosen?.id === "codex" ? nativeModelDiagnostics({ selection,
      evidence: observations.modelAvailability?.fact?.evidence,
      expectedNativeVersion: observations.environment?.fact?.evidence?.receipt?.probes?.nativePackages?.["@openai/codex-sdk"]?.cliVersion }) : null,
    assessment, testGate, expiresAt: result.ready ? new Date(Math.min(Date.parse(now) + 30_000, ...Object.values(observations).map(value => Date.parse(value.observedAt) + OBSERVATION_MAX_AGE_MS))).toISOString() : null };
}
