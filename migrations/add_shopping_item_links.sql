-- ============================================
-- SHOPPING ITEM MULTI-LINK SUPPORT
-- Migration: add_shopping_item_links.sql
-- ============================================
-- Enables multiple product links per shopping item with AI-scraped product info
-- (price, stock availability, product title, store name, image URL)

-- 1. Create shopping_item_links table for multi-link support
CREATE TABLE IF NOT EXISTS public.shopping_item_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL, -- The shopping item (hub_messages)
  user_id uuid NOT NULL,    -- Who added this link
  url text NOT NULL,
  store_name text,          -- Extracted or user-provided store name
  product_title text,       -- Scraped product title
  price numeric,            -- Scraped price (in original currency)
  currency text DEFAULT 'USD', -- Price currency
  stock_status text,        -- 'in_stock', 'out_of_stock', 'low_stock', 'unknown'
  stock_quantity integer,   -- If available, actual stock count
  image_url text,           -- Product image URL
  extra_info jsonb,         -- Any additional scraped data
  last_fetched_at timestamp with time zone,
  fetch_error text,         -- Last error if fetch failed
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shopping_item_links_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_item_links_message_id_fkey FOREIGN KEY (message_id) 
    REFERENCES public.hub_messages(id) ON DELETE CASCADE,
  CONSTRAINT shopping_item_links_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_shopping_item_links_message_id 
  ON public.shopping_item_links(message_id);

CREATE INDEX IF NOT EXISTS idx_shopping_item_links_user_id 
  ON public.shopping_item_links(user_id);

-- 3. Unique constraint: one URL per message
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_item_links_unique_url 
  ON public.shopping_item_links(message_id, url);

-- 4. Enable RLS
ALTER TABLE public.shopping_item_links ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - users can access links for items in their household
CREATE POLICY "Users can view links for their household items"
  ON public.shopping_item_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hub_messages m
      JOIN public.hub_chat_threads t ON m.thread_id = t.id
      JOIN public.household_links h ON t.household_id = h.id
      WHERE m.id = shopping_item_links.message_id
        AND (h.owner_user_id = auth.uid() OR h.partner_user_id = auth.uid())
        AND h.active = true
    )
  );

CREATE POLICY "Users can insert links for their household items"
  ON public.shopping_item_links
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.hub_messages m
      JOIN public.hub_chat_threads t ON m.thread_id = t.id
      JOIN public.household_links h ON t.household_id = h.id
      WHERE m.id = shopping_item_links.message_id
        AND (h.owner_user_id = auth.uid() OR h.partner_user_id = auth.uid())
        AND h.active = true
    )
  );

CREATE POLICY "Users can update their own links"
  ON public.shopping_item_links
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own links"
  ON public.shopping_item_links
  FOR DELETE
  USING (user_id = auth.uid());

-- 6. Add has_multiple_links flag to hub_messages for quick filtering
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS has_links boolean DEFAULT false;

-- 7. Create function to update has_links flag on hub_messages
CREATE OR REPLACE FUNCTION update_message_has_links()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.hub_messages 
    SET has_links = true 
    WHERE id = NEW.message_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.hub_messages 
    SET has_links = EXISTS (
      SELECT 1 FROM public.shopping_item_links 
      WHERE message_id = OLD.message_id
    )
    WHERE id = OLD.message_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for has_links updates
DROP TRIGGER IF EXISTS trigger_update_message_has_links ON public.shopping_item_links;
CREATE TRIGGER trigger_update_message_has_links
AFTER INSERT OR DELETE ON public.shopping_item_links
FOR EACH ROW EXECUTE FUNCTION update_message_has_links();

-- 9. Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shopping_item_links'
  ) THEN
    RAISE NOTICE '✅ shopping_item_links table created successfully';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'hub_messages' 
    AND column_name = 'has_links'
  ) THEN
    RAISE NOTICE '✅ has_links column added to hub_messages';
  END IF;
END $$;
