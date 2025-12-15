-- Migration: Add back item_categories junction table
-- Date: 2025-12-15
-- Description: Recreates the item_categories table for many-to-many relationship between items and categories

-- Create the item_categories junction table
CREATE TABLE IF NOT EXISTS item_categories (
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  category_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (item_id, category_id)
);

-- Enable RLS
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own item categories"
  ON item_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_categories.item_id
      AND items.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own item categories"
  ON item_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_categories.item_id
      AND items.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own item categories"
  ON item_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_categories.item_id
      AND items.user_id = auth.uid()
    )
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_item_categories_item_id ON item_categories(item_id);
CREATE INDEX IF NOT EXISTS idx_item_categories_category_id ON item_categories(category_id);
