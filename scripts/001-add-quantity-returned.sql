-- Migration: Add quantityReturned column to sale_items table
-- This tracks how many items have already been returned from each sale item
-- This migration is safe to run multiple times (idempotent)

-- Check if column exists before adding (SQLite doesn't have IF NOT EXISTS for ALTER)
-- The application code handles this check, but this script can still be run manually

-- Add the new column with default value of 0
-- If this fails with "duplicate column name", it means the column already exists
ALTER TABLE sale_items ADD COLUMN quantity_returned INTEGER NOT NULL DEFAULT 0;

-- Backfill existing data: Calculate quantityReturned from return_items table
UPDATE sale_items 
SET quantity_returned = COALESCE(
  (SELECT SUM(quantity) FROM return_items WHERE return_items.sale_item_id = sale_items.id),
  0
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sale_items_quantity_returned ON sale_items(quantity_returned);
