// routes.ts - COMPLETE FIXED VERSION WITH ALL MISSING ROUTES
import type { Express } from "express"
import { createServer, type Server } from "http"
import { storage } from "./storage"
import { requirePerm } from "./permissions"
import {
  insertProductSchema,
  insertVariantSchema,
  insertColorSchema,
  insertSaleSchema,
  insertSaleItemSchema,
  insertPaymentHistorySchema,
} from "@shared/schema"
import { z } from "zod"
import crypto from "crypto"

// Import necessary types for clarity if not already present from @shared/schema or storage
// Assuming these types are defined and exported by your storage module or shared types
interface Product {
  id: string
  company: string
  productName: string
  createdAt: Date
}
interface Variant {
  id: string
  productId: string
  packingSize: string
  rate: string
  createdAt: Date
}
interface Color {
  id: string
  variantId: string
  colorName: string
  colorCode: string
  stockQuantity: number
  rateOverride: string | null
  createdAt: Date
}
interface Sale {
  id: string
  customerName: string
  customerPhone: string
  totalAmount: string
  amountPaid: string
  paymentStatus: string
  dueDate: Date | null
  isManualBalance: boolean
  notes: string | null
  createdAt: Date
}
interface SaleItem {
  id: string
  saleId: string
  colorId: string
  quantity: number
  rate: string
  subtotal: string
}
interface StockInHistory {
  id: string
  colorId: string
  quantity: number
  previousStock: number
  newStock: number
  stockInDate: string
  notes: string | null
  createdAt: Date
}
interface PaymentHistory {
  id: string
  saleId: string
  customerPhone: string
  amount: string
  previousBalance: string
  newBalance: string
  paymentMethod: string
  notes: string | null
  createdAt: Date
}
interface Return {
  id: string
  saleId: string | null
  customerName: string
  customerPhone: string
  returnType: string
  totalRefund: string
  reason: string | null
  status: string
  createdAt: Date
}
interface ReturnItem {
  id: string
  returnId: string
  colorId: string
  saleItemId: string | null
  quantity: number
  rate: string
  subtotal: string
  stockRestored: boolean
}

// FIXED: Extended interfaces for missing properties
interface ExtendedSale {
  id: string
  customerName: string
  customerPhone: string
  totalAmount: string
  amountPaid: string
  paymentStatus: string
  dueDate?: string | Date | null
  isManualBalance?: boolean
  notes?: string | null
  createdAt: Date
}

// Audit token storage (in-memory for session management)
const auditTokens = new Map<string, { createdAt: number }>()

// In-memory cache for frequently accessed data
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

const cache = {
  settings: null as CacheEntry<any> | null,
  products: null as CacheEntry<any[]> | null,
  variants: null as CacheEntry<any[]> | null,
  colors: null as CacheEntry<any[]> | null,
}

const CACHE_TTL = {
  settings: 60000, // 1 minute for settings
  products: 30000, // 30 seconds for products
  variants: 30000, // 30 seconds for variants
  colors: 30000,   // 30 seconds for colors
}

function getCached<T>(key: keyof typeof cache): T | null {
  const entry = cache[key] as CacheEntry<T> | null
  if (!entry) return null
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache[key] = null
    return null
  }
  return entry.data
}

function setCache<T>(key: keyof typeof cache, data: T, ttl: number): void {
  (cache as any)[key] = { data, timestamp: Date.now(), ttl }
}

function invalidateCache(key?: keyof typeof cache): void {
  if (key) {
    cache[key] = null
  } else {
    cache.settings = null
    cache.products = null
    cache.variants = null
    cache.colors = null
  }
}

// Helper to invalidate inventory-related caches
function invalidateInventoryCache(): void {
  cache.products = null
  cache.variants = null
  cache.colors = null
}

// Auto-sync state - REMOVED AUTO SYNC TRIGGERING AUTO REFRESH
let autoSyncEnabled = false
let syncInterval: NodeJS.Timeout | null = null

// Helper function to hash PIN
function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 100000, 64, "sha512").toString("hex")
}

// Helper function to get Neon SQL client only (removed Supabase support)
async function getNeonSqlClient(connectionUrl: string) {
  const { neon } = await import("@neondatabase/serverless")
  
  // Clean URL for Neon
  let cleanUrl = connectionUrl
  
  // Remove problematic parameters
  if (cleanUrl.includes('?')) {
    const urlParts = cleanUrl.split('?')
    const baseUrl = urlParts[0]
    const params = new URLSearchParams(urlParts[1])
    
    // Remove incompatible params
    params.delete('channel_binding')
    params.delete('application_name')
    
    // Ensure sslmode is require for Neon
    if (!params.has('sslmode')) {
      params.set('sslmode', 'require')
    }
    
    cleanUrl = `${baseUrl}?${params.toString()}`
  } else {
    cleanUrl = `${cleanUrl}?sslmode=require`
  }
  
  console.log('[Neon] Connecting with URL:', cleanUrl.replace(/:[^:@]*@/, ':****@'))
  
  const sql = neon(cleanUrl)
  return { sql, type: "neon" }
}

// Middleware to verify audit token
export function verifyAuditToken(req: any, res: any, next: any) {
  const token = req.headers["x-audit-token"]

  if (!token) {
    return res.status(401).json({ error: "Audit token required" })
  }

  const tokenData = auditTokens.get(token as string)
  if (!tokenData) {
    return res.status(401).json({ error: "Invalid or expired audit token" })
  }

  // Check if token is expired (24 hours)
  const tokenAge = Date.now() - tokenData.createdAt
  if (tokenAge > 24 * 60 * 60 * 1000) {
    auditTokens.delete(token as string)
    return res.status(401).json({ error: "Audit token expired" })
  }

  next()
}

// Clean up expired tokens periodically
setInterval(
  () => {
    const now = Date.now()
    for (const [token, data] of auditTokens.entries()) {
      if (now - data.createdAt > 24 * 60 * 60 * 1000) {
        auditTokens.delete(token)
      }
    }
  },
  60 * 60 * 1000,
) // Run every hour

// FIXED: Create tables for Neon with proper data types and better error handling
async function createNeonTables(sql: any) {
  let tx: any;
  try {
    console.log('[Neon] Creating tables if not exist...')
    
    // Start transaction
    tx = await sql.begin()
    
    // Check if tables already exist first
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      ) as products_exist
    `
    const checkResult = await tx.unsafe(checkQuery)
    
    if (checkResult[0]?.products_exist) {
      console.log('[Neon] Tables already exist, skipping creation')
      await tx.commit()
      return true
    }
    
    console.log('[Neon] Creating tables...')
    
    // Products table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        company TEXT NOT NULL,
        product_name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('[Neon] Created products table')
    
    // Variants table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        packing_size TEXT NOT NULL,
        rate TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('[Neon] Created variants table')
    
    // Colors table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS colors (
        id TEXT PRIMARY KEY,
        variant_id TEXT NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
        color_name TEXT NOT NULL,
        color_code TEXT NOT NULL,
        stock_quantity INTEGER DEFAULT 0,
        rate_override TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('[Neon] Created colors table')
    
    // Sales table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        total_amount TEXT NOT NULL,
        amount_paid TEXT DEFAULT '0',
        payment_status TEXT DEFAULT 'unpaid',
        due_date TIMESTAMP WITH TIME ZONE,
        is_manual_balance BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('[Neon] Created sales table')
    
    // Sale items table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        color_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        rate TEXT NOT NULL,
        subtotal TEXT NOT NULL
      )
    `)
    console.log('[Neon] Created sale_items table')
    
    // Stock history table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS stock_in_history (
        id TEXT PRIMARY KEY,
        color_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        stock_in_date TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('[Neon] Created stock_in_history table')
    
    // Payment history table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS payment_history (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        amount TEXT NOT NULL,
        previous_balance TEXT NOT NULL,
        new_balance TEXT NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('[Neon] Created payment_history table')
    
    // Returns table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS returns (
        id TEXT PRIMARY KEY,
        sale_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        return_type TEXT DEFAULT 'item',
        total_refund TEXT DEFAULT '0',
        reason TEXT,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('[Neon] Created returns table')
    
    // Return items table
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS return_items (
        id TEXT PRIMARY KEY,
        return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
        color_id TEXT NOT NULL,
        sale_item_id TEXT,
        quantity INTEGER NOT NULL,
        rate TEXT NOT NULL,
        subtotal TEXT NOT NULL,
        stock_restored BOOLEAN DEFAULT TRUE
      )
    `)
    console.log('[Neon] Created return_items table')
    
    await tx.commit()
    
    console.log('[Neon] Tables created/verified successfully')
    return true
  } catch (error: any) {
    console.error('[Neon] Error creating tables:', error)
    
    // Rollback transaction if it exists
    if (tx) {
      try {
        await tx.rollback()
      } catch (rollbackError) {
        console.error('[Neon] Error rolling back transaction:', rollbackError)
      }
    }
    
    // Provide more detailed error message
    let errorMessage = 'Failed to create tables in Neon'
    if (error.message?.includes('permission denied')) {
      errorMessage = 'Permission denied. Check if the user has CREATE TABLE privileges.'
    } else if (error.message?.includes('does not exist')) {
      errorMessage = 'Database or schema does not exist.'
    } else if (error.message?.includes('SSL')) {
      errorMessage = 'SSL connection error. Try adding ?sslmode=require to connection URL.'
    }
    
    throw new Error(`${errorMessage}: ${error.message || error}`)
  }
}

// FIXED: Neon-specific export function - NO AUTO REFRESH
async function exportToNeonData() {
  try {
    const settings = await storage.getSettings()
    if (!settings.cloudDatabaseUrl) {
      throw new Error("Cloud database not configured")
    }

    console.log(`[Neon Export] Starting export...`)

    // Get connection
    const { sql } = await getNeonSqlClient(settings.cloudDatabaseUrl)

    // Step 1: Create tables if they don't exist
    console.log('[Neon Export] Checking/creating tables...')
    const tablesCreated = await createNeonTables(sql)
    if (!tablesCreated) {
      throw new Error("Failed to create tables in Neon")
    }

    // Step 2: Get all data from local storage
    console.log('[Neon Export] Fetching local data...')
    const [products, variants, colorsData, sales, saleItems, stockInHistory, paymentHistory, returns, returnItems] = await Promise.all([
      storage.getProducts(),
      storage.getVariants(),
      storage.getColors(),
      storage.getSales(),
      storage.getSaleItems(),
      storage.getStockInHistory(),
      storage.getAllPaymentHistory(),
      storage.getReturns(),
      storage.getReturnItems()
    ])

    const exportedCounts = {
      products: 0,
      variants: 0,
      colors: 0,
      sales: 0,
      saleItems: 0,
      stockInHistory: 0,
      paymentHistory: 0,
      returns: 0,
      returnItems: 0,
    }

    // Step 3: Export data using transactions
    console.log('[Neon Export] Exporting data to Neon...')
    await sql.begin(async (tx: any) => {
      // Clear existing data first (optional, but ensures clean sync)
      console.log('[Neon Export] Clearing existing data...')
      await tx.unsafe(`TRUNCATE TABLE 
        return_items, 
        returns, 
        payment_history, 
        stock_in_history, 
        sale_items, 
        sales, 
        colors, 
        variants, 
        products 
        RESTART IDENTITY CASCADE`)
      
      // Export products
      console.log(`[Neon Export] Exporting ${products.length} products...`)
      for (const p of products) {
        await tx.unsafe(`
          INSERT INTO products (id, company, product_name, created_at)
          VALUES ($1, $2, $3, $4)
        `, [p.id, p.company, p.productName, p.createdAt])
        exportedCounts.products++
      }

      // Export variants
      console.log(`[Neon Export] Exporting ${variants.length} variants...`)
      for (const v of variants) {
        await tx.unsafe(`
          INSERT INTO variants (id, product_id, packing_size, rate, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [v.id, v.productId, v.packingSize, v.rate, v.createdAt])
        exportedCounts.variants++
      }

      // Export colors
      console.log(`[Neon Export] Exporting ${colorsData.length} colors...`)
      for (const c of colorsData) {
        await tx.unsafe(`
          INSERT INTO colors (id, variant_id, color_name, color_code, stock_quantity, rate_override, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [c.id, c.variantId, c.colorName, c.colorCode, c.stockQuantity, c.rateOverride, c.createdAt])
        exportedCounts.colors++
      }

      // Export sales
      console.log(`[Neon Export] Exporting ${sales.length} sales...`)
      for (const s of sales) {
        await tx.unsafe(`
          INSERT INTO sales (id, customer_name, customer_phone, total_amount, amount_paid, payment_status, due_date, is_manual_balance, notes, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [s.id, s.customerName, s.customerPhone, s.totalAmount, s.amountPaid, s.paymentStatus || "unpaid", s.dueDate, s.isManualBalance, s.notes, s.createdAt])
        exportedCounts.sales++
      }

      // Export sale items
      console.log(`[Neon Export] Exporting ${saleItems.length} sale items...`)
      for (const si of saleItems) {
        await tx.unsafe(`
          INSERT INTO sale_items (id, sale_id, color_id, quantity, rate, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [si.id, si.saleId, si.colorId, si.quantity, si.rate, si.subtotal])
        exportedCounts.saleItems++
      }

      // Export stock history
      console.log(`[Neon Export] Exporting ${stockInHistory.length} stock history records...`)
      for (const sih of stockInHistory) {
        await tx.unsafe(`
          INSERT INTO stock_in_history (id, color_id, quantity, previous_stock, new_stock, stock_in_date, notes, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [sih.id, sih.colorId, sih.quantity, sih.previousStock, sih.newStock, sih.stockInDate, sih.notes, sih.createdAt])
        exportedCounts.stockInHistory++
      }

      // Export payment history
      console.log(`[Neon Export] Exporting ${paymentHistory.length} payment history records...`)
      for (const ph of paymentHistory) {
        await tx.unsafe(`
          INSERT INTO payment_history (id, sale_id, customer_phone, amount, previous_balance, new_balance, payment_method, notes, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [ph.id, ph.saleId, ph.customerPhone, ph.amount, ph.previousBalance, ph.newBalance, ph.paymentMethod, ph.notes, ph.createdAt])
        exportedCounts.paymentHistory++
      }

      // Export returns
      console.log(`[Neon Export] Exporting ${returns.length} returns...`)
      for (const r of returns) {
        await tx.unsafe(`
          INSERT INTO returns (id, sale_id, customer_name, customer_phone, return_type, total_refund, reason, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [r.id, r.saleId, r.customerName, r.customerPhone, r.returnType, r.totalRefund, r.reason, r.status, r.createdAt])
        exportedCounts.returns++
      }

      // Export return items
      console.log(`[Neon Export] Exporting ${returnItems.length} return items...`)
      for (const ri of returnItems) {
        await tx.unsafe(`
          INSERT INTO return_items (id, return_id, color_id, sale_item_id, quantity, rate, subtotal, stock_restored)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [ri.id, ri.returnId, ri.colorId, ri.saleItemId, ri.quantity, ri.rate, ri.subtotal, ri.stockRestored])
        exportedCounts.returnItems++
      }
    })

    // Step 4: Verify data was exported
    console.log('[Neon Export] Verifying export...')
    const [verifyProducts, verifySales] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM products`,
      sql`SELECT COUNT(*) as count FROM sales`
    ])
    
    console.log(`[Neon Export] Verification:`)
    console.log(`  Products: ${verifyProducts[0]?.count || 0}`)
    console.log(`  Sales: ${verifySales[0]?.count || 0}`)
    console.log(`  Exported counts:`, exportedCounts)

    // Step 5: Update last sync time WITHOUT triggering refresh
    await storage.updateSettings({ 
      lastSyncTime: new Date(),
      lastExportCounts: JSON.stringify(exportedCounts)
    })

    // Step 6: Return success WITHOUT invalidating queries
    return { 
      success: true, 
      counts: exportedCounts,
      dataInCloud: {
        products: parseInt(verifyProducts[0]?.count || "0"),
        sales: parseInt(verifySales[0]?.count || "0")
      },
      message: `Exported ${exportedCounts.products} products, ${exportedCounts.sales} sales to Neon`
    }
  } catch (error: any) {
    console.error("Neon export failed:", error)
    throw new Error(`Neon export failed: ${error.message}`)
  }
}

// FIXED: Neon-specific import function
async function importFromNeonData() {
  try {
    const settings = await storage.getSettings()
    if (!settings.cloudDatabaseUrl) {
      throw new Error("Cloud database not configured")
    }

    const { sql } = await getNeonSqlClient(settings.cloudDatabaseUrl)

    console.log(`[Neon Import] Starting import...`)

    // Check if tables exist
    let tablesCheck
    try {
      tablesCheck = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
      `
    } catch (error) {
      throw new Error("Tables do not exist in Neon. Please export first.")
    }

    if (tablesCheck.length === 0) {
      throw new Error("No data found in cloud database. Please export first.")
    }

    // Fetch all data from Neon
    const cloudProducts = await sql`SELECT * FROM products ORDER BY created_at`
    const cloudVariants = await sql`SELECT * FROM variants ORDER BY created_at`
    const cloudColors = await sql`SELECT * FROM colors ORDER BY created_at`
    const cloudSales = await sql`SELECT * FROM sales ORDER BY created_at`
    const cloudSaleItems = await sql`SELECT * FROM sale_items`
    const cloudStockInHistory = await sql`SELECT * FROM stock_in_history ORDER BY created_at`
    const cloudPaymentHistory = await sql`SELECT * FROM payment_history ORDER BY created_at`
    const cloudReturns = await sql`SELECT * FROM returns ORDER BY created_at`
    const cloudReturnItems = await sql`SELECT * FROM return_items`

    const importedCounts = {
      products: 0,
      variants: 0,
      colors: 0,
      sales: 0,
      saleItems: 0,
      stockInHistory: 0,
      paymentHistory: 0,
      returns: 0,
      returnItems: 0,
    }

    // Import data
    // Clear local data first
    await storage.clearAllData()
    
    // Import products
    for (const p of cloudProducts) {
      await storage.upsertProduct({
        id: p.id,
        company: p.company,
        productName: p.product_name,
        createdAt: new Date(p.created_at),
      } as Product)
      importedCounts.products++
    }

    // Import variants
    for (const v of cloudVariants) {
      await storage.upsertVariant({
        id: v.id,
        productId: v.product_id,
        packingSize: v.packing_size,
        rate: v.rate,
        createdAt: new Date(v.created_at),
      } as Variant)
      importedCounts.variants++
    }

    // Import colors
    for (const c of cloudColors) {
      await storage.upsertColor({
        id: c.id,
        variantId: c.variant_id,
        colorName: c.color_name,
        colorCode: c.color_code,
        stockQuantity: c.stock_quantity,
        rateOverride: c.rate_override,
        createdAt: new Date(c.created_at),
      } as Color)
      importedCounts.colors++
    }

    // Import sales
    for (const s of cloudSales) {
      await storage.upsertSale({
        id: s.id,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        totalAmount: s.total_amount,
        amountPaid: s.amount_paid,
        paymentStatus: s.payment_status,
        dueDate: s.due_date ? new Date(s.due_date) : null,
        isManualBalance: s.is_manual_balance,
        notes: s.notes,
        createdAt: new Date(s.created_at),
      } as ExtendedSale)
      importedCounts.sales++
    }

    // Import sale items
    for (const si of cloudSaleItems) {
      await storage.upsertSaleItem({
        id: si.id,
        saleId: si.sale_id,
        colorId: si.color_id,
        quantity: si.quantity,
        rate: si.rate,
        subtotal: si.subtotal,
      } as SaleItem)
      importedCounts.saleItems++
    }

    // Import stock history
    for (const sih of cloudStockInHistory) {
      await storage.upsertStockInHistory({
        id: sih.id,
        colorId: sih.color_id,
        quantity: sih.quantity,
        previousStock: sih.previous_stock,
        newStock: sih.new_stock,
        stockInDate: sih.stock_in_date,
        notes: sih.notes,
        createdAt: new Date(sih.created_at),
      } as StockInHistory)
      importedCounts.stockInHistory++
    }

    // Import payment history
    for (const ph of cloudPaymentHistory) {
      await storage.upsertPaymentHistory({
        id: ph.id,
        saleId: ph.sale_id,
        customerPhone: ph.customer_phone,
        amount: ph.amount,
        previousBalance: ph.previous_balance,
        newBalance: ph.new_balance,
        paymentMethod: ph.payment_method,
        notes: ph.notes,
        createdAt: new Date(ph.created_at),
      } as PaymentHistory)
      importedCounts.paymentHistory++
    }

    // Import returns
    for (const r of cloudReturns) {
      await storage.upsertReturn({
        id: r.id,
        saleId: r.sale_id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        returnType: r.return_type,
        totalRefund: r.total_refund,
        reason: r.reason,
        status: r.status,
        createdAt: new Date(r.created_at),
      } as Return)
      importedCounts.returns++
    }

    // Import return items
    for (const ri of cloudReturnItems) {
      await storage.upsertReturnItem({
        id: ri.id,
        returnId: ri.return_id,
        colorId: ri.color_id,
        saleItemId: ri.sale_item_id,
        quantity: ri.quantity,
        rate: ri.rate,
        subtotal: ri.subtotal,
        stockRestored: ri.stock_restored,
      } as ReturnItem)
      importedCounts.returnItems++
    }

    console.log(`[Neon Import] Completed. Imported:`, importedCounts)

    // Update last sync time
    await storage.updateSettings({ 
      lastSyncTime: new Date(),
      lastImportCounts: JSON.stringify(importedCounts)
    })

    return { 
      success: true, 
      counts: importedCounts,
      message: `Imported ${importedCounts.products} products, ${importedCounts.sales} sales from Neon`
    }
  } catch (error) {
    console.error("[Neon Import] Failed:", error)
    throw error
  }
}

// FIXED: Silent sync trigger - NO AUTO REFRESH
async function triggerSilentSync() {
  if (!autoSyncEnabled) return

  try {
    console.log("[Silent Sync] Starting automatic sync...")

    const settings = await storage.getSettings()
    if (!settings.cloudDatabaseUrl || !settings.cloudSyncEnabled) {
      console.log("[Silent Sync] Cloud sync not configured")
      return
    }

    // Export only (no import in auto-sync to avoid conflicts)
    await exportToNeonData()

    // Update sync timestamp
    await storage.updateSettings({ lastSyncTime: new Date() })

    console.log("[Silent Sync] Automatic sync completed")
  } catch (error) {
    console.error("[Silent Sync] Failed:", error)
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Products - with caching
  app.get("/api/products", async (_req, res) => {
    try {
      const cached = getCached<any[]>("products")
      if (cached) {
        return res.json(cached)
      }
      const products = await storage.getProducts()
      setCache("products", products, CACHE_TTL.products)
      res.json(products)
    } catch (error) {
      console.error("Error fetching products:", error)
      res.status(500).json({ error: "Failed to fetch products" })
    }
  })

  app.post("/api/products", requirePerm("stock:edit"), async (req, res) => {
    try {
      const validated = insertProductSchema.parse(req.body)
      const product = await storage.createProduct(validated)

      // Cache invalidation only - no auto sync
      invalidateInventoryCache()

      res.json(product)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid product data", details: error.errors })
      } else {
        console.error("Error creating product:", error)
        res.status(500).json({ error: "Failed to create product" })
      }
    }
  })

  app.patch("/api/products/:id", requirePerm("stock:edit"), async (req, res) => {
    try {
      const { company, productName } = req.body
      if (!company || !productName) {
        res.status(400).json({ error: "Company and product name are required" })
        return
      }
      const product = await storage.updateProduct(req.params.id, { company, productName })

      // Cache invalidation only - no auto sync
      invalidateInventoryCache()

      res.json(product)
    } catch (error) {
      console.error("Error updating product:", error)
      res.status(500).json({ error: "Failed to update product" })
    }
  })

  app.delete("/api/products/:id", requirePerm("stock:delete"), async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id)

      // Cache invalidation only - no auto sync
      invalidateInventoryCache()

      res.json({ success: true })
    } catch (error) {
      console.error("Error deleting product:", error)
      res.status(500).json({ error: "Failed to delete product" })
    }
  })

  // Variants - with caching
  app.get("/api/variants", async (_req, res) => {
    try {
      const cached = getCached<any[]>("variants")
      if (cached) {
        return res.json(cached)
      }
      const variants = await storage.getVariants()
      setCache("variants", variants, CACHE_TTL.variants)
      res.json(variants)
    } catch (error) {
      console.error("Error fetching variants:", error)
      res.status(500).json({ error: "Failed to fetch variants" })
    }
  })

  app.post("/api/variants", requirePerm("stock:edit"), async (req, res) => {
    try {
      const validated = insertVariantSchema.parse(req.body)
      const variant = await storage.createVariant(validated)

      // Cache invalidation only - no auto sync
      invalidateInventoryCache()

      res.json(variant)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid variant data", details: error.errors })
      } else {
        console.error("Error creating variant:", error)
        res.status(500).json({ error: "Failed to create variant" })
      }
    }
  })

  app.patch("/api/variants/:id", requirePerm("stock:edit"), async (req, res) => {
    try {
      const { productId, packingSize, rate } = req.body
      if (!productId || !packingSize || rate === undefined) {
        res.status(400).json({ error: "Product, packing size, and rate are required" })
        return
      }
      const variant = await storage.updateVariant(req.params.id, {
        productId,
        packingSize,
        rate: Number.parseFloat(rate),
      })

      // Cache invalidation only - no auto sync
      invalidateInventoryCache()

      res.json(variant)
    } catch (error) {
      console.error("Error updating variant:", error)
      res.status(500).json({ error: "Failed to update variant" })
    }
  })

  app.patch("/api/variants/:id/rate", requirePerm("stock:edit"), async (req, res) => {
    try {
      const { rate } = req.body
      if (typeof rate !== "number" || rate <= 0) {
        res.status(400).json({ error: "Invalid rate" })
        return
      }
      const variant = await storage.updateVariantRate(req.params.id, rate)

      // Cache invalidation only - no auto sync
      invalidateInventoryCache()

      res.json(variant)
    } catch (error) {
      console.error("Error updating variant rate:", error)
      res.status(500).json({ error: "Failed to update variant rate" })
    }
  })

  app.delete("/api/variants/:id", requirePerm("stock:delete"), async (req, res) => {
    try {
      await storage.deleteVariant(req.params.id)

      // Cache invalidation only - no auto sync
      invalidateInventoryCache()

      res.json({ success: true })
    } catch (error) {
      console.error("Error deleting variant:", error)
      res.status(500).json({ error: "Failed to delete variant" })
    }
  })

  // Colors - with caching
  app.get("/api/colors", async (_req, res) => {
    try {
      const cached = getCached<any[]>("colors")
      if (cached) {
        return res.json(cached)
      }
      const colors = await storage.getColors()
      setCache("colors", colors, CACHE_TTL.colors)
      res.json(colors)
    } catch (error) {
      console.error("Error fetching colors:", error)
      res.status(500).json({ error: "Failed to fetch colors" })
    }
  })

  app.post("/api/colors", requirePerm("stock:edit"), async (req, res) => {
    try {
      const validated = insertColorSchema.parse(req.body)
      validated.colorCode = validated.colorCode.trim().toUpperCase()
      const color = await storage.createColor(validated)

      // Cache invalidation only - no auto sync
      invalidateCache("colors")

      res.json(color)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid color data", details: error.errors })
      } else {
        console.error("Error creating color:", error)
        res.status(500).json({ error: "Failed to create color" })
      }
    }
  })

  app.patch("/api/colors/:id", requirePerm("stock:edit"), async (req, res) => {
    try {
      const { colorName, colorCode, stockQuantity } = req.body
      if (!colorName || !colorCode || stockQuantity === undefined) {
        res.status(400).json({ error: "Color name, code, and stock quantity are required" })
        return
      }
      const normalizedCode = colorCode.trim().toUpperCase()
      const color = await storage.updateColor(req.params.id, {
        colorName: colorName.trim(),
        colorCode: normalizedCode,
        stockQuantity: Number.parseInt(stockQuantity),
      })

      // Cache invalidation only - no auto sync
      invalidateCache("colors")

      res.json(color)
    } catch (error) {
      console.error("Error updating color:", error)
      res.status(500).json({ error: "Failed to update color" })
    }
  })

  app.patch("/api/colors/:id/stock", requirePerm("stock:edit"), async (req, res) => {
    try {
      const { stockQuantity } = req.body
      if (typeof stockQuantity !== "number" || stockQuantity < 0) {
        res.status(400).json({ error: "Invalid stock quantity" })
        return
      }
      const color = await storage.updateColorStock(req.params.id, stockQuantity)

      // Cache invalidation only - no auto sync
      invalidateCache("colors")

      res.json(color)
    } catch (error) {
      console.error("Error updating color stock:", error)
      res.status(500).json({ error: "Failed to update color stock" })
    }
  })

  app.patch("/api/colors/:id/rate-override", requirePerm("stock:edit"), async (req, res) => {
    try {
      const { rateOverride } = req.body
      if (rateOverride !== null && (typeof rateOverride !== "number" || rateOverride < 0)) {
        res.status(400).json({ error: "Invalid rate override" })
        return
      }
      const color = await storage.updateColorRateOverride(req.params.id, rateOverride)

      // Cache invalidation only - no auto sync
      invalidateCache("colors")

      res.json(color)
    } catch (error) {
      console.error("Error updating color rate override:", error)
      res.status(500).json({ error: "Failed to update color rate override" })
    }
  })

  // FIXED: Stock In endpoint with proper stockInDate handling
  app.post("/api/colors/:id/stock-in", requirePerm("stock:edit"), async (req, res) => {
    try {
      const { quantity, notes, stockInDate } = req.body
      const colorId = req.params.id

      console.log(
        `[API] Stock in request: Color ${colorId}, Quantity: ${quantity}, Notes: ${notes}, Date: ${stockInDate}`,
      )

      if (typeof quantity !== "number" || quantity <= 0) {
        res.status(400).json({
          error: "Invalid quantity",
          details: "Quantity must be a positive number",
        })
        return
      }

      if (!colorId || colorId === "undefined" || colorId === "null") {
        res.status(400).json({
          error: "Invalid color ID",
          details: "Color ID is required and must be valid",
        })
        return
      }

      // Validate stockInDate format if provided
      if (stockInDate && !/^\d{2}-\d{2}-\d{4}$/.test(stockInDate)) {
        res.status(400).json({
          error: "Invalid date format",
          details: "Stock in date must be in DD-MM-YYYY format",
        })
        return
      }

      console.log(`[API] Processing stock in for color: ${colorId}`)

      const color = await storage.stockIn(colorId, quantity, notes, stockInDate)

      if (!color) {
        res.status(404).json({
          error: "Color not found",
          details: `No color found with ID: ${colorId}`,
        })
        return
      }

      // Invalidate colors cache after stock update
      invalidateCache("colors")

      console.log(`[API] Stock in successful: ${color.colorName} - New stock: ${color.stockQuantity}`)

      res.json({
        ...color,
        message: `Successfully added ${quantity} units to ${color.colorName}`,
      })
    } catch (error) {
      console.error("[API] Error adding stock:", error)

      // Provide more specific error messages
      const errorMessage = "Failed to add stock"
      const errorDetails = error instanceof Error ? error.message : "Unknown error"

      if (errorDetails.includes("not found")) {
        res.status(404).json({
          error: "Color not found",
          details: errorDetails,
        })
      } else {
        res.status(500).json({
          error: errorMessage,
          details: errorDetails,
        })
      }
    }
  })

  app.delete("/api/colors/:id", requirePerm("stock:delete"), async (req, res) => {
    try {
      await storage.deleteColor(req.params.id)

      // Cache invalidation only - no auto sync
      invalidateCache("colors")

      res.json({ success: true })
    } catch (error) {
      console.error("Error deleting color:", error)
      res.status(500).json({ error: "Failed to delete color" })
    }
  })

  // FIXED: Stock In History - Proper endpoints for stock history
  app.get("/api/stock-in/history", async (_req, res) => {
    try {
      console.log("[API] Fetching stock in history")
      const history = await storage.getStockInHistory()
      console.log(`[API] Returning ${history.length} history records`)
      res.json(history)
    } catch (error) {
      console.error("[API] Error fetching stock in history:", error)
      // Return empty array instead of error for better UX
      res.json([])
    }
  })

  // OPTIMIZED: Paginated stock history endpoint for large datasets
  app.get("/api/stock-in/history/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 100
      const result = await storage.getStockInHistoryPaginated({ page, limit })
      res.json(result)
    } catch (error) {
      console.error("Error fetching paginated stock history:", error)
      res.status(500).json({ error: "Failed to fetch paginated stock history" })
    }
  })

  // Filtered Stock In History - FIXED: Corrected arrow function syntax
  app.get("/api/stock-in/history/filtered", async (req, res) => {
    try {
      const { startDate, endDate, company, product, colorCode, colorName } = req.query

      console.log("[API] Fetching filtered stock history with filters:", {
        startDate,
        endDate,
        company,
        product,
        colorCode,
        colorName,
      })

      const filters: any = {}

      if (startDate && startDate !== "null" && startDate !== "undefined") {
        filters.startDate = new Date(startDate as string)
      }

      if (endDate && endDate !== "null" && endDate !== "undefined") {
        filters.endDate = new Date(endDate as string)
        // Set end date to end of day
        filters.endDate.setHours(23, 59, 59, 999)
      }

      if (company && company !== "all" && company !== "null" && company !== "undefined") {
        filters.company = company as string
      }

      if (product && product !== "all" && product !== "null" && product !== "undefined") {
        filters.product = product as string
      }

      if (colorCode && colorCode !== "null" && colorCode !== "undefined") {
        filters.colorCode = colorCode as string
      }

      if (colorName && colorName !== "null" && colorName !== "undefined") {
        filters.colorName = colorName as string
      }

      const history = await storage.getFilteredStockInHistory(filters)
      console.log(`[API] Returning ${history.length} filtered history records`)
      res.json(history)
    } catch (error) {
      console.error("[API] Error fetching filtered stock history:", error)
      res.status(500).json({ error: "Failed to fetch filtered stock history" })
    }
  })

  // Delete Stock In History Record
  app.delete("/api/stock-in/history/:id", requirePerm("stockHistory:delete"), async (req, res) => {
    try {
      const { id } = req.params
      console.log(`[API] Deleting stock history record: ${id}`)

      await storage.deleteStockInHistory(id)
      res.json({ success: true, message: "Stock history record deleted successfully" })
    } catch (error) {
      console.error("[API] Error deleting stock history:", error)
      res.status(500).json({ error: "Failed to delete stock history record" })
    }
  })

  // FIXED: Update Stock In History Record with proper new stock calculation
  app.patch("/api/stock-in/history/:id", requirePerm("stock:edit"), async (req, res) => {
    try {
      const { id } = req.params
      const { quantity, notes, stockInDate } = req.body

      console.log(`[API] Updating stock history record: ${id}`, { quantity, notes, stockInDate })

      if (quantity !== undefined && (typeof quantity !== "number" || quantity <= 0)) {
        res.status(400).json({ error: "Invalid quantity" })
        return
      }

      // Validate stockInDate format if provided
      if (stockInDate && !/^\d{2}-\d{2}-\d{4}$/.test(stockInDate)) {
        res.status(400).json({
          error: "Invalid date format",
          details: "Stock in date must be in DD-MM-YYYY format",
        })
        return
      }

      // Use the fixed updateStockInHistory function that recalculates newStock
      const updatedRecord = await storage.updateStockInHistory(id, { quantity, notes, stockInDate })

      res.json(updatedRecord)
    } catch (error) {
      console.error("[API] Error updating stock history:", error)
      res.status(500).json({ error: "Failed to update stock history record" })
    }
  })

  // Stock Out History (items sold through POS)
  app.get("/api/stock-out/history", async (_req, res) => {
    try {
      console.log("[API] Fetching stock out history (sold items)")
      
      // Fetch all sale items with their related data
      const allSales = await storage.getSales()
      const allColors = await storage.getColors()
      
      // Create a map of colors by ID for quick lookup
      const colorMap = new Map(allColors.map(c => [c.id, c]))
      
      // Build stock out history from sale items
      const stockOutHistory = []
      
      for (const sale of allSales) {
        if (sale.isManualBalance) continue // Skip manual balance entries
        
        const saleItems = await storage.getSaleItems(sale.id)
        for (const item of saleItems) {
          const color = colorMap.get(item.colorId)
          if (color) {
            stockOutHistory.push({
              id: item.id,
              saleId: sale.id,
              colorId: item.colorId,
              quantity: item.quantity,
              rate: item.rate,
              subtotal: item.subtotal,
              color: color,
              soldAt: sale.createdAt,
              customerName: sale.customerName,
              customerPhone: sale.customerPhone,
            })
          }
        }
      }
      
      // Sort by date (newest first)
      stockOutHistory.sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime())
      
      console.log(`[API] Returning ${stockOutHistory.length} stock out records`)
      res.json(stockOutHistory)
    } catch (error) {
      console.error("[API] Error fetching stock out history:", error)
      res.json([])
    }
  })

  // Payment History routes
  app.get("/api/payment-history", async (_req, res) => {
    try {
      const history = await storage.getAllPaymentHistory()
      res.json(history)
    } catch (error) {
      console.error("Error fetching all payment history:", error)
      res.status(500).json({ error: "Failed to fetch payment history" })
    }
  })

  // OPTIMIZED: Paginated payment history endpoint for large datasets
  app.get("/api/payment-history/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 100
      const result = await storage.getAllPaymentHistoryPaginated({ page, limit })
      res.json(result)
    } catch (error) {
      console.error("Error fetching paginated payment history:", error)
      res.status(500).json({ error: "Failed to fetch paginated payment history" })
    }
  })

  app.get("/api/payment-history/customer/:phone", async (req, res) => {
    try {
      const history = await storage.getPaymentHistoryByCustomer(req.params.phone)
      res.json(history)
    } catch (error) {
      console.error("Error fetching payment history:", error)
      res.status(500).json({ error: "Failed to fetch payment history" })
    }
  })

  app.get("/api/payment-history/sale/:saleId", async (req, res) => {
    try {
      const history = await storage.getPaymentHistoryBySale(req.params.saleId)
      res.json(history)
    } catch (error) {
      console.error("Error fetching payment history:", error)
      res.status(500).json({ error: "Failed to fetch payment history" })
    }
  })

  // Record Payment History (for direct recording if needed)
  app.post("/api/payment-history", async (req, res) => {
    try {
      const validated = insertPaymentHistorySchema.parse(req.body)
      const paymentHistory = await storage.recordPaymentHistory({
        saleId: validated.saleId,
        customerPhone: validated.customerPhone,
        amount: Number.parseFloat(validated.amount),
        previousBalance: Number.parseFloat(validated.previousBalance),
        newBalance: Number.parseFloat(validated.newBalance),
        paymentMethod: validated.paymentMethod,
        notes: validated.notes ?? undefined,
      })

      res.json(paymentHistory)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid payment history data", details: error.errors })
      } else {
        console.error("Error creating payment history:", error)
        res.status(500).json({ error: "Failed to create payment history" })
      }
    }
  })

  // Update Payment History
  app.patch("/api/payment-history/:id", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { id } = req.params
      const { amount, paymentMethod, notes } = req.body

      const updated = await storage.updatePaymentHistory(id, {
        amount: amount !== undefined ? Number.parseFloat(amount) : undefined,
        paymentMethod,
        notes,
      })

      if (!updated) {
        res.status(404).json({ error: "Payment record not found" })
        return
      }

      res.json(updated)
    } catch (error) {
      console.error("Error updating payment history:", error)
      res.status(500).json({ error: "Failed to update payment history" })
    }
  })

  // Delete Payment History
  app.delete("/api/payment-history/:id", requirePerm("payment:delete"), async (req, res) => {
    try {
      const { id } = req.params
      const deleted = await storage.deletePaymentHistory(id)

      if (!deleted) {
        res.status(404).json({ error: "Payment record not found" })
        return
      }

      res.json({ success: true })
    } catch (error) {
      console.error("Error deleting payment history:", error)
      res.status(500).json({ error: "Failed to delete payment history" })
    }
  })

  // Customer Notes routes - FIXED: Proper implementation
  app.get("/api/customer/:phone/notes", async (req, res) => {
    try {
      const { phone } = req.params
      const sales = await storage.getSales()

      // Get all notes from manual balance sales for this customer
      const customerNotes = sales
        .filter((sale) => sale.customerPhone === phone && sale.isManualBalance && sale.notes)
        .map((sale) => ({
          id: sale.id,
          saleId: sale.id,
          note: sale.notes!,
          createdBy: "System",
          createdAt: sale.createdAt,
        }))

      res.json(customerNotes)
    } catch (error) {
      console.error("Error fetching customer notes:", error)
      res.status(500).json({ error: "Failed to fetch customer notes" })
    }
  })

  // Add customer note
  app.post("/api/customer/:phone/notes", async (req, res) => {
    try {
      const { phone } = req.params
      const { note } = req.body

      if (!note) {
        res.status(400).json({ error: "Note is required" })
        return
      }

      // Get customer name from existing sales
      const sales = await storage.getSales()
      const customerSale = sales.find((sale) => sale.customerPhone === phone)
      const customerName = customerSale?.customerName || "Customer"

      // Create a manual balance sale with the note
      const sale = await storage.createManualBalance({
        customerName: customerName,
        customerPhone: phone,
        totalAmount: "0",
        dueDate: null,
        notes: note,
      })

      res.json({
        success: true,
        note: {
          id: sale.id,
          saleId: sale.id,
          note: sale.notes!,
          createdBy: "System",
          createdAt: sale.createdAt,
        },
      })
    } catch (error) {
      console.error("Error adding customer note:", error)
      res.status(500).json({ error: "Failed to add customer note" })
    }
  })

  // ============ SALES ROUTES ============

  // Sales (with items for returns page)
  app.get("/api/sales", async (_req, res) => {
    try {
      const sales = await storage.getSalesWithItems()
      res.json(sales)
    } catch (error) {
      console.error("Error fetching sales:", error)
      res.status(500).json({ error: "Failed to fetch sales" })
    }
  })

  // OPTIMIZED: Paginated sales endpoint for large datasets
  app.get("/api/sales/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 100
      const result = await storage.getSalesPaginated({ page, limit })
      res.json(result)
    } catch (error) {
      console.error("Error fetching paginated sales:", error)
      res.status(500).json({ error: "Failed to fetch paginated sales" })
    }
  })

  // Unpaid sales - FIXED
  app.get("/api/sales/unpaid", async (_req, res) => {
    try {
      console.log("[API] Fetching unpaid sales")
      const unpaidSales = await storage.getUnpaidSales()
      console.log(`[API] Found ${unpaidSales.length} unpaid sales`)
      res.json(unpaidSales)
    } catch (error) {
      console.error("[API] Error fetching unpaid sales:", error)
      res.status(500).json({ error: "Failed to fetch unpaid sales" })
    }
  })

  // OPTIMIZED: Paginated unpaid sales endpoint
  app.get("/api/sales/unpaid/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 100
      const result = await storage.getUnpaidSalesPaginated({ page, limit })
      res.json(result)
    } catch (error) {
      console.error("Error fetching paginated unpaid sales:", error)
      res.status(500).json({ error: "Failed to fetch paginated unpaid sales" })
    }
  })

  // Get all sales for a customer (paid + unpaid)
  app.get("/api/sales/customer/:phone", async (req, res) => {
    try {
      const sales = await storage.getSalesByCustomerPhone(req.params.phone)
      res.json(sales)
    } catch (error) {
      console.error("Error fetching customer sales:", error)
      res.status(500).json({ error: "Failed to fetch customer sales" })
    }
  })

  // NEW: Get customer purchase history with return adjustments
  app.get("/api/customer/:phone/purchase-history", async (req, res) => {
    try {
      const { phone } = req.params
      console.log(`[API] Fetching purchase history for customer: ${phone}`)

      const purchaseHistory = await storage.getCustomerPurchaseHistory(phone)
      res.json(purchaseHistory)
    } catch (error) {
      console.error("[API] Error fetching customer purchase history:", error)
      res.status(500).json({ error: "Failed to fetch customer purchase history" })
    }
  })

  // Get all sales with items for a customer (for statement details) - UPDATED
  app.get("/api/sales/customer/:phone/with-items", async (req, res) => {
    try {
      const { phone } = req.params

      if (!phone || phone.trim() === "") {
        return res.status(400).json({ error: "Phone number is required" })
      }

      console.log(`[API] Fetching customer sales with items for: ${phone}`)
      const purchaseHistory = await storage.getCustomerPurchaseHistory(phone)

      if (!purchaseHistory || !purchaseHistory.adjustedSales) {
        return res.json({ adjustedSales: [] })
      }

      res.json(purchaseHistory.adjustedSales)
    } catch (error) {
      console.error("Error fetching customer sales with items:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("Full error details:", errorMessage)
      res.status(500).json({
        error: "Failed to fetch customer sales with items",
        details: errorMessage,
      })
    }
  })

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id)
      if (!sale) {
        res.status(404).json({ error: "Sale not found" })
        return
      }
      res.json(sale)
    } catch (error) {
      console.error("Error fetching sale:", error)
      res.status(500).json({ error: "Failed to fetch sale" })
    }
  })

  // OPTIMIZED: Combined customer statement endpoint - fetches all data in one request
  app.get("/api/customer/:phone/statement", async (req, res) => {
    try {
      const { phone } = req.params
      
      if (!phone || phone.trim() === "") {
        return res.status(400).json({ error: "Phone number is required" })
      }

      console.log(`[API] Fetching combined customer statement for: ${phone}`)
      
      // Fetch all data in parallel for faster response
      const [purchaseHistory, paymentHistory, returns] = await Promise.all([
        storage.getCustomerPurchaseHistory(phone),
        storage.getPaymentHistoryByCustomer(phone),
        storage.getReturnsByCustomerPhone(phone)
      ])

      const response = {
        sales: purchaseHistory?.originalSales || [],
        payments: paymentHistory || [],
        returns: returns || [],
        summary: {
          totalSales: (purchaseHistory?.originalSales || []).length,
          totalPayments: paymentHistory?.length || 0,
          totalReturns: returns?.length || 0
        }
      }

      res.json(response)
    } catch (error) {
      console.error("Error fetching customer statement:", error)
      res.json({
        sales: [],
        payments: [],
        returns: [],
        summary: { totalSales: 0, totalPayments: 0, totalReturns: 0 }
      })
    }
  })

  // Customer Suggestions - FIXED: Show ALL customers, not just top 10
  app.get("/api/customers/suggestions", async (_req, res) => {
    try {
      const sales = await storage.getSales()

      const customerMap = new Map()

      sales.forEach((sale) => {
        if (!sale.customerPhone) return

        const existing = customerMap.get(sale.customerPhone)
        if (!existing || new Date(sale.createdAt) > new Date(existing.lastSaleDate)) {
          customerMap.set(sale.customerPhone, {
            customerName: sale.customerName,
            customerPhone: sale.customerPhone,
            lastSaleDate: sale.createdAt,
            totalSpent: (existing?.totalSpent || 0) + Number.parseFloat(sale.totalAmount),
            transactionCount: (existing?.transactionCount || 0) + 1,
          })
        } else {
          existing.totalSpent += Number.parseFloat(sale.totalAmount)
          existing.transactionCount += 1
        }
      })

      // FIXED: Remove the .slice(0, 10) to show ALL customers
      const suggestions = Array.from(customerMap.values()).sort(
        (a, b) => new Date(b.lastSaleDate).getTime() - new Date(a.lastSaleDate).getTime(),
      )

      res.json(suggestions)
    } catch (error) {
      console.error("Error fetching customer suggestions:", error)
      res.status(500).json({ error: "Failed to fetch customer suggestions" })
    }
  })

  // Create sale
  app.post("/api/sales", requirePerm("sales:edit"), async (req, res) => {
    try {
      const { items, ...saleData } = req.body

      console.log("Creating sale - request body:", JSON.stringify(req.body, null, 2))

      const validatedSale = insertSaleSchema.parse(saleData)
      const validatedItems = z.array(insertSaleItemSchema).parse(items)

      // FIXED: Add missing properties
      const extendedSaleData = {
        ...validatedSale,
        dueDate: saleData.dueDate || null,
        isManualBalance: saleData.isManualBalance || false,
        notes: saleData.notes || null,
      }

      const sale = await storage.createSale(extendedSaleData, validatedItems)

      console.log("Sale created successfully:", JSON.stringify(sale, null, 2))

      res.json(sale)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error creating sale:", error.errors)
        res.status(400).json({ error: "Invalid sale data", details: error.errors })
      } else {
        console.error("Error creating sale:", error)
        res.status(500).json({ error: "Failed to create sale" })
      }
    }
  })

  // Record payment with strict validation
  app.post("/api/sales/:id/payment", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { amount, paymentMethod, notes } = req.body

      // Strict validation: must be a positive number, not NaN
      if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
        res.status(400).json({ error: "Invalid payment amount: must be a positive number" })
        return
      }

      // Round to 2 decimal places to avoid floating point issues
      const roundedAmount = Math.round(amount * 100) / 100

      // Get sale details before update
      const sale = await storage.getSale(req.params.id)
      if (!sale) {
        res.status(404).json({ error: "Sale not found" })
        return
      }

      const totalAmount = Math.round(Number.parseFloat(sale.totalAmount || "0") * 100) / 100
      const amountPaid = Math.round(Number.parseFloat(sale.amountPaid || "0") * 100) / 100
      const outstanding = Math.round(Math.max(0, totalAmount - amountPaid) * 100) / 100

      if (roundedAmount > outstanding) {
        res.status(400).json({
          error: `Payment amount (Rs. ${roundedAmount}) exceeds outstanding balance (Rs. ${outstanding})`,
        })
        return
      }

      try {
        // Record payment with proper balance tracking (use rounded amount)
        const updatedSale = await storage.updateSalePayment(req.params.id, roundedAmount, paymentMethod, notes)

        res.json(updatedSale)
      } catch (storageError) {
        console.error("[API] Storage error on payment update:", storageError)
        res.status(500).json({
          error: storageError instanceof Error ? storageError.message : "Failed to record payment",
        })
      }
    } catch (error) {
      console.error("Error recording payment:", error)
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to record payment" 
      })
    }
  })

  // Update paid amount directly (for bill editing)
  app.patch("/api/sales/:id/paid-amount", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { amountPaid } = req.body

      if (typeof amountPaid !== "number" || isNaN(amountPaid) || amountPaid < 0) {
        res.status(400).json({ error: "Invalid amount: must be a non-negative number" })
        return
      }

      const sale = await storage.getSale(req.params.id)
      if (!sale) {
        res.status(404).json({ error: "Sale not found" })
        return
      }

      // Round to 2 decimal places
      const roundedAmount = Math.round(amountPaid * 100) / 100
      const totalAmount = Math.round(Number.parseFloat(sale.totalAmount || "0") * 100) / 100

      // Calculate new payment status
      let paymentStatus = "unpaid"
      if (roundedAmount >= totalAmount) {
        paymentStatus = "paid"
      } else if (roundedAmount > 0) {
        paymentStatus = "partial"
      }

      // Update the sale's paid amount and status directly
      const updatedSale = await storage.updateSalePaidAmount(req.params.id, roundedAmount, paymentStatus)

      res.json(updatedSale)
    } catch (error) {
      console.error("Error updating paid amount:", error)
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to update paid amount" 
      })
    }
  })

  app.post("/api/sales/:id/items", requirePerm("sales:edit"), async (req, res) => {
    try {
      const validated = insertSaleItemSchema.parse(req.body)
      const saleItem = await storage.addSaleItem(req.params.id, validated)

      res.json(saleItem)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid sale item data", details: error.errors })
      } else {
        console.error("Error adding sale item:", error)
        res.status(500).json({ error: "Failed to add sale item" })
      }
    }
  })

  // UPDATE SALE ITEM ENDPOINT
  app.patch("/api/sale-items/:id", requirePerm("sales:edit"), async (req, res) => {
    try {
      const { quantity, rate, subtotal } = req.body

      if (typeof quantity !== "number" || quantity <= 0) {
        res.status(400).json({ error: "Invalid quantity" })
        return
      }

      if (typeof rate !== "number" || rate <= 0) {
        res.status(400).json({ error: "Invalid rate" })
        return
      }

      // Get sale item details to find customer phone
      const saleItems = await storage.getSaleItems()
      const currentItem = saleItems.find((item) => item.id === req.params.id)
      if (!currentItem) {
        res.status(404).json({ error: "Sale item not found" })
        return
      }

      const sale = await storage.getSale(currentItem.saleId)
      if (!sale) {
        res.status(404).json({ error: "Sale not found" })
        return
      }

      const saleItem = await storage.updateSaleItem(req.params.id, {
        quantity,
        rate,
        subtotal: rate * quantity,
      })

      res.json(saleItem)
    } catch (error) {
      console.error("Error updating sale item:", error)
      res.status(500).json({ error: "Failed to update sale item" })
    }
  })

  // DELETE SALE ITEM
  app.delete("/api/sale-items/:id", requirePerm("sales:delete"), async (req, res) => {
    try {
      // Get sale item details to find customer phone
      const saleItems = await storage.getSaleItems()
      const item = saleItems.find((si) => si.id === req.params.id)
      if (!item) {
        res.status(404).json({ error: "Sale item not found" })
        return
      }

      const sale = await storage.getSale(item.saleId)
      if (!sale) {
        res.status(404).json({ error: "Sale not found" })
        return
      }

      await storage.deleteSaleItem(req.params.id)

      res.json({ success: true })
    } catch (error) {
      console.error("Error deleting sale item:", error)
      res.status(500).json({ error: "Failed to delete sale item" })
    }
  })

  // Create manual pending balance (no items, just a balance record)
  app.post("/api/sales/manual-balance", requirePerm("sales:edit"), async (req, res) => {
    try {
      const { customerName, customerPhone, totalAmount, dueDate, notes } = req.body

      if (!customerName || !customerPhone || !totalAmount) {
        res.status(400).json({ error: "Customer name, phone, and amount are required" })
        return
      }

      if (Number.parseFloat(totalAmount) <= 0) {
        res.status(400).json({ error: "Amount must be greater than 0" })
        return
      }

      const sale = await storage.createManualBalance({
        customerName,
        customerPhone,
        totalAmount: totalAmount.toString(),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
      })

      res.json(sale)
    } catch (error) {
      console.error("Error creating manual balance:", error)
      res.status(500).json({ error: "Failed to create manual balance" })
    }
  })

  // Update due date for a sale
  app.patch("/api/sales/:id/due-date", requirePerm("sales:edit"), async (req, res) => {
    try {
      const { dueDate, notes } = req.body

      // Get sale details before update to know customer phone
      const sale = await storage.getSale(req.params.id)
      if (!sale) {
        res.status(404).json({ error: "Sale not found" })
        return
      }

      const updatedSale = await storage.updateSaleDueDate(req.params.id, {
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
      })

      res.json(updatedSale)
    } catch (error) {
      console.error("Error updating due date:", error)
      res.status(500).json({ error: "Failed to update due date" })
    }
  })

  // Delete entire sale
  app.delete("/api/sales/:id", requirePerm("sales:delete"), async (req, res) => {
    try {
      // Get sale details before deletion to know customer phone
      const sale = await storage.getSale(req.params.id)
      if (!sale) {
        res.status(404).json({ error: "Sale not found" })
        return
      }

      const customerPhone = sale.customerPhone

      await storage.deleteSale(req.params.id)

      res.json({ success: true, message: "Sale deleted successfully" })
    } catch (error) {
      console.error("Error deleting sale:", error)
      res.status(500).json({ error: "Failed to delete sale" })
    }
  })

  // ============ RETURNS ROUTES ============

  // Get all returns
  app.get("/api/returns", async (_req, res) => {
    try {
      console.log("[API] Fetching returns")
      const returns = await storage.getReturns()
      console.log(`[API] Found ${returns.length} returns`)
      res.json(returns)
    } catch (error) {
      console.error("[API] Error fetching returns:", error)
      res.status(500).json({ error: "Failed to fetch returns" })
    }
  })

  // Create return
  app.post("/api/returns", async (req, res) => {
    try {
      const { returnData, items } = req.body
      console.log("[API] Creating return:", { returnData, items: items?.length })

      const returnRecord = await storage.createReturn(returnData, items || [])

      // Invalidate colors cache only
      invalidateCache("colors")

      res.json(returnRecord)
    } catch (error) {
      console.error("[API] Error creating return:", error)
      res.status(500).json({ error: "Failed to create return" })
    }
  })

  // Quick return
  app.post("/api/returns/quick", async (req, res) => {
    try {
      console.log("[API] Creating quick return:", req.body)
      const returnRecord = await storage.createQuickReturn(req.body)

      // Invalidate colors cache only
      invalidateCache("colors")

      res.json(returnRecord)
    } catch (error) {
      console.error("[API] Error creating quick return:", error)
      res.status(500).json({ error: "Failed to create quick return" })
    }
  })

  // Get return by ID
  app.get("/api/returns/:id", async (req, res) => {
    try {
      const returnRecord = await storage.getReturn(req.params.id)
      if (!returnRecord) {
        res.status(404).json({ error: "Return not found" })
        return
      }
      res.json(returnRecord)
    } catch (error) {
      console.error("[API] Error fetching return:", error)
      res.status(500).json({ error: "Failed to fetch return" })
    }
  })

  // Get returns by customer phone
  app.get("/api/returns/customer/:phone", async (req, res) => {
    try {
      const returns = await storage.getReturnsByCustomerPhone(req.params.phone)
      res.json(returns)
    } catch (error) {
      console.error("[API] Error fetching customer returns:", error)
      res.status(500).json({ error: "Failed to fetch customer returns" })
    }
  })

  // ============ END RETURNS ROUTES ============

  // Dashboard Stats
  app.get("/api/dashboard-stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats()
      res.json(stats)
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
      res.status(500).json({ error: "Failed to fetch dashboard stats" })
    }
  })

  // Database Export/Import - FIXED: Proper SQLite validation
  app.get("/api/database/export", async (_req, res) => {
    try {
      const { getDatabasePath } = await import("./db")
      const fs = await import("fs/promises")
      const path = await import("path")

      const dbPath = getDatabasePath()
      const fileName = `paintpulse-backup-${new Date().toISOString().split("T")[0]}.db`

      // Check if database file exists
      const stats = await fs.stat(dbPath)
      if (!stats.isFile()) {
        throw new Error("Database file not found")
      }

      // Set headers for file download
      res.setHeader("Content-Type", "application/octet-stream")
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
      res.setHeader("Content-Length", stats.size)

      // Stream the file
      const fileStream = (await import("fs")).createReadStream(dbPath)
      fileStream.pipe(res)
    } catch (error) {
      console.error("Error exporting database:", error)
      res.status(500).json({ error: "Failed to export database" })
    }
  })

  app.post("/api/database/import", async (req, res) => {
    try {
      const { getDatabasePath, setDatabasePath } = await import("./db")
      const fs = await import("fs/promises")
      const path = await import("path")
      const os = await import("os")

      // Get the uploaded file from request body (base64)
      const { fileData } = req.body

      if (!fileData) {
        res.status(400).json({ error: "No file data provided" })
        return
      }

      // Create temporary file
      const tempPath = path.join(os.tmpdir(), `paintpulse-import-${Date.now()}.db`)

      // Decode base64 and write to temp file
      const buffer = Buffer.from(fileData, "base64")
      await fs.writeFile(tempPath, buffer)

      // FIXED: Proper SQLite binary validation
      const headerBuffer = await fs.readFile(tempPath, { end: 15 })
      const header = headerBuffer.toString("ascii", 0, 15)

      if (header !== "SQLite format 3\0") {
        await fs.unlink(tempPath)
        res.status(400).json({ error: "Invalid SQLite database file" })
        return
      }

      // Backup current database
      const currentDbPath = getDatabasePath()
      const backupPath = `${currentDbPath}.backup-${Date.now()}`

      try {
        await fs.copyFile(currentDbPath, backupPath)
      } catch (error) {
        console.log("No existing database to backup")
      }

      // Replace current database with uploaded one
      await fs.copyFile(tempPath, currentDbPath)
      await fs.unlink(tempPath)

      // Reinitialize database connection
      setDatabasePath(currentDbPath)

      res.json({
        success: true,
        message: "Database imported successfully. Please refresh the page.",
      })
    } catch (error) {
      console.error("Error importing database:", error)
      res.status(500).json({ error: "Failed to import database" })
    }
  })

  // Settings routes - with in-memory caching
  app.get("/api/settings", async (req, res) => {
    try {
      // Check cache first
      const cached = getCached<any>("settings")
      if (cached) {
        return res.json(cached)
      }
      
      const settings = await storage.getSettings()
      setCache("settings", settings, CACHE_TTL.settings)
      res.json(settings)
    } catch (error) {
      console.error("[API] Error getting settings:", error)
      res.status(500).json({
        error: "Failed to fetch settings",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  })

  app.patch("/api/settings", async (req, res) => {
    try {
      const updated = await storage.updateSettings(req.body)
      invalidateCache("settings") // Invalidate cache on update
      res.json(updated)
    } catch (error) {
      console.error("[API] Error updating settings:", error)
      res.status(500).json({
        error: "Failed to update settings",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  })

  // ============ FIXED AUDIT ROUTES ============
  app.get("/api/audit/has-pin", async (req, res) => {
    try {
      const settings = await storage.getSettings()
      // FIXED: Proper default PIN logic
      const hasPin = !!(settings.auditPinHash && settings.auditPinSalt)
      const isDefault = !hasPin // Only default if no PIN is set

      res.json({
        hasPin,
        isDefault,
      })
    } catch (error) {
      console.error("[API] Error checking PIN:", error)
      res.status(200).json({ hasPin: false, isDefault: true })
    }
  })

  app.post("/api/audit/verify", async (req, res) => {
    try {
      const { pin } = req.body

      if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits" })
      }

      const settings = await storage.getSettings()

      // If no PIN is set, default PIN is "0000"
      if (!settings.auditPinHash || !settings.auditPinSalt) {
        if (pin === "0000") {
          const token = crypto.randomBytes(32).toString("hex")
          auditTokens.set(token, { createdAt: Date.now() })
          return res.json({
            ok: true,
            isDefault: true,
            auditToken: token,
          })
        } else {
          return res.status(401).json({ error: "Invalid PIN", ok: false })
        }
      }

      // Verify against stored hash
      const hashedInput = hashPin(pin, settings.auditPinSalt)
      if (hashedInput === settings.auditPinHash) {
        const token = crypto.randomBytes(32).toString("hex")
        auditTokens.set(token, { createdAt: Date.now() })
        return res.json({
          ok: true,
          isDefault: false,
          auditToken: token,
        })
      } else {
        return res.status(401).json({ error: "Invalid PIN", ok: false })
      }
    } catch (error) {
      console.error("Error verifying audit PIN:", error)
      res.status(500).json({ error: "Failed to verify audit PIN" })
    }
  })

  app.patch("/api/audit/pin", async (req, res) => {
    try {
      const { currentPin, newPin } = req.body

      if (!newPin || typeof newPin !== "string" || newPin.length !== 4) {
        return res.status(400).json({ error: "New PIN must be 4 digits" })
      }

      const settings = await storage.getSettings()

      // Verify current PIN
      let isValid = false

      if (!settings.auditPinHash || !settings.auditPinSalt) {
        // No PIN set yet, check against default
        isValid = currentPin === "0000"
      } else {
        // Check against stored hash
        if (!currentPin || typeof currentPin !== "string" || currentPin.length !== 4) {
          return res.status(400).json({ error: "Current PIN must be 4 digits" })
        }
        const hashedCurrent = hashPin(currentPin, settings.auditPinSalt)
        isValid = hashedCurrent === settings.auditPinHash
      }

      if (!isValid) {
        return res.status(401).json({ error: "Current PIN is incorrect" })
      }

      // Generate new salt and hash
      const newSalt = crypto.randomBytes(16).toString("hex")
      const newHash = hashPin(newPin, newSalt)

      // Update settings
      await storage.updateSettings({
        auditPinSalt: newSalt,
        auditPinHash: newHash,
      })

      // Invalidate all existing audit tokens
      auditTokens.clear()

      res.json({ success: true, message: "PIN changed successfully" })
    } catch (error) {
      console.error("Error changing audit PIN:", error)
      res.status(500).json({ error: "Failed to change audit PIN" })
    }
  })

  // Stock Out History for Audit (protected)
  app.get("/api/audit/stock-out", verifyAuditToken, async (_req, res) => {
    try {
      const stockOut = await storage.getStockOutHistory()
      res.json(stockOut)
    } catch (error) {
      console.error("Error fetching stock out history:", error)
      res.status(500).json({ error: "Failed to fetch stock out history" })
    }
  })

  // Unpaid Bills for Audit (protected)
  app.get("/api/audit/unpaid-bills", verifyAuditToken, async (_req, res) => {
    try {
      const unpaidSales = await storage.getUnpaidSales()
      res.json(unpaidSales)
    } catch (error) {
      console.error("Error fetching unpaid bills:", error)
      res.status(500).json({ error: "Failed to fetch unpaid bills" })
    }
  })

  // Payment History for Audit (protected)
  app.get("/api/audit/payments", verifyAuditToken, async (_req, res) => {
    try {
      const payments = await storage.getAllPaymentHistory()
      res.json(payments)
    } catch (error) {
      console.error("Error fetching payment history:", error)
      res.status(500).json({ error: "Failed to fetch payment history" })
    }
  })

  // Returns for Audit (protected)
  app.get("/api/audit/returns", verifyAuditToken, async (_req, res) => {
    try {
      const returns = await storage.getReturns()
      res.json(returns)
    } catch (error) {
      console.error("Error fetching returns:", error)
      res.status(500).json({ error: "Failed to fetch returns" })
    }
  })

  // ============ CLOUD DATABASE SYNC ENDPOINTS (NEON ONLY) ============

  // Test Neon database connection
  app.post("/api/cloud/test-connection", verifyAuditToken, async (req, res) => {
    try {
      const { connectionUrl } = req.body

      if (!connectionUrl || typeof connectionUrl !== "string" || !connectionUrl.trim()) {
        res.status(400).json({
          error: "Connection URL is required",
          ok: false,
        })
        return
      }

      // Validate URL format
      if (!connectionUrl.startsWith('postgresql://')) {
        res.status(400).json({
          error: "URL must start with postgresql://",
          ok: false,
        })
        return
      }

      try {
        const { sql } = await getNeonSqlClient(connectionUrl)
        
        // Test with simple query
        const result = await sql`SELECT version() as neon_version, now() as server_time`
        
        // Verify we can create tables
        await sql`CREATE TABLE IF NOT EXISTS test_paintpulse (id SERIAL PRIMARY KEY, test TEXT)`
        await sql`DROP TABLE IF EXISTS test_paintpulse`
        
        // Save URL to settings
        await storage.updateSettings({
          cloudDatabaseUrl: connectionUrl,
          cloudSyncEnabled: true
        })

        res.json({
          ok: true,
          message: "Neon connection successful",
          details: {
            provider: "Neon",
            version: result[0]?.neon_version?.substring(0, 50),
            serverTime: result[0]?.server_time,
          },
        })
      } catch (error: any) {
        console.error("[Neon] Connection test failed:", error.message)
        
        let errorMessage = "Neon connection failed"
        if (error.message?.includes("SSL")) {
          errorMessage = "SSL error. Add ?sslmode=require to your connection URL."
        } else if (error.message?.includes("authentication")) {
          errorMessage = "Authentication failed. Check username/password."
        } else if (error.message?.includes("does not exist")) {
          errorMessage = "Database does not exist. Create it in Neon dashboard first."
        }
        
        res.status(400).json({
          ok: false,
          error: errorMessage,
          details: error.message,
        })
      }
    } catch (error: any) {
      console.error("Connection test error:", error)
      res.status(500).json({
        ok: false,
        error: "Failed to test connection",
        details: error.message,
      })
    }
  })

  // Save cloud database settings
  app.post("/api/cloud/save-settings", verifyAuditToken, async (req, res) => {
    try {
      const { connectionUrl, syncEnabled } = req.body

      if (connectionUrl) {
        try {
          new URL(connectionUrl)
        } catch {
          res.status(400).json({ error: "Invalid connection URL format" })
          return
        }
      }

      await storage.updateSettings({
        cloudDatabaseUrl: connectionUrl || null,
        cloudSyncEnabled: syncEnabled ?? false,
      })

      res.json({ ok: true, message: "Cloud settings saved" })
    } catch (error: any) {
      console.error("Error saving cloud settings:", error)
      res.status(500).json({ error: "Failed to save cloud settings" })
    }
  })

  // Get cloud sync status
  app.get("/api/cloud/status", verifyAuditToken, async (_req, res) => {
    try {
      const settings = await storage.getSettings()
      
      let connectionStatus = "not_configured"
      let dataInCloud = null
      
      if (settings.cloudDatabaseUrl) {
        try {
          const { sql } = await getNeonSqlClient(settings.cloudDatabaseUrl)
          
          // Test connection
          await sql`SELECT 1`
          connectionStatus = "connected"
          
          // Check if data exists
          try {
            const productCount = await sql`SELECT COUNT(*) as count FROM products`
            const salesCount = await sql`SELECT COUNT(*) as count FROM sales`
            dataInCloud = {
              products: parseInt(productCount[0]?.count || "0"),
              sales: parseInt(salesCount[0]?.count || "0")
            }
          } catch (e) {
            // Tables might not exist yet
            dataInCloud = { products: 0, sales: 0 }
          }
        } catch (error) {
          connectionStatus = "connection_failed"
        }
      }
      
      res.json({
        hasConnection: !!settings.cloudDatabaseUrl,
        connectionStatus,
        syncEnabled: settings.cloudSyncEnabled || false,
        lastSyncTime: settings.lastSyncTime,
        dataInCloud,
        autoSyncEnabled,
        note: "Auto-sync runs in background without refreshing UI"
      })
    } catch (error) {
      console.error("Error getting cloud status:", error)
      res.status(500).json({ error: "Failed to get cloud status" })
    }
  })

  // Auto-sync control - NO AUTO REFRESH
  app.post("/api/cloud/auto-sync", verifyAuditToken, async (req, res) => {
    try {
      const { enabled, intervalMinutes } = req.body

      autoSyncEnabled = enabled ?? autoSyncEnabled

      // Clear existing interval
      if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
      }

      // Start new interval if enabled
      if (autoSyncEnabled && intervalMinutes) {
        syncInterval = setInterval(triggerSilentSync, intervalMinutes * 60 * 1000)
        console.log(`[Auto-Sync] Enabled with ${intervalMinutes} minute interval (silent mode)`)
      }

      // Save settings
      await storage.updateSettings({
        cloudSyncEnabled: autoSyncEnabled,
        cloudSyncInterval: intervalMinutes || 5
      })

      res.json({
        ok: true,
        autoSyncEnabled,
        message: autoSyncEnabled 
          ? `Auto-sync enabled (every ${intervalMinutes} minutes)` 
          : "Auto-sync disabled",
        note: "Sync runs in background without UI refresh"
      })
    } catch (error: any) {
      console.error("Error configuring auto-sync:", error)
      res.status(500).json({ error: "Failed to configure auto-sync" })
    }
  })

  // Manual sync trigger
  app.post("/api/cloud/trigger-sync", verifyAuditToken, async (_req, res) => {
    try {
      await triggerSilentSync()
      
      res.json({
        ok: true,
        message: "Sync completed in background"
      })
    } catch (error: any) {
      console.error("Error triggering sync:", error)
      res.status(500).json({ error: "Failed to trigger sync" })
    }
  })

  // Export data to Neon PostgreSQL - FIXED: NO AUTO REFRESH
  app.post("/api/cloud/export", verifyAuditToken, async (_req, res) => {
    try {
      console.log("[API] Export to Neon requested")
      
      const data = await exportToNeonData()
      
      res.json({
        ok: true,
        ...data,
        note: "Data exported successfully. No automatic refresh triggered."
      })
    } catch (error: any) {
      console.error("Neon export failed:", error)
      res.status(500).json({ 
        ok: false,
        error: error.message || "Export failed" 
      })
    }
  })

  // Import data from Neon PostgreSQL
  app.post("/api/cloud/import", verifyAuditToken, async (_req, res) => {
    try {
      console.log("[API] Import from Neon requested")
      
      const data = await importFromNeonData()
      
      res.json({
        ok: true,
        ...data,
        note: "Data imported successfully. Refresh page to see changes."
      })
    } catch (error: any) {
      console.error("Neon import failed:", error)
      res.status(500).json({ 
        ok: false,
        error: error.message || "Import failed" 
      })
    }
  })

  // Add debug test endpoint for Neon connection
  app.post("/api/cloud/debug-test", verifyAuditToken, async (req, res) => {
    try {
      const { connectionUrl } = req.body || (await storage.getSettings()).cloudDatabaseUrl
      
      if (!connectionUrl) {
        return res.status(400).json({ error: "No connection URL provided" })
      }
      
      const { sql } = await getNeonSqlClient(connectionUrl)
      
      // Test basic query
      const versionResult = await sql`SELECT version()`
      
      // Test creating a simple table
      await sql`CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT)`
      
      // Test inserting data
      await sql`INSERT INTO test_table (name) VALUES ('test')`
      
      // Test reading data
      const readResult = await sql`SELECT * FROM test_table`
      
      // Clean up
      await sql`DROP TABLE IF EXISTS test_table`
      
      res.json({
        success: true,
        version: versionResult[0]?.version,
        testData: readResult,
        message: "Neon connection and basic operations working correctly"
      })
    } catch (error: any) {
      console.error("Neon debug test failed:", error)
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.toString()
      })
    }
  })

  // ============ SOFTWARE LICENSE MANAGEMENT ============
  
  // Master PIN for software blocking
  const MASTER_ADMIN_PIN = process.env.MASTER_ADMIN_PIN || "3620192373285"

  // Verify master admin PIN
  function verifyMasterPin(pin: string): boolean {
    if (!pin || !MASTER_ADMIN_PIN) return false
    return pin === MASTER_ADMIN_PIN
  }

  // Check license status
  app.post("/api/license/check", async (req, res) => {
    try {
      const { deviceId, deviceName, storeName } = req.body
      
      if (!deviceId) {
        res.status(400).json({ error: "Device ID is required" })
        return
      }
      
      const now = new Date()
      
      // Check and apply any auto-blocks first (for all devices)
      await storage.checkAndApplyAutoBlocks()
      
      // Create or update the license record using client-provided deviceId
      let license = await storage.createOrUpdateSoftwareLicense({
        deviceId: deviceId,
        deviceName: deviceName || `Device-${deviceId.substring(0, 6)}`,
        storeName: storeName || "Unknown Store",
        lastHeartbeat: now,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      })

      // Re-fetch license to get any auto-block that was just applied
      const updatedLicense = await storage.getSoftwareLicense(deviceId)
      if (updatedLicense) {
        license = updatedLicense
      }

      res.json({
        deviceId: license.deviceId,
        status: license.status,
        isBlocked: license.status === "blocked",
        blockedReason: license.blockedReason,
        blockedAt: license.blockedAt,
        autoBlockDate: license.autoBlockDate,
        message: license.status === "blocked" 
          ? `Software blocked: ${license.blockedReason || "Contact administrator"}` 
          : "License active",
      })
    } catch (error) {
      console.error("Error checking license:", error)
      res.status(500).json({ error: "Failed to check license" })
    }
  })

  // Get all registered devices (requires master PIN)
  app.post("/api/license/devices", async (req, res) => {
    try {
      const { masterPin } = req.body
      
      if (!verifyMasterPin(masterPin)) {
        res.status(403).json({ error: "Invalid master PIN" })
        return
      }

      const licenses = await storage.getSoftwareLicenses()
      res.json({ devices: licenses })
    } catch (error) {
      console.error("Error getting devices:", error)
      res.status(500).json({ error: "Failed to get devices" })
    }
  })

  // Block a device (requires master PIN)
  app.post("/api/license/block", async (req, res) => {
    try {
      const { masterPin, deviceId, reason } = req.body
      
      if (!verifyMasterPin(masterPin)) {
        res.status(403).json({ error: "Invalid master PIN" })
        return
      }

      if (!deviceId) {
        res.status(400).json({ error: "Device ID is required" })
        return
      }

      const license = await storage.blockSoftwareLicense(
        deviceId, 
        reason || "Blocked by administrator",
        "master_admin"
      )

      if (!license) {
        res.status(404).json({ error: "Device not found" })
        return
      }

      res.json({
        success: true,
        message: `Device ${deviceId} has been blocked`,
        device: license,
      })
    } catch (error) {
      console.error("Error blocking device:", error)
      res.status(500).json({ error: "Failed to block device" })
    }
  })

  // Unblock a device (requires master PIN)
  app.post("/api/license/unblock", async (req, res) => {
    try {
      const { masterPin, deviceId } = req.body
      
      if (!verifyMasterPin(masterPin)) {
        res.status(403).json({ error: "Invalid master PIN" })
        return
      }

      if (!deviceId) {
        res.status(400).json({ error: "Device ID is required" })
        return
      }

      const license = await storage.unblockSoftwareLicense(deviceId)

      if (!license) {
        res.status(404).json({ error: "Device not found" })
        return
      }

      res.json({
        success: true,
        message: `Device ${deviceId} has been unblocked`,
        device: license,
      })
    } catch (error) {
      console.error("Error unblocking device:", error)
      res.status(500).json({ error: "Failed to unblock device" })
    }
  })

  // Set auto-block date for a device (requires master PIN)
  app.post("/api/license/set-auto-block", async (req, res) => {
    try {
      const { masterPin, deviceId, autoBlockDate } = req.body
      
      if (!verifyMasterPin(masterPin)) {
        res.status(403).json({ error: "Invalid master PIN" })
        return
      }

      if (!deviceId) {
        res.status(400).json({ error: "Device ID is required" })
        return
      }

      const license = await storage.setAutoBlockDate(deviceId, autoBlockDate || null)

      if (!license) {
        res.status(404).json({ error: "Device not found" })
        return
      }

      res.json({
        success: true,
        message: autoBlockDate 
          ? `Auto-block date set to ${autoBlockDate}` 
          : "Auto-block date cleared",
        device: license,
      })
    } catch (error) {
      console.error("Error setting auto-block date:", error)
      res.status(500).json({ error: "Failed to set auto-block date" })
    }
  })

  // Get license audit log (requires master PIN) - POST version
  app.post("/api/license/audit", async (req, res) => {
    try {
      const { masterPin, deviceId } = req.body
      
      if (!verifyMasterPin(masterPin)) {
        res.status(403).json({ error: "Invalid master PIN" })
        return
      }

      const auditLog = await storage.getLicenseAuditLog(deviceId)
      res.json({ auditLog })
    } catch (error) {
      console.error("Error getting audit log:", error)
      res.status(500).json({ error: "Failed to get audit log" })
    }
  })

  // Verify master PIN (for admin panel access)
  app.post("/api/license/verify-pin", async (req, res) => {
    try {
      const { masterPin } = req.body
      
      if (!verifyMasterPin(masterPin)) {
        res.status(403).json({ valid: false, error: "Invalid master PIN" })
        return
      }

      res.json({ valid: true, message: "Master PIN verified" })
    } catch (error) {
      console.error("Error verifying PIN:", error)
      res.status(500).json({ error: "Failed to verify PIN" })
    }
  })

  // ============ OFFLINE POS SYNC ROUTES ============

  // Store pending offline sales
  app.post("/api/pos/offline-sales", async (req, res) => {
    try {
      const { saleData, items, offlineId, timestamp } = req.body
      
      if (!offlineId) {
        res.status(400).json({ error: "Offline ID is required" })
        return
      }
      
      // Store in pending sales table
      const pendingSale = await storage.createPendingSale({
        offlineId,
        saleData: JSON.stringify(saleData),
        items: JSON.stringify(items),
        timestamp: new Date(timestamp),
        status: "pending",
        attempts: 0
      })
      
      res.json({ 
        success: true, 
        pendingSale,
        message: "Sale stored offline, will sync when online"
      })
    } catch (error) {
      console.error("Error storing offline sale:", error)
      res.status(500).json({ error: "Failed to store offline sale" })
    }
  })

  // Sync pending sales when back online
  app.post("/api/pos/sync-pending", async (req, res) => {
    try {
      const { offlineIds } = req.body
      
      const pendingSales = await storage.getPendingSales()
      const results = []
      
      for (const pending of pendingSales) {
        if (offlineIds && !offlineIds.includes(pending.offlineId)) {
          continue
        }
        
        try {
          const saleData = JSON.parse(pending.saleData)
          const items = JSON.parse(pending.items)
          
          // Process the sale
          const sale = await storage.createSale(saleData, items)
          
          // Mark as synced
          await storage.updatePendingSale(pending.id, {
            status: "synced",
            syncedAt: new Date(),
            syncedSaleId: sale.id,
            attempts: pending.attempts + 1
          })
          
          results.push({
            offlineId: pending.offlineId,
            success: true,
            saleId: sale.id
          })
        } catch (error) {
          // Update attempt count
          await storage.updatePendingSale(pending.id, {
            attempts: pending.attempts + 1,
            lastError: error.message
          })
          
          results.push({
            offlineId: pending.offlineId,
            success: false,
            error: error.message
          })
        }
      }
      
      res.json({
        success: true,
        results,
        message: `Processed ${results.length} pending sales`
      })
    } catch (error) {
      console.error("Error syncing pending sales:", error)
      res.status(500).json({ error: "Failed to sync pending sales" })
    }
  })

  // Get pending sales status
  app.get("/api/pos/pending-sales", async (req, res) => {
    try {
      const pendingSales = await storage.getPendingSales()
      res.json(pendingSales)
    } catch (error) {
      console.error("Error fetching pending sales:", error)
      res.status(500).json({ error: "Failed to fetch pending sales" })
    }
  })

  // Clear specific pending sale
  app.delete("/api/pos/pending-sales/:id", async (req, res) => {
    try {
      await storage.deletePendingSale(req.params.id)
      res.json({ success: true })
    } catch (error) {
      console.error("Error deleting pending sale:", error)
      res.status(500).json({ error: "Failed to delete pending sale" })
    }
  })

  // Check connectivity
  app.get("/api/pos/connectivity", async (_req, res) => {
    try {
      // Test database connection
      await storage.getSettings()
      res.json({ online: true, timestamp: new Date().toISOString() })
    } catch (error) {
      res.json({ online: false, timestamp: new Date().toISOString() })
    }
  })

  const httpServer = createServer(app)
  return httpServer
}