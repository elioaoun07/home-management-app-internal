// KIT-11 protected acceptance check (Delivery V2 checker input — the writer cannot
// change it). Bundles the candidate's real cooking-log route with a stubbed data
// client and a stubbed cookie store, then drives POST and inspects what the route
// writes back to the recipe row. Nothing reads or writes a live project.
//
// Not a *.test.ts file, so the normal suite does not run it before KIT-11 lands.
//
// Usage: node tests/delivery-oracles/kit11-cooking-count.mjs <root> <outDir>
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] || process.cwd());
const out = resolve(process.argv[3] || join(root, ".tmp", "era-kit11-oracle"));
mkdirSync(out, { recursive: true });

const ROUTE = join(root, "src", "app", "api", "recipes", "[id]", "cooking-log", "route.ts");

// The route's three environment seams. All are replaced at bundle time so the
// real client is never constructed, no request scope is required, and the check
// resolves nothing but esbuild out of the dependency volume. The route itself —
// its queries, their order and what it writes back — is the candidate's own.
const clientStub = join(out, "stub-client.mjs");
writeFileSync(
  clientStub,
  // The stub is bundled into the route, so the installed client is handed over
  // through the realm rather than through a second copy of this module.
  "export async function supabaseServer() {\n" +
    "  const client = globalThis.__kit11Client;\n" +
    "  if (!client) throw new Error('no stub client installed');\n" +
    "  return client;\n" +
    "}\n" +
    "export async function supabaseServerRSC() { return supabaseServer(); }\n",
);
const headersStub = join(out, "stub-headers.mjs");
writeFileSync(headersStub, "export async function cookies() { return { get: () => undefined, set: () => {} }; }\n");
// A minimal response shim, so the check needs no framework package installed.
// The oracle reads status and decoded body; it does not claim to exercise the
// framework's own serializer.
const responseStub = join(out, "stub-response.mjs");
writeFileSync(
  responseStub,
  "export const NextResponse = {\n" +
    "  json(body, init) {\n" +
    "    const status = (init && init.status) || 200;\n" +
    "    const decoded = JSON.parse(JSON.stringify(body === undefined ? null : body));\n" +
    "    return { status, json: async () => decoded };\n" +
    "  },\n" +
    "};\n" +
    "export class NextRequest {}\n",
);

const bundle = await build({
  entryPoints: [ROUTE],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
  plugins: [
    {
      name: "kit11-seams",
      setup(api) {
        // esbuild filters are Go regexps: no unicode flag.
        api.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({ path: clientStub }));
        api.onResolve({ filter: /^next\/headers$/ }, () => ({ path: headersStub }));
        api.onResolve({ filter: /^next\/server$/ }, () => ({ path: responseStub }));
        api.onResolve({ filter: /^@\// }, (args) => ({ path: join(root, "src", args.path.slice(2)) }));
      },
    },
  ],
});
const bundlePath = join(out, "kit11-route.mjs");
writeFileSync(bundlePath, bundle.outputFiles[0].text);
const route = await import(pathToFileURL(bundlePath).href);

if (typeof route.POST !== "function") throw new Error("the cooking-log route must export POST");

const LOG_ROW = { id: "log-9", recipe_id: "recipe-1", rating: 5 };

/** A chainable stand-in for the query builder the route uses. Every terminal
 * awaits through `then`, so the route's own call shapes decide what it receives. */
function makeClient(respond, calls) {
  const builder = (table) => {
    const state = { table, op: "select", columns: null, options: null, payload: null };
    const self = {
      insert(payload) {
        state.op = "insert";
        state.payload = payload;
        calls.push({ table, op: "insert", payload });
        return self;
      },
      update(payload) {
        state.op = "update";
        state.payload = payload;
        calls.push({ table, op: "update", payload });
        return self;
      },
      select(columns, options) {
        if (state.op === "select") {
          state.columns = columns ?? null;
          state.options = options ?? null;
          calls.push({ table, op: "select", columns: state.columns, options: state.options });
        }
        return self;
      },
      eq: () => self,
      not: () => self,
      order: () => self,
      single: () => self,
      maybeSingle: () => self,
      then: (onFulfilled, onRejected) => Promise.resolve(respond(state)).then(onFulfilled, onRejected),
    };
    return self;
  };
  return { auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) }, from: builder };
}

/** One POST against the real route, with the count query scripted. */
async function run({ countResult, ratings = [{ rating: 4 }, { rating: 5 }] }) {
  const calls = [];
  const respond = (state) => {
    if (state.table === "cooking_logs" && state.op === "insert") return { data: LOG_ROW, error: null };
    if (state.table === "cooking_logs" && state.options && state.options.head === true) return countResult;
    if (state.table === "cooking_logs") return { data: ratings, error: null, count: null };
    if (state.table === "recipes" && state.op === "update") return { data: null, error: null };
    return { data: null, error: null, count: null };
  };
  globalThis.__kit11Client = makeClient(respond, calls);
  const response = await route.POST(
    { json: async () => ({ rating: 5 }) },
    { params: Promise.resolve({ id: "recipe-1" }) },
  );
  const updates = calls.filter((c) => c.table === "recipes" && c.op === "update");
  return {
    status: response.status,
    body: await response.json(),
    inserts: calls.filter((c) => c.table === "cooking_logs" && c.op === "insert"),
    update: updates.length === 1 ? updates[0].payload : null,
    updateCount: updates.length,
  };
}

const failures = [];
const check = (label, condition, detail) => {
  if (!condition) failures.push(label + (detail ? ": " + detail : ""));
};
const shown = (value) => JSON.stringify(value);

// 1 — the defect itself. Four logs exist; the count arrives as metadata with a
// null body, which is exactly what a head/count request returns.
{
  const r = await run({ countResult: { data: null, count: 4, error: null } });
  check(
    "nonzero count is written",
    r.update !== null && r.update.times_cooked === 4,
    "wrote " + shown(r.update && r.update.times_cooked),
  );
  check("nonzero count still answers 201", r.status === 201, "status " + r.status);
}

// 2 — a real zero stays zero and is not turned into one.
{
  const r = await run({ countResult: { data: null, count: 0, error: null } });
  check(
    "zero count is written as zero",
    r.update !== null && r.update.times_cooked === 0,
    "wrote " + shown(r.update && r.update.times_cooked),
  );
}

// 3 — the count is simply not reported. An unknown count must not overwrite a
// known one with an invented value.
{
  const r = await run({ countResult: { data: null, count: null, error: null } });
  check(
    "missing count invents nothing",
    r.update !== null && !("times_cooked" in r.update),
    "wrote " + shown(r.update && r.update.times_cooked),
  );
}

// 4 — the count query fails. Same rule, and the already-written log is still
// reported so the caller does not retry into a second log.
{
  const r = await run({ countResult: { data: null, count: null, error: { message: "count failed" } } });
  check(
    "failed count invents nothing",
    r.update !== null && !("times_cooked" in r.update),
    "wrote " + shown(r.update && r.update.times_cooked),
  );
  check("failed count still answers 201", r.status === 201, "status " + r.status);
  check("failed count returns the written log", r.body && r.body.id === LOG_ROW.id, shown(r.body));
  check("failed count writes one log only", r.inserts.length === 1, r.inserts.length + " inserts");
}

// 5 — one insert and one recipe write per request, in the ordinary case.
{
  const r = await run({ countResult: { data: null, count: 4, error: null } });
  check("one log is written", r.inserts.length === 1, r.inserts.length + " inserts");
  check("one recipe write", r.updateCount === 1, r.updateCount + " updates");
}

// 6 — the unrelated statistics on the same write are unchanged.
{
  const r = await run({ countResult: { data: null, count: 4, error: null }, ratings: [{ rating: 4 }, { rating: 5 }] });
  check(
    "average rating is preserved",
    r.update !== null && r.update.average_rating === 4.5,
    shown(r.update && r.update.average_rating),
  );
  check(
    "last cooked is still stamped",
    r.update !== null && typeof r.update.last_cooked_at === "string",
    shown(r.update && r.update.last_cooked_at),
  );
  check(
    "updated stamp is still written",
    r.update !== null && typeof r.update.updated_at === "string",
    shown(r.update && r.update.updated_at),
  );
}

if (failures.length) {
  process.stdout.write(failures.map((f) => "FAILED " + f).join("\n") + "\n");
  throw new Error(failures.length + " KIT-11 case(s) failed");
}
process.stdout.write("12 of 12 checks passed\n");
