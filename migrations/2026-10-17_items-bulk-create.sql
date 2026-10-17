-- migrations/2026-10-17_items-bulk-create.sql
--
-- WHAT: 1. create_item_complete accepts an optional client-supplied item id. A repeat
--          with an id the caller already owns returns that item (completion.replayed)
--          instead of creating a second one.
--       2. create_items_bulk(p jsonb): up to 50 items per call, one request, one
--          transaction per item (a bad item fails alone, the rest commit).
-- WHY:  SCH-25 — assigning ~30 chores sent 30 POSTs and 30 refetches; slow ones timed
--       out, flipped the app offline, and a retry could duplicate what had committed.
--       One idempotent bulk call is retry-safe and queues offline as a single operation.
-- RUN:  manually in the Supabase SQL Editor. Safe to re-run.
--       Requires 2026-10-11_atomic-item-create.sql (SCH-24) first.
-- RLS:  SECURITY INVOKER, so existing item policies and the household checks inside
--       create_item_complete stay the authority. No policy or grant is widened.
-- NOTE: PostgREST's statement timeout applies per call; 50 items is far below it.

BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.check_item_prerequisite(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Run 2026-10-11_atomic-item-create.sql (SCH-24) first';
  END IF;
END $$;

-- 1. Replay-safe single create (same body as SCH-24 plus the id handling).
CREATE OR REPLACE FUNCTION public.create_item_complete(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE i public.items; r public.items; v jsonb; children jsonb := '{}'::jsonb; replayed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p->>'type' NOT IN ('reminder','task','event') OR nullif(trim(p->>'title'),'') IS NULL THEN
    RAISE EXCEPTION 'Invalid item' USING ERRCODE = '22023';
  END IF;
  IF p->>'status'='draft' AND jsonb_array_length(coalesce(p->'prerequisites','[]')) > 0 THEN
    RAISE EXCEPTION 'Draft triggers are unavailable' USING ERRCODE = '22023';
  END IF;
  IF p->>'id' IS NOT NULL THEN
    SELECT * INTO i FROM public.items WHERE id = (p->>'id')::uuid AND user_id = auth.uid();
    replayed := FOUND;
  END IF;
  IF NOT replayed THEN
    IF p->>'responsible_user_id' IS NOT NULL AND (p->>'responsible_user_id')::uuid <> auth.uid()
      AND NOT public.is_household_partner((p->>'responsible_user_id')::uuid) THEN
      RAISE EXCEPTION 'Assignee unavailable' USING ERRCODE = '42501';
    END IF;
    FOR v IN SELECT value FROM jsonb_array_elements(coalesce(p->'prerequisites','[]')) LOOP
      PERFORM public.check_item_prerequisite(v);
    END LOOP;
    r := jsonb_populate_record(NULL::public.items, p || jsonb_build_object(
      'user_id', auth.uid(), 'responsible_user_id', coalesce(p->>'responsible_user_id',auth.uid()::text),
      'status', CASE WHEN jsonb_array_length(coalesce(p->'prerequisites','[]')) > 0 THEN 'dormant' ELSE coalesce(p->>'status','pending') END,
      'priority',coalesce(p->>'priority','normal'), 'is_public',coalesce((p->>'is_public')::boolean,false),
      'notify_all_household',coalesce((p->>'notify_all_household')::boolean,false),
      'categories',coalesce(p->'category_ids','[]'), 'is_template_instance',coalesce((p->>'is_template_instance')::boolean,false),
      'is_chore',coalesce((p->>'is_chore')::boolean,false)));
    INSERT INTO public.items(id,user_id,type,title,description,priority,status,metadata_json,is_public,responsible_user_id,
      notify_all_household,categories,location_context,location_text,source_catalogue_item_id,is_template_instance,is_chore)
    VALUES(coalesce(r.id,gen_random_uuid()),r.user_id,r.type,trim(r.title),r.description,r.priority,r.status,r.metadata_json,r.is_public,r.responsible_user_id,
      r.notify_all_household,r.categories,r.location_context,r.location_text,r.source_catalogue_item_id,r.is_template_instance,r.is_chore)
    RETURNING * INTO i;
    IF i.type::text = 'event' THEN
      INSERT INTO public.event_details(item_id,start_at,end_at,all_day,location_text)
      VALUES(i.id,(p->>'start_at')::timestamptz,(p->>'end_at')::timestamptz,coalesce((p->>'all_day')::boolean,false),p->>'location_text');
    ELSE
      INSERT INTO public.reminder_details(item_id,due_at,estimate_minutes,has_checklist)
      VALUES(i.id,(p->>'due_at')::timestamptz,(p->>'estimate_minutes')::integer,coalesce((p->>'has_checklist')::boolean,false));
    END IF;
    FOR v IN SELECT value FROM jsonb_array_elements(coalesce(p->'subtasks','[]')) WITH ORDINALITY AS a(value,n) LOOP
      INSERT INTO public.item_subtasks(parent_item_id,title,order_index)
      VALUES(i.id,v->>'title',coalesce((v->>'order_index')::integer,0));
    END LOOP;
    IF i.status::text <> 'draft' THEN
      FOR v IN SELECT value FROM jsonb_array_elements(coalesce(p->'alerts','[]')) LOOP
        INSERT INTO public.item_alerts(item_id,kind,trigger_at,offset_minutes,relative_to,custom_time,repeat_every_minutes,max_repeats,channel)
        SELECT i.id,a.kind,a.trigger_at,a.offset_minutes,a.relative_to,a.custom_time,a.repeat_every_minutes,a.max_repeats,
          coalesce(a.channel,(jsonb_populate_record(NULL::public.item_alerts,'{"channel":"push"}')).channel)
        FROM jsonb_populate_record(NULL::public.item_alerts,v) a;
      END LOOP;
    END IF;
    IF p->'recurrence_rule' IS NOT NULL AND p->'recurrence_rule' <> 'null'::jsonb THEN
      INSERT INTO public.item_recurrence_rules(item_id,rrule,start_anchor,end_until,count,is_flexible,flexible_period)
      SELECT i.id,a.rrule,a.start_anchor,a.end_until,a.count,coalesce(a.is_flexible,false),a.flexible_period
      FROM jsonb_populate_record(NULL::public.item_recurrence_rules,p->'recurrence_rule') a;
    END IF;
    FOR v IN SELECT value FROM jsonb_array_elements(coalesce(p->'prerequisites','[]')) LOOP
      INSERT INTO public.item_prerequisites(item_id,condition_type,condition_config,logic_group)
      VALUES(i.id,v->>'condition_type',v->'condition_config',coalesce((v->>'logic_group')::integer,0));
    END LOOP;
  END IF;
  children := jsonb_build_object(
    'alerts', (SELECT coalesce(jsonb_agg(id),'[]') FROM public.item_alerts WHERE item_id=i.id),
    'subtasks', (SELECT coalesce(jsonb_agg(id),'[]') FROM public.item_subtasks WHERE parent_item_id=i.id),
    'prerequisites', (SELECT coalesce(jsonb_agg(id),'[]') FROM public.item_prerequisites WHERE item_id=i.id),
    'recurrence', (SELECT coalesce(jsonb_agg(id),'[]') FROM public.item_recurrence_rules WHERE item_id=i.id));
  RETURN jsonb_build_object('item',to_jsonb(i),'completion',jsonb_build_object('status','complete','replayed',replayed,'children',children));
END $$;

-- 2. Bulk create: each element is one create_item_complete in its own sub-transaction.
CREATE OR REPLACE FUNCTION public.create_items_bulk(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE elem jsonb; n bigint; res jsonb;
  made jsonb := '[]'::jsonb; failed jsonb := '[]'::jsonb; created int := 0; replayed int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p) <> 'array' OR jsonb_array_length(p) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Invalid batch' USING ERRCODE = '22023';
  END IF;
  FOR elem, n IN SELECT value, ordinality FROM jsonb_array_elements(p) WITH ORDINALITY LOOP
    BEGIN
      BEGIN
        res := public.create_item_complete(elem);
      EXCEPTION WHEN unique_violation THEN
        -- A concurrent attempt with the same id committed first: replay returns its row.
        res := public.create_item_complete(elem);
      END;
      IF (res->'completion'->>'replayed')::boolean THEN replayed := replayed + 1; ELSE created := created + 1; END IF;
      made := made || jsonb_build_array(res->'item');
    EXCEPTION WHEN OTHERS THEN
      failed := failed || jsonb_build_array(jsonb_build_object('index', n - 1, 'code', SQLSTATE));
    END;
  END LOOP;
  RETURN jsonb_build_object('items', made, 'failed', failed, 'completion', jsonb_build_object(
    'status', CASE WHEN jsonb_array_length(failed) = 0 THEN 'complete' ELSE 'partial' END,
    'created', created, 'replayed', replayed));
END $$;

REVOKE ALL ON FUNCTION public.create_item_complete(jsonb), public.create_items_bulk(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_item_complete(jsonb), public.create_items_bulk(jsonb) TO authenticated;
COMMIT;
