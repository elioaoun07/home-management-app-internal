-- Migration: Home Inventory System
-- Extends the catalogue system to support barcode-scanned inventory tracking
-- Auto-adds items to shopping list when stock runs low based on consumption rate

-- =============================================================================
-- PART 1: ADD 'inventory' TO CATALOGUE MODULE TYPE ENUM
-- =============================================================================

-- Add 'inventory' to the catalogue_module_type enum if it doesn't exist
DO $$ 
BEGIN
  -- Check if 'inventory' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'inventory' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'catalogue_module_type')
  ) THEN
    ALTER TYPE catalogue_module_type ADD VALUE 'inventory';
  END IF;
END $$;

-- =============================================================================
-- PART 2: INVENTORY STOCK TABLE
-- =============================================================================

-- Tracks current stock levels for catalogue items in the inventory module
-- Separated from catalogue_items to keep product master data clean
CREATE TABLE IF NOT EXISTS public.inventory_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  
  -- Current stock level
  quantity_on_hand numeric NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  
  -- Restocking tracking
  last_restocked_at timestamp with time zone DEFAULT now(),
  last_restocked_quantity numeric,
  
  -- Computed/cached for quick queries and notifications
  estimated_runout_date date,
  
  -- Shopping list integration
  auto_add_to_shopping boolean NOT NULL DEFAULT true,
  shopping_thread_id uuid,  -- Which shopping thread to add to
  shopping_message_id uuid, -- Current auto-added message (if any)
  last_added_to_shopping_at timestamp with time zone,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT inventory_stock_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_stock_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT inventory_stock_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.catalogue_items(id) ON DELETE CASCADE,
  CONSTRAINT inventory_stock_unique_item UNIQUE (user_id, item_id)
);

-- =============================================================================
-- PART 3: INVENTORY RESTOCK HISTORY (for tracking patterns)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_restock_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stock_id uuid NOT NULL,
  item_id uuid NOT NULL,
  
  -- Restock details
  quantity_added numeric NOT NULL,
  quantity_before numeric NOT NULL DEFAULT 0,
  quantity_after numeric NOT NULL,
  
  -- Source of restock
  source text NOT NULL DEFAULT 'manual', -- 'manual', 'shopping_checkout', 'bulk_import'
  
  -- Timestamps
  restocked_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT inventory_restock_history_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_restock_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT inventory_restock_history_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.inventory_stock(id) ON DELETE CASCADE,
  CONSTRAINT inventory_restock_history_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.catalogue_items(id) ON DELETE CASCADE
);

-- =============================================================================
-- PART 4: EXTEND HUB_MESSAGES FOR INVENTORY SOURCE TRACKING
-- =============================================================================

-- Add source column to track where the shopping item came from
ALTER TABLE public.hub_messages 
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'user';

-- Add reference to the inventory item that triggered this shopping message
ALTER TABLE public.hub_messages 
  ADD COLUMN IF NOT EXISTS source_item_id uuid;

-- Add foreign key constraint (if table exists and column was just added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'hub_messages_source_item_id_fkey'
  ) THEN
    ALTER TABLE public.hub_messages 
      ADD CONSTRAINT hub_messages_source_item_id_fkey 
      FOREIGN KEY (source_item_id) REFERENCES public.catalogue_items(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- Add check constraint for valid source values
DO $$
BEGIN
  ALTER TABLE public.hub_messages 
    ADD CONSTRAINT hub_messages_source_check 
    CHECK (source IN ('user', 'inventory', 'system', 'ai'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 5: INDEXES
-- =============================================================================

-- Inventory stock indexes
CREATE INDEX IF NOT EXISTS idx_inventory_stock_user_id 
  ON public.inventory_stock(user_id);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_item_id 
  ON public.inventory_stock(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_runout 
  ON public.inventory_stock(estimated_runout_date) 
  WHERE estimated_runout_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_stock_low_stock 
  ON public.inventory_stock(user_id, estimated_runout_date) 
  WHERE auto_add_to_shopping = true AND estimated_runout_date IS NOT NULL;

-- Restock history indexes
CREATE INDEX IF NOT EXISTS idx_inventory_restock_history_stock_id 
  ON public.inventory_restock_history(stock_id);

CREATE INDEX IF NOT EXISTS idx_inventory_restock_history_item_id 
  ON public.inventory_restock_history(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_restock_history_date 
  ON public.inventory_restock_history(restocked_at DESC);

-- Barcode lookup index on catalogue_items (using JSONB extraction)
CREATE INDEX IF NOT EXISTS idx_catalogue_items_barcode 
  ON public.catalogue_items((metadata_json->>'barcode')) 
  WHERE metadata_json->>'barcode' IS NOT NULL;

-- Hub messages source index
CREATE INDEX IF NOT EXISTS idx_hub_messages_source 
  ON public.hub_messages(source) 
  WHERE source != 'user';

CREATE INDEX IF NOT EXISTS idx_hub_messages_source_item 
  ON public.hub_messages(source_item_id) 
  WHERE source_item_id IS NOT NULL;

-- =============================================================================
-- PART 6: ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_restock_history ENABLE ROW LEVEL SECURITY;

-- Inventory stock policies
CREATE POLICY "Users can view own inventory stock"
  ON public.inventory_stock FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inventory stock"
  ON public.inventory_stock FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inventory stock"
  ON public.inventory_stock FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own inventory stock"
  ON public.inventory_stock FOR DELETE
  USING (auth.uid() = user_id);

-- Restock history policies
CREATE POLICY "Users can view own restock history"
  ON public.inventory_restock_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own restock history"
  ON public.inventory_restock_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No update/delete on history - it's an audit log

-- =============================================================================
-- PART 7: FUNCTIONS
-- =============================================================================

-- Function to calculate estimated runout date based on consumption rate
CREATE OR REPLACE FUNCTION calculate_inventory_runout_date(
  p_quantity_on_hand numeric,
  p_consumption_rate_days integer,
  p_last_restocked_at timestamp with time zone DEFAULT now()
)
RETURNS date AS $$
BEGIN
  IF p_consumption_rate_days IS NULL OR p_consumption_rate_days <= 0 THEN
    RETURN NULL;
  END IF;
  
  IF p_quantity_on_hand IS NULL OR p_quantity_on_hand <= 0 THEN
    RETURN CURRENT_DATE;
  END IF;
  
  -- Runout = last restock + (quantity × days per unit)
  RETURN (p_last_restocked_at + (p_quantity_on_hand * p_consumption_rate_days * INTERVAL '1 day'))::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update stock and recalculate runout date
CREATE OR REPLACE FUNCTION update_inventory_stock_runout()
RETURNS TRIGGER AS $$
DECLARE
  v_consumption_rate_days integer;
BEGIN
  -- Get consumption rate from the linked catalogue item
  SELECT (metadata_json->>'consumption_rate_days')::integer
  INTO v_consumption_rate_days
  FROM public.catalogue_items
  WHERE id = NEW.item_id;
  
  -- Calculate new runout date
  NEW.estimated_runout_date := calculate_inventory_runout_date(
    NEW.quantity_on_hand,
    v_consumption_rate_days,
    NEW.last_restocked_at
  );
  
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update runout date on stock changes
DROP TRIGGER IF EXISTS trigger_inventory_stock_runout ON public.inventory_stock;
CREATE TRIGGER trigger_inventory_stock_runout
  BEFORE INSERT OR UPDATE OF quantity_on_hand, last_restocked_at
  ON public.inventory_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_stock_runout();

-- Function to restock an item and record history
CREATE OR REPLACE FUNCTION restock_inventory_item(
  p_user_id uuid,
  p_item_id uuid,
  p_quantity_to_add numeric,
  p_source text DEFAULT 'manual'
)
RETURNS public.inventory_stock AS $$
DECLARE
  v_stock public.inventory_stock;
  v_quantity_before numeric;
BEGIN
  -- Get or create stock record
  SELECT * INTO v_stock
  FROM public.inventory_stock
  WHERE user_id = p_user_id AND item_id = p_item_id;
  
  IF v_stock IS NULL THEN
    -- Create new stock record
    INSERT INTO public.inventory_stock (user_id, item_id, quantity_on_hand, last_restocked_at, last_restocked_quantity)
    VALUES (p_user_id, p_item_id, p_quantity_to_add, now(), p_quantity_to_add)
    RETURNING * INTO v_stock;
    
    v_quantity_before := 0;
  ELSE
    v_quantity_before := v_stock.quantity_on_hand;
    
    -- Update existing stock
    UPDATE public.inventory_stock
    SET 
      quantity_on_hand = quantity_on_hand + p_quantity_to_add,
      last_restocked_at = now(),
      last_restocked_quantity = p_quantity_to_add,
      shopping_message_id = NULL,  -- Clear the auto-added shopping reference
      last_added_to_shopping_at = NULL
    WHERE id = v_stock.id
    RETURNING * INTO v_stock;
  END IF;
  
  -- Record in history
  INSERT INTO public.inventory_restock_history (
    user_id, stock_id, item_id, 
    quantity_added, quantity_before, quantity_after, 
    source
  ) VALUES (
    p_user_id, v_stock.id, p_item_id,
    p_quantity_to_add, v_quantity_before, v_stock.quantity_on_hand,
    p_source
  );
  
  RETURN v_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get items that need to be added to shopping list
CREATE OR REPLACE FUNCTION get_low_stock_items(
  p_user_id uuid,
  p_days_threshold integer DEFAULT 7  -- Items running out within X days
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  barcode text,
  quantity_on_hand numeric,
  estimated_runout_date date,
  days_until_runout integer,
  unit_size text,
  already_in_shopping boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id AS item_id,
    ci.name AS item_name,
    ci.metadata_json->>'barcode' AS barcode,
    ist.quantity_on_hand,
    ist.estimated_runout_date,
    (ist.estimated_runout_date - CURRENT_DATE)::integer AS days_until_runout,
    ci.metadata_json->>'unit_size' AS unit_size,
    (ist.shopping_message_id IS NOT NULL) AS already_in_shopping
  FROM public.inventory_stock ist
  JOIN public.catalogue_items ci ON ci.id = ist.item_id
  WHERE ist.user_id = p_user_id
    AND ist.auto_add_to_shopping = true
    AND ist.estimated_runout_date IS NOT NULL
    AND ist.estimated_runout_date <= (CURRENT_DATE + p_days_threshold)
  ORDER BY ist.estimated_runout_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find catalogue item by barcode
CREATE OR REPLACE FUNCTION find_item_by_barcode(
  p_user_id uuid,
  p_barcode text
)
RETURNS public.catalogue_items AS $$
DECLARE
  v_item public.catalogue_items;
BEGIN
  SELECT * INTO v_item
  FROM public.catalogue_items
  WHERE user_id = p_user_id
    AND metadata_json->>'barcode' = p_barcode
  LIMIT 1;
  
  RETURN v_item;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 8: UPDATE INITIALIZE FUNCTION TO INCLUDE INVENTORY MODULE
-- =============================================================================

-- Update the initialize function to include inventory module
CREATE OR REPLACE FUNCTION initialize_catalogue_modules(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert default modules if they don't exist
  INSERT INTO public.catalogue_modules (user_id, type, name, description, icon, color, gradient_from, gradient_to, is_system, position)
  VALUES
    (p_user_id, 'budget', 'Budget & Wishlist', 'Track desired purchases and savings goals', 'wallet', '#10b981', '#10b981', '#059669', true, 0),
    (p_user_id, 'tasks', 'Tasks', 'Organize personal, work, and home tasks', 'check-square', '#8b5cf6', '#8b5cf6', '#7c3aed', true, 1),
    (p_user_id, 'recipe', 'Recipes', 'Meal planning and recipe collection', 'chef-hat', '#f59e0b', '#f59e0b', '#d97706', true, 2),
    (p_user_id, 'healthcare', 'Healthcare', 'Doctors, appointments, and health tracking', 'heart-pulse', '#ef4444', '#ef4444', '#dc2626', true, 3),
    (p_user_id, 'trips', 'Trips & Travel', 'Dream destinations and journey planning', 'plane', '#06b6d4', '#06b6d4', '#0891b2', true, 4),
    (p_user_id, 'fitness', 'Fitness', 'Workout routines and exercise tracking', 'dumbbell', '#ec4899', '#ec4899', '#db2777', true, 5),
    (p_user_id, 'learning', 'Learning & Skills', 'Track skills, courses, and practice progress', 'graduation-cap', '#6366f1', '#6366f1', '#4f46e5', true, 6),
    (p_user_id, 'contacts', 'Contacts', 'Important contacts organized by category', 'users', '#14b8a6', '#14b8a6', '#0d9488', true, 7),
    (p_user_id, 'documents', 'Documents', 'Track important documents and expiry dates', 'file-text', '#64748b', '#64748b', '#475569', true, 8),
    (p_user_id, 'inventory', 'Home Inventory', 'Track household essentials and auto-add to shopping when low', 'package', '#f97316', '#f97316', '#ea580c', true, 9)
  ON CONFLICT (user_id, type, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 9: COMMENTS
-- =============================================================================

COMMENT ON TABLE public.inventory_stock IS 'Tracks current stock levels for inventory catalogue items';
COMMENT ON TABLE public.inventory_restock_history IS 'Audit log of all restocking events for analytics';

COMMENT ON COLUMN public.inventory_stock.quantity_on_hand IS 'Current quantity in stock (units defined by item)';
COMMENT ON COLUMN public.inventory_stock.estimated_runout_date IS 'Auto-calculated based on quantity and consumption rate';
COMMENT ON COLUMN public.inventory_stock.auto_add_to_shopping IS 'Whether to auto-add to shopping list when running low';
COMMENT ON COLUMN public.inventory_stock.shopping_message_id IS 'Reference to auto-created shopping list message';

COMMENT ON COLUMN public.hub_messages.source IS 'Origin of the message: user, inventory (auto-added), system, ai';
COMMENT ON COLUMN public.hub_messages.source_item_id IS 'Reference to catalogue item if added from inventory';

COMMENT ON FUNCTION calculate_inventory_runout_date IS 'Calculates when stock will run out based on consumption rate';
COMMENT ON FUNCTION restock_inventory_item IS 'Adds stock to an item and records in history';
COMMENT ON FUNCTION get_low_stock_items IS 'Returns items running low within specified days threshold';
COMMENT ON FUNCTION find_item_by_barcode IS 'Finds a catalogue item by its barcode';

-- =============================================================================
-- METADATA_JSON SCHEMA DOCUMENTATION FOR INVENTORY ITEMS
-- =============================================================================

/*
For catalogue_items in the 'inventory' module, metadata_json should contain:

{
  "barcode": "5285000328841",           -- Scanned barcode (EAN/UPC)
  "unit_type": "pack",                  -- 'count' | 'weight' | 'volume' | 'pack' | 'custom'
  "unit_size": "6 rolls",               -- Human-readable unit description
  "unit_value": 6,                      -- Numeric value for calculations
  "unit_measure": "rolls",              -- Unit of measure
  "consumption_rate_days": 45,          -- Days per unit (how long one unit lasts)
  "minimum_stock": 1,                   -- Alert when stock falls below this
  "typical_purchase_quantity": 1,       -- How many you usually buy at once
  "preferred_store": "Spinneys",        -- Optional: where you usually buy this
  "notes": "Get the scented ones"       -- Optional: purchase notes
}

Example items:
- Toilet Paper 6-pack: { "unit_type": "pack", "unit_size": "6 rolls", "consumption_rate_days": 45 }
- Salt 1kg: { "unit_type": "weight", "unit_size": "1kg", "consumption_rate_days": 365 }
- Milk 1L: { "unit_type": "volume", "unit_size": "1L", "consumption_rate_days": 4 }
- Bread loaf: { "unit_type": "count", "unit_size": "1 loaf", "consumption_rate_days": 3 }
*/
