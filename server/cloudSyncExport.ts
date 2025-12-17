import crypto from "crypto"

import type { Client } from "pg"

const EXPORT_TABLES = [
  "products",
  "variants",
  "colors",
  "sales",
  "sale_items",
  "stock_in_history",
  "payment_history",
  "returns",
  "return_items",
  "customer_accounts",
  "settings",
]

function pgBigIntFromHash(s: string) {
  const h = crypto.createHash("sha256").update(s).digest()
  // take first 8 bytes
  const hex = h.slice(0, 8).toString("hex")
  // ensure positive
  return BigInt(`0x${hex}`) & BigInt("0x7fffffffffffffff")
}

async function ensurePgTable(client: Client, table: string, cols: { name: string; type: string }[]) {
  const existsRes = await client.query(
    `SELECT to_regclass($1) as exists`,
    [table],
  )
  if (existsRes.rows[0] && existsRes.rows[0].exists) return

  // Build a simple create table DDL based on column types
  const colsSql = cols
    .map((c) => {
      let t = "TEXT"
      const typ = (c.type || "").toUpperCase()
      if (typ.includes("INT")) t = "BIGINT"
      if (typ.includes("DATE") || typ.includes("TIME") || c.name.endsWith("_at") || c.name.endsWith("_date")) t = "TIMESTAMP"
      if (c.name === "id") t = "TEXT PRIMARY KEY"
      return `"${c.name}" ${t}`
    })
    .join(", ")

  const ddl = `CREATE TABLE IF NOT EXISTS "${table}" (${colsSql})`
  await client.query(ddl)
}

export async function exportToPostgres(connectionString: string, dryRun = true) {
  const { Client } = await import("pg")
  const client = new Client({ connectionString, statement_timeout: 60000 })
  await client.connect()

  const lockKey = pgBigIntFromHash(connectionString)
  const lockRes = await client.query("SELECT pg_try_advisory_lock($1) as locked", [lockKey])
  if (!lockRes.rows[0].locked) {
    await client.end()
    throw new Error("Unable to acquire advisory lock on remote DB")
  }

  const { sqliteDb } = await import("./db")
  if (!sqliteDb) {
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()
    throw new Error("Local sqlite DB not available")
  }

  try {
    await client.query("BEGIN")

    const summary: Record<string, { rows: number; inserted?: number; updated?: number; errors?: number }> = {}

    for (const table of EXPORT_TABLES) {
      // Check table exists in sqlite
      const info = sqliteDb.prepare(`PRAGMA table_info(${table})`).all() as { name: string; type: string }[]
      if (!info || info.length === 0) {
        summary[table] = { rows: 0 }
        continue
      }

      const rows: any[] = sqliteDb.prepare(`SELECT * FROM ${table}`).all()
      summary[table] = { rows: rows.length }

      if (dryRun) continue

      // Ensure table exists in Postgres
      await ensurePgTable(client, table, info.map((c) => ({ name: c.name, type: c.type })))

      let inserted = 0
      let updated = 0
      let errors = 0
      let rowIndex = 0

      for (const row of rows) {
        const cols = Object.keys(row)
        const vals = cols.map((c) => row[c])
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(",")
        const setClause = cols.filter((c) => c !== "id").map((c) => `"${c}" = EXCLUDED."${c}"`).join(",")
        const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${setClause}`
        
        // Use SAVEPOINT to handle individual row errors without aborting the entire transaction
        // Use rowIndex for unique savepoint name to avoid conflicts when row.id is null/undefined
        const savepointName = `sp_${table}_${rowIndex}`.replace(/[^a-zA-Z0-9_]/g, '_')
        rowIndex++
        try {
          await client.query(`SAVEPOINT ${savepointName}`)
          await client.query(sql, vals)
          await client.query(`RELEASE SAVEPOINT ${savepointName}`)
          // optimistic counting: treat as inserted/updated both
          inserted++
        } catch (err) {
          // Rollback to savepoint to recover the transaction from aborted state
          try {
            await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`)
          } catch (rollbackErr) {
            // If rollback fails, log but continue
            console.error(`[CloudSyncExport] Error rolling back savepoint for ${table}:`, rollbackErr)
          }
          errors++
          // log and continue
          console.error(`[CloudSyncExport] Error upserting into ${table}:`, err)
        }
      }

      summary[table].inserted = inserted
      summary[table].updated = updated
      if (errors > 0) {
        summary[table].errors = errors
      }
    }

    await client.query("COMMIT")
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()
    return { ok: true, dryRun, summary }
  } catch (err: any) {
    await client.query("ROLLBACK")
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()
    throw err
  }
}
