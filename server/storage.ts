// storage.ts - COMPLETE FIXED VERSION WITH OFFLINE POS SUPPORT
import {
  products,
  variants,
  colors,
  sales,
  saleItems,
  settings,
  stockInHistory,
  paymentHistory,
  returns,
  returnItems,
  customerAccounts,
  softwareLicenses,
  licenseAuditLog,
  type Product,
  type InsertProduct,
  type Variant,
  type InsertVariant,
  type Color,
  type InsertColor,
  type Sale,
  type InsertSale,
  type SaleItem,
  type InsertSaleItem,
  type Settings,
  type UpdateSettings,
  type VariantWithProduct,
  type ColorWithVariantAndProduct,
  type SaleWithItems,
  type StockInHistoryWithColor,
  type PaymentHistory,
  type PaymentHistoryWithSale,
  type Return,
  type InsertReturn,
  type ReturnItem,
  type InsertReturnItem,
  type ReturnWithItems,
  type StockInHistory,
  type SoftwareLicense,
  type InsertSoftwareLicense,
  type UpdateSoftwareLicense,
  type LicenseAuditLog,
  type InsertLicenseAuditLog,
} from "@shared/schema"
import { db } from "./db"
import { eq, desc, sql, and, gt } from "drizzle-orm"

// FIXED: Extended interfaces with missing properties
interface ExtendedSale extends Sale {
  dueDate?: string | Date | null
  isManualBalance?: boolean
  notes?: string | null
}

interface ExtendedInsertSale extends InsertSale {
  dueDate?: string | Date | null
  isManualBalance?: boolean
  notes?: string | null
}

// NEW: Customer purchase history interface
interface CustomerPurchaseHistory {
  originalSales: SaleWithItems[]
  adjustedSales: SaleWithItems[]
  availableItems: Array<{
    saleId: string
    saleItemId: string
    colorId: string
    color: ColorWithVariantAndProduct
    originalQuantity: number
    availableQuantity: number
    rate: number
    subtotal: number
    saleDate: Date
  }>
}

// NEW: Pagination interfaces for smart database handling
export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

// NEW: Pending offline sale interfaces
interface PendingSale {
  id: string
  offlineId: string
  saleData: string // JSON stringified sale data
  items: string // JSON stringified items array
  timestamp: Date
  status: 'pending' | 'synced' | 'failed'
  attempts: number
  lastError?: string
  syncedAt?: Date
  syncedSaleId?: string
  createdAt: Date
}

interface InsertPendingSale {
  offlineId: string
  saleData: string
  items: string
  timestamp: Date
  status: 'pending' | 'synced' | 'failed'
  attempts?: number
  lastError?: string
  syncedAt?: Date
  syncedSaleId?: string
}

interface UpdatePendingSale {
  status?: 'pending' | 'synced' | 'failed'
  attempts?: number
  lastError?: string
  syncedAt?: Date
  syncedSaleId?: string
}

// Default pagination limits to prevent large data loads
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

export interface IStorage {
  // Products
  getProducts(): Promise<Product[]>
  getProduct(id: string): Promise<Product | undefined>
  createProduct(product: InsertProduct): Promise<Product>
  updateProduct(id: string, data: { company: string; productName: string }): Promise<Product>
  deleteProduct(id: string): Promise<void>

  // Variants
  getVariants(): Promise<VariantWithProduct[]>
  getVariant(id: string): Promise<Variant | undefined>
  createVariant(variant: InsertVariant): Promise<Variant>
  updateVariant(id: string, data: { productId: string; packingSize: string; rate: number }): Promise<Variant>
  updateVariantRate(id: string, rate: number): Promise<Variant>
  deleteVariant(id: string): Promise<void>

  // Colors
  getColors(): Promise<ColorWithVariantAndProduct[]>
  getColor(id: string): Promise<Color | undefined>
  createColor(color: InsertColor): Promise<Color>
  updateColor(id: string, data: { colorName: string; colorCode: string; stockQuantity: number }): Promise<Color>
  updateColorStock(id: string, stockQuantity: number): Promise<Color>
  updateColorRateOverride(id: string, rateOverride: number | null): Promise<Color>
  stockIn(id: string, quantity: number, notes?: string, stockInDate?: string): Promise<Color>
  deleteColor(id: string): Promise<void>

  // Sales - FIXED: Extended with missing properties
  getSales(): Promise<ExtendedSale[]>
  getSalesPaginated(params?: PaginationParams): Promise<PaginatedResult<ExtendedSale>>
  getSalesWithItems(): Promise<SaleWithItems[]>
  getUnpaidSales(): Promise<ExtendedSale[]>
  getUnpaidSalesPaginated(params?: PaginationParams): Promise<PaginatedResult<ExtendedSale>>
  getSalesByCustomerPhone(customerPhone: string): Promise<ExtendedSale[]>
  getSalesByCustomerPhoneWithItems(customerPhone: string): Promise<SaleWithItems[]>
  findUnpaidSaleByPhone(customerPhone: string): Promise<ExtendedSale | undefined>
  getSale(id: string): Promise<SaleWithItems | undefined>
  createSale(sale: ExtendedInsertSale, items: InsertSaleItem[]): Promise<ExtendedSale>
  createManualBalance(data: {
    customerName: string
    customerPhone: string
    totalAmount: string
    dueDate: Date | null
    notes?: string
  }): Promise<ExtendedSale>
  updateSalePayment(saleId: string, amount: number, paymentMethod?: string, notes?: string): Promise<ExtendedSale>
  updateSalePaidAmount(saleId: string, amountPaid: number, paymentStatus: string): Promise<ExtendedSale>
  updateSaleDueDate(saleId: string, data: { dueDate: Date | null; notes?: string }): Promise<ExtendedSale>
  addSaleItem(saleId: string, item: InsertSaleItem): Promise<SaleItem>
  updateSaleItem(id: string, data: { quantity: number; rate: number; subtotal: number }): Promise<SaleItem>
  deleteSaleItem(saleItemId: string): Promise<void>
  deleteSale(saleId: string): Promise<void>

  // Stock In History
  getStockInHistory(): Promise<StockInHistoryWithColor[]>
  getStockInHistoryPaginated(params?: PaginationParams): Promise<PaginatedResult<StockInHistoryWithColor>>
  getFilteredStockInHistory(filters: {
    startDate?: Date
    endDate?: Date
    company?: string
    product?: string
    colorCode?: string
    colorName?: string
  }): Promise<StockInHistoryWithColor[]>
  recordStockIn(
    colorId: string,
    quantity: number,
    previousStock: number,
    newStock: number,
    notes?: string,
    stockInDate?: string,
  ): Promise<StockInHistoryWithColor>
  deleteStockInHistory(id: string): Promise<void>
  updateStockInHistory(
    id: string,
    data: { quantity?: number; notes?: string; stockInDate?: string },
  ): Promise<StockInHistoryWithColor>

  // Payment History
  recordPaymentHistory(data: {
    saleId: string
    customerPhone: string
    amount: number
    previousBalance: number
    newBalance: number
    paymentMethod?: string
    notes?: string
  }): Promise<PaymentHistory>
  getPaymentHistoryByCustomer(customerPhone: string): Promise<PaymentHistoryWithSale[]>
  getPaymentHistoryBySale(saleId: string): Promise<PaymentHistory[]>
  getAllPaymentHistory(): Promise<PaymentHistoryWithSale[]>
  getAllPaymentHistoryPaginated(params?: PaginationParams): Promise<PaginatedResult<PaymentHistoryWithSale>>
  updatePaymentHistory(
    id: string,
    data: { amount?: number; paymentMethod?: string; notes?: string },
  ): Promise<PaymentHistory | null>
  deletePaymentHistory(id: string): Promise<boolean>

  // Dashboard Stats
  getDashboardStats(): Promise<{
    todaySales: { revenue: number; transactions: number }
    monthlySales: { revenue: number; transactions: number }
    inventory: {
      totalProducts: number
      totalVariants: number
      totalColors: number
      lowStock: number
      totalStockValue: number
    }
    unpaidBills: { count: number; totalAmount: number }
    recentSales: ExtendedSale[]
    monthlyChart: { date: string; revenue: number }[]
    topCustomers: Array<{
      customerName: string
      customerPhone: string
      totalPurchases: number
      transactionCount: number
    }>
  }>

  // Returns - UPDATED WITH FIXED METHODS
  getReturns(): Promise<ReturnWithItems[]>
  getReturn(id: string): Promise<ReturnWithItems | undefined>
  createReturn(returnData: InsertReturn & { refundMethod?: 'cash' | 'credit' }, items: InsertReturnItem[]): Promise<Return>
  createQuickReturn(data: InsertReturn & { refundMethod?: 'cash' | 'credit' } | {
    customerName: string
    customerPhone: string
    colorId: string
    quantity: number
    rate: number
    reason?: string
    restoreStock?: boolean
    refundMethod?: 'cash' | 'credit'
  }): Promise<Return>
  getReturnsByCustomerPhone(customerPhone: string): Promise<ReturnWithItems[]>
  getReturnItems(): Promise<ReturnItem[]>
  getSaleItems(): Promise<SaleItem[]>

  // NEW: Customer Purchase History Tracking
  getCustomerPurchaseHistory(customerPhone: string): Promise<CustomerPurchaseHistory>

  // Settings
  getSettings(): Promise<Settings>
  updateSettings(data: UpdateSettings): Promise<Settings>

  // Audit
  recordStockOut(data: {
    colorId: string
    quantity: number
    movementType: "sale" | "return" | "adjustment" | "damage"
    referenceId?: string
    referenceType?: string
    reason?: string
    notes?: string
    stockOutDate?: string
  }): Promise<void>
  getStockOutHistory(filters?: {
    colorId?: string
    startDate?: string
    endDate?: string
    movementType?: string
  }): Promise<any[]>

  // NEW: CUSTOMER ACCOUNTS MANAGEMENT
  createOrUpdateCustomerAccount(data: {
    customerPhone: string
    customerName: string
    totalPurchased?: string
    totalPaid?: string
    currentBalance?: string
    notes?: string
  }): Promise<void>
  getCustomerAccount(customerPhone: string): Promise<any | null>
  updateCustomerBalance(customerPhone: string, newBalance: string): Promise<void>

  getConsolidatedCustomerAccount(customerPhone: string): Promise<{
    customerPhone: string
    customerName: string
    totalBills: number
    totalAmount: number
    totalPaid: number
    currentOutstanding: number
    oldestBillDate: Date
    newestBillDate: Date
    billCount: number
    paymentCount: number
    lastPaymentDate: Date | null
    averageDaysToPayment: number
    paymentStatus: "paid" | "partial" | "unpaid"
  } | null>
  syncCustomerAccount(customerPhone: string): Promise<void>

  // NEW: STOCK MOVEMENT SUMMARY
  updateStockMovementSummary(colorId: string, dateStr: string): Promise<void>
  getStockMovementSummary(colorId: string, dateStr?: string): Promise<any[]>

  // NEW: SYNC STOCK AND BALANCE
  syncStockAndBalance(): Promise<{ stockUpdated: number; balancesUpdated: number }>

  // Cloud Sync Upserts (for import/export with preserved IDs)
  upsertProduct(data: Product): Promise<void>
  upsertVariant(data: Variant): Promise<void>
  upsertColor(data: Color): Promise<void>
  upsertSale(data: ExtendedSale): Promise<void>
  upsertSaleItem(data: SaleItem): Promise<void>
  upsertStockInHistory(data: StockInHistory): Promise<void>
  upsertPaymentHistory(data: PaymentHistory): Promise<void>
  upsertReturn(data: Return): Promise<void>
  upsertReturnItem(data: ReturnItem): Promise<void>

  // Software Licenses (for blocking/unblocking software instances)
  getSoftwareLicenses(): Promise<SoftwareLicense[]>
  getSoftwareLicense(deviceId: string): Promise<SoftwareLicense | undefined>
  createOrUpdateSoftwareLicense(data: InsertSoftwareLicense): Promise<SoftwareLicense>
  updateSoftwareLicense(deviceId: string, data: UpdateSoftwareLicense): Promise<SoftwareLicense | null>
  blockSoftwareLicense(deviceId: string, reason: string, blockedBy?: string): Promise<SoftwareLicense | null>
  unblockSoftwareLicense(deviceId: string): Promise<SoftwareLicense | null>
  setAutoBlockDate(deviceId: string, autoBlockDate: string | null): Promise<SoftwareLicense | null>
  checkAndApplyAutoBlocks(): Promise<{ blocked: string[] }>
  recordLicenseAudit(data: InsertLicenseAuditLog): Promise<LicenseAuditLog>
  getLicenseAuditLog(deviceId?: string): Promise<LicenseAuditLog[]>

  // NEW: OFFLINE POS SUPPORT
  createPendingSale(data: InsertPendingSale): Promise<PendingSale>
  getPendingSales(): Promise<PendingSale[]>
  getPendingSale(offlineId: string): Promise<PendingSale | undefined>
  updatePendingSale(id: string, data: UpdatePendingSale): Promise<PendingSale | null>
  deletePendingSale(id: string): Promise<void>
  processPendingSales(): Promise<{ processed: number; failed: number; errors: string[] }>
  clearAllData(): Promise<void>
}

// ENHANCED: Smart Sync Configuration
const SYNC_CONFIG = {
  batchSize: 50,           // Process 50 records at a time for faster sync
  retryAttempts: 3,        // Retry failed sync operations
  retryDelay: 1000,        // 1 second delay between retries
  deltaThreshold: 5000,    // 5 seconds - only sync records changed since last sync
  autoSyncDelay: 15000,    // 15 seconds delay before auto-sync (reduced from 30s)
  conflictStrategy: 'server-wins' as 'server-wins' | 'client-wins' | 'newest-wins',
}

// ENHANCED: Sync Status Tracking
export interface SyncStatus {
  isOnline: boolean
  lastSyncTime: Date | null
  pendingChanges: number
  syncInProgress: boolean
  lastError: string | null
  syncStats: {
    uploaded: number
    downloaded: number
    conflicts: number
  }
}

// ENHANCED: Change Record for Delta Sync
interface ChangeRecord {
  id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  entity: string
  entityId: string
  data: any
  timestamp: Date
  synced: boolean
  retryCount: number
}

export class DatabaseStorage implements IStorage {
  // ENHANCED: Sync queue with better structure for offline changes
  private syncQueue: ChangeRecord[] = []
  
  // ENHANCED: Sync status tracking
  private syncStatus: SyncStatus = {
    isOnline: true,
    lastSyncTime: null,
    pendingChanges: 0,
    syncInProgress: false,
    lastError: null,
    syncStats: { uploaded: 0, downloaded: 0, conflicts: 0 },
  }
  
  // Auto-sync timer reference
  private autoSyncTimer: NodeJS.Timeout | null = null

  // Pending changes detection
  private pendingChanges = {
    products: false,
    sales: false,
    colors: false,
    payments: false,
    variants: false,
    returns: false,
    customer_accounts: false,
  }

  // Helper method to format dates to DD-MM-YYYY
  private formatDateToDDMMYYYY(date: Date): string {
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  // Helper method to validate DD-MM-YYYY format
  private isValidDDMMYYYY(dateString: string): boolean {
    const pattern = /^\d{2}-\d{2}-\d{4}$/
    if (!pattern.test(dateString)) return false

    const [day, month, year] = dateString.split("-").map(Number)
    const date = new Date(year, month - 1, day)

    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year
  }

  // NEW: Helper to execute raw SQL for pending sales table
  private async executeRawSQL(query: string, params: any[] = []): Promise<any[]> {
    try {
      const { sqliteDb } = await import("./db")
      if (!sqliteDb) {
        throw new Error("SQLite database not available")
      }
      const stmt = sqliteDb.prepare(query)
      return params.length > 0 ? stmt.all(...params) : stmt.all()
    } catch (error) {
      console.error("[Storage] Raw SQL error:", error)
      throw error
    }
  }

  // NEW: Initialize pending sales table
  private async ensurePendingSalesTable(): Promise<void> {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS pending_sales (
          id TEXT PRIMARY KEY,
          offline_id TEXT UNIQUE NOT NULL,
          sale_data TEXT NOT NULL,
          items TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed')),
          attempts INTEGER DEFAULT 0,
          last_error TEXT,
          synced_at DATETIME,
          synced_sale_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `
      await this.executeRawSQL(createTableSQL)
      console.log("[Storage] Pending sales table verified")
    } catch (error) {
      console.error("[Storage] Error ensuring pending sales table:", error)
    }
  }

  // NEW: Get all pending sales
  async getPendingSales(): Promise<PendingSale[]> {
    try {
      await this.ensurePendingSalesTable()
      const rows = await this.executeRawSQL(
        "SELECT * FROM pending_sales ORDER BY timestamp DESC"
      )
      return rows.map(row => ({
        ...row,
        timestamp: new Date(row.timestamp),
        syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
        createdAt: new Date(row.created_at)
      })) as PendingSale[]
    } catch (error) {
      console.error("[Storage] Error getting pending sales:", error)
      return []
    }
  }

  // NEW: Create pending sale
  async createPendingSale(data: InsertPendingSale): Promise<PendingSale> {
    try {
      await this.ensurePendingSalesTable()
      
      const pendingSale: PendingSale = {
        id: crypto.randomUUID(),
        offlineId: data.offlineId,
        saleData: data.saleData,
        items: data.items,
        timestamp: data.timestamp,
        status: data.status,
        attempts: data.attempts || 0,
        lastError: data.lastError,
        syncedAt: data.syncedAt,
        syncedSaleId: data.syncedSaleId,
        createdAt: new Date()
      }

      const insertSQL = `
        INSERT INTO pending_sales 
        (id, offline_id, sale_data, items, timestamp, status, attempts, last_error, synced_at, synced_sale_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      
      await this.executeRawSQL(insertSQL, [
        pendingSale.id,
        pendingSale.offlineId,
        pendingSale.saleData,
        pendingSale.items,
        pendingSale.timestamp.toISOString(),
        pendingSale.status,
        pendingSale.attempts,
        pendingSale.lastError || null,
        pendingSale.syncedAt ? pendingSale.syncedAt.toISOString() : null,
        pendingSale.syncedSaleId || null,
        pendingSale.createdAt.toISOString()
      ])

      console.log(`[Storage] Pending sale created: ${pendingSale.offlineId}`)
      return pendingSale
    } catch (error) {
      console.error("[Storage] Error creating pending sale:", error)
      throw error
    }
  }

  // NEW: Get pending sale by offline ID
  async getPendingSale(offlineId: string): Promise<PendingSale | undefined> {
    try {
      await this.ensurePendingSalesTable()
      const rows = await this.executeRawSQL(
        "SELECT * FROM pending_sales WHERE offline_id = ?",
        [offlineId]
      )
      
      if (rows.length === 0) return undefined
      
      const row = rows[0]
      return {
        ...row,
        timestamp: new Date(row.timestamp),
        syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
        createdAt: new Date(row.created_at)
      } as PendingSale
    } catch (error) {
      console.error("[Storage] Error getting pending sale:", error)
      return undefined
    }
  }

  // NEW: Update pending sale
  async updatePendingSale(id: string, data: UpdatePendingSale): Promise<PendingSale | null> {
    try {
      await this.ensurePendingSalesTable()
      
      const updates: string[] = []
      const params: any[] = []
      
      if (data.status !== undefined) {
        updates.push("status = ?")
        params.push(data.status)
      }
      
      if (data.attempts !== undefined) {
        updates.push("attempts = ?")
        params.push(data.attempts)
      }
      
      if (data.lastError !== undefined) {
        updates.push("last_error = ?")
        params.push(data.lastError)
      }
      
      if (data.syncedAt !== undefined) {
        updates.push("synced_at = ?")
        params.push(data.syncedAt.toISOString())
      }
      
      if (data.syncedSaleId !== undefined) {
        updates.push("synced_sale_id = ?")
        params.push(data.syncedSaleId)
      }
      
      if (updates.length === 0) {
        return null
      }
      
      params.push(id)
      
      const updateSQL = `UPDATE pending_sales SET ${updates.join(", ")} WHERE id = ?`
      await this.executeRawSQL(updateSQL, params)
      
      // Fetch and return updated record
      const rows = await this.executeRawSQL("SELECT * FROM pending_sales WHERE id = ?", [id])
      
      if (rows.length === 0) return null
      
      const row = rows[0]
      return {
        ...row,
        timestamp: new Date(row.timestamp),
        syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
        createdAt: new Date(row.created_at)
      } as PendingSale
    } catch (error) {
      console.error("[Storage] Error updating pending sale:", error)
      return null
    }
  }

  // NEW: Delete pending sale
  async deletePendingSale(id: string): Promise<void> {
    try {
      await this.ensurePendingSalesTable()
      await this.executeRawSQL("DELETE FROM pending_sales WHERE id = ?", [id])
      console.log(`[Storage] Pending sale deleted: ${id}`)
    } catch (error) {
      console.error("[Storage] Error deleting pending sale:", error)
      throw error
    }
  }

  // NEW: Process pending sales (sync when online)
  async processPendingSales(): Promise<{ processed: number; failed: number; errors: string[] }> {
    try {
      const pendingSales = await this.getPendingSales()
      const pending = pendingSales.filter(s => s.status === 'pending')
      
      if (pending.length === 0) {
        return { processed: 0, failed: 0, errors: [] }
      }
      
      console.log(`[Storage] Processing ${pending.length} pending sales...`)
      
      let processed = 0
      let failed = 0
      const errors: string[] = []
      
      for (const pendingSale of pending) {
        try {
          const saleData = JSON.parse(pendingSale.saleData)
          const items = JSON.parse(pendingSale.items)
          
          // Create the sale using existing method
          const sale = await this.createSale(saleData, items)
          
          // Mark as synced
          await this.updatePendingSale(pendingSale.id, {
            status: 'synced',
            syncedAt: new Date(),
            syncedSaleId: sale.id,
            attempts: pendingSale.attempts + 1
          })
          
          processed++
          console.log(`[Storage] Pending sale processed: ${pendingSale.offlineId} -> ${sale.id}`)
        } catch (error) {
          failed++
          const errorMsg = `Failed to process pending sale ${pendingSale.offlineId}: ${error instanceof Error ? error.message : String(error)}`
          errors.push(errorMsg)
          
          await this.updatePendingSale(pendingSale.id, {
            status: 'failed',
            attempts: pendingSale.attempts + 1,
            lastError: errorMsg
          })
          
          console.error(`[Storage] ${errorMsg}`)
        }
      }
      
      console.log(`[Storage] Pending sales processed: ${processed} successful, ${failed} failed`)
      return { processed, failed, errors }
    } catch (error) {
      console.error("[Storage] Error processing pending sales:", error)
      return { processed: 0, failed: 0, errors: [error instanceof Error ? error.message : String(error)] }
    }
  }

  // NEW: Clear all data (for import/export)
  async clearAllData(): Promise<void> {
    try {
      console.log("[Storage] Clearing all data...")
      
      // Clear in correct order to avoid foreign key constraints
      await db.delete(returnItems)
      await db.delete(returns)
      await db.delete(paymentHistory)
      await db.delete(saleItems)
      await db.delete(sales)
      await db.delete(stockInHistory)
      await db.delete(colors)
      await db.delete(variants)
      await db.delete(products)
      await db.delete(customerAccounts)
      
      // Clear pending sales table
      await this.executeRawSQL("DELETE FROM pending_sales")
      
      console.log("[Storage] All data cleared")
    } catch (error) {
      console.error("[Storage] Error clearing data:", error)
      throw error
    }
  }

  // ENHANCED: Get current sync status
  getSyncStatus(): SyncStatus {
    return {
      ...this.syncStatus,
      pendingChanges: this.syncQueue.filter(c => !c.synced).length,
    }
  }

  // ENHANCED: Set online/offline status
  setOnlineStatus(isOnline: boolean) {
    const wasOffline = !this.syncStatus.isOnline
    this.syncStatus.isOnline = isOnline
    
    // If coming back online, trigger sync
    if (wasOffline && isOnline) {
      console.log("[Sync] Back online - triggering sync...")
      this.triggerAutoSync()
    }
  }

  // ENHANCED: Smart Auto Sync with debouncing and delta sync
  async triggerAutoSync(): Promise<{ success: boolean; message: string; stats?: SyncStatus['syncStats'] }> {
    // Prevent concurrent syncs
    if (this.syncStatus.syncInProgress) {
      return { success: false, message: "Sync already in progress" }
    }

    try {
      const settings = await this.getSettings()
      if (!settings.cloudDatabaseUrl || !settings.cloudSyncEnabled) {
        return { success: false, message: "Cloud sync not configured" }
      }

      if (!this.syncStatus.isOnline) {
        return { success: false, message: "Offline - changes queued for later sync" }
      }

      this.syncStatus.syncInProgress = true
      this.syncStatus.lastError = null
      console.log("[Smart-Sync] Starting optimized sync...")

      const startTime = Date.now()
      const stats = { uploaded: 0, downloaded: 0, conflicts: 0 }

      // Step 1: Process queued offline changes first (with retry)
      const queueResult = await this.processOfflineQueue()
      stats.uploaded += queueResult.processed

      // Step 2: Process pending offline sales
      const pendingSalesResult = await this.processPendingSales()
      stats.uploaded += pendingSalesResult.processed

      // Step 3: Delta sync - only sync changes since last sync
      const lastSync = settings.lastSyncTime || new Date(0)
      
      // Import changes from cloud (newer than last sync)
      const importResult = await this.smartImportFromCloud(lastSync)
      stats.downloaded += importResult.imported
      stats.conflicts += importResult.conflicts

      // Export local changes to cloud (newer than last sync)
      const exportResult = await this.smartExportToCloud(lastSync)
      stats.uploaded += exportResult.exported

      // Update sync status
      this.syncStatus.lastSyncTime = new Date()
      this.syncStatus.syncStats = stats
      await this.updateSettings({ lastSyncTime: new Date() })

      // Reset pending changes
      this.pendingChanges = {
        products: false,
        sales: false,
        colors: false,
        payments: false,
        variants: false,
        returns: false,
        customer_accounts: false,
      }

      const syncTime = Date.now() - startTime
      console.log(`[Smart-Sync] Completed in ${syncTime}ms - Uploaded: ${stats.uploaded}, Downloaded: ${stats.downloaded}, Conflicts: ${stats.conflicts}`)
      
      this.syncStatus.syncInProgress = false
      return { success: true, message: `Sync completed in ${syncTime}ms`, stats }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.syncStatus.lastError = errorMsg
      this.syncStatus.syncInProgress = false
      console.error("[Smart-Sync] Failed:", errorMsg)
      return { success: false, message: `Sync failed: ${errorMsg}` }
    }
  }

  // ENHANCED: Detect changes with smart debouncing
  private detectChanges(entity: keyof typeof this.pendingChanges) {
    this.pendingChanges[entity] = true

    // Clear existing timer and set new one (debounce)
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer)
    }

    // Auto-sync after configured delay if changes detected
    this.autoSyncTimer = setTimeout(async () => {
      const hasChanges = Object.values(this.pendingChanges).some((changed) => changed)
      if (hasChanges) {
        const settings = await this.getSettings()
        if (settings.cloudSyncEnabled && this.syncStatus.isOnline) {
          await this.triggerAutoSync()
        }
      }
    }, SYNC_CONFIG.autoSyncDelay)
  }

  // ENHANCED: Queue changes for offline sync with better structure
  private async queueChange(action: "CREATE" | "UPDATE" | "DELETE", entity: string, entityId: string, data: any) {
    const change: ChangeRecord = {
      id: crypto.randomUUID(),
      action,
      entity,
      entityId,
      data,
      timestamp: new Date(),
      synced: false,
      retryCount: 0,
    }

    // Check for duplicate changes to same entity (consolidate)
    const existingIndex = this.syncQueue.findIndex(
      c => c.entity === entity && c.entityId === entityId && !c.synced
    )
    
    if (existingIndex > -1) {
      // Replace with newer change (last write wins locally)
      this.syncQueue[existingIndex] = change
      console.log(`[Sync] Updated queued change: ${action} ${entity}/${entityId}`)
    } else {
      this.syncQueue.push(change)
      console.log(`[Sync] Queued change: ${action} ${entity}/${entityId}`)
    }
    
    this.syncStatus.pendingChanges = this.syncQueue.filter(c => !c.synced).length
  }

  // ENHANCED: Get sync queue with status
  async getSyncQueue(): Promise<ChangeRecord[]> {
    return this.syncQueue.filter(c => !c.synced)
  }

  // ENHANCED: Process offline queue with batching and retry
  async processOfflineQueue(): Promise<{ processed: number; failed: number }> {
    const pendingChanges = this.syncQueue.filter(c => !c.synced)
    if (pendingChanges.length === 0) {
      return { processed: 0, failed: 0 }
    }

    const settings = await this.getSettings()
    if (!settings.cloudSyncEnabled || !settings.cloudDatabaseUrl) {
      return { processed: 0, failed: 0 }
    }

    console.log(`[Sync] Processing ${pendingChanges.length} offline changes in batches of ${SYNC_CONFIG.batchSize}...`)

    let processed = 0
    let failed = 0

    // Process in batches for better performance
    for (let i = 0; i < pendingChanges.length; i += SYNC_CONFIG.batchSize) {
      const batch = pendingChanges.slice(i, i + SYNC_CONFIG.batchSize)
      
      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(change => this.applyChangeToCloudWithRetry(change, settings.cloudDatabaseUrl!))
      )

      results.forEach((result, index) => {
        const change = batch[index]
        if (result.status === 'fulfilled') {
          change.synced = true
          processed++
        } else {
          change.retryCount++
          if (change.retryCount >= SYNC_CONFIG.retryAttempts) {
            console.error(`[Sync] Permanently failed after ${SYNC_CONFIG.retryAttempts} attempts:`, change.id)
            failed++
          }
        }
      })
    }

    // Clean up synced changes
    this.syncQueue = this.syncQueue.filter(c => !c.synced || c.retryCount < SYNC_CONFIG.retryAttempts)

    console.log(`[Sync] Queue processing completed: ${processed} processed, ${failed} failed`)
    return { processed, failed }
  }

  // ENHANCED: Apply change to cloud with retry logic
  private async applyChangeToCloudWithRetry(change: ChangeRecord, cloudUrl: string): Promise<void> {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(cloudUrl)

    for (let attempt = 0; attempt < SYNC_CONFIG.retryAttempts; attempt++) {
      try {
        await this.applyChangeToCloud(change, sql)
        return
      } catch (error) {
        if (attempt < SYNC_CONFIG.retryAttempts - 1) {
          console.log(`[Sync] Retry ${attempt + 1} for change ${change.id}...`)
          await new Promise(resolve => setTimeout(resolve, SYNC_CONFIG.retryDelay * (attempt + 1)))
        } else {
          throw error
        }
      }
    }
  }

  // ENHANCED: Apply single change to cloud database
  private async applyChangeToCloud(change: ChangeRecord, sql: any) {
    const { action, entity, entityId, data } = change

    switch (entity) {
      case 'products':
        if (action === 'DELETE') {
          await sql`DELETE FROM products WHERE id = ${entityId}`
        } else {
          await sql`
            INSERT INTO products (id, company, product_name, created_at)
            VALUES (${data.id}, ${data.company}, ${data.productName}, ${data.createdAt})
            ON CONFLICT (id) DO UPDATE SET
              company = EXCLUDED.company,
              product_name = EXCLUDED.product_name
          `
        }
        break
      case 'variants':
        if (action === 'DELETE') {
          await sql`DELETE FROM variants WHERE id = ${entityId}`
        } else {
          await sql`
            INSERT INTO variants (id, product_id, packing_size, rate, created_at)
            VALUES (${data.id}, ${data.productId}, ${data.packingSize}, ${data.rate}, ${data.createdAt})
            ON CONFLICT (id) DO UPDATE SET
              product_id = EXCLUDED.product_id,
              packing_size = EXCLUDED.packing_size,
              rate = EXCLUDED.rate
          `
        }
        break
      case 'colors':
        if (action === 'DELETE') {
          await sql`DELETE FROM colors WHERE id = ${entityId}`
        } else {
          await sql`
            INSERT INTO colors (id, variant_id, color_name, color_code, stock_quantity, rate_override, created_at)
            VALUES (${data.id}, ${data.variantId}, ${data.colorName}, ${data.colorCode}, ${data.stockQuantity}, ${data.rateOverride}, ${data.createdAt})
            ON CONFLICT (id) DO UPDATE SET
              variant_id = EXCLUDED.variant_id,
              color_name = EXCLUDED.color_name,
              color_code = EXCLUDED.color_code,
              stock_quantity = EXCLUDED.stock_quantity,
              rate_override = EXCLUDED.rate_override
          `
        }
        break
      case 'sales':
        if (action === 'DELETE') {
          await sql`DELETE FROM sales WHERE id = ${entityId}`
        } else {
          await sql`
            INSERT INTO sales (id, customer_name, customer_phone, total_amount, amount_paid, payment_status, due_date, is_manual_balance, notes, created_at)
            VALUES (${data.id}, ${data.customerName}, ${data.customerPhone}, ${data.totalAmount}, ${data.amountPaid}, ${data.paymentStatus}, ${data.dueDate}, ${data.isManualBalance}, ${data.notes}, ${data.createdAt})
            ON CONFLICT (id) DO UPDATE SET
              customer_name = EXCLUDED.customer_name,
              customer_phone = EXCLUDED.customer_phone,
              total_amount = EXCLUDED.total_amount,
              amount_paid = EXCLUDED.amount_paid,
              payment_status = EXCLUDED.payment_status,
              due_date = EXCLUDED.due_date,
              notes = EXCLUDED.notes
          `
        }
        break
      default:
        console.log(`[Sync] Unhandled entity type: ${entity}`)
    }
  }

  // ENHANCED: Smart delta import from cloud (only changes since last sync)
  private async smartImportFromCloud(lastSync: Date): Promise<{ imported: number; conflicts: number }> {
    const settings = await this.getSettings()
    if (!settings.cloudDatabaseUrl) return { imported: 0, conflicts: 0 }

    try {
      const { neon } = await import("@neondatabase/serverless")
      const sql = neon(settings.cloudDatabaseUrl)

      let imported = 0
      let conflicts = 0

      // Import products changed since last sync
      const cloudProducts = await sql`SELECT * FROM products WHERE created_at > ${lastSync} ORDER BY created_at`
      for (const p of cloudProducts) {
        try {
          await this.upsertProduct({
            id: p.id,
            company: p.company,
            productName: p.product_name,
            createdAt: new Date(p.created_at),
          })
          imported++
        } catch (err) {
          console.error(`[Import] Conflict on product ${p.id}:`, err)
          conflicts++
        }
      }

      // Import variants changed since last sync
      const cloudVariants = await sql`SELECT * FROM variants WHERE created_at > ${lastSync} ORDER BY created_at`
      for (const v of cloudVariants) {
        try {
          await this.upsertVariant({
            id: v.id,
            productId: v.product_id,
            packingSize: v.packing_size,
            rate: v.rate,
            createdAt: new Date(v.created_at),
          })
          imported++
        } catch (err) {
          console.error(`[Import] Conflict on variant ${v.id}:`, err)
          conflicts++
        }
      }

      // Import colors changed since last sync
      const cloudColors = await sql`SELECT * FROM colors WHERE created_at > ${lastSync} ORDER BY created_at`
      for (const c of cloudColors) {
        try {
          await this.upsertColor({
            id: c.id,
            variantId: c.variant_id,
            colorName: c.color_name,
            colorCode: c.color_code,
            stockQuantity: c.stock_quantity,
            rateOverride: c.rate_override,
            createdAt: new Date(c.created_at),
          })
          imported++
        } catch (err) {
          console.error(`[Import] Conflict on color ${c.id}:`, err)
          conflicts++
        }
      }

      // Import sales changed since last sync
      const cloudSales = await sql`SELECT * FROM sales WHERE created_at > ${lastSync} ORDER BY created_at`
      for (const s of cloudSales) {
        try {
          await this.upsertSale({
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
          } as any)
          imported++
        } catch (err) {
          console.error(`[Import] Conflict on sale ${s.id}:`, err)
          conflicts++
        }
      }

      console.log(`[Import] Delta import completed: ${imported} records, ${conflicts} conflicts`)
      return { imported, conflicts }
    } catch (error) {
      console.error("[Import] Delta import failed:", error)
      return { imported: 0, conflicts: 0 }
    }
  }

  // ENHANCED: Smart delta export to cloud (only local changes since last sync)
  private async smartExportToCloud(lastSync: Date): Promise<{ exported: number }> {
    const settings = await this.getSettings()
    if (!settings.cloudDatabaseUrl) return { exported: 0 }

    try {
      const { neon } = await import("@neondatabase/serverless")
      const cloudSql = neon(settings.cloudDatabaseUrl)

      let exported = 0

      // Export products created/updated since last sync (use gt for drizzle comparison)
      const localProducts = await db.select().from(products).where(gt(products.createdAt, lastSync))
      for (const p of localProducts) {
        try {
          await cloudSql`
            INSERT INTO products (id, company, product_name, created_at)
            VALUES (${p.id}, ${p.company}, ${p.productName}, ${p.createdAt})
            ON CONFLICT (id) DO UPDATE SET
              company = EXCLUDED.company,
              product_name = EXCLUDED.product_name
          `
          exported++
        } catch (err) {
          console.error(`[Export] Error exporting product ${p.id}:`, err)
        }
      }

      // Export variants created/updated since last sync
      const localVariants = await db.select().from(variants).where(gt(variants.createdAt, lastSync))
      for (const v of localVariants) {
        try {
          await cloudSql`
            INSERT INTO variants (id, product_id, packing_size, rate, created_at)
            VALUES (${v.id}, ${v.productId}, ${v.packingSize}, ${v.rate}, ${v.createdAt})
            ON CONFLICT (id) DO UPDATE SET
              product_id = EXCLUDED.product_id,
              packing_size = EXCLUDED.packing_size,
              rate = EXCLUDED.rate
          `
          exported++
        } catch (err) {
          console.error(`[Export] Error exporting variant ${v.id}:`, err)
        }
      }

      // Export colors created/updated since last sync
      const localColors = await db.select().from(colors).where(gt(colors.createdAt, lastSync))
      for (const c of localColors) {
        try {
          await cloudSql`
            INSERT INTO colors (id, variant_id, color_name, color_code, stock_quantity, rate_override, created_at)
            VALUES (${c.id}, ${c.variantId}, ${c.colorName}, ${c.colorCode}, ${c.stockQuantity}, ${c.rateOverride}, ${c.createdAt})
            ON CONFLICT (id) DO UPDATE SET
              variant_id = EXCLUDED.variant_id,
              color_name = EXCLUDED.color_name,
              color_code = EXCLUDED.color_code,
              stock_quantity = EXCLUDED.stock_quantity,
              rate_override = EXCLUDED.rate_override
          `
          exported++
        } catch (err) {
          console.error(`[Export] Error exporting color ${c.id}:`, err)
        }
      }

      // Export sales created/updated since last sync
      const localSales = await db.select().from(sales).where(gt(sales.createdAt, lastSync))
      for (const s of localSales) {
        try {
          await cloudSql`
            INSERT INTO sales (id, customer_name, customer_phone, total_amount, amount_paid, payment_status, due_date, is_manual_balance, notes, created_at)
            VALUES (${s.id}, ${s.customerName}, ${s.customerPhone}, ${s.totalAmount}, ${s.amountPaid}, ${s.paymentStatus}, ${s.dueDate}, ${s.isManualBalance}, ${s.notes}, ${s.createdAt})
            ON CONFLICT (id) DO UPDATE SET
              customer_name = EXCLUDED.customer_name,
              customer_phone = EXCLUDED.customer_phone,
              total_amount = EXCLUDED.total_amount,
              amount_paid = EXCLUDED.amount_paid,
              payment_status = EXCLUDED.payment_status,
              due_date = EXCLUDED.due_date,
              notes = EXCLUDED.notes
          `
          exported++
        } catch (err) {
          console.error(`[Export] Error exporting sale ${s.id}:`, err)
        }
      }

      console.log(`[Export] Delta export completed: ${exported} records`)
      return { exported }
    } catch (error) {
      console.error("[Export] Delta export failed:", error)
      return { exported: 0 }
    }
  }

  // Legacy methods kept for backward compatibility
  private async exportToCloud(): Promise<void> {
    const lastSync = new Date(0) // Full export
    await this.smartExportToCloud(lastSync)
  }

  private async importFromCloud(): Promise<void> {
    const lastSync = new Date(0) // Full import
    await this.smartImportFromCloud(lastSync)
  }

  // ENHANCED: Process sync queue (legacy wrapper)
  async processSyncQueue(): Promise<{ processed: number; failed: number }> {
    return this.processOfflineQueue()
  }

  // Settings
  async getSettings(): Promise<Settings> {
    try {
      const [setting] = await db.select().from(settings).where(eq(settings.id, "default"))
      if (!setting) {
        const defaultSettings: Settings = {
          id: "default",
          storeName: "PaintPulse",
          dateFormat: "DD-MM-YYYY",
          cardBorderStyle: "shadow",
          cardShadowSize: "sm",
          cardButtonColor: "gray-900",
          cardPriceColor: "blue-600",
          showStockBadgeBorder: false,
          displayTheme: "glass",
          displayShadowIntensity: "medium",
          displayBlurIntensity: "medium",
          auditPinHash: null,
          auditPinSalt: null,
          permStockDelete: true,
          permStockEdit: true,
          permStockHistoryDelete: true,
          permSalesDelete: true,
          permSalesEdit: true,
          permPaymentEdit: true,
          permPaymentDelete: true,
          permDatabaseAccess: true,
          cloudDatabaseUrl: null,
          cloudSyncEnabled: false,
          lastSyncTime: null,
          masterPinHash: null,
          masterPinSalt: null,
          updatedAt: new Date(),
        }
        try {
          await db.insert(settings).values(defaultSettings)
          console.log("[Storage] Default settings created")
        } catch (insertError) {
          console.error("[Storage] Error inserting default settings:", insertError)
        }
        return defaultSettings
      }
      return setting
    } catch (error) {
      console.error("[Storage] Error getting settings:", error)
      const defaultSettings: Settings = {
        id: "default",
        storeName: "PaintPulse",
        dateFormat: "DD-MM-YYYY",
        cardBorderStyle: "shadow",
        cardShadowSize: "sm",
        cardButtonColor: "gray-900",
        cardPriceColor: "blue-600",
        showStockBadgeBorder: false,
        displayTheme: "glass",
        displayShadowIntensity: "medium",
        displayBlurIntensity: "medium",
        auditPinHash: null,
        auditPinSalt: null,
        permStockDelete: true,
        permStockEdit: true,
        permStockHistoryDelete: true,
        permSalesDelete: true,
        permSalesEdit: true,
        permPaymentEdit: true,
        permPaymentDelete: true,
        permDatabaseAccess: true,
          cloudDatabaseUrl: null,
          cloudSyncEnabled: false,
          lastSyncTime: null,
          masterPinHash: null,
          masterPinSalt: null,
          updatedAt: new Date(),
        }
        return defaultSettings
      }
    }

    async updateSettings(data: UpdateSettings): Promise<Settings> {
      try {
        const existing = await db.select().from(settings).where(eq(settings.id, "default"))

        if (existing.length === 0) {
          const defaultSettings: Settings = {
            id: "default",
            storeName: data.storeName || "PaintPulse",
            dateFormat: data.dateFormat || "DD-MM-YYYY",
            cardBorderStyle: data.cardBorderStyle || "shadow",
            cardShadowSize: data.cardShadowSize || "sm",
            cardButtonColor: data.cardButtonColor || "gray-900",
            cardPriceColor: data.cardPriceColor || "blue-600",
            showStockBadgeBorder: data.showStockBadgeBorder ?? false,
            displayTheme: data.displayTheme || "glass",
            displayShadowIntensity: data.displayShadowIntensity || "medium",
            displayBlurIntensity: data.displayBlurIntensity || "medium",
            auditPinHash: data.auditPinHash || null,
            auditPinSalt: data.auditPinSalt || null,
            permStockDelete: data.permStockDelete ?? true,
            permStockEdit: data.permStockEdit ?? true,
            permSalesDelete: data.permSalesDelete ?? true,
            permSalesEdit: data.permSalesEdit ?? true,
            permPaymentEdit: data.permPaymentEdit ?? true,
            permPaymentDelete: data.permPaymentDelete ?? true,
            permDatabaseAccess: data.permDatabaseAccess ?? true,
            cloudDatabaseUrl: data.cloudDatabaseUrl || null,
            cloudSyncEnabled: data.cloudSyncEnabled ?? false,
            lastSyncTime: data.lastSyncTime ?? null,
            masterPinHash: data.masterPinHash || null,
            masterPinSalt: data.masterPinSalt || null,
            updatedAt: new Date(),
          }
          await db.insert(settings).values(defaultSettings)
          return defaultSettings
        }

        const updateData: any = {
          updatedAt: new Date(),
        }

        if (data.storeName !== undefined) updateData.storeName = data.storeName
        if (data.dateFormat !== undefined) updateData.dateFormat = data.dateFormat
        if (data.cardBorderStyle !== undefined) updateData.cardBorderStyle = data.cardBorderStyle
        if (data.cardShadowSize !== undefined) updateData.cardShadowSize = data.cardShadowSize
        if (data.cardButtonColor !== undefined) updateData.cardButtonColor = data.cardButtonColor
        if (data.cardPriceColor !== undefined) updateData.cardPriceColor = data.cardPriceColor
        if (data.showStockBadgeBorder !== undefined) updateData.showStockBadgeBorder = data.showStockBadgeBorder
        if (data.displayTheme !== undefined) updateData.displayTheme = data.displayTheme
        if (data.displayShadowIntensity !== undefined) updateData.displayShadowIntensity = data.displayShadowIntensity
        if (data.displayBlurIntensity !== undefined) updateData.displayBlurIntensity = data.displayBlurIntensity
        if (data.auditPinHash !== undefined) updateData.auditPinHash = data.auditPinHash
        if (data.auditPinSalt !== undefined) updateData.auditPinSalt = data.auditPinSalt
        if (data.permStockDelete !== undefined) updateData.permStockDelete = data.permStockDelete
        if (data.permStockEdit !== undefined) updateData.permStockEdit = data.permStockEdit
        if (data.permStockHistoryDelete !== undefined) updateData.permStockHistoryDelete = data.permStockHistoryDelete
        if (data.permSalesDelete !== undefined) updateData.permSalesDelete = data.permSalesDelete
        if (data.permSalesEdit !== undefined) updateData.permSalesEdit = data.permSalesEdit
        if (data.permPaymentEdit !== undefined) updateData.permPaymentEdit = data.permPaymentEdit
        if (data.permPaymentDelete !== undefined) updateData.permPaymentDelete = data.permPaymentDelete
        if (data.permDatabaseAccess !== undefined) updateData.permDatabaseAccess = data.permDatabaseAccess
        if (data.cloudDatabaseUrl !== undefined) updateData.cloudDatabaseUrl = data.cloudDatabaseUrl
        if (data.cloudSyncEnabled !== undefined) updateData.cloudSyncEnabled = data.cloudSyncEnabled
        if (data.lastSyncTime !== undefined) updateData.lastSyncTime = data.lastSyncTime
        if (data.masterPinHash !== undefined) updateData.masterPinHash = data.masterPinHash
        if (data.masterPinSalt !== undefined) updateData.masterPinSalt = data.masterPinSalt

        await db.update(settings).set(updateData).where(eq(settings.id, "default"))

        const updated = await this.getSettings()
        console.log("[Storage] Settings updated")
        return updated
      } catch (error) {
        console.error("[Storage] Error updating settings:", error)
        throw new Error("Failed to update settings")
      }
    }

    // Products - UPDATED WITH AUTO-SYNC
    async getProducts(): Promise<Product[]> {
      return await db.select().from(products).orderBy(desc(products.createdAt))
    }

    async getProduct(id: string): Promise<Product | undefined> {
      const [product] = await db.select().from(products).where(eq(products.id, id))
      return product || undefined
    }

    async createProduct(insertProduct: InsertProduct): Promise<Product> {
      const product: Product = {
        id: crypto.randomUUID(),
        ...insertProduct,
        createdAt: new Date(),
      }
      await db.insert(products).values(product)

      // AUTO-SYNC TRIGGER
      this.detectChanges("products")

      return product
    }

    async updateProduct(id: string, data: { company: string; productName: string }): Promise<Product> {
      await db.update(products).set({ company: data.company, productName: data.productName }).where(eq(products.id, id))
      const updated = await this.getProduct(id)
      if (!updated) throw new Error("Product not found after update")

      // AUTO-SYNC TRIGGER
      this.detectChanges("products")

      return updated
    }

    async deleteProduct(id: string): Promise<void> {
      await db.delete(products).where(eq(products.id, id))

      // AUTO-SYNC TRIGGER
      this.detectChanges("products")
    }

    // Variants - UPDATED WITH AUTO-SYNC
    async getVariants(): Promise<VariantWithProduct[]> {
      const result = await db.query.variants.findMany({
        with: {
          product: true,
        },
        orderBy: desc(variants.createdAt),
      })
      return result
    }

    async getVariant(id: string): Promise<Variant | undefined> {
      const [variant] = await db.select().from(variants).where(eq(variants.id, id))
      return variant || undefined
    }

    async createVariant(insertVariant: InsertVariant): Promise<Variant> {
      const variant: Variant = {
        id: crypto.randomUUID(),
        ...insertVariant,
        rate: typeof insertVariant.rate === "number" ? insertVariant.rate.toString() : insertVariant.rate,
        createdAt: new Date(),
      }
      await db.insert(variants).values(variant)

      // AUTO-SYNC TRIGGER
      this.detectChanges("variants")

      return variant
    }

    async updateVariant(id: string, data: { productId: string; packingSize: string; rate: number }): Promise<Variant> {
      await db
        .update(variants)
        .set({
          productId: data.productId,
          packingSize: data.packingSize,
          rate: data.rate.toString(),
        })
        .where(eq(variants.id, id))

      const [variant] = await db.select().from(variants).where(eq(variants.id, id))
      if (!variant) throw new Error("Variant not found after update")

      // AUTO-SYNC TRIGGER
      this.detectChanges("variants")

      return variant
    }

    async updateVariantRate(id: string, rate: number): Promise<Variant> {
      await db.update(variants).set({ rate: rate.toString() }).where(eq(variants.id, id))

      const [variant] = await db.select().from(variants).where(eq(variants.id, id))
      if (!variant) throw new Error("Variant not found after update")

      // AUTO-SYNC TRIGGER
      this.detectChanges("variants")

      return variant
    }

    async deleteVariant(id: string): Promise<void> {
      await db.delete(variants).where(eq(variants.id, id))

      // AUTO-SYNC TRIGGER
      this.detectChanges("variants")
    }

    // Colors - UPDATED WITH AUTO-SYNC
    async getColors(): Promise<ColorWithVariantAndProduct[]> {
      const result = await db.query.colors.findMany({
        with: {
          variant: {
            with: {
              product: true,
            },
          },
        },
        orderBy: desc(colors.createdAt),
      })
      return result
    }

    async getColor(id: string): Promise<Color | undefined> {
      const [color] = await db.select().from(colors).where(eq(colors.id, id))
      return color || undefined
    }

    async createColor(insertColor: InsertColor): Promise<Color> {
      const color: Color = {
        id: crypto.randomUUID(),
        ...insertColor,
        rateOverride:
          typeof insertColor.rateOverride === "number"
            ? insertColor.rateOverride.toString()
            : insertColor.rateOverride || null,
        createdAt: new Date(),
      }
      await db.insert(colors).values(color)

      // AUTO-SYNC TRIGGER
      this.detectChanges("colors")

      return color
    }

    async updateColor(id: string, data: { colorName: string; colorCode: string; stockQuantity: number }): Promise<Color> {
      await db
        .update(colors)
        .set({
          colorName: data.colorName,
          colorCode: data.colorCode,
          stockQuantity: data.stockQuantity,
        })
        .where(eq(colors.id, id))

      const [color] = await db.select().from(colors).where(eq(colors.id, id))
      if (!color) throw new Error("Color not found after update")

      // AUTO-SYNC TRIGGER
      this.detectChanges("colors")

      return color
    }

    async updateColorStock(id: string, stockQuantity: number): Promise<Color> {
      await db.update(colors).set({ stockQuantity }).where(eq(colors.id, id))

      const [color] = await db.select().from(colors).where(eq(colors.id, id))
      if (!color) throw new Error("Color not found after update")

      // AUTO-SYNC TRIGGER
      this.detectChanges("colors")

      return color
    }

    async updateColorRateOverride(id: string, rateOverride: number | null): Promise<Color> {
      await db
        .update(colors)
        .set({ rateOverride: rateOverride !== null ? rateOverride.toString() : null })
        .where(eq(colors.id, id))

      const [color] = await db.select().from(colors).where(eq(colors.id, id))
      if (!color) throw new Error("Color not found after update")

      // AUTO-SYNC TRIGGER
      this.detectChanges("colors")

      return color
    }

    async stockIn(id: string, quantity: number, notes?: string, stockInDate?: string): Promise<Color> {
      try {
        console.log(`[Storage] Starting stock in for color ${id}, quantity: ${quantity}, date: ${stockInDate}`)

        const [currentColor] = await db.select().from(colors).where(eq(colors.id, id))
        if (!currentColor) {
          console.error(`[Storage] Color not found: ${id}`)
          throw new Error("Color not found")
        }

        const previousStock = currentColor.stockQuantity
        const newStock = previousStock + quantity

        console.log(`[Storage] Stock update: Previous: ${previousStock}, Adding: ${quantity}, New: ${newStock}`)

        await db
          .update(colors)
          .set({
            stockQuantity: newStock,
          })
          .where(eq(colors.id, id))

        try {
          const actualStockInDate =
            stockInDate && this.isValidDDMMYYYY(stockInDate) ? stockInDate : this.formatDateToDDMMYYYY(new Date())

          const historyRecord = {
            id: crypto.randomUUID(),
            colorId: id,
            quantity,
            previousStock,
            newStock,
            notes: notes || "Stock added via stock management",
            stockInDate: actualStockInDate,
            createdAt: new Date(),
          }

          console.log("[Storage] Recording stock history:", historyRecord)
          await db.insert(stockInHistory).values(historyRecord)
        } catch (historyError) {
          console.error("[Storage] Error recording history (non-fatal):", historyError)
        }

        const [updatedColor] = await db.select().from(colors).where(eq(colors.id, id))
        if (!updatedColor) {
          console.error(`[Storage] Color not found after update: ${id}`)
          throw new Error("Color not found after stock update")
        }

        console.log(`[Storage] Stock in successful: ${updatedColor.colorName} - New stock: ${updatedColor.stockQuantity}`)

        // AUTO-SYNC TRIGGER
        this.detectChanges("colors")

        return updatedColor
      } catch (error) {
        console.error("[Storage] Error in stockIn:", error)
        throw new Error(`Failed to add stock: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    async deleteColor(id: string): Promise<void> {
      await db.delete(colors).where(eq(colors.id, id))

      // AUTO-SYNC TRIGGER
      this.detectChanges("colors")
    }

    // Stock In History
    async getStockInHistory(): Promise<StockInHistoryWithColor[]> {
      try {
        console.log("[Storage] Fetching stock in history")

        const result = await db.query.stockInHistory.findMany({
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
          orderBy: desc(stockInHistory.createdAt),
        })

        console.log(`[Storage] Found ${result.length} history records`)
        return result
      } catch (error) {
        console.error("[Storage] Error fetching stock in history:", error)
        if (error instanceof Error && error.message.includes("no such table")) {
          console.log("[Storage] stock_in_history table doesn't exist yet")
          return []
        }
        throw error
      }
    }

    // OPTIMIZED: Paginated stock history query for large datasets
    async getStockInHistoryPaginated(params: PaginationParams = {}): Promise<PaginatedResult<StockInHistoryWithColor>> {
      const page = Math.max(1, params.page || 1)
      const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT))
      const offset = (page - 1) * limit

      try {
        // Get total count
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(stockInHistory)
        const total = Number(countResult[0]?.count || 0)

        // Get paginated data with relations
        const result = await db.query.stockInHistory.findMany({
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
          orderBy: desc(stockInHistory.createdAt),
          limit,
          offset,
        })

        return {
          data: result,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
          },
        }
      } catch (error) {
        console.error("[Storage] Error fetching paginated stock history:", error)
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
        }
      }
    }

    async getFilteredStockInHistory(filters: {
      startDate?: Date
      endDate?: Date
      company?: string
      product?: string
      colorCode?: string
      colorName?: string
    }): Promise<StockInHistoryWithColor[]> {
      try {
        console.log("[Storage] Fetching filtered stock in history:", filters)

        const query = db.query.stockInHistory.findMany({
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
          orderBy: desc(stockInHistory.createdAt),
        })

        const result = await query

        let filtered = result

        if (filters.startDate && filters.endDate) {
          const start = filters.startDate.getTime()
          const end = filters.endDate.getTime()
          filtered = filtered.filter((record) => {
            const recordDate = new Date(record.createdAt).getTime()
            return recordDate >= start && recordDate <= end
          })
        } else if (filters.startDate) {
          const start = filters.startDate.getTime()
          filtered = filtered.filter((record) => new Date(record.createdAt).getTime() >= start)
        } else if (filters.endDate) {
          const end = filters.endDate.getTime()
          filtered = filtered.filter((record) => new Date(record.createdAt).getTime() <= end)
        }

        if (filters.company && filters.company !== "all") {
          filtered = filtered.filter((record) => record.color.variant.product.company === filters.company)
        }

        if (filters.product && filters.product !== "all") {
          filtered = filtered.filter((record) => record.color.variant.product.productName === filters.product)
        }

        if (filters.colorCode) {
          filtered = filtered.filter((record) =>
            record.color.colorCode.toLowerCase().includes(filters.colorCode!.toLowerCase()),
          )
        }

        if (filters.colorName) {
          filtered = filtered.filter((record) =>
            record.color.colorName.toLowerCase().includes(filters.colorName!.toLowerCase()),
          )
        }

        console.log(`[Storage] Found ${filtered.length} filtered history records`)
        return filtered
      } catch (error) {
        console.error("[Storage] Error fetching filtered stock in history:", error)
        return []
      }
    }

    async recordStockIn(
      colorId: string,
      quantity: number,
      previousStock: number,
      newStock: number,
      notes?: string,
      stockInDate?: string,
    ): Promise<StockInHistoryWithColor> {
      try {
        const actualStockInDate =
          stockInDate && this.isValidDDMMYYYY(stockInDate) ? stockInDate : this.formatDateToDDMMYYYY(new Date())

        const historyRecord = {
          id: crypto.randomUUID(),
          colorId,
          quantity,
          previousStock,
          newStock,
          notes: notes || null,
          stockInDate: actualStockInDate,
          createdAt: new Date(),
        }

        console.log("Recording stock in history:", historyRecord)

        await db.insert(stockInHistory).values(historyRecord)

        const result = await db.query.stockInHistory.findFirst({
          where: eq(stockInHistory.id, historyRecord.id),
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        })

        if (!result) throw new Error("Failed to create stock in history record")
        return result
      } catch (error) {
        console.error("Error recording stock in history:", error)
        throw error
      }
    }

    async deleteStockInHistory(id: string): Promise<void> {
      try {
        await db.delete(stockInHistory).where(eq(stockInHistory.id, id))
        console.log(`[Storage] Deleted stock history record: ${id}`)
      } catch (error) {
        console.error("[Storage] Error deleting stock history:", error)
        throw new Error("Failed to delete stock history record")
      }
    }

    async updateStockInHistory(
      id: string,
      data: { quantity?: number; notes?: string; stockInDate?: string },
    ): Promise<StockInHistoryWithColor> {
      try {
        const [currentRecord] = await db.query.stockInHistory.findFirst({
          where: eq(stockInHistory.id, id),
        })

        if (!currentRecord) {
          throw new Error("Stock history record not found")
        }

        const updateData: any = {}

        if (data.quantity !== undefined) {
          const newQuantity = data.quantity
          const newStock = currentRecord.previousStock + newQuantity

          updateData.quantity = newQuantity
          updateData.newStock = newStock

          await db
            .update(colors)
            .set({
              stockQuantity: newStock,
            })
            .where(eq(colors.id, currentRecord.colorId))
        }

        if (data.notes !== undefined) {
          updateData.notes = data.notes
        }

        if (data.stockInDate !== undefined) {
          if (data.stockInDate && !this.isValidDDMMYYYY(data.stockInDate)) {
            throw new Error("Invalid date format. Please use DD-MM-YYYY format.")
          }
          updateData.stockInDate = data.stockInDate
        }

        await db.update(stockInHistory).set(updateData).where(eq(stockInHistory.id, id))

        const result = await db.query.stockInHistory.findFirst({
          where: eq(stockInHistory.id, id),
          with: {
            color: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        })

        if (!result) throw new Error("Stock history record not found after update")
        return result
      } catch (error) {
        console.error("[Storage] Error updating stock history:", error)
        throw new Error("Failed to update stock history record")
      }
    }

    // Payment History
    async recordPaymentHistory(data: {
      saleId: string
      customerPhone: string
      amount: number
      previousBalance: number
      newBalance: number
      paymentMethod?: string
      notes?: string
    }): Promise<PaymentHistory> {
      const paymentRecord: PaymentHistory = {
        id: crypto.randomUUID(),
        saleId: data.saleId,
        customerPhone: data.customerPhone,
        amount: data.amount.toString(),
        previousBalance: data.previousBalance.toString(),
        newBalance: data.newBalance.toString(),
        paymentMethod: data.paymentMethod || "cash",
        notes: data.notes || null,
        createdAt: new Date(),
        paymentDate: new Date().toISOString(),
      }

      await db.insert(paymentHistory).values(paymentRecord)

      // AUTO-SYNC TRIGGER
      this.detectChanges("payments")

      return paymentRecord
    }

    async getPaymentHistoryByCustomer(customerPhone: string): Promise<PaymentHistoryWithSale[]> {
      const result = await db.query.paymentHistory.findMany({
        where: eq(paymentHistory.customerPhone, customerPhone),
        with: {
          sale: true,
        },
        orderBy: desc(paymentHistory.createdAt),
      })
      return result
    }

    async getPaymentHistoryBySale(saleId: string): Promise<PaymentHistory[]> {
      return await db
        .select()
        .from(paymentHistory)
        .where(eq(paymentHistory.saleId, saleId))
        .orderBy(desc(paymentHistory.createdAt))
    }

    async updatePaymentHistory(
      id: string,
      data: {
        amount?: number
        paymentMethod?: string
        notes?: string
      },
    ): Promise<PaymentHistory | null> {
      const [existing] = await db.select().from(paymentHistory).where(eq(paymentHistory.id, id))
      if (!existing) {
        return null
      }

      const oldAmount = Number.parseFloat(existing.amount)
      const newAmount = data.amount !== undefined ? data.amount : oldAmount
      const amountDifference = newAmount - oldAmount

      const updateData: any = {}
      if (data.amount !== undefined) {
        updateData.amount = data.amount.toString()
      }
      if (data.paymentMethod !== undefined) {
        updateData.paymentMethod = data.paymentMethod
      }
      if (data.notes !== undefined) {
        updateData.notes = data.notes
      }

      await db.update(paymentHistory).set(updateData).where(eq(paymentHistory.id, id))

      if (amountDifference !== 0) {
        const [sale] = await db.select().from(sales).where(eq(sales.id, existing.saleId))
        if (sale) {
          const totalAmount = Number.parseFloat(sale.totalAmount)
          const currentPaid = Number.parseFloat(sale.amountPaid)
          const newPaid = Math.max(0, currentPaid + amountDifference)

          let newPaymentStatus: string
          if (newPaid >= totalAmount) {
            newPaymentStatus = "paid"
          } else if (newPaid > 0) {
            newPaymentStatus = "partial"
          } else {
            newPaymentStatus = "unpaid"
          }

          await db
            .update(sales)
            .set({
              amountPaid: newPaid.toString(),
              paymentStatus: newPaymentStatus,
            })
            .where(eq(sales.id, existing.saleId))
        }
      }

      const [updated] = await db.select().from(paymentHistory).where(eq(paymentHistory.id, id))

      // AUTO-SYNC TRIGGER
      this.detectChanges("payments")
      this.detectChanges("sales")

      return updated
    }

    async deletePaymentHistory(id: string): Promise<boolean> {
      const [existing] = await db.select().from(paymentHistory).where(eq(paymentHistory.id, id))
      if (!existing) {
        return false
      }

      const deletedAmount = Number.parseFloat(existing.amount)
      const [sale] = await db.select().from(sales).where(eq(sales.id, existing.saleId))

      await db.delete(paymentHistory).where(eq(paymentHistory.id, id))

      if (sale) {
        const totalAmount = Number.parseFloat(sale.totalAmount)
        const currentPaid = Number.parseFloat(sale.amountPaid)
        const newPaid = Math.max(0, currentPaid - deletedAmount)

        let newPaymentStatus: string
        if (newPaid >= totalAmount) {
          newPaymentStatus = "paid"
        } else if (newPaid > 0) {
          newPaymentStatus = "partial"
        } else {
          newPaymentStatus = "unpaid"
        }

        await db
          .update(sales)
          .set({
            amountPaid: newPaid.toString(),
            paymentStatus: newPaymentStatus,
          })
          .where(eq(sales.id, existing.saleId))
      }

      // AUTO-SYNC TRIGGER
      this.detectChanges("payments")
      this.detectChanges("sales")

      return true
    }

    async getAllPaymentHistory(): Promise<PaymentHistoryWithSale[]> {
      const result = await db.query.paymentHistory.findMany({
        with: {
          sale: true,
        },
        orderBy: desc(paymentHistory.createdAt),
      })
      return result
    }

    // OPTIMIZED: Paginated payment history query for large datasets
    async getAllPaymentHistoryPaginated(params: PaginationParams = {}): Promise<PaginatedResult<PaymentHistoryWithSale>> {
      const page = Math.max(1,
      const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT))
      const offset = (page - 1) * limit

      try {
        // Get total count
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(paymentHistory)
        const total = Number(countResult[0]?.count || 0)

        // Get paginated data with relations
        const result = await db.query.paymentHistory.findMany({
          with: {
            sale: true,
          },
          orderBy: desc(paymentHistory.createdAt),
          limit,
          offset,
        })

        return {
          data: result,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
          },
        }
      } catch (error) {
        console.error("[Storage] Error fetching paginated payment history:", error)
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
        }
      }
    }

    // Sales - UPDATED WITH AUTO-SYNC AND FIXED PROPERTIES
    async getSales(): Promise<ExtendedSale[]> {
      const salesData = await db.select().from(sales).orderBy(desc(sales.createdAt))
      return salesData.map((sale) => ({
        ...sale,
        dueDate: sale.dueDate,
        isManualBalance: sale.isManualBalance,
        notes: sale.notes,
      })) as ExtendedSale[]
    }

    // OPTIMIZED: Paginated sales query for large datasets
    async getSalesPaginated(params: PaginationParams = {}): Promise<PaginatedResult<ExtendedSale>> {
      const page = Math.max(1, params.page || 1)
      const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT))
      const offset = (page - 1) * limit

      // Get total count efficiently
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(sales)
      const total = Number(countResult[0]?.count || 0)

      // Get paginated data
      const salesData = await db
        .select()
        .from(sales)
        .orderBy(desc(sales.createdAt))
        .limit(limit)
        .offset(offset)

      const data = salesData.map((sale) => ({
        ...sale,
        dueDate: sale.dueDate,
        isManualBalance: sale.isManualBalance,
        notes: sale.notes,
      })) as ExtendedSale[]

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      }
    }

    async getSalesWithItems(): Promise<SaleWithItems[]> {
      const allSales = await db.query.sales.findMany({
        with: {
          saleItems: {
            with: {
              color: {
                with: {
                  variant: {
                    with: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [desc(sales.createdAt)],
      })
      return allSales
    }

    async getUnpaidSales(): Promise<ExtendedSale[]> {
      const unpaidData = await db
        .select()
        .from(sales)
        .where(sql`${sales.paymentStatus} != 'paid'`)
        .orderBy(desc(sales.createdAt))

      return unpaidData.map((sale) => ({
        ...sale,
        dueDate: sale.dueDate,
        isManualBalance: sale.isManualBalance,
        notes: sale.notes,
      })) as ExtendedSale[]
    }

    // OPTIMIZED: Paginated unpaid sales query for large datasets
    async getUnpaidSalesPaginated(params: PaginationParams = {}): Promise<PaginatedResult<ExtendedSale>> {
      const page = Math.max(1, params.page || 1)
      const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT))
      const offset = (page - 1) * limit

      // Get total count of unpaid sales
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(sales)
        .where(sql`${sales.paymentStatus} != 'paid'`)
      const total = Number(countResult[0]?.count || 0)

      // Get paginated unpaid data
      const unpaidData = await db
        .select()
        .from(sales)
        .where(sql`${sales.paymentStatus} != 'paid'`)
        .orderBy(desc(sales.createdAt))
        .limit(limit)
        .offset(offset)

      const data = unpaidData.map((sale) => ({
        ...sale,
        dueDate: sale.dueDate,
        isManualBalance: sale.isManualBalance,
        notes: sale.notes,
      })) as ExtendedSale[]

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      }
    }

    async getSalesByCustomerPhone(customerPhone: string): Promise<ExtendedSale[]> {
      const salesData = await db
        .select()
        .from(sales)
        .where(eq(sales.customerPhone, customerPhone))
        .orderBy(desc(sales.createdAt))

      return salesData.map((sale) => ({
        ...sale,
        dueDate: sale.dueDate,
        isManualBalance: sale.isManualBalance,
        notes: sale.notes,
      })) as ExtendedSale[]
    }

    async getSalesByCustomerPhoneWithItems(customerPhone: string): Promise<SaleWithItems[]> {
      try {
        const customerSales = await db.query.sales.findMany({
          where: eq(sales.customerPhone, customerPhone),
          with: {
            saleItems: {
              with: {
                color: {
                  with: {
                    variant: {
                      with: {
                        product: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [desc(sales.createdAt)],
        })

        // Ensure all saleItems have quantityReturned set
        return customerSales.map((sale) => ({
          ...sale,
          saleItems: (sale.saleItems || []).map((item) => ({
            ...item,
            quantityReturned: item.quantityReturned ?? 0,
          })),
        }))
      } catch (error) {
        console.error("[Storage] Error in getSalesByCustomerPhoneWithItems:", error)
        // Return empty array instead of throwing
        return []
      }
    }

    async findUnpaidSaleByPhone(customerPhone: string): Promise<ExtendedSale | undefined> {
      const [sale] = await db
        .select()
        .from(sales)
        .where(and(eq(sales.customerPhone, customerPhone), sql`${sales.paymentStatus} != 'paid'`))
        .orderBy(desc(sales.createdAt))
        .limit(1)

      return sale
        ? ({
            ...sale,
            dueDate: sale.dueDate,
            isManualBalance: sale.isManualBalance,
            notes: sale.notes,
          } as ExtendedSale)
        : undefined
    }

    async getSale(id: string): Promise<SaleWithItems | undefined> {
      const result = await db.query.sales.findFirst({
        where: eq(sales.id, id),
        with: {
          saleItems: {
            with: {
              color: {
                with: {
                  variant: {
                    with: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
      return result
    }

    async createSale(insertSale: ExtendedInsertSale, items: InsertSaleItem[]): Promise<ExtendedSale> {
      const sale: ExtendedSale = {
        id: crypto.randomUUID(),
        ...insertSale,
        totalAmount:
          typeof insertSale.totalAmount === "number" ? insertSale.totalAmount.toString() : insertSale.totalAmount,
        amountPaid: typeof insertSale.amountPaid === "number" ? insertSale.amountPaid.toString() : insertSale.amountPaid,
        dueDate: insertSale.dueDate || null,
        isManualBalance: insertSale.isManualBalance || false,
        notes: insertSale.notes || null,
        createdAt: new Date(),
      }
      await db.insert(sales).values(sale)

      const saleItemsToInsert = items.map((item) => ({
        id: crypto.randomUUID(),
        ...item,
        saleId: sale.id,
        rate: typeof item.rate === "number" ? item.rate.toString() : item.rate,
        subtotal: typeof item.subtotal === "number" ? item.subtotal.toString() : item.subtotal,
        quantityReturned: 0, // Initialize quantityReturned
      }))
      await db.insert(saleItems).values(saleItemsToInsert)

      console.log(`[Storage] Updating stock for ${items.length} items...`)
      const { sqliteDb } = await import("./db")
      const today = new Date()
      const stockOutDate = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`
      
      for (const item of items) {
        const [currentColor] = await db.select().from(colors).where(eq(colors.id, item.colorId))
        const previousStock = currentColor?.stockQuantity ?? 0

        await db
          .update(colors)
          .set({
            stockQuantity: sql`${colors.stockQuantity} - ${item.quantity}`,
          })
          .where(eq(colors.id, item.colorId))

        const [updatedColor] = await db.select().from(colors).where(eq(colors.id, item.colorId))
        const newStock = updatedColor?.stockQuantity ?? 0
        
        console.log(
          `[Storage] Stock reduced: ${currentColor?.colorName || item.colorId} - Previous: ${previousStock}, Sold: ${item.quantity}, New: ${newStock}`,
        )
        
        // Record in stock_out_history
        if (sqliteDb) {
          try {
            sqliteDb
              .prepare(`
              INSERT INTO stock_out_history (id, color_id, quantity, previous_stock, new_stock, movement_type, reference_id, reference_type, reason, stock_out_date, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
              .run(
                crypto.randomUUID(),
                item.colorId,
                item.quantity,
                previousStock,
                newStock,
                "sale",
                sale.id,
                "sale",
                "Sold via POS",
                stockOutDate,
                `Customer: ${insertSale.customerName}`,
                Date.now(),
              )
            console.log(`[Storage] Stock out history recorded for: ${currentColor?.colorName}`)
          } catch (err) {
            console.error("[Storage] Failed to record stock out history:", err)
          }
        }
      }

      // AUTO-SYNC TRIGGER
      this.detectChanges("sales")

      return sale
    }

    // FIXED: updateSalePayment method with correct balance calculation
    async updateSalePayment(
      saleId: string,
      amount: number,
      paymentMethod?: string,
      notes?: string,
    ): Promise<ExtendedSale> {
      try {
        // Validate input
        if (amount <= 0) {
          throw new Error("Payment amount must be greater than 0")
        }

        // Get sale details
        const [sale] = await db.select().from(sales).where(eq(sales.id, saleId))
        if (!sale) {
          throw new Error("Sale not found")
        }

        // Calculate current values
        const totalAmount = Number.parseFloat(sale.totalAmount)
        const currentPaid = Number.parseFloat(sale.amountPaid)
        const previousBalance = Math.max(0, totalAmount - currentPaid)
        
        console.log("[Payment Debug Storage]", {
          saleId,
          totalAmount,
          currentPaid,
          previousBalance,
          paymentAmount: amount
        })

        // Validate payment doesn't exceed outstanding
        if (amount > previousBalance) {
          throw new Error(`Payment amount (Rs. ${amount}) exceeds outstanding balance (Rs. ${previousBalance})`)
        }

        // Calculate new values
        const newPaid = currentPaid + amount
        const newBalance = Math.max(0, totalAmount - newPaid)

        // Determine payment status
        let paymentStatus: string
        if (newPaid >= totalAmount) {
          paymentStatus = "paid"
        } else if (newPaid > 0) {
          paymentStatus = "partial"
        } else {
          paymentStatus = "unpaid"
        }

        // Update sale with new payment info
        await db
          .update(sales)
          .set({
            amountPaid: newPaid.toString(),
            paymentStatus,
          })
          .where(eq(sales.id, saleId))

        // Record payment history with correct balance entries
        try {
          const paymentRecord = await this.recordPaymentHistory({
            saleId,
            customerPhone: sale.customerPhone,
            amount,
            previousBalance: previousBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod || "cash",
            notes,
          })

          console.log("[Payment Recorded Storage]", {
            saleId,
            amount,
            previousBalance,
            newBalance,
            paymentRecordId: paymentRecord.id
          })
        } catch (paymentHistoryError) {
          console.error("[Storage] Error recording payment history:", paymentHistoryError)
          // Continue even if history recording fails
        }

        // Sync customer account
        await this.syncCustomerAccount(sale.customerPhone)

        const [updatedSale] = await db.select().from(sales).where(eq(sales.id, saleId))

        // AUTO-SYNC TRIGGER
        this.detectChanges("sales")
        this.detectChanges("payments")

        return {
          ...updatedSale,
          dueDate: updatedSale.dueDate,
          isManualBalance: updatedSale.isManualBalance,
          notes: updatedSale.notes,
        } as ExtendedSale
      } catch (error) {
        console.error("[Storage] Payment update error:", error)
        // Re-throw with better message
        throw new Error(`Failed to record payment: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    async createManualBalance(data: {
      customerName: string
      customerPhone: string
      totalAmount: string
      dueDate: Date | null
      notes?: string
    }): Promise<ExtendedSale> {
      const amount = Number.parseFloat(data.totalAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid manual balance amount: must be a positive number")
      }

      const sale: ExtendedSale = {
        id: crypto.randomUUID(),
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        totalAmount: amount.toString(),
        amountPaid: "0",
        paymentStatus: "unpaid",
        dueDate: data.dueDate,
        isManualBalance: true,
        notes: data.notes || null,
        createdAt: new Date(),
      }
      await db.insert(sales).values(sale)

      // AUTO-SYNC TRIGGER
      this.detectChanges("sales")

      return sale
    }

    async updateSaleDueDate(saleId: string, data: { dueDate: Date | null; notes?: string }): Promise<ExtendedSale> {
      const updateData: any = {
        dueDate: data.dueDate,
      }
      if (data.notes !== undefined) {
        updateData.notes = data.notes
      }

      await db.update(sales).set(updateData).where(eq(sales.id, saleId))

      const [updatedSale] = await db.select().from(sales).where(eq(sales.id, saleId))

      // AUTO-SYNC TRIGGER
      this.detectChanges("sales")

      return {
        ...updatedSale,
        dueDate: updatedSale.dueDate,
        isManualBalance: updatedSale.isManualBalance,
        notes: updatedSale.notes,
      } as ExtendedSale
    }

    // Update paid amount directly (for bill editing)
    async updateSalePaidAmount(saleId: string, amountPaid: number, paymentStatus: string): Promise<ExtendedSale> {
      await db.update(sales).set({
        amountPaid: amountPaid.toString(),
        paymentStatus,
      }).where(eq(sales.id, saleId))

      const [updatedSale] = await db.select().from(sales).where(eq(sales.id, saleId))

      // AUTO-SYNC TRIGGER
      this.detectChanges("sales")
      this.detectChanges("payments")

      return {
        ...updatedSale,
        dueDate: updatedSale.dueDate,
        isManualBalance: updatedSale.isManualBalance,
        notes: updatedSale.notes,
      } as ExtendedSale
    }

    async addSaleItem(saleId: string, item: InsertSaleItem): Promise<SaleItem> {
      const saleItem: SaleItem = {
        id: crypto.randomUUID(),
        ...item,
        saleId,
        rate: typeof item.rate === "number" ? item.rate.toString() : item.rate,
        subtotal: typeof item.subtotal === "number" ? item.subtotal.toString() : item.subtotal,
        quantityReturned: 0, // Initialize quantityReturned
      }
      await db.insert(saleItems).values(saleItem)

      await db
        .update(colors)
        .set({
          stockQuantity: sql`${colors.stockQuantity} - ${item.quantity}`,
        })
        .where(eq(colors.id, item.colorId))

      const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId))
      const newTotal = allItems.reduce((sum, item) => sum + Number.parseFloat(item.subtotal), 0)

      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId))
      const amountPaid = Number.parseFloat(sale.amountPaid)

      let paymentStatus: string
      if (amountPaid >= newTotal) {
        paymentStatus = "paid"
      } else if (amountPaid > 0) {
        paymentStatus = "partial"
      } else {
        paymentStatus = "unpaid"
      }

      await db
        .update(sales)
        .set({
          totalAmount: newTotal.toString(),
          paymentStatus,
        })
        .where(eq(sales.id, saleId))

      // AUTO-SYNC TRIGGER
      this.detectChanges("sales")

      return saleItem
    }

    async updateSaleItem(id: string, data: { quantity: number; rate: number; subtotal: number }): Promise<SaleItem> {
      try {
        const [currentItem] = await db.select().from(saleItems).where(eq(saleItems.id, id))
        if (!currentItem) {
          throw new Error("Sale item not found")
        }

        const stockDifference = currentItem.quantity - data.quantity

        const [updatedItem] = await db
          .update(saleItems)
          .set({
            quantity: data.quantity,
            rate: data.rate.toString(),
            subtotal: data.subtotal.toString(),
          })
          .where(eq(saleItems.id, id))
          .returning()

        if (stockDifference !== 0) {
          await db
            .update(colors)
            .set({
              stockQuantity: sql`${colors.stockQuantity} + ${stockDifference}`,
            })
            .where(eq(colors.id, currentItem.colorId))
        }

        const saleId = currentItem.saleId
        const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId))
        const newTotal = allItems.reduce((sum, item) => sum + Number.parseFloat(item.subtotal), 0)

        const [sale] = await db.select().from(sales).where(eq(sales.id, saleId))
        const amountPaid = Number.parseFloat(sale.amountPaid)

        let paymentStatus: string
        if (amountPaid >= newTotal) {
          paymentStatus = "paid"
        } else if (amountPaid > 0) {
          paymentStatus = "partial"
        } else {
          paymentStatus = "unpaid"
        }

        await db
          .update(sales)
          .set({
            totalAmount: newTotal.toString(),
            paymentStatus,
          })
          .where(eq(sales.id, saleId))

        // AUTO-SYNC TRIGGER
        this.detectChanges("sales")

        return updatedItem
      } catch (error) {
        console.error("Error updating sale item:", error)
        throw new Error("Failed to update sale item")
      }
    }

    async deleteSaleItem(saleItemId: string): Promise<void> {
      const [item] = await db.select().from(saleItems).where(eq(saleItems.id, saleItemId))
      if (!item) {
        throw new Error("Sale item not found")
      }

      const saleId = item.saleId

      await db
        .update(colors)
        .set({
          stockQuantity: sql`${colors.stockQuantity} + ${item.quantity}`,
        })
        .where(eq(colors.id, item.colorId))

      await db.delete(saleItems).where(eq(saleItems.id, saleItemId))

      const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId))
      const newTotal = allItems.reduce((sum, item) => sum + Number.parseFloat(item.subtotal), 0)

      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId))
      const amountPaid = Number.parseFloat(sale.amountPaid)

      let paymentStatus: string
      if (newTotal === 0) {
        paymentStatus = "paid"
      } else if (amountPaid >= newTotal) {
        paymentStatus = "paid"
      } else if (amountPaid > 0) {
        paymentStatus = "partial"
      } else {
        paymentStatus = "unpaid"
      }

      await db
        .update(sales)
        .set({
          totalAmount: newTotal.toString(),
          paymentStatus,
        })
        .where(eq(sales.id, saleId))

      // AUTO-SYNC TRIGGER
      this.detectChanges("sales")
    }

    async deleteSale(saleId: string): Promise<void> {
      const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId))

      for (const item of items) {
        await db
          .update(colors)
          .set({
            stockQuantity: sql`${colors.stockQuantity} + ${item.quantity}`,
          })
          .where(eq(colors.id, item.colorId))
      }

      await db.delete(saleItems).where(eq(saleItems.saleId, saleId))
      await db.delete(paymentHistory).where(eq(paymentHistory.saleId, saleId))
      await db.delete(sales).where(eq(sales.id, saleId))

      // AUTO-SYNC TRIGGER
      this.detectChanges("sales")
      this.detectChanges("payments")
    }

    // Dashboard Stats - FIXED: Return ExtendedSale[]
    async getDashboardStats() {
      const now = new Date()
      // Use UTC for consistent date comparison
      const todayDateStr = now.toISOString().split('T')[0] // YYYY-MM-DD format
      const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      // Compare using SQLite date functions - createdAt stored as SECONDS (not milliseconds)
      const todaySalesData = await db
        .select({
          revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
          transactions: sql<number>`COUNT(*)`,
        })
        .from(sales)
        .where(sql`DATE(${sales.createdAt}, 'unixepoch') = ${todayDateStr}`)

      const monthlySalesData = await db
        .select({
          revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
          transactions: sql<number>`COUNT(*)`,
        })
        .from(sales)
        .where(sql`DATE(${sales.createdAt}, 'unixepoch') >= ${monthStartStr}`)

      const totalProducts = await db.select({ count: sql<number>`COUNT(*)` }).from(products)
      const totalVariants = await db.select({ count: sql<number>`COUNT(*)` }).from(variants)
      const totalColors = await db.select({ count: sql<number>`COUNT(*)` }).from(colors)
      const lowStockColors = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(colors)
        .where(sql`${colors.stockQuantity} < 10 AND ${colors.stockQuantity} > 0`)

      const totalStockValue = await db
        .select({
          value: sql<number>`COALESCE(SUM(${colors.stockQuantity} * CAST(${variants.rate} AS REAL)), 0)`,
        })
        .from(colors)
        .innerJoin(variants, eq(colors.variantId, variants.id))

      const unpaidData = await db
        .select({
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL) - CAST(${sales.amountPaid} AS REAL)), 0)`,
        })
        .from(sales)
        .where(sql`${sales.paymentStatus} != 'paid'`)

      const recentSalesData = await db.select().from(sales).orderBy(desc(sales.createdAt)).limit(10)

      const recentSales: ExtendedSale[] = recentSalesData.map((sale) => ({
        ...sale,
        dueDate: sale.dueDate,
        isManualBalance: sale.isManualBalance,
        notes: sale.notes,
      })) as ExtendedSale[]

      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

      const dailySales = await db
        .select({
          date: sql<string>`DATE(${sales.createdAt}, 'unixepoch')`,
          revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
        })
        .from(sales)
        .where(sql`DATE(${sales.createdAt}, 'unixepoch') >= ${thirtyDaysAgoStr}`)
        .groupBy(sql`DATE(${sales.createdAt}, 'unixepoch')`)
        .orderBy(sql`DATE(${sales.createdAt}, 'unixepoch')`)

      const topCustomersData = await db
        .select({
          customerName: sql<string>`${sales.customerName}`,
          customerPhone: sql<string>`${sales.customerPhone}`,
          totalPurchases: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
          transactionCount: sql<number>`COUNT(*)`,
        })
        .from(sales)
        .where(sql`${sales.customerPhone} IS NOT NULL AND ${sales.customerPhone} != ''`)
        .groupBy(sales.customerPhone, sales.customerName)
        .orderBy(sql`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0) DESC`)
        .limit(20)

      return {
        todaySales: {
          revenue: Number(todaySalesData[0]?.revenue || 0),
          transactions: Number(todaySalesData[0]?.transactions || 0),
        },
        monthlySales: {
          revenue: Number(monthlySalesData[0]?.revenue || 0),
          transactions: Number(monthlySalesData[0]?.transactions || 0),
        },
        inventory: {
          totalProducts: Number(totalProducts[0]?.count || 0),
          totalVariants: Number(totalVariants[0]?.count || 0),
          totalColors: Number(totalColors[0]?.count || 0),
          lowStock: Number(lowStockColors[0]?.count || 0),
          totalStockValue: Number(totalStockValue[0]?.value || 0),
        },
        unpaidBills: {
          count: Number(unpaidData[0]?.count || 0),
          totalAmount: Number(unpaidData[0]?.totalAmount || 0),
        },
        recentSales,
        monthlyChart: dailySales.map((day) => ({
          date: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          revenue: Number(day.revenue),
        })),
        topCustomers: topCustomersData.map((customer) => ({
          customerName: customer.customerName,
          customerPhone: customer.customerPhone,
          totalPurchases: Number(customer.totalPurchases || 0),
          transactionCount: Number(customer.transactionCount || 0),
        })),
      }
    }

    // RETURNS - UPDATED WITH AUTO-SYNC
    async getReturns(): Promise<ReturnWithItems[]> {
      try {
        const result = await db.query.returns.findMany({
          with: {
            sale: true,
            returnItems: {
              with: {
                color: {
                  with: {
                    variant: {
                      with: {
                        product: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: desc(returns.createdAt),
        })
        return result as ReturnWithItems[]
      } catch (error) {
        console.error("[Storage] Error fetching returns:", error)
        return []
      }
    }

    async getReturn(id: string): Promise<ReturnWithItems | undefined> {
      const result = await db.query.returns.findFirst({
        where: eq(returns.id, id),
        with: {
          sale: true,
          returnItems: {
            with: {
              color: {
                with: {
                  variant: {
                    with: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
      return result as ReturnWithItems | undefined
    }

    async createReturn(returnData: InsertReturn, items: InsertReturnItem[]): Promise<Return> {
      try {
        console.log("[Storage] Creating return with items:", { returnData, items })

        const returnRecord: Return = {
          id: crypto.randomUUID(),
          saleId: returnData.saleId || null,
          customerName: returnData.customerName,
          customerPhone: returnData.customerPhone,
          returnType: returnData.returnType || "item",
          totalRefund: String(returnData.totalRefund || "0"),
          reason: returnData.reason || null,
          status: returnData.status || "completed",
          createdAt: new Date(),
        }

        console.log("[Storage] Inserting return record:", returnRecord)
        await db.insert(returns).values(returnRecord)

        console.log("[Storage] Processing return items:", items.length)
        for (const item of items) {
          const returnItem: ReturnItem = {
            id: crypto.randomUUID(),
            returnId: returnRecord.id,
            colorId: item.colorId,
            saleItemId: item.saleItemId || null,
            quantity: item.quantity,
            rate: String(item.rate),
            subtotal: String(item.subtotal),
            stockRestored: item.stockRestored !== false,
          }

          console.log("[Storage] Inserting return item:", returnItem)
          await db.insert(returnItems).values(returnItem)

          if (item.saleItemId) {
            const [saleItem] = await db.select().from(saleItems).where(eq(saleItems.id, item.saleItemId))
            if (saleItem) {
              const newQuantityReturned = (saleItem.quantityReturned || 0) + item.quantity
              await db
                .update(saleItems)
                .set({ quantityReturned: newQuantityReturned })
                .where(eq(saleItems.id, item.saleItemId))
              console.log(`[Storage] Updated saleItem ${item.saleItemId} quantityReturned to ${newQuantityReturned}`)
            }
          }

          if (returnItem.stockRestored) {
            console.log(`[Storage] Restoring stock for color ${item.colorId}, quantity: ${item.quantity}`)
            const [color] = await db.select().from(colors).where(eq(colors.id, item.colorId))
            if (color) {
              const previousStock = color.stockQuantity
              const newStock = color.stockQuantity + item.quantity
              await db.update(colors).set({ stockQuantity: newStock }).where(eq(colors.id, item.colorId))
              console.log(`[Storage] Stock restored: ${color.colorName} - New stock: ${newStock}`)

              // Record in stock history as return
              const today = new Date()
              const stockInDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
              
              await db.insert(stockInHistory).values({
                id: crypto.randomUUID(),
                colorId: item.colorId,
                quantity: item.quantity,
                previousStock: previousStock,
                newStock: newStock,
                stockInDate: stockInDate,
                notes: returnData.reason || "Item returned",
                type: "return",
                saleId: returnData.saleId || null,
                customerName: returnData.customerName,
                customerPhone: returnData.customerPhone,
                createdAt: new Date(),
              })
              console.log(`[Storage] Stock history recorded for return: ${color.colorName}`)
            } else {
              console.warn(`[Storage] Color not found for stock restoration: ${item.colorId}`)
            }
          }
        }

        if (returnData.returnType === "full_bill" && returnData.saleId) {
          console.log(`[Storage] Updating sale ${returnData.saleId} to full return`)
          const [sale] = await db.select().from(sales).where(eq(sales.id, returnData.saleId))
          if (sale) {
            await db
              .update(sales)
              .set({
                paymentStatus: "full_return",
                amountPaid: "0",
              })
              .where(eq(sales.id, returnData.saleId))
          }
        }

        console.log("[Storage] Return created successfully:", returnRecord.id)

        // AUTO-SYNC TRIGGER
        this.detectChanges("returns")
        this.detectChanges("colors")
        this.detectChanges("sales")

        return returnRecord
      } catch (error) {
        console.error("[Storage] Error creating return:", error)
        throw new Error(`Failed to create return: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    async createQuickReturn(data: {
      customerName: string
      customerPhone: string
      colorId: string
      quantity: number
      rate: number
      reason?: string
      restoreStock?: boolean
    }): Promise<Return> {
      try {
        const { customerName, customerPhone, colorId, quantity, rate, reason, restoreStock = true } = data

        const [color] = await db.select().from(colors).where(eq(colors.id, colorId))
        if (!color) {
          throw new Error("Color not found")
        }

        const subtotal = quantity * rate
        const returnRecord: Return = {
          id: crypto.randomUUID(),
          saleId: null,
          customerName,
          customerPhone,
          returnType: "item",
          totalRefund: String(subtotal),
          reason: reason || "Quick return",
          status: "completed",
          createdAt: new Date(),
        }

        await db.insert(returns).values(returnRecord)

        const returnItem: ReturnItem = {
          id: crypto.randomUUID(),
          returnId: returnRecord.id,
          colorId,
          saleItemId: null,
          quantity,
          rate: String(rate),
          subtotal: String(subtotal),
          stockRestored: restoreStock,
        }

        await db.insert(returnItems).values(returnItem)

        if (restoreStock) {
          const previousStock = color.stockQuantity
          const newStock = color.stockQuantity + quantity
          await db.update(colors).set({ stockQuantity: newStock }).where(eq(colors.id, colorId))
          console.log(`[Storage] Quick return stock restored: ${color.colorName} - New stock: ${newStock}`)

          // Record in stock history as return
          const today = new Date()
          const stockInDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
          
          await db.insert(stockInHistory).values({
            id: crypto.randomUUID(),
            colorId: colorId,
            quantity: quantity,
            previousStock: previousStock,
            newStock: newStock,
            stockInDate: stockInDate,
            notes: reason || "Quick return",
            type: "return",
            saleId: null,
            customerName: customerName,
            customerPhone: customerPhone,
            createdAt: new Date(),
          })
          console.log(`[Storage] Stock history recorded for quick return: ${color.colorName}`)
        }

        // AUTO-SYNC TRIGGER
        this.detectChanges("returns")
        this.detectChanges("colors")

        return returnRecord
      } catch (error) {
        console.error("[Storage] Error in quick return:", error)
        throw error
      }
    }

    async getReturnsByCustomerPhone(customerPhone: string): Promise<ReturnWithItems[]> {
      try {
        const result = await db.query.returns.findMany({
          where: eq(returns.customerPhone, customerPhone),
          with: {
            sale: true,
            returnItems: {
              with: {
                color: {
                  with: {
                    variant: {
                      with: {
                        product: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: desc(returns.createdAt),
        })
        return (result || []) as ReturnWithItems[]
      } catch (error) {
        console.error("[Storage] Error in getReturnsByCustomerPhone:", error)
        return [] // Return empty array instead of throwing
      }
    }

    async getReturnItems(): Promise<ReturnItem[]> {
      return await db.select().from(returnItems)
    }

    // FIXED: Missing getSaleItems implementation
    async getSaleItems(): Promise<SaleItem[]> {
      try {
        const result = await db.select().from(saleItems)
        return result
      } catch (error) {
        console.error("[Storage] Error fetching sale items:", error)
        return []
      }
    }

    // NEW: Customer Purchase History Tracking
    async getCustomerPurchaseHistory(customerPhone: string): Promise<CustomerPurchaseHistory> {
      try {
        console.log(`[Storage] Getting purchase history for customer: ${customerPhone}`)

        if (!customerPhone || customerPhone.trim() === "") {
          throw new Error("Customer phone is required")
        }

        let sales: SaleWithItems[] = []
        try {
          sales = await this.getSalesByCustomerPhoneWithItems(customerPhone)
        } catch (salesError) {
          console.error("[Storage] Error fetching sales:", salesError)
          sales = []
        }
        console.log(`[Storage] Retrieved ${sales.length} sales for customer`)

        let returns: ReturnWithItems[] = []
        try {
          returns = await this.getReturnsByCustomerPhone(customerPhone)
        } catch (returnsError) {
          console.error("[Storage] Error fetching returns:", returnsError)
          returns = []
        }
        console.log(`[Storage] Retrieved ${returns.length} returns for customer`)

        // Create a map to track returned quantities per sale item
        const returnedQuantities = new Map<string, number>()

        // Process returns to calculate returned quantities
        if (returns && Array.isArray(returns)) {
          returns.forEach((returnRecord) => {
            if (returnRecord && returnRecord.returnItems && Array.isArray(returnRecord.returnItems)) {
              returnRecord.returnItems.forEach((returnItem) => {
                if (returnItem && returnItem.saleItemId) {
                  const key = returnItem.saleItemId
                  const currentQty = returnedQuantities.get(key) || 0
                  returnedQuantities.set(key, currentQty + (returnItem.quantity || 0))
                }
              })
            }
          })
        }

        // Create adjusted sales data
        const adjustedSales: SaleWithItems[] = (sales || [])
          .map((sale) => {
            if (!sale) return null

            const isManualBalance = sale.isManualBalance

            if (isManualBalance) {
              return sale
            }

            if (!sale.saleItems || !Array.isArray(sale.saleItems)) {
              return { ...sale, saleItems: [] }
            }

            const adjustedSaleItems = sale.saleItems
              .filter((item) => item != null)
              .map((item) => {
                const returnedQty = returnedQuantities.get(item.id) || 0
                const availableQty = Math.max(0, (item.quantity || 0) - returnedQty)
                const rate = item.rate ? String(item.rate) : "0"

                return {
                  ...item,
                  quantity: availableQty,
                  subtotal: (availableQty * Number.parseFloat(rate)).toString(),
                }
              })
              .filter((item) => item.quantity > 0)

            // Recalculate sale total
            const totalAmount = adjustedSaleItems.reduce((sum, item) => {
              const subtotal = item.subtotal ? String(item.subtotal) : "0"
              return sum + Number.parseFloat(subtotal)
            }, 0)

            return {
              ...sale,
              saleItems: adjustedSaleItems,
              totalAmount: totalAmount.toString(),
            }
          })
          .filter(
            (sale): sale is SaleWithItems =>
              sale !== null && (sale.saleItems.length > 0 || sale.isManualBalance === true),
          )

        // Create flat list of available items for easy access
        const availableItems = (sales || []).flatMap((sale) => {
          if (!sale || !sale.saleItems || !Array.isArray(sale.saleItems)) return []

          return sale.saleItems
            .filter((item) => item != null)
            .map((item) => {
              const returnedQty = returnedQuantities.get(item.id) || 0
              const availableQty = Math.max(0, (item.quantity || 0) - returnedQty)
              const rate = item.rate ? String(item.rate) : "0"

              return {
                saleId: sale.id,
                saleItemId: item.id,
                colorId: item.colorId,
                color: item.color,
                originalQuantity: item.quantity || 0,
                availableQuantity: availableQty,
                rate: Number.parseFloat(rate),
                subtotal: availableQty * Number.parseFloat(rate),
                saleDate: sale.createdAt,
              }
            })
            .filter((item) => item.availableQuantity > 0)
        })

        console.log(
          `[Storage] Purchase history calculated: ${sales.length} original sales, ${adjustedSales.length} adjusted sales, ${availableItems.length} available items`,
        )

        return {
          originalSales: sales || [],
          adjustedSales: adjustedSales || [],
          availableItems: availableItems || [],
        }
      } catch (error) {
        console.error("[Storage] Error getting customer purchase history:", error)
        return {
          originalSales: [],
          adjustedSales: [],
          availableItems: [],
        }
      }
    }

    // ============ NEW: STOCK OUT HISTORY TRACKING ============
    async recordStockOut(data: {
      colorId: string
      quantity: number
      movementType: "sale" | "return" | "adjustment" | "damage"
      referenceId?: string
      referenceType?: string
      reason?: string
      notes?: string
      stockOutDate?: string
    }): Promise<void> {
      try {
        const [color] = await db.select().from(colors).where(eq(colors.id, data.colorId))
        if (!color) throw new Error("Color not found")

        const previousStock = color.stockQuantity
        const newStock = Math.max(0, previousStock - data.quantity) // Prevent negative stock

        const actualStockOutDate =
          data.stockOutDate && this.isValidDDMMYYYY(data.stockOutDate)
            ? data.stockOutDate
            : this.formatDateToDDMMYYYY(new Date())

        const stockOutRecord = {
          id: crypto.randomUUID(),
          colorId: data.colorId,
          quantity: data.quantity,
          previousStock,
          newStock,
          movementType: data.movementType,
          referenceId: data.referenceId || null,
          referenceType: data.referenceType || null,
          reason: data.reason || null,
          stockOutDate: actualStockOutDate,
          notes: data.notes || null,
          createdAt: new Date(),
        }

        // Update color stock
        await db.update(colors).set({ stockQuantity: newStock }).where(eq(colors.id, data.colorId))

        // Record in stock_out_history (raw SQL since table may not be in Drizzle schema)
        const { sqliteDb } = await import("./db")
        if (sqliteDb) {
          sqliteDb
            .prepare(`
            INSERT INTO stock_out_history (id, color_id, quantity, previous_stock, new_stock, movement_type, reference_id, reference_type, reason, stock_out_date, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .run(
              stockOutRecord.id,
              data.colorId,
              data.quantity,
              previousStock,
              newStock,
              data.movementType,
              data.referenceId || null,
              data.referenceType || null,
              data.reason || null,
              actualStockOutDate,
              data.notes || null,
              new Date().getTime(),
            )
        }

        console.log(`[Storage] Stock out recorded: ${data.colorId}, Type: ${data.movementType}, Qty: ${data.quantity}`)

        // Update stock movement summary
        await this.updateStockMovementSummary(data.colorId, actualStockOutDate)

        // AUTO-SYNC TRIGGER
        this.detectChanges("colors")
      } catch (error) {
        console.error("[Storage] Error recording stock out:", error)
        throw error
      }
    }

    async getStockOutHistory(filters?: {
      colorId?: string
      startDate?: string
      endDate?: string
      movementType?: string
    }): Promise<any[]> {
      try {
        const { sqliteDb } = await import("./db")
        if (!sqliteDb) return []

        let query = "SELECT * FROM stock_out_history WHERE 1=1"
        const params: any[] = []

        if (filters?.colorId) {
          query += " AND color_id = ?"
          params.push(filters.colorId)
        }

        if (filters?.movementType) {
          query += " AND movement_type = ?"
          params.push(filters.movementType)
        }

        if (filters?.startDate) {
          query += " AND stock_out_date >= ?"
          params.push(filters.startDate)
        }

        if (filters?.endDate) {
          query += " AND stock_out_date <= ?"
          params.push(filters.endDate)
        }

        query += " ORDER BY created_at DESC"

        return sqliteDb.prepare(query).all(...params) as any[]
      } catch (error) {
        console.error("[Storage] Error fetching stock out history:", error)
        return []
      }
    }

    // ============ NEW: CUSTOMER ACCOUNTS MANAGEMENT ============
    async createOrUpdateCustomerAccount(data: {
      customerPhone: string
      customerName: string
      totalPurchased?: string
      totalPaid?: string
      currentBalance?: string
      notes?: string
    }): Promise<void> {
      try {
        const { sqliteDb } = await import("./db")
        if (!sqliteDb) return

        const existingCustomer = sqliteDb
          .prepare("SELECT id FROM customer_accounts WHERE customer_phone = ?")
          .get(data.customerPhone)

        const timestamp = new Date().getTime()

        if (existingCustomer) {
          const updates: string[] = ["updated_at = ?"]
          const values: any[] = [timestamp]

          if (data.customerName) {
            updates.push("customer_name = ?")
            values.push(data.customerName)
          }
          if (data.totalPurchased !== undefined) {
            updates.push("total_purchased = ?")
            values.push(data.totalPurchased)
          }
          if (data.totalPaid !== undefined) {
            updates.push("total_paid = ?")
            values.push(data.totalPaid)
          }
          if (data.currentBalance !== undefined) {
            updates.push("current_balance = ?")
            values.push(data.currentBalance)
          }
          if (data.notes) {
            updates.push("notes = ?")
            values.push(data.notes)
          }

          values.push(data.customerPhone)

          sqliteDb.prepare(`UPDATE customer_accounts SET ${updates.join(", ")} WHERE customer_phone = ?`).run(...values)
        } else {
          sqliteDb
            .prepare(`
            INSERT INTO customer_accounts (id, customer_phone, customer_name, total_purchased, total_paid, current_balance, last_transaction_date, account_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .run(
              crypto.randomUUID(),
              data.customerPhone,
              data.customerName || "Unknown",
              data.totalPurchased || "0",
              data.totalPaid || "0",
              data.currentBalance || "0",
              timestamp,
              "active",
              timestamp,
              timestamp,
            )
        }

        console.log(`[Storage] Customer account updated: ${data.customerPhone}`)
      } catch (error) {
        console.error("[Storage] Error managing customer account:", error)
        throw error
      }
    }

    async getCustomerAccount(customerPhone: string): Promise<any | null> {
      try {
        const { sqliteDb } = await import("./db")
        if (!sqliteDb) return null

        return sqliteDb.prepare("SELECT * FROM customer_accounts WHERE customer_phone = ?").get(customerPhone)
      } catch (error) {
        console.error("[Storage] Error fetching customer account:", error)
        return null
      }
    }

    async updateCustomerBalance(customerPhone: string, newBalance: string): Promise<void> {
      try {
        await this.createOrUpdateCustomerAccount({
          customerPhone,
          customerName: "", // Keep existing
          currentBalance: newBalance,
        })
      } catch (error) {
        console.error("[Storage] Error updating customer balance:", error)
        throw error
      }
    }

    async getConsolidatedCustomerAccount(customerPhone: string): Promise<{
      customerPhone: string
      customerName: string
      totalBills: number
      totalAmount: number
      totalPaid: number
      currentOutstanding: number
      oldestBillDate: Date
      newestBillDate: Date
      billCount: number
      paymentCount: number
      lastPaymentDate: Date | null
      averageDaysToPayment: number
      paymentStatus: "paid" | "partial" | "unpaid"
    } | null> {
      try {
        const customerSales = await this.getSalesByCustomerPhone(customerPhone)

        if (customerSales.length === 0) {
          return null
        }

        let totalAmount = 0
        let totalPaid = 0
        let paymentCount = 0
        let lastPaymentDate: Date | null = null
        const billDates: Date[] = []

        customerSales.forEach((sale) => {
          totalAmount += Number.parseFloat(sale.totalAmount || "0")
          totalPaid += Number.parseFloat(sale.amountPaid || "0")
          const createdAt = sale.createdAt instanceof Date ? sale.createdAt : new Date(sale.createdAt)
          billDates.push(createdAt)
        })

        // Get payment history for additional metrics
        const paymentRecords = await this.getPaymentHistoryByCustomer(customerPhone)
        paymentCount = paymentRecords.length

        if (paymentRecords.length > 0) {
          // Find the latest payment date
          const latestPayment = paymentRecords.reduce((latest, current) => {
            const latestDate = latest.createdAt instanceof Date ? latest.createdAt : new Date(latest.createdAt)
            const currentDate = current.createdAt instanceof Date ? current.createdAt : new Date(current.createdAt)
            return currentDate > latestDate ? current : latest
          }, paymentRecords[0])
          lastPaymentDate =
            latestPayment.createdAt instanceof Date ? latestPayment.createdAt : new Date(latestPayment.createdAt)
        }

        // Calculate average days to payment
        let averageDaysToPayment = 0
        if (paymentRecords.length > 0 && customerSales.length > 0 && billDates.length > 0) {
          const billTimestamps = billDates.map((d) => d.getTime())
          const oldestBill = new Date(Math.min(...billTimestamps))
          const newestPayment = lastPaymentDate as Date // We know lastPaymentDate is not null here

          // Ensure calculation is not negative if payments occurred before oldest bill (unlikely but safe)
          const timeDiff = newestPayment.getTime() - oldestBill.getTime()
          if (timeDiff >= 0) {
            averageDaysToPayment = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
          }
        }

        const currentOutstanding = totalAmount - totalPaid
        const paymentStatus: "paid" | "partial" | "unpaid" =
          currentOutstanding <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid"

        const billTimestamps = billDates.map((d) => d.getTime())

        return {
          customerPhone,
          customerName: customerSales[0].customerName,
          totalBills: customerSales.length,
          totalAmount,
          totalPaid,
          currentOutstanding,
          oldestBillDate: new Date(Math.min(...billTimestamps)),
          newestBillDate: new Date(Math.max(...billTimestamps)),
          billCount: customerSales.length,
          paymentCount,
          lastPaymentDate,
          averageDaysToPayment,
          paymentStatus,
        }
      } catch (error) {
        console.error("[Storage] Error getting consolidated account:", error)
        throw error
      }
    }

    async syncCustomerAccount(customerPhone: string): Promise<void> {
      try {
        const consolidatedData = await this.getConsolidatedCustomerAccount(customerPhone)
        if (!consolidatedData) {
          console.log(`[Storage] No sales found for customer ${customerPhone}, skipping sync`)
          return
        }

        const existingAccount = await db
          .select()
          .from(customerAccounts)
          .where(eq(customerAccounts.customerPhone, customerPhone))

        if (existingAccount.length > 0) {
          await db
            .update(customerAccounts)
            .set({
              customerName: consolidatedData.customerName,
              totalPurchased: consolidatedData.totalAmount.toString(),
              totalPaid: consolidatedData.totalPaid.toString(),
              currentBalance: consolidatedData.currentOutstanding.toString(),
              lastTransactionDate: Date.now(),
              accountStatus: consolidatedData.paymentStatus === "paid" ? "active" : "active",
              updatedAt: new Date(),
            })
            .where(eq(customerAccounts.customerPhone, customerPhone))
        } else {
          await db.insert(customerAccounts).values({
            id: crypto.randomUUID(),
            customerPhone,
            customerName: consolidatedData.customerName,
            totalPurchased: consolidatedData.totalAmount.toString(),
            totalPaid: consolidatedData.totalPaid.toString(),
            currentBalance: consolidatedData.currentOutstanding.toString(),
            lastTransactionDate: Date.now(),
            accountStatus: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        this.detectChanges("customer_accounts")
      } catch (error) {
        console.error("[Storage] Error syncing customer account:", error)
        throw error
      }
    }

    // NEW: STOCK MOVEMENT SUMMARY
    async updateStockMovementSummary(colorId: string, dateStr: string): Promise<void> {
      try {
        const { sqliteDb } = await import("./db")
        if (!sqliteDb) return

        const [inHistory] = await db
          .select({
            totalIn: sql<number>`COALESCE(SUM(${stockInHistory.quantity}), 0)`,
          })
          .from(stockInHistory)
          .where(and(eq(stockInHistory.colorId, colorId), eq(stockInHistory.stockInDate, dateStr)))

        // Get stock out total (from raw table since it might not be in Drizzle schema)
        const outHistory = sqliteDb
          .prepare(
            "SELECT COALESCE(SUM(quantity), 0) as totalOut FROM stock_out_history WHERE color_id = ? AND stock_out_date = ?",
          )
          .get(colorId, dateStr) as { totalOut: number }

        const [color] = await db.select().from(colors).where(eq(colors.id, colorId))
        if (!color) return

        // Get opening stock (previous day's closing stock)
        const prevDateObj = new Date(dateStr.split("-").reverse().join("-"))
        prevDateObj.setDate(prevDateObj.getDate() - 1)
        const prevDateStr = this.formatDateToDDMMYYYY(prevDateObj)

        const prevSummary = sqliteDb
          .prepare("SELECT closing_stock FROM stock_movement_summary WHERE color_id = ? AND date_summary = ?")
          .get(colorId, prevDateStr) as { closing_stock: number } | undefined

        const openingStock = prevSummary?.closing_stock || color.stockQuantity
        const closingStock = openingStock + (inHistory?.totalIn || 0) - (outHistory?.totalOut || 0)

        const existingSummary = sqliteDb
          .prepare("SELECT id FROM stock_movement_summary WHERE color_id = ? AND date_summary = ?")
          .get(colorId, dateStr)

        if (existingSummary) {
          sqliteDb
            .prepare(`
            UPDATE stock_movement_summary 
            SET opening_stock = ?, total_inward = ?, total_outward = ?, closing_stock = ?, last_updated = ?
            WHERE color_id = ? AND date_summary = ?
          `)
            .run(
              openingStock,
              inHistory?.totalIn || 0,
              outHistory?.totalOut || 0,
              closingStock,
              new Date().getTime(),
              colorId,
              dateStr,
            )
        } else {
          sqliteDb
            .prepare(`
            INSERT INTO stock_movement_summary (id, color_id, date_summary, opening_stock, total_inward, total_outward, closing_stock, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .run(
              crypto.randomUUID(),
              colorId,
              dateStr,
              openingStock,
              inHistory?.totalIn || 0,
              outHistory?.totalOut || 0,
              closingStock,
              new Date().getTime(),
            )
        }

        console.log(`[Storage] Stock movement summary updated: ${colorId} on ${dateStr}`)
      } catch (error) {
        console.error("[Storage] Error updating stock movement summary:", error)
        // Don't throw - this is non-critical
      }
    }

    async getStockMovementSummary(colorId: string, dateStr?: string): Promise<any[]> {
      try {
        const { sqliteDb } = await import("./db")
        if (!sqliteDb) return []

        if (dateStr) {
          return sqliteDb
            .prepare(
              "SELECT * FROM stock_movement_summary WHERE color_id = ? AND date_summary = ? ORDER BY date_summary DESC",
            )
            .all(colorId, dateStr) as any[]
        } else {
          return sqliteDb
            .prepare("SELECT * FROM stock_movement_summary WHERE color_id = ? ORDER BY date_summary DESC LIMIT 30")
            .all(colorId) as any[]
        }
      } catch (error) {
        console.error("[Storage] Error fetching stock movement summary:", error)
        return []
      }
    }

    // ============ NEW: SYNC STOCK AND BALANCE ============
    async syncStockAndBalance(): Promise<{ stockUpdated: number; balancesUpdated: number }> {
      try {
        let stockUpdated = 0
        let balancesUpdated = 0

        // Step 1: Sync all sales to customer accounts
        const allSales = await this.getSalesWithItems()

        for (const sale of allSales) {
          const totalAmount = Number(sale.totalAmount)
          const amountPaid = Number(sale.amountPaid)
          const currentBalance = Math.max(0, totalAmount - amountPaid)

          await this.createOrUpdateCustomerAccount({
            customerPhone: sale.customerPhone,
            customerName: sale.customerName,
            totalPurchased: String(totalAmount),
            totalPaid: String(amountPaid),
            currentBalance: String(currentBalance),
          })

          balancesUpdated++
        }

        // Step 2: Verify stock quantities match color table
        const { sqliteDb } = await import("./db")
        if (sqliteDb) {
          const allColors = await this.getColors()

          for (const color of allColors) {
            // Recalculate stock from history
            const inTotal = sqliteDb
              .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM stock_in_history WHERE color_id = ?")
              .get(color.id) as { total: number }

            const outTotal = sqliteDb
              .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM stock_out_history WHERE color_id = ?")
              .get(color.id) as { total: number }

            const calculatedStock = (inTotal?.total || 0) - (outTotal?.total || 0)

            if (calculatedStock !== color.stockQuantity) {
              console.log(
                `[Storage] Stock mismatch for ${color.colorName}: Stored=${color.stockQuantity}, Calculated=${calculatedStock}`,
              )

              // Update to calculated value
              await db.update(colors).set({ stockQuantity: calculatedStock }).where(eq(colors.id, color.id))

              stockUpdated++
            }
          }
        }

        console.log(`[Storage] Sync completed: ${stockUpdated} stocks updated, ${balancesUpdated} balances synced`)
        return { stockUpdated, balancesUpdated }
      } catch (error) {
        console.error("[Storage] Error syncing stock and balance:", error)
        throw error
      }
    }

    // Cloud Sync Upserts - FIXED: ExtendedSale support
    async upsertProduct(data: Product): Promise<void> {
      const existing = await db.select().from(products).where(eq(products.id, data.id))
      if (existing.length > 0) {
        await db
          .update(products)
          .set({
            company: data.company,
            productName: data.productName,
          })
          .where(eq(products.id, data.id))
      } else {
        await db.insert(products).values(data)
      }
    }

    async upsertVariant(data: Variant): Promise<void> {
      const existing = await db.select().from(variants).where(eq(variants.id, data.id))
      if (existing.length > 0) {
        await db
          .update(variants)
          .set({
            productId: data.productId,
            packingSize: data.packingSize,
            rate: data.rate,
          })
          .where(eq(variants.id, data.id))
      } else {
        await db.insert(variants).values(data)
      }
    }

    async upsertColor(data: Color): Promise<void> {
      const existing = await db.select().from(colors).where(eq(colors.id, data.id))
      if (existing.length > 0) {
        await db
          .update(colors)
          .set({
            variantId: data.variantId,
            colorName: data.colorName,
            colorCode: data.colorCode,
            stockQuantity: data.stockQuantity,
            rateOverride: data.rateOverride,
          })
          .where(eq(colors.id, data.id))
      } else {
        await db.insert(colors).values(data)
      }
    }

    async upsertSale(data: ExtendedSale): Promise<void> {
      const existing = await db.select().from(sales).where(eq(sales.id, data.id))
      if (existing.length > 0) {
        await db
          .update(sales)
          .set({
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            totalAmount: data.totalAmount,
            amountPaid: data.amountPaid,
            paymentStatus: data.paymentStatus,
            dueDate: data.dueDate,
            isManualBalance: data.isManualBalance,
            notes: data.notes,
          })
          .where(eq(sales.id, data.id))
      } else {
        await db.insert(sales).values(data)
      }
    }

    async upsertSaleItem(data: SaleItem): Promise<void> {
      const existing = await db.select().from(saleItems).where(eq(saleItems.id, data.id))
      if (existing.length > 0) {
        await db
          .update(saleItems)
          .set({
            saleId: data.saleId,
            colorId: data.colorId,
            quantity: data.quantity,
            rate: data.rate,
            subtotal: data.subtotal,
            quantityReturned: data.quantityReturned, // Keep quantityReturned during upsert
          })
          .where(eq(saleItems.id, data.id))
      } else {
        await db.insert(saleItems).values(data)
      }
    }

    async upsertStockInHistory(data: StockInHistory): Promise<void> {
      const existing = await db.select().from(stockInHistory).where(eq(stockInHistory.id, data.id))
      if (existing.length > 0) {
        await db
          .update(stockInHistory)
          .set({
            colorId: data.colorId,
            quantity: data.quantity,
            previousStock: data.previousStock,
            newStock: data.newStock,
            stockInDate: data.stockInDate,
            notes: data.notes,
          })
          .where(eq(stockInHistory.id, data.id))
      } else {
        await db.insert(stockInHistory).values(data)
      }
    }

    async upsertPaymentHistory(data: PaymentHistory): Promise<void> {
      const existing = await db.select().from(paymentHistory).where(eq(paymentHistory.id, data.id))
      if (existing.length > 0) {
        await db
          .update(paymentHistory)
          .set({
            saleId: data.saleId,
            customerPhone: data.customerPhone,
            amount: data.amount,
            previousBalance: data.previousBalance,
            newBalance: data.newBalance,
            paymentMethod: data.paymentMethod,
            notes: data.notes,
          })
          .where(eq(paymentHistory.id, data.id))
      } else {
        await db.insert(paymentHistory).values(data)
      }
    }

    async upsertReturn(data: Return): Promise<void> {
      const existing = await db.select().from(returns).where(eq(returns.id, data.id))
      if (existing.length > 0) {
        await db
          .update(returns)
          .set({
            saleId: data.saleId,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            returnType: data.returnType,
            totalRefund: data.totalRefund,
            reason: data.reason,
            status: data.status,
          })
          .where(eq(returns.id, data.id))
      } else {
        await db.insert(returns).values(data)
      }
    }

    async upsertReturnItem(data: ReturnItem): Promise<void> {
      const existing = await db.select().from(returnItems).where(eq(returnItems.id, data.id))
      if (existing.length > 0) {
        await db
          .update(returnItems)
          .set({
            returnId: data.returnId,
            colorId: data.colorId,
            saleItemId: data.saleItemId,
            quantity: data.quantity,
            rate: data.rate,
            subtotal: data.subtotal,
            stockRestored: data.stockRestored,
          })
          .where(eq(returnItems.id, data.id))
      } else {
        await db.insert(returnItems).values(data)
      }
    }

    // ================== SOFTWARE LICENSE MANAGEMENT ==================

    async getSoftwareLicenses(): Promise<SoftwareLicense[]> {
      return await db.select().from(softwareLicenses).orderBy(desc(softwareLicenses.createdAt))
    }

    async getSoftwareLicense(deviceId: string): Promise<SoftwareLicense | undefined> {
      const result = await db.select().from(softwareLicenses).where(eq(softwareLicenses.deviceId, deviceId))
      return result[0]
    }

    async createOrUpdateSoftwareLicense(data: InsertSoftwareLicense): Promise<SoftwareLicense> {
      const existing = await this.getSoftwareLicense(data.deviceId)
      
      if (existing) {
        const [updated] = await db
          .update(softwareLicenses)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(softwareLicenses.deviceId, data.deviceId))
          .returning()
        return updated
      } else {
        const [created] = await db.insert(softwareLicenses).values(data).returning()
        return created
      }
    }

    async updateSoftwareLicense(deviceId: string, data: UpdateSoftwareLicense): Promise<SoftwareLicense | null> {
      const existing = await this.getSoftwareLicense(deviceId)
      if (!existing) return null

      const [updated] = await db
        .update(softwareLicenses)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(softwareLicenses.deviceId, deviceId))
        .returning()
      return updated
    }

    async blockSoftwareLicense(deviceId: string, reason: string, blockedBy?: string): Promise<SoftwareLicense | null> {
      const existing = await this.getSoftwareLicense(deviceId)
      if (!existing) return null

      const previousStatus = existing.status

      const [updated] = await db
        .update(softwareLicenses)
        .set({
          status: "blocked",
          blockedReason: reason,
          blockedAt: new Date(),
          blockedBy: blockedBy || "admin",
          updatedAt: new Date(),
        })
        .where(eq(softwareLicenses.deviceId, deviceId))
        .returning()

      await this.recordLicenseAudit({
        deviceId,
        action: "block",
        reason,
        performedBy: blockedBy || "admin",
        previousStatus,
        newStatus: "blocked",
      })

      return updated
    }

    async unblockSoftwareLicense(deviceId: string): Promise<SoftwareLicense | null> {
      const existing = await this.getSoftwareLicense(deviceId)
      if (!existing) return null

      const previousStatus = existing.status

      const [updated] = await db
        .update(softwareLicenses)
        .set({
          status: "active",
          blockedReason: null,
          blockedAt: null,
          blockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(softwareLicenses.deviceId, deviceId))
        .returning()

      await this.recordLicenseAudit({
        deviceId,
        action: "unblock",
        reason: "Unblocked by admin",
        performedBy: "admin",
        previousStatus,
        newStatus: "active",
      })

      return updated
    }

    async recordLicenseAudit(data: InsertLicenseAuditLog): Promise<LicenseAuditLog> {
      const [created] = await db.insert(licenseAuditLog).values(data).returning()
      return created
    }

    async getLicenseAuditLog(deviceId?: string): Promise<LicenseAuditLog[]> {
      if (deviceId) {
        return await db
          .select()
          .from(licenseAuditLog)
          .where(eq(licenseAuditLog.deviceId, deviceId))
          .orderBy(desc(licenseAuditLog.createdAt))
      }
      return await db.select().from(licenseAuditLog).orderBy(desc(licenseAuditLog.createdAt))
    }

    async setAutoBlockDate(deviceId: string, autoBlockDate: string | null): Promise<SoftwareLicense | null> {
      const existing = await this.getSoftwareLicense(deviceId)
      if (!existing) return null

      const [updated] = await db
        .update(softwareLicenses)
        .set({
          autoBlockDate: autoBlockDate,
          updatedAt: new Date(),
        })
        .where(eq(softwareLicenses.deviceId, deviceId))
        .returning()

      await this.recordLicenseAudit({
        deviceId,
        action: autoBlockDate ? "set_auto_block" : "clear_auto_block",
        reason: autoBlockDate ? `Auto-block date set to ${autoBlockDate}` : "Auto-block date cleared",
        performedBy: "admin",
        previousStatus: existing.status,
        newStatus: existing.status,
      })

      return updated
    }

    async checkAndApplyAutoBlocks(): Promise<{ blocked: string[] }> {
      const today = new Date().toISOString().split('T')[0]
      const licenses = await this.getSoftwareLicenses()
      const blocked: string[] = []

      for (const license of licenses) {
        if (
          license.status === "active" && 
          license.autoBlockDate && 
          license.autoBlockDate <= today
        ) {
          await this.blockSoftwareLicense(
            license.deviceId, 
            `Auto-blocked: License expired on ${license.autoBlockDate}`,
            "auto_system"
          )
          blocked.push(license.deviceId)
        }
      }

      return { blocked }
    }
}

export const storage = new DatabaseStorage()