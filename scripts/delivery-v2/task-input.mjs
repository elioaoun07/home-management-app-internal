// Selected-item input only. Pure: no source access, authority or provider calls.
import { canonicalJson, deepFreeze, fingerprint, normalizeSourceText } from "./contracts.mjs";
import { classifyRelativePath } from "./scratch.mjs";

export const BINDING_VERSION = "binding-v2:";
const OPEN = "<!-- delivery:advisory:v1 -->";
const CLOSE = "<!-- /delivery:advisory -->";

/** Only explicitly adopted advisory blocks are removed from NEW fingerprints.
 * Legacy Reading guide bullets remain bound: they can contain requirements.
 * Malformed/duplicate delimiters fail conservatively by binding everything.
 */
export function splitTaskInput(section = "", separateAdvisory = true) {
  const text = String(section || "").trim();
  const lines = text.split(/\r?\n/u);
  const starts = lines.flatMap((line, i) => line === OPEN ? [i] : []);
  const ends = lines.flatMap((line, i) => line === CLOSE ? [i] : []);
  const separated = separateAdvisory && starts.length === 1 && ends.length === 1 && ends[0] > starts[0];
  const binding = separated ? [...lines.slice(0, starts[0]), ...lines.slice(ends[0] + 1)].join("\n").trim() : text;
  const guide = separated ? lines.slice(starts[0] + 1, ends[0]).join("\n").trim() : "";
  return deepFreeze({ version: 1, binding, guide, guide_digest: fingerprint(guide), section_digest: fingerprint(text) });
}

export function bindingFingerprint(section) {
  return BINDING_VERSION + fingerprint(normalizeSourceText(splitTaskInput(section).binding));
}

const strings = (value, nonempty = false) => Array.isArray(value) && (!nonempty || value.length > 0) && value.every(v => typeof v === "string" && v.trim());
const RISK = /\b(money|payments?|transfers?|balances?|currenc(?:y|ies)|recurr\w*|auth\w*|rls|permissions?|security|migrations?|cross[- ]module)\b/iu;
const allowedPath = (path, roots) => roots.some(root => path === root || path.startsWith(root.replace(/\/$/u, "") + "/"));
const PREPARED_FIELDS = new Set(["outcome", "acceptance", "scope", "steps", "invariants", "exclusions", "checks", "risks", "unknowns", "dependencies", "risk", "ownerReviewed", "provenance"]);

/** Opt-in source material, never an inferred plan from a title/Touches list.
 * A source declaration is provenance, NOT authority: the normal plan decision
 * is still required. Ineligible input always goes to ordinary investigation.
 */
export function preparedPlanFor({ input, alias, profile, contract, policy, facts = {}, sourceExists = () => false }) {
  const no = reason => ({ eligible: false, reason, body: null });
  if (profile !== "focused") return no("profile-needs-investigation");
  if (String(alias).toUpperCase() === "DLV-134") return no("unapproved-acceptance");
  const text = input.binding;
  const blocks = [...text.matchAll(/^```delivery-plan-v1\s*\r?\n([\s\S]*?)^```\s*$/gmu)];
  if (blocks.length !== 1) return no("no-single-prepared-plan");
  let body;
  try { body = JSON.parse(blocks[0][1]); } catch { return no("invalid-prepared-plan"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return no("invalid-prepared-plan");
  if (Object.keys(body).some(key => !PREPARED_FIELDS.has(key))) return no("unsupported-prepared-fields");
  if (body.ownerReviewed !== true || typeof body.provenance !== "string" || !body.provenance.trim() || body.risk !== "low") return no("readiness-not-recorded");
  if (typeof body.outcome !== "string" || !body.outcome.trim() || !strings(body.acceptance, true) || !strings(body.scope, true) || !strings(body.steps, true) || !strings(body.invariants, true) || !strings(body.exclusions, true) || !strings(body.checks, true)) return no("incomplete-prepared-plan");
  if (!strings(body.risks) || !strings(body.unknowns) || !strings(body.dependencies) || body.unknowns.length || body.dependencies.length || (facts.dependencyIds || []).length) return no("unresolved-work");
  // Conservative initial exclusions. Explicit low-risk attestation alone cannot
  // override risky source text or sensitive paths.
  const modules = new Set(body.scope.map(p => /^src\/features\/([^/]+)\//u.exec(p)?.[1]).filter(Boolean));
  if (modules.size > 1 || RISK.test(text + "\n" + contract.outcome) || body.scope.some(p => /(^|\/)(migrations|supabase|auth|permissions|recurr\w*|budget|debts|envelopes|accounts|transactions)(\/|\.)/iu.test(p))) return no("risk-needs-investigation");
  // Snapshot include entries are exact files, not recursively copied folders.
  if (!Array.isArray(facts.declared) || body.scope.some(p => !classifyRelativePath(p).ok || !allowedPath(p, facts.declared) || !allowedPath(p, contract.publicationScope.allowedPaths) || !(contract.scratchScope.include || []).includes(p))) return no("scope-not-authorized");
  const required = policy.criteria.filter(c => c.required_for === "candidate" || (Array.isArray(c.required_for) && c.required_for.includes("candidate")));
  if (!required.length || required.some(c => !body.checks.includes(c.criterion_id))) return no("missing-required-checks");
  for (const id of body.checks) {
    const criterion = policy.criteria.find(c => c.criterion_id === id);
    const spec = criterion && policy.checks.specs[criterion.observer?.expected?.spec_id];
    if (!criterion || !spec || spec.kind !== "command" || !strings(spec.argv, true) || !policy.checks.inputs.includes(criterion.oracle_ref) || !sourceExists(criterion.oracle_ref)) return no("check-not-prepared");
  }
  if ((policy.checks.inputs || []).some(p => !sourceExists(p) || !(contract.scratchScope.include || []).includes(p))) return no("check-input-unavailable");
  return deepFreeze({ eligible: true, reason: null, body });
}

/** @param {{input:{binding:string, guide:string, guide_digest:string}, contract:import('./contracts.mjs').Contract,
 * alias:string|null, plan?:{revision:number, body:object}|null, answers?:object[], failedCandidate?:object|null}} args */
export function makeTaskBrief({ input, contract, alias, plan = null, answers = [], failedCandidate = null }) {
  // The prepared block and its normalized plan are the same reviewed material.
  // Keep one copy; surrounding binding requirements must remain untouched.
  const prepared = plan?.body?.preparation;
  const binding = prepared?.kind === "selected-item" && prepared.acceptance_fingerprint === contract.acceptance_fingerprint
    ? input.binding.replace(/^```delivery-plan-v1\s*\r?\n[\s\S]*?^```\s*$/gmu, "Prepared implementation material: see plan.body.") : input.binding;
  const body = {
    version: 1, item: alias, contract_id: contract.contract_id, contract_revision: contract.revision,
    acceptance_fingerprint: contract.acceptance_fingerprint, outcome: contract.outcome,
    binding, exclusions: contract.exclusions, allowed_paths: contract.publicationScope.allowedPaths,
    criteria: contract.criteria_refs, plan: plan ? { revision: plan.revision, body: plan.body } : null,
    answers, guidance: { advisory: true, text: input.guide, digest: input.guide_digest },
    ...(failedCandidate ? { failed_candidate: failedCandidate } : {}),
  };
  const text = canonicalJson(body);
  const digest = fingerprint(text);
  return deepFreeze({ text, digest, path: "/tmp/era-task-brief-" + digest.replace(/[^a-z0-9]/giu, "") + ".json" });
}

export const INSPECTION_RULE = " Inspect current code before editing. Start with the selected item's guide or declared scope; verify references and follow necessary dependencies. Group independent focused reads and compatible edits. Guidance does not grant access or change acceptance. If required inputs are unavailable, or current code requires a material plan/scope change, stop with a blocking question; do not broaden authority or guess.";

/** The authoritative brief lives in request_json. The worker copy is recoverable
 * after native compaction. No source files or conversation transcripts are added.
 */
export function briefInstruction({ instruction, brief, input, plan, continued, recoverable }) {
  let text = instruction;
  if (input.binding) text = text.replace("\n\nAcceptance:\n" + input.binding, "");
  if (plan) {
    const body = JSON.stringify(plan.body);
    text = text.replace("\n\nPlan:\n" + body, "")
      .replace("\n\nPrevious plan (revision " + plan.revision + "):\n" + body, "")
      .replace("\n\nApproved plan (revision " + plan.revision + "):\n" + body, "");
  }
  const reference = recoverable ? "\n\nTask brief (including the exact plan): " + brief.path + ". Read it if any task facts or plan details are missing from context; do not reconstruct them from memory." : "";
  return text + INSPECTION_RULE + reference + (continued && recoverable ? "" : "\n\nTask brief:\n" + brief.text);
}
