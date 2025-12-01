-- Migration: Fix data consistency issues
-- Run this after 001-add-quantity-returned.sql

-- Fix any NULL payment_status values
UPDATE sales SET payment_status = 'unpaid' WHERE payment_status IS NULL;

-- Fix any NULL amount_paid values
UPDATE sales SET amount_paid = '0' WHERE amount_paid IS NULL;

-- Fix any negative stock quantities
UPDATE colors SET stock_quantity = 0 WHERE stock_quantity < 0;

-- Recalculate payment status based on amounts
UPDATE sales 
SET payment_status = CASE
  WHEN CAST(amount_paid AS REAL) >= CAST(total_amount AS REAL) THEN 'paid'
  WHEN CAST(amount_paid AS REAL) > 0 THEN 'partial'
  ELSE 'unpaid'
END
WHERE payment_status NOT IN ('paid', 'partial', 'unpaid', 'full_return');

-- Update quantity_returned from return_items for all sale_items
UPDATE sale_items 
SET quantity_returned = COALESCE(
  (SELECT SUM(ri.quantity) 
   FROM return_items ri 
   WHERE ri.sale_item_id = sale_items.id), 
  0
);

-- Create missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_customer_phone ON sales(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_history_customer ON payment_history(customer_phone);
CREATE INDEX IF NOT EXISTS idx_returns_customer_phone ON returns(customer_phone);
CREATE INDEX IF NOT EXISTS idx_colors_stock ON colors(stock_quantity);
