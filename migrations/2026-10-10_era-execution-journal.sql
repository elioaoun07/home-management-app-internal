-- WHAT: Owner-scoped, versioned ERA agent execution journal. No source data changes.
-- RUN: Owner applies manually in Supabase SQL Editor before enabling
-- NEXT_PUBLIC_ERA_DURABLE_EXECUTION=true. Safe to rerun. Agents never apply this.
-- PREREQUISITE: era_actions exists with the entity/verb contract from
-- 2026-10-04_era-artifacts-any-entity.sql (HUB-91 owner rollout).
BEGIN;
CREATE TABLE IF NOT EXISTS public.era_runs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  conversation_id uuid NOT NULL REFERENCES public.era_conversations(id),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  status text NOT NULL CHECK (status IN ('awaiting_confirm','queued','running','waiting','blocked','uncertain','done','partial','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS era_runs_owner_conversation_idx
  ON public.era_runs (user_id, conversation_id, status, created_at DESC);
ALTER TABLE public.era_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='era_runs' AND policyname='era_runs_self_read') THEN
    CREATE POLICY era_runs_self_read ON public.era_runs FOR SELECT
      TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
-- Only the CAS function writes. Denormalized user_id keeps the read policy cheap.
REVOKE ALL ON public.era_runs FROM anon, authenticated;
GRANT SELECT ON public.era_runs TO authenticated;

CREATE OR REPLACE FUNCTION public.save_era_run(
  p_id uuid, p_conversation_id uuid, p_version integer, p_state jsonb, p_artifacts jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.era_runs; v_household uuid; v_artifact jsonb; v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
  IF p_state IS NULL OR jsonb_typeof(p_state) <> 'object'
    OR octet_length(p_state::text) > 262144 THEN
    RAISE EXCEPTION 'Invalid state' USING ERRCODE='22023';
  END IF;
  -- Conversations and execution/consent are private even when source entities
  -- are shared with the household. Never borrow the partner's confirmation.
  PERFORM 1 FROM public.era_conversations WHERE id=p_conversation_id AND user_id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found' USING ERRCODE='42501'; END IF;
  IF coalesce((p_state->>'cancelled')::boolean,false) THEN v_status := 'cancelled';
  ELSIF NOT coalesce((p_state->>'confirmed')::boolean,false) THEN v_status := 'awaiting_confirm';
  ELSE
    SELECT value->>'status' INTO v_status FROM jsonb_array_elements(p_state->'steps') WITH ORDINALITY
      WHERE value->>'status' NOT IN ('done','skipped') ORDER BY ordinality LIMIT 1;
    IF v_status IS NULL THEN
      v_status := CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'steps') WHERE value->>'status'='skipped') THEN 'partial' ELSE 'done' END;
    END IF;
  END IF;
  IF p_version = -1 THEN
    INSERT INTO public.era_runs(id,user_id,conversation_id,state,status)
      VALUES(p_id,v_uid,p_conversation_id,p_state,v_status) RETURNING * INTO v_row;
  ELSE
    UPDATE public.era_runs SET state=p_state, status=v_status, version=version+1, updated_at=now()
      WHERE id=p_id AND user_id=v_uid AND conversation_id=p_conversation_id
        AND version=p_version RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Execution changed' USING ERRCODE='40001'; END IF;
  END IF;
  -- Receipts and their Artifact projection commit together. The stable key
  -- prevents a resumed/checkpointed receipt from producing duplicate log rows.
  SELECT id INTO v_household FROM public.household_links
    WHERE active AND (owner_user_id=v_uid OR partner_user_id=v_uid)
    ORDER BY created_at DESC LIMIT 1;
  FOR v_artifact IN SELECT value FROM jsonb_array_elements(p_artifacts) LOOP
    INSERT INTO public.era_actions(id,user_id,household_id,action,entity_type,entity_id,title,route)
      VALUES (md5(p_id::text || ':' || (v_artifact->>'key'))::uuid, v_uid, v_household,
        v_artifact->>'action', v_artifact->>'entity', (v_artifact->>'id')::uuid,
        v_artifact->>'title', v_artifact->>'route')
      ON CONFLICT (id) DO NOTHING;
  END LOOP;
  RETURN to_jsonb(v_row);
END $$;
REVOKE ALL ON FUNCTION public.save_era_run(uuid,uuid,integer,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_era_run(uuid,uuid,integer,jsonb,jsonb) TO authenticated;
COMMIT;

-- Owner verification (metadata only):
-- SELECT relrowsecurity FROM pg_class WHERE oid='public.era_runs'::regclass;
-- SELECT policyname,cmd,qual FROM pg_policies WHERE tablename='era_runs';
-- Refresh migrations/db-state.json using migrations/db-state.sql after applying.
