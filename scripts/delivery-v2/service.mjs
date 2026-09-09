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

import { TERMINAL_STATES } from "../delivery/state-machine.mjs";
import { openStore } from "./store.mjs";
import { readExecutorSelection, routeDeliveryV2 as routeEntry } from "./entry.mjs";
import { buildDeliver } from "./policy.mjs";
import { EXECUTORS, createExecutor, listExecutors } from "./adapters/registry.mjs";

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
 * @param {{ROOT:string, pmRel?:string, sessionsDir?:string, port?:number,
 *   allowedOrigins?:string[], deliver?:(Function|null), openStore?:Function,
 *   buildDeliver?:Function}} input
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
}) {
  const sessions = sessionsDir || join(ROOT, ".delivery", "sessions");
  const open = openStoreOverride || openStore;
  const build = buildDeliverOverride || buildDeliver;
  let handle = null;

  const origins =
    allowedOrigins ||
    (port
      ? ["http://127.0.0.1:" + port, "http://localhost:" + port]
      : ["http://127.0.0.1", "http://localhost"]);

  const context = {
    root: ROOT,
    allowedOrigins: origins,
    get store() {
      if (!handle) handle = open({ path: join(ROOT, ...STORE_REL.split("/")) });
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
