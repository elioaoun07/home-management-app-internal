# Schedule Auth — Ground-Truth Verification Queries

> Paste each query into the **Supabase SQL Editor** and drop the result under its
> `### Answer` block. These confirm the read-path behaviour before we touch the
> write-auth (PATCH/DELETE) guard. Context: the `get_schedule_bundle` RPC body is
> NOT in `schema.sql` (the visualizer export captures tables only, not functions),
> so its partner/privacy scoping can't be reviewed from the repo.
>
> Related: `ERA Notes/10 - Project Management/Schedule/Pain Inventory & Plan/` (W4).

---

## Q1 — Is RLS actually enabled on items + child tables?

```sql
SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN (
  'items','item_alerts','item_subtasks','reminder_details','event_details',
  'item_recurrence_rules','item_recurrence_exceptions','recurrence_pauses',
  'item_occurrence_actions'
)
ORDER BY relname;
```

### Answer

| table_name                 | rls_enabled | rls_forced |
| -------------------------- | ----------- | ---------- |
| event_details              | true        | false      |
| item_alerts                | true        | false      |
| item_occurrence_actions    | true        | false      |
| item_recurrence_exceptions | true        | false      |
| item_recurrence_rules      | true        | false      |
| item_subtasks              | true        | false      |
| items                      | true        | false      |
| recurrence_pauses          | true        | false      |
| reminder_details           | true        | false      |

---

## Q2 — Full body of get_schedule_bundle (the authoritative read path)

```sql
SELECT pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_schedule_bundle';
```

### Answer

| definition |
| ---------- |

| CREATE OR REPLACE FUNCTION public.get_schedule_bundle(include_archived boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
uid uuid := auth.uid();
partner_id uuid;
result jsonb;
BEGIN
IF uid IS NULL THEN
RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
END IF;

-- Resolve active household partner (if any)
SELECT CASE
WHEN owner_user_id = uid THEN partner_user_id
ELSE owner_user_id
END
INTO partner_id
FROM public.household_links
WHERE active = true
AND (owner_user_id = uid OR partner_user_id = uid)
ORDER BY created_at DESC
LIMIT 1;

WITH visible*items AS (
SELECT i.*
FROM public.items i
WHERE i.deleted*at IS NULL
AND (include_archived OR i.archived_at IS NULL)
AND (
i.user_id = uid
OR (partner_id IS NOT NULL AND i.user_id = partner_id AND i.is_public = true)
)
),
rd AS (
SELECT r.*
FROM public.reminder*details r
JOIN visible_items v ON v.id = r.item_id
),
ed AS (
SELECT e.*
FROM public.event*details e
JOIN visible_items v ON v.id = e.item_id
),
sub AS (
SELECT s.*
FROM public.item*subtasks s
JOIN visible_items v ON v.id = s.parent_item_id
),
al AS (
SELECT a.*
FROM public.item*alerts a
JOIN visible_items v ON v.id = a.item_id
),
rr AS (
SELECT r.*,
COALESCE(
(SELECT jsonb*agg(to_jsonb(ex))
FROM public.item_recurrence_exceptions ex
WHERE ex.rule_id = r.id),
'[]'::jsonb
) AS exceptions
FROM public.item_recurrence_rules r
JOIN visible_items v ON v.id = r.item_id
),
rp AS (
SELECT p.*
FROM public.recurrence*pauses p
JOIN visible_items v ON v.id = p.item_id
)
SELECT jsonb_build_object(
'partner_id', partner_id,
'items', COALESCE((
SELECT jsonb_agg(
to_jsonb(v)
|| jsonb_build_object(
'reminder_details', (SELECT to_jsonb(rd.*) FROM rd WHERE rd.item*id = v.id LIMIT 1),
'event_details', (SELECT to_jsonb(ed.*) FROM ed WHERE ed.item*id = v.id LIMIT 1),
'subtasks', COALESCE((SELECT jsonb_agg(to_jsonb(sub.*)) FROM sub WHERE sub.parent*item_id = v.id), '[]'::jsonb),
'alerts', COALESCE((SELECT jsonb_agg(to_jsonb(al.*)) FROM al WHERE al.item*id = v.id), '[]'::jsonb),
'pauses', COALESCE((SELECT jsonb_agg(to_jsonb(rp.*)) FROM rp WHERE rp.item_id = v.id), '[]'::jsonb),
'recurrence_rule', (SELECT to_jsonb(rr.\*) FROM rr WHERE rr.item_id = v.id LIMIT 1)
)
ORDER BY v.created_at DESC
)
FROM visible_items v
), '[]'::jsonb)
)
INTO result;

RETURN result;
END;
$function$
|

---

## Q3 — Any other Schedule-related functions we should capture?

```sql
SELECT p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%schedule%' OR p.proname ILIKE '%item%' OR p.proname ILIKE '%reminder%')
ORDER BY p.proname;
```

### Answer

| function_name                        | args                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------- |
| disable_catalogue_item_calendar      | p_catalogue_item_id uuid, p_action text                                     |
| find_item_by_barcode                 | p_user_id uuid, p_barcode text                                              |
| get_catalogue_linked_items           | p_catalogue_item_id uuid                                                    |
| get_low_stock_items                  | p_user_id uuid, p_days_threshold integer                                    |
| get_schedule_bundle                  | include_archived boolean                                                    |
| is_flexible_task_scheduled           | p_item_id uuid, p_date date                                                 |
| link_catalogue_to_item               | p_catalogue_item_id uuid, p_item_id uuid                                    |
| promote_item_to_catalogue            | p_item_id uuid, p_module_id uuid, p_category_id uuid, p_keep_linked boolean |
| restock_inventory_item               | p_user_id uuid, p_item_id uuid, p_quantity_to_add numeric, p_source text    |
| sync_catalogue_on_item_delete        |                                                                             |
| sync_catalogue_to_items              | p_catalogue_item_id uuid, p_update_scope text                               |
| update_reminder_templates_updated_at |                                                                             |

---

## Q4 — Any RLS policies defined on these tables (in case Q1 shows RLS on)?

```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN (
  'items','item_alerts','item_subtasks','reminder_details','event_details',
  'item_recurrence_rules','item_recurrence_exceptions','recurrence_pauses',
  'item_occurrence_actions'
)
ORDER BY tablename, policyname;
```

### Answer

| tablename     | policyname                     | cmd | qual               | with_check |
| ------------- | ------------------------------ | --- | ------------------ | ---------- |
| event_details | Users can manage event details | ALL | (EXISTS ( SELECT 1 |

FROM items
WHERE ((items.id = event_details.item_id) AND (items.user_id = auth.uid())))) | null |
| event_details | Users can view own and partner public event details | SELECT | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = event_details.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))) | null |
| event_details | event_details_via_parent | ALL | (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = event_details.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links hl
WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))) | null |
| item_alerts | Users can manage item alerts | ALL | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_alerts.item_id) AND (items.user_id = auth.uid())))) | null |
| item_alerts | Users can view own and partner public item alerts | SELECT | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_alerts.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))) | null |
| item_alerts | item_alerts_via_parent | ALL | (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = item_alerts.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links hl
WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))) | null |
| item_occurrence_actions | Users can insert own or responsible item occurrence actions | INSERT | null | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_occurrence_actions.item_id) AND ((items.user_id = auth.uid()) OR ((items.responsible_user_id = auth.uid()) AND (items.is_public = true)))))) |
| item_occurrence_actions | Users can manage their item occurrence actions | ALL | (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = item_occurrence_actions.item_id) AND ((i.user_id = auth.uid()) OR (i.responsible_user_id = auth.uid()))))) | (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = item_occurrence_actions.item_id) AND ((i.user_id = auth.uid()) OR (i.responsible_user_id = auth.uid()))))) |
| item_occurrence_actions | Users can view own and partner public item occurrence actions | SELECT | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_occurrence_actions.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))) | null |
| item_occurrence_actions | item_occurrence_actions_insert | INSERT | null | ((created_by = auth.uid()) AND (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = item_occurrence_actions.item_id) AND ((i.user_id = auth.uid()) OR (i.responsible_user_id = auth.uid()) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = i.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = i.user_id)))))))))))) |
| item_occurrence_actions | item_occurrence_actions_select | SELECT | ((created_by = auth.uid()) OR (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = item_occurrence_actions.item_id) AND ((i.user_id = auth.uid()) OR (i.responsible_user_id = auth.uid()) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = i.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = i.user_id)))))))))))) | null |
| item_recurrence_exceptions | Household members can manage recurrence exceptions | ALL | (EXISTS ( SELECT 1
FROM ((item_recurrence_rules r
JOIN items i ON ((i.id = r.item_id)))
JOIN household_links hl ON (((hl.active = true) AND (((hl.owner_user_id = auth.uid()) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = auth.uid()) AND (hl.owner_user_id = i.user_id))))))
WHERE ((r.id = item_recurrence_exceptions.rule_id) AND (i.is_public = true)))) | null |
| item_recurrence_exceptions | Users can manage recurrence exceptions | ALL | (EXISTS ( SELECT 1
FROM (item_recurrence_rules r
JOIN items i ON ((i.id = r.item_id)))
WHERE ((r.id = item_recurrence_exceptions.rule_id) AND (i.user_id = auth.uid())))) | null |
| item_recurrence_exceptions | item_recurrence_exceptions_via_parent | ALL | (EXISTS ( SELECT 1
FROM (item_recurrence_rules r
JOIN items i ON ((i.id = r.item_id)))
WHERE ((r.id = item_recurrence_exceptions.rule_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links hl
WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))) | null |
| item_recurrence_rules | Users can manage recurrence rules | ALL | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_recurrence_rules.item_id) AND (items.user_id = auth.uid())))) | null |
| item_recurrence_rules | Users can view own and partner public recurrence rules | SELECT | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_recurrence_rules.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))) | null |
| item_recurrence_rules | item_recurrence_rules_via_parent | ALL | (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = item_recurrence_rules.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links hl
WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))) | null |
| item_subtasks | Users can insert own or responsible item subtasks | INSERT | null | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_subtasks.parent_item_id) AND ((items.user_id = auth.uid()) OR ((items.responsible_user_id = auth.uid()) AND (items.is_public = true)))))) |
| item_subtasks | Users can manage item subtasks | ALL | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_subtasks.parent_item_id) AND (items.user_id = auth.uid())))) | null |
| item_subtasks | Users can update own or responsible item subtasks | UPDATE | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_subtasks.parent_item_id) AND ((items.user_id = auth.uid()) OR ((items.responsible_user_id = auth.uid()) AND (items.is_public = true)))))) | null |
| item_subtasks | Users can view own and partner public item subtasks | SELECT | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = item_subtasks.parent_item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))) | null |
| item_subtasks | item_subtasks_via_parent | ALL | (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = item_subtasks.parent_item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links hl
WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))) | null |
| items | Users can delete own items | DELETE | (auth.uid() = user_id) | null |
| items | Users can insert own items | INSERT | null | (auth.uid() = user_id) |
| items | Users can update own or responsible items | UPDATE | ((auth.uid() = user_id) OR ((auth.uid() = responsible_user_id) AND (is_public = true))) | ((auth.uid() = user_id) OR ((auth.uid() = responsible_user_id) AND (is_public = true))) |
| items | Users can view own items | SELECT | ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
FROM household_links hl
WHERE ((hl.active = true) AND (((hl.owner_user_id = auth.uid()) AND (hl.partner_user_id = items.user_id)) OR ((hl.partner_user_id = auth.uid()) AND (hl.owner_user_id = items.user_id))))))) | null |
| items | Users can view own responsible and partner public items | SELECT | ((auth.uid() = user_id) OR (auth.uid() = responsible_user_id) OR ((is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id)))))))) | null |
| items | items_delete | DELETE | ((user_id = auth.uid()) OR ((is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id)))))))) | null |
| items | items_insert | INSERT | null | (user_id = auth.uid()) |
| items | items_select | SELECT | ((user_id = auth.uid()) OR (responsible_user_id = auth.uid()) OR ((is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id)))))))) | null |
| items | items_update | UPDATE | ((user_id = auth.uid()) OR (responsible_user_id = auth.uid()) OR ((is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id)))))))) | null |
| recurrence_pauses | recurrence_pauses_via_parent | ALL | (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = recurrence_pauses.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links hl
WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))) | null |
| reminder_details | Users can manage reminder details | ALL | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = reminder_details.item_id) AND (items.user_id = auth.uid())))) | null |
| reminder_details | Users can update own or responsible reminder details | UPDATE | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = reminder_details.item_id) AND ((items.user_id = auth.uid()) OR ((items.responsible_user_id = auth.uid()) AND (items.is_public = true)))))) | null |
| reminder_details | Users can view own and partner public reminder details | SELECT | (EXISTS ( SELECT 1
FROM items
WHERE ((items.id = reminder_details.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links
WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))) | null |
| reminder_details | reminder_details_via_parent | ALL | (EXISTS ( SELECT 1
FROM items i
WHERE ((i.id = reminder_details.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
FROM household_links hl
WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))) | null |

---

## What each answer decides

- **Q1 = all false** → confirms the "RLS myth": auth is app-level only. Fix is the route guard. ✅
- **Q2** → the single most important answer. Three cases:
  - RPC returns **only the caller's own items** → write-auth fix alone is safe but partner shared items still invisible; RPC must be widened.
  - RPC returns **all household items including private (creator==responsible) ones** → there's already a privacy leak; the RPC must be tightened to hide private items, and the write guard must match.
  - RPC returns **household items but hides private ones** → ideal; write guard just needs to mirror the same predicate.
- **Q3/Q4** → anything we must paste back into `schema.sql` so the repo stops lying (W5).
