-- Migration: NFC Checklist Items + Completions + RLS Policies
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. New tables
-- ============================================

CREATE TABLE public.nfc_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  state text NOT NULL,
  title text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  source_tag_id uuid,
  source_state text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nfc_checklist_items_pkey PRIMARY KEY (id),
  CONSTRAINT nfc_checklist_items_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.nfc_tags(id) ON DELETE CASCADE,
  CONSTRAINT nfc_checklist_items_source_tag_id_fkey FOREIGN KEY (source_tag_id) REFERENCES public.nfc_tags(id) ON DELETE SET NULL
);

CREATE INDEX idx_nfc_checklist_items_tag_state ON public.nfc_checklist_items (tag_id, state) WHERE is_active = true;

CREATE TABLE public.nfc_checklist_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL,
  state_log_id uuid NOT NULL,
  completed_by uuid NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nfc_checklist_completions_pkey PRIMARY KEY (id),
  CONSTRAINT nfc_checklist_completions_item_fkey FOREIGN KEY (checklist_item_id) REFERENCES public.nfc_checklist_items(id) ON DELETE CASCADE,
  CONSTRAINT nfc_checklist_completions_log_fkey FOREIGN KEY (state_log_id) REFERENCES public.nfc_state_log(id) ON DELETE CASCADE,
  CONSTRAINT nfc_checklist_completions_user_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id),
  CONSTRAINT nfc_checklist_completions_unique UNIQUE (checklist_item_id, state_log_id)
);

-- ============================================
-- 2. Migrate existing JSONB checklists → new table
-- ============================================
-- This migrates any existing checklist data from nfc_tags.checklists jsonb column
INSERT INTO public.nfc_checklist_items (tag_id, state, title, order_index)
SELECT
  t.id AS tag_id,
  state_key AS state,
  (item->>'title')::text AS title,
  COALESCE((item->>'order')::integer, idx) AS order_index
FROM public.nfc_tags t,
  jsonb_each(t.checklists) AS kv(state_key, state_items),
  jsonb_array_elements(state_items) WITH ORDINALITY AS arr(item, idx)
WHERE t.checklists IS NOT NULL
  AND t.checklists != '{}'::jsonb;

-- ============================================
-- 3. RLS policies
-- ============================================

ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_state_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_checklist_completions ENABLE ROW LEVEL SECURITY;

-- nfc_tags
CREATE POLICY "nfc_tags_select" ON public.nfc_tags FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = nfc_tags.user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = nfc_tags.user_id)
    )
  )
);
CREATE POLICY "nfc_tags_insert" ON public.nfc_tags FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "nfc_tags_update" ON public.nfc_tags FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = nfc_tags.user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = nfc_tags.user_id)
    )
  )
);
CREATE POLICY "nfc_tags_delete" ON public.nfc_tags FOR DELETE USING (user_id = auth.uid());

-- nfc_state_log
CREATE POLICY "nfc_state_log_select" ON public.nfc_state_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_state_log.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_state_log_insert" ON public.nfc_state_log FOR INSERT WITH CHECK (changed_by = auth.uid());

-- nfc_checklist_items
CREATE POLICY "nfc_checklist_items_select" ON public.nfc_checklist_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_checklist_items.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_checklist_items_insert" ON public.nfc_checklist_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_checklist_items.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_checklist_items_update" ON public.nfc_checklist_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_checklist_items.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_checklist_items_delete" ON public.nfc_checklist_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_checklist_items.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);

-- nfc_checklist_completions
CREATE POLICY "nfc_checklist_completions_select" ON public.nfc_checklist_completions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.nfc_checklist_items ci
    JOIN public.nfc_tags t ON t.id = ci.tag_id
    WHERE ci.id = nfc_checklist_completions.checklist_item_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_checklist_completions_insert" ON public.nfc_checklist_completions FOR INSERT WITH CHECK (completed_by = auth.uid());
CREATE POLICY "nfc_checklist_completions_delete" ON public.nfc_checklist_completions FOR DELETE USING (completed_by = auth.uid());
