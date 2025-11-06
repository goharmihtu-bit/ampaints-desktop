// Database migration utilities for ensuring schema compatibility
import Database from "better-sqlite3";

/**
 * Migrates an imported database to the latest schema
 * This ensures backward compatibility when importing older database backups
 */
export function migrateDatabase(db: Database.Database): void {
  console.log('[Migration] Starting database schema migration...');
  
  try {
    // Check and add missing columns to sales table (added in v0.1.7)
    const salesColumns = db.pragma('table_info(sales)') as Array<{ name: string; type: string }>;
    const salesColumnNames = salesColumns.map((col) => col.name);
    
    console.log('[Migration] Current sales columns:', salesColumnNames);
    
    // Add dueDate column if missing
    if (!salesColumnNames.includes('due_date')) {
      console.log('[Migration] Adding due_date column to sales table');
      db.exec('ALTER TABLE sales ADD COLUMN due_date INTEGER');
    }
    
    // Add isManualBalance column if missing
    if (!salesColumnNames.includes('is_manual_balance')) {
      console.log('[Migration] Adding is_manual_balance column to sales table');
      db.exec('ALTER TABLE sales ADD COLUMN is_manual_balance INTEGER NOT NULL DEFAULT 0');
    }
    
    // Add notes column if missing
    if (!salesColumnNames.includes('notes')) {
      console.log('[Migration] Adding notes column to sales table');
      db.exec('ALTER TABLE sales ADD COLUMN notes TEXT');
    }
    
    // Check and add missing columns to colors table (added in v0.1.8)
    const colorsColumns = db.pragma('table_info(colors)') as Array<{ name: string; type: string }>;
    const colorsColumnNames = colorsColumns.map((col) => col.name);
    
    console.log('[Migration] Current colors columns:', colorsColumnNames);
    
    // Add rateOverride column if missing
    if (!colorsColumnNames.includes('rate_override')) {
      console.log('[Migration] Adding rate_override column to colors table');
      db.exec('ALTER TABLE colors ADD COLUMN rate_override TEXT');
    }
    
    // Ensure all indexes exist (CREATE INDEX IF NOT EXISTS is safe)
    console.log('[Migration] Creating/verifying indexes...');
    db.exec(`
      -- Product indexes for fast lookups with duplicates
      CREATE INDEX IF NOT EXISTS idx_products_company_name ON products(company, product_name);
      CREATE INDEX IF NOT EXISTS idx_products_company ON products(company);
      
      -- Variant indexes for fast lookups with duplicates
      CREATE INDEX IF NOT EXISTS idx_variants_product_created ON variants(product_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_variants_product_packing_rate ON variants(product_id, packing_size, rate);
      CREATE INDEX IF NOT EXISTS idx_variants_packing_size ON variants(packing_size);
      
      -- Color indexes for fast lookups with duplicates
      CREATE INDEX IF NOT EXISTS idx_colors_variant_created ON colors(variant_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_colors_variant_code ON colors(variant_id, color_code);
      CREATE INDEX IF NOT EXISTS idx_colors_code_lookup ON colors(color_code);
      CREATE INDEX IF NOT EXISTS idx_colors_name_lookup ON colors(color_name);
      CREATE INDEX IF NOT EXISTS idx_colors_code_name ON colors(color_code, color_name);
      
      -- Sales indexes
      CREATE INDEX IF NOT EXISTS idx_sales_phone_status ON sales(customer_phone, payment_status);
      CREATE INDEX IF NOT EXISTS idx_sales_status_created ON sales(payment_status, created_at);
      
      -- Sale items indexes
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale_color ON sale_items(sale_id, color_id);
    `);
    
    console.log('[Migration] ✅ Database migration completed successfully');
  } catch (error) {
    console.error('[Migration] ❌ ERROR during migration:', error);
    throw error;
  }
}
