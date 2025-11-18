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
    migrateDatabase(sqlite);
    
    console.log('[Database] ✅ Database initialized successfully');
  } catch (error) {
    console.error('[Database] ❌ ERROR initializing database:', error);
    console.error('[Database] Database path:', dbPath);
    throw error;
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
      added_by TEXT NOT NULL DEFAULT 'System',
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
  sqlite.exec(`
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
    
    -- Stock in history indexes
    CREATE INDEX IF NOT EXISTS idx_stock_history_color_created ON stock_in_history(color_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_in_history(created_at);
  `);
  
    console.log('[Database] ✅ All tables and indexes created successfully');
  } catch (error) {
    console.error('[Database] ❌ ERROR creating tables:', error);
    throw error;
  }
}

// Initialize database on startup
initializeDatabase();

export const db = dbInstance!;
export const sqliteDb = sqlite!;