// migrations.ts
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
    
    // Check and add missing columns to stock_in_history table (added in v0.2.0)
    const stockHistoryColumns = db.pragma('table_info(stock_in_history)') as Array<{ name: string; type: string }>;
    const stockHistoryColumnNames = stockHistoryColumns.map((col) => col.name);
    
    console.log('[Migration] Current stock_in_history columns:', stockHistoryColumnNames);
    
    // Add stock_in_date column if missing - FIXED: This was causing the error
    if (!stockHistoryColumnNames.includes('stock_in_date')) {
      console.log('[Migration] Adding stock_in_date column to stock_in_history table');
      db.exec('ALTER TABLE stock_in_history ADD COLUMN stock_in_date TEXT');
      
      // Set default value for existing records (current date in DD-MM-YYYY format)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const defaultDate = `${day}-${month}-${year}`;
      
      console.log('[Migration] Setting default stock_in_date for existing records:', defaultDate);
      db.exec(`UPDATE stock_in_history SET stock_in_date = '${defaultDate}' WHERE stock_in_date IS NULL`);
    }
    
    // Create settings table if it doesn't exist (added in v0.1.9)
    console.log('[Migration] Creating/verifying settings table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        store_name TEXT NOT NULL DEFAULT 'PaintPulse',
        card_border_style TEXT NOT NULL DEFAULT 'shadow',
        card_shadow_size TEXT NOT NULL DEFAULT 'sm',
        card_button_color TEXT NOT NULL DEFAULT 'gray-900',
        card_price_color TEXT NOT NULL DEFAULT 'blue-600',
        show_stock_badge_border INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);
    
    // Insert default settings row if not exists
    const settingsExists = db.prepare('SELECT COUNT(*) as count FROM settings WHERE id = ?').get('default') as { count: number };
    if (settingsExists.count === 0) {
      console.log('[Migration] Inserting default settings row');
      db.prepare(`
        INSERT INTO settings (id, store_name, card_border_style, card_shadow_size, card_button_color, card_price_color, show_stock_badge_border, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('default', 'PaintPulse', 'shadow', 'sm', 'gray-900', 'blue-600', 0, Date.now());
    }
    
    // Ensure all indexes exist (CREATE INDEX IF NOT EXISTS is safe)
    console.log('[Migration] Creating/verifying indexes...');
    
    // Product indexes for fast lookups with duplicates
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_company_name ON products(company, product_name)');
    } catch (e) { console.log('[Migration] Index already exists: idx_products_company_name'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_company ON products(company)');
    } catch (e) { console.log('[Migration] Index already exists: idx_products_company'); }
    
    // Variant indexes for fast lookups with duplicates
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_variants_product_created ON variants(product_id, created_at)');
    } catch (e) { console.log('[Migration] Index already exists: idx_variants_product_created'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_variants_product_packing_rate ON variants(product_id, packing_size, rate)');
    } catch (e) { console.log('[Migration] Index already exists: idx_variants_product_packing_rate'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_variants_packing_size ON variants(packing_size)');
    } catch (e) { console.log('[Migration] Index already exists: idx_variants_packing_size'); }
    
    // Color indexes for fast lookups with duplicates
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_colors_variant_created ON colors(variant_id, created_at)');
    } catch (e) { console.log('[Migration] Index already exists: idx_colors_variant_created'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_colors_variant_code ON colors(variant_id, color_code)');
    } catch (e) { console.log('[Migration] Index already exists: idx_colors_variant_code'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_colors_code_lookup ON colors(color_code)');
    } catch (e) { console.log('[Migration] Index already exists: idx_colors_code_lookup'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_colors_name_lookup ON colors(color_name)');
    } catch (e) { console.log('[Migration] Index already exists: idx_colors_name_lookup'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_colors_code_name ON colors(color_code, color_name)');
    } catch (e) { console.log('[Migration] Index already exists: idx_colors_code_name'); }
    
    // Sales indexes
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_sales_phone_status ON sales(customer_phone, payment_status)');
    } catch (e) { console.log('[Migration] Index already exists: idx_sales_phone_status'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_sales_status_created ON sales(payment_status, created_at)');
    } catch (e) { console.log('[Migration] Index already exists: idx_sales_status_created'); }
    
    // Sale items indexes
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_sale_items_sale_color ON sale_items(sale_id, color_id)');
    } catch (e) { console.log('[Migration] Index already exists: idx_sale_items_sale_color'); }
    
    // Stock in history indexes
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_stock_history_color_created ON stock_in_history(color_id, created_at)');
    } catch (e) { console.log('[Migration] Index already exists: idx_stock_history_color_created'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_in_history(created_at)');
    } catch (e) { console.log('[Migration] Index already exists: idx_stock_history_created'); }
    
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_stock_history_stock_in_date ON stock_in_history(stock_in_date)');
    } catch (e) { console.log('[Migration] Index already exists: idx_stock_history_stock_in_date'); }
    
    console.log('[Migration] ✅ Database migration completed successfully');
  } catch (error) {
    console.error('[Migration] ❌ ERROR during migration:', error);
    // Don't throw error - continue with application startup
    // This ensures the app still works even if migration fails
  }
}