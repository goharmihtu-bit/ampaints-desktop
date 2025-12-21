import crypto from "crypto"

import type { Client } from "pg"

// Tables in dependency order (parent tables first, child tables last)
// This ensures foreign key constraints are satisfied during import
const EXPORT_TABLES = [
  "products",      // No dependencies
  "variants",      // Depends on products
  "colors",        // Depends on variants
  "sales",         // No dependencies (customer data is inline)
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

// Export statistics interface
export interface ExportStats {
  table: string
  totalRows: number
  exported: number
  errors: number
  checksum?: string
  duration: number
}

export interface ExportResult {
  ok: boolean
  dryRun: boolean
  summary: Record<string, { rows: number; inserted?: number; updated?: number; errors?: number; checksum?: string }>
  totalRows: number
  totalExported: number
  totalErrors: number
  exportChecksum: string
  duration: number
  timestamp: string
}

function pgBigIntFromHash(s: string) {
  const h = crypto.createHash("sha256").update(s).digest()
  // take first 8 bytes
  const hex = h.slice(0, 8).toString("hex")
  // ensure positive
  return BigInt(`0x${hex}`) & BigInt("0x7fffffffffffffff")
}

// Generate checksum for data integrity verification
function generateChecksum(data: any[]): string {
  if (data.length === 0) return "empty"
  const dataString = JSON.stringify(data.map(row => {
    // Sort keys for consistent hashing
    const sortedRow: Record<string, any> = {}
    Object.keys(row).sort().forEach(key => {
      sortedRow[key] = row[key]
    })
    return sortedRow
  }))
  return crypto.createHash("sha256").update(dataString).digest("hex").substring(0, 16)
}

// Map SQLite types to PostgreSQL types
function sqliteTypeToPgType(sqliteType: string, columnName: string): string {
  const typ = (sqliteType || "").toUpperCase()
  
  // Handle specific column names
  if (columnName === "id") return "TEXT PRIMARY KEY"
  if (columnName.endsWith("_id") && columnName !== "id") return "TEXT"
  if (columnName.endsWith("_at") || columnName.endsWith("_date")) return "TIMESTAMPTZ"
  
  // Handle SQLite types
  if (typ.includes("INT")) return "BIGINT"
  if (typ.includes("REAL") || typ.includes("FLOAT") || typ.includes("DOUBLE")) return "DOUBLE PRECISION"
  if (typ.includes("BOOL")) return "BOOLEAN"
  if (typ.includes("BLOB")) return "BYTEA"
  if (typ.includes("DATE") || typ.includes("TIME")) return "TIMESTAMPTZ"
  if (typ.includes("NUMERIC") || typ.includes("DECIMAL")) return "DECIMAL"
  
  return "TEXT"
}

// Validate row data before export
function validateRow(row: any, table: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check for required id field
  if (!row.id && row.id !== 0) {
    errors.push(`Missing required 'id' field`)
  }
  
  // Table-specific validations
  switch (table) {
    case "products":
      if (!row.company) errors.push("Missing 'company' field")
      if (!row.product_name) errors.push("Missing 'product_name' field")
      break
    case "variants":
      if (!row.product_id) errors.push("Missing 'product_id' field")
      if (!row.packing_size) errors.push("Missing 'packing_size' field")
      break
    case "colors":
      if (!row.variant_id) errors.push("Missing 'variant_id' field")
      if (!row.color_name) errors.push("Missing 'color_name' field")
      if (!row.color_code) errors.push("Missing 'color_code' field")
      break
    case "sales":
      if (!row.customer_name) errors.push("Missing 'customer_name' field")
      if (!row.customer_phone) errors.push("Missing 'customer_phone' field")
      break
    case "sale_items":
      if (!row.sale_id) errors.push("Missing 'sale_id' field")
      if (!row.color_id) errors.push("Missing 'color_id' field")
      break
    case "returns":
      if (!row.customer_name) errors.push("Missing 'customer_name' field")
      if (!row.customer_phone) errors.push("Missing 'customer_phone' field")
      break
  }
  
  return { valid: errors.length === 0, errors }
}

// Convert SQLite values to PostgreSQL compatible format
function convertValue(value: any, columnName: string): any {
  if (value === null || value === undefined) return null
  
  // Handle timestamp columns
  if (columnName.endsWith("_at") || columnName.endsWith("_date")) {
    // SQLite stores timestamps as integers (milliseconds since epoch) or ISO strings
    if (typeof value === "number") {
      return new Date(value).toISOString()
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
      return new Date(parseInt(value)).toISOString()
    }
    return value
  }
  
  // Handle boolean columns
  if (columnName.startsWith("is_") || columnName.startsWith("stock_restored") || columnName.startsWith("perm_") || columnName.startsWith("show_")) {
    return value === 1 || value === true || value === "1" || value === "true"
  }
  
  return value
}

async function ensurePgTable(client: Client, table: string, cols: { name: string; type: string }[]) {
  const existsRes = await client.query(
    `SELECT to_regclass($1) as exists`,
    [table],
  )
  
  if (existsRes.rows[0] && existsRes.rows[0].exists) {
    // Table exists - check for missing columns and add them
    const existingCols = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table]
    )
    const existingColNames = new Set(existingCols.rows.map(r => r.column_name))
    
    for (const col of cols) {
      if (!existingColNames.has(col.name)) {
        const pgType = sqliteTypeToPgType(col.type, col.name)
        // Don't add PRIMARY KEY constraint to new columns
        const typeWithoutPK = pgType.replace(" PRIMARY KEY", "")
        try {
          await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col.name}" ${typeWithoutPK}`)
          console.log(`[CloudSyncExport] Added missing column "${col.name}" to table "${table}"`)
        } catch (err) {
          console.warn(`[CloudSyncExport] Could not add column "${col.name}" to table "${table}":`, err)
        }
      }
    }
    return
  }

  // Build create table DDL
  const colsSql = cols
    .map((c) => {
      const pgType = sqliteTypeToPgType(c.type, c.name)
      return `"${c.name}" ${pgType}`
    })
    .join(", ")

  const ddl = `CREATE TABLE IF NOT EXISTS "${table}" (${colsSql})`
  await client.query(ddl)
  console.log(`[CloudSyncExport] Created table "${table}"`)
}

// Process rows in batches for better performance
async function processBatch(
  client: Client,
  table: string,
  rows: any[],
  cols: string[],
  startIndex: number
): Promise<{ inserted: number; errors: number; errorDetails: string[] }> {
  let inserted = 0
  let errors = 0
  const errorDetails: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = startIndex + i
    
    // Validate row
    const validation = validateRow(row, table)
    if (!validation.valid) {
      errors++
      errorDetails.push(`Row ${rowIndex}: ${validation.errors.join(", ")}`)
      continue
    }
    
    // Convert values for PostgreSQL
    const vals = cols.map(c => convertValue(row[c], c))
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(",")
    const setClause = cols.filter(c => c !== "id").map(c => `"${c}" = EXCLUDED."${c}"`).join(",")
    
    const sql = setClause 
      ? `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(",")}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${setClause}`
      : `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(",")}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`
    
    const savepointName = `sp_${table}_${rowIndex}`.replace(/[^a-zA-Z0-9_]/g, '_')
    
    try {
      await client.query(`SAVEPOINT ${savepointName}`)
      await client.query(sql, vals)
      await client.query(`RELEASE SAVEPOINT ${savepointName}`)
      inserted++
    } catch (err: any) {
      try {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`)
      } catch (rollbackErr) {
        console.error(`[CloudSyncExport] Error rolling back savepoint for ${table}:`, rollbackErr)
      }
      errors++
      errorDetails.push(`Row ${rowIndex} (id: ${row.id}): ${err.message || String(err)}`)
    }
  }

  return { inserted, errors, errorDetails }
}

export async function exportToPostgres(connectionString: string, dryRun = true): Promise<ExportResult> {
  const startTime = Date.now()
  console.log(`[CloudSyncExport] Starting export (dryRun: ${dryRun})...`)
  
  const { Client } = await import("pg")
  const client = new Client({ 
    connectionString, 
    statement_timeout: 120000, // 2 minutes timeout for larger operations
    connectionTimeoutMillis: 10000 // 10 seconds connection timeout
  })
  
  try {
    await client.connect()
    console.log("[CloudSyncExport] Connected to PostgreSQL database")
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
  let totalExported = 0
  let totalErrors = 0
  const allChecksums: string[] = []

  try {
    await client.query("BEGIN")
    console.log("[CloudSyncExport] Transaction started")

    const summary: Record<string, { rows: number; inserted?: number; updated?: number; errors?: number; checksum?: string; errorDetails?: string[] }> = {}

    for (const table of EXPORT_TABLES) {
      const tableStartTime = Date.now()
      console.log(`[CloudSyncExport] Processing table: ${table}`)
      
      // Check table exists in SQLite
      const info = sqliteDb.prepare(`PRAGMA table_info(${table})`).all() as { name: string; type: string }[]
      if (!info || info.length === 0) {
        console.log(`[CloudSyncExport] Table ${table} not found in SQLite, skipping`)
        summary[table] = { rows: 0 }
        continue
      }

      // Get all rows from SQLite
      const rows: any[] = sqliteDb.prepare(`SELECT * FROM ${table}`).all()
      const checksum = generateChecksum(rows)
      
      totalRows += rows.length
      summary[table] = { rows: rows.length, checksum }
      allChecksums.push(`${table}:${checksum}`)
      
      console.log(`[CloudSyncExport] Table ${table}: ${rows.length} rows, checksum: ${checksum}`)

      if (dryRun) {
        // In dry run, just collect statistics
        continue
      }

      // Ensure table exists in PostgreSQL with correct schema
      await ensurePgTable(client, table, info.map(c => ({ name: c.name, type: c.type })))

      // Process rows in batches
      const cols = Object.keys(rows[0] || {})
      let tableInserted = 0
      let tableErrors = 0
      const allErrorDetails: string[] = []

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length))
        const batchResult = await processBatch(client, table, batch, cols, i)
        
        tableInserted += batchResult.inserted
        tableErrors += batchResult.errors
        allErrorDetails.push(...batchResult.errorDetails)
        
        // Log progress for large tables
        if (rows.length > BATCH_SIZE && (i + BATCH_SIZE) % (BATCH_SIZE * 5) === 0) {
          console.log(`[CloudSyncExport] ${table}: Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} rows`)
        }
      }

      summary[table].inserted = tableInserted
      summary[table].errors = tableErrors
      if (allErrorDetails.length > 0) {
        summary[table].errorDetails = allErrorDetails.slice(0, 10) // Keep first 10 errors
      }
      
      totalExported += tableInserted
      totalErrors += tableErrors
      
      const tableDuration = Date.now() - tableStartTime
      console.log(`[CloudSyncExport] Table ${table}: ${tableInserted} exported, ${tableErrors} errors, took ${tableDuration}ms`)
    }

    // Commit transaction
    await client.query("COMMIT")
    console.log("[CloudSyncExport] Transaction committed successfully")
    
    // Release lock
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()

    const duration = Date.now() - startTime
    const exportChecksum = crypto.createHash("sha256").update(allChecksums.join("|")).digest("hex").substring(0, 32)

    console.log(`[CloudSyncExport] Export completed: ${totalExported}/${totalRows} rows exported, ${totalErrors} errors, took ${duration}ms`)
    
    return {
      ok: true,
      dryRun,
      summary,
      totalRows,
      totalExported,
      totalErrors,
      exportChecksum,
      duration,
      timestamp: new Date().toISOString()
    }
  } catch (err: any) {
    console.error("[CloudSyncExport] Export failed:", err)
    
    try {
      await client.query("ROLLBACK")
    } catch (rollbackErr) {
      console.error("[CloudSyncExport] Rollback failed:", rollbackErr)
    }
    
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    } catch (unlockErr) {
      console.error("[CloudSyncExport] Unlock failed:", unlockErr)
    }
    
    try {
      await client.end()
    } catch (endErr) {
      console.error("[CloudSyncExport] Connection close failed:", endErr)
    }
    
    throw new Error(`Export failed: ${err.message || String(err)}`)
  }
}

// Verify export by comparing checksums
export async function verifyExport(connectionString: string): Promise<{
  ok: boolean
  mismatches: string[]
  details: Record<string, { local: string; remote: string; match: boolean }>
}> {
  console.log("[CloudSyncExport] Starting export verification...")
  
  const { Client } = await import("pg")
  const { sqliteDb } = await import("./db")
  
  if (!sqliteDb) {
    throw new Error("Local SQLite database not available")
  }
  
  const client = new Client({ connectionString, statement_timeout: 60000 })
  await client.connect()
  
  const details: Record<string, { local: string; remote: string; match: boolean }> = {}
  const mismatches: string[] = []
  
  try {
    for (const table of EXPORT_TABLES) {
      // Get local checksum
      const localRows: any[] = sqliteDb.prepare(`SELECT * FROM ${table}`).all()
      const localChecksum = generateChecksum(localRows)
      
      // Get remote checksum
      let remoteChecksum = "not_found"
      try {
        const remoteRows = await client.query(`SELECT * FROM "${table}" ORDER BY id`)
        remoteChecksum = generateChecksum(remoteRows.rows)
      } catch (err) {
        remoteChecksum = "table_not_found"
      }
      
      const match = localChecksum === remoteChecksum
      details[table] = { local: localChecksum, remote: remoteChecksum, match }
      
      if (!match) {
        mismatches.push(table)
      }
    }
    
    await client.end()
    
    console.log(`[CloudSyncExport] Verification completed: ${mismatches.length} mismatches`)
    
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
