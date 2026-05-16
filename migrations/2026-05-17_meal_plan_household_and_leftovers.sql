-- Meal plan: per-partner assignment, leftover spread, servings override
alter table public.meal_plans
  add column if not exists for_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists eats_through_date date,
  add column if not exists servings_planned integer;

create index if not exists meal_plans_for_user_idx
  on public.meal_plans (household_id, for_user_id, planned_date);

comment on column public.meal_plans.for_user_id is
  'NULL = household-shared meal (both partners eat it). Set = assigned to one partner only.';
comment on column public.meal_plans.eats_through_date is
  'Last day the meal is consumed (for leftover spread). NULL = single-day meal.';
comment on column public.meal_plans.servings_planned is
  'How many servings to cook. NULL = use recipe.servings default.';
