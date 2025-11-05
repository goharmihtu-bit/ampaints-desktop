import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import fs from "fs";

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
  // Close existing connection if any
  if (sqlite) {
    sqlite.close();
  }
  
  // Create new connection
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL"); // Write-Ahead Logging for better performance
  sqlite.pragma("foreign_keys = ON"); // Enable foreign key constraints
  
  // Initialize drizzle
  dbInstance = drizzle(sqlite, { schema });
  
  // Create tables if they don't exist
  createTables();
}

function createTables() {
  if (!sqlite) return;
  
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
  
  // Create composite indexes for performance
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_variants_product_created ON variants(product_id, created_at);
    
    CREATE INDEX IF NOT EXISTS idx_colors_variant_created ON colors(variant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_colors_code_lookup ON colors(color_code);
    
    CREATE INDEX IF NOT EXISTS idx_sales_phone_status ON sales(customer_phone, payment_status);
    CREATE INDEX IF NOT EXISTS idx_sales_status_created ON sales(payment_status, created_at);
    
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_color ON sale_items(sale_id, color_id);
  `);
}

// Initialize database on startup
initializeDatabase();

export const db = dbInstance!;
export const sqliteDb = sqlite!;
