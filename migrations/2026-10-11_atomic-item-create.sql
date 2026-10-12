-- SCH-24: Run manually in the Supabase SQL Editor BEFORE using this build.
-- Source-owned transactions; SECURITY INVOKER preserves existing RLS.
-- No data repair/backfill or policy widening. Re-runnable.
-- Refresh db-state.json and verify RLS afterward (SCH-10 remains separate).
BEGIN;

-- The existing picker supports a custom clock time on the same day (0 days).
ALTER TABLE public.item_alerts DROP CONSTRAINT IF EXISTS item_alerts_offset_minutes_check;
ALTER TABLE public.item_alerts ADD CONSTRAINT item_alerts_offset_minutes_check
  CHECK (offset_minutes IS NULL OR offset_minutes >= 0);

CREATE OR REPLACE FUNCTION public.check_item_prerequisite(p jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE c jsonb := p->'condition_config';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p->>'condition_type' = 'nfc_state_change' THEN
    IF NOT EXISTS (SELECT 1 FROM public.nfc_tags t
      WHERE t.id = (c->>'tag_id')::uuid AND t.is_active
        AND (t.user_id = auth.uid() OR public.is_household_partner(t.user_id))
        AND t.states ? (c->>'target_state')) THEN
      RAISE EXCEPTION 'NFC tag or state unavailable' USING ERRCODE = '42501';
    END IF;
  ELSIF p->>'condition_type' = 'item_completed' THEN
    IF NOT EXISTS (SELECT 1 FROM public.items i
      WHERE i.id = (c->>'prerequisite_item_id')::uuid AND i.deleted_at IS NULL
        AND (i.user_id = auth.uid() OR (i.is_public AND public.is_household_partner(i.user_id)))) THEN
      RAISE EXCEPTION 'Prerequisite item unavailable' USING ERRCODE = '42501';
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_item_complete(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE i public.items; r public.items; v jsonb; children jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p->>'type' NOT IN ('reminder','task','event') OR nullif(trim(p->>'title'),'') IS NULL THEN
    RAISE EXCEPTION 'Invalid item' USING ERRCODE = '22023';
  END IF;
  IF p->>'status'='draft' AND jsonb_array_length(coalesce(p->'prerequisites','[]')) > 0 THEN
    RAISE EXCEPTION 'Draft triggers are unavailable' USING ERRCODE = '22023';
  END IF;
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
  INSERT INTO public.items(user_id,type,title,description,priority,status,metadata_json,is_public,responsible_user_id,
    notify_all_household,categories,location_context,location_text,source_catalogue_item_id,is_template_instance,is_chore)
  VALUES(r.user_id,r.type,trim(r.title),r.description,r.priority,r.status,r.metadata_json,r.is_public,r.responsible_user_id,
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
  children := jsonb_build_object(
    'alerts', (SELECT coalesce(jsonb_agg(id),'[]') FROM public.item_alerts WHERE item_id=i.id),
    'subtasks', (SELECT coalesce(jsonb_agg(id),'[]') FROM public.item_subtasks WHERE parent_item_id=i.id),
    'prerequisites', (SELECT coalesce(jsonb_agg(id),'[]') FROM public.item_prerequisites WHERE item_id=i.id),
    'recurrence', (SELECT coalesce(jsonb_agg(id),'[]') FROM public.item_recurrence_rules WHERE item_id=i.id));
  RETURN jsonb_build_object('item',to_jsonb(i),'completion',jsonb_build_object('status','complete','children',children));
END $$;

CREATE OR REPLACE FUNCTION public.add_item_prerequisite_complete(p_item_id uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE i public.items; prereq public.item_prerequisites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO i FROM public.items WHERE id=p_item_id AND user_id=auth.uid() AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.check_item_prerequisite(p);
  INSERT INTO public.item_prerequisites(item_id,condition_type,condition_config,logic_group)
    VALUES(i.id,p->>'condition_type',p->'condition_config',coalesce((p->>'logic_group')::integer,0)) RETURNING * INTO prereq;
  IF i.status::text IN ('pending','in_progress') THEN
    UPDATE public.items SET status='dormant',updated_at=now() WHERE id=i.id RETURNING * INTO i;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item state update denied' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN to_jsonb(prereq) || jsonb_build_object('completion',jsonb_build_object('status','complete','itemId',i.id,'itemStatus',i.status));
END $$;

CREATE OR REPLACE FUNCTION public.remove_item_prerequisite_complete(p_item_id uuid, p_prerequisite_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE i public.items;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO i FROM public.items WHERE id=p_item_id AND user_id=auth.uid() AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0002'; END IF;
  DELETE FROM public.item_prerequisites WHERE id=p_prerequisite_id AND item_id=i.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prerequisite not found' USING ERRCODE = 'P0002'; END IF;
  IF i.status::text='dormant' AND NOT EXISTS (SELECT 1 FROM public.item_prerequisites WHERE item_id=i.id AND is_active) THEN
    UPDATE public.items SET status='pending',updated_at=now() WHERE id=i.id RETURNING * INTO i;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item state update denied' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'completion',jsonb_build_object('status','complete','itemId',i.id,'itemStatus',i.status));
END $$;

REVOKE ALL ON FUNCTION public.check_item_prerequisite(jsonb),public.create_item_complete(jsonb),
  public.add_item_prerequisite_complete(uuid,jsonb),public.remove_item_prerequisite_complete(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_item_prerequisite(jsonb),public.create_item_complete(jsonb),
  public.add_item_prerequisite_complete(uuid,jsonb),public.remove_item_prerequisite_complete(uuid,uuid) TO authenticated;
COMMIT;
