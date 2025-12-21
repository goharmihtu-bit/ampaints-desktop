// routes.ts - COMPLETE FIXED VERSION WITH SILENT AUTO-EXPORT ENABLED
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

// Rate limiting for admin PIN verification (prevent brute force)
// NOTE: This is an in-memory implementation suitable for single-instance deployments.
// For production multi-instance deployments, consider using Redis or a shared cache.
const pinAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_PIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

function checkPinRateLimit(ip: string): { allowed: boolean; remainingAttempts?: number; lockoutTime?: number } {
  const now = Date.now()
  const attempt = pinAttempts.get(ip)
  
  if (!attempt) {
    pinAttempts.set(ip, { count: 1, lastAttempt: now })
    return { allowed: true, remainingAttempts: MAX_PIN_ATTEMPTS - 1 }
  }
  
  // Check if lockout period has passed
  if (attempt.count >= MAX_PIN_ATTEMPTS) {
    const timeSinceLast = now - attempt.lastAttempt
    if (timeSinceLast < LOCKOUT_DURATION) {
      const lockoutTime = Math.ceil((LOCKOUT_DURATION - timeSinceLast) / 1000 / 60)
      return { allowed: false, lockoutTime }
    }
    // Reset after lockout period
    pinAttempts.set(ip, { count: 1, lastAttempt: now })
    return { allowed: true, remainingAttempts: MAX_PIN_ATTEMPTS - 1 }
  }
  
  // Increment attempt count
  attempt.count++
  attempt.lastAttempt = now
  return { allowed: true, remainingAttempts: MAX_PIN_ATTEMPTS - attempt.count }
}

function resetPinAttempts(ip: string): void {
  pinAttempts.delete(ip)
}

// Cleanup old entries periodically (every hour)
let cleanupInterval: NodeJS.Timeout | null = null

function startPinCleanup() {
  if (cleanupInterval) return // Already started
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [ip, attempt] of pinAttempts.entries()) {
      if (now - attempt.lastAttempt > LOCKOUT_DURATION) {
        pinAttempts.delete(ip)
      }
    }
  }, 60 * 60 * 1000)
}

function stopPinCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

// Export cleanup function for graceful shutdown
export function cleanupRateLimiting() {
  stopPinCleanup()
  pinAttempts.clear()
}

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
export async function registerRoutes(app: Express): Promise<Server> {
  // Start rate limiting cleanup
  startPinCleanup()

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

  // Cloud Sync: Test Postgres connection (Neon/Supabase)
  app.post(
    "/api/cloud-sync/test-connection",
    requirePerm("payment:edit"),
    async (req, res) => {
      try {
        const { connectionString } = req.body
        if (!connectionString || typeof connectionString !== "string") {
          return res.status(400).json({ ok: false, error: "connectionString is required" })
        }

        // Try to connect using pg
        const { Client } = await import("pg")
        const client = new Client({ connectionString, statement_timeout: 5000, connectionTimeoutMillis: 5000 })

        try {
          await client.connect()
          const result = await client.query("SELECT 1 as ok")
          await client.end()
          if (result && result.rows && result.rows[0] && result.rows[0].ok === 1) {
            return res.json({ ok: true })
          }
          return res.json({ ok: true })
        } catch (err) {
          try {
            await client.end()
          } catch (_) {
            // ignore
          }
          console.error("[API] Cloud Sync test connection failed:", err)
          return res.status(400).json({ ok: false, error: (err as Error).message || "Connection failed" })
        }
      } catch (error) {
        console.error("[API] Error testing cloud connection:", error)
        return res.status(500).json({ ok: false, error: "Internal server error" })
      }
    },
  )

  // Manage cloud connections (encrypted server-side)
  app.get("/api/cloud-sync/connections", requirePerm("payment:edit"), async (_req, res) => {
    try {
      const { listConnections } = await import("./cloudSync")
      const rows = await listConnections()
      res.json({ ok: true, connections: rows })
    } catch (err) {
      console.error("[API] Error listing cloud connections:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  app.post("/api/cloud-sync/connections", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { provider, label, connectionString } = req.body
      if (!provider || !connectionString) return res.status(400).json({ ok: false, error: "provider and connectionString required" })

      // Save encrypted connection string
      const id = crypto.randomUUID()
      const { saveConnection } = await import("./cloudSync")
      await saveConnection({ id, provider, label, connectionString })
      res.json({ ok: true, id })
    } catch (err: any) {
      console.error("[API] Error saving cloud connection:", err)
      res.status(500).json({ ok: false, error: err.message || "Internal error" })
    }
  })

  app.delete("/api/cloud-sync/connections/:id", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { id } = req.params
      const { deleteConnection } = await import("./cloudSync")
      await deleteConnection(id)
      res.json({ ok: true })
    } catch (err) {
      console.error("[API] Error deleting cloud connection:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  // Enqueue a cloud sync job (export/import)
  app.post("/api/cloud-sync/jobs", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { connectionId, jobType, dryRun, details } = req.body
      if (!connectionId || !jobType) return res.status(400).json({ ok: false, error: "connectionId and jobType required" })
      const jobId = crypto.randomUUID()
      const { getConnection, enqueueJob } = await import("./cloudSync")
      const conn = await getConnection(connectionId)
      if (!conn) return res.status(404).json({ ok: false, error: "connection not found" })

      await enqueueJob({ id: jobId, jobType, provider: conn.provider, connectionId, dryRun: !!dryRun, initiatedBy: req.ip, details: details ? JSON.stringify(details) : undefined })
      res.json({ ok: true, jobId })
    } catch (err) {
      console.error("[API] Error enqueuing cloud sync job:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  app.get("/api/cloud-sync/jobs", requirePerm("payment:edit"), async (_req, res) => {
    try {
      const { sqliteDb } = await import("./db")
      if (!sqliteDb) return res.json({ ok: true, jobs: [] })
      const jobs = sqliteDb.prepare("SELECT id, job_type, provider, connection_id, status, dry_run, initiated_by, details, attempts, last_error, created_at, updated_at FROM cloud_sync_jobs ORDER BY created_at DESC").all()
      res.json({ ok: true, jobs })
    } catch (err) {
      console.error("[API] Error listing jobs:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  // Manual trigger to process one pending job (admin only)
  app.post("/api/cloud-sync/jobs/:id/process", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { processNextJob } = await import("./cloudSyncWorker")
      const result = await processNextJob()
      res.json({ ok: true, result })
    } catch (err) {
      console.error("[API] Error processing job:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  app.post("/api/cloud-sync/process-next", requirePerm("payment:edit"), async (_req, res) => {
    try {
      const { processNextJob } = await import("./cloudSyncWorker")
      const result = await processNextJob()
      res.json({ ok: true, result })
    } catch (err) {
      console.error("[API] Error processing next job:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  // Process all pending jobs
  app.post("/api/cloud-sync/process-all", requirePerm("payment:edit"), async (_req, res) => {
    try {
      const { processAllPendingJobs } = await import("./cloudSyncWorker")
      const result = await processAllPendingJobs()
      res.json({ ok: true, ...result })
    } catch (err) {
      console.error("[API] Error processing all jobs:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  // Get detailed job status
  app.get("/api/cloud-sync/jobs/:id/status", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { getJobStatus } = await import("./cloudSyncWorker")
      const status = await getJobStatus(req.params.id)
      if (!status) {
        return res.status(404).json({ ok: false, error: "Job not found" })
      }
      res.json({ ok: true, job: status })
    } catch (err) {
      console.error("[API] Error getting job status:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  // Cancel a pending job
  app.post("/api/cloud-sync/jobs/:id/cancel", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { cancelJob } = await import("./cloudSyncWorker")
      await cancelJob(req.params.id)
      res.json({ ok: true, message: "Job cancelled" })
    } catch (err: any) {
      console.error("[API] Error cancelling job:", err)
      res.status(400).json({ ok: false, error: err.message || "Cannot cancel job" })
    }
  })

  // Retry a failed job
  app.post("/api/cloud-sync/jobs/:id/retry", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { retryJob } = await import("./cloudSyncWorker")
      await retryJob(req.params.id)
      res.json({ ok: true, message: "Job queued for retry" })
    } catch (err: any) {
      console.error("[API] Error retrying job:", err)
      res.status(400).json({ ok: false, error: err.message || "Cannot retry job" })
    }
  })

  // Cleanup old jobs
  app.post("/api/cloud-sync/cleanup", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { daysOld = 30 } = req.body
      const { cleanupOldJobs } = await import("./cloudSyncWorker")
      const deleted = await cleanupOldJobs(daysOld)
      res.json({ ok: true, deleted, message: `Deleted ${deleted} old jobs` })
    } catch (err) {
      console.error("[API] Error cleaning up jobs:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
    }
  })

  // Verify export (compare local and remote checksums)
  app.post("/api/cloud-sync/verify-export", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { connectionId } = req.body
      if (!connectionId) return res.status(400).json({ ok: false, error: "connectionId required" })
      
      const { getConnection } = await import("./cloudSync")
      const conn = await getConnection(connectionId)
      if (!conn) return res.status(404).json({ ok: false, error: "connection not found" })
      
      const { verifyExport } = await import("./cloudSyncExport")
      const result = await verifyExport(conn.connectionString)
      res.json({ ok: true, ...result })
    } catch (err: any) {
      console.error("[API] Error verifying export:", err)
      res.status(500).json({ ok: false, error: err.message || "Verification failed" })
    }
  })

  // Verify import (compare row counts)
  app.post("/api/cloud-sync/verify-import", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { connectionId } = req.body
      if (!connectionId) return res.status(400).json({ ok: false, error: "connectionId required" })
      
      const { getConnection } = await import("./cloudSync")
      const conn = await getConnection(connectionId)
      if (!conn) return res.status(404).json({ ok: false, error: "connection not found" })
      
      const { verifyImport } = await import("./cloudSyncImport")
      const result = await verifyImport(conn.connectionString)
      res.json({ ok: true, ...result })
    } catch (err: any) {
      console.error("[API] Error verifying import:", err)
      res.status(500).json({ ok: false, error: err.message || "Verification failed" })
    }
  })

  // Restore from backup
  app.post("/api/cloud-sync/restore-backup", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { backupPath } = req.body
      if (!backupPath) return res.status(400).json({ ok: false, error: "backupPath required" })
      
      const { restoreFromBackup } = await import("./cloudSyncImport")
      const result = await restoreFromBackup(backupPath)
      res.json({ ok: true, ...result })
    } catch (err: any) {
      console.error("[API] Error restoring backup:", err)
      res.status(500).json({ ok: false, error: err.message || "Restore failed" })
    }
  })

  // List available backups
  app.get("/api/cloud-sync/backups", requirePerm("payment:edit"), async (_req, res) => {
    try {
      const fs = await import("fs")
      const path = await import("path")
      const { getDatabasePath } = await import("./db")
      
      const dbPath = getDatabasePath()
      const dbDir = path.dirname(dbPath)
      
      const files = fs.readdirSync(dbDir)
      const backups = files
        .filter(f => f.startsWith("backup-") && f.endsWith(".db"))
        .map(f => {
          const fullPath = path.join(dbDir, f)
          const stats = fs.statSync(fullPath)
          return {
            name: f,
            path: fullPath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          }
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime())
      
      res.json({ ok: true, backups })
    } catch (err: any) {
      console.error("[API] Error listing backups:", err)
      res.status(500).json({ ok: false, error: err.message || "Failed to list backups" })
    }
  })

  // Delete a backup file
  app.delete("/api/cloud-sync/backups/:filename", requirePerm("payment:edit"), async (req, res) => {
    try {
      const fs = await import("fs")
      const path = await import("path")
      const { getDatabasePath } = await import("./db")
      
      const dbPath = getDatabasePath()
      const dbDir = path.dirname(dbPath)
      const backupPath = path.join(dbDir, req.params.filename)
      
      // Security: ensure the file is in the correct directory and is a backup
      if (!backupPath.startsWith(dbDir) || !req.params.filename.startsWith("backup-")) {
        return res.status(400).json({ ok: false, error: "Invalid backup file" })
      }
      
      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ ok: false, error: "Backup not found" })
      }
      
      fs.unlinkSync(backupPath)
      res.json({ ok: true, message: "Backup deleted" })
    } catch (err: any) {
      console.error("[API] Error deleting backup:", err)
      res.status(500).json({ ok: false, error: err.message || "Failed to delete backup" })
    }
  })

  // Get cloud sync statistics
  app.get("/api/cloud-sync/stats", requirePerm("payment:edit"), async (_req, res) => {
    try {
      const { sqliteDb } = await import("./db")
      if (!sqliteDb) return res.json({ ok: true, stats: null })
      
      // Get job statistics
      const totalJobs = sqliteDb.prepare("SELECT COUNT(*) as count FROM cloud_sync_jobs").get() as any
      const pendingJobs = sqliteDb.prepare("SELECT COUNT(*) as count FROM cloud_sync_jobs WHERE status = 'pending'").get() as any
      const runningJobs = sqliteDb.prepare("SELECT COUNT(*) as count FROM cloud_sync_jobs WHERE status = 'running'").get() as any
      const successJobs = sqliteDb.prepare("SELECT COUNT(*) as count FROM cloud_sync_jobs WHERE status = 'success'").get() as any
      const failedJobs = sqliteDb.prepare("SELECT COUNT(*) as count FROM cloud_sync_jobs WHERE status = 'failed'").get() as any
      
      // Get last successful sync
      const lastExport = sqliteDb.prepare("SELECT * FROM cloud_sync_jobs WHERE job_type = 'export' AND status = 'success' ORDER BY updated_at DESC LIMIT 1").get() as any
      const lastImport = sqliteDb.prepare("SELECT * FROM cloud_sync_jobs WHERE job_type = 'import' AND status = 'success' ORDER BY updated_at DESC LIMIT 1").get() as any
      
      // Get connection count
      const connections = sqliteDb.prepare("SELECT COUNT(*) as count FROM cloud_sync_connections").get() as any
      
      res.json({
        ok: true,
        stats: {
          jobs: {
            total: totalJobs?.count || 0,
            pending: pendingJobs?.count || 0,
            running: runningJobs?.count || 0,
            success: successJobs?.count || 0,
            failed: failedJobs?.count || 0
          },
          connections: connections?.count || 0,
          lastExport: lastExport ? {
            id: lastExport.id,
            timestamp: lastExport.updated_at,
            details: lastExport.details ? JSON.parse(lastExport.details) : null
          } : null,
          lastImport: lastImport ? {
            id: lastImport.id,
            timestamp: lastImport.updated_at,
            details: lastImport.details ? JSON.parse(lastImport.details) : null
          } : null
        }
      })
    } catch (err) {
      console.error("[API] Error getting cloud sync stats:", err)
      res.status(500).json({ ok: false, error: "Internal error" })
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

  // Check if return can be edited
  app.get("/api/returns/:id/can-edit", async (req, res) => {
    try {
      const result = await storage.canEditReturn(req.params.id)
      res.json(result)
    } catch (error) {
      console.error("[API] Error checking return edit status:", error)
      res.status(500).json({ error: "Failed to check return edit status" })
    }
  })

  // Update return (reason, refund method, amount, status)
  app.patch("/api/returns/:id", async (req, res) => {
    try {
      const { reason, refundMethod, totalRefund, status } = req.body

      console.log("[API] Updating return:", { id: req.params.id, reason, refundMethod, totalRefund, status })

      const updatedReturn = await storage.updateReturn(req.params.id, {
        reason,
        refundMethod,
        totalRefund,
        status,
      })

      if (!updatedReturn) {
        res.status(404).json({ error: "Return not found" })
        return
      }

      // Invalidate returns cache
      invalidateCache("returns")

      res.json(updatedReturn)
    } catch (error) {
      console.error("[API] Error updating return:", error)
      const message = error instanceof Error ? error.message : "Failed to update return"
      res.status(400).json({ error: message })
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

  // ============ SOFTWARE LICENSE MANAGEMENT ============
  
  // Master PIN for software blocking - Default is "0000" for first-time setup
  const MASTER_ADMIN_PIN = process.env.MASTER_ADMIN_PIN || "0000"

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
      
      // Check global license expiry from settings (cannot be bypassed via DB)
      const settings = await storage.getSettings()
      if (settings && settings.licenseExpiryDate) {
        const today = new Date().toISOString().split('T')[0]
        const expiryDate = settings.licenseExpiryDate
        
        // If license is expired or deactivated, block the software
        if (expiryDate <= today || settings.licenseStatus === "deactivated") {
          res.json({
            deviceId: deviceId,
            status: "blocked",
            isBlocked: true,
            blockedReason: settings.licenseStatus === "deactivated" 
              ? "License deactivated by administrator. Contact support to reactivate." 
              : `License expired on ${expiryDate}. Please contact support to renew.`,
            blockedAt: now,
            autoBlockDate: null,
            message: "License expired or deactivated",
          })
          return
        }
      }
      
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
      const clientIp = req.ip || req.socket.remoteAddress
      
      // Security: Reject requests without valid IP
      if (!clientIp) {
        console.log("[Admin PIN] Request rejected - no valid IP address")
        return res.status(400).json({ valid: false, error: "Unable to verify request origin" })
      }
      
      if (!masterPin) {
        console.log("[Admin PIN] Missing PIN in request")
        return res.status(400).json({ valid: false, error: "masterPin required" })
      }

      // Check rate limiting
      const rateLimit = checkPinRateLimit(clientIp)
      if (!rateLimit.allowed) {
        console.log(`[Admin PIN] Rate limit exceeded for ${clientIp} - locked out for ${rateLimit.lockoutTime} minutes`)
        return res.status(429).json({ 
          valid: false, 
          error: `Too many failed attempts. Please wait ${rateLimit.lockoutTime} minutes before trying again.`,
          lockoutTime: rateLimit.lockoutTime
        })
      }

      console.log(`[Admin PIN] Verifying PIN attempt (${rateLimit.remainingAttempts} attempts remaining)`)

      // Check settings-stored master pin first
      const s = await storage.getSettings()
      let isValid = false
      
      if (s.masterPinHash && s.masterPinSalt) {
        try {
          const derived = crypto.scryptSync(masterPin, Buffer.from(s.masterPinSalt, 'hex'), 64)
          if (derived.toString('hex') === s.masterPinHash) {
            isValid = true
            console.log("[Admin PIN] Stored PIN verified successfully")
          }
        } catch (err) {
          console.log("[Admin PIN] Error checking stored PIN, falling back to default:", err)
        }
      }

      // Fallback to env-based master PIN (default "0000" or custom env var)
      if (!isValid && verifyMasterPin(masterPin)) {
        isValid = true
        console.log("[Admin PIN] Default PIN verified successfully")
      }

      if (!isValid) {
        console.log(`[Admin PIN] Verification failed - Invalid PIN (${rateLimit.remainingAttempts} attempts remaining)`)
        res.status(403).json({ 
          valid: false, 
          error: "Invalid master PIN",
          remainingAttempts: rateLimit.remainingAttempts
        })
        return
      }

      // Success - reset rate limit for this IP
      resetPinAttempts(clientIp)
      console.log("[Admin PIN] PIN verified successfully")
      res.json({ valid: true, message: "Master PIN verified" })
    } catch (error) {
      console.error("[Admin PIN] Error verifying PIN:", error)
      res.status(500).json({ error: "Failed to verify PIN" })
    }
  })

  // Set or change master PIN (admin)
  app.post("/api/license/set-master-pin", requirePerm("payment:edit"), async (req, res) => {
    try {
      const { currentPin, newPin } = req.body
      const clientIp = req.ip || req.socket.remoteAddress
      
      // Security: Reject requests without valid IP
      if (!clientIp) {
        console.log("[Admin PIN] Set PIN request rejected - no valid IP address")
        return res.status(400).json({ ok: false, error: "Unable to verify request origin" })
      }
      
      if (!newPin) return res.status(400).json({ ok: false, error: "newPin required" })

      // Apply rate limiting to PIN change operations as well
      const rateLimit = checkPinRateLimit(clientIp)
      if (!rateLimit.allowed) {
        console.log(`[Admin PIN] Set PIN rate limit exceeded for ${clientIp} - locked out for ${rateLimit.lockoutTime} minutes`)
        return res.status(429).json({ 
          ok: false, 
          error: `Too many attempts. Please wait ${rateLimit.lockoutTime} minutes before trying again.`
        })
      }

      console.log("[Admin PIN] Attempting to change master PIN")

      // Verify current pin: either matches stored hash or env
      const s = await storage.getSettings()
      let verified = false
      if (s.masterPinHash && s.masterPinSalt && currentPin) {
        try {
          const derived = crypto.scryptSync(currentPin, Buffer.from(s.masterPinSalt, 'hex'), 64)
          verified = derived.toString('hex') === s.masterPinHash
          if (verified) {
            console.log("[Admin PIN] Current stored PIN verified")
          }
        } catch (err) {
          console.log("[Admin PIN] Error verifying stored PIN:", err)
          verified = false
        }
      }

      if (!verified && currentPin) {
        verified = verifyMasterPin(currentPin)
        if (verified) {
          console.log("[Admin PIN] Current default PIN verified")
        }
      }

      if (!verified && s.masterPinHash) {
        console.log("[Admin PIN] Current PIN verification failed - stored PIN exists but invalid")
        return res.status(403).json({ ok: false, error: "Invalid current PIN" })
      }

      // If no master pin was set yet, allow setting without currentPin (first-time setup)
      if (!s.masterPinHash && !currentPin) {
        console.log("[Admin PIN] First-time setup - no current PIN required")
      }

      // Generate salt and store scrypt hash
      const salt = crypto.randomBytes(16)
      const derived = crypto.scryptSync(newPin, salt, 64)
      await storage.updateSettings({ masterPinHash: derived.toString('hex'), masterPinSalt: salt.toString('hex') })
      invalidateCache("settings")
      
      // Success - reset rate limit for this IP
      resetPinAttempts(clientIp)
      console.log("[Admin PIN] Master PIN changed successfully")
      res.json({ ok: true })
    } catch (err: any) {
      console.error("[Admin PIN] Error setting master PIN:", err)
      res.status(500).json({ ok: false, error: "Failed to set master PIN" })
    }
  })

  // ============ ADMIN LICENSE SETTINGS ============
  
  // Crypto helper for hashing secret key
  function hashSecretKey(key: string): string {
    // use imported `crypto` (ESM-friendly)
    return crypto.createHash("sha256").update(key).digest("hex")
  }

  // Get license status for admin panel
  app.get("/api/license/status", async (req, res) => {
    try {
      const settings = await storage.getSettings()
      const today = new Date().toISOString().split('T')[0]
      const expiryDate = settings?.licenseExpiryDate || null
      const isExpired = expiryDate && expiryDate <= today
      const isDeactivated = settings?.licenseStatus === "deactivated"
      
      res.json({
        active: !isExpired && !isDeactivated && settings?.licenseStatus === "active",
        expiryDate: expiryDate,
        status: isDeactivated ? "deactivated" : isExpired ? "expired" : "active",
        lastChecked: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error getting license status:", error)
      res.status(500).json({ error: "Failed to get license status" })
    }
  })

  // Set license expiration date
  app.post("/api/license/set-expiry", async (req, res) => {
    try {
      const { expiryDate, secretKey } = req.body
      
      if (!secretKey) {
        res.status(400).json({ error: "Secret key is required" })
        return
      }

      if (!expiryDate) {
        res.status(400).json({ error: "Expiration date is required" })
        return
      }

      // Validate secret key
      const MASTER_SECRET_KEY = process.env.MASTER_SECRET_KEY || "3620192373285"
      const hashedInput = hashSecretKey(secretKey.toString())
      const hashedMaster = hashSecretKey(MASTER_SECRET_KEY)

      if (hashedInput !== hashedMaster) {
        res.status(403).json({ error: "Invalid secret key" })
        return
      }

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" })
        return
      }

      const settings = await storage.getSettings()
      if (settings) {
        await storage.updateSettings({
          licenseExpiryDate: expiryDate,
          licenseStatus: "active",
        })
        invalidateCache("settings") // Invalidate cache after license update

        console.log(`License expiry date set to ${expiryDate} with valid secret key`)

        res.json({
          success: true,
          message: `License expiration date set to ${expiryDate}`,
          expiryDate,
        })
      } else {
        res.status(404).json({ error: "Settings not found" })
      }
    } catch (error) {
      console.error("Error setting license expiry:", error)
      res.status(500).json({ error: "Failed to set license expiry date" })
    }
  })

  // Deactivate license - requires secret key
  app.post("/api/license/deactivate", async (req, res) => {
    try {
      const { secretKey } = req.body
      
      if (!secretKey) {
        res.status(400).json({ error: "Secret key is required" })
        return
      }

      // Validate secret key
      const MASTER_SECRET_KEY = process.env.MASTER_SECRET_KEY || "3620192373285"
      const hashedInput = hashSecretKey(secretKey.toString())
      const hashedMaster = hashSecretKey(MASTER_SECRET_KEY)

      if (hashedInput !== hashedMaster) {
        res.status(403).json({ error: "Invalid secret key" })
        return
      }

      const settings = await storage.getSettings()
      if (settings) {
        const today = new Date().toISOString().split('T')[0]
        
        await storage.updateSettings({
          licenseExpiryDate: today,
          licenseStatus: "deactivated",
        })
        invalidateCache("settings") // Invalidate cache after license deactivation

        console.log("License deactivated by admin with valid secret key")

        res.json({
          success: true,
          message: "License has been deactivated. The software will require reactivation.",
          expiryDate: today,
        })
      } else {
        res.status(404).json({ error: "Settings not found" })
      }
    } catch (error) {
      console.error("Error deactivating license:", error)
      res.status(500).json({ error: "Failed to deactivate license" })
    }
  })

  // Activate/Reactivate license with secret key
  app.post("/api/license/activate", async (req, res) => {
    try {
      const { secretKey } = req.body
      
      if (!secretKey) {
        res.status(400).json({ error: "Secret key is required" })
        return
      }

      const MASTER_SECRET_KEY = process.env.MASTER_SECRET_KEY || "3620192373285"
      const hashedInput = hashSecretKey(secretKey.toString())
      const hashedMaster = hashSecretKey(MASTER_SECRET_KEY)

      if (hashedInput !== hashedMaster) {
        res.status(403).json({ error: "Invalid secret key" })
        return
      }

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 10)
      const expiryDate = futureDate.toISOString().split('T')[0]

      const settings = await storage.getSettings()
      if (settings) {
        await storage.updateSettings({
          licenseExpiryDate: expiryDate,
          licenseStatus: "active",
        })
        invalidateCache("settings") // Invalidate cache after license activation

        console.log("License reactivated with valid secret key")

        res.json({
          success: true,
          message: "License successfully reactivated!",
          expiryDate,
        })
      } else {
        res.status(404).json({ error: "Settings not found" })
      }
    } catch (error) {
      console.error("Error activating license:", error)
      res.status(500).json({ error: "Failed to activate license" })
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
