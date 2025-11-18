// db.ts
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import fs from "fs";
import { migrateDatabase } from "./migrations";

// This will be set by Electron main process via environment variable
// Default to current working directory for development
let dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "paintpulse.db");

// Function to set database path (called from Electron main process)
export function setDatabasePath(newPath: string) {
  dbPath = newPath;
  
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Reinitialize database with new path
  initializeDatabase();
}

// Get current database path
export function getDatabasePath(): string {
  return dbPath;
}

let sqlite: Database.Database;
let dbInstance: BetterSQLite3Database<typeof schema>;

function initializeDatabase() {
  try {
    console.log('[Database] Initializing database at:', dbPath);
    
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      console.log('[Database] Creating directory:', dir);
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Close existing connection if any
    if (sqlite) {
      console.log('[Database] Closing existing connection');
      sqlite.close();
    }
    
    // Create new connection
    console.log('[Database] Creating new database connection');
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL"); // Write-Ahead Logging for better performance
    sqlite.pragma("foreign_keys = ON"); // Enable foreign key constraints
    
    // Initialize drizzle
    dbInstance = drizzle(sqlite, { schema });
    
    // Create tables if they don't exist
    console.log('[Database] Creating tables and indexes');
    createTables();
    
    // Run migrations to ensure schema compatibility (important for imported databases)
    console.log('[Database] Running schema migrations');
    try {
      migrateDatabase(sqlite);
    } catch (migrationError) {
      console.error('[Database] Migration failed, but continuing:', migrationError);
      // Continue even if migration fails
    }
    
    console.log('[Database] ✅ Database initialized successfully');
  } catch (error) {
    console.error('[Database] ❌ ERROR initializing database:', error);
    console.error('[Database] Database path:', dbPath);
    
    // Try to create a fresh database if initialization fails
    try {
      console.log('[Database] Attempting to create fresh database...');
      if (fs.existsSync(dbPath)) {
        const backupPath = `${dbPath}.backup-${Date.now()}`;
        console.log('[Database] Backing up corrupted database to:', backupPath);
        fs.copyFileSync(dbPath, backupPath);
        fs.unlinkSync(dbPath);
      }
      initializeDatabase(); // Recursive call to try again
    } catch (recoveryError) {
      console.error('[Database] ❌ Failed to recover database:', recoveryError);
      throw recoveryError;
    }
  }
}

function createTables() {
  if (!sqlite) {
    console.error('[Database] ❌ Cannot create tables - SQLite instance not initialized');
    return;
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
    `);
  
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
    `);
  
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
    `);
  
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
    `);
  
    // Create sale_items table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        color_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        rate TEXT NOT NULL,
        subtotal TEXT NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (color_id) REFERENCES colors(id)
      );
    `);

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
        created_at INTEGER NOT NULL,
        FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE CASCADE
      );
    `);
  
    // Create settings table
    sqlite.exec(`
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
  
    // Create composite indexes for performance and duplicate handling
    console.log('[Database] Creating indexes...');
    
    // Product indexes for fast lookups with duplicates
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_products_company_name ON products(company, product_name)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_products_company_name');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_products_company ON products(company)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_products_company');
    }
    
    // Variant indexes for fast lookups with duplicates
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_variants_product_created ON variants(product_id, created_at)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_variants_product_created');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_variants_product_packing_rate ON variants(product_id, packing_size, rate)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_variants_product_packing_rate');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_variants_packing_size ON variants(packing_size)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_variants_packing_size');
    }
    
    // Color indexes for fast lookups with duplicates
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_colors_variant_created ON colors(variant_id, created_at)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_colors_variant_created');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_colors_variant_code ON colors(variant_id, color_code)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_colors_variant_code');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_colors_code_lookup ON colors(color_code)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_colors_code_lookup');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_colors_name_lookup ON colors(color_name)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_colors_name_lookup');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_colors_code_name ON colors(color_code, color_name)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_colors_code_name');
    }
    
    // Sales indexes
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_sales_phone_status ON sales(customer_phone, payment_status)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_sales_phone_status');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_sales_status_created ON sales(payment_status, created_at)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_sales_status_created');
    }
    
    // Sale items indexes
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_sale_items_sale_color ON sale_items(sale_id, color_id)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_sale_items_sale_color');
    }
    
    // Stock in history indexes
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_stock_history_color_created ON stock_in_history(color_id, created_at)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_stock_history_color_created');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_in_history(created_at)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_stock_history_created');
    }
    
    try {
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_stock_history_stock_in_date ON stock_in_history(stock_in_date)');
    } catch (error) {
      console.log('[Database] Index already exists: idx_stock_history_stock_in_date');
    }
  
    console.log('[Database] ✅ All tables and indexes created successfully');
  } catch (error) {
    console.error('[Database] ❌ ERROR creating tables:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('no such table')) {
        console.error('[Database] Missing table detected, this might be a schema issue');
      } else if (error.message.includes('duplicate column name')) {
        console.error('[Database] Column already exists, continuing...');
        return; // Continue if it's just a duplicate column
      }
    }
    
    throw error;
  }
}

// Initialize database on startup
initializeDatabase();

// Export database instances with null checks
export const db = dbInstance!;
export const sqliteDb = sqlite!;

// Helper function to check if database is ready
export function isDatabaseReady(): boolean {
  return !!sqlite && !!dbInstance;
}

// Helper function to backup database
export function backupDatabase(backupPath?: string): string {
  if (!sqlite) {
    throw new Error('Database not initialized');
  }
  
  const actualBackupPath = backupPath || `${dbPath}.backup-${Date.now()}`;
  
  try {
    // Close current connection
    sqlite.close();
    
    // Copy database file
    fs.copyFileSync(dbPath, actualBackupPath);
    
    // Reinitialize connection
    initializeDatabase();
    
    console.log(`[Database] Backup created at: ${actualBackupPath}`);
    return actualBackupPath;
  } catch (error) {
    console.error('[Database] Backup failed:', error);
    // Try to reinitialize even if backup fails
    initializeDatabase();
    throw error;
  }
}

// Helper function to restore database from backup
export function restoreDatabase(backupPath: string): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  
  try {
    // Close current connection
    if (sqlite) {
      sqlite.close();
    }
    
    // Replace current database with backup
    fs.copyFileSync(backupPath, dbPath);
    
    // Reinitialize connection
    initializeDatabase();
    
    console.log(`[Database] Database restored from: ${backupPath}`);
  } catch (error) {
    console.error('[Database] Restore failed:', error);
    // Try to reinitialize even if restore fails
    initializeDatabase();
    throw error;
  }
}

// Helper function to reset database (for testing/development)
export function resetDatabase(): void {
  try {
    // Close current connection
    if (sqlite) {
      sqlite.close();
    }
    
    // Delete database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    
    // Reinitialize fresh database
    initializeDatabase();
    
    console.log('[Database] Database reset successfully');
  } catch (error) {
    console.error('[Database] Reset failed:', error);
    throw error;
  }
}

// Helper function to get database statistics
export function getDatabaseStats(): {
  tableCounts: Record<string, number>;
  databaseSize: number;
  lastBackup?: string;
} {
  if (!sqlite) {
    throw new Error('Database not initialized');
  }
  
  const tableCounts: Record<string, number> = {};
  const tables = ['products', 'variants', 'colors', 'sales', 'sale_items', 'stock_in_history', 'settings'];
  
  for (const table of tables) {
    try {
      const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      tableCounts[table] = result.count;
    } catch (error) {
      tableCounts[table] = 0;
    }
  }
  
  const databaseSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  
  // Find latest backup
  let lastBackup: string | undefined;
  const backupFiles = fs.readdirSync(path.dirname(dbPath))
    .filter(file => file.startsWith(path.basename(dbPath)) && file.includes('.backup-'))
    .sort()
    .reverse();
  
  if (backupFiles.length > 0) {
    lastBackup = path.join(path.dirname(dbPath), backupFiles[0]);
  }
  
  return {
    tableCounts,
    databaseSize,
    lastBackup
  };
}