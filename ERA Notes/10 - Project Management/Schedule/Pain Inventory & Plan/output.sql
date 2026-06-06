-- Query 2: get RLS policies for items tables
SELECT
  'ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;' AS sql
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('items','item_alerts','item_subtasks','item_recurrence_rules',
                    'reminder_details','event_details')
  AND rowsecurity = true
UNION ALL
SELECT
  'CREATE POLICY ' || quote_ident(policyname) || ' ON public.' || quote_ident(tablename) ||
  ' AS PERMISSIVE FOR ' || cmd ||
  COALESCE(' USING (' || qual || ')', '') ||
  COALESCE(' WITH CHECK (' || with_check || ')', '') || ';'
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('items','item_alerts','item_subtasks','item_recurrence_rules',
                    'reminder_details','event_details')
ORDER BY 1;

---
| pg_get_functiondef                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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

  WITH visible_items AS (
    SELECT i.*
      FROM public.items i
     WHERE i.deleted_at IS NULL
       AND (include_archived OR i.archived_at IS NULL)
       AND (
            i.user_id = uid
         OR (partner_id IS NOT NULL AND i.user_id = partner_id AND i.is_public = true)
       )
  ),
  rd AS (
    SELECT r.*
      FROM public.reminder_details r
      JOIN visible_items v ON v.id = r.item_id
  ),
  ed AS (
    SELECT e.*
      FROM public.event_details e
      JOIN visible_items v ON v.id = e.item_id
  ),
  sub AS (
    SELECT s.*
      FROM public.item_subtasks s
      JOIN visible_items v ON v.id = s.parent_item_id
  ),
  al AS (
    SELECT a.*
      FROM public.item_alerts a
      JOIN visible_items v ON v.id = a.item_id
  ),
  rr AS (
    SELECT r.*,
           COALESCE(
             (SELECT jsonb_agg(to_jsonb(ex))
                FROM public.item_recurrence_exceptions ex
               WHERE ex.rule_id = r.id),
             '[]'::jsonb
           ) AS exceptions
      FROM public.item_recurrence_rules r
      JOIN visible_items v ON v.id = r.item_id
  ),
  rp AS (
    SELECT p.*
      FROM public.recurrence_pauses p
      JOIN visible_items v ON v.id = p.item_id
  )
  SELECT jsonb_build_object(
    'partner_id', partner_id,
    'items', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(v)
        || jsonb_build_object(
             'reminder_details', (SELECT to_jsonb(rd.*) FROM rd WHERE rd.item_id = v.id LIMIT 1),
             'event_details',    (SELECT to_jsonb(ed.*) FROM ed WHERE ed.item_id = v.id LIMIT 1),
             'subtasks',         COALESCE((SELECT jsonb_agg(to_jsonb(sub.*)) FROM sub WHERE sub.parent_item_id = v.id), '[]'::jsonb),
             'alerts',           COALESCE((SELECT jsonb_agg(to_jsonb(al.*))  FROM al  WHERE al.item_id = v.id),        '[]'::jsonb),
             'pauses',           COALESCE((SELECT jsonb_agg(to_jsonb(rp.*))  FROM rp  WHERE rp.item_id = v.id),        '[]'::jsonb),
             'recurrence_rule',  (SELECT to_jsonb(rr.*) FROM rr WHERE rr.item_id = v.id LIMIT 1)
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
 -- Query 2: get RLS policies for items tables
SELECT
  'ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;' AS sql
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('items','item_alerts','item_subtasks','item_recurrence_rules',
                    'reminder_details','event_details')
  AND rowsecurity = true
UNION ALL
SELECT
  'CREATE POLICY ' || quote_ident(policyname) || ' ON public.' || quote_ident(tablename) ||
  ' AS PERMISSIVE FOR ' || cmd ||
  COALESCE(' USING (' || qual || ')', '') ||
  COALESCE(' WITH CHECK (' || with_check || ')', '') || ';'
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('items','item_alerts','item_subtasks','item_recurrence_rules',
                    'reminder_details','event_details')
ORDER BY 1;


---

| sql                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALTER TABLE public.event_details ENABLE ROW LEVEL SECURITY;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ALTER TABLE public.item_alerts ENABLE ROW LEVEL SECURITY;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ALTER TABLE public.item_recurrence_rules ENABLE ROW LEVEL SECURITY;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ALTER TABLE public.item_subtasks ENABLE ROW LEVEL SECURITY;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ALTER TABLE public.reminder_details ENABLE ROW LEVEL SECURITY;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE POLICY "Users can delete own items" ON public.items AS PERMISSIVE FOR DELETE USING ((auth.uid() = user_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY "Users can insert own items" ON public.items AS PERMISSIVE FOR INSERT WITH CHECK ((auth.uid() = user_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY "Users can insert own or responsible item subtasks" ON public.item_subtasks AS PERMISSIVE FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = item_subtasks.parent_item_id) AND ((items.user_id = auth.uid()) OR ((items.responsible_user_id = auth.uid()) AND (items.is_public = true)))))));                                                                                                                                                                                                                                                                                            |
| CREATE POLICY "Users can manage event details" ON public.event_details AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = event_details.item_id) AND (items.user_id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE POLICY "Users can manage item alerts" ON public.item_alerts AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = item_alerts.item_id) AND (items.user_id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY "Users can manage item subtasks" ON public.item_subtasks AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = item_subtasks.parent_item_id) AND (items.user_id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE POLICY "Users can manage recurrence rules" ON public.item_recurrence_rules AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = item_recurrence_rules.item_id) AND (items.user_id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE POLICY "Users can manage reminder details" ON public.reminder_details AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = reminder_details.item_id) AND (items.user_id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY "Users can update own or responsible item subtasks" ON public.item_subtasks AS PERMISSIVE FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = item_subtasks.parent_item_id) AND ((items.user_id = auth.uid()) OR ((items.responsible_user_id = auth.uid()) AND (items.is_public = true)))))));                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY "Users can update own or responsible items" ON public.items AS PERMISSIVE FOR UPDATE USING (((auth.uid() = user_id) OR ((auth.uid() = responsible_user_id) AND (is_public = true)))) WITH CHECK (((auth.uid() = user_id) OR ((auth.uid() = responsible_user_id) AND (is_public = true))));                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY "Users can update own or responsible reminder details" ON public.reminder_details AS PERMISSIVE FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = reminder_details.item_id) AND ((items.user_id = auth.uid()) OR ((items.responsible_user_id = auth.uid()) AND (items.is_public = true)))))));                                                                                                                                                                                                                                                                                               |
| CREATE POLICY "Users can view own and partner public event details" ON public.event_details AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = event_details.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links
          WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))));                     |
| CREATE POLICY "Users can view own and partner public item alerts" ON public.item_alerts AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = item_alerts.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links
          WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))));                           |
| CREATE POLICY "Users can view own and partner public item subtasks" ON public.item_subtasks AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = item_subtasks.parent_item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links
          WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))));              |
| CREATE POLICY "Users can view own and partner public recurrence rules" ON public.item_recurrence_rules AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = item_recurrence_rules.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links
          WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))));  |
| CREATE POLICY "Users can view own and partner public reminder details" ON public.reminder_details AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = reminder_details.item_id) AND ((items.user_id = auth.uid()) OR ((items.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links
          WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id))))))))))));            |
| CREATE POLICY "Users can view own items" ON public.items AS PERMISSIVE FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM household_links hl
  WHERE ((hl.active = true) AND (((hl.owner_user_id = auth.uid()) AND (hl.partner_user_id = items.user_id)) OR ((hl.partner_user_id = auth.uid()) AND (hl.owner_user_id = items.user_id))))))));                                                                                                                                                                                                                                                               |
| CREATE POLICY "Users can view own responsible and partner public items" ON public.items AS PERMISSIVE FOR SELECT USING (((auth.uid() = user_id) OR (auth.uid() = responsible_user_id) OR ((is_public = true) AND (EXISTS ( SELECT 1
   FROM household_links
  WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id)))))))));                                                                                                   |
| CREATE POLICY event_details_via_parent ON public.event_details AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items i
  WHERE ((i.id = event_details.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links hl
          WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))));                         |
| CREATE POLICY item_alerts_via_parent ON public.item_alerts AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items i
  WHERE ((i.id = item_alerts.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links hl
          WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))));                               |
| CREATE POLICY item_recurrence_rules_via_parent ON public.item_recurrence_rules AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items i
  WHERE ((i.id = item_recurrence_rules.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links hl
          WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id)))))))))))); |
| CREATE POLICY item_subtasks_via_parent ON public.item_subtasks AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items i
  WHERE ((i.id = item_subtasks.parent_item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links hl
          WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))));                  |
| CREATE POLICY items_delete ON public.items AS PERMISSIVE FOR DELETE USING (((user_id = auth.uid()) OR ((is_public = true) AND (EXISTS ( SELECT 1
   FROM household_links
  WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id)))))))));                                                                                                                                                                                      |
| CREATE POLICY items_insert ON public.items AS PERMISSIVE FOR INSERT WITH CHECK ((user_id = auth.uid()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY items_select ON public.items AS PERMISSIVE FOR SELECT USING (((user_id = auth.uid()) OR (responsible_user_id = auth.uid()) OR ((is_public = true) AND (EXISTS ( SELECT 1
   FROM household_links
  WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id)))))))));                                                                                                                                                |
| CREATE POLICY items_update ON public.items AS PERMISSIVE FOR UPDATE USING (((user_id = auth.uid()) OR (responsible_user_id = auth.uid()) OR ((is_public = true) AND (EXISTS ( SELECT 1
   FROM household_links
  WHERE ((household_links.active = true) AND (((household_links.owner_user_id = auth.uid()) AND (household_links.partner_user_id = items.user_id)) OR ((household_links.partner_user_id = auth.uid()) AND (household_links.owner_user_id = items.user_id)))))))));                                                                                                                                                |
| CREATE POLICY reminder_details_via_parent ON public.reminder_details AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1
   FROM items i
  WHERE ((i.id = reminder_details.item_id) AND ((i.user_id = ( SELECT auth.uid() AS uid)) OR (i.responsible_user_id = ( SELECT auth.uid() AS uid)) OR ((i.is_public = true) AND (EXISTS ( SELECT 1
           FROM household_links hl
          WHERE ((hl.active = true) AND (((hl.owner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.partner_user_id = i.user_id)) OR ((hl.partner_user_id = ( SELECT auth.uid() AS uid)) AND (hl.owner_user_id = i.user_id))))))))))));                |
