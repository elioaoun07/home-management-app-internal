-- Household Activity Log (HUB-72).
-- RUN manually in Supabase SQL Editor. Never run schema.sql.
-- Records committed changes from installation onward; no fabricated backfill.
-- Re-running preserves history. Source-table triggers are transactional: a
-- rolled-back write leaves no event. No browser/client may write the ledger.
-- Optional source tables are skipped if absent; re-run after installing them.
-- Verify with the isolated PGlite suite before applying, then test both owners.
BEGIN;

CREATE TABLE IF NOT EXISTS public.activity_log_sources (
  table_name text PRIMARY KEY,
  module text NOT NULL,
  feature text NOT NULL,
  label text NOT NULL,
  policy text NOT NULL,
  parent_table text,
  parent_key text,
  id_column text NOT NULL DEFAULT 'id'
);

CREATE TABLE IF NOT EXISTS public.household_activity (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  module text NOT NULL,
  feature text NOT NULL,
  action text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  actor_user_id uuid,
  audience uuid[] NOT NULL,
  title text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  context jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS household_activity_owner_sequence_idx
  ON public.household_activity (owner_user_id, sequence DESC);
CREATE INDEX IF NOT EXISTS household_activity_module_sequence_idx
  ON public.household_activity (module, sequence DESC);
CREATE INDEX IF NOT EXISTS household_activity_source_sequence_idx
  ON public.household_activity (source_table, source_id, sequence DESC);
CREATE INDEX IF NOT EXISTS household_activity_time_idx
  ON public.household_activity (occurred_at DESC);

ALTER TABLE public.household_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log_sources ENABLE ROW LEVEL SECURITY;
-- Deliberately no direct policies/grants: the authenticated read RPC owns all
-- access checks. No per-row parent-join RLS on the ledger or source child tables.
REVOKE ALL ON public.household_activity, public.activity_log_sources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.household_activity_sequence_seq FROM PUBLIC, anon, authenticated;

INSERT INTO public.activity_log_sources
  (table_name, module, feature, label, policy, parent_table, parent_key, id_column)
VALUES
  ('transactions','budget','transactions','Transaction','transaction',NULL,NULL,'id'),
  ('accounts','budget','accounts','Account','public',NULL,NULL,'id'),
  ('account_balances','budget','balances','Balance','parent','accounts','account_id','id'),
  ('transfers','budget','transfers','Transfer','shared',NULL,NULL,'id'),
  ('recurring_payments','budget','recurring','Recurring payment','transaction',NULL,NULL,'id'),
  ('debts','budget','debts','Debt','private',NULL,NULL,'id'),
  ('future_purchases','budget','purchases','Future purchase','private',NULL,NULL,'id'),
  ('budget_allocations','budget','allocation','Allocation','shared',NULL,NULL,'id'),
  ('user_categories','budget','categories','Category','parent','accounts','account_id','id'),
  ('statement_imports','budget','imports','Statement import','private',NULL,NULL,'id'),
  ('statement_import_entries','budget','imports','Imported entry','parent','statement_imports','import_id','id'),
  ('statement_skipped_rows','budget','imports','Skipped statement row','private',NULL,NULL,'id'),
  ('merchant_mappings','budget','merchants','Merchant mapping','private',NULL,NULL,'id'),
  ('transaction_templates','budget','templates','Transaction template','private',NULL,NULL,'id'),
  ('items','schedule','items','Reminder','item',NULL,NULL,'id'),
  ('reminder_details','schedule','reminders','Reminder details','parent','items','item_id','item_id'),
  ('event_details','schedule','events','Event details','parent','items','item_id','item_id'),
  ('item_subtasks','schedule','subtasks','Subtask','parent','items','parent_item_id','id'),
  ('item_subtask_completions','schedule','subtasks','Subtask completion','parent','item_subtasks','subtask_id','id'),
  ('item_snoozes','schedule','alerts','Snooze','parent','items','item_id','id'),
  ('item_attachments','schedule','attachments','Attachment','parent','items','item_id','id'),
  ('item_alerts','schedule','alerts','Alert','parent','items','item_id','id'),
  ('item_alert_suppressions','schedule','alerts','Alert suppression','parent','items','item_id','id'),
  ('reminder_templates','schedule','templates','Reminder template','private',NULL,NULL,'id'),
  ('item_occurrence_actions','schedule','occurrences','Occurrence','parent','items','item_id','id'),
  ('item_recurrence_rules','schedule','recurrence','Recurrence','parent','items','item_id','id'),
  ('item_recurrence_exceptions','schedule','recurrence','Occurrence exception','parent','item_recurrence_rules','rule_id','id'),
  ('item_flexible_schedules','schedule','planning','Routine placement','parent','items','item_id','id'),
  ('item_prerequisites','schedule','prerequisites','Prerequisite','parent','items','item_id','id'),
  ('recurrence_pauses','schedule','recurrence','Pause','parent','items','item_id','id'),
  ('day_plans','schedule','planning','Day plan','private',NULL,NULL,'id'),
  ('hub_chat_threads','chat','threads','Conversation','thread',NULL,NULL,'id'),
  ('hub_messages','chat','messages','Message','parent','hub_chat_threads','thread_id','id'),
  ('hub_notes_topics','chat','notes','Note topic','parent','hub_chat_threads','thread_id','id'),
  ('hub_message_actions','chat','actions','Message action','parent','hub_messages','message_id','id'),
  ('shopping_groups','kitchen','shopping','Shopping group','parent','hub_chat_threads','thread_id','id'),
  ('shopping_item_links','kitchen','shopping','Shopping link','parent','hub_messages','message_id','id'),
  ('catalogue_modules','catalogue','modules','Catalogue module','public',NULL,NULL,'id'),
  ('catalogue_categories','catalogue','categories','Catalogue category','parent','catalogue_modules','module_id','id'),
  ('catalogue_items','catalogue','items','Catalogue item','public',NULL,NULL,'id'),
  ('catalogue_sub_items','catalogue','subitems','Catalogue subitem','parent','catalogue_items','item_id','id'),
  ('catalogue_item_calendar_history','catalogue','calendar','Calendar link','private',NULL,NULL,'id'),
  ('inventory_stock','kitchen','inventory','Stock','parent','catalogue_items','item_id','id'),
  ('inventory_restock_history','kitchen','inventory','Restock','parent','catalogue_items','item_id','id'),
  ('recipes','kitchen','recipes','Recipe','household',NULL,NULL,'id'),
  ('recipe_versions','kitchen','recipes','Recipe version','parent','recipes','recipe_id','id'),
  ('cooking_logs','kitchen','cooking','Cooking log','parent','recipes','recipe_id','id'),
  ('meal_plans','kitchen','meals','Meal plan','household',NULL,NULL,'id'),
  ('trips','trips','trips','Trip','trip',NULL,NULL,'id'),
  ('trip_places','trips','places','Place','parent','trips','trip_id','id'),
  ('trip_packing_items','trips','packing','Packing item','parent','trips','trip_id','id'),
  ('trip_packing_category','trips','packing','Packing category','parent','trips','trip_id','id'),
  ('trip_packing_checkpoints','trips','packing','Packing checkpoint','parent','trips','trip_id','id'),
  ('trip_documents','trips','documents','Trip document','parent','trips','trip_id','id'),
  ('health_profiles','healthcare','profiles','Health profile','health',NULL,NULL,'id'),
  ('health_allergies','healthcare','allergies','Allergy record','parent','health_profiles','profile_id','id'),
  ('health_conditions','healthcare','conditions','Health record','parent','health_profiles','profile_id','id'),
  ('health_vaccines','healthcare','vaccines','Vaccine record','parent','health_profiles','profile_id','id'),
  ('health_medications','healthcare','medications','Medication','parent','health_profiles','profile_id','id'),
  ('health_medication_logs','healthcare','medications','Dose log','parent','health_medications','medication_id','id'),
  ('wardrobe_profiles','outfits','profile','Wardrobe profile','private',NULL,NULL,'user_id'),
  ('wardrobe_items','outfits','wardrobe','Garment','private',NULL,NULL,'id'),
  ('outfits','outfits','outfits','Outfit','private',NULL,NULL,'id'),
  ('outfit_items','outfits','outfits','Outfit garment','parent','outfits','outfit_id','id'),
  ('era_conversations','era','conversations','ERA conversation','private',NULL,NULL,'id'),
  ('era_messages','era','messages','ERA message','parent','era_conversations','conversation_id','id'),
  ('era_templates','era','templates','ERA template','private',NULL,NULL,'id'),
  ('guest_portal_tags','guests','portals','Guest portal','private',NULL,NULL,'id'),
  ('guest_sessions','guests','visits','Guest visit','parent','guest_portal_tags','tag_id','id'),
  ('guest_chat_messages','guests','messages','Guest message','parent','guest_portal_tags','tag_id','id'),
  ('guest_allergies','guests','allergies','Guest allergy record','parent','guest_portal_tags','tag_id','id'),
  ('guest_feedback','guests','feedback','Guest feedback','parent','guest_portal_tags','tag_id','id'),
  ('guest_drinks','guests','drinks','Drink request','parent','guest_portal_tags','tag_id','id'),
  ('notifications','notifications','notifications','Notification','private',NULL,NULL,'id'),
  ('user_preferences','settings','preferences','Preferences','private',NULL,NULL,'user_id'),
  ('notification_preferences','settings','notifications','Notification preferences','private',NULL,NULL,'id'),
  ('nfc_tags','schedule','nfc','NFC tag','shared',NULL,NULL,'id'),
  ('nfc_state_log','schedule','nfc','NFC state','parent','nfc_tags','tag_id','id'),
  ('nfc_checklist_items','schedule','nfc','NFC checklist item','parent','nfc_tags','tag_id','id'),
  ('nfc_checklist_completions','schedule','nfc','NFC completion','parent','nfc_checklist_items','checklist_item_id','id')
ON CONFLICT (table_name) DO UPDATE SET
  module = EXCLUDED.module, feature = EXCLUDED.feature, label = EXCLUDED.label,
  policy = EXCLUDED.policy, parent_table = EXCLUDED.parent_table,
  parent_key = EXCLUDED.parent_key, id_column = EXCLUDED.id_column;

-- Retain ACL fields only. Never retain whole rows, credentials, attachments,
-- transcripts, medical notes, signed URLs, or mutation payloads.
CREATE OR REPLACE FUNCTION public.activity_log_context(p_row jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM jsonb_each(p_row) WHERE key = ANY(ARRAY[
    'user_id','managing_user_id','created_by','sender_user_id','household_id',
    'household_link_id','is_private','is_public','is_draft','responsible_user_id',
    'shared_with_household','scope','thread_id','hidden_for','profile_id',
    'medication_id','item_id','recipe_id','trip_id','module_id','account_id',
    'outfit_id','tag_id','checklist_item_id','message_id','conversation_id',
    'collaborator_id','split_completed_at','source_medication_id','deleted_at',
    'parent_item_id','subtask_id','rule_id','import_id','purpose'
  ]);
$$;

CREATE OR REPLACE FUNCTION public.activity_log_current(p_table text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg public.activity_log_sources; result jsonb;
BEGIN
  SELECT * INTO cfg FROM public.activity_log_sources WHERE table_name = p_table;
  IF NOT FOUND OR p_id IS NULL THEN RETURN NULL; END IF;
  IF to_regclass(format('public.%I', p_table)) IS NOT NULL THEN
    EXECUTE format('SELECT public.activity_log_context(to_jsonb(s)) FROM public.%I s WHERE %I = $1', p_table, cfg.id_column)
      INTO result USING p_id;
  END IF;
  -- A deleted entity retains its final privacy boundary, including changes
  -- made just before deletion. Historical events cannot resurrect private data.
  IF result IS NULL THEN
    SELECT context INTO result FROM public.household_activity
      WHERE source_table = p_table AND source_id = p_id
      ORDER BY sequence DESC LIMIT 1;
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_log_owner(p_table text, p_row jsonb, p_depth int DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg public.activity_log_sources;
BEGIN
  IF p_row IS NULL OR p_depth > 6 THEN RETURN NULL; END IF;
  SELECT * INTO cfg FROM public.activity_log_sources WHERE table_name = p_table;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF cfg.parent_table IS NOT NULL AND p_row->>cfg.parent_key IS NOT NULL THEN
    RETURN public.activity_log_owner(cfg.parent_table,
      public.activity_log_current(cfg.parent_table, (p_row->>cfg.parent_key)::uuid), p_depth + 1);
  END IF;
  RETURN coalesce(p_row->>'managing_user_id', p_row->>'user_id', p_row->>'created_by', p_row->>'sender_user_id')::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_log_visible(
  p_table text, p_row jsonb, p_viewer uuid, p_partner uuid, p_household uuid, p_depth int DEFAULT 0
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg public.activity_log_sources; owner_id uuid;
BEGIN
  IF p_row IS NULL OR p_viewer IS NULL OR p_depth > 6 THEN RETURN false; END IF;
  SELECT * INTO cfg FROM public.activity_log_sources WHERE table_name = p_table;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_table = 'hub_messages' AND coalesce(p_row->'hidden_for', '[]'::jsonb) ? p_viewer::text THEN
    RETURN false;
  END IF;
  -- Child ownership never overrides the current parent privacy boundary.
  IF cfg.parent_table IS NOT NULL THEN
    -- Some legacy messages and unattached categories legitimately have no
    -- parent yet. Preserve their writes, with strictly personal activity.
    IF p_row->>cfg.parent_key IS NULL THEN
      RETURN coalesce(public.activity_log_owner(p_table,p_row) = p_viewer,false);
    END IF;
    RETURN public.activity_log_visible(cfg.parent_table,
      public.activity_log_current(cfg.parent_table, (p_row->>cfg.parent_key)::uuid),
      p_viewer, p_partner, p_household, p_depth + 1);
  END IF;
  owner_id := public.activity_log_owner(p_table, p_row);
  IF owner_id = p_viewer THEN RETURN true; END IF;
  IF owner_id IS DISTINCT FROM p_partner OR p_household IS NULL THEN RETURN false; END IF;
  CASE cfg.policy
    WHEN 'private' THEN RETURN false;
    WHEN 'public' THEN RETURN coalesce((p_row->>'is_public')::boolean, false);
    WHEN 'transaction' THEN
      RETURN NOT coalesce((p_row->>'is_draft')::boolean, false)
        AND NOT coalesce((p_row->>'is_private')::boolean, true);
    WHEN 'item' THEN
      -- Medication-generated reminders also inherit the health profile boundary.
      IF p_row->>'source_medication_id' IS NOT NULL AND NOT public.activity_log_visible(
        'health_medications', public.activity_log_current('health_medications', (p_row->>'source_medication_id')::uuid),
        p_viewer, p_partner, p_household, p_depth + 1) THEN RETURN false; END IF;
      RETURN coalesce((p_row->>'is_public')::boolean, false)
        OR p_row->>'responsible_user_id' = p_viewer::text;
    WHEN 'thread' THEN RETURN p_row->>'household_id' = p_household::text
      AND NOT coalesce((p_row->>'is_private')::boolean, true);
    WHEN 'household' THEN RETURN p_row->>'household_id' = p_household::text;
    WHEN 'trip' THEN RETURN p_row->>'scope' = 'household';
    WHEN 'health' THEN RETURN coalesce((p_row->>'shared_with_household')::boolean, false);
    WHEN 'shared' THEN RETURN true;
    ELSE RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_household_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cfg public.activity_log_sources;
  row_data jsonb; previous jsonb; owner_id uuid; partner_id uuid;
  link_id uuid; viewers uuid[]; verb text; event_title text; changed text[];
  ignored text[] := ARRAY['updated_at','last_message_at','google_synced_at',
    'google_event_id','last_evaluated_at','last_result','read_at','is_read',
    'use_count','last_used_at','match_count','last_matched_at','last_seen_at'];
BEGIN
  SELECT * INTO cfg FROM public.activity_log_sources WHERE table_name = TG_TABLE_NAME;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unregistered activity source'; END IF;
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  previous := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  IF TG_OP = 'UPDATE' AND row_data - ignored = previous - ignored THEN RETURN NEW; END IF;
  owner_id := public.activity_log_owner(TG_TABLE_NAME, row_data);
  -- During a cascade a pre-installation parent may already be absent. Refuse
  -- to guess its owner/audience; the parent's own delete event remains recorded.
  IF owner_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Activity source has no resolvable owner: %', TG_TABLE_NAME;
  END IF;
  SELECT id, CASE WHEN owner_user_id = owner_id THEN partner_user_id ELSE owner_user_id END
    INTO link_id, partner_id FROM public.household_links
    WHERE active AND (owner_user_id = owner_id OR partner_user_id = owner_id)
    ORDER BY created_at DESC, id DESC LIMIT 1;
  viewers := ARRAY[owner_id];
  IF partner_id IS NOT NULL AND public.activity_log_visible(TG_TABLE_NAME, row_data, partner_id, owner_id, link_id) THEN
    viewers := array_append(viewers, partner_id);
  END IF;
  verb := CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('hub_messages','era_messages','guest_chat_messages') THEN verb := 'sent'; END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'item_occurrence_actions' THEN verb := coalesce(row_data->>'action_type', verb); END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'cooking_logs' THEN verb := 'cooked'; END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'inventory_restock_history' THEN verb := 'restocked'; END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'health_medication_logs' THEN verb := 'recorded'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF row_data->>'deleted_at' IS NOT NULL AND previous->>'deleted_at' IS NULL THEN verb := 'deleted';
    ELSIF row_data->>'deleted_at' IS NULL AND previous->>'deleted_at' IS NOT NULL THEN verb := 'restored';
    ELSIF row_data->>'archived_at' IS NOT NULL AND previous->>'archived_at' IS NULL THEN verb := 'archived';
    ELSIF row_data->>'checked_at' IS NOT NULL AND previous->>'checked_at' IS NULL THEN verb := 'completed';
    ELSIF row_data->>'status' IS DISTINCT FROM previous->>'status' AND row_data->>'status' IN ('completed','cooked','cancelled','skipped') THEN verb := row_data->>'status';
    END IF;
  END IF;
  SELECT coalesce(array_agg(key ORDER BY key), '{}'::text[]) INTO changed
    FROM jsonb_each(row_data) WHERE TG_OP = 'UPDATE' AND NOT key = ANY(ignored)
    AND value IS DISTINCT FROM previous->key;
  event_title := CASE WHEN cfg.module IN ('healthcare','guests') OR TG_TABLE_NAME IN ('notifications','user_preferences','notification_preferences','wardrobe_profiles')
    THEN cfg.label ELSE coalesce(nullif(row_data->>'title',''), nullif(row_data->>'name',''),
      nullif(row_data->>'label',''), nullif(row_data->>'description',''), nullif(row_data->>'content',''), cfg.label) END;
  INSERT INTO public.household_activity (module,feature,action,source_table,source_id,
    owner_user_id,actor_user_id,audience,title,changed_fields,context)
  VALUES (CASE WHEN TG_TABLE_NAME = 'hub_messages' AND
      public.activity_log_current('hub_chat_threads',(row_data->>'thread_id')::uuid)->>'purpose' = 'shopping'
    THEN 'kitchen' ELSE cfg.module END,
    CASE WHEN TG_TABLE_NAME = 'hub_messages' AND
      public.activity_log_current('hub_chat_threads',(row_data->>'thread_id')::uuid)->>'purpose' = 'shopping'
    THEN 'shopping' ELSE cfg.feature END,
    verb,TG_TABLE_NAME,(row_data->>cfg.id_column)::uuid,owner_id,auth.uid(),viewers,
    left(event_title,200),changed,public.activity_log_context(row_data) || jsonb_build_object('_deleted',TG_OP = 'DELETE'));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE src record;
BEGIN
  FOR src IN SELECT * FROM public.activity_log_sources LOOP
    IF to_regclass(format('public.%I',src.table_name)) IS NOT NULL THEN
      -- Fail the migration atomically on incompatible live schemas, before
      -- enabling a recorder that would break the module's next source write.
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
        WHERE attrelid = to_regclass(format('public.%I',src.table_name))
          AND attname = src.id_column AND atttypid = 'uuid'::regtype AND NOT attisdropped)
        OR (src.parent_key IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_attribute
          WHERE attrelid = to_regclass(format('public.%I',src.table_name))
            AND attname = src.parent_key AND atttypid = 'uuid'::regtype AND NOT attisdropped)) THEN
        RAISE EXCEPTION 'Incompatible activity source: %. Expected UUID key % and parent %',src.table_name,src.id_column,src.parent_key;
      END IF;
      -- Only replaces our own trigger; never modifies source data or policies.
      EXECUTE format('DROP TRIGGER IF EXISTS capture_household_activity ON public.%I',src.table_name);
      -- AFTER records only writes that actually happened (including upserts).
      -- BEFORE would emit phantom creates for ON CONFLICT DO NOTHING/UPDATE.
      EXECUTE format('CREATE TRIGGER capture_household_activity AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_household_activity()',src.table_name);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_household_activity(
  p_module text DEFAULT NULL, p_feature text DEFAULT NULL, p_actor text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_until timestamptz DEFAULT NULL,
  p_before bigint DEFAULT NULL, p_limit int DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE viewer uuid := auth.uid(); partner uuid; household uuid; result jsonb;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR (p_from IS NOT NULL AND p_until IS NOT NULL AND p_from >= p_until)
    OR (p_actor IS NOT NULL AND p_actor NOT IN ('me','partner','system')) THEN
    RAISE EXCEPTION 'Invalid activity filters' USING ERRCODE = '22023';
  END IF;
  SELECT id, CASE WHEN owner_user_id = viewer THEN partner_user_id ELSE owner_user_id END
    INTO household, partner FROM public.household_links
    WHERE active AND (owner_user_id = viewer OR partner_user_id = viewer)
    ORDER BY created_at DESC, id DESC LIMIT 1;
  WITH visible AS MATERIALIZED (
    SELECT a.* FROM public.household_activity a
    WHERE a.owner_user_id IN (viewer,partner) AND viewer = ANY(a.audience)
      AND (p_module IS NULL OR a.module = p_module)
      AND (p_feature IS NULL OR a.feature = p_feature)
      AND (p_actor IS NULL OR (p_actor = 'me' AND a.actor_user_id = viewer)
        OR (p_actor = 'partner' AND a.actor_user_id = partner)
        OR (p_actor = 'system' AND a.actor_user_id IS NULL))
      AND (p_from IS NULL OR a.occurred_at >= p_from)
      AND (p_until IS NULL OR a.occurred_at < p_until)
      AND (p_before IS NULL OR a.sequence < p_before)
      AND public.activity_log_visible(a.source_table,
        public.activity_log_current(a.source_table,a.source_id),viewer,partner,household)
    ORDER BY a.sequence DESC LIMIT p_limit + 1
  ), page AS (SELECT * FROM visible ORDER BY sequence DESC LIMIT p_limit)
  SELECT jsonb_build_object(
    'events',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',sequence::text,'occurred_at',occurred_at,'module',module,'feature',feature,
      'action',action,'source_table',source_table,'source_id',source_id,'title',title,
      'actor_id',actor_user_id,'owner_id',owner_user_id,
      'actor_name',CASE WHEN actor_user_id IS NULL AND module = 'guests' THEN 'Guest portal'
        WHEN actor_user_id IS NULL THEN 'System'
        WHEN actor_user_id = viewer THEN 'You'
        ELSE coalesce((SELECT full_name FROM public.profiles WHERE id = actor_user_id),'Partner') END,
      'changed_fields',changed_fields,
      'available',NOT coalesce((public.activity_log_current(source_table,source_id)->>'_deleted')::boolean,false)
        AND public.activity_log_current(source_table,source_id)->>'deleted_at' IS NULL,
      'parent_id',CASE WHEN source_table LIKE 'trip_%' THEN context->>'trip_id'
        WHEN source_table IN ('hub_messages','hub_notes_topics','shopping_groups') THEN context->>'thread_id'
        WHEN source_table = 'item_subtasks' THEN context->>'parent_item_id'
        WHEN source_table LIKE 'item_%' OR source_table IN ('reminder_details','event_details','recurrence_pauses') THEN context->>'item_id'
        ELSE NULL END
    ) ORDER BY sequence DESC) FROM page),'[]'::jsonb),
    'next_cursor',CASE WHEN (SELECT count(*) FROM visible) > p_limit THEN (SELECT min(sequence)::text FROM page) ELSE NULL END,
    'viewer_id',viewer,
    'recording_since',(SELECT min(occurred_at) FROM public.household_activity WHERE owner_user_id = viewer),
    'sources',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',s.table_name,'module',s.module,'feature',s.feature,'label',s.label) ORDER BY s.module,s.feature),'[]'::jsonb)
      FROM public.activity_log_sources s WHERE EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid = to_regclass(format('public.%I',s.table_name)) AND t.tgname = 'capture_household_activity' AND t.tgenabled <> 'D'
      ))
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.activity_log_context(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_log_current(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_log_owner(text,jsonb,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_log_visible(text,jsonb,uuid,uuid,uuid,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_household_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_household_activity(text,text,text,timestamptz,timestamptz,bigint,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_household_activity(text,text,text,timestamptz,timestamptz,bigint,int) TO authenticated;
COMMIT;

-- Owner-only recovery if recording blocks a module write: pause ONLY these
-- capture triggers, preserving both source data and recorded history. Run this
-- commented block separately after removing its leading '-- '. Reapply the
-- corrected migration to resume capture. Do not drop source tables or history.
-- DO $$ DECLARE s record; BEGIN
--   FOR s IN SELECT table_name FROM public.activity_log_sources LOOP
--     IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
--       WHERE tgrelid = to_regclass(format('public.%I',s.table_name))
--         AND tgname = 'capture_household_activity') THEN
--       EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER capture_household_activity',s.table_name);
--     END IF;
--   END LOOP;
-- END $$;
