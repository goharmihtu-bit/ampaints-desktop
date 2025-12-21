import crypto from "crypto"
import fs from "fs"
import path from "path"

// Tables in dependency order (parent tables first for correct import order)
const IMPORT_TABLES = [
  "products",      // No dependencies
  "variants",      // Depends on products
  "colors",        // Depends on variants
  "sales",         // No dependencies
  "sale_items",    // Depends on sales and colors
  "stock_in_history", // Depends on colors
  "payment_history",  // Depends on sales
  "returns",       // Depends on sales (optional)
  "return_items",  // Depends on returns and colors
  "customer_accounts", // No dependencies
  "settings",      // No dependencies
]

// Batch size for processing large datasets
const BATCH_SIZE = 100

// Import result interface
export interface ImportResult {
  ok: boolean
  dryRun: boolean
  strategy: string
  summary: Record<string, { remoteRows: number; inserted: number; updated: number; skipped: number; errors?: number; errorDetails?: string[] }>
  totalRows: number
  totalImported: number
  totalSkipped: number
  totalErrors: number
  importChecksum: string
  backupPath?: string
  duration: number
  timestamp: string
}

function pgBigIntFromHash(s: string) {
  const h = crypto.createHash("sha256").update(s).digest()
  const hex = h.slice(0, 8).toString("hex")
  return BigInt(`0x${hex}`) & BigInt("0x7fffffffffffffff")
}

// Generate checksum for data integrity verification
function generateChecksum(data: any[]): string {
  if (data.length === 0) return "empty"
  const dataString = JSON.stringify(data.map(row => {
    const sortedRow: Record<string, any> = {}
    Object.keys(row).sort().forEach(key => {
      sortedRow[key] = row[key]
    })
    return sortedRow
  }))
  return crypto.createHash("sha256").update(dataString).digest("hex").substring(0, 16)
}

// Create automatic backup before import
async function createBackup(): Promise<string | null> {
  try {
    const { getDatabasePath } = await import("./db")
    const dbPath = getDatabasePath()
    
    if (!fs.existsSync(dbPath)) {
      console.log("[CloudSyncImport] No existing database to backup")
      return null
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").substring(0, 19)
    const backupDir = path.dirname(dbPath)
    const backupName = `backup-before-import-${timestamp}.db`
    const backupPath = path.join(backupDir, backupName)
    
    fs.copyFileSync(dbPath, backupPath)
    console.log(`[CloudSyncImport] Backup created: ${backupPath}`)
    
    return backupPath
  } catch (error) {
    console.error("[CloudSyncImport] Backup creation failed:", error)
    return null
  }
}

// Convert PostgreSQL value to SQLite compatible format
function convertValueToSQLite(value: any, columnName: string): any {
  if (value === null || value === undefined) return null
  
  // Handle timestamp columns (convert to epoch milliseconds for SQLite)
  if (columnName.endsWith("_at") || columnName.endsWith("_date")) {
    if (value instanceof Date) {
      return value.getTime()
    }
    if (typeof value === "string") {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return date.getTime()
      }
    }
    return value
  }
  
  // Handle boolean columns (convert to 0/1 for SQLite)
  if (columnName.startsWith("is_") || columnName.startsWith("stock_restored") || columnName.startsWith("perm_") || columnName.startsWith("show_")) {
    if (value === true || value === "true" || value === "t") return 1
    if (value === false || value === "false" || value === "f") return 0
    return value ? 1 : 0
  }
  
  return value
}

// Validate row for import
function validateImportRow(row: any, table: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!row.id && row.id !== 0) {
    errors.push("Missing 'id' field")
  }
  
  return { valid: errors.length === 0, errors }
}

// Verify schema compatibility
async function verifySchema(client: any, sqliteDb: any): Promise<{ compatible: boolean; issues: string[] }> {
  const issues: string[] = []
  
  for (const table of IMPORT_TABLES) {
    // Check if table exists in remote
    try {
      const remoteExists = await client.query(`SELECT to_regclass($1) as exists`, [table])
      if (!remoteExists.rows[0]?.exists) {
        issues.push(`Remote table '${table}' does not exist`)
        continue
      }
    } catch (err) {
      issues.push(`Cannot check remote table '${table}': ${err}`)
      continue
    }
    
    // Check if table exists locally
    try {
      const localInfo = sqliteDb.prepare(`PRAGMA table_info(${table})`).all()
      if (!localInfo || localInfo.length === 0) {
        issues.push(`Local table '${table}' does not exist - will be created if needed`)
      }
    } catch (err) {
      issues.push(`Cannot check local table '${table}': ${err}`)
    }
  }
  
  return {
    compatible: issues.filter(i => !i.includes("will be created")).length === 0,
    issues
  }
}

// Process import batch
function processImportBatch(
  sqliteDb: any,
  table: string,
  rows: any[],
  strategy: string,
  startIndex: number
): { inserted: number; updated: number; skipped: number; errors: number; errorDetails: string[] } {
  let inserted = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  const errorDetails: string[] = []
  
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowIndex = startIndex + i
    const id = r.id
    
    // Validate row
    const validation = validateImportRow(r, table)
    if (!validation.valid) {
      errors++
      errorDetails.push(`Row ${rowIndex}: ${validation.errors.join(", ")}`)
      continue
    }
    
    if (!id) {
      skipped++
      continue
    }
    
    try {
      // Check if row exists locally
      const localRow = sqliteDb.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)
      
      if (!localRow) {
        // Insert new row
        const cols = Object.keys(r)
        const vals = cols.map(c => convertValueToSQLite(r[c], c))
        const placeholders = cols.map(() => "?").join(",")
        const sql = `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(",")}) VALUES (${placeholders})`
        
        sqliteDb.prepare(sql).run(...vals)
        inserted++
        continue
      }
      
      // Local exists - apply strategy
      if (strategy === 'skip') {
        skipped++
        continue
      }
      
      if (strategy === 'overwrite') {
        const cols = Object.keys(r)
        const setClause = cols.map(c => `"${c}" = ?`).join(",")
        const vals = cols.map(c => convertValueToSQLite(r[c], c))
        
        sqliteDb.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...vals, id)
        updated++
        continue
      }
      
      if (strategy === 'merge') {
        // Only overwrite local NULL/empty values with remote non-null
        const cols = Object.keys(r)
        const updates: string[] = []
        const vals: any[] = []
        
        for (const c of cols) {
          const remoteVal = convertValueToSQLite(r[c], c)
          const localVal = localRow[c]
          
          if ((localVal === null || localVal === undefined || localVal === '') && 
              remoteVal !== null && remoteVal !== undefined && remoteVal !== '') {
            updates.push(`"${c}" = ?`)
            vals.push(remoteVal)
          }
        }
        
        if (updates.length === 0) {
          skipped++
          continue
        }
        
        sqliteDb.prepare(`UPDATE ${table} SET ${updates.join(",")} WHERE id = ?`).run(...vals, id)
        updated++
      }
      
      if (strategy === 'newest') {
        // Only update if remote is newer (compare created_at or updated_at)
        const remoteTime = r.updated_at || r.created_at
        const localTime = localRow.updated_at || localRow.created_at
        
        if (remoteTime && localTime) {
          const remoteDate = new Date(remoteTime).getTime()
          const localDate = typeof localTime === 'number' ? localTime : new Date(localTime).getTime()
          
          if (remoteDate > localDate) {
            const cols = Object.keys(r)
            const setClause = cols.map(c => `"${c}" = ?`).join(",")
            const vals = cols.map(c => convertValueToSQLite(r[c], c))
            
            sqliteDb.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...vals, id)
            updated++
          } else {
            skipped++
          }
        } else {
          skipped++
        }
      }
    } catch (err: any) {
      errors++
      errorDetails.push(`Row ${rowIndex} (id: ${id}): ${err.message || String(err)}`)
    }
  }
  
  return { inserted, updated, skipped, errors, errorDetails }
}

// Strategy: 'skip' | 'overwrite' | 'merge' | 'newest'
export async function importFromPostgres(
  connectionString: string, 
  strategy: string = 'merge', 
  dryRun = true,
  createBackupFirst = true
): Promise<ImportResult> {
  const startTime = Date.now()
  console.log(`[CloudSyncImport] Starting import (dryRun: ${dryRun}, strategy: ${strategy})...`)
  
  // Create backup before import (unless dry run)
  let backupPath: string | undefined
  if (!dryRun && createBackupFirst) {
    const backup = await createBackup()
    if (backup) {
      backupPath = backup
    }
  }
  
  const { Client } = await import("pg")
  const client = new Client({ 
    connectionString, 
    statement_timeout: 120000,
    connectionTimeoutMillis: 10000
  })
  
  try {
    await client.connect()
    console.log("[CloudSyncImport] Connected to PostgreSQL database")
  } catch (connErr: any) {
    throw new Error(`Failed to connect to PostgreSQL: ${connErr.message || String(connErr)}`)
  }

  const lockKey = pgBigIntFromHash(connectionString)
  const lockRes = await client.query("SELECT pg_try_advisory_lock($1) as locked", [lockKey])
  if (!lockRes.rows[0].locked) {
    await client.end()
    throw new Error("Unable to acquire advisory lock on remote DB - another sync may be in progress")
  }

  const { sqliteDb } = await import("./db")
  if (!sqliteDb) {
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()
    throw new Error("Local SQLite database not available")
  }

  let totalRows = 0
  let totalImported = 0
  let totalSkipped = 0
  let totalErrors = 0
  const allChecksums: string[] = []

  try {
    // Verify schema compatibility
    const schemaCheck = await verifySchema(client, sqliteDb)
    if (!schemaCheck.compatible) {
      console.warn("[CloudSyncImport] Schema compatibility issues:", schemaCheck.issues)
    }
    
    // Use transaction for local changes
    if (!dryRun) {
      sqliteDb.prepare("BEGIN TRANSACTION").run()
      console.log("[CloudSyncImport] Local transaction started")
    }

    const summary: Record<string, { remoteRows: number; inserted: number; updated: number; skipped: number; errors?: number; errorDetails?: string[] }> = {}

    for (const table of IMPORT_TABLES) {
      const tableStartTime = Date.now()
      console.log(`[CloudSyncImport] Processing table: ${table}`)
      
      // Check if table exists in remote Postgres
      try {
        const chk = await client.query(`SELECT 1 FROM "${table}" LIMIT 1`)
      } catch (err) {
        // Table doesn't exist remotely
        console.log(`[CloudSyncImport] Table ${table} not found in remote, skipping`)
        summary[table] = { remoteRows: 0, inserted: 0, updated: 0, skipped: 0 }
        continue
      }

      // Get all remote rows
      const remoteRowsRes = await client.query(`SELECT * FROM "${table}" ORDER BY id`)
      const rows = remoteRowsRes.rows || []
      const checksum = generateChecksum(rows)
      
      totalRows += rows.length
      summary[table] = { remoteRows: rows.length, inserted: 0, updated: 0, skipped: 0 }
      allChecksums.push(`${table}:${checksum}`)
      
      console.log(`[CloudSyncImport] Table ${table}: ${rows.length} rows, checksum: ${checksum}`)

      if (dryRun) {
        continue
      }

      // Check if local table exists, create if needed
      const localInfo = sqliteDb.prepare(`PRAGMA table_info(${table})`).all()
      if (!localInfo || localInfo.length === 0) {
        console.warn(`[CloudSyncImport] Local table ${table} does not exist, skipping`)
        continue
      }

      // Process in batches
      let tableInserted = 0
      let tableUpdated = 0
      let tableSkipped = 0
      let tableErrors = 0
      const allErrorDetails: string[] = []

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length))
        const batchResult = processImportBatch(sqliteDb, table, batch, strategy, i)
        
        tableInserted += batchResult.inserted
        tableUpdated += batchResult.updated
        tableSkipped += batchResult.skipped
        tableErrors += batchResult.errors
        allErrorDetails.push(...batchResult.errorDetails)
        
        // Log progress for large tables
        if (rows.length > BATCH_SIZE && (i + BATCH_SIZE) % (BATCH_SIZE * 5) === 0) {
          console.log(`[CloudSyncImport] ${table}: Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} rows`)
        }
      }

      summary[table].inserted = tableInserted
      summary[table].updated = tableUpdated
      summary[table].skipped = tableSkipped
      if (tableErrors > 0) {
        summary[table].errors = tableErrors
        summary[table].errorDetails = allErrorDetails.slice(0, 10)
      }
      
      totalImported += tableInserted + tableUpdated
      totalSkipped += tableSkipped
      totalErrors += tableErrors
      
      const tableDuration = Date.now() - tableStartTime
      console.log(`[CloudSyncImport] Table ${table}: +${tableInserted} inserted, ~${tableUpdated} updated, =${tableSkipped} skipped, ${tableErrors} errors, took ${tableDuration}ms`)
    }

    // Commit local transaction
    if (!dryRun) {
      sqliteDb.prepare("COMMIT").run()
      console.log("[CloudSyncImport] Local transaction committed")
    }
    
    // Release lock and close connection
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()

    const duration = Date.now() - startTime
    const importChecksum = crypto.createHash("sha256").update(allChecksums.join("|")).digest("hex").substring(0, 32)

    console.log(`[CloudSyncImport] Import completed: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors, took ${duration}ms`)
    
    return {
      ok: true,
      dryRun,
      strategy,
      summary,
      totalRows,
      totalImported,
      totalSkipped,
      totalErrors,
      importChecksum,
      backupPath,
      duration,
      timestamp: new Date().toISOString()
    }
  } catch (err: any) {
    console.error("[CloudSyncImport] Import failed:", err)
    
    // Rollback local changes
    if (!dryRun) {
      try {
        sqliteDb.prepare("ROLLBACK").run()
        console.log("[CloudSyncImport] Local transaction rolled back")
      } catch (rollbackErr) {
        console.error("[CloudSyncImport] Rollback failed:", rollbackErr)
      }
    }
    
    // Release lock and close connection
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    } catch (unlockErr) {
      console.error("[CloudSyncImport] Unlock failed:", unlockErr)
    }
    
    try {
      await client.end()
    } catch (endErr) {
      console.error("[CloudSyncImport] Connection close failed:", endErr)
    }
    
    throw new Error(`Import failed: ${err.message || String(err)}`)
  }
}

// Verify import by comparing row counts and checksums
export async function verifyImport(connectionString: string): Promise<{
  ok: boolean
  mismatches: string[]
  details: Record<string, { remote: number; local: number; match: boolean }>
}> {
  console.log("[CloudSyncImport] Starting import verification...")
  
  const { Client } = await import("pg")
  const { sqliteDb } = await import("./db")
  
  if (!sqliteDb) {
    throw new Error("Local SQLite database not available")
  }
  
  const client = new Client({ connectionString, statement_timeout: 60000 })
  await client.connect()
  
  const details: Record<string, { remote: number; local: number; match: boolean }> = {}
  const mismatches: string[] = []
  
  try {
    for (const table of IMPORT_TABLES) {
      // Get remote count
      let remoteCount = 0
      try {
        const remoteRes = await client.query(`SELECT COUNT(*) as count FROM "${table}"`)
        remoteCount = parseInt(remoteRes.rows[0]?.count || "0")
      } catch (err) {
        remoteCount = -1 // Table doesn't exist
      }
      
      // Get local count
      let localCount = 0
      try {
        const localRes = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
        localCount = localRes?.count || 0
      } catch (err) {
        localCount = -1 // Table doesn't exist
      }
      
      const match = remoteCount === localCount
      details[table] = { remote: remoteCount, local: localCount, match }
      
      if (!match) {
        mismatches.push(table)
      }
    }
    
    await client.end()
    
    console.log(`[CloudSyncImport] Verification completed: ${mismatches.length} mismatches`)
    
    return {
      ok: mismatches.length === 0,
      mismatches,
      details
    }
  } catch (err: any) {
    await client.end()
    throw new Error(`Verification failed: ${err.message || String(err)}`)
  }
}

// Restore from backup
export async function restoreFromBackup(backupPath: string): Promise<{ ok: boolean; message: string }> {
  console.log(`[CloudSyncImport] Restoring from backup: ${backupPath}`)
  
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`)
  }
  
  try {
    const { getDatabasePath, setDatabasePath } = await import("./db")
    const dbPath = getDatabasePath()
    
    // Copy backup over current database
    fs.copyFileSync(backupPath, dbPath)
    
    // Reinitialize database
    setDatabasePath(dbPath)
    
    console.log("[CloudSyncImport] Database restored from backup")
    
    return {
      ok: true,
      message: `Database successfully restored from ${backupPath}`
    }
  } catch (err: any) {
    throw new Error(`Restore failed: ${err.message || String(err)}`)
  }
}
