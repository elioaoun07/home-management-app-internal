// scripts/delivery-v2/service.mjs
// PM Delivery V2 — S1.4: the one local service.
//
// "Use one local service and one local-disk transactional store" — Architecture
// §9. This is that service's plumbing, and deliberately nothing else: it owns the
// store handle, answers the two outstanding-writer questions the dispatch switch
// needs, and hands `entry.mjs` a context. Every decision lives one layer down.
//
// Why the store opens lazily
// -------------------------
// pm-server starts for the PM dashboard, which has nothing to do with delivery
// v2. Opening a SQLite file at boot would create `.delivery/v2/supervisor.sqlite`
// on every installation that has never used V2, and would make a dashboard start
// depend on a database. The handle is created on the first v2 request instead, so
// an installation that never switches never grows a store.
//
// Why `deliver` is still usually null
// -----------------------------------
// The gate policy — which criteria a contract gets, its scratch and publication
// scope, the grant, the reservation — is exactly what S1.4 says a future
// authorization must state explicitly. It is now something the owner can state,
// in `.delivery/v2/execution-policy.json`, and `policy.mjs` validates it and
// builds the `deliver` this context carries. When no such file is installed —
// which is every installation until someone authorizes one — `buildDeliver`
// returns null and `POST /api/delivery/v2/deliver` refuses with
// `no-deliver-policy-configured`, exactly as before. Installing a policy stays a
// deliberate act, not a side effect of wiring the route.
//
// Two executors, one orchestration path
// -------------------------------------
// The context carries an executor *resolver*, not an executor. Which backend a
// dispatch uses comes from the installation's persisted selection; which backend
// an outstanding job is reconciled against comes from that job's own row. Neither
// is a default, and neither falls back to the other provider.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { randomUUID } from "node:crypto";

import { TERMINAL_STATES } from "../delivery/state-machine.mjs";
import { openStore } from "./store.mjs";
import { readExecutorSelection, routeDeliveryV2 as routeEntry } from "./entry.mjs";
import { buildDeliver, loadExecutionPolicy } from "./policy.mjs";
import { EXECUTORS, resolveExecutorChoice, admitExecutorProfile, createExecutor, describeExecutor, listExecutors } from "./adapters/registry.mjs";
import { createJourney } from "./journey.mjs";
import { loadQualification } from "./qualification.mjs";
import { createContainerRuntime } from "./worker-boundary.mjs";
import { inspectReadiness } from "./inspect-readiness.mjs";
import { evaluateReadiness, readinessFact, PASSIVE_GATES } from "./readiness.mjs";
import { listStewardRequests, stewardStaleMs, stewardCommandState } from "./steward-requests.mjs";
import { renewAuthorization } from "./authorization.mjs";

export { routeDeliveryV2 } from "./entry.mjs";

/** Where the supervisor store lives. Gitignored with the rest of `.delivery/`. */
export const STORE_REL = ".delivery/v2/supervisor.sqlite";

const TERMINAL = new Set(TERMINAL_STATES);

/**
 * V1 sessions that are still writers.
 *
 * Read straight off disk rather than through V1's route layer, because the
 * dispatch switch has to be answerable even when V1's own context is not
 * available — and because this is a read of files V1 owns, which is the only
 * direction of coupling that is safe here.
 *
 * A session whose `state.json` cannot be read counts as *active*. That is
 * deliberate: an unreadable writer is not a drained one, and the conservative
 * answer keeps the switch closed.
 *
 * @param {{sessionsDir:string}} input
 */
export function listActiveV1Writers({ sessionsDir }) {
  if (!existsSync(sessionsDir)) return [];
  const active = [];
  let ids = [];
  try {
    ids = readdirSync(sessionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  for (const id of ids) {
    const statePath = join(sessionsDir, id, "state.json");
    if (!existsSync(statePath)) continue;
    try {
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      if (!TERMINAL.has(String(state.state))) active.push(id);
    } catch {
      active.push(id);
    }
  }
  return active.sort();
}

/**
 * Build the context `routeDeliveryV2` expects.
 *
 * `allowedOrigins` is derived from the addresses this server actually answers on.
 * It is a list rather than a wildcard because the whole point of the check is to
 * distinguish "the dashboard this server served" from "any other page in the
 * owner's browser", and a wildcard erases that distinction.
 *
 * `deliver` is built lazily from the policy file on first use rather than at
 * construction, for the same reason the store opens lazily: a dashboard boot
 * should not read, parse and validate a delivery policy it will never use, and an
 * owner who installs or edits the policy should not have to restart pm-server to
 * see the effect.
 *
 * The journey (journey.mjs) is built on first use with the worker runtime the
 * installed policy describes. No policy, or a policy without a runtime, still
 * yields a journey — one that refuses to dispatch and says why.
 *
 * @param {{ROOT:string, pmRel?:string, sessionsDir?:string, port?:number,
 *   allowedOrigins?:string[], deliver?:(Function|null), openStore?:Function,
 *   buildDeliver?:Function, runtimeFactory?:Function, journeyFactory?:Function}} input
 */
export function createDeliveryV2Context({
  ROOT,
  pmRel = join("ERA Notes", "10 - Project Management"),
  sessionsDir = null,
  port = null,
  allowedOrigins = null,
  deliver = null,
  openStore: openStoreOverride = null,
  buildDeliver: buildDeliverOverride = null,
  runtimeFactory = null,
  journeyFactory = null,
}) {
  const sessions = sessionsDir || join(ROOT, ".delivery", "sessions");
  const open = openStoreOverride || openStore;
  const build = buildDeliverOverride || buildDeliver;
  const storePath = join(ROOT, ...STORE_REL.split("/"));
  // One claimant for this process, so a rebuilt journey never releases claims
  // its predecessor in the same process still holds.
  const claimant = "journey:" + process.pid + ":" + randomUUID().slice(0, 8);
  let handle = null;
  let runtimeHandle = null;
  let journeyHandle = null;
  let journeyDigest = undefined;
  let reconciled = false;
  const readinessCache = new Map();
  const readinessPending = new Map();
  const selectionOf = value => ({ file: String(value.file || ""), id: String(value.id || ""), executor: String(value.executor || ""), model: value.model || null, effort: value.effort || null, workProfile: value.workProfile || "focused" });
  const selectionKey = value => JSON.stringify(selectionOf(value));

  const runtimeFor = (loaded) => {
    if (!loaded || !loaded.ok || !loaded.policy.runtime) return null;
    const boundary = loaded.policy.runtime;
    if (!runtimeHandle || runtimeHandle.boundary.digest !== boundary.digest) {
      runtimeHandle = runtimeFactory ? runtimeFactory(boundary) : createContainerRuntime({ boundary, hostRoot: ROOT });
    }
    return runtimeHandle;
  };

  const origins =
    allowedOrigins ||
    (port
      ? ["http://127.0.0.1:" + port, "http://localhost:" + port]
      : ["http://127.0.0.1", "http://localhost"]);

  const context = {
    root: ROOT,
    allowedOrigins: origins,
    get store() {
      if (!handle) handle = open({ path: storePath });
      return handle;
    },

    /**
     * The `deliver` the entry route calls, or null when no policy is installed.
     *
     * An explicit `deliver` passed to this factory still wins — that seam is what
     * fixtures use to drive the route without writing a policy file to disk.
     */
    get deliver() {
      if (deliver) return deliver;
      // The store accessor is passed unevaluated: an installation with no policy
      // file must not grow a supervisor database merely by being asked.
      return build({ root: ROOT, pmRel, store: () => context.store });
    },

    /** The one V2 run lifecycle for this installation. */
    get journey() {
      const loaded = loadExecutionPolicy({ root: ROOT });
      const runtime = runtimeFor(loaded);
      const digest = runtime ? runtime.boundary.digest : null;
      if (!journeyHandle || digest !== journeyDigest) {
        journeyHandle = (journeyFactory || createJourney)({ root: ROOT, pmRel, store: () => context.store, runtime, claimant });
        journeyDigest = digest;
      }
      // After a restart: release claims left before any marker, and settle what
      // retained output can settle. Never a relaunch.
      if (!reconciled && existsSync(storePath)) {
        reconciled = true;
        journeyHandle.reconcile().catch(() => {});
      }
      return journeyHandle;
    },

    // Explicit command reconciliation may open the service's existing store.
    // A process restart must not turn a durable command into an absent one.
    commandStatus: id => context.hasStore() ? context.store.getCommand(String(id)) : null,

    // Passive publication over the already-open connection; never initializes a runtime.
    stewardRequests: () => handle ? listStewardRequests(handle, stewardStaleMs(process.env.PM_STEWARD_STALE_MS)) : [],
    stewardCommandState: id => context.hasStore() ? stewardCommandState(context.store, id, stewardStaleMs(process.env.PM_STEWARD_STALE_MS)) : null,

    /** Whether a supervisor store exists yet; reads never create one. */
    hasStore: () => Boolean(handle) || existsSync(storePath),

    /**
     * Each executor with its policy permission, bound qualification, supported
     * efforts and the installation's model catalogue.
     */
    async describeExecutors({ inspectOnly = true } = {}) {
      const loaded = loadExecutionPolicy({ root: ROOT });
      if (inspectOnly) {
        // A catalogue read must not provision, copy credentials, probe providers
        // or reconcile the store. Availability is local SDK presence only.
        return {
          executors: context.listExecutors().map(entry => ({ ...entry,
            permitted: loaded.ok && loaded.policy.executors.permitted.includes(entry.backend_id),
            qualified: false, authentication: null,
            refusals: [{ code: "executor-evidence-unprobed", detail: "Current runtime/authentication evidence is unavailable" }],
            qualification: { ref: null, refusals: [{ code: "runtime-binding-unavailable", detail: null }] },
            readiness: evaluateReadiness({ phase: "executor", selection: { executor: entry.id }, required: ["runtime", "authentication", "qualification"], facts: {
              runtime: readinessFact("unknown", "runtime-unprobed"), authentication: readinessFact("unavailable", "authentication-runtime-unavailable"), qualification: readinessFact("unavailable", "qualification-binding-unavailable"),
            } }),
            models: loaded.ok ? loaded.policy.executors.catalog?.models[entry.id] || [] : [],
            suggestions: loaded.ok ? Object.fromEntries(Object.entries(loaded.policy.executors.catalog?.profiles || {}).map(([name, byExecutor]) => [name, byExecutor[entry.id] || null])) : {},
          })),
          policy: loaded.ok ? { policy_revision: loaded.policy.policy_revision, runtime: loaded.policy.runtime ? { kind: "container", image: loaded.policy.runtime.image, network: loaded.policy.runtime.network.mode } : null, thresholdUsd: loaded.policy.dispatch.thresholdUsd } : null,
          refusals: loaded.ok ? [] : loaded.refusals,
          inspectOnly: true,
        };
      }
      const runtime = runtimeFor(loaded);
      const executors = [];
      for (const entry of context.listExecutors()) {
        const binding = runtime ? await runtime.binding(entry.backend_id) : null;
        const qualification = loadQualification({ root: ROOT, backend_id: entry.backend_id, binding });
        const described = await describeExecutor(
          entry.backend_id,
          qualification.ok
            ? {
                observations: qualification.observations,
                qualification_ref: qualification.qualification_ref,
                observed_at: qualification.observed_at,
                runtime: { binding: qualification.binding },
              }
            : {},
        );
        const admission =
          described.ok && described.profile
            ? admitExecutorProfile(described.profile, {
                requireConfinement: true,
                strictBoundRequired: loaded.ok ? loaded.policy.executors.strictBoundRequired || loaded.policy.resources.strict : false,
              })
            : null;
        const catalog = loaded.ok ? loaded.policy.executors.catalog : null;
        const authentication = runtime?.authReadiness ? await runtime.authReadiness(entry.backend_id) : null;
        executors.push({
          ...entry,
          permitted: loaded.ok ? loaded.policy.executors.permitted.includes(entry.backend_id) : false,
          qualified: Boolean(admission && admission.admitted && authentication?.ok !== false),
          authentication,
          refusals: [...(admission ? admission.refusals : described.refusal ? [described.refusal] : []), ...(authentication?.ok === false ? [{ code: "subscription-not-ready", detail: authentication.reason, ...(authentication.reconnect ? { action: authentication.reconnect } : {}) }] : [])],
          qualification: { ref: qualification.qualification_ref, refusals: qualification.refusals },
          models: catalog && catalog.models[entry.id] ? catalog.models[entry.id] : [],
          suggestions: catalog
            ? Object.fromEntries(Object.entries(catalog.profiles).map(([name, byExecutor]) => [name, byExecutor[entry.id] || null]))
            : {},
        });
      }
      return {
        executors,
        policy: loaded.ok
          ? {
              policy_revision: loaded.policy.policy_revision,
              runtime: runtime ? { kind: runtime.kind, image: loaded.policy.runtime.image, network: loaded.policy.runtime.network.mode } : null,
              thresholdUsd: loaded.policy.dispatch.thresholdUsd,
            }
          : null,
        refusals: loaded.ok ? (runtime ? [] : [{ code: "no-worker-runtime-configured", detail: null }]) : loaded.refusals,
      };
    },

    /** Independent inspection entry: never touches lazy runtime/journey getters. */
    async readiness(options) {
      const selection = selectionOf(options);
      const { collection, ...observations } = readinessCache.get(selectionKey(selection)) || {};
      const result = await inspectReadiness({ ...selection, root: ROOT, pmRel, observations, readOnlyStore: handle ? handle.readOnlyView() : null });
      return collection ? { ...result, collection } : result;
    },
    async readinessSnapshots() {
      return Promise.all([...readinessCache.keys()].map(key => context.readiness(JSON.parse(key))));
    },
    // Called only by the explicit owner Check command, never by Start/polling.
    renewAuthorization({ actor, command_id }) {
      const loaded = loadExecutionPolicy({ root: ROOT });
      if (!loaded.ok) return { ok: false, refusals: loaded.refusals };
      try {
        return { ok: true, authorization: renewAuthorization({ root: ROOT, policy: loaded.policy, actor, command_id }) };
      } catch {
        return { ok: false, refusals: [{ code: "authorization-renewal-failed", detail: "Could not retain authorization; check local storage" }] };
      }
    },
    // Observations may also be requested internally by Start; never renew here.
    async refreshReadiness(options) {
      const selection = selectionOf(options), key = selectionKey(selection);
      if (readinessPending.has(key)) return readinessPending.get(key);
      if (!readinessCache.has(key)) {
        if (readinessCache.size >= 32) readinessCache.delete(readinessCache.keys().next().value);
        readinessCache.set(key, {});
      }
      const work = (async () => {
        // The service owns coordination, including outstanding/unknown jobs.
        const view = context.store.readOnlyView();
        const before = await inspectReadiness({ ...selection, root: ROOT, pmRel, readOnlyStore: view });
        const loaded = loadExecutionPolicy({ root: ROOT }), chosen = resolveExecutorChoice(selection.executor);
        if (!loaded.ok || !chosen || PASSIVE_GATES.some(gate => before.facts[gate]?.state !== "satisfied") || !loaded.policy.runtime?.dependencies?.environment) {
          // A refused refresh replaces the prior evidence too, so the next GET
          // cannot silently revert to a different, older collection.
          readinessCache.set(key, {});
          return before;
        }
        const runtime = runtimeFor(loaded);
        const observedAt = new Date().toISOString();
        let observed;
        try { observed = await runtime.readinessObservations(chosen.backend_id, { model: selection.model, effort: selection.effort }); }
        catch { observed = { error: "readiness-collection-failed", collection: {
          schema: "delivery-v2/readiness-collection@1", startedAt: observedAt, completedAt: new Date().toISOString(),
          stages: [{ name: "collector", startedAt: observedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - Date.parse(observedAt), outcome: "failed", code: "readiness-collection-failed" }],
        } }; }
        // Each fact ages from its own observation, not the start or end of the
        // whole multi-step probe. Older runtimes without timestamps retain the
        // conservative start time; a slow probe cannot renew earlier evidence.
        const stamp = (name, fact) => ({ contextFingerprint: before.contextFingerprint, observedAt: observed.observedAt?.[name] || observedAt, fact });
        readinessCache.set(key, {
          ...(observed.collection ? { collection: observed.collection } : {}),
          runtime: stamp("runtime", readinessFact(observed.runtime ? "satisfied" : "blocked", "runtime-observed", observed.error || null, observed.runtime || null)),
          authentication: stamp("authentication", readinessFact(observed.authentication?.ok ? "satisfied" : "blocked", "subscription-observed", observed.authentication?.reason || null, observed.authentication ? { ...observed.authentication, backend_id: chosen.backend_id } : null)),
          environment: stamp("environment", readinessFact(observed.environment?.ok && observed.environment.receipt ? "satisfied" : "blocked", "environment-observed", observed.environment?.reason || null, { receipt: observed.environment?.receipt || null })),
          modelAvailability: stamp("modelAvailability", readinessFact(observed.modelAvailability ? "satisfied" : "unknown", "native-model-observed", null, observed.modelAvailability || null)),
        });
        // Re-read all passive inputs after the probe; any concurrent change invalidates it.
        return context.readiness(selection);
      })();
      readinessPending.set(key, work);
      try { return await work; } finally { readinessPending.delete(key); }
    },

    /** The owner-facing executor catalogue, with per-entry availability. */
    listExecutors: () =>
      listExecutors({
        isInstalled: (entry) => existsSync(join(ROOT, "node_modules", ...entry.sdk.split("/"))),
      }),

    /**
     * Build the adapter for one backend — the selected one by default.
     *
     * The only place in the service that turns a choice into a provider. It
     * refuses rather than substituting: an unavailable executor is reported, never
     * swapped for the other one.
     *
     * @param {(string|null)} [backend_id]
     */
    executorFor: (backend_id = null) =>
      createExecutor(backend_id ?? readExecutorSelection({ root: ROOT }).backend_id),

    /**
     * Reconcile-time resolver: hand `reconcileOutstanding` the adapter that owns a
     * given job, or null. Null is a real answer — an outstanding job whose backend
     * cannot be loaded stays outstanding rather than being inspected by the wrong
     * executor.
     */
    resolveAdapter: async (backend_id) => {
      const built = await createExecutor(backend_id);
      return built.ok ? built.adapter : null;
    },

    /** Which executors this installation knows about at all. */
    knownExecutors: EXECUTORS,
    activeV1Writers: () => listActiveV1Writers({ sessionsDir: sessions }),
    unreconciledV2Jobs: () => {
      if (!handle && !existsSync(join(ROOT, ...STORE_REL.split("/")))) return [];
      const store = handle || (handle = open({ path: join(ROOT, ...STORE_REL.split("/")) }));
      return store.listOutstandingJobs().map((job) => String(job.job_id));
    },
    close() {
      if (handle) {
        handle.close();
        handle = null;
      }
    },
  };

  return context;
}

/**
 * Route a v2 request, opening nothing unless the request needs it.
 *
 * A thin pass-through today. It exists as a named export so pm-server imports one
 * symbol pair from one module, and so the lazy-store contract above has exactly
 * one entry point to protect.
 *
 * @param {object} req
 * @param {ReturnType<typeof createDeliveryV2Context>} ctx
 */
export async function handleDeliveryV2(req, ctx) {
  return routeEntry(req, ctx);
}
