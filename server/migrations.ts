// migrations.ts
// Database migration utilities for ensuring schema compatibility
import Database from "better-sqlite3"

/**
 * Migrates an imported database to the latest schema
 * This ensures backward compatibility when importing older database backups
 */
export function migrateDatabase(db: Database.Database): void {
  console.log("[Migration] Starting database schema migration...")

  try {
    // Enable foreign keys and WAL mode for better performance
    db.pragma("foreign_keys = ON")
    db.pragma("journal_mode = WAL")

    // Check and add missing columns to sales table (added in v0.1.7)
    const salesColumns = db.pragma("table_info(sales)") as Array<{ name: string; type: string }>
    const salesColumnNames = salesColumns.map((col) => col.name)

    console.log("[Migration] Current sales columns:", salesColumnNames)

    // Add dueDate column if missing
    if (!salesColumnNames.includes("due_date")) {
      console.log("[Migration] Adding due_date column to sales table")
      db.exec("ALTER TABLE sales ADD COLUMN due_date INTEGER")
    }

    // Add isManualBalance column if missing
    if (!salesColumnNames.includes("is_manual_balance")) {
      console.log("[Migration] Adding is_manual_balance column to sales table")
      db.exec("ALTER TABLE sales ADD COLUMN is_manual_balance INTEGER NOT NULL DEFAULT 0")
    }

    // Add notes column if missing
    if (!salesColumnNames.includes("notes")) {
      console.log("[Migration] Adding notes column to sales table")
      db.exec("ALTER TABLE sales ADD COLUMN notes TEXT")
    }

    // Check and add missing columns to colors table (added in v0.1.8)
    const colorsColumns = db.pragma("table_info(colors)") as Array<{ name: string; type: string }>
    const colorsColumnNames = colorsColumns.map((col) => col.name)

    console.log("[Migration] Current colors columns:", colorsColumnNames)

    // Add rateOverride column if missing
    if (!colorsColumnNames.includes("rate_override")) {
      console.log("[Migration] Adding rate_override column to colors table")
      db.exec("ALTER TABLE colors ADD COLUMN rate_override TEXT")
    }

    // Check and add missing columns to stock_in_history table (added in v0.2.0)
    const stockHistoryColumns = db.pragma("table_info(stock_in_history)") as Array<{ name: string; type: string }>
    const stockHistoryColumnNames = stockHistoryColumns.map((col) => col.name)

    console.log("[Migration] Current stock_in_history columns:", stockHistoryColumnNames)

    // Add stock_in_date column if missing - FIXED: Changed from timestamp to text
    if (!stockHistoryColumnNames.includes("stock_in_date")) {
      console.log("[Migration] Adding stock_in_date column to stock_in_history table")
      db.exec("ALTER TABLE stock_in_history ADD COLUMN stock_in_date TEXT")

      // Set default value for existing records (current date in DD-MM-YYYY format)
      const now = new Date()
      const day = String(now.getDate()).padStart(2, "0")
      const month = String(now.getMonth() + 1).padStart(2, "0")
      const year = now.getFullYear()
      const defaultDate = `${day}-${month}-${year}`

      console.log("[Migration] Setting default stock_in_date for existing records:", defaultDate)
      db.exec(`UPDATE stock_in_history SET stock_in_date = '${defaultDate}' WHERE stock_in_date IS NULL`)
    }

    // Create settings table if it doesn't exist (added in v0.1.9)
    console.log("[Migration] Creating/verifying settings table...")
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        store_name TEXT NOT NULL DEFAULT 'PaintPulse',
        date_format TEXT NOT NULL DEFAULT 'DD-MM-YYYY',
        card_border_style TEXT NOT NULL DEFAULT 'shadow',
        card_shadow_size TEXT NOT NULL DEFAULT 'sm',
        card_button_color TEXT NOT NULL DEFAULT 'gray-900',
        card_price_color TEXT NOT NULL DEFAULT 'blue-600',
        show_stock_badge_border INTEGER NOT NULL DEFAULT 0,
        display_theme TEXT NOT NULL DEFAULT 'glass',
        display_shadow_intensity TEXT NOT NULL DEFAULT 'medium',
        display_blur_intensity TEXT NOT NULL DEFAULT 'medium',
        audit_pin_hash TEXT,
        audit_pin_salt TEXT,
        perm_stock_delete INTEGER NOT NULL DEFAULT 1,
        perm_stock_edit INTEGER NOT NULL DEFAULT 1,
        perm_stock_history_delete INTEGER NOT NULL DEFAULT 1,
        perm_sales_delete INTEGER NOT NULL DEFAULT 1,
        perm_sales_edit INTEGER NOT NULL DEFAULT 1,
        perm_payment_edit INTEGER NOT NULL DEFAULT 1,
        perm_payment_delete INTEGER NOT NULL DEFAULT 1,
        perm_database_access INTEGER NOT NULL DEFAULT 1,
        cloud_database_url TEXT,
        cloud_sync_enabled INTEGER NOT NULL DEFAULT 0,
        last_sync_time INTEGER,
        updated_at INTEGER NOT NULL
      );
    `)

    // Check and add missing columns to settings table
    const settingsColumns = db.pragma("table_info(settings)") as Array<{ name: string; type: string }>
    const settingsColumnNames = settingsColumns.map((col) => col.name)

    console.log("[Migration] Current settings columns:", settingsColumnNames)

    // Add missing columns to settings table
    const missingSettingsColumns = [
      { name: "date_format", sql: "ALTER TABLE settings ADD COLUMN date_format TEXT NOT NULL DEFAULT 'DD-MM-YYYY'" },
      { name: "display_theme", sql: "ALTER TABLE settings ADD COLUMN display_theme TEXT NOT NULL DEFAULT 'glass'" },
      { name: "display_shadow_intensity", sql: "ALTER TABLE settings ADD COLUMN display_shadow_intensity TEXT NOT NULL DEFAULT 'medium'" },
      { name: "display_blur_intensity", sql: "ALTER TABLE settings ADD COLUMN display_blur_intensity TEXT NOT NULL DEFAULT 'medium'" },
      { name: "audit_pin_hash", sql: "ALTER TABLE settings ADD COLUMN audit_pin_hash TEXT" },
      { name: "audit_pin_salt", sql: "ALTER TABLE settings ADD COLUMN audit_pin_salt TEXT" },
      {
        name: "perm_stock_delete",
        sql: "ALTER TABLE settings ADD COLUMN perm_stock_delete INTEGER NOT NULL DEFAULT 1",
      },
      { name: "perm_stock_edit", sql: "ALTER TABLE settings ADD COLUMN perm_stock_edit INTEGER NOT NULL DEFAULT 1" },
      {
        name: "perm_stock_history_delete",
        sql: "ALTER TABLE settings ADD COLUMN perm_stock_history_delete INTEGER NOT NULL DEFAULT 1",
      },
      {
        name: "perm_sales_delete",
        sql: "ALTER TABLE settings ADD COLUMN perm_sales_delete INTEGER NOT NULL DEFAULT 1",
      },
      { name: "perm_sales_edit", sql: "ALTER TABLE settings ADD COLUMN perm_sales_edit INTEGER NOT NULL DEFAULT 1" },
      {
        name: "perm_payment_edit",
        sql: "ALTER TABLE settings ADD COLUMN perm_payment_edit INTEGER NOT NULL DEFAULT 1",
      },
      {
        name: "perm_payment_delete",
        sql: "ALTER TABLE settings ADD COLUMN perm_payment_delete INTEGER NOT NULL DEFAULT 1",
      },
      {
        name: "perm_database_access",
        sql: "ALTER TABLE settings ADD COLUMN perm_database_access INTEGER NOT NULL DEFAULT 1",
      },
      { name: "cloud_database_url", sql: "ALTER TABLE settings ADD COLUMN cloud_database_url TEXT" },
      {
        name: "cloud_sync_enabled",
        sql: "ALTER TABLE settings ADD COLUMN cloud_sync_enabled INTEGER NOT NULL DEFAULT 0",
      },
      { name: "last_sync_time", sql: "ALTER TABLE settings ADD COLUMN last_sync_time INTEGER" },
    ]

    for (const col of missingSettingsColumns) {
      if (!settingsColumnNames.includes(col.name)) {
        console.log(`[Migration] Adding ${col.name} column to settings table`)
        try {
          db.exec(col.sql)
        } catch (error) {
          console.log(`[Migration] Column ${col.name} might already exist:`, error)
        }
      }
    }

    // Insert default settings row if not exists
    const settingsExists = db.prepare("SELECT COUNT(*) as count FROM settings WHERE id = ?").get("default") as {
      count: number
    }
    if (settingsExists.count === 0) {
      console.log("[Migration] Inserting default settings row")
      const timestamp = Date.now()
      try {
        db.prepare(`
          INSERT INTO settings (
            id, store_name, date_format, card_border_style, card_shadow_size, 
            card_button_color, card_price_color, show_stock_badge_border, 
            display_theme, display_shadow_intensity, display_blur_intensity,
            audit_pin_hash, audit_pin_salt,
            perm_stock_delete, perm_stock_edit, perm_stock_history_delete,
            perm_sales_delete, perm_sales_edit, perm_payment_edit, 
            perm_payment_delete, perm_database_access,
            cloud_database_url, cloud_sync_enabled, last_sync_time,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          "default",
          "PaintPulse",
          "DD-MM-YYYY",
          "shadow",
          "sm",
          "gray-900",
          "blue-600",
          0,
          "glass",
          "medium",
          "medium", // display theme settings
          null,
          null, // audit_pin_hash, audit_pin_salt
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1, // permissions
          null,
          0,
          null, // cloud settings
          timestamp,
        )
      } catch (error) {
        console.log("[Migration] Error inserting default settings, might already exist:", error)
      }
    } else {
      // Update existing settings with default values for new columns
      console.log("[Migration] Updating existing settings with default values")
      const updateStmt = db.prepare(`
        UPDATE settings SET 
          date_format = COALESCE(date_format, 'DD-MM-YYYY'),
          display_theme = COALESCE(display_theme, 'glass'),
          display_shadow_intensity = COALESCE(display_shadow_intensity, 'medium'),
          display_blur_intensity = COALESCE(display_blur_intensity, 'medium'),
          audit_pin_hash = COALESCE(audit_pin_hash, NULL),
          audit_pin_salt = COALESCE(audit_pin_salt, NULL),
          perm_stock_delete = COALESCE(perm_stock_delete, 1),
          perm_stock_edit = COALESCE(perm_stock_edit, 1),
          perm_stock_history_delete = COALESCE(perm_stock_history_delete, 1),
          perm_sales_delete = COALESCE(perm_sales_delete, 1),
          perm_sales_edit = COALESCE(perm_sales_edit, 1),
          perm_payment_edit = COALESCE(perm_payment_edit, 1),
          perm_payment_delete = COALESCE(perm_payment_delete, 1),
          perm_database_access = COALESCE(perm_database_access, 1),
          cloud_database_url = COALESCE(cloud_database_url, NULL),
          cloud_sync_enabled = COALESCE(cloud_sync_enabled, 0),
          last_sync_time = COALESCE(last_sync_time, NULL),
          updated_at = ?
        WHERE id = 'default'
      `)
      updateStmt.run(Date.now())
    }

    // Create payment_history table if it doesn't exist (added in v0.2.1)
    console.log("[Migration] Creating/verifying payment_history table...")
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_history (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        amount TEXT NOT NULL,
        previous_balance TEXT NOT NULL,
        new_balance TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );
    `)

    // Create indexes for payment_history table
    console.log("[Migration] Creating/verifying payment_history indexes...")

    const paymentIndexes = [
      "CREATE INDEX IF NOT EXISTS idx_payment_history_customer_created ON payment_history(customer_phone, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_payment_history_sale ON payment_history(sale_id)",
      "CREATE INDEX IF NOT EXISTS idx_payment_history_customer_method ON payment_history(customer_phone, payment_method)",
      "CREATE INDEX IF NOT EXISTS idx_payment_history_created ON payment_history(created_at)",
    ]

    for (const indexSql of paymentIndexes) {
      try {
        db.exec(indexSql)
      } catch (e) {
        console.log("[Migration] Index might already exist:", indexSql)
      }
    }

    // ============ RETURNS TABLES MIGRATION ============
    // Create returns and return_items tables if they don't exist (added for Returns functionality)
    console.log("[Migration] Creating/verifying returns tables...")
    db.exec(`
      CREATE TABLE IF NOT EXISTS returns (
        id TEXT PRIMARY KEY,
        sale_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        return_type TEXT NOT NULL DEFAULT 'item',
        total_refund TEXT NOT NULL DEFAULT '0',
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
      );
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS return_items (
        id TEXT PRIMARY KEY,
        return_id TEXT NOT NULL,
        color_id TEXT NOT NULL,
        sale_item_id TEXT,
        quantity INTEGER NOT NULL,
        rate TEXT NOT NULL,
        subtotal TEXT NOT NULL,
        stock_restored INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        FOREIGN KEY (color_id) REFERENCES colors(id),
        FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE SET NULL
      );
    `)

    // Create indexes for returns tables
    console.log("[Migration] Creating/verifying returns indexes...")

    const returnsIndexes = [
      "CREATE INDEX IF NOT EXISTS idx_returns_customer_phone ON returns(customer_phone)",
      "CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON returns(sale_id)",
      "CREATE INDEX IF NOT EXISTS idx_returns_created ON returns(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status)",
      "CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id)",
      "CREATE INDEX IF NOT EXISTS idx_return_items_color_id ON return_items(color_id)",
      "CREATE INDEX IF NOT EXISTS idx_return_items_sale_item ON return_items(sale_item_id)",
    ]

    for (const indexSql of returnsIndexes) {
      try {
        db.exec(indexSql)
      } catch (e) {
        console.log("[Migration] Returns index might already exist:", indexSql)
      }
    }
    // ============ END RETURNS TABLES MIGRATION ============

    // ============ SALE ITEMS TABLE ENHANCEMENTS ============
    // Check and add missing columns to sale_items table for editing functionality
    const saleItemsColumns = db.pragma("table_info(sale_items)") as Array<{ name: string; type: string }>
    const saleItemsColumnNames = saleItemsColumns.map((col) => col.name)

    console.log("[Migration] Current sale_items columns:", saleItemsColumnNames)

    // Add quantity_returned column if missing
    if (!saleItemsColumnNames.includes("quantity_returned")) {
      console.log("[Migration] Adding quantity_returned column to sale_items table")
      try {
        db.exec("ALTER TABLE sale_items ADD COLUMN quantity_returned INTEGER NOT NULL DEFAULT 0")

        // Backfill from return_items table if exists
        try {
          db.exec(`
            UPDATE sale_items 
            SET quantity_returned = COALESCE(
              (SELECT SUM(ri.quantity) 
               FROM return_items ri 
               WHERE ri.sale_item_id = sale_items.id), 
              0
            )
          `)
          console.log("[Migration] Backfilled quantity_returned from return_items")
        } catch (backfillError) {
          console.log("[Migration] Could not backfill quantity_returned:", backfillError)
        }
      } catch (error) {
        console.log("[Migration] Column quantity_returned might already exist:", error)
      }
    }

    // Add editable columns if missing (for inline editing in unpaid bills)
    const saleItemEnhancements = [
      { name: "is_edited", sql: "ALTER TABLE sale_items ADD COLUMN is_edited INTEGER NOT NULL DEFAULT 0" },
      { name: "original_quantity", sql: "ALTER TABLE sale_items ADD COLUMN original_quantity INTEGER" },
      { name: "original_rate", sql: "ALTER TABLE sale_items ADD COLUMN original_rate TEXT" },
      { name: "edit_notes", sql: "ALTER TABLE sale_items ADD COLUMN edit_notes TEXT" },
    ]

    for (const col of saleItemEnhancements) {
      if (!saleItemsColumnNames.includes(col.name)) {
        console.log(`[Migration] Adding ${col.name} column to sale_items table`)
        try {
          db.exec(col.sql)
        } catch (error) {
          console.log(`[Migration] Column ${col.name} might already exist:`, error)
        }
      }
    }
    // ============ END SALE ITEMS TABLE ENHANCEMENTS ============

    // ============ CLOUD SYNC COMPATIBILITY ENHANCEMENTS ============
    // Ensure all tables have created_at for proper cloud sync
    console.log("[Migration] Ensuring cloud sync compatibility...")

    // Add created_at to variants if missing (for consistent cloud sync)
    const variantsColumns = db.pragma("table_info(variants)") as Array<{ name: string; type: string }>
    const variantsColumnNames = variantsColumns.map((col) => col.name)

    if (!variantsColumnNames.includes("created_at")) {
      console.log("[Migration] Adding created_at column to variants table")
      db.exec("ALTER TABLE variants ADD COLUMN created_at INTEGER")

      // Set default value for existing records
      const timestamp = Date.now()
      db.exec(`UPDATE variants SET created_at = ${timestamp} WHERE created_at IS NULL`)
    }

    // Add created_at to sale_items if missing
    const saleItemsCols = db.pragma("table_info(sale_items)") as Array<{ name: string; type: string }>
    const saleItemsColNames = saleItemsCols.map((col) => col.name)

    if (!saleItemsColNames.includes("created_at")) {
      console.log("[Migration] Adding created_at column to sale_items table")
      db.exec("ALTER TABLE sale_items ADD COLUMN created_at INTEGER")

      // Set default value for existing records
      const timestamp = Date.now()
      db.exec(`UPDATE sale_items SET created_at = ${timestamp} WHERE created_at IS NULL`)
    }
    // ============ END CLOUD SYNC COMPATIBILITY ENHANCEMENTS ============

    // Ensure all indexes exist (CREATE INDEX IF NOT EXISTS is safe)
    console.log("[Migration] Creating/verifying indexes...")

    const allIndexes = [
      // Product indexes
      "CREATE INDEX IF NOT EXISTS idx_products_company_name ON products(company, product_name)",
      "CREATE INDEX IF NOT EXISTS idx_products_company ON products(company)",
      "CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at)",

      // Variant indexes
      "CREATE INDEX IF NOT EXISTS idx_variants_product_created ON variants(product_id, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_variants_product_packing_rate ON variants(product_id, packing_size, rate)",
      "CREATE INDEX IF NOT EXISTS idx_variants_packing_size ON variants(packing_size)",
      "CREATE INDEX IF NOT EXISTS idx_variants_created ON variants(created_at)",

      // Color indexes
      "CREATE INDEX IF NOT EXISTS idx_colors_variant_created ON colors(variant_id, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_colors_variant_code ON colors(variant_id, color_code)",
      "CREATE INDEX IF NOT EXISTS idx_colors_code_lookup ON colors(color_code)",
      "CREATE INDEX IF NOT EXISTS idx_colors_name_lookup ON colors(color_name)",
      "CREATE INDEX IF NOT EXISTS idx_colors_code_name ON colors(color_code, color_name)",
      "CREATE INDEX IF NOT EXISTS idx_colors_stock ON colors(stock_quantity)",

      // Sales indexes
      "CREATE INDEX IF NOT EXISTS idx_sales_phone_status ON sales(customer_phone, payment_status)",
      "CREATE INDEX IF NOT EXISTS idx_sales_status_created ON sales(payment_status, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_sales_due_date ON sales(due_date)",
      "CREATE INDEX IF NOT EXISTS idx_sales_manual_balance ON sales(is_manual_balance)",
      "CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_sales_customer_name ON sales(customer_name)",

      // Sale items indexes
      "CREATE INDEX IF NOT EXISTS idx_sale_items_sale_color ON sale_items(sale_id, color_id)",
      "CREATE INDEX IF NOT EXISTS idx_sale_items_edited ON sale_items(is_edited)",
      "CREATE INDEX IF NOT EXISTS idx_sale_items_created ON sale_items(created_at)",

      // Stock in history indexes
      "CREATE INDEX IF NOT EXISTS idx_stock_history_color_created ON stock_in_history(color_id, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_in_history(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_stock_history_stock_in_date ON stock_in_history(stock_in_date)",
      "CREATE INDEX IF NOT EXISTS idx_stock_history_quantity ON stock_in_history(quantity)",
    ]

    for (const indexSql of allIndexes) {
      try {
        db.exec(indexSql)
      } catch (e) {
        console.log("[Migration] Index might already exist:", indexSql)
      }
    }

    // ============ STOCK OUT HISTORY TABLE ============
    console.log("[Migration] Creating/verifying stock_out_history table...")
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_out_history (
        id TEXT PRIMARY KEY,
        color_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        movement_type TEXT NOT NULL DEFAULT 'sale',
        reference_id TEXT,
        reference_type TEXT,
        reason TEXT,
        stock_out_date TEXT NOT NULL,
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE CASCADE
      );
    `)

    // ============ CUSTOMER ACCOUNTS TABLE ============
    console.log("[Migration] Creating/verifying customer_accounts table...")
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id TEXT PRIMARY KEY,
        customer_phone TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        total_purchased TEXT NOT NULL DEFAULT '0',
        total_paid TEXT NOT NULL DEFAULT '0',
        current_balance TEXT NOT NULL DEFAULT '0',
        last_transaction_date INTEGER,
        account_status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

    // ============ STOCK MOVEMENT SUMMARY TABLE ============
    console.log("[Migration] Creating/verifying stock_movement_summary table...")
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_movement_summary (
        id TEXT PRIMARY KEY,
        color_id TEXT NOT NULL,
        date_summary TEXT NOT NULL,
        opening_stock INTEGER NOT NULL DEFAULT 0,
        total_inward INTEGER NOT NULL DEFAULT 0,
        total_outward INTEGER NOT NULL DEFAULT 0,
        closing_stock INTEGER NOT NULL DEFAULT 0,
        last_updated INTEGER NOT NULL,
        FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE CASCADE,
        UNIQUE(color_id, date_summary)
      );
    `)

    // ============ ENHANCED SALES TABLE COLUMNS ============
    console.log("[Migration] Checking sales table for new columns...")
    const salesColumnsEnhanced = db.pragma("table_info(sales)") as Array<{ name: string; type: string }>
    const salesColumnNamesEnhanced = salesColumnsEnhanced.map((col) => col.name)

    const salesEnhancements = [
      { name: "sale_type", sql: "ALTER TABLE sales ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'normal'" },
      { name: "discount_amount", sql: "ALTER TABLE sales ADD COLUMN discount_amount TEXT NOT NULL DEFAULT '0'" },
      { name: "discount_percentage", sql: "ALTER TABLE sales ADD COLUMN discount_percentage TEXT" },
      { name: "stock_updated", sql: "ALTER TABLE sales ADD COLUMN stock_updated INTEGER NOT NULL DEFAULT 0" },
    ]

    for (const col of salesEnhancements) {
      if (!salesColumnNamesEnhanced.includes(col.name)) {
        console.log(`[Migration] Adding ${col.name} column to sales table`)
        try {
          db.exec(col.sql)
        } catch (error) {
          console.log(`[Migration] Column ${col.name} might already exist:`, error)
        }
      }
    }

    // ============ ENHANCED PAYMENT HISTORY TABLE COLUMNS ============
    console.log("[Migration] Checking payment_history table for new columns...")
    const paymentColumnsEnhanced = db.pragma("table_info(payment_history)") as Array<{ name: string; type: string }>
    const paymentColumnNamesEnhanced = paymentColumnsEnhanced.map((col) => col.name)

    const paymentEnhancements = [
      { name: "transaction_id", sql: "ALTER TABLE payment_history ADD COLUMN transaction_id TEXT" },
      { name: "payment_date", sql: "ALTER TABLE payment_history ADD COLUMN payment_date TEXT NOT NULL" },
    ]

    for (const col of paymentEnhancements) {
      if (!paymentColumnNamesEnhanced.includes(col.name)) {
        console.log(`[Migration] Adding ${col.name} column to payment_history table`)
        try {
          db.exec(col.sql)
        } catch (error) {
          console.log(`[Migration] Column ${col.name} might already exist:`, error)
        }
      }
    }

    // ============ CREATE INDEXES FOR NEW TABLES ============
    console.log("[Migration] Creating/verifying new table indexes...")

    const newIndexes = [
      "CREATE INDEX IF NOT EXISTS idx_stock_out_color_date ON stock_out_history(color_id, stock_out_date)",
      "CREATE INDEX IF NOT EXISTS idx_stock_out_type ON stock_out_history(movement_type, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_stock_out_reference ON stock_out_history(reference_type, reference_id)",
      "CREATE INDEX IF NOT EXISTS idx_customer_accounts_phone ON customer_accounts(customer_phone)",
      "CREATE INDEX IF NOT EXISTS idx_customer_accounts_status ON customer_accounts(account_status)",
      "CREATE INDEX IF NOT EXISTS idx_stock_summary_color_date ON stock_movement_summary(color_id, date_summary)",
      "CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales(sale_type, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_sales_stock_updated ON sales(stock_updated)",
    ]

    for (const indexSql of newIndexes) {
      try {
        db.exec(indexSql)
      } catch (e) {
        console.log("[Migration] Index might already exist:", indexSql)
      }
    }

    // ============ DATA CONSISTENCY CHECKS ============
    console.log("[Migration] Running data consistency checks...")

    // Ensure all sales have payment_status
    try {
      const invalidSales = db.prepare("SELECT COUNT(*) as count FROM sales WHERE payment_status IS NULL").get() as {
        count: number
      }
      if (invalidSales.count > 0) {
        console.log(`[Migration] Fixing ${invalidSales.count} sales with missing payment_status`)
        db.exec("UPDATE sales SET payment_status = 'unpaid' WHERE payment_status IS NULL")
      }
    } catch (error) {
      console.log("[Migration] Error fixing payment_status:", error)
    }

    // Ensure all sales have amount_paid
    try {
      const invalidPaid = db.prepare("SELECT COUNT(*) as count FROM sales WHERE amount_paid IS NULL").get() as {
        count: number
      }
      if (invalidPaid.count > 0) {
        console.log(`[Migration] Fixing ${invalidPaid.count} sales with missing amount_paid`)
        db.exec("UPDATE sales SET amount_paid = '0' WHERE amount_paid IS NULL")
      }
    } catch (error) {
      console.log("[Migration] Error fixing amount_paid:", error)
    }

    // ============ CLOUD SYNC READINESS ============
    console.log("[Migration] Finalizing cloud sync readiness...")

    // Update last sync time to indicate migration completion
    try {
      db.prepare("UPDATE settings SET last_sync_time = ?, updated_at = ? WHERE id = ?").run(
        Date.now(),
        Date.now(),
        "default",
      )
    } catch (error) {
      console.log("[Migration] Error updating last_sync_time:", error)
    }

    console.log("[Migration] ✅ Database migration completed successfully")

    // Log migration summary
    try {
      const tableCounts = {
        products: db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number },
        variants: db.prepare("SELECT COUNT(*) as count FROM variants").get() as { count: number },
        colors: db.prepare("SELECT COUNT(*) as count FROM colors").get() as { count: number },
        sales: db.prepare("SELECT COUNT(*) as count FROM sales").get() as { count: number },
        returns: db.prepare("SELECT COUNT(*) as count FROM returns").get() as { count: number },
        stock_out_history: db.prepare("SELECT COUNT(*) as count FROM stock_out_history").get() as { count: number },
        customer_accounts: db.prepare("SELECT COUNT(*) as count FROM customer_accounts").get() as { count: number },
        stock_movement_summary: db.prepare("SELECT COUNT(*) as count FROM stock_movement_summary").get() as {
          count: number
        },
      }

      console.log("[Migration] Database summary:", {
        products: tableCounts.products.count,
        variants: tableCounts.variants.count,
        colors: tableCounts.colors.count,
        sales: tableCounts.sales.count,
        returns: tableCounts.returns.count,
        stock_out_history: tableCounts.stock_out_history.count,
        customer_accounts: tableCounts.customer_accounts.count,
        stock_movement_summary: tableCounts.stock_movement_summary.count,
      })
    } catch (error) {
      console.log("[Migration] Error getting table counts:", error)
    }
  } catch (error) {
    console.error("[Migration] ❌ ERROR during migration:", error)
    // Don't throw error - continue with application startup
    // This ensures the app still works even if migration fails
  }
}

/**
 * Validates database integrity and fixes common issues
 */
export function validateDatabase(db: Database.Database): void {
  console.log("[Validation] Starting database validation...")

  try {
    // Check for foreign key violations
    const fkCheck = db.prepare("PRAGMA foreign_key_check").all() as Array<any>
    if (fkCheck.length > 0) {
      console.warn("[Validation] Foreign key violations found:", fkCheck)
      // Attempt to fix common foreign key issues
      fixForeignKeyIssues(db)
    }

    // Check for NULL in required fields
    const nullChecks = [
      { table: "products", column: "company", fix: "UPDATE products SET company = 'Unknown' WHERE company IS NULL" },
      {
        table: "products",
        column: "product_name",
        fix: "UPDATE products SET product_name = 'Unnamed Product' WHERE product_name IS NULL",
      },
      {
        table: "sales",
        column: "customer_name",
        fix: "UPDATE sales SET customer_name = 'Unknown Customer' WHERE customer_name IS NULL",
      },
      {
        table: "sales",
        column: "customer_phone",
        fix: "UPDATE sales SET customer_phone = '0000000000' WHERE customer_phone IS NULL",
      },
    ]

    for (const check of nullChecks) {
      try {
        const result = db
          .prepare(`SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.column} IS NULL`)
          .get() as { count: number }
        if (result.count > 0) {
          console.log(`[Validation] Fixing ${result.count} NULL values in ${check.table}.${check.column}`)
          db.exec(check.fix)
        }
      } catch (error) {
        console.log(`[Validation] Error checking ${check.table}.${check.column}:`, error)
      }
    }

    console.log("[Validation] ✅ Database validation completed")
  } catch (error) {
    console.error("[Validation] ❌ ERROR during validation:", error)
  }
}

/**
 * Fixes common foreign key issues
 */
function fixForeignKeyIssues(db: Database.Database): void {
  console.log("[Validation] Attempting to fix foreign key issues...")

  try {
    // Fix orphaned sale_items (where sale doesn't exist)
    const orphanedSaleItems = db
      .prepare(`
      SELECT si.id 
      FROM sale_items si 
      LEFT JOIN sales s ON si.sale_id = s.id 
      WHERE s.id IS NULL
    `)
      .all() as Array<{ id: string }>

    if (orphanedSaleItems.length > 0) {
      console.log(`[Validation] Removing ${orphanedSaleItems.length} orphaned sale_items`)
      const deleteStmt = db.prepare("DELETE FROM sale_items WHERE id = ?")
      for (const item of orphanedSaleItems) {
        deleteStmt.run(item.id)
      }
    }

    // Fix orphaned colors (where variant doesn't exist)
    const orphanedColors = db
      .prepare(`
      SELECT c.id 
      FROM colors c 
      LEFT JOIN variants v ON c.variant_id = v.id 
      WHERE v.id IS NULL
    `)
      .all() as Array<{ id: string }>

    if (orphanedColors.length > 0) {
      console.log(`[Validation] Found ${orphanedColors.length} orphaned colors - these need manual review`)
      // Don't auto-delete colors as they might be important
    }
  } catch (error) {
    console.error("[Validation] Error fixing foreign key issues:", error)
  }
}

/**
 * Backup current database before migration (safety measure)
 */
export function backupDatabase(sourceDb: Database.Database, backupPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      console.log(`[Backup] Creating backup at: ${backupPath}`)

      // Use better-sqlite3 backup API
      const backupDb = new Database(backupPath)

      sourceDb
        .backup(backupDb)
        .then(() => {
          console.log("[Backup] ✅ Database backup completed successfully")
          backupDb.close()
          resolve(true)
        })
        .catch((error) => {
          console.error("[Backup] ❌ Database backup failed:", error)
          backupDb.close()
          resolve(false)
        })
    } catch (error) {
      console.error("[Backup] ❌ Backup initialization failed:", error)
      resolve(false)
    }
  })
}

/**
 * Comprehensive database health check and repair
 */
export function performDatabaseHealthCheck(db: Database.Database): { healthy: boolean; issues: string[] } {
  console.log("[HealthCheck] Starting comprehensive database health check...")

  const issues: string[] = []

  try {
    // 1. Check database integrity
    const integrityCheck = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }
    if (integrityCheck.integrity_check !== "ok") {
      issues.push(`Database integrity check failed: ${integrityCheck.integrity_check}`)
    }

    // 2. Check for table corruption
    const tables = [
      "products",
      "variants",
      "colors",
      "sales",
      "sale_items",
      "stock_in_history",
      "payment_history",
      "returns",
      "return_items",
      "stock_out_history",
      "customer_accounts",
      "stock_movement_summary",
    ]

    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
        console.log(`[HealthCheck] Table ${table}: ${count.count} records`)
      } catch (error) {
        issues.push(`Table ${table} appears to be corrupted or missing`)
      }
    }

    // 3. Check foreign key consistency
    const fkViolations = db.prepare("PRAGMA foreign_key_check").all() as Array<any>
    if (fkViolations.length > 0) {
      issues.push(`Found ${fkViolations.length} foreign key violations`)
    }

    // 4. Check for data consistency issues
    const consistencyChecks = [
      {
        name: "Sales with invalid payment status",
        sql: "SELECT COUNT(*) as count FROM sales WHERE payment_status NOT IN ('paid', 'unpaid', 'partial')",
        threshold: 0,
      },
      {
        name: "Negative stock quantities",
        sql: "SELECT COUNT(*) as count FROM colors WHERE stock_quantity < 0",
        threshold: 0,
      },
      {
        name: "Sales with amount_paid > total_amount",
        sql: "SELECT COUNT(*) as count FROM sales WHERE CAST(amount_paid AS REAL) > CAST(total_amount AS REAL)",
        threshold: 0,
      },
      {
        name: "Duplicate color codes",
        sql: "SELECT COUNT(*) as count FROM (SELECT color_code, COUNT(*) as cnt FROM colors GROUP BY color_code HAVING cnt > 1)",
        threshold: 0,
      },
    ]

    for (const check of consistencyChecks) {
      try {
        const result = db.prepare(check.sql).get() as { count: number }
        if (result.count > check.threshold) {
          issues.push(`${check.name}: ${result.count} issues found`)
        }
      } catch (error) {
        console.log(`[HealthCheck] Error running check ${check.name}:`, error)
      }
    }

    // 5. Check index health
    try {
      const missingIndexes = db
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT IN (SELECT DISTINCT tbl_name FROM sqlite_master WHERE type = 'index')
      `)
        .all() as Array<{ name: string }>

      if (missingIndexes.length > 0) {
        issues.push(`Tables missing indexes: ${missingIndexes.map((t) => t.name).join(", ")}`)
      }
    } catch (error) {
      console.log("[HealthCheck] Error checking indexes:", error)
    }

    const healthy = issues.length === 0

    if (healthy) {
      console.log("[HealthCheck] ✅ Database health check passed - no issues found")
    } else {
      console.log("[HealthCheck] ⚠️ Database health check found issues:", issues)
    }

    return { healthy, issues }
  } catch (error) {
    console.error("[HealthCheck] ❌ Error during health check:", error)
    issues.push("Health check failed to complete")
    return { healthy: false, issues }
  }
}

/**
 * Optimize database performance
 */
export function optimizeDatabase(db: Database.Database): void {
  console.log("[Optimization] Starting database optimization...")

  try {
    // 1. Run VACUUM to defragment and optimize storage
    db.exec("VACUUM")
    console.log("[Optimization] VACUUM completed")

    // 2. Update database statistics for query optimizer
    db.exec("ANALYZE")
    console.log("[Optimization] ANALYZE completed")

    // 3. Set optimal pragma settings
    db.pragma("optimize")
    db.pragma("synchronous = NORMAL")
    db.pragma("cache_size = -64000") // 64MB cache
    db.pragma("temp_store = MEMORY")

    console.log("[Optimization] ✅ Database optimization completed")
  } catch (error) {
    console.error("[Optimization] ❌ Error during optimization:", error)
  }
}

/**
 * Migration manager that coordinates all database operations
 */
export class DatabaseMigrationManager {
  private db: Database.Database

  constructor(database: Database.Database) {
    this.db = database
  }

  /**
   * Run complete database maintenance routine
   */
  async runMaintenance(): Promise<{ success: boolean; backupCreated: boolean; issues: string[] }> {
    const issues: string[] = []
    let backupCreated = false

    try {
      console.log("[MigrationManager] Starting database maintenance...")

      // Step 1: Create backup
      const backupPath = `backup-${Date.now()}.db`
      backupCreated = await backupDatabase(this.db, backupPath)

      if (!backupCreated) {
        issues.push("Failed to create backup before maintenance")
      }

      // Step 2: Run migration
      migrateDatabase(this.db)

      // Step 3: Validate database
      validateDatabase(this.db)

      // Step 4: Health check
      const health = performDatabaseHealthCheck(this.db)
      issues.push(...health.issues)

      // Step 5: Optimize if healthy
      if (health.healthy) {
        optimizeDatabase(this.db)
      } else {
        console.log("[MigrationManager] Skipping optimization due to health issues")
      }

      console.log("[MigrationManager] ✅ Database maintenance completed")
      return { success: true, backupCreated, issues }
    } catch (error) {
      console.error("[MigrationManager] ❌ Database maintenance failed:", error)
      issues.push(`Maintenance failed: ${error}`)
      return { success: false, backupCreated, issues }
    }
  }

  /**
   * Get database schema version information
   */
  getSchemaVersion(): { version: string; tables: string[]; indexes: string[] } {
    try {
      const tables = this.db
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      `)
        .all() as Array<{ name: string }>

      const indexes = this.db
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
      `)
        .all() as Array<{ name: string }>

      // Determine version based on table presence
      let version = "1.0.0"
      const tableNames = tables.map((t) => t.name)

      if (tableNames.includes("payment_history")) version = "2.1.0"
      if (tableNames.includes("returns")) version = "2.2.0"
      if (tableNames.includes("settings")) {
        // Check for cloud sync columns in settings
        const settingsColumns = this.db.pragma("table_info(settings)") as Array<{ name: string }>
        const settingColumnNames = settingsColumns.map((c) => c.name)
        if (settingColumnNames.includes("cloud_sync_enabled")) version = "2.3.0"
      }
      if (tableNames.includes("stock_out_history")) version = "2.4.0"
      if (tableNames.includes("customer_accounts")) version = "2.5.0"
      if (tableNames.includes("stock_movement_summary")) version = "2.6.0"

      return {
        version,
        tables: tableNames,
        indexes: indexes.map((i) => i.name),
      }
    } catch (error) {
      console.error("[MigrationManager] Error getting schema version:", error)
      return { version: "unknown", tables: [], indexes: [] }
    }
  }

  /**
   * Export database schema for documentation
   */
  exportSchema(): Record<string, any> {
    const schema: Record<string, any> = {}

    try {
      const tables = this.db
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      `)
        .all() as Array<{ name: string }>

      for (const table of tables) {
        const tableName = table.name
        const columns = this.db.pragma(`table_info(${tableName})`) as Array<any>
        const indexes = this.db
          .prepare(`
          SELECT * FROM sqlite_master 
          WHERE type = 'index' 
          AND tbl_name = ?
        `)
          .all(tableName) as Array<any>

        schema[tableName] = {
          columns: columns.map((col) => ({
            name: col.name,
            type: col.type,
            notnull: col.notnull,
            defaultValue: col.dflt_value,
            primaryKey: col.pk,
          })),
          indexes: indexes.map((idx) => ({
            name: idx.name,
            sql: idx.sql,
          })),
        }
      }

      return schema
    } catch (error) {
      console.error("[MigrationManager] Error exporting schema:", error)
      return {}
    }
  }
}

// Export default migration function for backward compatibility
export default migrateDatabase
