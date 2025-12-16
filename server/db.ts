// db.ts - UPDATED WITH SCHEMA MIGRATION
import Database from "better-sqlite3"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import * as schema from "@shared/schema"
import path from "path"
import fs from "fs"
import { migrateDatabase } from "./migrations"

// This will be set by Electron main process via environment variable
// Default to current working directory for development
let dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "paintpulse.db")

// Function to set database path (called from Electron main process)
export function setDatabasePath(newPath: string) {
  dbPath = newPath

  // Ensure directory exists
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Reinitialize database with new path
  initializeDatabase()
}

// Get current database path
export function getDatabasePath(): string {
  return dbPath
}

let sqlite: Database.Database
let dbInstance: BetterSQLite3Database<typeof schema>

export function initializeDatabase() {
  try {
    console.log("[Database] Initializing database at:", dbPath)

    // Ensure directory exists
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      console.log("[Database] Creating directory:", dir)
      fs.mkdirSync(dir, { recursive: true })
    }

    // Close existing connection if any
    if (sqlite) {
      console.log("[Database] Closing existing connection")
      sqlite.close()
    }

    // Create new connection
    console.log("[Database] Creating new database connection")
    sqlite = new Database(dbPath)
    sqlite.pragma("journal_mode = WAL") // Write-Ahead Logging for better performance
    sqlite.pragma("foreign_keys = ON") // Enable foreign key constraints

    // Initialize drizzle
    dbInstance = drizzle(sqlite, { schema })

    // Create tables if they don't exist
    console.log("[Database] Creating tables and indexes")
    createTables()

    // Update schema for new columns
    console.log("[Database] Running schema updates")
    updateSchema()

    // Run migrations to ensure schema compatibility (important for imported databases)
    console.log("[Database] Running schema migrations")
    try {
      migrateDatabase(sqlite)
    } catch (migrationError) {
      console.error("[Database] Migration failed, but continuing:", migrationError)
      // Continue even if migration fails
    }

    console.log("[Database] ✅ Database initialized successfully")
  } catch (error) {
    console.error("[Database] ❌ ERROR initializing database:", error)
    console.error("[Database] Database path:", dbPath)

    // Try to create a fresh database if initialization fails
    try {
      console.log("[Database] Attempting to create fresh database...")
      if (fs.existsSync(dbPath)) {
        const backupPath = `${dbPath}.backup-${Date.now()}`
        console.log("[Database] Backing up corrupted database to:", backupPath)
        fs.copyFileSync(dbPath, backupPath)
        fs.unlinkSync(dbPath)
      }
      initializeDatabase() // Recursive call to try again
    } catch (recoveryError) {
      console.error("[Database] ❌ Failed to recover database:", recoveryError)
      throw recoveryError
    }
  }
}

// NEW FUNCTION: Update schema for new columns
function updateSchema() {
  try {
    console.log('[Database] Checking for schema updates...')

    // Check if cloud_database_url column exists in settings table
    const checkColumn = sqlite
      .prepare(`
      SELECT name FROM pragma_table_info('settings') WHERE name = 'cloud_database_url'
    `)
      .get()

    if (!checkColumn) {
      console.log("[Database] Adding missing columns to settings table...")

      // Add missing columns for cloud sync
      sqlite.exec(`
        ALTER TABLE settings ADD COLUMN cloud_database_url TEXT;
        ALTER TABLE settings ADD COLUMN cloud_sync_enabled INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE settings ADD COLUMN last_sync_time INTEGER;
      `)

      console.log("[Database] ✅ Cloud sync columns added to settings table")
    }

    // Check if date_format column exists (added in previous migrations)
    const checkDateFormat = sqlite
      .prepare(`
      SELECT name FROM pragma_table_info('settings') WHERE name = 'date_format'
    `)
      .get()

    if (!checkDateFormat) {
      console.log("[Database] Adding date_format column to settings table...")
      sqlite.exec(`ALTER TABLE settings ADD COLUMN date_format TEXT NOT NULL DEFAULT 'DD-MM-YYYY'`)
      console.log("[Database] ✅ date_format column added to settings table")
    }

    // Check if permission columns exist
    const checkPermColumns = sqlite
      .prepare(`
      SELECT name FROM pragma_table_info('settings') WHERE name = 'perm_stock_delete'
    `)
      .get()

    if (!checkPermColumns) {
      console.log("[Database] Adding permission columns to settings table...")

      // Add all permission columns
      sqlite.exec(`
        ALTER TABLE settings ADD COLUMN perm_stock_delete INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN perm_stock_edit INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN perm_stock_history_delete INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN perm_sales_delete INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN perm_sales_edit INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN perm_payment_edit INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN perm_payment_delete INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN perm_database_access INTEGER NOT NULL DEFAULT 1;
      `)

      console.log("[Database] ✅ Permission columns added to settings table")
    }

    // Update existing settings row with default values for new columns
    const updateStmt = sqlite.prepare(`
      UPDATE settings SET 
        cloud_database_url = COALESCE(cloud_database_url, NULL),
        cloud_sync_enabled = COALESCE(cloud_sync_enabled, 0),
        last_sync_time = COALESCE(last_sync_time, NULL),
        date_format = COALESCE(date_format, 'DD-MM-YYYY'),
        perm_stock_delete = COALESCE(perm_stock_delete, 1),
        perm_stock_edit = COALESCE(perm_stock_edit, 1),
        perm_stock_history_delete = COALESCE(perm_stock_history_delete, 1),
        perm_sales_delete = COALESCE(perm_sales_delete, 1),
        perm_sales_edit = COALESCE(perm_sales_edit, 1),
        perm_payment_edit = COALESCE(perm_payment_edit, 1),
        perm_payment_delete = COALESCE(perm_payment_delete, 1),
        perm_database_access = COALESCE(perm_database_access, 1)
      WHERE id = 'default'
    `)

    updateStmt.run()
    console.log("[Database] ✅ Settings table updated with default values")

    // Check if stock_in_history table needs new columns for returns tracking
    const checkStockHistoryType = sqlite
      .prepare(`
      SELECT name FROM pragma_table_info('stock_in_history') WHERE name = 'type'
    `)
      .get()

    if (!checkStockHistoryType) {
      console.log("[Database] Adding return tracking columns to stock_in_history table...")
      try {
        sqlite.exec(`ALTER TABLE stock_in_history ADD COLUMN type TEXT NOT NULL DEFAULT 'stock_in'`)
        sqlite.exec(`ALTER TABLE stock_in_history ADD COLUMN sale_id TEXT`)
        sqlite.exec(`ALTER TABLE stock_in_history ADD COLUMN customer_name TEXT`)
        sqlite.exec(`ALTER TABLE stock_in_history ADD COLUMN customer_phone TEXT`)
        console.log("[Database] ✅ Return tracking columns added to stock_in_history table")
      } catch (alterError) {
        console.error("[Database] Error adding stock_in_history columns:", alterError)
      }
    }

    // NEW: Ensure returns.refund_method column exists
    const checkRefundMethod = sqlite.prepare(`
      SELECT name FROM pragma_table_info('returns') WHERE name = 'refund_method'
    `).get();

    if (!checkRefundMethod) {
      console.log('[Database] Adding refund_method column to returns table...');
      try {
        sqlite.exec(`ALTER TABLE returns ADD COLUMN refund_method TEXT DEFAULT 'cash'`);
        console.log('[Database] ✅ refund_method column added to returns table');
      } catch (err) {
        console.error('[Database] Error adding refund_method column (continuing):', err);
      }
    }

    // Ensure license fields exist on settings table (added in license system)
    const checkLicenseExpiry = sqlite.prepare(`
      SELECT name FROM pragma_table_info('settings') WHERE name = 'license_expiry_date'
    `).get()

    const checkLicenseStatus = sqlite.prepare(`
      SELECT name FROM pragma_table_info('settings') WHERE name = 'license_status'
    `).get()

    if (!checkLicenseExpiry || !checkLicenseStatus) {
      console.log('[Database] Adding license columns to settings table...')
      try {
        if (!checkLicenseExpiry) sqlite.exec(`ALTER TABLE settings ADD COLUMN license_expiry_date TEXT`)
        if (!checkLicenseStatus) sqlite.exec(`ALTER TABLE settings ADD COLUMN license_status TEXT NOT NULL DEFAULT 'active'`)
        console.log('[Database] ✅ License columns added to settings table')
      } catch (err) {
        console.error('[Database] Error adding license columns (continuing):', err)
      }
    }
    
  } catch (error) {
    console.error('[Database] ❌ Error updating schema:', error)
    // Don't throw error - continue with existing schema
  }
}

function createTables() {
  if (!sqlite) {
    console.error("[Database] ❌ Cannot create tables - SQLite instance not initialized")
    return
  }

  try {
    // Create products table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        company TEXT NOT NULL,
        product_name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)

    // Create variants table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        packing_size TEXT NOT NULL,
        rate TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `)

    // Create colors table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS colors (
        id TEXT PRIMARY KEY,
        variant_id TEXT NOT NULL,
        color_name TEXT NOT NULL,
        color_code TEXT NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        rate_override TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE
      );
    `)

    // Create sales table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        total_amount TEXT NOT NULL,
        amount_paid TEXT NOT NULL DEFAULT '0',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        due_date INTEGER,
        is_manual_balance INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at INTEGER NOT NULL
      );
    `)

    if (!sqlite.prepare(`SELECT name FROM pragma_table_info('sales') WHERE name = 'sale_type'`).get()) {
      sqlite.exec(`
        ALTER TABLE sales ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'normal';
        ALTER TABLE sales ADD COLUMN discount_amount TEXT NOT NULL DEFAULT '0';
        ALTER TABLE sales ADD COLUMN discount_percentage TEXT;
        ALTER TABLE sales ADD COLUMN stock_updated INTEGER NOT NULL DEFAULT 0;
      `)
    }

    // Create sale_items table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        color_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        rate TEXT NOT NULL,
        subtotal TEXT NOT NULL,
        quantity_returned INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (color_id) REFERENCES colors(id)
      );
    `)

    const saleItemsCheck = sqlite
      .prepare(`SELECT name FROM pragma_table_info('sale_items') WHERE name = 'quantity_returned'`)
      .get()
    if (!saleItemsCheck) {
      console.log("[Database] Adding missing quantity_returned column to sale_items")
      try {
        sqlite.exec("ALTER TABLE sale_items ADD COLUMN quantity_returned INTEGER NOT NULL DEFAULT 0")
      } catch (e) {
        console.log("[Database] quantity_returned column might already exist")
      }
    }

    // Create stock_in_history table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS stock_in_history (
        id TEXT PRIMARY KEY,
        color_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        stock_in_date TEXT NOT NULL,
        notes TEXT,
        type TEXT NOT NULL DEFAULT 'stock_in',
        sale_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE CASCADE
      );
    `)

    // Create settings table with ALL columns INCLUDING AUDIT PIN and MASTER PIN
    console.log("[Database] Creating settings table...")
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        store_name TEXT NOT NULL DEFAULT 'PaintPulse',
        date_format TEXT NOT NULL DEFAULT 'DD-MM-YYYY',
        card_border_style TEXT NOT NULL DEFAULT 'shadow',
        card_shadow_size TEXT NOT NULL DEFAULT 'sm',
        card_button_color TEXT NOT NULL DEFAULT 'gray-900',
        card_price_color TEXT NOT NULL DEFAULT 'blue-600',
        show_stock_badge_border INTEGER NOT NULL DEFAULT 0,
        audit_pin_hash TEXT,
        audit_pin_salt TEXT,
        master_pin_hash TEXT,
        master_pin_salt TEXT,
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
    console.log("[Database] ✅ Settings table created")

    // Insert default settings if table is empty
    try {
      const checkStmt = sqlite.prepare("SELECT COUNT(*) as count FROM settings")
      const checkResult = checkStmt.get() as { count: number }

      if (checkResult.count === 0) {
        console.log("[Database] Inserting default settings...")
        const defaultTimestamp = new Date().getTime()

        sqlite.exec(`
          INSERT INTO settings (
            id, 
            store_name, 
            date_format, 
            card_border_style, 
            card_shadow_size, 
            card_button_color, 
            card_price_color, 
            show_stock_badge_border,
            audit_pin_hash,
            audit_pin_salt,
            perm_stock_delete,
            perm_stock_edit,
            perm_stock_history_delete,
            perm_sales_delete,
            perm_sales_edit,
            perm_payment_edit,
            perm_payment_delete,
            perm_database_access,
            cloud_database_url,
            cloud_sync_enabled,
            last_sync_time,
            updated_at
          ) VALUES (
            'default',
            'PaintPulse',
            'DD-MM-YYYY',
            'shadow',
            'sm',
            'gray-900',
            'blue-600',
            0,
            NULL,
            NULL,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            NULL,
            0,
            NULL,
            ${defaultTimestamp}
          )
        `)
        console.log("[Database] ✅ Default settings inserted")
      }
    } catch (settingsError) {
      console.log("[Database] Settings already exist or error:", settingsError)
    }

    // Create returns table (ensure refund_method included)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS returns (
        id TEXT PRIMARY KEY,
        sale_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        return_type TEXT NOT NULL DEFAULT 'item',
        total_refund TEXT NOT NULL DEFAULT '0',
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        refund_method TEXT DEFAULT 'cash',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
      );
    `)

    // Create return_items table with better tracking
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS return_items (
        id TEXT PRIMARY KEY,
        return_id TEXT NOT NULL,
        color_id TEXT NOT NULL,
        sale_item_id TEXT,
        quantity INTEGER NOT NULL,
        rate TEXT NOT NULL,
        subtotal TEXT NOT NULL,
        stock_restored INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        FOREIGN KEY (color_id) REFERENCES colors(id),
        FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE SET NULL
      );
    `)

    // Create payment_history table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS payment_history (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        amount TEXT NOT NULL,
        previous_balance TEXT NOT NULL,
        new_balance TEXT NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );
    `)

    if (!sqlite.prepare(`SELECT name FROM pragma_table_info('payment_history') WHERE name = 'transaction_id'`).get()) {
      sqlite.exec(`
        ALTER TABLE payment_history ADD COLUMN transaction_id TEXT;
        ALTER TABLE payment_history ADD COLUMN payment_date TEXT NOT NULL;
      `)
    }

    sqlite.exec(`
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

    sqlite.exec(`
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

    sqlite.exec(`
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

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS software_licenses (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL UNIQUE,
        device_name TEXT,
        store_name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        blocked_reason TEXT,
        blocked_at INTEGER,
        blocked_by TEXT,
        last_heartbeat INTEGER,
        last_sync_time INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS license_audit_log (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT,
        performed_by TEXT,
        previous_status TEXT,
        new_status TEXT,
        ip_address TEXT,
        created_at INTEGER NOT NULL
      );
    `)

    // Create cloud sync tables
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS cloud_sync_jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- pending, running, success, failed
        dry_run INTEGER DEFAULT 1,
        initiated_by TEXT,
        details TEXT,
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      );
    `)

    // Store connection metadata; connection_string_encrypted is nullable until we implement secure encryption
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS cloud_sync_connections (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        label TEXT,
        connection_string_encrypted TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      );
    `)

    try {
      sqlite.exec("ALTER TABLE settings ADD COLUMN master_pin_hash TEXT")
    } catch (e) {
      console.log("[Database] master_pin_hash column might already exist")
    }
    
    try {
      sqlite.exec("ALTER TABLE settings ADD COLUMN master_pin_salt TEXT")
    } catch (e) {
      console.log("[Database] master_pin_salt column might already exist")
    }

    try {
      sqlite.exec("ALTER TABLE software_licenses ADD COLUMN auto_block_date TEXT")
    } catch (e) {
      console.log("[Database] auto_block_date column might already exist")
    }

    console.log("[Database] Creating stock movement indexes...")

    try {
      sqlite.exec("CREATE INDEX IF NOT EXISTS idx_stock_out_color_date ON stock_out_history(color_id, stock_out_date)")
    } catch (error) {
      console.log("[Database] Index already exists: idx_stock_out_color_date")
    }

    try {
      sqlite.exec("CREATE INDEX IF NOT EXISTS idx_stock_out_type ON stock_out_history(movement_type, created_at)")
    } catch (error) {
      console.log("[Database] Index already exists: idx_stock_out_type")
    }

    try {
      sqlite.exec(
        "CREATE INDEX IF NOT EXISTS idx_stock_out_reference ON stock_out_history(reference_type, reference_id)",
      )
    } catch (error) {
      console.log("[Database] Index already exists: idx_stock_out_reference")
    }

    try {
      sqlite.exec("CREATE INDEX IF NOT EXISTS idx_customer_accounts_phone ON customer_accounts(customer_phone)")
    } catch (error) {
      console.log("[Database] Index already exists: idx_customer_accounts_phone")
    }

    try {
      sqlite.exec("CREATE INDEX IF NOT EXISTS idx_customer_accounts_status ON customer_accounts(account_status)")
    } catch (error) {
      console.log("[Database] Index already exists: idx_customer_accounts_status")
    }

    try {
      sqlite.exec(
        "CREATE INDEX IF NOT EXISTS idx_stock_summary_color_date ON stock_movement_summary(color_id, date_summary)",
      )
    } catch (error) {
      console.log("[Database] Index already exists: idx_stock_summary_color_date")
    }

    try {
      sqlite.exec("CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales(sale_type, created_at)")
    } catch (error) {
      console.log("[Database] Index already exists: idx_sales_sale_type")
    }

    try {
      sqlite.exec("CREATE INDEX IF NOT EXISTS idx_sales_stock_updated ON sales(stock_updated)")
    } catch (error) {
      console.log("[Database] Index already exists: idx_sales_stock_updated")
    }

    // Create indexes for cloud sync tables
    try {
      sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cloud_sync_jobs_status ON cloud_sync_jobs(status)")
    } catch (error) {
      console.log("[Database] Index already exists: idx_cloud_sync_jobs_status")
    }

    try {
      sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cloud_sync_connections_provider ON cloud_sync_connections(provider)")
    } catch (error) {
      console.log("[Database] Index already exists: idx_cloud_sync_connections_provider")
    }

    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status, created_at)")
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_sales_customer_phone ON sales(customer_phone, payment_status)")
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_sales_due_date ON sales(due_date) WHERE payment_status != 'paid'")
    sqlite.exec(
      "CREATE INDEX IF NOT EXISTS idx_payment_history_customer ON payment_history(customer_phone, created_at)",
    )
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_payment_history_sale ON payment_history(sale_id, created_at)")
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_stock_in_color_date ON stock_in_history(color_id, stock_in_date)")

    const indexQueries = [
      "CREATE INDEX IF NOT EXISTS idx_sales_unpaid ON sales(customer_phone) WHERE payment_status IN ('unpaid', 'partial')",
      "CREATE INDEX IF NOT EXISTS idx_colors_stock ON colors(stock_quantity)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_history_unique ON payment_history(sale_id, created_at)",
    ]

    for (const indexQuery of indexQueries) {
      try {
        sqlite.exec(indexQuery)
      } catch (error) {
        console.log("[Database] Index creation note:", error instanceof Error ? error.message : "Index already exists")
      }
    }

    console.log("[Database] ✅ All tables and indexes created successfully")
  } catch (error) {
    console.error("[Database] ❌ ERROR creating tables:", error)

    if (error instanceof Error) {
      if (error.message.includes("no such table")) {
        console.error("[Database] Missing table detected, this might be a schema issue")
      } else if (error.message.includes("duplicate column name")) {
        console.error("[Database] Column already exists, continuing...")
        return
      }
    }

    throw error
  }
}

// Initialize database on startup
initializeDatabase()

// Export database instances with null checks
export const db = dbInstance!
export const sqliteDb = sqlite!

// Helper function to check if database is ready
export function isDatabaseReady(): boolean {
  return !!sqlite && !!dbInstance
}

// Helper function to backup database
export function backupDatabase(backupPath?: string): string {
  if (!sqlite) {
    throw new Error("Database not initialized")
  }

  const actualBackupPath = backupPath || `${dbPath}.backup-${Date.now()}`

  try {
    // Close current connection
    sqlite.close()

    // Copy database file
    fs.copyFileSync(dbPath, actualBackupPath)

    // Reinitialize connection
    initializeDatabase()

    console.log(`[Database] Backup created at: ${actualBackupPath}`)
    return actualBackupPath
  } catch (error) {
    console.error("[Database] Backup failed:", error)
    // Try to reinitialize even if backup fails
    initializeDatabase()
    throw error
  }
}

// Helper function to restore database from backup
export function restoreDatabase(backupPath: string): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`)
  }

  try {
    // Close current connection
    if (sqlite) {
      sqlite.close()
    }

    // Replace current database with backup
    fs.copyFileSync(backupPath, dbPath)

    // Reinitialize connection
    initializeDatabase()

    console.log(`[Database] Database restored from: ${backupPath}`)
  } catch (error) {
    console.error("[Database] Restore failed:", error)
    // Try to reinitialize even if restore fails
    initializeDatabase()
    throw error
  }
}

// Helper function to reset database (for testing/development)
export function resetDatabase(): void {
  try {
    // Close current connection
    if (sqlite) {
      sqlite.close()
    }

    // Delete database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }

    // Reinitialize fresh database
    initializeDatabase()

    console.log("[Database] Database reset successfully")
  } catch (error) {
    console.error("[Database] Reset failed:", error)
    throw error
  }
}

// Helper function to get database statistics
export function getDatabaseStats(): {
  tableCounts: Record<string, number>
  databaseSize: number
  lastBackup?: string
} {
  if (!sqlite) {
    throw new Error("Database not initialized")
  }

  const tableCounts: Record<string, number> = {}
  const tables = [
    "products",
    "variants",
    "colors",
    "sales",
    "sale_items",
    "stock_in_history",
    "settings",
    "returns",
    "return_items",
    "payment_history",
    "stock_out_history",
    "customer_accounts",
    "stock_movement_summary",
  ]

  for (const table of tables) {
    try {
      const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
      tableCounts[table] = result.count
    } catch (error) {
      tableCounts[table] = 0
    }
  }

  const databaseSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0

  // Find latest backup
  let lastBackup: string | undefined
  const backupFiles = fs
    .readdirSync(path.dirname(dbPath))
    .filter((file) => file.startsWith(path.basename(dbPath)) && file.includes(".backup-"))
    .sort()
    .reverse()

  if (backupFiles.length > 0) {
    lastBackup = path.join(path.dirname(dbPath), backupFiles[0])
  }

  return {
    tableCounts,
    databaseSize,
    lastBackup,
  }
}

export default db
