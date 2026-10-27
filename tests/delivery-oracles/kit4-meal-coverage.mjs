// Protected KIT-4 observer. Execute only in the isolated checker for candidates.
// No live clients, credentials or network. Product code is bundled, not replaced
// with a second coverage implementation. Corrected controls live only in tests.
// Proposed helper seam for owner review: getMealActiveDates(plan), and
// mealCoversDate(plan, YYYY-MM-DD, viewerId, optionalMealType). No storage effects.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const KIT4_ORACLE_VERSION = 1;
export const KIT4_ASSERTION_COUNT = 54;
const HELPER = 'src/lib/mealPlanCoverage.ts';
const ROUTE = 'src/app/api/meal-plans/route.ts';
const HOOKS = 'src/features/meal-planning/hooks.ts';
const CHEF = 'src/features/era/intents/resolvers/chef.ts';
const CALENDAR = 'src/components/web/WebMealPlanCalendar.tsx';
const row = (overrides = {}) => ({ id: 'meal-1', household_id: 'home-1', recipe_id: 'recipe-1', planned_date: '2026-09-04', eats_through_date: '2026-09-07', meal_type: 'lunch', status: 'cooked', for_user_id: null, ...overrides });

// Implement only documented PostgREST predicate behavior; unknown syntax refuses.
function predicate(expression) {
  const terms = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= expression.length; i++) {
    if (expression[i] === '(') depth++;
    if (expression[i] === ')') depth--;
    if (i === expression.length || (expression[i] === ',' && depth === 0)) { terms.push(expression.slice(start, i)); start = i + 1; }
  }
  return r => terms.some(term => {
    if (term.startsWith('and(')) return !predicate(term.slice(4, -1).split(',').map(t => 'not.' + t).join(','))(r);
    const negate = term.startsWith('not.');
    const text = negate ? term.slice(4) : term;
    const match = /^([\w]+)\.(eq|gte|lte|gt|lt|is)\.(.+)$/u.exec(text);
    assert(match, 'Unsupported mocked query predicate: ' + text);
    const [, key, op, raw] = match;
    const v = raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : raw;
    const yes = op === 'eq' || op === 'is' ? r[key] === v : r[key] != null && ({ gte: () => r[key] >= v, lte: () => r[key] <= v, gt: () => r[key] > v, lt: () => r[key] < v })[op]();
    return negate ? !yes : yes;
  });
}

function client(state) {
  return {
    auth: { getUser: async () => ({ data: { user: state.user ? { id: state.user } : null }, error: null }) },
    from(table) {
      const filters = [], calls = [];
      const query = { select() { return query; }, limit() { return query; }, order() { return query; },
        single() { return query; }, maybeSingle() { return query; },
        eq(key, value) { filters.push(r => r[key] === value); calls.push(['eq', key, value]); return query; },
        gte(key, value) { filters.push(r => r[key] != null && r[key] >= value); return query; },
        lte(key, value) { filters.push(r => r[key] != null && r[key] <= value); return query; },
        is(key, value) { filters.push(r => r[key] === value); return query; },
        in(key, values) { filters.push(r => values.includes(r[key])); return query; },
        or(value) { filters.push(predicate(value)); calls.push(['or', value]); return query; },
        insert() { throw Error('GET attempted insert'); }, update() { throw Error('GET attempted update'); }, delete() { throw Error('GET attempted delete'); },
        then(ok, bad) {
          state.queries.push({ table, calls });
          let answer;
          if (table === 'household_links') {
            const home = { id: 'home-1', active: state.homeActive, owner_user_id: 'owner', partner_user_id: 'partner' };
            answer = state.householdFailure ? { data: null, error: { message: 'household unavailable' } }
              : { data: state.home && filters.every(f => f(home)) ? home : null, error: null };
          } else {
            assert.equal(table, 'meal_plans', 'Unexpected table');
            answer = state.failure ? { data: null, error: { message: 'offline fixture' } }
              : { data: state.rows.filter(r => filters.every(f => f(r))), error: null };
          }
          return Promise.resolve(answer).then(ok, bad);
        },
      };
      return query;
    },
  };
}

const stubs = {
  '@/lib/supabase/server': 'export async function supabaseServer(){return globalThis.__client}',
  '@/lib/supabase/client': 'export function supabaseBrowser(){return globalThis.__client}',
  'next/headers': 'export async function cookies(){return {get(){},set(){throw Error("cookie write")}}}',
  'next/server': 'export const NextResponse={json:(body,init={})=>({status:init.status||200,ok:(init.status||200)<400,json:async()=>body,text:async()=>JSON.stringify(body)})}; export class NextRequest{}',
  '@/lib/safeFetch': 'export const safeFetch=(...args)=>globalThis.fetch(...args)',
  '@tanstack/react-query': 'export const useQuery=x=>x; export const useMutation=()=>{throw Error("mutation hook")}; export const useQueryClient=()=>{throw Error("mutation client")}',
  '@/lib/utils/date': 'export const formatDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")',
  '../formatters/chef': 'export const formatMealPlanGaps=days=>JSON.stringify(days); export const formatChefError=()=>"unavailable"; export const formatAssignMealError=()=>"error",formatMealAssigned=()=>"assigned",formatRecipeFound=()=>"found",formatRecipeNotFound=()=>"missing",formatRecipesList=()=>"recipes"',
  '@/lib/era/artifacts': 'export const eraArtifact=()=>{throw Error("artifact write")}',
  '@/lib/smartTextParser': 'export const parseSmartText=()=>{throw Error("write parser")}',
  '../../capabilities/effectiveAction': 'export const waitingForConsent=()=>{throw Error("write consent")}',
  '@/components/web/MealPlanDropSheet': 'export default ()=>null',
  '@/components/web/RecipeSidePanel': 'export default ()=>null;export const RecipeDragOverlay=()=>null',
  '@/contexts/ThemeContext': 'export const useTheme=()=>({theme:"blue"})',
  '@/hooks/useThemeClasses': 'export const useThemeClasses=()=>({})',
  '@/lib/toastIcons': 'export const ToastIcons={}',
  '@/lib/utils': 'export const cn=(...args)=>args.join(" ")',
  '@/features/meal-planning/hooks': 'export const useDeleteMealPlan=()=>{},useHousehold=()=>{},useMealPlansForWeek=()=>{},useUpdateMealPlan=()=>{}',
  '@dnd-kit/core': 'export const DndContext=()=>{},DragOverlay=()=>{},PointerSensor={},useDroppable=()=>{},useSensor=()=>{},useSensors=()=>{}',
  'framer-motion': 'export const motion={}',
  'lucide-react': 'export const ChefHat=()=>{},ChevronLeft=()=>{},ChevronRight=()=>{},X=()=>{}',
  react: 'export default {};export const useMemo=f=>f(),useState=f=>[typeof f==="function"?f():f,()=>{}]',
  'react/jsx-runtime': 'export const jsx=()=>null,jsxs=()=>null,Fragment=()=>null',
  sonner: 'export const toast={}',
};

async function load(root, path, state, modules) {
  const helper = resolve(root, HELPER);
  const result = await build({ stdin: { contents: readFileSync(join(root, path), 'utf8') + (path === CALENDAR ? '\nexport {getMealActiveDates as __kit4DisplayDates};' : ''),
    resolveDir: resolve(root, path, '..'), sourcefile: resolve(root, path), loader: path.endsWith('.tsx') ? 'tsx' : 'ts' },
  bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', treeShaking: true,
  plugins: [{ name: 'kit4-isolated-seams', setup(api) {
    api.onResolve({ filter: /.*/ }, args => {
      if (args.path === 'kit4-original-helper') return { path: helper };
      if (args.path === '@/lib/mealPlanCoverage' || (args.path.startsWith('.') && resolve(args.resolveDir, args.path).replace(/\.ts$/u, '') === helper.slice(0, -3))) {
        if (path === HELPER) return { path: helper };
        return { path: 'shared-helper', namespace: 'kit4' };
      }
      if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'kit4-stub' };
      if (args.path.startsWith('@/')) return { path: resolve(root, 'src', args.path.slice(2)) + '.ts' };
      if (args.path.startsWith('.')) return undefined;
      throw Error('Unapproved oracle dependency: ' + args.path);
    });
    api.onLoad({ filter: /.*/, namespace: 'kit4-stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
    api.onLoad({ filter: /.*/, namespace: 'kit4' }, () => ({ contents: 'import * as real from "kit4-original-helper";export function getMealActiveDates(...a){globalThis.__shared.display++;return real.getMealActiveDates(...a)};export function mealCoversDate(...a){globalThis.__shared.coverage++;return real.mealCoversDate(...a)}', loader: 'js' }));
  } }] });
  const FixedDate = class extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return +new Date(state.now); } };
  const context = vm.createContext({ module: { exports: {} }, URL, Date: FixedDate, Intl, __client: client(state), __shared: state.shared,
    console: { error() {}, warn() {} }, fetch: async (url, init = {}) => {
      assert(!init.method || init.method === 'GET', 'Read path attempted a mutation');
      state.urls.push(String(url));
      if (state.networkFailure) throw Error('network unavailable');
      const parsed = new URL(String(url), 'https://kit4.invalid');
      assert.equal(parsed.origin, 'https://kit4.invalid', 'External network refused');
      if (parsed.pathname === '/api/meal-plans') return modules.route.GET({ url: parsed.href });
      if (parsed.pathname === '/api/household') return { ok: true, json: async () => ({ link: { id: 'home-1', owner_user_id: 'owner', partner_user_id: 'partner' } }) };
      throw Error('Unknown fixture URL: ' + url);
    } });
  vm.runInContext(result.outputFiles[0].text, context, { timeout: 2000 });
  return { exports: context.module.exports, call(name, ...args) {
    context.__args = args; context.__name = name;
    return vm.runInContext('module.exports[__name](...__args)', context, { timeout: 2000 });
  } };
}

export async function inspectMealCoverage(root) {
  root = resolve(root);
  const state = { rows: [], user: 'owner', home: true, homeActive: true, failure: false, householdFailure: false, networkFailure: false,
    now: '2026-09-06T12:00:00', shared: { display: 0, coverage: 0 }, queries: [], urls: [] };
  const modules = {}, loadErrors = {};
  for (const [key, path] of [['helper', HELPER], ['route', ROUTE], ['hooks', HOOKS], ['chef', CHEF], ['calendar', CALENDAR]]) {
    try { modules[key] = await load(root, path, state, modules); } catch (error) { loadErrors[key] = String(error); }
  }
  // GET is a VM-exported function; only this mocked route can service reads.
  if (modules.route) modules.route.GET = (...args) => modules.route.call('GET', ...args);
  const cases = [], tests = [];
  const test = (name, action) => tests.push({ name, action });
  const reset = () => { Object.assign(state, { rows: [], user: 'owner', home: true, homeActive: true, failure: false, householdFailure: false, networkFailure: false, now: '2026-09-06T12:00:00' }); state.queries.length = 0; state.urls.length = 0; };
  const call = (module, name, ...args) => { assert(modules[module], `${module} unavailable: ${loadErrors[module]}`); return modules[module].call(name, ...args); };
  const get = query => call('route', 'GET', { url: 'https://kit4.invalid/api/meal-plans?' + query });
  const ids = rows => Array.from(rows, r => r.id).sort();
  const checkIds = (actual, expected) => assert.deepEqual(ids(actual), expected.sort());
  const chef = () => call('chef', 'resolveMealPlanGaps');
  const isCovered = result => { assert(Array.isArray(result.metadata?.emptyDays), 'Chef did not return complete gap facts'); return !result.metadata.emptyDays.includes('Sunday'); };

  const intervals = [
    ['leftovers inclusive', row(), ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07']],
    ['null end', row({ eats_through_date: null }), ['2026-09-04']],
    ['skipped still displayed', row({ status: 'skipped' }), ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07']],
    ['leap boundary', row({ planned_date: '2024-02-28', eats_through_date: '2024-03-01' }), ['2024-02-28', '2024-02-29', '2024-03-01']],
    ['year boundary', row({ planned_date: '2026-12-31', eats_through_date: '2027-01-02' }), ['2026-12-31', '2027-01-01', '2027-01-02']],
    ['Beirut spring DST', row({ planned_date: '2026-03-28', eats_through_date: '2026-03-30' }), ['2026-03-28', '2026-03-29', '2026-03-30']],
    ['Beirut autumn DST', row({ planned_date: '2026-10-24', eats_through_date: '2026-10-26' }), ['2026-10-24', '2026-10-25', '2026-10-26']],
  ];
  for (const [name, meal, expected] of intervals) {
    test('helper display: ' + name, () => assert.deepEqual(Array.from(call('helper', 'getMealActiveDates', meal)), expected));
    test('calendar display: ' + name, () => { const n = state.shared.display; assert.deepEqual(Array.from(call('calendar', '__kit4DisplayDates', meal)), expected); assert(state.shared.display > n, 'Calendar bypasses shared date expansion'); });
  }
  for (const [name, meal, day, viewer, slot, expected] of [
    ['cooked leftover', row(), '2026-09-06', 'owner', undefined, true],
    ['planned leftover', row({ status: 'planned' }), '2026-09-06', 'owner', undefined, true],
    ['skipped', row({ status: 'skipped' }), '2026-09-06', 'owner', undefined, false],
    ['shared partner', row(), '2026-09-06', 'partner', undefined, true],
    ['partner only excludes owner', row({ for_user_id: 'partner' }), '2026-09-06', 'owner', undefined, false],
    ['partner only includes partner', row({ for_user_id: 'partner' }), '2026-09-06', 'partner', undefined, true],
    ['owner only excludes partner', row({ for_user_id: 'owner' }), '2026-09-06', 'partner', undefined, false],
    ['before interval', row(), '2026-09-03', 'owner', undefined, false],
    ['after interval', row(), '2026-09-08', 'owner', undefined, false],
    ['matching slot', row(), '2026-09-06', 'owner', 'lunch', true],
    ['other slot', row(), '2026-09-06', 'owner', 'dinner', false],
    ['snack facts retained', row({ meal_type: 'snack' }), '2026-09-06', 'owner', 'snack', true],
    ['unknown status is not edible', row({ status: 'unknown' }), '2026-09-06', 'owner', undefined, false],
  ]) test('coverage: ' + name, () => assert.equal(call('helper', 'mealCoversDate', meal, day, viewer, slot), expected));

  const retrievalRows = [row({ id: 'old', planned_date: '2026-08-01' }), row({ id: 'inside', planned_date: '2026-09-06', eats_through_date: null }),
    row({ id: 'expired', eats_through_date: '2026-09-05' }), row({ id: 'future', planned_date: '2026-09-13', eats_through_date: null }), row({ id: 'foreign', household_id: 'home-2' })];
  test('GET interval overlap without age cutoff', async () => { state.rows = retrievalRows; checkIds(await (await get('start=2026-09-06&end=2026-09-12')).json(), ['old', 'inside']); });
  test('GET single-date overlap', async () => { state.rows = retrievalRows; checkIds(await (await get('date=2026-09-06')).json(), ['old', 'inside']); });
  test('GET explicit IDs retain household filter', async () => { state.rows = retrievalRows; checkIds(await (await get('ids=old&ids=foreign')).json(), ['old']); });
  test('GET signed out refuses before data', async () => { state.user = null; assert.equal((await get('date=2026-09-06')).status, 401); assert.equal(state.queries.length, 0); });
  test('GET partner authorized by active household', async () => { state.user = 'partner'; state.rows = [row()]; checkIds(await (await get('date=2026-09-06')).json(), ['meal-1']); });
  test('GET inactive household membership does not expose rows', async () => { state.user = 'outsider'; state.rows = [row()]; const r = await get('date=2026-09-06'); assert(!r.ok || (await r.json()).length === 0); });
  test('GET inactive link does not expose rows', async () => { state.homeActive = false; state.rows = [row({ planned_date: '2026-09-06' })]; const r = await get('date=2026-09-06'); assert(!r.ok || (await r.json()).length === 0); });
  test('GET household lookup failure is unavailable', async () => { state.householdFailure = true; assert((await get('date=2026-09-06')).status >= 400); });
  test('GET query failure is non-success', async () => { state.failure = true; assert((await get('date=2026-09-06')).status >= 400); });
  test('weekly hook retrieves old overlap and exact window', async () => { state.rows = retrievalRows; const q = call('hooks', 'useMealPlansForWeek', '2026-09-06'); checkIds(await q.queryFn(), ['old', 'inside']); const u = new URL(state.urls.at(-1), 'https://kit4.invalid'); assert.equal(u.searchParams.get('start'), '2026-09-06'); assert.equal(u.searchParams.get('end'), '2026-09-12'); });
  test('date hook retrieves old overlap', async () => { state.rows = retrievalRows; checkIds(await call('hooks', 'useMealPlansForDate', '2026-09-06').queryFn(), ['old', 'inside']); });
  test('hook failure rejects instead of empty', async () => { state.failure = true; await assert.rejects(() => call('hooks', 'useMealPlansForWeek', '2026-09-06').queryFn()); });
  for (const [name, meal, viewer, expected] of [
    ['old leftovers', row({ planned_date: '2026-08-01' }), 'owner', true],
    ['skipped uncovered', row({ status: 'skipped' }), 'owner', false],
    ['partner meal excludes owner', row({ for_user_id: 'partner' }), 'owner', false],
    ['partner meal covers partner', row({ for_user_id: 'partner' }), 'partner', true],
    ['owner meal covers owner', row({ for_user_id: 'owner' }), 'owner', true],
    ['owner meal excludes partner', row({ for_user_id: 'owner' }), 'partner', false],
    ['shared covers partner', row(), 'partner', true],
  ]) test('Chef adapter: ' + name, async () => { state.user = viewer; state.rows = [meal]; const n = state.shared.coverage; assert.equal(isCovered(await chef()), expected); assert(state.shared.coverage > n, 'Chef bypasses shared coverage'); });
  test('Chef complete empty has seven real gaps', async () => { const r = await chef(); assert.equal(r.metadata?.emptyDays?.length, 7); });
  test('Chef retrieval failure is unavailable, not gaps', async () => { state.failure = true; const r = await chef(); assert(!Array.isArray(r.metadata?.emptyDays)); assert(r.ok === false || /unavailable/iu.test(r.text)); });
  test('Chef network failure is unavailable, not gaps', async () => { state.networkFailure = true; const r = await chef(); assert(!Array.isArray(r.metadata?.emptyDays)); assert(r.ok === false || /unavailable/iu.test(r.text)); });
  test('Chef a breakfast removes only its day gap', async () => { state.rows = [row({ planned_date: '2026-09-06', eats_through_date: null, meal_type: 'breakfast' })]; const r = await chef(); assert.equal(r.metadata?.emptyDays?.length, 6); assert.equal(isCovered(r), true); assert.equal(call('helper', 'mealCoversDate', state.rows[0], '2026-09-06', 'owner', 'dinner'), false); });
  for (const [name, now, start, end] of [['leap/month', '2024-02-29', '2024-02-28', '2024-03-01'], ['spring DST', '2026-03-29', '2026-03-28', '2026-03-30'], ['autumn DST', '2026-10-25', '2026-10-24', '2026-10-26']]) {
    test('Chef local-date ' + name, async () => { state.now = now + 'T00:30:00'; state.rows = [row({ planned_date: start, eats_through_date: end })]; const r = await chef(); const label = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(state.now)); assert(Array.isArray(r.metadata?.emptyDays)); assert(!r.metadata.emptyDays.includes(label)); });
  }
  test('pure helper leaves original facts unchanged', () => { const meal = Object.freeze(row()); call('helper', 'getMealActiveDates', meal); call('helper', 'mealCoversDate', meal, '2026-09-06', 'owner'); assert.equal(meal.meal_type, 'lunch'); assert.equal(meal.for_user_id, null); assert.equal(meal.status, 'cooked'); });

  assert.equal(tests.length, KIT4_ASSERTION_COUNT, 'Protected assertion inventory changed');
  for (const { name, action } of tests) {
    reset();
    let timer;
    try { await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('case deadline exceeded')), 2000); })]); cases.push({ name, ok: true }); }
    catch (error) { cases.push({ name, ok: false, error: String(error) }); }
    finally { clearTimeout(timer); }
  }
  return { schema: 'kit4-meal-coverage-oracle@1', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, selected: cases.length,
    passed: cases.filter(c => c.ok).length, failed: cases.filter(c => !c.ok).length, loadErrors, cases };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // The child has a deterministic local timezone before constructing any Date.
  process.env.TZ = 'Asia/Beirut';
  const root = resolve(process.argv[2] || process.cwd());
  const out = resolve(process.argv[3] || join(root, '.tmp', 'kit4-oracle'));
  try {
    const report = await inspectMealCoverage(root);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'kit4-oracle-results.json'), JSON.stringify(report, null, 2) + '\n');
    for (const c of report.cases.filter(c => !c.ok)) process.stderr.write('FAILED ' + c.name + ': ' + c.error + '\n');
    process.stdout.write(`${report.passed} of ${report.selected} checks passed\n`);
    if (report.failed) process.exitCode = 1;
  } catch (error) { process.stderr.write(String(error) + '\n'); process.exitCode = 1; }
}
