-- HUB-30: ERA Stage 4 — taught-phrase templates.
-- Run manually in the Supabase SQL Editor (Hard Rule #24 — no agent applies this).
--
-- Stores controlled-concept + typed-slot patterns learned from a
-- successfully-executed Ask AI action (Stage 3 / HUB-29). `pattern_text` is
-- plain data using a `{slotName}` placeholder syntax (e.g. "shift it to
-- {whenText}") — never model-generated code or regex; the matching algorithm
-- lives entirely in application code (src/features/era/templates/matcher.ts).
--
-- User-scoped like era_messages/era_conversations, not household-scoped —
-- taught phrasing is personal, not shared data.

create table public.era_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  capability_id text not null,
  pattern_text text not null,
  slot_names text[] not null default '{}',
  source_text text not null,
  match_count integer not null default 1,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_matched_at timestamptz,
  constraint era_templates_unique_pattern unique (user_id, capability_id, pattern_text)
);

create index era_templates_user_id_idx on public.era_templates(user_id);

alter table public.era_templates enable row level security;

create policy "era_templates_select_own" on public.era_templates
  for select using (user_id = auth.uid());

create policy "era_templates_insert_own" on public.era_templates
  for insert with check (user_id = auth.uid());

create policy "era_templates_update_own" on public.era_templates
  for update using (user_id = auth.uid());

create policy "era_templates_delete_own" on public.era_templates
  for delete using (user_id = auth.uid());
