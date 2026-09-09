// scripts/delivery-v2/policy.mjs
// PM Delivery V2 — the execution policy, and the `deliver` it builds.
//
// `POST /api/delivery/v2/deliver` has refused with `no-deliver-policy-configured`
// since S1.4 landed, because `service.mjs` passes `deliver: null`. That refusal
// was correct and stays correct; what was missing was any way for the owner to
// stop it being the answer. Execution Portfolio S1.4: "Future implementation
// authorization identifies the pilot's gate policy explicitly." This module is
// where "explicitly" gets a shape.
//
// What was already here, and what actually had to be built
// --------------------------------------------------------
// Almost every concept the owner listed already existed in the contract layer and
// only needed a place to be *stated*:
//
//   executor permission   → Grant.permitted_executors (profile ids)
//   allowed effects       → Grant.permitted_effects, and PERMITTED_EFFECTS
//   spend limit           → Grant.resource_policy {unit, allowance, strict}
//   expiry                → Grant.expires_at, checked by evaluateGrant
//   retry behaviour       → retryEligibility — already "never re-dispatch a
//                           marked job", which is not a tunable
//   repair budget         → admitJob's repairDispatchLimit
//   approval requirements → REQUESTED_DISPOSITIONS + dispositionObligations
//   escalation            → an unknown job holds its reservation, by construction
//
// So this file is a validated document format and a loader, not a policy engine.
// It adds exactly one enforcement idea of its own — `maxRequestedDisposition`,
// which caps what a *request* may ask for before a contract is frozen — because
// that was the one listed concern with nowhere to live.
//
// Three refusals are structural and not configurable
// --------------------------------------------------
//   1. `publish` cannot be granted by this schema version. Under current
//      operating rules the first useful endpoint is a checked candidate plus an
//      owner handoff; git writes and releases are the owner's. A policy file that
//      asks for it is rejected, not silently trimmed, so nobody can believe they
//      configured it.
//   2. `requireQualifiedProfile` and `requireConfinement` may be present and must
//      be `true`. They exist in the schema so the document is self-describing —
//      an owner reading it can see what is being demanded — not so they can be
//      turned off. Setting either to false is a validation error with a reason.
//   3. `deliver` admits; it does not dispatch. This module can produce an
//      authorized Job and a JobRequest. Sending that request to a provider is a
//      separate, separately authorized step. A policy file therefore cannot, by
//      itself, cause paid work.
//
// Which means: installing a policy does not make a pilot happen. With the policy
// in place, `deliver` gets far enough to refuse on `profile-not-admitted`, which
// is the containment gate — the honest end of this road today.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ContractError,
  PERMITTED_EFFECTS,
  REQUESTED_DISPOSITIONS,
  authorizeGrant,
  deepFreeze,
  makeCriterion,
  normalizePath,
} from "./contracts.mjs";
import { deliverSelection } from "./entry.mjs";
import { freezeSelectedItem } from "./work-ref.mjs";
import { admitExecutorProfile, describeExecutor, resolveExecutorChoice } from "./adapters/registry.mjs";

/** Where the policy lives. One file, owner-authored, gitignored with .delivery/. */
export const EXECUTION_POLICY_REL = ".delivery/v2/execution-policy.json";

/** The schema this loader understands. A different one is refused, not migrated. */
export const EXECUTION_POLICY_SCHEMA = "delivery-v2/execution-policy@1";

/** Why a policy document, or a delivery under it, was refused. */
export const POLICY_REFUSALS = Object.freeze({
  ABSENT: "no-deliver-policy-configured",
  UNREADABLE: "policy-unreadable",
  SCHEMA: "policy-schema-unrecognised",
  INVALID: "policy-invalid",
  WEAKENED: "policy-weakens-a-structural-gate",
  EXECUTOR_NOT_PERMITTED: "executor-not-permitted-by-policy",
  DISPOSITION_TOO_HIGH: "requested-disposition-above-policy-ceiling",
  SOURCE_UNREADABLE: "work-source-unreadable",
  SOURCE_OUTSIDE_ROOT: "work-source-outside-pm-root",
});

/**
 * Effects this schema version may grant.
 *
 * `publish` is absent by construction. See the header: it is a structural
 * refusal, and a policy asking for it is rejected rather than trimmed.
 */
export const GRANTABLE_EFFECTS = Object.freeze(
  PERMITTED_EFFECTS.filter((effect) => effect !== "publish"),
);

/** Dispositions ordered by how much authority delivering them would need. */
const DISPOSITION_LADDER = Object.freeze([
  "research_answer",
  "verified_candidate",
  "applied_change",
  "verified_deployment",
]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** @param {string} root */
export function executionPolicyPath(root) {
  return join(root, ...EXECUTION_POLICY_REL.split("/"));
}

/**
 * Validate one policy document.
 *
 * Hand-written rather than schema-driven, matching contracts.mjs: every refusal
 * carries the sentence an owner needs to fix the file, and a validator that only
 * says "invalid" would be worse than the absent-file refusal it replaces.
 *
 * Every default here is the conservative one. Omitting `resources.allowance`
 * means "no numeric ceiling is claimed", which is honest but is *not* an infinite
 * budget — `evaluateGrant` still counts open reservations, and a strict policy
 * over a null allowance is refused by `authorizeGrant` because there would be
 * nothing to enforce.
 *
 * @param {unknown} raw
 * @returns {{ok:boolean, policy:(object|null), refusals:readonly {code:string, detail:string}[]}}
 */
export function validateExecutionPolicy(raw) {
  /** @type {{code:string, detail:string}[]} */
  const refusals = [];
  const bad = (code, detail) => refusals.push({ code, detail });

  if (!isPlainObject(raw)) {
    return deepFreeze({ ok: false, policy: null, refusals: [{ code: POLICY_REFUSALS.INVALID, detail: "the policy must be a JSON object" }] });
  }
  if (raw.schema !== EXECUTION_POLICY_SCHEMA) {
    return deepFreeze({
      ok: false,
      policy: null,
      refusals: [
        {
          code: POLICY_REFUSALS.SCHEMA,
          detail: "expected schema " + EXECUTION_POLICY_SCHEMA + ", found " + String(raw.schema),
        },
      ],
    });
  }
  if (!Number.isInteger(raw.policy_revision) || raw.policy_revision < 1) {
    bad(POLICY_REFUSALS.INVALID, "policy_revision must be a positive integer; a grant is bound to it");
  }
  if (!isNonEmptyString(raw.authorized_by)) {
    bad(POLICY_REFUSALS.INVALID, "authorized_by must name the person who authorized this policy");
  }
  if (!isNonEmptyString(raw.authorized_at)) {
    bad(POLICY_REFUSALS.INVALID, "authorized_at must be an ISO timestamp");
  }

  // --- executors -----------------------------------------------------------
  const executors = isPlainObject(raw.executors) ? raw.executors : {};
  const permittedIds = Array.isArray(executors.permitted) ? executors.permitted : [];
  if (permittedIds.length === 0) {
    bad(POLICY_REFUSALS.INVALID, "executors.permitted must name at least one executor; a policy permitting none authorizes nothing");
  }
  const permittedExecutors = [];
  for (const entry of permittedIds) {
    const resolved = resolveExecutorChoice(entry);
    if (!resolved) bad(POLICY_REFUSALS.INVALID, "executors.permitted names an unknown executor: " + String(entry));
    else permittedExecutors.push(resolved.backend_id);
  }
  if (executors.requireQualifiedProfile === false) {
    bad(
      POLICY_REFUSALS.WEAKENED,
      "executors.requireQualifiedProfile cannot be false. An unqualified profile is refused by admitProfile(), and a policy file is not the place to overrule a containment observation.",
    );
  }
  if (executors.requireConfinement === false) {
    bad(
      POLICY_REFUSALS.WEAKENED,
      "executors.requireConfinement cannot be false. Confinement is the gate this whole stage is blocked on; turning it off in configuration would be the exact move the plan forbids.",
    );
  }

  // --- effects -------------------------------------------------------------
  const grant = isPlainObject(raw.grant) ? raw.grant : {};
  const effects = Array.isArray(grant.permitted_effects) ? grant.permitted_effects : [];
  if (effects.length === 0) {
    bad(POLICY_REFUSALS.INVALID, "grant.permitted_effects must name at least one effect");
  }
  for (const effect of effects) {
    if (!PERMITTED_EFFECTS.includes(effect)) {
      bad(POLICY_REFUSALS.INVALID, "grant.permitted_effects names an unknown effect: " + String(effect));
    } else if (!GRANTABLE_EFFECTS.includes(effect)) {
      bad(
        POLICY_REFUSALS.WEAKENED,
        "grant.permitted_effects may not include '" +
          effect +
          "' at this schema version. Applying or releasing a change is the owner's, and a policy file cannot grant it.",
      );
    }
  }

  // --- resources -----------------------------------------------------------
  const resources = isPlainObject(raw.resources) ? raw.resources : {};
  if (!isNonEmptyString(resources.unit)) {
    bad(POLICY_REFUSALS.INVALID, "resources.unit must state the unit the allowance is denominated in (e.g. \"usd\")");
  }
  const allowance = resources.allowance == null ? null : Number(resources.allowance);
  if (allowance != null && !(Number.isFinite(allowance) && allowance > 0)) {
    bad(POLICY_REFUSALS.INVALID, "resources.allowance must be a positive number, or null for \"no numeric ceiling is claimed\"");
  }
  if (resources.strict === true && allowance == null) {
    bad(POLICY_REFUSALS.INVALID, "resources.strict needs a numeric allowance; there would be nothing to enforce otherwise");
  }
  const reservation = isPlainObject(resources.perJobReservation) ? resources.perJobReservation : {};
  if (!isNonEmptyString(reservation.basis)) {
    bad(
      POLICY_REFUSALS.INVALID,
      "resources.perJobReservation.basis must say where the reservation amount comes from, so \"we do not know what this costs\" cannot be read as \"this is free\"",
    );
  }
  const reservationAmount = reservation.amount == null ? null : Number(reservation.amount);
  if (reservationAmount != null && !(Number.isFinite(reservationAmount) && reservationAmount >= 0)) {
    bad(POLICY_REFUSALS.INVALID, "resources.perJobReservation.amount must be a non-negative number or null");
  }

  // --- execution -----------------------------------------------------------
  const execution = isPlainObject(raw.execution) ? raw.execution : {};
  const ceiling = execution.maxRequestedDisposition;
  if (!REQUESTED_DISPOSITIONS.includes(ceiling)) {
    bad(
      POLICY_REFUSALS.INVALID,
      "execution.maxRequestedDisposition must be one of " + REQUESTED_DISPOSITIONS.join(", "),
    );
  }
  if (execution.retryAutomatically === true) {
    bad(
      POLICY_REFUSALS.WEAKENED,
      "execution.retryAutomatically cannot be true. A job whose dispatch marker is set may have reached the provider; retrying it is the one thing the job layer refuses unconditionally.",
    );
  }
  const repairLimit = execution.repairDispatchLimit == null ? null : Number(execution.repairDispatchLimit);
  if (repairLimit != null && !(Number.isInteger(repairLimit) && repairLimit >= 0)) {
    bad(POLICY_REFUSALS.INVALID, "execution.repairDispatchLimit must be a non-negative integer or null");
  }

  // --- scopes --------------------------------------------------------------
  if (!isPlainObject(raw.scratchScope)) {
    bad(POLICY_REFUSALS.INVALID, "scratchScope is required; a job has no unconfined mode");
  }
  const publicationScope = isPlainObject(raw.publicationScope) ? raw.publicationScope : null;
  if (!publicationScope || !Array.isArray(publicationScope.allowedPaths)) {
    bad(POLICY_REFUSALS.INVALID, "publicationScope.allowedPaths is required (it may be an empty list)");
  }

  // --- criteria ------------------------------------------------------------
  const criteriaInput = Array.isArray(raw.criteria) ? raw.criteria : [];
  const criteria = [];
  for (const entry of criteriaInput) {
    try {
      criteria.push(makeCriterion(entry));
    } catch (error) {
      bad(POLICY_REFUSALS.INVALID, "criteria[]: " + String((error && error.message) || error));
    }
  }

  if (refusals.length) return deepFreeze({ ok: false, policy: null, refusals });

  return deepFreeze({
    ok: true,
    refusals: [],
    policy: {
      schema: EXECUTION_POLICY_SCHEMA,
      policy_revision: raw.policy_revision,
      authorized_by: raw.authorized_by,
      authorized_at: raw.authorized_at,
      note: isNonEmptyString(raw.note) ? raw.note : null,
      executors: {
        permitted: Object.freeze([...permittedExecutors]),
        requireQualifiedProfile: true,
        requireConfinement: true,
        strictBoundRequired: Boolean(executors.strictBoundRequired),
      },
      grant: {
        permitted_effects: Object.freeze([...effects]),
        expires_at: isNonEmptyString(grant.expires_at) ? grant.expires_at : null,
      },
      resources: {
        unit: resources.unit,
        allowance,
        strict: Boolean(resources.strict),
        perJobReservation: { amount: reservationAmount, basis: reservation.basis },
      },
      execution: {
        maxRequestedDisposition: ceiling,
        repairDispatchLimit: repairLimit,
        retryAutomatically: false,
        // Recorded so the document says what happens, even though neither is a
        // knob: an unknown dispatch holds its reservation and surfaces as an
        // owner action, and that is enforced in jobs.mjs, not here.
        onUnknownDispatch: "hold the reservation and surface it as an outstanding owner action",
        onCheckFailure:
          repairLimit === 0
            ? "report the failure; no supervisor-dispatched repair is authorized"
            : "up to " + String(repairLimit ?? "an unstated number of") + " supervisor-dispatched repair(s), then report",
      },
      approvals: {
        // Fixed list. These are the acts a policy file cannot pre-approve.
        requiredFromOwner: Object.freeze([
          "applying a candidate to the host workspace",
          "any git write or release",
          "any production database write",
          "raising execution.maxRequestedDisposition",
          "changing the selected executor",
          "revising this policy",
        ]),
      },
      scratchScope: { ...raw.scratchScope },
      publicationScope: {
        allowedPaths: Object.freeze([...publicationScope.allowedPaths].map(normalizePath)),
        changeConstraints: isPlainObject(publicationScope.changeConstraints) ? { ...publicationScope.changeConstraints } : {},
      },
      criteria: Object.freeze(criteria),
    },
  });
}

/**
 * Load and validate the installation's policy.
 *
 * An absent file is the normal state and is reported as `ABSENT`, not as an
 * error: the deliver route's existing refusal is exactly right for it, and
 * nothing here should make an unconfigured installation look broken.
 *
 * @param {{root:string, readFile?:Function}} input
 */
export function loadExecutionPolicy({ root, readFile = null }) {
  const path = executionPolicyPath(root);
  const read = readFile || ((p) => (existsSync(p) ? readFileSync(p, "utf8") : null));
  const text = read(path);
  if (text == null) {
    return deepFreeze({
      ok: false,
      policy: null,
      path: normalizePath(path),
      refusals: [
        {
          code: POLICY_REFUSALS.ABSENT,
          detail:
            "no execution policy is installed at " +
            EXECUTION_POLICY_REL +
            "; v2 dispatch refuses until one is authorized. See scripts/delivery-v2/policy.mjs for the document shape.",
        },
      ],
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return deepFreeze({
      ok: false,
      policy: null,
      path: normalizePath(path),
      refusals: [{ code: POLICY_REFUSALS.UNREADABLE, detail: String((error && error.message) || error) }],
    });
  }
  const validated = validateExecutionPolicy(parsed);
  return deepFreeze({ ...validated, path: normalizePath(path) });
}

/**
 * Is this executor permitted by this policy?
 *
 * Separate from the Grant's `permitted_executors` on purpose. The Grant names
 * *profile ids*, which are content-derived and change whenever an observation
 * changes — correct for binding a run to the exact thing that was qualified, and
 * useless for an owner writing a file by hand. The policy names backends; the
 * grant, built below, names the profile.
 *
 * @param {object} policy
 * @param {string} backend_id
 */
export function executorPermitted(policy, backend_id) {
  return policy.executors.permitted.includes(backend_id);
}

/**
 * Where the ceiling bites.
 *
 * The one enforcement idea this module adds. `Contract.requestedDisposition` is
 * copied verbatim from the request by design — Architecture §5 warns dispositions
 * are not a numeric ladder and forbids quietly rewriting a request for a deployed
 * fix into a candidate-only promise. So the check happens *before* a contract is
 * frozen and refuses, rather than after and downgrading.
 *
 * @param {object} policy
 * @param {string} requested
 */
export function dispositionWithinCeiling(policy, requested) {
  const ceiling = policy.execution.maxRequestedDisposition;
  const wantedIndex = DISPOSITION_LADDER.indexOf(requested);
  const ceilingIndex = DISPOSITION_LADDER.indexOf(ceiling);
  if (wantedIndex === -1 || ceilingIndex === -1) return { ok: false, detail: "unrecognised disposition" };
  if (wantedIndex > ceilingIndex) {
    return {
      ok: false,
      detail:
        "this policy authorizes up to " +
        ceiling +
        "; the request asks for " +
        requested +
        ". Raise the policy explicitly, or ask for less — it is not downgraded silently.",
    };
  }
  return { ok: true, detail: null };
}

/**
 * Build the Grant for one contract revision under this policy.
 *
 * Bound to the exact contract revision and the exact profile id, so a re-frozen
 * contract or a re-observed profile produces a different grant rather than
 * inheriting authority it was not given.
 *
 * @param {{policy:object, contract:object, profile:object}} input
 */
export function buildGrant({ policy, contract, profile }) {
  return authorizeGrant({
    contract_id: contract.contract_id,
    contract_revision: contract.revision,
    policy_revision: policy.policy_revision,
    permitted_effects: [...policy.grant.permitted_effects],
    permitted_executors: [profile.profile_id],
    resource_policy: {
      unit: policy.resources.unit,
      allowance: policy.resources.allowance,
      strict: policy.resources.strict,
    },
    expires_at: policy.grant.expires_at,
    actor: policy.authorized_by,
  });
}

/**
 * Resolve a PM-relative work file to an absolute path inside the PM root.
 *
 * The deliver route takes a file path from a request. Without this, `..` in that
 * path would let a caller freeze a contract against any file on the machine.
 *
 * @param {{root:string, pmRel:string, file:string}} input
 */
export function resolveWorkFile({ root, pmRel, file }) {
  if (!isNonEmptyString(file)) return { ok: false, path: null, detail: "no work file was named" };
  const pmRoot = normalizePath(join(root, pmRel));
  const candidate = normalizePath(join(root, pmRel, file));
  if (candidate !== pmRoot && !candidate.startsWith(pmRoot + "/")) {
    return { ok: false, path: null, detail: file + " resolves outside the project-management root" };
  }
  return { ok: true, path: candidate, detail: null };
}

/**
 * Build the `deliver` function `entry.mjs` calls.
 *
 * Returns null when no valid policy is installed, which is what keeps
 * `no-deliver-policy-configured` as the answer on an unconfigured installation —
 * the route checks `typeof ctx.deliver === "function"`, so a null here is the
 * refusal, unchanged.
 *
 * What the returned function does, in order, and why the order is the argument:
 *   1. check the executor against the policy — before a command id is spent;
 *   2. check the requested disposition against the ceiling — before a contract
 *      is frozen, so nothing is downgraded after the fact;
 *   3. read the work source and freeze the contract;
 *   4. describe and admit the *selected* executor's profile — its own
 *      observations, no one else's;
 *   5. build the grant against that exact contract and profile;
 *   6. hand all of it to `deliverSelection`, which owns admission.
 *
 * Step 4 is where an unqualified profile stops everything, and today it always
 * does. That is the containment gate, reached through a fully wired path rather
 * than through a missing one.
 *
 * `store` may be a store handle or a function returning one. The function form is
 * what pm-server passes, so an installation with no policy file never opens (and
 * therefore never creates) the supervisor database just by being asked whether it
 * has a policy.
 *
 * @param {{root:string, pmRel:string, store:(object|Function), policyLoader?:Function,
 *   describeExecutor?:Function, readFile?:Function}} input
 */
export function buildDeliver({ root, pmRel, store, policyLoader = null, describeExecutor: describe = null, readFile = null }) {
  const loaded = (policyLoader || loadExecutionPolicy)({ root });
  if (!loaded.ok) return null;
  const getStore = typeof store === "function" ? store : () => store;
  const policy = loaded.policy;
  const describeFn = describe || describeExecutor;
  const read = readFile || ((p) => readFileSync(p, "utf8"));

  /**
   * @param {{file:string, cbidx:number, requestedDisposition?:string, outcome?:string,
   *   actor:string, executor:string, command_id?:string, workspace?:object,
   *   workspaceRoot?:string, instruction?:string}} request
   */
  return async function deliver(request) {
    const refuse = (code, detail) => deepFreeze({ ok: false, refusals: [{ code, detail }], policy_revision: policy.policy_revision });

    const backend_id = String(request.executor || "");
    if (!executorPermitted(policy, backend_id)) {
      return refuse(
        POLICY_REFUSALS.EXECUTOR_NOT_PERMITTED,
        backend_id + " is selected but this policy permits only: " + policy.executors.permitted.join(", "),
      );
    }

    const requestedDisposition = isNonEmptyString(request.requestedDisposition)
      ? request.requestedDisposition
      : policy.execution.maxRequestedDisposition;
    const ceiling = dispositionWithinCeiling(policy, requestedDisposition);
    if (!ceiling.ok) return refuse(POLICY_REFUSALS.DISPOSITION_TOO_HIGH, ceiling.detail);

    const resolved = resolveWorkFile({ root, pmRel, file: String(request.file || "") });
    if (!resolved.ok) return refuse(POLICY_REFUSALS.SOURCE_OUTSIDE_ROOT, resolved.detail);
    let raw;
    try {
      raw = read(resolved.path);
    } catch (error) {
      return refuse(POLICY_REFUSALS.SOURCE_UNREADABLE, String((error && error.message) || error));
    }

    // The selected executor's own profile, from its own adapter. Nothing about
    // the other executor's qualification reaches this call.
    const described = await describeFn(backend_id);
    if (!described.ok) {
      return refuse(described.refusal.code, described.refusal.detail);
    }
    const profileAdmission = admitExecutorProfile(described.profile, {
      requireConfinement: true,
      strictBoundRequired: policy.executors.strictBoundRequired,
    });

    // Frozen once here to learn the contract identity the grant must bind to.
    // freezeSelectedItem is content-derived and side-effect free, so the second
    // freeze inside deliverSelection produces the same contract, not another one.
    const preview = freezeSelectedItem({
      raw,
      file: String(request.file),
      cbidx: Number(request.cbidx),
      outcome: request.outcome || undefined,
      requestedDisposition,
      criteria: policy.criteria,
      scratchScope: policy.scratchScope,
      publicationScope: policy.publicationScope,
    });
    if (!preview.ok) {
      return refuse(POLICY_REFUSALS.SOURCE_UNREADABLE, "the selected row could not be frozen: " + String(preview.reason));
    }

    const grant = buildGrant({ policy, contract: preview.contract, profile: described.profile });

    const outcome = deliverSelection({
      store: getStore(),
      raw,
      file: String(request.file),
      cbidx: Number(request.cbidx),
      requestedDisposition,
      outcome: request.outcome || null,
      criteria: policy.criteria,
      scratchScope: policy.scratchScope,
      publicationScope: policy.publicationScope,
      grant,
      profileAdmission,
      backend_id,
      reservation: {
        unit: policy.resources.unit,
        amount: policy.resources.perJobReservation.amount,
        basis: policy.resources.perJobReservation.basis,
      },
      instruction: isNonEmptyString(request.instruction) ? request.instruction : preview.contract.outcome,
      workspace: request.workspace || { root: String(request.workspaceRoot || ""), backing: "scratch-snapshot" },
      command: {
        command_id: isNonEmptyString(request.command_id) ? request.command_id : "cmd-" + preview.contract.contract_id,
        actor: String(request.actor),
        payload: { file: request.file, cbidx: request.cbidx, executor: backend_id, requestedDisposition },
      },
      nextJobCost: policy.resources.perJobReservation.amount,
      repairDispatchLimit: policy.execution.repairDispatchLimit,
    });

    return deepFreeze({
      ...outcome,
      // Stated on every answer so the owner can see which provider and which
      // policy revision an admission (or a refusal) came from, without inferring
      // it from the installation's current settings.
      executor: backend_id,
      policy_revision: policy.policy_revision,
      profile_id: described.profile.profile_id,
      dispatched: false,
      dispatchNote:
        "deliver admits a Job and builds its request. Sending that request to the provider is a separate, separately authorized step; nothing was dispatched and nothing was paid.",
    });
  };
}

/**
 * A template an owner can copy, fill in and save as the policy file.
 *
 * Exported as data rather than shipped as a file, because a checked-in
 * `execution-policy.json` would be an authorization nobody gave — `.delivery/` is
 * gitignored precisely so an installation's operating decisions are its own.
 * The values below are the most conservative ones that still describe a usable
 * FAST pilot.
 */
export function policyTemplate({ executor = "codex", authorized_by = "<owner>" } = {}) {
  return deepFreeze({
    $comment: [
      "PM Delivery V2 execution policy. Copy to .delivery/v2/execution-policy.json and edit.",
      "Installing this file lifts the `no-deliver-policy-configured` refusal. It does NOT lift the",
      "containment gate: an unqualified executor profile is still refused by admitProfile().",
      "`deliver` admits a job and builds its request; it never dispatches, so this file alone cannot spend money.",
    ],
    schema: EXECUTION_POLICY_SCHEMA,
    policy_revision: 1,
    authorized_by,
    authorized_at: new Date().toISOString(),
    note: "FAST pilot policy.",
    executors: {
      permitted: [executor],
      requireQualifiedProfile: true,
      requireConfinement: true,
      strictBoundRequired: false,
    },
    grant: {
      permitted_effects: ["native_dispatch", "protected_check", "candidate_export", "record_disposition"],
      expires_at: null,
    },
    resources: {
      unit: "usd",
      allowance: null,
      strict: false,
      perJobReservation: {
        amount: null,
        basis: "no monetary ceiling is claimed; the reservation stays open until a cost is observed",
      },
    },
    execution: {
      maxRequestedDisposition: "verified_candidate",
      repairDispatchLimit: 1,
      retryAutomatically: false,
    },
    scratchScope: { kind: "snapshot", include: [] },
    publicationScope: { allowedPaths: [], changeConstraints: {} },
    criteria: [],
  });
}

/** Thrown-shaped helper for callers that would rather fail than branch. */
export function requirePolicy({ root }) {
  const loaded = loadExecutionPolicy({ root });
  if (!loaded.ok) throw new ContractError("execution policy: " + loaded.refusals.map((r) => r.detail).join("; "));
  return loaded.policy;
}
