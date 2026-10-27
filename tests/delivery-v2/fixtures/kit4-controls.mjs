// Synthetic validation controls only. Never write these into the application.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import assert from 'node:assert/strict';

export const KIT4_CONTROL_VARIANTS = {
  'skipped-edible': 'coverage: skipped',
  'person-ignored': 'coverage: partner only excludes owner',
  'slot-ignored': 'coverage: other slot',
  'end-exclusive': 'helper display: leftovers inclusive',
  'origin-only-route': 'GET interval overlap without age cutoff',
  'helper-only': 'Chef adapter: old leftovers',
  'household-leak': 'GET explicit IDs retain household filter',
  'inactive-link': 'GET inactive link does not expose rows',
  'lookback-retained': 'weekly hook retrieves old overlap and exact window',
  'failure-as-empty': 'Chef retrieval failure is unavailable, not gaps',
  'calendar-bypass': 'calendar display: leftovers inclusive',
};

export function createKit4Control(sourceRoot, target, variant = 'corrected') {
  const put = (path, text) => { mkdirSync(dirname(join(target, path)), { recursive: true }); writeFileSync(join(target, path), text); };
  const get = path => readFileSync(join(sourceRoot, path), 'utf8');
  const replace = (text, before, after) => { assert(text.includes(before), 'Control source seam changed: ' + before); return text.replace(before, after); };
  let helper = `export function getMealActiveDates(plan) {
    const dates = []; const end = plan.eats_through_date ?? plan.planned_date;
    for (const d = new Date(plan.planned_date + 'T12:00:00'); localDate(d) <= end; d.setDate(d.getDate() + 1)) dates.push(localDate(d));
    return dates;
  }
  const localDate = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  export function mealCoversDate(plan, day, viewerId, mealType) {
    return (plan.status === 'cooked' || plan.status === 'planned') &&
      (plan.for_user_id === null || plan.for_user_id === viewerId) &&
      (!mealType || plan.meal_type === mealType) && getMealActiveDates(plan).includes(day);
  }`;
  if (variant === 'skipped-edible') helper = replace(helper, "(plan.status === 'cooked' || plan.status === 'planned')", 'true');
  if (variant === 'person-ignored') helper = replace(helper, '(plan.for_user_id === null || plan.for_user_id === viewerId)', 'true');
  if (variant === 'slot-ignored') helper = replace(helper, '(!mealType || plan.meal_type === mealType)', 'true');
  if (variant === 'end-exclusive') helper = replace(helper, 'localDate(d) <= end', 'localDate(d) < end');
  put('src/lib/mealPlanCoverage.ts', helper);
  const routePath = 'src/app/api/meal-plans/route.ts';
  let route = get(routePath);
  if (variant !== 'origin-only-route') {
    route = replace(route, 'query = query.eq("planned_date", singleDate);', 'query = query.lte("planned_date", singleDate).or(`eats_through_date.gte.${singleDate},and(eats_through_date.is.null,planned_date.gte.${singleDate})`);');
    route = replace(route, 'query = query.gte("planned_date", startDate).lte("planned_date", endDate);', 'query = query.lte("planned_date", endDate).or(`eats_through_date.gte.${startDate},and(eats_through_date.is.null,planned_date.gte.${startDate})`);');
  }
  route = replace(route, 'const { data: household }', 'const { data: household, error: householdError }');
  route = replace(route, 'if (!household) {', 'if (householdError) return NextResponse.json({error:"unavailable"},{status:503});\n  if (!household) {');
  if (variant === 'household-leak') route = replace(route, '.eq("household_id", household.id)', '');
  if (variant === 'inactive-link') route = replace(route, '.eq("active", true)', '');
  put(routePath, route);
  const hooksPath = 'src/features/meal-planning/hooks.ts';
  let hooks = get(hooksPath);
  if (variant !== 'lookback-retained') hooks = replace(hooks, 'const extStartStr = extStart.toISOString().split("T")[0];', 'const extStartStr = startDate;');
  put(hooksPath, hooks);
  put('src/features/meal-planning/queryKeys.ts', get('src/features/meal-planning/queryKeys.ts'));
  const calendarPath = 'src/components/web/WebMealPlanCalendar.tsx';
  let calendar = get(calendarPath);
  if (variant !== 'calendar-bypass') {
    const old = /function getMealActiveDates\([\s\S]*?\n  return dates;\r?\n\}/u.exec(calendar)?.[0];
    assert(old, 'Calendar extraction seam changed');
    calendar = replace(calendar, old, 'import { getMealActiveDates } from "@/lib/mealPlanCoverage";');
  }
  put(calendarPath, calendar);
  const chefPath = 'src/features/era/intents/resolvers/chef.ts';
  let chef = get(chefPath);
  if (variant !== 'helper-only') {
    const begin = chef.indexOf('export async function resolveMealPlanGaps()');
    assert(begin >= 0);
    chef = 'import { mealCoversDate } from "@/lib/mealPlanCoverage";\nimport { supabaseBrowser } from "@/lib/supabase/client";\n' + chef.slice(0, begin) + `
      export async function resolveMealPlanGaps() {
        try {
          const {data:{user}} = await supabaseBrowser().auth.getUser();
          if (!user) return {text:formatChefError(),ok:false};
          const today = new Date(), end = new Date(today);end.setDate(end.getDate()+6);
          const response = await safeFetch('/api/meal-plans?start='+formatDate(today)+'&end='+formatDate(end));
          if(!response.ok) return {text:formatChefError(),ok:false};
          const meals = await response.json(), emptyDays = [];
          for(let i=0;i<7;i++) {
            const d = new Date(today);d.setDate(d.getDate()+i);
            if(!meals.some(m=>mealCoversDate(m,formatDate(d),user.id))) emptyDays.push(WEEKDAY_LABEL.format(d));
          }
          return {text:formatMealPlanGaps(emptyDays),metadata:{emptyDays}};
        } catch { return {text:formatChefError(),ok:false}; }
      }`;
  }
  if (variant === 'failure-as-empty') chef = replace(chef, 'if(!response.ok) return {text:formatChefError(),ok:false};', 'if(!response.ok) return {text:"empty",metadata:{emptyDays:[]}};');
  put(chefPath, chef);
  return target;
}
